import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

// Firebase config — env vars injected at build time by Vite, with hardcoded fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCiNKstQCpNSrtsyj8GbjY-cPQcwRU5IcY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'aswaq-48f3f.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'aswaq-48f3f',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'aswaq-48f3f.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '688414669812',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:688414669812:web:e5096df993e3d1ac27d7a1',
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
