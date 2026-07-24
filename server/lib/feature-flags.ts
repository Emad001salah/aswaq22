/**
 * server/lib/feature-flags.ts
 *
 * Runtime Feature Flag Service
 * ─────────────────────────────
 * - يقرأ من جدول feature_flags في PostgreSQL
 * - يكاش النتائج في Redis لمدة 60 ثانية
 * - يدعم Canary ثابت عبر hash(userId) % 100
 * - الـ Rollback: UPDATE feature_flags SET enabled=false → ينتشر خلال 60 ثانية
 *
 * لا VITE_* — كل شيء Runtime.
 */

import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.ts';
import { redis } from '../../src/lib/redis.ts';
import { logger } from './logger.ts';

const CACHE_TTL_SECONDS = 60;

interface FlagConfig {
  enabled: boolean;
  rolloutPct: number;     // 0-100
  allowedUsers: string[]; // user IDs مستثناة دائماً
}

const DEFAULT_FLAG: FlagConfig = { enabled: false, rolloutPct: 0, allowedUsers: [] };

/**
 * يجلب flag من Redis cache أو PostgreSQL
 */
export async function getFlag(key: string): Promise<FlagConfig> {
  const cacheKey = `feature_flag:${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as FlagConfig;
    }
  } catch (err: any) {
    logger.warn({ message: `[FeatureFlag] Redis get failed for ${key}: ${err.message}` });
  }

  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      logger.warn({ message: `[FeatureFlag] Flag "${key}" not found in DB — defaulting to disabled` });
      return DEFAULT_FLAG;
    }

    const result: FlagConfig = {
      enabled: flag.enabled,
      rolloutPct: flag.rolloutPct,
      allowedUsers: flag.allowedUsers,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS);
    } catch (err: any) {
      logger.warn({ message: `[FeatureFlag] Redis set failed for ${key}: ${err.message}` });
    }

    return result;
  } catch (err: any) {
    logger.error({ message: `[FeatureFlag] DB read failed for ${key}: ${err.message}` });
    return DEFAULT_FLAG;
  }
}

/**
 * يبطل cache لـ flag معين (استخدم عند تحديث DB مباشرة)
 */
export async function invalidateFlagCache(key: string): Promise<void> {
  try {
    await redis.del(`feature_flag:${key}`);
  } catch (err: any) {
    logger.warn({ message: `[FeatureFlag] Cache invalidation failed for ${key}: ${err.message}` });
  }
}

/**
 * Canary ثابت: نفس المستخدم → نفس القرار دائماً
 * يستخدم SHA-256 لضمان التوزيع المتساوي
 */
export function isInRollout(userId: string, rolloutPct: number, allowedUsers: string[]): boolean {
  if (allowedUsers.includes(userId)) return true;
  if (rolloutPct <= 0) return false;
  if (rolloutPct >= 100) return true;

  const hashHex = crypto.createHash('sha256').update(`canary:${userId}`).digest('hex').slice(0, 8);
  const hashInt = parseInt(hashHex, 16);
  return (hashInt % 100) < rolloutPct;
}

/**
 * التحقق الكامل: هل الـ Feature مفعّل لهذا المستخدم؟
 *
 * @param key      - مفتاح الـ Flag (مثل: "firebase_phone_auth")
 * @param userId   - معرف المستخدم (اختياري — إذا لم يُعطَ، يستخدم rolloutPct فقط)
 * @returns true إذا كان الـ Flag مفعّلاً لهذا المستخدم
 */
export async function isFeatureEnabled(key: string, userId?: string): Promise<boolean> {
  const flag = await getFlag(key);

  if (!flag.enabled) return false;
  if (flag.rolloutPct >= 100) return true;
  
  // Allow phone auth for guest users or new signups if rollout is enabled
  if (key === 'firebase_phone_auth' || key === 'r2_storage') {
    return flag.enabled;
  }

  if (!userId) return false;

  return isInRollout(userId, flag.rolloutPct, flag.allowedUsers);
}

/**
 * تحديث rolloutPct مباشرة من الكود (للـ Admin API)
 */
export async function updateFlagRollout(key: string, rolloutPct: number): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    create: { key, name: key, enabled: true, rolloutPct },
    update: { rolloutPct },
  });
  await invalidateFlagCache(key);
  logger.info({ message: `[FeatureFlag] "${key}" rollout updated to ${rolloutPct}%` });
}

/**
 * تعطيل Flag (Rollback)
 */
export async function disableFlag(key: string): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    create: { key, name: key, enabled: false, rolloutPct: 0 },
    update: { enabled: false },
  });
  await invalidateFlagCache(key);
  logger.info({ message: `[FeatureFlag] "${key}" DISABLED` });
}
