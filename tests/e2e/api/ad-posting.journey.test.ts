/**
 * E2E Integration Test - Ad Posting Journey
 * 
 * Tests the lifecycle of creating and moderating an ad:
 * 1. User registers and logs in
 * 2. User creates an ad (Status: PENDING)
 * 3. Ad is not visible to public search
 * 4. Admin approves the ad (Status: ACTIVE)
 * 5. Ad becomes visible in public search
 */

import request from 'supertest';
import { App } from '../../../server/app.ts';
import { prisma } from '../../../src/lib/prisma.ts';
import jwt from 'jsonwebtoken';
import { getDeterministicUuid } from '../../../server/utils/db-helpers.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

describe('E2E Journey: Ad Posting & Moderation', () => {
  let serverInstance: App;
  let app: any;
  
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let createdAdId: string;
  
  const testUserEmail = `ad-poster-${Date.now()}@aswaq.test`;
  const adTitle = `iPhone 15 Pro Max E2E Test ${Date.now()}`;

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

    // Create a regular user
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: 'Ad Poster',
        password: '$2b$12$dummyhashedpassword123456789012345',
        role: 'USER',
      },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: 'USER' }, JWT_SECRET, { expiresIn: '15m' });

    // Create admin token (no need to seed DB for admin if JWT check doesn't DB lookup strictly in tests)
    adminToken = jwt.sign({ id: getDeterministicUuid('admin-id'), role: 'ADMIN' }, JWT_SECRET, { expiresIn: '15m' });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId } }); await prisma.ad.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    if (serverInstance) await serverInstance.close();
  });

  it('Step 1: User creates a new Ad (Status becomes PENDING)', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: adTitle,
        description: 'Brand new, sealed.',
        price: 4500,
        currency: 'SAR',
        category: 'electronics',
        city: 'Riyadh'
      });

    expect(res.status).toBe(201);
    expect(res.body.ad.status).toBe('PENDING');
    createdAdId = res.body.ad.id;
  });

  it('Step 2: PENDING Ad does not appear in public search results', async () => {
    // If we have a public search endpoint
    const res = await request(app).get(`/api/v1/ads?search=${encodeURIComponent('iPhone 15 Pro Max')}`);
    
    // Depending on the implementation, the ad should be filtered out
    const foundAd = res.body.ads?.find((ad: any) => ad.id === createdAdId);
    expect(foundAd).toBeUndefined();
  });

  it('Step 3: Admin approves the Ad (Status becomes ACTIVE)', async () => {
    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ad.status).toBe('ACTIVE');
  });

  it('Step 4: ACTIVE Ad appears in search results and can be fetched directly', async () => {
    // Fetch directly
    const resDirect = await request(app).get(`/api/v1/ads/${createdAdId}`);
    expect(resDirect.status).toBe(200);
    expect(resDirect.body.status).toBe('ACTIVE');

    // Fetch via list
    const resSearch = await request(app).get('/api/v1/ads');
    const foundAd = resSearch.body.ads?.find((ad: any) => ad.id === createdAdId);
    expect(foundAd).toBeDefined();
    expect(foundAd.title).toBe(adTitle);
  });
});
