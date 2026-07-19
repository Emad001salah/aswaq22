/**
 * Outbox Worker – Transactional Outbox Pattern
 *
 * Purpose:
 *   Guarantees eventual consistency between PostgreSQL (source of truth)
 *   and Meilisearch (search index).  Every write to the `ads` table
 *   also writes an `OutboxEvent` inside the SAME transaction.
 *   This worker polls PENDING events, processes them, and marks them PROCESSED.
 *
 * Strategy:
 *   - Polling interval: 5 seconds (configurable via OUTBOX_POLL_MS env)
 *   - Batch size:       50 events per cycle (configurable via OUTBOX_BATCH_SIZE env)
 *   - Retry policy:     up to 5 attempts with exponential backoff
 *   - Dead Letter:      events with attempts >= 5 are marked FAILED (DLQ-equivalent)
 *
 * Scaling note:
 *   For multi-instance deployments, use SELECT … FOR UPDATE SKIP LOCKED
 *   to prevent double-processing (implemented below via Prisma raw query).
 */

import { prisma } from '../../src/lib/prisma.ts';
import { searchEngine } from '../../src/lib/meilisearch.ts';
import { logger } from '../lib/logger.ts';
import { queues } from '../../src/lib/queues.ts';


const POLL_MS     = parseInt(process.env.OUTBOX_POLL_MS     || '5000', 10);
const BATCH_SIZE  = parseInt(process.env.OUTBOX_BATCH_SIZE  || '50',   10);
const MAX_RETRIES = parseInt(process.env.OUTBOX_MAX_RETRIES || '5',    10);

// Exponential backoff: 2^attempt × 1000 ms (capped at 60 s)
function backoffMs(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 60_000);
}

async function processEvent(event: {
  id: string;
  aggregate: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
}): Promise<void> {
  const payload = event.payload as Record<string, any>;

  switch (event.eventType) {
    case 'CREATED':
    case 'UPDATED':
      if (searchEngine.isAvailable()) {
        await searchEngine.indexAd({
          id:          payload.id,
          title:       payload.title,
          description: payload.description,
          city:        payload.city,
          price:       payload.price,
          category:    payload.category,
          status:      payload.status,
        });
      }
      break;

    case 'DELETED':
      if (searchEngine.isAvailable()) {
        await searchEngine.deleteAd(event.aggregateId);
      }
      break;

    default:
      logger.warn({ message: `Unknown outbox event type: ${event.eventType}`, eventId: event.id });
  }
}

async function pollAndProcess(): Promise<void> {
  // Fetch PENDING events with advisory lock (skip locked = safe for concurrent workers)
  const events = await prisma.$queryRaw<Array<{
    id: string;
    aggregate: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }>>`
    SELECT id, aggregate, "aggregateId", "eventType", payload, attempts
    FROM outbox_events
    WHERE status = 'PENDING'
      AND attempts < ${MAX_RETRIES}
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE}
    FOR UPDATE SKIP LOCKED
  `;

  if (events.length === 0) return;

  logger.info({ message: `[Outbox] Processing ${events.length} event(s)` });

  for (const event of events) {
    try {
      await processEvent(event);

      // Mark as PROCESSED
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data:  {
          status:      'PROCESSED',
          processedAt: new Date(),
          attempts:    { increment: 1 },
        },
      });
    } catch (err: any) {
      const nextAttempt = event.attempts + 1;
      const isDead      = nextAttempt >= MAX_RETRIES;

      logger.error({
        message:   `[Outbox] Failed to process event ${event.id} (attempt ${nextAttempt}/${MAX_RETRIES})`,
        error:     err.message,
        eventId:   event.id,
        eventType: event.eventType,
      });

      // Mark FAILED (DLQ) if exhausted, else increment attempts
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data:  {
          attempts: { increment: 1 },
          status:   isDead ? 'FAILED' : 'PENDING',
        },
      });

      if (!isDead) {
        // Backoff before retrying: let the outer loop sleep
        await new Promise((r) => setTimeout(r, backoffMs(nextAttempt)));
      } else {
        logger.error({
          message: `[Outbox] Event ${event.id} moved to DLQ after ${MAX_RETRIES} failures.`,
          eventId: event.id,
        });
      }
    }
  }
}

// ── Worker Loop ───────────────────────────────────────────────────────────────

let running = false;
let timer: NodeJS.Timeout | null = null;

export function startOutboxWorker(): void {
  if (running) return;
  running = true;

  logger.info({ message: `[Outbox Worker] Started – polling every ${POLL_MS}ms, batch=${BATCH_SIZE}` });

  const tick = async () => {
    try {
      await pollAndProcess();
    } catch (err: any) {
      logger.error({ message: '[Outbox Worker] Unexpected error in poll loop', error: err.message });
    } finally {
      if (running) {
        timer = setTimeout(tick, POLL_MS);
      }
    }
  };

  tick();
}

export function stopOutboxWorker(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info({ message: '[Outbox Worker] Stopped.' });
}

export function isOutboxWorkerRunning(): boolean {
  return running;
}

// Auto-start worker if run directly from the command line
if (process.argv[1]?.includes('outbox.worker.ts')) {
  startOutboxWorker();
}


