/**
 * accountingEngine.ts — Double-Entry Escrow & COD Ledger Engine
 *
 * Implements strict accounting integrity:
 *   - Ledger entries cannot be modified once created
 *   - Automatic allocation of platform commission, merchant payout, and driver fee
 *   - Atomic updates using database transactions
 */

import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';

export class AccountingEngine {
  /**
   * Records ledger entries and updates balances atomically when shipment is delivered.
   */
  static async recordDeliverySuccess(shipmentId: string): Promise<void> {
    logger.info({ message: '[AccountingEngine] Processing delivery ledger updates', shipmentId });

    await prisma.$transaction(async (tx) => {
      // 1. Fetch shipment with order and agent info
      const shipment = await tx.shipment.findUnique({
        where:   { id: shipmentId },
        include: { order: true },
      });

      if (!shipment) {
        throw new Error(`Shipment ${shipmentId} not found`);
      }

      if (shipment.status !== 'DELIVERED') {
        throw new Error(`Shipment ${shipmentId} must be in DELIVERED status to settle`);
      }

      const order = shipment.order;
      const agentId = shipment.agentId;
      const sellerId = order.sellerId;

      // ─── Case 1: P2P Agent Delivery ─────────────────────────────────────────
      if (shipment.carrierMethod === 'P2P_AGENT' && agentId) {
        // Driver collects full COD amount (Order Total + Shipping Fee)
        const collectedCash = shipment.codAmount;
        
        // Platform Commission (e.g. 10% of order price)
        const commissionRate = 0.10;
        const platformCommission = order.totalPrice * commissionRate;
        
        // Payout to Vendor (Order Price - Commission)
        const vendorPayout = order.totalPrice - platformCommission;
        
        // Agent payout (Delivery Fee)
        const agentFee = shipment.totalCost; // Cost of delivery goes to driver

        // 1. Ledger Entry: Cash collected by driver (Driver's cash liability)
        await tx.shippingLedger.create({
          data: {
            shipmentId,
            agentId,
            sellerId,
            amount:      collectedCash,
            type:        'COD_COLLECT',
            description: `Driver collected cash of YER ${collectedCash} from buyer`,
          },
        });

        // 2. Ledger Entry: Credit Merchant Wallet
        await tx.shippingLedger.create({
          data: {
            shipmentId,
            agentId,
            sellerId,
            amount:      vendorPayout,
            type:        'PAYOUT_MERCHANT',
            description: `Credited merchant wallet YER ${vendorPayout} (Commission: YER ${platformCommission})`,
          },
        });

        // 3. Ledger Entry: Platform Commission
        await tx.shippingLedger.create({
          data: {
            shipmentId,
            agentId,
            sellerId,
            amount:      platformCommission,
            type:        'COMMISSION_PLAT',
            description: `Platform commission revenue YER ${platformCommission} (10%)`,
          },
        });

        // 4. Ledger Entry: Agent Delivery Fee Payout
        await tx.shippingLedger.create({
          data: {
            shipmentId,
            agentId,
            sellerId,
            amount:      agentFee,
            type:        'AGENT_DELIVERY_FEE',
            description: `Driver payout of YER ${agentFee} for delivery service`,
          },
        });

        // 5. Update agent's cash liability and earned wallet balance
        await tx.deliveryAgent.update({
          where: { id: agentId },
          data: {
            codBalance:      { increment: collectedCash }, // Driver owes this cash to platform
            walletBalance:   { increment: agentFee },      // Driver can withdraw this fee
            totalDeliveries: { increment: 1 },
          },
        });

        logger.info({
          message:     '[AccountingEngine] COD P2P Ledger updated successfully',
          shipmentId,
          collectedCash,
          vendorPayout,
          agentFee,
        });

      // ─── Case 2: Self Delivery (Merchant delivers directly) ────────────────
      } else if (shipment.carrierMethod === 'SELF') {
        const platformCommission = order.totalPrice * 0.05; // lower commission for self-delivery (5%)
        const vendorPayout = order.totalPrice - platformCommission;

        await tx.shippingLedger.create({
          data: {
            shipmentId,
            sellerId,
            amount:      vendorPayout,
            type:        'PAYOUT_MERCHANT',
            description: `Self-delivery credit of YER ${vendorPayout} to merchant`,
          },
        });

        await tx.shippingLedger.create({
          data: {
            shipmentId,
            sellerId,
            amount:      platformCommission,
            type:        'COMMISSION_PLAT',
            description: `Self-delivery platform commission YER ${platformCommission} (5%)`,
          },
        });

        logger.info({ message: '[AccountingEngine] Self-delivery ledger updated', shipmentId, vendorPayout });
      }

      // Update Order Status to COMPLETED
      await tx.order.update({
        where: { id: order.id },
        data:  { status: 'COMPLETED' },
      });
    });
  }

  /**
   * Driver pays physical cash back to platform office or via bank transfer
   */
  static async settleAgentCash(agentId: string, amount: number, reference: string): Promise<void> {
    logger.info({ message: '[AccountingEngine] Driver cash settlement initiated', agentId, amount });

    await prisma.$transaction(async (tx) => {
      const agent = await tx.deliveryAgent.findUnique({ where: { id: agentId } });
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      if (agent.codBalance < amount) {
        throw new Error(`Cannot settle YER ${amount}: Driver only holds YER ${agent.codBalance} cash liability`);
      }

      // Record settlement entry
      await tx.shippingLedger.create({
        // Dummy shipment ID representation for general account settlements
        data: {
          shipmentId:  '00000000-0000-0000-0000-000000000000', 
          agentId,
          sellerId:    'SYSTEM',
          amount,
          type:        'SETTLEMENT',
          description: `Driver cash settlement: Ref: ${reference}`,
        },
      });

      // Reduce driver's cash liability balance
      await tx.deliveryAgent.update({
        where: { id: agentId },
        data: {
          codBalance: { decrement: amount },
        },
      });
    });

    logger.info({ message: '[AccountingEngine] Settlement finalized successfully', agentId, amount });
  }
}
