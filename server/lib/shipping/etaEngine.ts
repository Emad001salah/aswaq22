/**
 * etaEngine.ts — Shipping Estimated Time of Arrival (ETA) Engine
 *
 * Factors in distance, city-specific congestion multipliers,
 * and driver vehicle type to compute reliable arrival and delivery times.
 */

export class EtaEngine {
  /**
   * Calculate ETA parameters
   * Returns estimated durations in minutes
   */
  static calculateETA(params: {
    pickupLat:   number;
    pickupLng:   number;
    deliveryLat: number;
    deliveryLng: number;
    vehicleType?: string;
    city?:        string;
  }): {
    distanceKm:       number;
    pickupMinutes:    number;
    transitMinutes:   number;
    totalMinutes:     number;
    estimatedArrival: Date;
  } {
    const { pickupLat, pickupLng, deliveryLat, deliveryLng, vehicleType = 'MOTORCYCLE', city = 'Sana\'a' } = params;

    // 1. Calculate Haversine distance
    const R = 6371; // Earth radius in km
    const dLat = ((deliveryLat - pickupLat) * Math.PI) / 180;
    const dLng = ((deliveryLng - pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickupLat * Math.PI) / 180) *
        Math.cos((deliveryLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // 2. Base speed per vehicle (km/h)
    let speed = 40; // Default motorcycle
    if (vehicleType === 'CAR') speed = 50;
    if (vehicleType === 'BICYCLE') speed = 15;
    if (vehicleType === 'FOOT') speed = 5;

    // 3. City congestion multiplier
    let congestionMultiplier = 1.0;
    const lowerCity = city.toLowerCase();
    if (lowerCity.includes('sana') || lowerCity.includes('صنعاء')) {
      congestionMultiplier = 1.35; // 35% traffic delay
    } else if (lowerCity.includes('aden') || lowerCity.includes('عدن')) {
      congestionMultiplier = 1.20;
    }

    // 4. Calculate durations
    const baseTransitHours = distanceKm / speed;
    const transitMinutes = Math.round(baseTransitHours * 60 * congestionMultiplier);
    
    // Pickup time: driver distance to seller (mocked as 5-15 mins)
    const pickupMinutes = 10; 
    
    const totalMinutes = pickupMinutes + transitMinutes + 5; // adding 5 mins handover buffer

    const estimatedArrival = new Date();
    estimatedArrival.setMinutes(estimatedArrival.getMinutes() + totalMinutes);

    return {
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      pickupMinutes,
      transitMinutes,
      totalMinutes,
      estimatedArrival,
    };
  }
}
