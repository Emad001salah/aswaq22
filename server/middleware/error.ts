/**
 * Global Error Handler Middleware
 * Must be registered LAST in Express middleware chain.
 * Returns a unified JSON error envelope on every unhandled exception.
 *
 * Envelope shape:
 * {
 *   "success": false,
 *   "status": 422,
 *   "error": "Unprocessable Entity",
 *   "message": "Validation failed",
 *   "details": [...],
 *   "correlationId": "uuid"
 * }
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.ts';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const HTTP_STATUS_TEXTS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.correlationId || res.locals.correlationId || 'unknown';

  // Known application errors
  if (err instanceof AppError) {
    logger.warn({
      message: err.message,
      correlationId,
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    });

    res.status(err.statusCode).json({
      success: false,
      status: err.statusCode,
      error: HTTP_STATUS_TEXTS[err.statusCode] || 'Error',
      message: err.message,
      ...(err.details && { details: err.details }),
      correlationId,
    });
    return;
  }

  // Prisma known errors
  if ((err as any).code === 'P2002') {
    res.status(409).json({
      success: false,
      status: 409,
      error: 'Conflict',
      message: 'A record with this value already exists.',
      correlationId,
    });
    return;
  }

  // Unknown / unexpected errors — log full stack
  logger.error({
    message: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    status: 500,
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack, // Expose stack trace for debugging in production temporarily
    correlationId,
  });
}
