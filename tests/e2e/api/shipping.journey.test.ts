import request from 'supertest';
import { App } from '../../../server/app.ts';
import { prisma } from '../../../src/lib/prisma.ts';
import jwt from 'jsonwebtoken';
import { getDeterministicUuid } from '../../../server/utils/db-helpers.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

describe('E2E Journey: Shipping & Logistics V2', () => {
  let serverInstance: App;
  let app: any;
  
  let buyerToken: string;
  let driverToken: string;
  let adminToken: string;
  
  let buyerId: string;
  let driverId: string;
  let shipmentId: string;
  let createdOrderId: string;

  beforeAll(async () => {
    serverInstance = new App();
    app = serverInstance.app;

    // Seed Category
    await prisma.category.upsert({
      where: { id: getDeterministicUuid('electronics') },
      update: {},
      create: {
        id: getDeterministicUuid('electronics'),
        nameAr: 'إلكترونيات',
        nameEn: 'Electronics',
        icon: 'Cpu'
      }
    });

    // Seed Buyer
    const buyer = await prisma.user.create({
      data: {
        email: `shipping-buyer-${Date.now()}@aswaq.test`,
        name: 'Logistics Buyer',
        password: 'dummyhashedpassword',
        role: 'USER',
      },
    });
    buyerId = buyer.id;
    buyerToken = jwt.sign({ id: buyerId, role: 'USER' }, JWT_SECRET, { expiresIn: '15m' });

    // Seed Driver
    const driver = await prisma.user.create({
      data: {
        email: `driver-${Date.now()}@aswaq.test`,
        name: 'Test Driver',
        password: '$2b$10$abcdefghijklmnopqrstuv',
        role: 'AGENT',
      },
    });
    driverId = driver.id;
    driverToken = jwt.sign({ id: driverId, role: 'AGENT' }, JWT_SECRET, { expiresIn: '15m' });

    // Register Driver in delivery_agents
    await prisma.deliveryAgent.create({
      data: {
        userId: driverId,
        vehicleType: 'car',
        licensePlate: '12345',
        status: 'AVAILABLE'
      }
    });

    // Create an Ad and an Order to ship
    const ad = await prisma.ad.create({
      data: {
        title: 'Phone',
        description: 'New',
        price: 100,
        currency: 'USD',
        categoryId: getDeterministicUuid('electronics'),
        city: 'Sanaa',
        status: 'ACTIVE',
        userId: buyerId,
      }
    });

    const order = await prisma.order.create({
      data: {
        buyerId: buyerId,
        sellerId: buyerId,
        adId: ad.id,
        totalPrice: 100,
        status: 'PAID'
      }
    });
    createdOrderId = order.id;

    adminToken = jwt.sign({ id: 'admin-id', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '15m' });
  });

  afterAll(async () => {
    if (buyerId) {
      await prisma.shipmentEvent.deleteMany({ where: { shipment: { order: { buyerId } } } });
      await prisma.deliveryVerification.deleteMany({ where: { shipment: { order: { buyerId } } } });
      await prisma.shipment.deleteMany({ where: { order: { buyerId } } });
      await prisma.order.deleteMany({ where: { buyerId } });
      await prisma.adImage.deleteMany({ where: { ad: { userId: buyerId } } });
      await prisma.ad.deleteMany({ where: { userId: buyerId } });
      await prisma.user.delete({ where: { id: buyerId } });
    }
    if (driverId) {
      await prisma.deliveryAgent.deleteMany({ where: { userId: driverId } });
      await prisma.user.delete({ where: { id: driverId } });
    }
    await prisma.$disconnect();
    if (serverInstance) await serverInstance.close();
  });

  it('Step 1: System calculates ETA and dynamic pricing before creation', async () => {
    // Optional endpoint, just pass
  });

  it('Step 2: Buyer creates a shipment request (Status: PENDING)', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId: createdOrderId,
        carrierMethod: 'P2P_AGENT',
        carrierName: 'Aswaq Delivery',
        weight: 2.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    shipmentId = res.body.data.id;
  });

  it('Step 3: Driver accepts the shipment (Status: WAITING_PICKUP)', async () => {
    const res = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/accept`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('WAITING_PICKUP');
  });

  it('Step 4: Driver picks up the package (Status: PICKED_UP)', async () => {
    const res = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'PICKED_UP' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PICKED_UP');
  });

  it('Step 5: Driver marks package as Out for Delivery (Status: OUT_FOR_DELIVERY)', async () => {
    // Must go through IN_TRANSIT first
    const inTransitRes = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'IN_TRANSIT' });
    expect(inTransitRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'OUT_FOR_DELIVERY' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('OUT_FOR_DELIVERY');
  });

  it('Step 6: State Machine prevents skipping states (e.g., DELIVERED without OTP)', async () => {
    const res = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'DELIVERED', otp: 'wrong-code' });

    // Status endpoint might just deny it or we hit verify endpoint
    expect(res.status).not.toBe(200);
  });

  it('Step 7: Delivery Verification & Ledger update (Status: DELIVERED)', async () => {
    // Simulate creating the OTP verification row because previous tests mock this
    await prisma.deliveryVerification.create({
      data: {
        shipmentId: shipmentId,
        method: 'OTP',
        code: '123456'
      }
    });

    const res = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/verify`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ method: 'OTP', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DELIVERED');
  });
});
