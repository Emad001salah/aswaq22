/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
// Load environment variables early
dotenv.config();

import { validateEnv } from './server/lib/env-validation.ts';
import './server/lib/otel.ts';
import { App } from './server/app.ts';

const bootstrap = async () => {
  console.log('[Server] Initializing Aswaq Production-Grade Server Bootstrap...');
  validateEnv();
  const application = new App();
  await application.start();
};

bootstrap().catch((err) => {
  console.error('Critical Error: Failed to start Aswaq Monolith Engine:', err);
  process.exit(1);
});
