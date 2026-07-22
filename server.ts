/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [STARTUP-001] Server bootstrap with mandatory environment validation.
 * validateEnvironment() MUST be called before any modules that depend on secrets
 * are imported. In production it aborts with exit(1) if any required var is missing
 * or set to a known unsafe default.
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
// Load environment variables FIRST — before any module imports that read process.env
dotenv.config();

import { validateEnvironment } from './server/lib/env-validation.ts';
import './server/lib/otel.ts';
import { App } from './server/app.ts';

const bootstrap = async () => {
  console.log('[Server] Initializing Aswaq Production-Grade Server Bootstrap...');

  // [STARTUP-001] Validate ALL required environment variables before startup.
  // Aborts in production if any critical secret is missing or uses a known default.
  validateEnvironment();

  const application = new App();
  await application.start();
};

bootstrap().catch((err) => {
  console.error('[Server] Critical Error: Failed to start Aswaq server:', err);
  process.exit(1);
});
