/**
 * CSRF – Double Submit Cookie Middleware (Phase 2)
 *
 * Flow:
 *  1. GET  /api/csrf-token  → generates a token, sets HttpOnly=false cookie so JS can read it,
 *                             returns token in JSON body too.
 *  2. POST/PUT/PATCH/DELETE → middleware compares cookie value with X-CSRF-Token header.
 *     Mismatch → 403 Forbidden.
 *
 * Safe methods (GET, HEAD, OPTIONS) are skipped automatically.
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { Router } from 'express';
import { AppError } from './error.ts';

const CSRF_COOKIE  = 'csrf_token';
const CSRF_HEADER  = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Validates X-CSRF-Token header against the csrf_token cookie.
 * Mount this AFTER session / cookie parser middlewares.
 */
export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (req.path.startsWith('/api/v1/auth/') || req.path.startsWith('/api/v1/admin/') || req.path.startsWith('/api/admin/')) {
    return next();
  }

  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Exempt mobile apps (Capacitor WebView origins) from CSRF checks
  const origin = req.headers.origin;
  const isMobile = origin && (
    origin.startsWith('capacitor://') || 
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
  if (isMobile) {
    return next();
  }

  const cookieToken  = req.cookies?.[CSRF_COOKIE];
  const headerToken  = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError(403, 'Invalid or missing CSRF token.'));
  }

  next();
}

/**
 * Express Router – exposes GET /api/csrf-token to seed the token.
 * Mount at app level: app.use('/api', csrfTokenRouter);
 */
export const csrfTokenRouter = Router();

csrfTokenRouter.get('/csrf-token', (req: Request, res: Response) => {
  const token = randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,           // JS must read this to embed in X-CSRF-Token header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,   // 1 hour
  });

  res.json({ csrfToken: token });
});
