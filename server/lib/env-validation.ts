const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'PEPPER_SECRET',
] as const;

// Optional vars – logged as warnings so ops can track them without crashing
const OPTIONAL_ENV_VARS = [
  'MEILI_MASTER_KEY',
  'MEILI_API_KEY',
  'REDIS_URL',
  'REDIS_HOST',
  'FIREBASE_SERVICE_ACCOUNT',
] as const;

export function validateEnv(): void {
  const missingVars = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });

  if (missingVars.length > 0) {
    throw new Error(`[Env] Missing required environment variables: ${missingVars.join(', ')}\n  Please set these in your deployment environment.`);
  }

  // Warn about missing optional vars (never throws)
  const missingOptional = OPTIONAL_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
  if (missingOptional.length > 0) {
    console.warn(`[Env] ⚠️  Optional vars not set (non-fatal): ${missingOptional.join(', ')}`);
  }
}

