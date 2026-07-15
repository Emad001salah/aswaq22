const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'PEPPER_SECRET',
  'MEILI_MASTER_KEY',
] as const;

export function validateEnv(): void {
  const missingVars = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}
