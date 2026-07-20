/**
 * E2E Integration Test - Auth Journey
 * 
 * Tests the complete lifecycle of a user authentication journey:
 * 1. Register with Email/Password
 * 2. Login to get Access and Refresh tokens
 * 3. Use Refresh token to get a new session pair
 * 4. Verify old refresh token reuse triggers security breach protocol (revokes all)
 * 5. Phone OTP send and verify flow
 * 6. Logout securely
 */

import request from 'supertest';
import { App } from '../../../server/app.ts';
import { prisma } from '../../../src/lib/prisma.ts';

describe('E2E Journey: Authentication & Session Management', () => {
  let serverInstance: App;
  let app: any;
  let testUserEmail = `e2e-auth-${Date.now()}@aswaq.test`;
  let testPassword = 'SecurePassword123!';
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    serverInstance = new App();
    app = serverInstance.app;
    // Ensure clean state for this specific email and phone
    await prisma.refreshToken.deleteMany({ where: { user: { email: testUserEmail } } });
    await prisma.user.deleteMany({ where: { OR: [{ email: testUserEmail }, { phone: '966500000001' }] } });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.ad.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
    if (serverInstance) await serverInstance.close();
  });

  it('Step 1: User registers a new account successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'E2E Auth User',
        email: testUserEmail,
        password: testPassword,
        phone: '966500000001'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toHaveProperty('id');
    userId = res.body.user.id;
  });

  it('Step 2: User logs in and receives Token Pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUserEmail,
        password: testPassword
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('Step 3: User accesses protected route with Access Token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.status).toBe(200);
  });

  it('Step 4: User refreshes session successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    // Save old token for reuse test, and update current tokens
    const oldRefreshToken = refreshToken;
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;

    // Security Test: Attempt to reuse the OLD refresh token (Theft simulation)
    const theftRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(theftRes.status).toBe(401);
    expect(theftRes.body).toBeDefined();

    // The current valid refresh token should now be revoked due to the breach
    const breachCheckRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(breachCheckRes.status).toBe(401);
  });

  it('Step 5: Phone OTP Flow (Send & Verify)', async () => {
    const testPhone = '966599999999';
    
    // Send OTP
    const sendRes = await request(app)
      .post('/api/v1/auth/phone/send')
      .send({ phone: testPhone });
    
    if (sendRes.status === 410) {
      expect(sendRes.body.error).toBe('Legacy OTP Disabled');
      return;
    }

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);
    const mockOtp = sendRes.body.devOtp; // In dev mode, OTP is returned in response

    // Verify OTP
    const verifyRes = await request(app)
      .post('/api/v1/auth/phone/verify')
      .send({ phone: testPhone, code: mockOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body).toHaveProperty('accessToken');
    
    // Clean up phone user
    await prisma.refreshToken.deleteMany({ where: { userId: verifyRes.body.user.id } });
    await prisma.user.deleteMany({ where: { id: verifyRes.body.user.id } });
  });

  it('Step 6: User logs out successfully', async () => {
    // Need a fresh login since previous session was revoked during security test
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUserEmail, password: testPassword });
    
    const validRefreshToken = loginRes.body.refreshToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: validRefreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify token is revoked
    const refreshAttempt = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken });
      
    expect(refreshAttempt.status).toBe(401);
  });
});
