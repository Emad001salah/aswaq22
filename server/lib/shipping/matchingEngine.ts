/**
 * matchingEngine.ts — Driver Matching Score & Route Optimization Engine
 *
 * Implements:
 *   - Advanced Driver Matching Score (Distance, Rating, Current Load, Vehicle Type)
 *   - Nearest-Neighbor Traveling Salesperson (TSP) route optimization for multi-stop drops
 */

import { prisma } from '../../../src/lib/prisma.ts';

export interface DriverProfile {
  id:              string;
  rating:          number;
  totalDeliveries: number;
  currentLoad:     number;
  vehicleType:     string;
  acceptanceRate:  number; // 0-100%
}

export class MatchingEngine {
  /**
   * Compute matching score for a driver to prioritize assignments.
   * Higher score = better driver choice.
   */
  static calculateMatchingScore(params: {
    driver:     DriverProfile;
    distanceKm: number;
    requiredVehicle?: string;
  }): number {
    const { driver, distanceKm, requiredVehicle } = params;

    let score = 100;

    // 1. Distance penalty (closer is better: lose 8 points per km)
    score -= distanceKm * 8;

    // 2. Rating boost (Rating 1-5, add up to 25 points)
    score += driver.rating * 5;

    // 3. Current load penalty (busy drivers get lower priority: lose 15 points per active delivery)
    score -= driver.currentLoad * 15;

    // 4. Acceptance rate factor
    score += (driver.acceptanceRate / 100) * 10;

    // 5. Vehicle compatibility check
    if (requiredVehicle && driver.vehicleType !== requiredVehicle) {
      score -= 50; // significant penalty for vehicle mismatch
    }

    return score;
  }

  /**
   * Optimize routes for multi-stop deliveries (Greedy Nearest-Neighbor TSP)
   */
  static optimizeRoute(
    currentLat: number,
    currentLng: number,
    stops: Array<{
      id:  string;
      lat: number;
      lng: number;
      type: 'PICKUP' | 'DELIVERY';
    }>
  ): Array<{ id: string; lat: number; lng: number; type: 'PICKUP' | 'DELIVERY' }> {
    if (stops.length <= 1) return stops;

    const unvisited = [...stops];
    const optimized: typeof stops = [];
    
    let lastLat = currentLat;
    let lastLng = currentLng;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = this.calculateDistance(lastLat, lastLng, unvisited[i].lat, unvisited[i].lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextStop = unvisited.splice(nearestIdx, 1)[0];
      optimized.push(nextStop);

      lastLat = nextStop.lat;
      lastLng = nextStop.lng;
    }

    return optimized;
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
