#!/usr/bin/env node
const required = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'PEPPER_SECRET',
  'MEILI_MASTER_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'WEB_RETURN_URL',
  'ADMIN_URL',
  'MOBILE_DEEPLINK',
  'FRONTEND_URL',
  'DOMAIN',
  'VITE_API_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missing = required.filter((name) => !process.env[name] || !String(process.env[name]).trim());

if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
  console.warn('[check-env] NODE_ENV is not production. This checker is intended for production readiness.');
}

if (missing.length > 0) {
  console.error('[check-env] Missing required environment variables:');
  for (const name of missing) {
    console.error(` - ${name}`);
  }
  process.exit(1);
}

console.log('[check-env] Production environment variables look complete.');
