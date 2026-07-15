/**
 * geofencing.ts — Geofencing & Fraud Detection Engine
 *
 * Implements:
 *   - Auto check-in geofencing (transition triggers at < 150m)
 *   - Fraud detection / GPS location spoofing checks (blocks updates if speed > 160 km/h)
 *   - Proximity verification before OTP submission (forces agent proximity < 300m to recipient)
 */

import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';
import { ShippingStateMachine } from './stateMachine.ts';

export class GeofencingEngine {
  private static GEOFENCE_RADIUS_METERS = 150;
  private static MAX_PLAUSIBLE_SPEED_KMH = 160;

  /**
   * Automatically updates status when driver triggers a geofence entry.
   */
  static async checkGeofenceAndTransition(
    shipmentId: string,
    agentLat:    number,
    agentLng:    number
  ): Promise<void> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) return;

    // Check distance to pickup
    if (shipment.status === 'WAITING_PICKUP' && shipment.pickupLat && shipment.pickupLng) {
      const distance = this.calculateDistance(agentLat, agentLng, shipment.pickupLat, shipment.pickupLng) * 1000;
      if (distance <= this.GEOFENCE_RADIUS_METERS) {
        logger.info({ message: '[Geofencing] Auto-checkin at pickup location', shipmentId, distanceMeters: distance });
        
        await ShippingStateMachine.transition(shipmentId, 'PICKED_UP', {
          userId:      'SYSTEM',
          description: `Auto-checkin: Driver arrived at pickup location (${distance.toFixed(0)}m)`,
          lat:         agentLat,
          lng:         agentLng,
        });
      }
    }

    // Check distance to destination
    if (shipment.status === 'OUT_FOR_DELIVERY' && shipment.deliveryLat && shipment.deliveryLng) {
      const distance = this.calculateDistance(agentLat, agentLng, shipment.deliveryLat, shipment.deliveryLng) * 1000;
      if (distance <= this.GEOFENCE_RADIUS_METERS) {
        logger.info({ message: '[Geofencing] Auto-checkin at delivery destination', shipmentId, distanceMeters: distance });
        // In production: send socket alert to buyer "Driver is nearby!"
      }
    }
  }

  /**
   * Detect and block fake/spoofed coordinates
   */
  static async detectLocationSpoofing(
    agentId:   string,
    reportLat: number,
    reportLng: number
  ): Promise<boolean> {
    const agent = await prisma.deliveryAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || !agent.currentLat || !agent.currentLng) return false;

    // Calculate time elapsed
    const timeDeltaHours = (Date.now() - agent.updatedAt.getTime()) / 3600000;

    // Skip if elapsed time is too short to estimate speed properly (< 5 seconds)
    if (timeDeltaHours < 0.00138) return false; 

    const distanceKm = this.calculateDistance(agent.currentLat, agent.currentLng, reportLat, reportLng);
    const speedKmh = distanceKm / timeDeltaHours;

    if (speedKmh > this.MAX_PLAUSIBLE_SPEED_KMH) {
      logger.warn({
        message:     '🚨 FRAUD DETECTED: Location spoofing suspected',
        agentId,
        distanceKm:  distanceKm.toFixed(2),
        speedKmh:    speedKmh.toFixed(0),
        prevLocation: `${agent.currentLat},${agent.currentLng}`,
        newLocation:  `${reportLat},${reportLng}`,
      });

      // Write security event log
      await prisma.securityEvent.create({
        data: {
          type:      'LOCATION_SPOOFING',
          ipAddress: '127.0.0.1',
          details:   `Agent: ${agentId} travelled at ${speedKmh.toFixed(0)} km/h`,
        },
      });

      return true; // Spoofing detected!
    }

    return false;
  }

  /**
   * Blocks delivery confirmation if driver attempts it far from the delivery spot
   */
  static async verifyLocationBeforeOTP(
    shipmentId: string,
    agentLat:    number,
    agentLng:    number
  ): Promise<boolean> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment || !shipment.deliveryLat || !shipment.deliveryLng) return true; // Fail open if no coordinates

    const distanceMeters = this.calculateDistance(agentLat, agentLng, shipment.deliveryLat, shipment.deliveryLng) * 1000;

    // Require driver to be within 300 meters of the buyer's home
    if (distanceMeters > 300) {
      logger.warn({
        message:        '🚨 FRAUD ATTEMPT: Verification rejected due to distance',
        shipmentId,
        distanceMeters: distanceMeters.toFixed(0),
      });
      return false; // Driver too far away!
    }

    return true;
  }

  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
