/**
 * dispatchEngine.ts — P2P Driver Dispatch & Routing Engine
 *
 * Employs Redis GEORADIUS for sub-second agent location queries
 * with database fallback, implementing auto-expanding search radii.
 */

import { redis } from '../../../src/lib/redis.ts';
import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';
import { queues } from '../../../src/lib/queues.ts';

const REDIS_GEO_KEY = 'shipping:agent_locations';

export class DispatchEngine {
  /**
   * Update the driver's current location in Redis GEO index
   * and asynchronously save to database.
   */
  static async updateAgentLocation(agentId: string, lat: number, lng: number): Promise<void> {
    const client = redis.getClient();
    if (client) {
      try {
        // Redis uses (longitude, latitude) order for GEOADD
        await client.geoadd(REDIS_GEO_KEY, lng.toString(), lat.toString(), agentId);
      } catch (err: any) {
        logger.warn({ message: '[DispatchEngine] Redis geoadd failed', error: err.message });
      }
    }

    // Run DB update asynchronously to not block
    setImmediate(async () => {
      try {
        await prisma.deliveryAgent.update({
          where: { id: agentId },
          data: {
            currentLat: lat,
            currentLng: lng,
            status:     'AVAILABLE',
          },
        });
      } catch (err: any) {
        logger.error({ message: '[DispatchEngine] Failed to save location in DB', agentId, error: err.message });
      }
    });
  }

  /**
   * Find available drivers within a specified radius (in kilometers)
   */
  static async findNearbyAgents(lat: number, lng: number, radiusKm: number): Promise<string[]> {
    const client = redis.getClient();
    if (client) {
      try {
        // GEORADIUS key longitude latitude radius km
        const results = await client.georadius(REDIS_GEO_KEY, lng, lat, radiusKm, 'km');
        if (results && results.length > 0) {
          // Filter out busy/offline agents by querying their status
          const activeAgents = await prisma.deliveryAgent.findMany({
            where: {
              id:     { in: results as string[] },
              status: 'AVAILABLE',
            },
            select: { id: true },
          });
          return activeAgents.map(a => a.id);
        }
        return [];
      } catch (err: any) {
        logger.warn({ message: '[DispatchEngine] Redis georadius failed, falling back to DB', error: err.message });
      }
    }

    // Database fallback (bounding box / Haversine approximation)
    const earthRadiusKm = 6371;
    const maxLatDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const maxLngDelta = (radiusKm / (earthRadiusKm * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

    const minLat = lat - maxLatDelta;
    const maxLat = lat + maxLatDelta;
    const minLng = lng - maxLngDelta;
    const maxLng = lng + maxLngDelta;

    const nearbyAgents = await prisma.deliveryAgent.findMany({
      where: {
        status:     'AVAILABLE',
        currentLat: { gte: minLat, lte: maxLat },
        currentLng: { gte: minLng, lte: maxLng },
      },
      select: { id: true },
    });

    return nearbyAgents.map(a => a.id);
  }

  /**
   * Broadcast shipment pickup offer to nearby agents using auto-expanding radius
   */
  static async broadcastShipmentOffer(shipmentId: string, attempt: number = 0): Promise<void> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment || shipment.status !== 'PENDING') {
      logger.info({ message: '[DispatchEngine] Offer expired or already assigned', shipmentId });
      return;
    }

    // Step-wise expansion: 3km -> 5km -> 10km
    const radii = [3, 5, 10];
    const currentRadius = radii[Math.min(attempt, radii.length - 1)];

    if (!shipment.pickupLat || !shipment.pickupLng) {
      logger.error({ message: '[DispatchEngine] Shipment lacks pickup coordinates', shipmentId });
      return;
    }

    logger.info({ message: '[DispatchEngine] Broadcasting offer', shipmentId, radius: `${currentRadius}km`, attempt });

    const nearbyAgents = await this.findNearbyAgents(shipment.pickupLat, shipment.pickupLng, currentRadius);

    if (nearbyAgents.length > 0) {
      // Send WebSocket event / push notifications to nearby drivers (simplified simulation)
      logger.info({ message: `[DispatchEngine] Dispatched offer to ${nearbyAgents.length} agents`, agents: nearbyAgents });
      
      // In production: send Socket.io broadcast to target agents
      // io.to(agentChannel).emit('shipment:offer', { ... })
    }

    // If no one accepts in 60s, expand radius via BullMQ delayed job
    if (attempt < radii.length - 1) {
      // Re-trigger dispatch with larger radius in 60 seconds
      await queues.addDispatchJob({ shipmentId, attempt: attempt + 1 }, 60000);
    } else {
      // Escalate to manual operations dashboard (SEV3 alert)
      logger.warn({ message: `[DispatchEngine] No drivers accepted shipment offer after max expansion. Escalated to Ops Dashboard.`, shipmentId });
      
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: 'WAITING_PICKUP' }, // Move to waiting pool for manual admin assignment
      });
    }
  }
}
