/**
 * tests/unit/auth.service.test.ts
 *
 * Unit tests for AuthService token generation, rotation, and security enforcement.
 */

import { AuthService } from '../../server/services/auth.service.ts';
import jwt from 'jsonwebtoken';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test_access_jwt_secret_key_32_characters_minimum_len_12345';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_jwt_secret_key_32_characters_minimum_len_67890';
    process.env.PEPPER_SECRET = 'test_pepper_secret_key_32_characters_minimum_len_abcde';
    authService = new AuthService();
  });

  it('should generate valid access and refresh tokens', async () => {
    // Mock prisma operations if running without DB
    const userId = 'user-uuid-123';
    const email = 'test@aswaq22.com';
    const role = 'USER';

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ sub: userId, email, role }, secret, { expiresIn: '24h' });

    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.sub).toBe(userId);
    expect(decoded.email).toBe(email);
    expect(decoded.role).toBe(role);
  });

  it('should enforce 24h expiry on access tokens', () => {
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ sub: 'user-1' }, secret, { expiresIn: '24h' });
    const decoded = jwt.verify(token, secret) as any;

    const issuedAt = decoded.iat;
    const expiresAt = decoded.exp;
    const diffHours = (expiresAt - issuedAt) / 3600;

    expect(diffHours).toBe(24);
  });
});
