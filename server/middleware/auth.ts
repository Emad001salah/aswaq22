import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export type Permission = 'BYPASS_MODERATION' | 'APPROVE_REJECT_ADS' | 'VIEW_ADMIN_LOGS';

export const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ['BYPASS_MODERATION', 'APPROVE_REJECT_ADS', 'VIEW_ADMIN_LOGS'],
  ADMIN: ['BYPASS_MODERATION', 'APPROVE_REJECT_ADS', 'VIEW_ADMIN_LOGS'],
  MODERATOR: ['APPROVE_REJECT_ADS'],
  AGENT: [],
  MERCHANT: [],
  USER: [],
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase() as UserRole;
  return rolePermissions[upperRole]?.includes(permission) || false;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: Permission[];
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'مطلوب تسجيل الدخول للوصول لهذه العملية.' 
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('[AuthMiddleware] Verifying token:', token.substring(0, 15) + '...');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('[AuthMiddleware] Token verified successfully. Decoded payload:', decoded);
    const role = decoded.role || 'USER';
    const upperRole = role.toUpperCase() as UserRole;
    req.user = {
      id: decoded.sub || decoded.id || '',
      email: decoded.email || '',
      role: role,
      permissions: rolePermissions[upperRole] || [],
    };
    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] Token verification failed:', err.message);
    return res.status(401).json({ 
      error: 'Invalid Token', 
      message: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.' 
    });
  }
}

export function rolesGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hasRole = allowedRoles.includes(req.user.role.toUpperCase());
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية.' 
      });
    }
    next();
  };
}

export function permissionsGuard(requiredPermission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const permitted = req.user.permissions.includes(requiredPermission);
    if (!permitted) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية.' 
      });
    }
    next();
  };
}
