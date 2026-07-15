/**
 * featureFlags.ts — Feature Flag System
 *
 * Controls Beta features with:
 *   - Global enable/disable per flag
 *   - Percentage-based rollout (0-100%)
 *   - User allowlist (always enabled for specific users)
 *   - Deterministic assignment (same user always gets same result)
 *
 * Usage:
 *   if (await featureFlags.isEnabled('beta_chat', userId)) { ... }
 */

import { prisma } from '../../src/lib/prisma.ts';
import { logger } from './logger.ts';
import crypto from 'crypto';

// ─── Known flags — keeps code searchable + type-safe ─────────────────────────
export const FLAGS = {
  BETA_CHAT:              'beta_chat',
  AI_RECOMMENDATIONS:     'ai_recommendations',
  PREMIUM_ADS:            'premium_ads',
  MAP_VIEW:               'map_view',
  VIDEO_ADS:              'video_ads',
  ADVANCED_SEARCH:        'advanced_search',
  SELLER_ANALYTICS:       'seller_analytics',
  BETA_ACCESS:            'beta_access',      // master gate for closed beta
  LOGISTICS_SERVICE:      'logistics_service',
} as const;

export type FlagKey = typeof FLAGS[keyof typeof FLAGS];

// ─── Default flags for seed ───────────────────────────────────────────────────
export const DEFAULT_FLAGS: Array<{
  key:         string;
  name:        string;
  description: string;
  enabled:     boolean;
  rolloutPct:  number;
}> = [
  {
    key:         FLAGS.BETA_ACCESS,
    name:        'Beta Access',
    description: 'Master gate: users must have an active beta invitation',
    enabled:     true,
    rolloutPct:  0,
  },
  {
    key:         FLAGS.BETA_CHAT,
    name:        'Beta Chat',
    description: 'Real-time messaging between buyers and sellers',
    enabled:     false,
    rolloutPct:  0,
  },
  {
    key:         FLAGS.AI_RECOMMENDATIONS,
    name:        'AI Recommendations',
    description: 'ML-based ad recommendations on homepage',
    enabled:     false,
    rolloutPct:  0,
  },
  {
    key:         FLAGS.PREMIUM_ADS,
    name:        'Premium Ads',
    description: 'Paid featured/promoted ad placements',
    enabled:     false,
    rolloutPct:  0,
  },
  {
    key:         FLAGS.MAP_VIEW,
    name:        'Map View',
    description: 'Show ads on an interactive map',
    enabled:     false,
    rolloutPct:  10,  // 10% rollout in beta
  },
  {
    key:         FLAGS.SELLER_ANALYTICS,
    name:        'Seller Analytics',
    description: 'Per-seller dashboard showing views, favorites, and contact rate',
    enabled:     false,
    rolloutPct:  20,
  },
  {
    key:         FLAGS.ADVANCED_SEARCH,
    name:        'Advanced Search',
    description: 'Price range, condition, date filters',
    enabled:     true,
    rolloutPct:  100,
  },
  {
    key:         FLAGS.VIDEO_ADS,
    name:        'Video Ads',
    description: 'Allow video upload in ad creation',
    enabled:     false,
    rolloutPct:  0,
  },
  {
    key:         FLAGS.LOGISTICS_SERVICE,
    name:        'Logistics & Delivery Service',
    description: 'Enable last-mile delivery, driver dispatching, and logistics ledger',
    enabled:     false,
    rolloutPct:  0,
  },
];

// ─── In-memory cache (TTL: 60s) ───────────────────────────────────────────────
interface CachedFlag {
  enabled:      boolean;
  rolloutPct:   number;
  allowedUsers: string[];
  cachedAt:     number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedFlag>();

// ─── Feature Flag Service ─────────────────────────────────────────────────────
export const featureFlags = {
  /**
   * Check if a feature flag is enabled for an optional user.
   * - If userId is provided, checks rollout% and allowlist.
   * - If userId is null, only checks global enabled + 100% rollout.
   */
  async isEnabled(key: string, userId?: string | null): Promise<boolean> {
    try {
      const flag = await featureFlags.getFlag(key);

      // Flag doesn't exist → disabled
      if (!flag) return false;

      // Globally disabled
      if (!flag.enabled) return false;

      // In allowlist → always enabled
      if (userId && flag.allowedUsers.includes(userId)) return true;

      // 100% rollout → always enabled
      if (flag.rolloutPct >= 100) return true;

      // 0% rollout → disabled for non-allowlist users
      if (flag.rolloutPct <= 0) return false;

      // Percentage rollout — deterministic hash
      if (userId) {
        const hash = crypto
          .createHash('sha256')
          .update(`${key}:${userId}`)
          .digest('hex');
        const bucket = parseInt(hash.slice(0, 8), 16) % 100;
        return bucket < flag.rolloutPct;
      }

      return false;
    } catch (err) {
      logger.warn({ message: 'FeatureFlag check failed', key, err });
      return false; // fail closed
    }
  },

  async getFlag(key: string): Promise<CachedFlag | null> {
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached;
    }

    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return null;

    const entry: CachedFlag = {
      enabled:      flag.enabled,
      rolloutPct:   flag.rolloutPct,
      allowedUsers: flag.allowedUsers,
      cachedAt:     now,
    };

    cache.set(key, entry);
    return entry;
  },

  /**
   * Invalidate cache for a specific flag (call after admin updates it).
   */
  invalidate(key: string): void {
    cache.delete(key);
  },

  /**
   * Invalidate all cached flags.
   */
  invalidateAll(): void {
    cache.clear();
  },
};

// ─── Express middleware — injects flags into req ──────────────────────────────
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      flags: {
        isEnabled: (key: string) => Promise<boolean>;
      };
    }
  }
}

export function featureFlagsMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const userId = (req as any).user?.id ?? null;

  req.flags = {
    isEnabled: (key: string) => featureFlags.isEnabled(key, userId),
  };

  next();
}
