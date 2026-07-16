import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config(); // Load .env if present (no-op on Render where vars are injected)

import { validateEnv } from './lib/env-validation.ts';
import { App } from './app.ts';

const bootstrap = async () => {
  console.log('[Server] 🚀 Aswaq API booting up...');
  validateEnv();
  const application = new App();
  await application.start();
};

bootstrap().catch(err => {
  console.error('❌ Failed to start Aswaq API:', err);
  process.exit(1);
});

