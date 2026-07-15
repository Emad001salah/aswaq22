import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';

interface LocationMapPickerProps {
  pickupCoords: { lat: number; lng: number } | null;
  deliveryCoords: { lat: number; lng: number } | null;
  onSetPickup: (lat: number, lng: number) => void;
  onSetDelivery: (lat: number, lng: number) => void;
  center: { lat: number; lng: number };
  mode: 'pickup' | 'delivery' | null;
  onClose: () => void;
}

export default function LocationMapPicker({
  pickupCoords,
  deliveryCoords,
  onSetPickup,
  onSetDelivery,
  center,
  mode,
  onClose
}: LocationMapPickerProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // 1. Initialize Map once on mount
  useEffect(() => {
    if (!mapDivRef.current) return;
    const L = (window as any).L;
    if (!L) {
      console.error('Leaflet is not loaded on window.');
      return;
    }

    const map = L.map(mapDivRef.current, {
      center: [center.lat, center.lng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    map.on('click', (e: any) => {
      // Execute parent callback depending on mode
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      if (mode === 'pickup') {
        onSetPickup(lat, lng);
      } else if (mode === 'delivery') {
        onSetDelivery(lat, lng);
      }
    });

    mapRef.current = map;

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
  }, [mode]); // Reinitialize click handler binding when mode changes

  // 2. Update markers and polyline when coordinates change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    markerRefs.current.forEach(m => map.removeLayer(m));
    markerRefs.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (pickupCoords) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:#10b981;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">📦</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const m = L.marker([pickupCoords.lat, pickupCoords.lng], { icon }).addTo(map);
      markerRefs.current.push(m);
    }

    if (deliveryCoords) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:#f43f5e;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const m = L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon }).addTo(map);
      markerRefs.current.push(m);
    }

    if (pickupCoords && deliveryCoords) {
      polylineRef.current = L.polyline(
        [[pickupCoords.lat, pickupCoords.lng], [deliveryCoords.lat, deliveryCoords.lng]],
        { color: '#0ea5e9', weight: 4, opacity: 0.8 }
      ).addTo(map);
    }
  }, [pickupCoords, deliveryCoords]);

  // Search using Nominatim (OpenStreetMap free geocoding)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=${isRtl ? 'ar' : 'en'}`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        if (mode === 'pickup') onSetPickup(latitude, longitude);
        else if (mode === 'delivery') onSetDelivery(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 14, { animate: true });
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm pt-4 sm:pt-0">
      <div className="bg-slate-900 w-full max-w-4xl h-[82vh] sm:h-[80vh] rounded-[2rem] sm:rounded-3xl overflow-hidden border border-slate-800 flex flex-col relative shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="text-sm font-black text-white">
              {mode === 'pickup'
                ? (isRtl ? 'تحديد نقطة الاستلام 📦' : 'Set Pickup Location 📦')
                : (isRtl ? 'تحديد نقطة التسليم 📍' : 'Set Delivery Location 📍')}
            </h3>
            <p className="text-[10px] text-slate-400">
              {isRtl ? 'انقر على الخريطة لتحديد الموقع' : 'Click on the map to set location'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-grow relative z-0 bg-slate-950" style={{ minHeight: '300px' }}>
          <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />

          {/* Search bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[1000]">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث عن موقع...' : 'Search for location...'}
                className="w-full bg-[#0b0f1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl py-3.5 px-12 text-xs text-white placeholder:text-slate-500 shadow-2xl focus:border-cyan-500/50 outline-none transition-all"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400" />
              {isSearching
                ? <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                : <button type="submit" className="absolute left-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-lg text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer">
                    <Navigation className="w-3.5 h-3.5 rotate-45" />
                  </button>
              }
            </form>

            {searchResults.length > 0 && (
              <div className="mt-2 bg-[#0b0f1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                      if (mode === 'pickup') onSetPickup(lat, lng);
                      else if (mode === 'delivery') onSetDelivery(lat, lng);
                      setSearchResults([]);
                      setSearchQuery(r.display_name);
                      if (mapRef.current) {
                        mapRef.current.setView([lat, lng], 14, { animate: true });
                      }
                    }}
                    className="w-full text-right p-3 hover:bg-white/5 flex items-start gap-3 border-b border-white/5 last:border-0 transition-colors group cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 group-hover:text-cyan-400 shrink-0" />
                    <span className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* My Location button */}
          <button
            onClick={handleMyLocation}
            disabled={isLocating}
            className="absolute bottom-6 right-6 z-[1000] w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {isLocating
              ? <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
              : <Navigation className="w-5 h-5 text-cyan-600" />
            }
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-4 relative z-10">
          <div className={`flex gap-4 ${isRtl ? 'flex-row text-right' : 'flex-row-reverse text-left'}`}>
            <div>
              <span className="text-[9px] text-slate-500 block">{isRtl ? 'نقطة الاستلام' : 'Pickup'}</span>
              <span className={`text-[10px] font-bold ${pickupCoords ? 'text-emerald-400' : 'text-slate-600'}`}>
                {pickupCoords ? `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}` : (isRtl ? 'غير محدد' : 'Not Set')}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">{isRtl ? 'نقطة التسليم' : 'Delivery'}</span>
              <span className={`text-[10px] font-bold ${deliveryCoords ? 'text-rose-400' : 'text-slate-600'}`}>
                {deliveryCoords ? `${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}` : (isRtl ? 'غير محدد' : 'Not Set')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black transition-all shadow-lg cursor-pointer"
          >
            {isRtl ? 'تأكيد الإحداثيات ✅' : 'Confirm ✅'}
          </button>
        </div>
      </div>
    </div>
  );
}
