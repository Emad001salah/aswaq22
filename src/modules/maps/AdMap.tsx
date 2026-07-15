import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Ad } from '../../types.ts';
import { getCurrencyAr } from '../../markets.ts';

export interface AdMapHandle {
  triggerLocation: () => void;
}

interface AdMapProps {
  ads: Ad[];
  selectedCity?: string;
  onSelectCity?: (cityId: string) => void;
  onSelectAd: (ad: Ad) => void;
  referenceCoords?: { lat: number; lng: number } | null;
  center: { lat: number; lng: number };
  cityCoordinates: Record<string, { lat: number; lng: number; ar: string }>;
  marketCityIds: string[];
  platformMode?: 'marketplace' | 'delivery' | 'social' | 'reels';
  onPlatformModeChange?: (mode: 'marketplace' | 'delivery' | 'social' | 'reels') => void;
  deliveryPreview?: {
    pickup: { lat: number; lng: number } | null;
    delivery: { lat: number; lng: number } | null;
    driver?: { lat: number; lng: number } | null;
  };
  nearbyDrivers?: {
    id: string;
    currentLat: number | null;
    currentLng: number | null;
    vehicleType: string | null;
    user?: { name: string };
  }[];
  countryCode?: string;
}

const AdMap = forwardRef<AdMapHandle, AdMapProps>(function AdMap(props, ref) {
  const {
    ads,
    selectedCity,
    onSelectAd,
    center: marketCenter,
    cityCoordinates: marketCityCoords,
    referenceCoords,
    marketCityIds,
    deliveryPreview,
    nearbyDrivers,
    platformMode
  } = props;

  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [forcingUserLocation, setForcingUserLocation] = useState(false);
  
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  // Fit bounds to show entire shipping route (pickup, delivery, driver)
  const fitRouteBounds = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !deliveryPreview) return;
    
    try {
      const bounds = L.latLngBounds();
      let hasPoints = false;
      if (deliveryPreview.pickup) {
        bounds.extend([deliveryPreview.pickup.lat, deliveryPreview.pickup.lng]);
        hasPoints = true;
      }
      if (deliveryPreview.delivery) {
        bounds.extend([deliveryPreview.delivery.lat, deliveryPreview.delivery.lng]);
        hasPoints = true;
      }
      if (deliveryPreview.driver) {
        bounds.extend([deliveryPreview.driver.lat, deliveryPreview.driver.lng]);
        hasPoints = true;
      }
      if (hasPoints) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (e) {
      console.warn('Failed to fit route bounds:', e);
    }
  };

  // Auto-fit bounds when delivery coordinates change
  useEffect(() => {
    if (platformMode === 'delivery' && deliveryPreview && mapRef.current) {
      const t = setTimeout(fitRouteBounds, 100);
      return () => clearTimeout(t);
    }
  }, [
    deliveryPreview?.pickup?.lat,
    deliveryPreview?.pickup?.lng,
    deliveryPreview?.delivery?.lat,
    deliveryPreview?.delivery?.lng,
    deliveryPreview?.driver?.lat,
    deliveryPreview?.driver?.lng
  ]);

  // Geolocation trigger
  const triggerLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setForcingUserLocation(true);
        if (mapRef.current) {
          mapRef.current.setView([loc.lat, loc.lng], 14, { animate: true });
        }
      },
      () => alert(isRtl ? 'تعذر الحصول على الموقع' : 'Could not get location'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useImperativeHandle(ref, () => ({ triggerLocation }));

  // Auto-locate user on mount
  useEffect(() => {
    if (!deliveryPreview?.pickup && !deliveryPreview?.delivery && !userLocation) {
      triggerLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (forcingUserLocation && userLocation) {
      props.onSelectCity?.('');
      setForcingUserLocation(false);
    }
  }, [forcingUserLocation, userLocation]);

  // Determine active center coordinates
  const mapCenter = (forcingUserLocation || userLocation)
    ? (userLocation || marketCenter)
    : (deliveryPreview?.pickup
      ? deliveryPreview.pickup
      : (deliveryPreview?.delivery
        ? deliveryPreview.delivery
        : (selectedCity && marketCityCoords[selectedCity]
          ? { lat: marketCityCoords[selectedCity].lat, lng: marketCityCoords[selectedCity].lng }
          : (referenceCoords || marketCenter))));

  const zoom = (forcingUserLocation || userLocation)
    ? 14
    : (deliveryPreview?.pickup || deliveryPreview?.delivery) ? 11
    : (selectedCity ? 12 : 7);

  // Initialize Map
  useEffect(() => {
    if (!mapDivRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      const map = L.map(mapDivRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([mapCenter.lat, mapCenter.lng], zoom);

      // Add Zoom Control manually to position it
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // Use Google Maps tiles directly (no API key needed) - Match "Add Ad" Map
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20
      }).addTo(map);

      mapRef.current = map;
      
      // Force map redraw to prevent grey tiles
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // Pan to mapCenter if coordinates change
  useEffect(() => {
    if (mapRef.current && !forcingUserLocation) {
      mapRef.current.setView([mapCenter.lat, mapCenter.lng], zoom, { animate: true });
    }
  }, [mapCenter.lat, mapCenter.lng, zoom]);

  // Sync markers and routes
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Clear old route
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // 1. Render Ad Markers
    const activeAds = ads.filter(ad => ad.status?.toLowerCase() === 'active');
    activeAds.forEach(ad => {
      const lat = Number(ad.latitude) || (ad.city && marketCityCoords[ad.city]?.lat) || 0;
      const lng = Number(ad.longitude) || (ad.city && marketCityCoords[ad.city]?.lng) || 0;
      if (!lat) return;

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#10b981; color:white; font-size:10px; font-weight:900; padding:4px 8px; border-radius:12px; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3); white-space:nowrap;">${ad.price.toLocaleString()} ${getCurrencyAr(ad.currency)}</div>`,
        iconSize: null,
        iconAnchor: [30, 15] // approximate center
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on('click', () => onSelectAd(ad));
      markersRef.current.push(marker);
    });

    // 2. Render user current location
    if (userLocation) {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:16px; height:16px; background:#3b82f6; border:3px solid white; border-radius:50%; box-shadow:0 0 10px rgba(59,130,246,0.6);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      markersRef.current.push(userMarker);
    }

    // 2.5 Render nearby drivers
    if (nearbyDrivers && nearbyDrivers.length > 0) {
      nearbyDrivers.forEach(drv => {
        if (drv.currentLat !== null && drv.currentLng !== null) {
          const emoji = drv.vehicleType === 'truck' ? '🚚' : drv.vehicleType === 'car' ? '🚗' : '🛵';
          const drvIcon = L.divIcon({
            className: '',
            html: `<div style="font-size:24px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform:translate(-12px, -12px);">${emoji}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          const drvMarker = L.marker([drv.currentLat, drv.currentLng], { icon: drvIcon }).addTo(map);
          drvMarker.bindPopup(`
            <div class="text-xs font-sans text-right p-1.5 min-w-[120px]" dir="rtl">
              <div class="font-bold text-cyan-400">${drv.user?.name || (isRtl ? 'مندوب توصيل' : 'Delivery Captain')}</div>
              <div class="text-[10px] text-slate-400 mt-1">${isRtl ? 'المركبة: ' : 'Vehicle: '}${drv.vehicleType === 'truck' ? (isRtl ? 'شاحنة' : 'Truck') : drv.vehicleType === 'car' ? (isRtl ? 'سيارة' : 'Car') : (isRtl ? 'دراجة' : 'Motorcycle')}</div>
              <div class="text-[9px] text-slate-500 mt-0.5">${isRtl ? 'الحالة: متصل نشط' : 'Status: Online'}</div>
            </div>
          `);
          markersRef.current.push(drvMarker);
        }
      });
    }

    // 3. Render delivery route
    if (deliveryPreview?.pickup && deliveryPreview?.delivery) {
      const pLat = deliveryPreview.pickup.lat;
      const pLng = deliveryPreview.pickup.lng;
      const dLat = deliveryPreview.delivery.lat;
      const dLng = deliveryPreview.delivery.lng;
      
      let routeKey = `${pLat.toFixed(4)},${pLng.toFixed(4)}-${dLat.toFixed(4)},${dLng.toFixed(4)}`;
      let routePath = '';
      const hasDriver = !!deliveryPreview.driver;
      if (hasDriver) {
        routePath += `${deliveryPreview.driver!.lng},${deliveryPreview.driver!.lat};`;
      }
      routePath += `${pLng},${pLat};${dLng},${dLat}`;
      const routeUrl = `/api/v1/geocode/route?path=${encodeURIComponent(routePath)}`;

      // Check if we already fetched this route
      const cached = (window as any)[`route_${routeKey}`];

      if (cached) {
        const solidOutline = L.polyline(cached, { color: '#1e40af', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' });
        const solidInner = L.polyline(cached, { color: '#3b82f6', weight: 4, opacity: 1.0, lineCap: 'round', lineJoin: 'round' });
        polylineRef.current = L.featureGroup([solidOutline, solidInner]).addTo(map);
      } else {
        // Draw fallback straight line first
        let fallbackPoints: any[] = [];
        if (hasDriver) fallbackPoints.push([deliveryPreview.driver!.lat, deliveryPreview.driver!.lng]);
        fallbackPoints.push([pLat, pLng], [dLat, dLng]);
        
        const outline = L.polyline(fallbackPoints, { color: '#1e40af', weight: 8, opacity: 0.5, dashArray: '10, 15', lineCap: 'round', lineJoin: 'round' });
        const inner = L.polyline(fallbackPoints, { color: '#60a5fa', weight: 4, opacity: 0.8, dashArray: '10, 15', lineCap: 'round', lineJoin: 'round' });
        polylineRef.current = L.featureGroup([outline, inner]).addTo(map);

        // Try Google Maps Directions API first
        if ((window as any).google?.maps?.DirectionsService) {
          const directionsService = new (window as any).google.maps.DirectionsService();
          let origin;
          let waypoints: any[] = [];
          
          if (hasDriver) {
            origin = { lat: deliveryPreview.driver!.lat, lng: deliveryPreview.driver!.lng };
            waypoints.push({ location: { lat: pLat, lng: pLng }, stopover: true });
          } else {
            origin = { lat: pLat, lng: pLng };
          }
          
          directionsService.route({
            origin: origin,
            destination: { lat: dLat, lng: dLng },
            waypoints: waypoints,
            travelMode: 'DRIVING'
          }, (response: any, status: string) => {
            if (status === 'OK' && response.routes && response.routes[0]) {
              const path = response.routes[0].overview_path;
              const coords = path.map((p: any) => [p.lat(), p.lng()]);
              (window as any)[`route_${routeKey}`] = coords;
              
              if (polylineRef.current && map.hasLayer(polylineRef.current)) {
                map.removeLayer(polylineRef.current);
              }
              const solidOutline = L.polyline(coords, { color: '#1e40af', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' });
              const solidInner = L.polyline(coords, { color: '#3b82f6', weight: 4, opacity: 1.0, lineCap: 'round', lineJoin: 'round' });
              polylineRef.current = L.featureGroup([solidOutline, solidInner]).addTo(map);
            } else {
              fallbackToOSRM();
            }
          });
        } else {
          fallbackToOSRM();
        }

        function fallbackToOSRM() {
          fetch(routeUrl)
            .then(res => res.json())
            .then(data => {
              if (data && data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map((c: any[]) => [c[1], c[0]]); // Convert [lng, lat] to [lat, lng]
                (window as any)[`route_${routeKey}`] = coords; // Cache it globally for this session
                
                if (polylineRef.current && map.hasLayer(polylineRef.current)) {
                  map.removeLayer(polylineRef.current);
                }
                const solidOutline = L.polyline(coords, { color: '#1e40af', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' });
                const solidInner = L.polyline(coords, { color: '#3b82f6', weight: 4, opacity: 1.0, lineCap: 'round', lineJoin: 'round' });
                polylineRef.current = L.featureGroup([solidOutline, solidInner]).addTo(map);
              }
            })
            .catch(err => console.error('Route fetch error:', err));
        }
      }

      // Render Pickup Pin (Google Maps style start point: white dot with blue border)
      const pIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px; height:20px; background:#fff; border:5px solid #3b82f6; border-radius:50%; box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const pMarker = L.marker([deliveryPreview.pickup.lat, deliveryPreview.pickup.lng], { icon: pIcon }).addTo(map);
      markersRef.current.push(pMarker);

      // Render Delivery Pin (Google Maps style end point: Red Pin)
      const dIcon = L.divIcon({
        className: '',
        html: `<div style="font-size:32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); transform: translate(-0px, -0px);">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });
      const dMarker = L.marker([deliveryPreview.delivery.lat, deliveryPreview.delivery.lng], { icon: dIcon }).addTo(map);
      markersRef.current.push(dMarker);
    }

    // 4. Render Driver Pin
    if (deliveryPreview?.driver) {
      const drIcon = L.divIcon({
        className: '',
        html: `<div style="font-size:32px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); transform: scaleX(-1);">🛵</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      const drMarker = L.marker([deliveryPreview.driver.lat, deliveryPreview.driver.lng], { icon: drIcon, zIndexOffset: 1000 }).addTo(map);
      markersRef.current.push(drMarker);
    }

  }, [ads, deliveryPreview, userLocation]);

  return (
    <div className="w-full h-full relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-0" style={{ minHeight: '350px' }}>
      
      {/* Map Container */}
      <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} className="z-0" />

      {/* Overlay controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={triggerLocation}
          className="p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-all cursor-pointer"
          title={isRtl ? 'موقعي' : 'My Location'}
        >
          📍
        </button>

        {platformMode === 'delivery' && deliveryPreview && (
          <button
            onClick={fitRouteBounds}
            className="p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-all cursor-pointer"
            title={isRtl ? 'تركيز على المسار' : 'Fit Route'}
          >
            🗺️
          </button>
        )}

        {platformMode !== 'delivery' && (
          <button
            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
            className="w-12 h-12 flex items-center justify-center bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-all font-black text-lg cursor-pointer"
          >
            {isCityDropdownOpen ? '▲' : '▼'}
          </button>
        )}

        {platformMode !== 'delivery' && isCityDropdownOpen && (
          <div className="absolute right-0 mt-28 w-40 bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl border border-slate-700 shadow-2xl max-h-60 overflow-y-auto">
            <button
              onClick={() => { props.onSelectCity?.(''); setIsCityDropdownOpen(false); }}
              className={`w-full px-4 py-2 rounded-xl text-[10px] font-bold transition-all text-right ${!selectedCity ? 'bg-emerald-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
            >
              {isRtl ? 'الكل' : 'All'}
            </button>
            {marketCityIds.map(cityId => (
              <button
                key={cityId}
                onClick={() => { props.onSelectCity?.(cityId); setIsCityDropdownOpen(false); }}
                className={`w-full px-4 py-2 rounded-xl text-[10px] font-bold transition-all text-right ${selectedCity === cityId ? 'bg-emerald-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
              >
                {marketCityCoords[cityId]?.ar || cityId}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
});

export default AdMap;
