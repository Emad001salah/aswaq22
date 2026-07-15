/**
 * phoneAuth.ts – Backend-only phone OTP authentication
 *
 * Sends OTP requests directly to our backend.
 * No client-side Firebase or reCAPTCHA involved.
 * The backend handles OTP generation and SMS delivery.
 */

export interface SendOtpResult {
  success: boolean;
  /** Only present in development mode when Twilio is not configured */
  devOtp?: string;
}

/** Send phone OTP – backend generates code and sends real SMS (or returns devOtp in dev). */
export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
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
    devOtp: data.devOtp, // only set in dev mode
  };
}

/** Verify OTP via backend and return user + tokens. */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
  options?: { name?: string; mode?: string }
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
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
