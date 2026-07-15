/**
 * Unit Tests – Auth Service
 * Tests password hashing, JWT signing, and token validation in isolation.
 * No database or external services required.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';

// ── Constants (must match auth.controller.ts) ────────────────────────────────
const PEPPER      = 'aswaq-pepper-test';
const JWT_SECRET  = 'test-jwt-secret-key-minimum-32-chars!!';

// ── Helpers (mirrored from controller) ───────────────────────────────────────
async function hashPassword(plain: string) {
  return bcrypt.hash(plain + PEPPER, 12);
}

async function verifyPassword(plain: string, hashed: string) {
  return bcrypt.compare(plain + PEPPER, hashed);
}

function signAccessToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function hashToken(token: string) {
  return createHmac('sha256', PEPPER).update(token).digest('hex');
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth – Password Security', () => {
  it('should hash a password and verify it correctly', async () => {
    const plain  = 'MySecurePassword123!';
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed).toMatch(/^\$2[ab]\$/); // bcrypt format
    expect(await verifyPassword(plain, hashed)).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const plain  = 'CorrectPassword!';
    const hashed = await hashPassword(plain);

    expect(await verifyPassword('WrongPassword!', hashed)).toBe(false);
  });

  it('should produce different hashes for the same password (salted)', async () => {
    const plain  = 'SamePassword!';
    const hash1  = await hashPassword(plain);
    const hash2  = await hashPassword(plain);

    expect(hash1).not.toBe(hash2);  // Different salts
  });

  it('should include PEPPER in hashing (plain without pepper must fail)', async () => {
    const plain  = 'MyPassword123!';
    const hashed = await hashPassword(plain);

    // Manually compare without PEPPER – should fail
    expect(await bcrypt.compare(plain, hashed)).toBe(false);
  });
});

describe('Auth – JWT Tokens', () => {
  it('should sign and verify a valid access token', () => {
    const payload = { id: 'user-123', role: 'USER' };
    const token   = signAccessToken(payload);

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.id).toBe('user-123');
    expect(decoded.role).toBe('USER');
  });

  it('should reject a token signed with a different secret', () => {
    const token = jwt.sign({ id: 'user-123' }, 'wrong-secret', { expiresIn: '15m' });

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('invalid signature');
  });

  it('should reject an expired token', async () => {
    const token = jwt.sign({ id: 'user-123' }, JWT_SECRET, { expiresIn: '1ms' });
    await new Promise((r) => setTimeout(r, 10));

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
  });

  it('should reject a malformed token', () => {
    expect(() => jwt.verify('not.a.valid.token', JWT_SECRET)).toThrow();
  });
});

describe('Auth – Refresh Token Hashing', () => {
  it('should produce a consistent HMAC hash for the same token', () => {
    const token = 'test-refresh-token-uuid';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('should produce different hashes for different tokens', () => {
    expect(hashToken('token-A')).not.toBe(hashToken('token-B'));
  });

  it('should produce a 64-character hex string (SHA-256)', () => {
    expect(hashToken('any-token')).toMatch(/^[a-f0-9]{64}$/);
  });
});
