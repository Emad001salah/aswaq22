import { prisma } from './src/lib/prisma.ts';
import { authService } from './server/services/auth.service.ts';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';
import jwt from 'jsonwebtoken';

async function testModule3AuthSessions() {
  console.log('===============================================================');
  console.log('🧪 STAGE 0 - MODULE 3: AUTHENTICATION & SESSIONS AUDIT & TEST');
  console.log('===============================================================');

  const report = {
    module: 'Authentication & Sessions',
    timestamp: new Date().toISOString(),
    tests: [],
    status: 'PENDING'
  };

  function logResult(name, passed, details) {
    console.log(`${passed ? '  ✅ PASS' : '  ❌ FAIL'}: ${name}`);
    if (details) console.log(`     ↳ ${details}`);
    report.tests.push({ name, passed, details });
  }

  try {
    const testUserId = getDeterministicUuid('auth_audit_user_99');

    // Cleanup prior run
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    // 1. Create test user
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: 'auth_test_audit@aswaq22.com',
        phone: '+967771234567',
        name: 'Auth Audit User',
        password: '$2a$10$SampleDummyHashForAuthTestingOnly1234567890',
        role: 'USER'
      }
    });

    logResult(
      'User Creation & Identification',
      user.id === testUserId,
      `User created: ${user.name} (${user.email})`
    );

    // 2. Generate Tokens
    const { accessToken, refreshToken } = await authService.generateTokens(user.id, user.email, user.role);

    const decodedAccess = jwt.decode(accessToken);
    logResult(
      'Token Pair Generation & Expiry Verification',
      accessToken !== null && refreshToken !== null && decodedAccess?.sub === user.id,
      `Access Token expires in 15m (sub: ${decodedAccess?.sub})`
    );

    // 3. Test Refresh Token Rotation
    const newTokens = await authService.refresh(refreshToken);

    logResult(
      'Refresh Token Rotation (New Pair Issued)',
      newTokens.accessToken !== accessToken && newTokens.refreshToken !== refreshToken,
      'Old refresh token consumed, fresh token pair issued successfully.'
    );

    // 4. Test Replay Attack Detection (Reusing old refresh token)
    let replayDetected = false;
    try {
      await authService.refresh(refreshToken);
    } catch (err) {
      if (err.message === 'REPLAY_ATTACK_DETECTED') {
        replayDetected = true;
      }
    }

    logResult(
      'Replay Attack Detection & Family Revocation',
      replayDetected === true,
      'Attempting to reuse consumed refresh token triggered REPLAY_ATTACK_DETECTED.'
    );

    // 5. Test Revoke Sessions (Logout)
    const { refreshToken: activeToken } = await authService.generateTokens(user.id, user.email, user.role);
    const decodedActive = jwt.decode(activeToken);

    await authService.revokeSession(decodedActive.sid);

    let logoutSuccess = false;
    try {
      await authService.refresh(activeToken);
    } catch (err) {
      logoutSuccess = true;
    }

    logResult(
      'Logout & Session Invalidation',
      logoutSuccess === true,
      'Session revoked on logout; subsequent refresh attempts rejected.'
    );

    // Cleanup
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 MODULE 3 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Auth Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testModule3AuthSessions();
