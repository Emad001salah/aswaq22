import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { logger } from './logger';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;

if (serviceAccountStr) {
  try {
    const serviceAccount = JSON.parse(serviceAccountStr);
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
      logger.info({ message: 'Firebase Admin SDK initialized successfully.' });
    }
  } catch (e: any) {
    logger.error({ message: `Failed to initialize Firebase Admin SDK: ${e.message || e}`, error: e.stack || e });
  }
} else {
  logger.warn({ message: 'FIREBASE_SERVICE_ACCOUNT not found in environment variables.' });
}

export const admin = {
  auth: () => getAuth(),
};
