import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { logger } from './logger';

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
const projectId = process.env.FIREBASE_PROJECT_ID || 'aswaq-48f3f';

if (!getApps().length) {
  if (serviceAccountStr) {
    try {
      const serviceAccount = JSON.parse(serviceAccountStr);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      logger.info({ message: 'Firebase Admin SDK initialized successfully with Service Account.' });
    } catch (e: any) {
      logger.error({ message: `Failed to initialize Firebase Admin SDK with service account: ${e.message || e}` });
      initializeApp({ projectId });
      logger.info({ message: `Firebase Admin SDK initialized with fallback projectId (${projectId}).` });
    }
  } else {
    initializeApp({ projectId });
    logger.info({ message: `Firebase Admin SDK initialized with default projectId (${projectId}).` });
  }
}


export const admin = {
  auth: () => getAuth(),
};
