import { prisma } from '../../../src/lib/prisma.ts';
import { Request } from 'express';

export type AuditAction =
  | 'FEATURE_FLAG_TOGGLE'
  | 'ADMIN_BYPASS'
  | 'SHIPMENT_TRANSITION'
  | 'FORCE_DELIVER'
  | 'REFUND_APPROVED';

export interface AuditLogParams {
  action: AuditAction;
  entity: string;
  before?: string | null;
  after?: string | null;
  performedBy: string; // email or system identifier
  ipAddress?: string;
  description?: string;
}

/**
 * Centralized audit logger used by the logistics gate, state machine and admin actions.
 * All audit entries are persisted in the `AuditLog` table (UUID primary key).
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      before: params.before ?? null,
      after: params.after ?? null,
      performedBy: params.performedBy,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
