/**
 * tests/unit/env-validation.test.ts
 *
 * Unit tests for environment variable startup validator.
 */

import { validateEnvironment } from '../../server/lib/env-validation.ts';

describe('Environment Validator Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should pass validation when required environment variables are set correctly', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/aswaqdb_test';
    process.env.JWT_SECRET = 'valid_jwt_secret_with_more_than_32_characters_long_key_123';
    process.env.JWT_REFRESH_SECRET = 'valid_refresh_secret_with_more_than_32_characters_long_key_456';
    process.env.PEPPER_SECRET = 'valid_pepper_secret_with_more_than_32_characters_long_key_789';

    const result = validateEnvironment();
    expect(result.errors.length).toBe(0);
    expect(result.valid).toBe(true);
  });

  it('should flag missing DATABASE_URL as an error', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'valid_jwt_secret_with_more_than_32_characters_long_key_123';
    process.env.JWT_REFRESH_SECRET = 'valid_refresh_secret_with_more_than_32_characters_long_key_456';

    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
  });
});
