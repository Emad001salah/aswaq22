/**
 * src/constants/cities.ts
 *
 * Coordinates and Haversine distance calculator for marketplace cities.
 */

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  sanaa_city: { lat: 15.3694, lng: 44.1910 },
  aden:       { lat: 12.7855, lng: 45.0186 },
  taiz:       { lat: 13.5795, lng: 44.0206 },
  hadramout:  { lat: 15.9333, lng: 48.7833 },
  ibb:        { lat: 13.9669, lng: 44.1822 },
  hodeidah:   { lat: 14.7979, lng: 42.9530 },
  marib:      { lat: 15.4619, lng: 45.3253 },
  saada:      { lat: 16.9402, lng: 43.7639 },
  hajjah:     { lat: 15.6939, lng: 43.6019 },
  amran:      { lat: 15.6601, lng: 43.9439 },
  al_jawf:    { lat: 16.4750, lng: 45.4200 },
  al_mahra:   { lat: 16.2167, lng: 52.1667 },
  socotra:    { lat: 12.4634, lng: 53.8237 },
  abyan:      { lat: 13.5833, lng: 45.7500 },
  lahj:       { lat: 13.1667, lng: 44.8333 },
  shabwa:     { lat: 14.5333, lng: 46.8333 },
  al_bayda:   { lat: 14.2122, lng: 45.4744 },
  dhale:      { lat: 13.6953, lng: 44.7314 },
  al_mawit:   { lat: 15.4701, lng: 43.5448 },
  raymah:     { lat: 14.6300, lng: 43.7100 },
};

/**
 * Calculates Haversine distance in kilometers between two lat/lng points.
 */
export function getDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Format numbers safely into locale strings */
export function formatPrice(price: any): string {
  if (price === undefined || price === null || isNaN(Number(price))) return '0';
  return new Intl.NumberFormat('en-US').format(Number(price));
}
