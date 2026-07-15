/**
 * Correlation ID Middleware
 * Generates a unique UUID for every incoming HTTP request and injects it into:
 *   - req.correlationId (available to all downstream handlers)
 *   - X-Correlation-ID response header (visible to API clients)
 *   - res.locals.correlationId (accessible in error handlers)
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Honour upstream propagated ID (e.g. from API gateway / load balancer)
  const incomingId = req.headers['x-correlation-id'];
  const correlationId =
    typeof incomingId === 'string' && incomingId.length > 0
      ? incomingId
      : randomUUID();

  req.correlationId = correlationId;
  res.locals.correlationId = correlationId;

  // Expose to client so frontend can reference the same ID in bug reports
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
