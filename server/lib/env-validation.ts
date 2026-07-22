/**
 * server/lib/env-validation.ts
 *
 * Environment Variable Validator — runs at server startup.
 *
 * [STARTUP-001] Validates that all required secrets and configuration are
 * present before the server accepts any connections. A missing secret that
 * causes a runtime failure mid-request is far more dangerous than a clean
 * startup failure with a clear error message.
 *
 * Usage: call validateEnvironment() as the very first thing in server.ts / app bootstrap.
 */

import { logger } from './logger.ts';

interface EnvRule {
  key:          string;
  description:  string;
  required:     boolean | 'production-only';
  /** Reject values that look like known unsafe defaults */
  rejectDefaults?: string[];
  /** Minimum length for secret strings */
  minLength?:   number;
}

const ENV_RULES: EnvRule[] = [
  // ── Database ──────────────────────────────────────────────────────────────
  {
    key:          'DATABASE_URL',
    description:  'PostgreSQL connection string',
    required:     true,
    minLength:    20,
  },

  // ── JWT Secrets ───────────────────────────────────────────────────────────
  {
    key:          'JWT_SECRET',
    description:  'JWT access token signing secret',
    required:     true,
    minLength:    32,
    rejectDefaults: [
      'change-me-in-production',
      'changeme',
      'secret',
      'aswaq_jwt_secret_dev_key_2026_super_secure_998231',
    ],
  },
  {
    key:          'JWT_REFRESH_SECRET',
    description:  'JWT refresh token signing secret',
    required:     true,
    minLength:    32,
    rejectDefaults: [
      'change-me-in-production',
      'aswaq_jwt_refresh_secret_key_2026',
    ],
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    key:          'PEPPER_SECRET',
    description:  'HMAC pepper for token hashing',
    required:     'production-only',
    minLength:    32,
  },

  // ── CORS ──────────────────────────────────────────────────────────────────
  {
    key:          'CORS_ORIGIN',
    description:  'Comma-separated list of allowed CORS origins',
    required:     'production-only',
  },

  // ── Metrics ───────────────────────────────────────────────────────────────
  // METRICS_TOKEN or METRICS_ALLOWED_IPS should be set in production.
  // Validated with a warning since both are optional but at least one is expected.

  // ── Frontend URL ─────────────────────────────────────────────────────────
  {
    key:          'FRONTEND_URL',
    description:  'Public frontend URL (for OAuth redirects, emails)',
    required:     'production-only',
  },
];

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

/**
 * Validates all required environment variables.
 * In production, throws on any error (the server should not start).
 * In development, logs warnings but allows the server to start.
 */
export function validateEnvironment(): ValidationResult {
  const isProd   = process.env.NODE_ENV === 'production';
  const errors:   string[] = [];
  const warnings: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key]?.replace(/^['"]|['"]$/g, '');

    const isRequired =
      rule.required === true ||
      (rule.required === 'production-only' && isProd);

    // Missing check
    if (!value) {
      const msg = `[EnvValidation] Missing: ${rule.key} (${rule.description})`;
      if (isRequired) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
      continue;
    }

    // Minimum length check
    if (rule.minLength && value.length < rule.minLength) {
      const msg = `[EnvValidation] ${rule.key} is too short (${value.length} < ${rule.minLength} chars)`;
      if (isRequired) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }

    // Reject known unsafe defaults in production
    if (isProd && rule.rejectDefaults?.includes(value)) {
      errors.push(
        `[EnvValidation] SECURITY: ${rule.key} is set to a known unsafe default value. ` +
        `This default is public knowledge and MUST be changed before production launch.`
      );
    }
  }

  // Warn if metrics have no protection in production
  if (isProd) {
    const hasMetricsToken = !!process.env.METRICS_TOKEN;
    const hasMetricsIPs   = !!(process.env.METRICS_ALLOWED_IPS?.trim());
    if (!hasMetricsToken && !hasMetricsIPs) {
      warnings.push(
        '[EnvValidation] Neither METRICS_TOKEN nor METRICS_ALLOWED_IPS is set. ' +
        '/metrics endpoint is blocked in production by default. ' +
        'Set one to enable Prometheus scraping.'
      );
    }
  }

  // Log all findings
  for (const w of warnings) {
    logger.warn({ message: w });
  }
  for (const e of errors) {
    logger.error({ message: e });
  }

  const valid = errors.length === 0;

  if (!valid) {
    const summary =
      `\n${'═'.repeat(72)}\n` +
      `  STARTUP ABORTED: ${errors.length} environment validation error(s)\n` +
      `${'═'.repeat(72)}\n` +
      errors.map(e => `  ✗ ${e}`).join('\n') +
      `\n${'═'.repeat(72)}\n` +
      `  Copy .env.example → .env and fill in all required values.\n` +
      `${'═'.repeat(72)}\n`;
    logger.error({ message: summary });

    if (isProd) {
      // In production, abort immediately — do not start a broken server
      process.exit(1);
    }
  }

  return { valid, errors, warnings };
}
