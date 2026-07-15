/**
 * analytics.ts — Product Analytics Middleware
 *
 * Tracks the KPIs that matter AFTER launch:
 *   - Most visited pages
 *   - Search success/failure rate
 *   - Ad post completion rate
 *   - Registration abandonment
 *   - Report reasons
 *   - Real response times
 *
 * Events are stored in DB (AnalyticsEvent) and emitted to Prometheus gauges.
 * Zero external dependencies — works offline.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from './logger.ts';
import { register, Counter, Gauge } from 'prom-client';

// ─── Prometheus metrics ───────────────────────────────────────────────────────
const eventCounter = new Counter({
  name:    'aswaq_product_events_total',
  help:    'Total product analytics events by type',
  labelNames: ['event'],
});

const searchNoResultsCounter = new Counter({
  name: 'aswaq_search_no_results_total',
  help: 'Searches that returned 0 results',
});

const adPostAbandonmentGauge = new Gauge({
  name: 'aswaq_ad_post_abandonment_ratio',
  help: 'Ratio of ad post starts to completions (rolling 1h)',
});

const registrationAbandonmentGauge = new Gauge({
  name: 'aswaq_registration_abandonment_ratio',
  help: 'Ratio of OTP requests to registrations completed (rolling 1h)',
});

// ─── Event Types ──────────────────────────────────────────────────────────────
export const AnalyticsEventType = {
  // Content
  AD_VIEWED:               'ad_viewed',
  AD_POSTED:               'ad_posted',
  AD_POST_STARTED:         'ad_post_started',
  AD_POST_ABANDONED:       'ad_post_abandoned',
  AD_FAVORITED:            'ad_favorited',
  AD_REPORTED:             'ad_reported',

  // Search
  SEARCH_PERFORMED:        'search_performed',
  SEARCH_NO_RESULTS:       'search_no_results',
  CATEGORY_BROWSED:        'category_browsed',

  // Auth / Registration
  OTP_REQUESTED:           'otp_requested',
  OTP_VERIFIED:            'otp_verified',
  REGISTRATION_COMPLETED:  'registration_completed',
  REGISTRATION_ABANDONED:  'registration_abandoned',

  // Beta
  BETA_REQUESTED:          'beta_requested',
  BETA_ACTIVATED:          'beta_activated',

  // Errors (product-level, not infra)
  UPLOAD_FAILED:           'upload_failed',
  PAYMENT_FAILED:          'payment_failed',
} as const;

export type AnalyticsEvent = typeof AnalyticsEventType[keyof typeof AnalyticsEventType];

// ─── Track function — fire-and-forget ────────────────────────────────────────
export async function trackEvent(
  event:       AnalyticsEvent,
  req:         Request,
  properties?: Record<string, unknown>,
): Promise<void> {
  // Never block the request
  setImmediate(async () => {
    try {
      await prisma.analyticsEvent.create({
        data: {
          event,
          userId:    (req as any).user?.id ?? null,
          sessionId: req.headers['x-session-id'] as string ?? null,
          properties: (properties ?? {}) as any,
          ip:        req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      // Prometheus counter
      eventCounter.labels(event).inc();

      // Special counters
      if (event === AnalyticsEventType.SEARCH_NO_RESULTS) {
        searchNoResultsCounter.inc();
      }
    } catch (err) {
      // Analytics must NEVER crash the app
      logger.warn({ message: 'Analytics write failed', event, err });
    }
  });
}

// ─── Auto-track HTTP events ───────────────────────────────────────────────────
/**
 * Middleware that auto-tracks common API events based on route patterns.
 * Add to app AFTER routes, or mount on specific routers.
 */
export function analyticsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startMs = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startMs;
    const { method, path: p } = req;
    const { statusCode } = res;

    // Route pattern → event mapping
    const routeMap: Array<{ pattern: RegExp; method: string; event: AnalyticsEvent; props: (r: Request) => Record<string, unknown> }> = [
      {
        pattern: /^\/api\/v1\/ads\/[^/]+$/,
        method:  'GET',
        event:   AnalyticsEventType.AD_VIEWED,
        props:   r => ({ adId: r.params.id, duration_ms: duration }),
      },
      {
        pattern: /^\/api\/v1\/ads$/,
        method:  'GET',
        event:   AnalyticsEventType.SEARCH_PERFORMED,
        props:   r => ({
          query:    r.query.q,
          category: r.query.category,
          city:     r.query.city,
          duration_ms: duration,
          resultsCount: null, // populated by controller if needed
        }),
      },
      {
        pattern: /^\/api\/v1\/ads$/,
        method:  'POST',
        event:   AnalyticsEventType.AD_POSTED,
        props:   r => ({ status: res.statusCode, duration_ms: duration }),
      },
      {
        pattern: /^\/api\/v1\/auth\/phone\/send$/,
        method:  'POST',
        event:   AnalyticsEventType.OTP_REQUESTED,
        props:   r => ({ success: res.statusCode < 400 }),
      },
      {
        pattern: /^\/api\/v1\/auth\/phone\/verify$/,
        method:  'POST',
        event:   AnalyticsEventType.OTP_VERIFIED,
        props:   r => ({ success: res.statusCode < 400 }),
      },
    ];

    const matched = routeMap.find(
      m => m.pattern.test(req.path) && m.method === req.method && res.statusCode < 500,
    );

    if (matched) {
      trackEvent(matched.event, req, matched.props(req));
    }
  });

  next();
}

// ─── Analytics Summary — for admin KPI dashboard ─────────────────────────────
export interface AnalyticsSummary {
  period:                    string;
  totalEvents:               number;
  adViews:                   number;
  adsPosted:                 number;
  searchesPerformed:         number;
  searchNoResults:           number;
  searchSuccessRate:         string;
  otpRequests:               number;
  registrationsCompleted:    number;
  registrationAbandonmentRate: string;
  adPostAbandonmentRate:     string;
  topSearchQueries:          Array<{ query: string; count: number }>;
  topCategories:             Array<{ category: string; count: number }>;
  reportCount:               number;
  uploadFailures:            number;
}

export async function getAnalyticsSummary(
  days: number = 7,
): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    adViews,
    adsPosted,
    searches,
    searchNoResults,
    otpRequests,
    registrations,
    adPostStarts,
    adPostAbandons,
    reports,
    uploadFails,
    topSearchRaw,
    topCategoryRaw,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.AD_VIEWED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.AD_POSTED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.SEARCH_PERFORMED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.SEARCH_NO_RESULTS, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.OTP_REQUESTED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.REGISTRATION_COMPLETED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.AD_POST_STARTED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.AD_POST_ABANDONED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.AD_REPORTED, createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { event: AnalyticsEventType.UPLOAD_FAILED, createdAt: { gte: since } } }),

    // Top search queries
    prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
      SELECT properties->>'query' AS query, COUNT(*) AS count
      FROM analytics_events
      WHERE event = 'search_performed'
        AND created_at >= ${since}
        AND properties->>'query' IS NOT NULL
        AND properties->>'query' != ''
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `,

    // Top categories browsed
    prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT properties->>'category' AS category, COUNT(*) AS count
      FROM analytics_events
      WHERE event IN ('search_performed', 'category_browsed')
        AND created_at >= ${since}
        AND properties->>'category' IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `,
  ]);

  const searchSuccessRate = searches > 0
    ? `${(((searches - searchNoResults) / searches) * 100).toFixed(1)}%`
    : 'N/A';

  const registrationAbandonmentRate = otpRequests > 0
    ? `${(((otpRequests - registrations) / otpRequests) * 100).toFixed(1)}%`
    : 'N/A';

  const adPostAbandonmentRate = adPostStarts > 0
    ? `${((adPostAbandons / adPostStarts) * 100).toFixed(1)}%`
    : 'N/A';

  return {
    period:                    `${days}d`,
    totalEvents,
    adViews,
    adsPosted,
    searchesPerformed:         searches,
    searchNoResults,
    searchSuccessRate,
    otpRequests,
    registrationsCompleted:    registrations,
    registrationAbandonmentRate,
    adPostAbandonmentRate,
    topSearchQueries:          topSearchRaw.map(r => ({ query: r.query, count: Number(r.count) })),
    topCategories:             topCategoryRaw.map(r => ({ category: r.category, count: Number(r.count) })),
    reportCount:               reports,
    uploadFailures:            uploadFails,
  };
}
