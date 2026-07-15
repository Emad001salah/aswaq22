/**
 * stateMachine.ts — Shipment State Machine
 *
 * Implements strict status transition validation to prevent invalid lifecycle jumps.
 */

import { ShipmentStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.ts';
import { AuditTrail } from './auditTrail.ts';
import { prisma } from '../../../src/lib/prisma.ts';

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING:          ['WAITING_PICKUP', 'CANCELLED'],
  WAITING_PICKUP:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:        ['IN_TRANSIT', 'CANCELLED', 'LOST', 'DAMAGED'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'LOST', 'DAMAGED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED', 'LOST', 'DAMAGED'],
  DELIVERED:        [],
  FAILED:           ['RETURN_REQUESTED', 'CANCELLED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED:         [],
  CANCELLED:        [],
  LOST:             [],
  DAMAGED:          [],
};

export class ShippingStateMachine {
  /**
   * Verify if a transition is allowed.
   */
  static canTransition(current: ShipmentStatus, target: ShipmentStatus): boolean {
    return VALID_TRANSITIONS[current]?.includes(target) || false;
  }

  /**
   * Transition shipment status with strict checks, database updates, and audit logging.
   */
  static async transition(
    shipmentId: string,
    targetStatus: ShipmentStatus,
    metadata: {
      userId:      string;
      userIp?:     string;
      userAgent?:  string;
      description: string;
      lat?:        number;
      lng?:        number;
    }
  ): Promise<any> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new AppError(404, 'الشحنة المحددة غير موجودة.');
    }

    if (!this.canTransition(shipment.status, targetStatus)) {
      throw new AppError(
        400,
        `غير مسموح بالانتقال من حالة ${shipment.status} إلى حالة ${targetStatus}.`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update status
      const s = await tx.shipment.update({
        where: { id: shipmentId },
        data:  { status: targetStatus },
      });

      // 2. Add history event
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status:      targetStatus,
          description: metadata.description,
          lat:         metadata.lat,
          lng:         metadata.lng,
        },
      });

      // 3. Write Domain Event to Outbox Table
      await tx.outboxEvent.create({
        data: {
          aggregate:   'Shipment',
          aggregateId: shipmentId,
          eventType:   `Shipment${targetStatus.replace(/_/g, '')}`,
          payload:     {
            shipmentId,
            oldStatus: shipment.status,
            newStatus: targetStatus,
            metadata,
          } as any,
        },
      });

      // 4. Log detailed audit trail
      await AuditTrail.log({
        tx,
        shipmentId,
        userId:      metadata.userId,
        action:      `STATUS_TRANSITION_${targetStatus}`,
        oldValue:    shipment.status,
        newValue:    targetStatus,
        details:     metadata.description,
        ipAddress:   metadata.userIp,
        deviceInfo:  metadata.userAgent,
      });

      return s;
    });

    return updated;
  }
}
