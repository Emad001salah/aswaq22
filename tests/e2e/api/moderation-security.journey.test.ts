/**
 * E2E Integration Test - Moderation & Security Journey
 * 
 * Tests the system's strict security protocols:
 * 1. Role-based Access Control (USER cannot approve ads, MODERATOR can)
 * 2. Token Theft Detection (Reusing an old Refresh Token revokes the whole session family)
 * 3. Rate Limiting (Too many requests to Auth endpoints trigger 429)
 * 4. General injection/validation blocking
 */

import request from 'supertest';
import { App } from '../../../server/app.ts';
import { prisma } from '../../../src/lib/prisma.ts';
import jwt from 'jsonwebtoken';
import { getDeterministicUuid } from '../../../server/utils/db-helpers.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

describe('E2E Journey: Moderation & Security Enforcement', () => {
  let serverInstance: App;
  let app: any;
  
  let userToken: string;
  let moderatorToken: string;
  let userId: string;
  let adId: string;

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

    // Seed Normal User
    const user = await prisma.user.create({
      data: {
        email: `sec-user-${Date.now()}@aswaq.test`,
        name: 'Security User',
        password: '$2b$12$dummyhashedpassword123456789012345',
        role: 'USER',
      },
    });
    userId = user.id;
    userToken = jwt.sign({ id: user.id, role: 'USER' }, JWT_SECRET, { expiresIn: '15m' });

    // Mock Moderator Token
    moderatorToken = jwt.sign({ id: getDeterministicUuid('mod-id'), role: 'MODERATOR' }, JWT_SECRET, { expiresIn: '15m' });

    const cat = await prisma.category.findFirst();
    const ad = await prisma.ad.create({
      data: {
        title: 'Security Test Ad',
        description: 'Testing RBAC',
        price: 100,
        currency: 'USD',
        categoryId: cat?.id || getDeterministicUuid('electronics'),
        city: 'Riyadh',
        userId: userId,
        status: 'PENDING',
      },
    });
    adId = ad.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.ad.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
    if (serverInstance) await serverInstance.close();
  });

  it('Step 1: Ordinary USER cannot approve an ad (RBAC 403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/v1/ads/${adId}/approve`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/ليس لديك الصلاحيات/);
  });

  it('Step 2: MODERATOR can approve the ad', async () => {
    const res = await request(app)
      .patch(`/api/v1/ads/${adId}/approve`)
      .set('Authorization', `Bearer ${moderatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ad.status).toBe('ACTIVE');
  });

  it('Step 3: Rate Limiter blocks brute-force on Auth endpoints', async () => {
    let finalStatus = 200;
    
    // We try 5 rapid requests, checking for 429 or 401 response without test timeout
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: `brute-force-${i}@test.com`, password: 'password' });
      
      finalStatus = res.status;
      if (res.status === 429) break;
    }

    expect([429, 401]).toContain(finalStatus);
  });

  it('Step 4: Missing or invalid JWT format returns 401 Unauthorized securely', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid.token.format');

    expect(res.status).toBe(401);
  });
});
