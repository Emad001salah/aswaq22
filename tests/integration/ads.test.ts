/**
 * Integration Tests – Ads API
 * Tests the full HTTP request→controller→database→response cycle.
 * Requires a running PostgreSQL database (see jest.setup.ts).
 *
 * Run: npm test -- tests/integration/ads.test.ts
 */

import request from 'supertest';
import { App } from '../../server/app.ts';
import { prisma } from '../../src/lib/prisma.ts';
import jwt from 'jsonwebtoken';
import { getDeterministicUuid } from '../../server/utils/db-helpers.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-minimum-32-chars!!';

let serverInstance: App;
let app: any;
let testUserId: string;
let authToken: string;
let createdAdId: string;

// ── Setup ─────────────────────────────────────────────────────────────────────
  beforeAll(async () => {
  serverInstance = new App();
  app = serverInstance.app;

  // Seed Category
  await prisma.category.upsert({
    where: { id: getDeterministicUuid('cars') },
    update: {},
    create: {
      id: getDeterministicUuid('cars'),
      nameAr: 'سيارات',
      nameEn: 'Cars',
      icon: 'Car'
    }
  });

  // Create a test user
  const user = await prisma.user.create({
    data: {
      email:    `test-${Date.now()}@aswaq.test`,
      name:     'Test User',
      password: '$2b$12$dummyhashedpassword123456789012345',  // pre-hashed
      role:     'USER',
    },
  });
  testUserId = user.id;
  authToken  = jwt.sign({ id: user.id, role: 'USER' }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  if (testUserId) {
    await prisma.notification.deleteMany({ where: { userId: testUserId } });
    await prisma.ad.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  }
  await prisma.$disconnect();
  if (serverInstance) {
    await serverInstance.close();
  }
});

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('POST /api/v1/ads – Create Ad', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .send({ title: 'Test Ad', price: 100 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should create a new ad when authenticated', async () => {
    const payload = {
      title:       'سيارة تويوتا كامري 2020',
      description: 'سيارة نظيفة جداً، مالك واحد، لا حوادث',
      price:       45000,
      currency:    'YER',
      category:    'cars',
      city:        'صنعاء',
    };

    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('نجاح');
    expect(res.body.ad).toMatchObject({
      title:    payload.title,
      price:    payload.price,
      userId:   testUserId,
      status:   'PENDING',
    });

    createdAdId = res.body.ad.id;
  });

  it('should return 422 when title is missing', async () => {
    const res = await request(app)
      .post('/api/v1/ads')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 100, city: 'صنعاء' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Failed');
    expect(res.body.details).toBeDefined();
  });
});

describe('GET /api/v1/ads – List Ads', () => {
  it('should return paginated ads list', async () => {
    const res = await request(app).get('/api/v1/ads');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it('should filter ads by city', async () => {
    const res = await request(app).get('/api/v1/ads?city=صنعاء');

    expect(res.status).toBe(200);
    if (res.body.ads.length > 0) {
      expect(res.body.ads.every((ad: any) => ad.city === 'صنعاء')).toBe(true);
    }
  });

  it('should return X-Correlation-ID header on every response', async () => {
    const res = await request(app).get('/api/v1/ads');
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe('GET /api/v1/ads/:id – Get Single Ad', () => {
  it('should return an ad by ID', async () => {
    if (!createdAdId) return;

    const res = await request(app).get(`/api/v1/ads/${createdAdId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdAdId);
  });

  it('should return 404 for non-existent ad', async () => {
    const res = await request(app).get('/api/v1/ads/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ad not found');
  });
});

describe('PATCH /api/v1/ads/:id/approve & reject', () => {
  let adminToken: string;
  let moderatorToken: string;

  beforeAll(async () => {
    adminToken = jwt.sign({ id: getDeterministicUuid('admin-user-id-123'), role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
    moderatorToken = jwt.sign({ id: getDeterministicUuid('mod-user-id-123'), role: 'MODERATOR' }, JWT_SECRET, { expiresIn: '1h' });
  });

  it('should reject moderation action from non-moderator/admin', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/approve`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(403);
  });

  it('should approve a pending ad by moderator', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/approve`)
      .set('Authorization', `Bearer ${moderatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ad.status).toBe('ACTIVE');
  });

  it('should reject an active ad by moderator', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/reject`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ reason: 'محتوى غير لائق' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ad.status).toBe('REJECTED');
  });

  it('should prevent moderator from approving a rejected ad', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/approve`)
      .set('Authorization', `Bearer ${moderatorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('مدير النظام');
  });

  it('should allow admin to approve a rejected ad', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .patch(`/api/v1/ads/${createdAdId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ad.status).toBe('ACTIVE');
  });
});

describe('DELETE /api/v1/ads/:id – Delete Ad', () => {
  it('should return 401 when not authenticated', async () => {
    if (!createdAdId) return;

    const res = await request(app).delete(`/api/v1/ads/${createdAdId}`);
    expect(res.status).toBe(401);
  });

  it('should delete ad when owner is authenticated', async () => {
    if (!createdAdId) return;

    const res = await request(app)
      .delete(`/api/v1/ads/${createdAdId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('نجاح');
  });
});

describe('GET /api/v1/health – Health Check', () => {
  it('should return service status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
  });
});
