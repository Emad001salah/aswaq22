/**
 * Winston Structured Logger
 * Outputs JSON logs compatible with Grafana Loki / ELK Stack.
 * Every log line includes timestamp, level, correlationId (if present), and message.
 */

import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),        // capture stack traces on errors
    timestamp({ format: 'ISO' }),   // ISO 8601 timestamp
    json()                          // structured JSON output for log shippers
  ),
  defaultMeta: {
    service: 'aswaq-api',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport – pretty in dev, JSON in production
    new transports.Console({
      format: isDev
        ? combine(colorize(), simple())  // readable colourized output during dev
        : combine(timestamp(), json()),  // JSON for prod log shippers
    }),
    // File transport – always JSON regardless of environment
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,   // 5 MB per file
      maxFiles: 5,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,  // 10 MB per file
      maxFiles: 10,
    }),
  ],
});

// Helper to attach correlation ID to every log in request scope
export const withCorrelation = (correlationId: string) =>
  logger.child({ correlationId });
