/**
 * slaEngine.ts — Service Level Agreement (SLA) Monitoring Engine
 *
 * Scans active shipments to flag timeouts:
 *   - > 15 minutes unassigned → Escalates to manual dispatcher queue
 *   - > 6 hours out for delivery → Generates security/admin operational incident log
 */

import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';

export class SlaEngine {
  /**
   * Scan active shipments and escalate SLA breaches
   */
  static async checkSlaBreaches(): Promise<void> {
    logger.info({ message: '[SlaEngine] Running SLA checks...' });

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);

    // 1. Escalate unassigned shipments (> 15m PENDING)
    const unassignedBreaches = await prisma.shipment.findMany({
      where: {
        status:    'PENDING',
        createdAt: { lte: fifteenMinsAgo },
      },
    });

    for (const shipment of unassignedBreaches) {
      logger.warn({ message: 'SLA Breach: Shipment remained unassigned > 15m', shipmentId: shipment.id });

      // Move to WAITING_PICKUP to indicate manual dispatch intervention is required
      await prisma.shipment.update({
        where: { id: shipment.id },
        data:  { status: 'WAITING_PICKUP' },
      });

      // Write Incident Admin Log
      await prisma.adminLog.create({
        data: {
          adminId: 'SYSTEM',
          action:  'SLA_BREACH_UNASSIGNED',
          details: JSON.stringify({ shipmentId: shipment.id, createdTime: shipment.createdAt }),
        },
      });
    }

    // 2. Alert on stuck deliveries (> 6h OUT_FOR_DELIVERY)
    const stuckDeliveries = await prisma.shipment.findMany({
      where: {
        status:    'OUT_FOR_DELIVERY',
        updatedAt: { lte: sixHoursAgo },
      },
    });

    for (const shipment of stuckDeliveries) {
      logger.error({ message: 'SLA Violation: Shipment stuck in OUT_FOR_DELIVERY > 6h', shipmentId: shipment.id });

      // Flag an incident in admin logs
      await prisma.adminLog.create({
        data: {
          adminId: 'SYSTEM',
          action:  'SLA_BREACH_DELIVERY_STUCK',
          details: JSON.stringify({
            shipmentId:  shipment.id,
            agentId:     shipment.agentId,
            lastUpdated: shipment.updatedAt,
          }),
        },
      });
    }

    logger.info({
      message:            '[SlaEngine] SLA scan complete',
      unassignedBreaches: unassignedBreaches.length,
      stuckDeliveries:    stuckDeliveries.length,
    });
  }
}
