/**
 * auditTrail.ts — Shipping Audit Trail Engine
 *
 * Implements strict append-only audit logs to record who, when, from where,
 * and what changed during shipment operations.
 */

export class AuditTrail {
  /**
   * Log a security/operational transition event.
   */
  static async log(params: {
    tx:          any; // Prisma transactional client
    shipmentId:  string;
    userId:      string;
    action:      string;
    oldValue:    string | null;
    newValue:    string;
    details:     string;
    ipAddress?:  string;
    deviceInfo?: string;
  }): Promise<void> {
    const payload = {
      shipmentId: params.shipmentId,
      userId:     params.userId,
      oldValue:   params.oldValue,
      newValue:   params.newValue,
      details:    params.details,
      deviceInfo: params.deviceInfo || 'unknown',
    };

    // Store in the database under admin_logs/audit log format
    await params.tx.adminLog.create({
      data: {
        adminId:   params.userId,
        action:    params.action,
        details:   JSON.stringify(payload),
        ipAddress: params.ipAddress || '127.0.0.1',
      },
    });
  }
}
