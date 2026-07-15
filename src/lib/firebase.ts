import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseVars = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (import.meta.env.PROD && missingFirebaseVars.length > 0) {
  throw new Error(`Missing Firebase env vars: ${missingFirebaseVars.join(', ')}`);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ── تهيئة Firebase Auth ───────────────────────────────────────────────────
// على الأجهزة الأصلية نستخدم indexedDBLocalPersistence بدلاً من الافتراضي
// وكذلك نعطّل التحقق من التطبيق (reCAPTCHA) لأن WebView لا يدعمه
let auth: ReturnType<typeof getAuth>;

if (Capacitor.isNativePlatform()) {
  try {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    });
  } catch {
    // إذا كانت auth مهيأة بالفعل
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
