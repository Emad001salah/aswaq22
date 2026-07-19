/**
 * server/middleware/phone-rate-limit.ts
 *
 * Redis-backed Rate Limiting للـ Firebase Auth
 * ─────────────────────────────────────────────
 * - يعمل مع multi-instance deployments
 * - يبقى بعد إعادة تشغيل الخادم (Redis وليس Map)
 * - يُقيّد بناءً على: IP + SHA256(phone_or_uid)
 * - الحد: 5 محاولات / 15 دقيقة
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redis } from '../../src/lib/redis.ts';
import { logger } from '../lib/logger.ts';

const WINDOW_SECONDS = 15 * 60;   // 15 دقيقة
const MAX_ATTEMPTS   = 5;

/**
 * يبني مفتاح Redis من IP + معرف ثانوي (phone أو uid)
 */
function buildRateLimitKey(ip: string, secondary?: string): string {
  const hash = secondary
    ? crypto.createHash('sha256').update(secondary).digest('hex').slice(0, 16)
    : 'anonymous';
  return `rate_limit:firebase_login:${ip}:${hash}`;
}

/**
 * Middleware للتحقق من Rate Limit
 */
export async function firebaseAuthLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  // استخدام uid أو phone من body للتقييد الإضافي (قبل التحقق من التوكن)
  const secondary = req.body?.firebaseUid || req.body?.phone || undefined;
  const key = buildRateLimitKey(ip, secondary);

  const client = redis.getClient();
  if (!client) {
    next();
    return;
  }

  try {
    const current = await client.get(key);
    const attempts = current ? parseInt(current, 10) : 0;

    if (attempts >= MAX_ATTEMPTS) {
      const ttl = await client.ttl(key);
      logger.warn({ message: `[RateLimit] Firebase login blocked: ${key}, TTL: ${ttl}s` });
      res.status(429).json({
        error: 'Too Many Requests',
        message: `تم تجاوز الحد المسموح من المحاولات (${MAX_ATTEMPTS} في 15 دقيقة). حاول بعد ${Math.ceil(ttl / 60)} دقيقة.`,
        retryAfter: ttl,
      });
      return;
    }

    // زيادة العداد
    if (attempts === 0) {
      await client.set(key, '1', 'EX', WINDOW_SECONDS);
    } else {
      await client.incr(key);
    }

    next();
  } catch (err: any) {
    // إذا Redis غير متاح — نسمح بالطلب (fail open للمصادقة)
    logger.warn({ message: `[RateLimit] Redis unavailable, skipping rate limit: ${err.message}` });
    next();
  }
}

/**
 * يبطل Rate Limit لمستخدم معين (مثلاً بعد تسجيل دخول ناجح)
 */
export async function clearRateLimit(ip: string, secondary?: string): Promise<void> {
  const key = buildRateLimitKey(ip, secondary);
  try {
    await redis.del(key);
  } catch (err: any) {
    logger.warn({ message: `[RateLimit] Failed to clear limit for ${key}: ${err.message}` });
  }
}
