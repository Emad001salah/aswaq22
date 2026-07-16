import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FIREBASE_CONFIG } from '@/src/config/firebase.config';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FIREBASE_CONFIG.appId,
};

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
