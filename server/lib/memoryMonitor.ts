/**
 * memoryMonitor.ts — Heap & Memory Leak Detection
 *
 * - Exposes heap metrics to Prometheus (already picked up by /metrics)
 * - Adds heap stats to /health response
 * - Auto-logs WARNING if heap grows > 85% of limit
 * - Detects consistent growth over 5 samples (potential leak signal)
 */

import { Gauge } from 'prom-client';
import { logger } from './logger.ts';
import v8 from 'v8';

// ─── Prometheus Gauges ────────────────────────────────────────────────────────
const heapUsedGauge = new Gauge({
  name: 'nodejs_heap_used_bytes',
  help: 'V8 heap used in bytes',
});

const heapTotalGauge = new Gauge({
  name: 'nodejs_heap_total_bytes',
  help: 'V8 heap total allocated in bytes',
});

const heapLimitGauge = new Gauge({
  name: 'nodejs_heap_limit_bytes',
  help: 'V8 heap size limit',
});

const externalGauge = new Gauge({
  name: 'nodejs_external_bytes',
  help: 'External memory used by C++ objects bound to JS',
});

const rssGauge = new Gauge({
  name: 'nodejs_rss_bytes',
  help: 'Resident Set Size — total memory allocated',
});

const eventLoopLagGauge = new Gauge({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Event loop lag in seconds (approximated)',
});

// ─── Leak Detection State ─────────────────────────────────────────────────────
const SAMPLE_WINDOW = 5;
const heapSamples: number[] = [];

function detectLeak(heapUsed: number): boolean {
  heapSamples.push(heapUsed);
  if (heapSamples.length > SAMPLE_WINDOW) heapSamples.shift();
  if (heapSamples.length < SAMPLE_WINDOW) return false;

  // Monotonically increasing heap = potential leak
  return heapSamples.every((v, i) => i === 0 || v > heapSamples[i - 1]);
}

// ─── Heap Snapshot (for diagnostics) ─────────────────────────────────────────
export function getHeapStats(): {
  heapUsedMB:      number;
  heapTotalMB:     number;
  heapLimitMB:     number;
  heapUsedPercent: number;
  rssMB:           number;
  externalMB:      number;
  leakSuspected:   boolean;
  status:          'healthy' | 'warning' | 'critical';
} {
  const mem    = process.memoryUsage();
  const v8stat = v8.getHeapStatistics();

  const heapUsedMB      = Math.round(mem.heapUsed  / 1024 / 1024);
  const heapTotalMB     = Math.round(mem.heapTotal  / 1024 / 1024);
  const heapLimitMB     = Math.round(v8stat.heap_size_limit / 1024 / 1024);
  const rssMB           = Math.round(mem.rss        / 1024 / 1024);
  const externalMB      = Math.round(mem.external   / 1024 / 1024);
  const heapUsedPercent = Math.round((mem.heapUsed  / v8stat.heap_size_limit) * 100);
  const leakSuspected   = detectLeak(mem.heapUsed);

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (heapUsedPercent >= 90) status = 'critical';
  else if (heapUsedPercent >= 75) status = 'warning';

  return {
    heapUsedMB,
    heapTotalMB,
    heapLimitMB,
    heapUsedPercent,
    rssMB,
    externalMB,
    leakSuspected,
    status,
  };
}

// ─── Event loop lag measurement ────────────────────────────────────────────────
let lastCheck = Date.now();

function measureEventLoopLag(): number {
  const now = Date.now();
  const lag = (now - lastCheck - 1000) / 1000; // expected 1s, actual delta
  lastCheck = now;
  return Math.max(0, lag);
}

// ─── Start monitoring loop ────────────────────────────────────────────────────
let monitorTimer: NodeJS.Timeout | null = null;

export function startMemoryMonitor(intervalMs: number = 30_000): void {
  if (monitorTimer) return; // already running

  monitorTimer = setInterval(() => {
    const mem    = process.memoryUsage();
    const v8stat = v8.getHeapStatistics();

    // Update Prometheus
    heapUsedGauge.set(mem.heapUsed);
    heapTotalGauge.set(mem.heapTotal);
    heapLimitGauge.set(v8stat.heap_size_limit);
    externalGauge.set(mem.external);
    rssGauge.set(mem.rss);
    eventLoopLagGauge.set(measureEventLoopLag());

    const stats = getHeapStats();

    // Warning thresholds
    if (stats.status === 'critical') {
      logger.error({
        message:        '⚠️  CRITICAL: Heap usage > 90%',
        heapUsedMB:     stats.heapUsedMB,
        heapLimitMB:    stats.heapLimitMB,
        heapUsedPercent: stats.heapUsedPercent,
      });
    } else if (stats.status === 'warning') {
      logger.warn({
        message:        '⚠️  Heap usage > 75%',
        heapUsedMB:     stats.heapUsedMB,
        heapLimitMB:    stats.heapLimitMB,
        heapUsedPercent: stats.heapUsedPercent,
      });
    }

    // Leak signal
    if (stats.leakSuspected) {
      logger.warn({
        message: '⚠️  Potential memory leak: heap growing monotonically for 5 consecutive samples',
        samples:  heapSamples.map(b => Math.round(b / 1024 / 1024) + 'MB'),
      });
    }
  }, intervalMs);

  // Don't block process exit
  monitorTimer.unref();

  logger.info({ message: '[MemoryMonitor] Started', intervalMs });
}

export function stopMemoryMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
