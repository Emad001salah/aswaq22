/**
 * server/middleware/auth.ts
 *
 * Authentication & Authorization middleware
 *
 * SECURITY HARDENING (2026-07-22):
 *  - Removed all hardcoded JWT secret fallbacks (SEC-002).
 *    The server will throw on startup if JWT_SECRET is not set.
 *  - Single secret verification — no multi-secret try loop.
 *  - RBAC permissions table for fine-grained access control.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { logger } from '../lib/logger.ts';

export type Permission = 'BYPASS_MODERATION' | 'APPROVE_REJECT_ADS' | 'VIEW_ADMIN_LOGS';

export const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ['BYPASS_MODERATION', 'APPROVE_REJECT_ADS', 'VIEW_ADMIN_LOGS'],
  ADMIN:       ['BYPASS_MODERATION', 'APPROVE_REJECT_ADS', 'VIEW_ADMIN_LOGS'],
  MODERATOR:   ['APPROVE_REJECT_ADS'],
  AGENT:       [],
  MERCHANT:    [],
  USER:        [],
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase() as UserRole;
  return rolePermissions[upperRole]?.includes(permission) || false;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id:          string;
    email:       string;
    role:        string;
    permissions: Permission[];
    /** Optional profile fields — may be populated by middleware that fetches full user */
    name?:       string;
    avatar?:     string;
  };
}

/**
 * Returns the JWT secret from environment.
 * THROWS if JWT_SECRET is not configured — the server must not start without it.
 *
 * [SEC-002] Removed all hardcoded fallback secrets. Previously the code tried
 * multiple fallback strings ('aswaq_jwt_secret_dev_key_2026...', 'change-me-in-production')
 * which allowed anyone knowing those strings to forge valid JWTs for any user.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.replace(/^['"]|['"]$/g, '');
  if (!secret) {
    // Fail hard — do not silently fall back to a known string
    const msg = '[Security] FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.';
    logger.error({ message: msg });
    throw new Error(msg);
  }
  return secret;
}

/**
 * Express middleware that validates the Bearer JWT on every protected route.
 *
 * Behaviour:
 *  - 401 if Authorization header is missing or malformed
 *  - 401 if token is expired, forged, or signed with wrong secret
 *  - Populates req.user on success
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({
      message:       `[Auth] Unauthorized: missing or malformed Authorization header`,
      path:          `${req.method} ${req.path}`,
      correlationId: (req as any).correlationId,
    });
    return res.status(401).json({
      error:   'Unauthorized',
      message: 'مطلوب تسجيل الدخول للوصول لهذه العملية.',
    });
  }

  const token = authHeader.split(' ')[1];

  let decoded: any = null;
  try {
    // [SEC-002] Single-secret verification — no fallback loop
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err: any) {
    const reason = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    logger.warn({
      message:       `[Auth] Token ${reason}: ${err?.message}`,
      path:          `${req.method} ${req.path}`,
      correlationId: (req as any).correlationId,
    });
    return res.status(401).json({
      error:   'Invalid Token',
      message: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.',
    });
  }

  const role      = decoded.role || 'USER';
  const upperRole = role.toUpperCase() as UserRole;

  req.user = {
    id:          decoded.sub || decoded.id || '',
    email:       decoded.email || '',
    role:        role,
    permissions: rolePermissions[upperRole] || [],
  };

  next();
}

/**
 * Role-based access guard.
 * Usage: router.get('/admin', authMiddleware, rolesGuard(['ADMIN', 'SUPER_ADMIN']), handler)
 */
export function rolesGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hasRole = allowedRoles.map(r => r.toUpperCase()).includes(req.user.role.toUpperCase());
    if (!hasRole) {
      logger.warn({
        message:  `[Auth] Forbidden: user ${req.user.id} (role: ${req.user.role}) tried ${req.method} ${req.path}`,
        required: allowedRoles,
      });
      return res.status(403).json({
        error:   'Forbidden',
        message: 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية.',
      });
    }
    next();
  };
}

/**
 * Fine-grained permission guard.
 * Usage: router.post('/approve', authMiddleware, permissionsGuard('APPROVE_REJECT_ADS'), handler)
 */
export function permissionsGuard(requiredPermission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.user.permissions.includes(requiredPermission)) {
      logger.warn({
        message:    `[Auth] Permission denied: user ${req.user.id} missing '${requiredPermission}'`,
        path:       `${req.method} ${req.path}`,
      });
      return res.status(403).json({
        error:   'Forbidden',
        message: 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية.',
      });
    }
    next();
  };
}
