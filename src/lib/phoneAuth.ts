/**
 * phoneAuth.ts – Runtime switchable phone OTP authentication (Firebase / Legacy Backend)
 */

import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from './firebase';

export interface SendOtpResult {
  success: boolean;
  /** Only present in development mode when Twilio is not configured */
  devOtp?: string;
  /** Present when Firebase Phone Auth is active */
  confirmationResult?: ConfirmationResult;
  useFirebase?: boolean;
}

export interface FeaturesConfig {
  firebasePhoneAuth: boolean;
  r2Storage: boolean;
}

let cachedConfig: FeaturesConfig | null = null;
let lastConfigFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // Cache config for 60 seconds

/**
 * Fetches the active runtime features config from the backend.
 */
export async function getFeaturesConfig(): Promise<FeaturesConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastConfigFetch < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const token = localStorage.getItem('aswaq_access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/v1/auth/config/features', { headers });
    if (!res.ok) throw new Error('Failed to fetch runtime config');
    cachedConfig = (await res.json()) as FeaturesConfig;
    lastConfigFetch = now;
    return cachedConfig;
  } catch (err) {
    console.warn('[phoneAuth] Failed to load config, falling back to legacy settings:', err);
    return { firebasePhoneAuth: false, r2Storage: false };
  }
}

/**
 * Send phone OTP – uses Firebase Client SDK if enabled, otherwise legacy backend/Twilio.
 */
export async function sendPhoneOtp(
  phone: string,
  recaptchaVerifier?: RecaptchaVerifier
): Promise<SendOtpResult> {
  const config = await getFeaturesConfig();

  if (config.firebasePhoneAuth && recaptchaVerifier) {
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
      return {
        success: true,
        confirmationResult,
        useFirebase: true,
      };
    } catch (fbErr: any) {
      console.warn('[phoneAuth] Firebase Phone Auth error:', fbErr?.code || fbErr?.message, 'Falling back to backend OTP...');
    }
  }

  // Backend / SMS route
  const res = await fetch('/api/v1/auth/phone/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.message || 'فشل إرسال رمز التحقق');
  }

  const data = await res.json() as any;
  return {
    success: true,
    devOtp: data.devOtp,
    useFirebase: false,
  };
}

/**
 * Verify OTP – uses Firebase confirmation result if active, otherwise legacy backend verify endpoint.
 */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
  options?: {
    name?: string;
    mode?: string;
    confirmationResult?: ConfirmationResult;
  }
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  if (options?.confirmationResult) {
    // Firebase verification flow
    const result = await options.confirmationResult.confirm(code);
    const idToken = await result.user.getIdToken();

    // Exchange ID Token for Aswaq22 session tokens
    const res = await fetch('/api/v1/auth/firebase/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.message || 'فشل تسجيل الدخول عبر Firebase');
    }

    return res.json();
  }

  // Legacy verify flow
  const token = localStorage.getItem('aswaq_access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/v1/auth/phone/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, code, ...options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.message || 'فشل التحقق من الرمز');
  }

  return res.json();
}
