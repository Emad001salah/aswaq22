import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Ad } from '../types.ts';
import { getCurrencyAr } from '../markets.ts';
import { CITIES } from '../data.ts';

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
  countryCode?: string;
}

export default forwardRef<AdMapHandle, AdMapProps>(function AdMap(props, ref) {
  const {
    ads,
    selectedCity,
    onSelectAd,
    center: marketCenter,
    cityCoordinates: marketCityCoords,
    referenceCoords,
    marketCityIds,
    deliveryPreview
  } = props;

  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [forcingUserLocation, setForcingUserLocation] = useState(false);

  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');

  const mapRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  // Initial user geolocation with smooth flying transition
  useEffect(() => {
    if (navigator.geolocation && !referenceCoords) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (mapRef.current) {
            mapRef.current.flyTo([loc.lat, loc.lng], 14, {
              animate: true,
              duration: 1.5
            });
          }
        },
        err => {
          console.warn('Geolocation denied or failed:', err);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }, [referenceCoords]);

  const triggerLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setForcingUserLocation(true);
        if (mapRef.current) {
          mapRef.current.flyTo([loc.lat, loc.lng], 14, {
            animate: true,
            duration: 1.5
          });
        }
      },
      () => alert(isRtl ? 'تعذر الحصول على الموقع' : 'Could not get location'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useImperativeHandle(ref, () => ({ triggerLocation }));

  useEffect(() => {
    if (forcingUserLocation && userLocation) {
      props.onSelectCity?.('');
      setForcingUserLocation(false);
    }
  }, [forcingUserLocation, userLocation]);

  // Determine center and zoom level
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

  // 1. Initialize Leaflet map once on mount
  useEffect(() => {
    if (!mapDivRef.current) {
      setDebugInfo('Error: mapDivRef is null');
      return;
    }
    const L = (window as any).L;
    if (!L) {
      setDebugInfo('Error: window.L is undefined! Leaflet script failed to load.');
      return;
    }

    try {
      setDebugInfo(`Initializing map with center: ${mapCenter?.lat}, ${mapCenter?.lng}, zoom: ${zoom}`);
      const map = L.map(mapDivRef.current, {
        center: [mapCenter.lat, mapCenter.lng],
        zoom,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(map);

      mapRef.current = map;
      setDebugInfo('Map loaded successfully!');

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 150);

      return () => {
        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch (e) {}
          mapRef.current = null;
        }
      };
    } catch (err: any) {
      setDebugInfo(`Map Init Exception: ${err.message || err}`);
      console.error(err);
    }
  }, []);

  // 2. Sync center and zoom dynamically
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([mapCenter.lat, mapCenter.lng], zoom, { animate: true });
    }
  }, [mapCenter.lat, mapCenter.lng, zoom]);

  // 3. Update markers and overlays when ads or overlays change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    const map = mapRef.current;

    // Clear existing markers/lines
    map.eachLayer((layer: any) => {
      if (!(layer instanceof L.TileLayer) && layer._url === undefined) {
        map.removeLayer(layer);
      }
    });

    const activeAds = ads.filter(ad => ad.status?.toLowerCase() === 'active');

    // Group ads by location to prevent marker click blocking
    const adsByLocation: Map<string, Ad[]> = new Map();
    activeAds.forEach(ad => {
      const cityKey = (ad.city || '').toLowerCase();
      const matchedCity = CITIES.find(c => c.id === ad.city || c.id === cityKey || c.nameAr === ad.city);
      const lat = (Number(ad.latitude) || (ad.city && marketCityCoords[ad.city]?.lat) || (ad.city && marketCityCoords[cityKey]?.lat) || matchedCity?.lat || marketCenter.lat || 15.3694).toFixed(5);
      const lng = (Number(ad.longitude) || (ad.city && marketCityCoords[ad.city]?.lng) || (ad.city && marketCityCoords[cityKey]?.lng) || matchedCity?.lng || marketCenter.lng || 44.1910).toFixed(5);
      const key = `${lat}_${lng}`;
      if (!adsByLocation.has(key)) adsByLocation.set(key, []);
      adsByLocation.get(key)!.push(ad);
    });

    adsByLocation.forEach((locAds, key) => {
      const [bLat, bLng] = key.split('_').map(Number);
      locAds.forEach((ad, i) => {
        const offset = locAds.length > 1 ? 0.0003 : 0;
        const angle = (i / locAds.length) * 2 * Math.PI;
        const lat = bLat + (Math.sin(angle) * offset);
        const lng = bLng + (Math.cos(angle) * offset);

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#10b981;color:#020617;font-weight:900;font-size:10px;padding:4px 8px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);white-space:nowrap;cursor:pointer">${ad.price.toLocaleString()} ${getCurrencyAr(ad.currency)}${locAds.length > 1 ? ` (${i+1}/${locAds.length})` : ''}</div>`,
          iconSize: [85, 28],
          iconAnchor: [42, 14]
        });

        L.marker([lat, lng], { icon })
          .addTo(map)
          .on('click', () => onSelectAd(ad));
      });
    });

    // Reference point
    if (referenceCoords) {
      const refIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([referenceCoords.lat, referenceCoords.lng], { icon: refIcon }).addTo(map);
    }

    // Delivery preview (Pickup & Delivery)
    if (deliveryPreview?.pickup) {
      const pickupIcon = L.divIcon({
        className: '',
        html: `<div style="background:#10b981;color:#020617;font-weight:900;font-size:10px;padding:3px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">📦 ${isRtl ? 'الاستلام' : 'Pickup'}</div>`,
        iconSize: [80, 26],
        iconAnchor: [40, 13]
      });
      L.marker([deliveryPreview.pickup.lat, deliveryPreview.pickup.lng], { icon: pickupIcon }).addTo(map);
    }

    if (deliveryPreview?.delivery) {
      const delivIcon = L.divIcon({
        className: '',
        html: `<div style="background:#f43f5e;color:#020617;font-weight:900;font-size:10px;padding:3px 7px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏁 ${isRtl ? 'التسليم' : 'Delivery'}</div>`,
        iconSize: [80, 26],
        iconAnchor: [40, 13]
      });
      L.marker([deliveryPreview.delivery.lat, deliveryPreview.delivery.lng], { icon: delivIcon }).addTo(map);
    }

    if (deliveryPreview?.pickup && deliveryPreview?.delivery) {
      L.polyline(
        [[deliveryPreview.pickup.lat, deliveryPreview.pickup.lng], [deliveryPreview.delivery.lat, deliveryPreview.delivery.lng]],
        { color: '#06b6d4', dashArray: '6,10', weight: 3, opacity: 0.85 }
      ).addTo(map);
    }

    if (deliveryPreview?.driver) {
      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="background:#06b6d4;color:#020617;font-size:18px;width:36px;height:36px;border-radius:50%;border:2px solid #020617;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5)">🛵</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      L.marker([deliveryPreview.driver.lat, deliveryPreview.driver.lng], { icon: driverIcon }).addTo(map);
    }
    // User's current location marker (Blue pulsing dot)
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-loc-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full shadow-lg z-10"></div>
            <div class="absolute w-8 h-8 bg-blue-500 rounded-full opacity-40 animate-ping"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(isRtl ? 'أنت هنا 📍' : 'You are here 📍');
    }

  }, [ads, referenceCoords, deliveryPreview, userLocation]);

  return (
    <div className="w-full h-full relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-0" style={{ minHeight: '350px' }}>
      <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} />

      {/* Overlay controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={triggerLocation}
          className="p-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-all cursor-pointer"
          title={isRtl ? 'موقعي' : 'My Location'}
        >
          📍
        </button>

        <button
          onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
          className="w-12 h-12 flex items-center justify-center bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 text-white shadow-2xl hover:bg-slate-800 transition-all font-black text-lg cursor-pointer"
        >
          {isCityDropdownOpen ? '▲' : '▼'}
        </button>

        {isCityDropdownOpen && (
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

      {/* Debug Info Overlay */}
      <div className="absolute bottom-2 left-2 z-[2000] bg-slate-950/90 text-white font-mono text-[9px] px-2 py-1 rounded border border-white/10 pointer-events-none max-w-[90%] break-all">
        {debugInfo}
      </div>
    </div>
  );
});
