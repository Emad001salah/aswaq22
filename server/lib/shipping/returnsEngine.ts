/**
 * returnsEngine.ts — Reverse Logistics & Returns Engine
 *
 * Manages reverse delivery pipelines, vendor approvals,
 * refund triggers, and inventory restock updates.
 */

import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';
import { ShippingStateMachine } from './stateMachine.ts';

export class ReturnsEngine {
  /**
   * Buyer requests a return for a delivered shipment
   */
  static async requestReturn(shipmentId: string, reason: string, userId: string): Promise<any> {
    logger.info({ message: '[ReturnsEngine] Requesting return', shipmentId, reason });

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment || shipment.status !== 'DELIVERED') {
      throw new Error('يمكن فقط إرجاع الشحنات التي تم تسليمها بنجاح.');
    }

    // Transition to RETURN_REQUESTED
    return await ShippingStateMachine.transition(shipmentId, 'RETURN_REQUESTED', {
      userId,
      description: `طلب إرجاع: ${reason}`,
    });
  }

  /**
   * Merchant/Admin approves the return, transitions to RETURNED, refunds the buyer, and restocks item
   */
  static async finalizeReturn(shipmentId: string, userId: string): Promise<any> {
    logger.info({ message: '[ReturnsEngine] Finalizing return & refund', shipmentId });

    const shipment = await prisma.shipment.findUnique({
      where:   { id: shipmentId },
      include: { order: true },
    });

    if (!shipment || shipment.status !== 'RETURN_REQUESTED') {
      throw new Error('لا يمكن إتمام الإرجاع لشحنة لم تطلب الإرجاع بعد.');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Transition status using state machine inside tx (customized to share transaction)
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data:  { status: 'RETURNED' },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status:      'RETURNED',
          description: 'تم تأكيد استلام المرتجع وإعادة الأموال للمشتري.',
        },
      });

      // 2. Mark Ad/Inventory as active again
      await tx.ad.update({
        where: { id: shipment.order.adId },
        data:  { status: 'ACTIVE' },
      });

      // 3. Mark Order as CANCELLED
      await tx.order.update({
        where: { id: shipment.orderId },
        data:  { status: 'CANCELLED' },
      });

      // 4. Reverse financial ledger (refund)
      await tx.shippingLedger.create({
        data: {
          shipmentId,
          sellerId:    shipment.order.sellerId,
          amount:      -shipment.order.totalPrice,
          type:        'SETTLEMENT',
          description: `Refund to buyer: Return approved for shipment ${shipmentId}`,
        },
      });

      return updatedShipment;
    });

    logger.info({ message: '[ReturnsEngine] Return finalized successfully', shipmentId });
    return result;
  }
}
