import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Navigation, Loader2, Package } from 'lucide-react';

interface LocationMapPickerProps {
  pickupCoords: { lat: number; lng: number } | null;
  deliveryCoords: { lat: number; lng: number } | null;
  pickupAddress?: string;
  deliveryAddress?: string;
  onSetPickup: (lat: number, lng: number, address?: string) => void;
  onSetDelivery: (lat: number, lng: number, address?: string) => void;
  center: { lat: number; lng: number };
  mode: 'pickup' | 'delivery' | null;
  marketName?: string;
  onClose: () => void;
  countryCode?: string;
}

const getCleanAddressName = (address: string): string => {
  if (!address) return '';
  const parts = address.split(/[,,،]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  
  let firstPart = parts[0];
  
  if ((/^\d+$/.test(firstPart) || firstPart.length <= 3) && parts.length > 1) {
    let secondPart = parts[1];
    if ((/^\d+$/.test(secondPart) || secondPart.length <= 3) && parts.length > 2) {
      return `${parts[2]} (${secondPart})`;
    }
    return `${secondPart} (${firstPart})`;
  }
  
  return firstPart;
};

export default function LocationMapPicker({
  pickupCoords,
  deliveryCoords,
  pickupAddress,
  deliveryAddress,
  onSetPickup,
  onSetDelivery,
  center,
  mode,
  marketName,
  countryCode,
  onClose
}: LocationMapPickerProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const reverseGeocodeTimeout = useRef<any>(null);
  const userSelected = useRef(false);

  const activeCenter = mode === 'pickup' 
    ? (pickupCoords || center) 
    : (deliveryCoords || center);

  const [currentCenter, setCurrentCenter] = useState(activeCenter);

  // Set initial customAddress from parent address props if they exist
  useEffect(() => {
    if (mode === 'pickup' && pickupAddress) {
      setCustomAddress(pickupAddress);
    } else if (mode === 'delivery' && deliveryAddress) {
      setCustomAddress(deliveryAddress);
    }
  }, [mode, pickupAddress, deliveryAddress]);

  // Unified Reverse Geocoding function
  const triggerReverseGeocode = useCallback((lat: number, lng: number, immediate = false) => {
    if (reverseGeocodeTimeout.current) clearTimeout(reverseGeocodeTimeout.current);

    const performGeocode = async () => {
      setIsGeocoding(true);
      try {
        // 1. Try our high-performance backend proxy first
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout
        
        try {
          const res = await fetch(`/api/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=${isRtl ? 'ar' : 'en'}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const resData = await res.json();
            if (resData.success && resData.data && resData.data.display_name) {
              const addr = resData.data.display_name;
              const cleanAddr = getCleanAddressName(addr);
              userSelected.current = true;
              setSearchQuery(cleanAddr);
              setCustomAddress(cleanAddr);
              if (mode === 'pickup') onSetPickup(lat, lng, cleanAddr);
              else if (mode === 'delivery') onSetDelivery(lat, lng, cleanAddr);
              setIsGeocoding(false);
              return;
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn('[Proxy Reverse Geocode] Failed or timed out, trying Google Maps Geocoder:', err);
        }

        // 2. Google Maps Geocoder as secondary fallback
        if ((window as any).google?.maps) {
          const geocoder = new (window as any).google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng }, language: isRtl ? 'ar' : 'en' }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
              let address = results[0].formatted_address;
              const parts = address.split('،');
              if (parts.length > 2) address = parts.slice(0, 2).join('،');
              
              const cleanAddr = getCleanAddressName(address);
              userSelected.current = true;
              setSearchQuery(cleanAddr);
              setCustomAddress(cleanAddr);
              if (mode === 'pickup') onSetPickup(lat, lng, cleanAddr);
              else if (mode === 'delivery') onSetDelivery(lat, lng, cleanAddr);
            } else {
              // Both failed, fallback to coordinates
              if (mode === 'pickup') onSetPickup(lat, lng);
              else if (mode === 'delivery') onSetDelivery(lat, lng);
            }
            setIsGeocoding(false);
          });
        } else {
          // No Google Maps, fallback to coordinates
          if (mode === 'pickup') onSetPickup(lat, lng);
          else if (mode === 'delivery') onSetDelivery(lat, lng);
          setIsGeocoding(false);
        }
      } catch (e) {
        console.error('Reverse geocode error:', e);
        if (mode === 'pickup') onSetPickup(lat, lng);
        else if (mode === 'delivery') onSetDelivery(lat, lng);
        setIsGeocoding(false);
      }
    };

    if (immediate) {
      performGeocode();
    } else {
      setIsGeocoding(true); // Show loading feedback immediately
      reverseGeocodeTimeout.current = setTimeout(performGeocode, 600); // 600ms debounce
    }
  }, [mode, onSetPickup, onSetDelivery, isRtl]);

  // Initial geocoding on mount
  useEffect(() => {
    const startCenter = mode === 'pickup' 
      ? (pickupCoords || center) 
      : (deliveryCoords || center);
    triggerReverseGeocode(startCenter.lat, startCenter.lng, true); // Immediate execution on mount!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapDivRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const activeCenter = mode === 'pickup' 
      ? (pickupCoords || center) 
      : (deliveryCoords || center);

    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([activeCenter.lat, activeCenter.lng], 17); // High initial precision

    // Use Google Maps tiles directly (no API key needed)
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20
    }).addTo(map);

    // Removed click-to-place logic since we use a center pin now

    mapRef.current = map;

    // Fix for Leaflet blank/beige map inside animated modals
    const invalidate = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    
    const timeouts = [50, 150, 300, 500, 800].map(t => setTimeout(invalidate, t));
    
    const observer = new ResizeObserver(() => invalidate());
    observer.observe(mapDivRef.current);

    return () => {
      timeouts.forEach(clearTimeout);
      if (mapDivRef.current) observer.unobserve(mapDivRef.current);
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array so map initializes once

  // Update map center when mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    const activeCenter = mode === 'pickup' 
      ? (pickupCoords || center) 
      : (deliveryCoords || center);
      
    mapRef.current.setView([activeCenter.lat, activeCenter.lng], mapRef.current.getZoom());
  }, [mode]);

  // Live Center Pin tracking via map movement
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    const handleMoveEnd = () => {
      const center = map.getCenter();
      setCurrentCenter({ lat: center.lat, lng: center.lng });
      if (userSelected.current) {
        userSelected.current = false;
        return;
      }
      triggerReverseGeocode(center.lat, center.lng);
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [triggerReverseGeocode]);

  // Sync Markers and Path
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    markerRefs.current.forEach(m => map.removeLayer(m));
    markerRefs.current = [];

    // Clear old route
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Draw markers only for the INACTIVE mode (active mode uses the center pin)
    if (pickupCoords && mode !== 'pickup') {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px; height:20px; background:#fff; border:5px solid #3b82f6; border-radius:50%; box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const m = L.marker([pickupCoords.lat, pickupCoords.lng], { icon, interactive: false }).addTo(map);
      markerRefs.current.push(m);
    }

    if (deliveryCoords && mode !== 'delivery') {
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-size:32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });
      const m = L.marker([deliveryCoords.lat, deliveryCoords.lng], { icon, interactive: false }).addTo(map);
      markerRefs.current.push(m);
    }

    if (pickupCoords && deliveryCoords) {
      const pLat = pickupCoords.lat;
      const pLng = pickupCoords.lng;
      const dLat = deliveryCoords.lat;
      const dLng = deliveryCoords.lng;

      // Draw fallback straight line first
      const outline = L.polyline([[pLat, pLng], [dLat, dLng]], { color: '#1e40af', weight: 8, opacity: 0.5, dashArray: '10, 15', lineCap: 'round', lineJoin: 'round' });
      const inner = L.polyline([[pLat, pLng], [dLat, dLng]], { color: '#60a5fa', weight: 4, opacity: 0.8, dashArray: '10, 15', lineCap: 'round', lineJoin: 'round' });
      polylineRef.current = L.featureGroup([outline, inner]).addTo(map);

      // Fetch real road route from OSRM proxy
      const routePath = `${pLng},${pLat};${dLng},${dLat}`;
      fetch(`/api/v1/geocode/route?path=${encodeURIComponent(routePath)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((c: any[]) => [c[1], c[0]]); // Convert [lng, lat] to [lat, lng]
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

  }, [pickupCoords, deliveryCoords, mode]);

  // Geolocation
  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setCurrentCenter({ lat: latitude, lng: longitude });
        triggerReverseGeocode(latitude, longitude, true); // Immediate execution on GPS center!
        
        if (mapRef.current) {
          // Zoom level 18 for extremely precise street-level location
          mapRef.current.setView([latitude, longitude], 18, { animate: true });
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  };

  // Auto-locate user on mount if no coordinates exist
  useEffect(() => {
    if (!pickupCoords && !deliveryCoords) {
      handleMyLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live autocomplete predictions triggered only on manual input
  const autocompleteTimeout = useRef<any>(null);

  const triggerAutocomplete = (val: string) => {
    if (autocompleteTimeout.current) clearTimeout(autocompleteTimeout.current);

    const query = val.trim();
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    autocompleteTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if ((window as any).google?.maps?.places) {
          const autocomplete = new (window as any).google.maps.places.AutocompleteService();
          autocomplete.getPlacePredictions({
            input: query,
            language: isRtl ? 'ar' : 'en',
            componentRestrictions: { country: countryCode || 'jo' } // Restrict search to Jordan
          }, async (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setSearchResults(predictions.map((p: any) => ({
                place_id: p.place_id,
                display_name: p.description,
                isGoogle: true
              })));
              setIsSearching(false);
            } else {
              console.warn('[Google Autocomplete] Failed or Denied (status:', status, '), trying Nominatim proxy fallback...');
              try {
                const countryContext = marketName ? `, ${marketName}` : '';
                const queryWithCountry = `${query}${countryContext}`;
                const cc = countryCode || '';
                const searchUrl = `/api/v1/geocode/search?q=${encodeURIComponent(queryWithCountry)}&lang=${isRtl ? 'ar' : 'en'}&lat=${currentCenter.lat}&lon=${currentCenter.lng}${cc ? `&countrycodes=${cc}` : ''}`;
                const res = await fetch(searchUrl);
                const resData = await res.json();
                if (resData.success && resData.data) {
                  setSearchResults(resData.data);
                }
              } catch (err) {
                console.error('[Nominatim Autocomplete Fallback] failed:', err);
              } finally {
                setIsSearching(false);
              }
            }
          });
          return;
        }

        // Nominatim Fallback Proxy (location-aware)
        const countryContext = marketName ? `, ${marketName}` : '';
        const queryWithCountry = `${query}${countryContext}`;
        const cc = countryCode || '';
        const searchUrl = `/api/v1/geocode/search?q=${encodeURIComponent(queryWithCountry)}&lang=${isRtl ? 'ar' : 'en'}&lat=${currentCenter.lat}&lon=${currentCenter.lng}${cc ? `&countrycodes=${cc}` : ''}`;
        const res = await fetch(searchUrl);
        const resData = await res.json();
        if (resData.success && resData.data) {
          setSearchResults(resData.data);
        }
      } catch (err) {
        console.error('Live search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450); // 450ms debounce to prevent spamming APIs
  };


  // Search Address using Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      if ((window as any).google?.maps?.places) {
        const autocomplete = new (window as any).google.maps.places.AutocompleteService();
        autocomplete.getPlacePredictions({
          input: searchQuery,
          language: isRtl ? 'ar' : 'en'
        }, async (predictions: any, status: any) => {
          if (status === 'OK' && predictions) {
            setSearchResults(predictions.map((p: any) => ({
              place_id: p.place_id,
              display_name: p.description,
              isGoogle: true
            })));
            setIsSearching(false);
          } else {
            console.warn('[Google Search Autocomplete] Failed or Denied (status:', status, '), trying Nominatim proxy fallback...');
            try {
              const countryContext = marketName ? `, ${marketName}` : '';
              const queryWithCountry = `${searchQuery}${countryContext}`;
              const res = await fetch(`/api/v1/geocode/search?q=${encodeURIComponent(queryWithCountry)}&lang=${isRtl ? 'ar' : 'en'}`);
              const resData = await res.json();
              if (resData.success && resData.data) {
                setSearchResults(resData.data);
              }
            } catch (err) {
              console.error('[Nominatim Manual Search Fallback Proxy] failed:', err);
            } finally {
              setIsSearching(false);
            }
          }
        });
        return; // async callback handles it
      }

      // Nominatim Fallback Proxy (location-aware)
      const countryContext = marketName ? `, ${marketName}` : '';
      const queryWithCountry = `${searchQuery}${countryContext}`;
      const cc = countryCode || '';
      const searchUrl = `/api/v1/geocode/search?q=${encodeURIComponent(queryWithCountry)}&lang=${isRtl ? 'ar' : 'en'}&lat=${currentCenter.lat}&lon=${currentCenter.lng}${cc ? `&countrycodes=${cc}` : ''}`;
      const res = await fetch(searchUrl);
      const resData = await res.json();
      if (resData.success && resData.data) {
        setSearchResults(resData.data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      const finalAddress = customAddress.trim() || searchQuery.trim();
      if (mode === 'pickup') {
        onSetPickup(center.lat, center.lng, finalAddress);
      } else if (mode === 'delivery') {
        onSetDelivery(center.lat, center.lng, finalAddress);
      }
    }
    onClose();
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
              {isRtl ? 'انقر على الخريطة أو اسحب الدبوس لتحديد الموقع بدقة' : 'Click on the map or drag the pin to set location'}
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
                onChange={e => {
                  const val = e.target.value;
                  userSelected.current = false;
                  setSearchQuery(val);
                  triggerAutocomplete(val);
                }}
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
              <div className="mt-2 bg-[#0b0f1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (r.isGoogle) {
                        const geocoder = new (window as any).google.maps.Geocoder();
                        geocoder.geocode({ placeId: r.place_id }, (results: any, status: any) => {
                          if (status === 'OK' && results[0]) {
                            const lat = results[0].geometry.location.lat();
                            const lng = results[0].geometry.location.lng();
                            const address = r.display_name;
                            
                            setSearchResults([]);
                            setSearchQuery(address);
                            setCustomAddress(getCleanAddressName(address));
                            setCurrentCenter({ lat, lng });
                            
                            userSelected.current = true;
                            if (mapRef.current) {
                              mapRef.current.setView([lat, lng], 18, { animate: true });
                            }
                            
                            if (mode === 'pickup') onSetPickup(lat, lng, address);
                            else if (mode === 'delivery') onSetDelivery(lat, lng, address);
                          }
                        });
                        return;
                      }

                      // Nominatim Fallback logic
                      const rawLat = r.lat ?? r.latitude;
                      const rawLng = r.lon ?? r.longitude ?? r.lng;
                      const lat = parseFloat(String(rawLat));
                      const lng = parseFloat(String(rawLng));
                      
                      if (isNaN(lat) || isNaN(lng)) return;

                      setSearchResults([]);
                      const address = r.display_name || r.formatted_address;
                      setSearchQuery(address);
                      setCustomAddress(getCleanAddressName(address));
                      setCurrentCenter({ lat, lng });
                      
                      userSelected.current = true;
                      if (mapRef.current) {
                        // Zoom level 18 for extremely precise street-level location
                        mapRef.current.setView([lat, lng], 18, { animate: true });
                      }
                      
                      if (mode === 'pickup') onSetPickup(lat, lng, address);
                      else if (mode === 'delivery') onSetDelivery(lat, lng, address);
                    }}
                    className="w-full text-right p-3 hover:bg-white/5 flex items-start gap-3 border-b border-white/5 last:border-0 transition-colors group cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 group-hover:text-cyan-400 shrink-0" />
                    <div className="flex flex-col items-end min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-white truncate w-full text-right">
                        {r.name || getCleanAddressName(r.display_name || r.formatted_address)}
                      </span>
                      <span className="text-[9px] text-slate-400 line-clamp-1 w-full text-right mt-0.5">
                        {r.display_name || r.formatted_address}
                      </span>
                      {r.type && (
                        <span className="text-[8px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded mt-1 border border-cyan-500/20">
                          {r.type}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state when searching returned nothing */}
            {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 3 && !userSelected.current && (
              <div className="mt-2 bg-[#0b0f1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl text-right" dir="rtl">
                <p className="text-[10px] text-slate-400 font-bold">
                  {isRtl ? '🔍 لا توجد نتائج لهذا البحث في منطقتك.' : '🔍 No results near you for this search.'}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {isRtl
                    ? 'جرّب: اسحب الدبوس على الخريطة مباشرة، أو اضغط على زر الموقع 🎯 للذهاب لموقعك الحالي.'
                    : 'Try: drag the pin on the map directly, or tap 🎯 to jump to your current location.'}
                </p>
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
          
          {/* Fixed Center Pin Overlay */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none pb-8 flex flex-col items-center">
            {mode === 'pickup' ? (
              <div className="bg-emerald-500 text-white p-2.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-4 ring-white/90 transform origin-bottom animate-[bounce_1s_ease-in-out_infinite]">
                <Package className="w-6 h-6" />
              </div>
            ) : mode === 'delivery' ? (
              <div className="bg-rose-500 text-white p-2.5 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)] ring-4 ring-white/90 transform origin-bottom animate-[bounce_1s_ease-in-out_infinite]">
                <MapPin className="w-6 h-6" />
              </div>
            ) : null}
            <div className="w-1.5 h-1.5 bg-slate-900 rounded-full mt-1.5 opacity-80 shadow-md" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col gap-4 relative z-10">
          {/* Editable Address Field */}
          <div className="flex flex-col gap-1.5 text-right w-full" dir="rtl">
            <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 justify-end">
              <span>{isRtl ? 'اسم الموقع أو العنوان المحدد (يمكنك كتابته أو تعديله لزيادة الدقة):' : 'Custom Address Name / Description (edit to customize):'}</span>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">{isRtl ? 'قابل للتعديل ✍️' : 'Editable ✍️'}</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder={isRtl ? 'أدخل تفاصيل أكثر (مثال: شقق الياسمين، عمارة 4)' : 'Enter more details (e.g. Jasmin Apartments, Building 4)'}
                className="w-full bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 transition-all font-sans font-medium text-right outline-none"
              />
              {isGeocoding && (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin absolute left-3" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className={`flex gap-6 max-w-[70%] min-w-0 ${isRtl ? 'flex-row text-right' : 'flex-row-reverse text-left'}`}>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-slate-500 block font-bold">{isRtl ? 'نقطة الاستلام' : 'Pickup'}</span>
                {mode === 'pickup' ? (
                  <span className="text-[10.5px] font-black text-emerald-400 block truncate max-w-[200px]" title={customAddress || searchQuery || `${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}`}>
                    {customAddress || searchQuery || `${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}`}
                  </span>
                ) : (
                  <span 
                    className={`text-[10.5px] font-black ${pickupCoords ? 'text-emerald-400/70' : 'text-slate-600'} block truncate max-w-[200px]`}
                    title={pickupAddress || (pickupCoords ? `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}` : '')}
                  >
                    {pickupCoords ? (pickupAddress || `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}`) : (isRtl ? 'غير محدد' : 'Not Set')}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-slate-500 block font-bold">{isRtl ? 'نقطة التسليم' : 'Delivery'}</span>
                {mode === 'delivery' ? (
                  <span className="text-[10.5px] font-black text-rose-400 block truncate max-w-[200px]" title={customAddress || searchQuery || `${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}`}>
                    {customAddress || searchQuery || `${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)}`}
                  </span>
                ) : (
                  <span 
                    className={`text-[10.5px] font-black ${deliveryCoords ? 'text-rose-400/70' : 'text-slate-600'} block truncate max-w-[200px]`}
                    title={deliveryAddress || (deliveryCoords ? `${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}` : '')}
                  >
                    {deliveryCoords ? (deliveryAddress || `${deliveryCoords.lat.toFixed(4)}, ${deliveryCoords.lng.toFixed(4)}`) : (isRtl ? 'غير محدد' : 'Not Set')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={isGeocoding}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all shadow-lg cursor-pointer ${
                isGeocoding 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' 
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {isGeocoding 
                ? (isRtl ? 'جاري جلب العنوان... ⏳' : 'Locating... ⏳')
                : (isRtl ? 'تأكيد الموقع ✅' : 'Confirm Location ✅')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

