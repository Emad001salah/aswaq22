/**
 * Health Controller – GET /api/v1/health
 *
 * Returns real-time availability status for every service dependency.
 * Used by:
 *   - Load balancers (Kubernetes liveness / readiness probes)
 *   - Uptime monitoring services (UptimeRobot, Better Stack)
 *   - Prometheus health-check scraper
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { redis } from '../../src/lib/redis.ts';
import { searchEngine } from '../../src/lib/meilisearch.ts';
import { logger } from '../lib/logger.ts';
import { getHeapStats } from '../lib/memoryMonitor.ts';
import { isOutboxWorkerRunning } from '../workers/outbox.worker.ts';

export const HealthController = (): Router => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const checks: Record<string, 'up' | 'down'> = {};
    const errors: Record<string, string> = {};

    // ── 1. Database ──────────────────────────────────────────────────────────
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch (err: any) {
      checks.database = 'down';
      errors.database = err.message || String(err);
    }

    // ── 2. Redis ─────────────────────────────────────────────────────────────
    try {
      const client = redis.getClient();
      if (client) {
        await client.ping();
        checks.redis = 'up';
      } else {
        checks.redis = 'down';
        errors.redis = 'Redis client is null (not initialized)';
      }
    } catch (err: any) {
      checks.redis = 'down';
      errors.redis = err.message || String(err);
    }

    // ── 3. Meilisearch ───────────────────────────────────────────────────────
    try {
      checks.search = searchEngine.isAvailable() ? 'up' : 'down';
      if (checks.search === 'down') {
        errors.search = 'Meilisearch engine reported isAvailable = false';
      }
    } catch (err: any) {
      checks.search = 'down';
      errors.search = err.message || String(err);
    }

    // ── 4. Outbox Worker ─────────────────────────────────────────────────────
    checks.outbox = isOutboxWorkerRunning() ? 'up' : 'down';

    // ── Summary ──────────────────────────────────────────────────────────────
    const allHealthy = Object.values(checks).every((s) => s === 'up');
    const httpStatus  = allHealthy ? 200 : 503;
    const latencyMs   = Date.now() - startTime;
    const memoryStats = getHeapStats();

    logger.info({
      message: 'Health check',
      correlationId: req.correlationId,
      checks,
      latencyMs,
      heapUsedPercent: memoryStats.heapUsedPercent,
    });

    res.status(httpStatus).json({
      status: allHealthy ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
      uptimeHuman: formatUptime(process.uptime()),
      latencyMs,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: checks,
      checks, // duplicated to match status page expects checks directly
      errors, // include detailed error descriptions
      memory: {
        heapUsedMB:      memoryStats.heapUsedMB,
        heapLimitMB:     memoryStats.heapLimitMB,
        heapUsedPercent: `${memoryStats.heapUsedPercent}%`,
        rssMB:           memoryStats.rssMB,
        leakSuspected:   memoryStats.leakSuspected,
        status:          memoryStats.status,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}
