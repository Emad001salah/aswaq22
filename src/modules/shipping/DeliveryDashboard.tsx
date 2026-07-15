import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ORIGIN } from '../../lib/config';
import { 
  MapPin, 
  Loader2, 
  ShieldCheck, 
  Wallet, 
  Send, 
  Star, 
  ChevronDown, 
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageCircle,
  Share2,
  Settings,
  Activity,
  Trash2
} from 'lucide-react';
import AdMap from '../maps/AdMap.tsx';
import LocationMapPicker from '../maps/LocationMapPicker.tsx';
import socket, { joinRoom } from '../../lib/socket.ts';
import { Ad } from '../../types.ts';

interface DeliveryDashboardProps {
  currentUser: any;
  currentMarket: any;
  isRtl: boolean;
  addToast: (title: string, desc: string, type: any) => void;
  ads: any[];
  setAds: React.Dispatch<React.SetStateAction<any[]>>;
  setFilteredAds: React.Dispatch<React.SetStateAction<any[]>>;
}

const getCleanAddressName = (address: string): string => {
  if (!address) return '';
  // Split on either English comma or Arabic comma
  const parts = address.split(/[,,،]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  
  let firstPart = parts[0];
  
  // If the first part is just a number (building number/postcode) or too short (e.g. less than 3 chars),
  // and we have more parts, let's combine it with the next part (usually the street or district)
  if ((/^\d+$/.test(firstPart) || firstPart.length <= 3) && parts.length > 1) {
    let secondPart = parts[1];
    if ((/^\d+$/.test(secondPart) || secondPart.length <= 3) && parts.length > 2) {
      return `${parts[2]} (${secondPart})`;
    }
    return `${secondPart} (${firstPart})`;
  }
  
  return firstPart;
};

export default function DeliveryDashboard({
  currentUser,
  currentMarket,
  isRtl,
  addToast,
  ads,
  setAds,
  setFilteredAds
}: DeliveryDashboardProps) {
  const { t } = useTranslation();

  // Shipments loaded from the backend API
  const [shipments, setShipments] = useState<any[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);

  // Wizard / Stepper state
  // 0: Select Locations, 1: Cargo details, 2: Vehicle & Cost, 3: Dispatch & Tracking
  const [wizardStep, setWizardStep] = useState<number>(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('scooter');
  const [devModeEnabled, setDevModeEnabled] = useState<boolean>(false);

  // Form states
  const [shipCategory, setShipCategory] = useState<'parcel' | 'food' | 'heavy' | 'shuttle'>('parcel');
  const [shipTitle, setShipTitle] = useState('');
  const [shipFrom, setShipFrom] = useState<string>('');
  const [shipTo, setShipTo] = useState<string>('');
  const [shipWeight, setShipWeight] = useState<number>(5);
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  // Map Picker State
  const [pickupCoords, setPickupCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState<'pickup' | 'delivery' | null>(null);

  // Active Shipment tracking
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [liveDriverCoords, setLiveDriverCoords] = useState<{ lat: number, lng: number } | null>(null);

  // Driver details (mock/local statistics tracking)
  const [driverBalance, setDriverBalance] = useState<number>(() => {
    const saved = localStorage.getItem('aswaq_driver_balance');
    return saved ? parseInt(saved) : 0;
  });

  // Diagnostics simulator state
  const [testSimStep, setTestSimStep] = useState<number>(0); 
  const [testSimLogs, setTestSimLogs] = useState<string[]>(['[رادار الـ GPS] جاهز لتلقي طلبات الشحن...']);
  const [testSimProgress, setTestSimProgress] = useState(0);

  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  // Fetch real nearby drivers based on active center or selected pickup location
  useEffect(() => {
    const lat = pickupCoords?.lat || currentMarket.center.lat;
    const lng = pickupCoords?.lng || currentMarket.center.lng;
    
    fetch(`/api/v1/shipping/agents/nearby?lat=${lat}&lng=${lng}&radius=15`)
      .then(res => res.json())
      .then(resData => {
        if (resData.success && Array.isArray(resData.data)) {
          setNearbyDrivers(resData.data);
        }
      })
      .catch(err => console.error('Failed to fetch nearby drivers:', err));
  }, [pickupCoords, currentMarket.center]);

  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const startLiveGpsTracking = () => {
    if (!navigator.geolocation) {
      addToast(
        isRtl ? "موقع غير متوفر ⚠️" : "Geolocation unavailable ⚠️",
        isRtl ? "متصفحك لا يدعم تتبع الموقع الجغرافي." : "Your browser does not support geolocation tracking.",
        "error"
      );
      return;
    }

    setIsLiveTracking(true);
    setTestSimLogs(prev => [...prev, '[نظام GPS] تم بدء التتبع الميداني الحي (watchPosition)...']);

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLiveDriverCoords({ lat: latitude, lng: longitude });
        setTestSimLogs(prev => [...prev, `[نظام GPS] إحداثيات من الحساس: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`]);

        // Upload location to the server
        const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
        if (token) {
          try {
            await fetch('/api/v1/shipments/agent/location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ lat: latitude, lng: longitude })
            });
          } catch (err: any) {
            console.error('Failed to post location to server:', err.message);
          }
        }
      },
      (error) => {
        console.error('GPS Watch error:', error);
        setTestSimLogs(prev => [...prev, `[نظام GPS] خطأ في تحديد الموقع: ${error.message}`]);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );

    setWatchId(id);
  };

  const stopLiveGpsTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsLiveTracking(false);
    setTestSimLogs(prev => [...prev, '[نظام GPS] تم إيقاف التتبع الميداني.']);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Load shipments on mount
  const fetchShipments = async () => {
    if (!currentUser) return;
    setLoadingShipments(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/v1/shipments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setShipments(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch shipments', err);
    } finally {
      setLoadingShipments(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [currentUser]);

  // Connect WebSockets for driver location tracking
  useEffect(() => {
    if (activeShipmentId) {
      joinRoom(activeShipmentId);

      const handleLocationUpdate = (coords: { lat: number, lng: number }) => {
        console.log('[Socket] Received driver location update:', coords);
        setLiveDriverCoords(coords);
        setTestSimLogs(prev => [...prev, `[رادار GPS] إحداثيات السائق المحدثة: (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`]);
      };

      socket.on('driver-location-update', handleLocationUpdate);

      return () => {
        socket.off('driver-location-update', handleLocationUpdate);
      };
    }
  }, [activeShipmentId]);

  // Haversine formula to compute geodesic distance in KM
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculatedDistanceKm = useMemo(() => {
    if (pickupCoords && deliveryCoords) {
      return calculateDistance(pickupCoords.lat, pickupCoords.lng, deliveryCoords.lat, deliveryCoords.lng);
    }
    return 0;
  }, [pickupCoords, deliveryCoords]);

  // Vehicle data selection list
  const VEHICLES = useMemo(() => [
    { id: 'bike', labelAr: 'دراجة هوائية 🚲', labelEn: 'Bicycle 🚲', multiplier: 0.8, eta: '15-20 دقيقة' },
    { id: 'scooter', labelAr: 'سكوتر 🛵', labelEn: 'Scooter 🛵', multiplier: 1.0, eta: '10-15 دقيقة' },
    { id: 'car', labelAr: 'سيارة اقتصادية 🚗', labelEn: 'Economy Car 🚗', multiplier: 1.5, eta: '8-12 دقيقة' },
    { id: 'van', labelAr: 'فان توصيل 🚐', labelEn: 'Delivery Van 🚐', multiplier: 2.2, eta: '20-30 دقيقة' },
    { id: 'truck', labelAr: 'شاحنة نقل 🚚', labelEn: 'Cargo Truck 🚚', multiplier: 3.5, eta: '30-45 دقيقة' }
  ], []);

  // Pricing calculation helper based on distance & weight
  const baseCost = useMemo(() => {
    if (calculatedDistanceKm > 0) {
      return calculatedDistanceKm * 800; // 800 JOD per km base
    }
    return shipFrom !== shipTo ? 11000 : 2000;
  }, [calculatedDistanceKm, shipFrom, shipTo]);

  const autoCalculatedCost = useMemo(() => {
    const rawCost = baseCost + (shipWeight * 300);
    const vehicleMultiplier = VEHICLES.find(v => v.id === selectedVehicleId)?.multiplier || 1.0;
    return Math.round(rawCost * vehicleMultiplier);
  }, [baseCost, shipWeight, selectedVehicleId, VEHICLES]);

  const finalPrice = isManualPrice && customPrice ? Number(customPrice) : autoCalculatedCost;

  // Handles publishing a new order via the backend shipment creation
  const handlePublishOrder = async () => {
    if (!currentUser) {
      addToast(
        isRtl ? "مطلوب تسجيل الدخول ⚠️" : "Login Required ⚠️",
        isRtl ? "يرجى تسجيل الدخول أولاً لإرسال طلبات التوصيل." : "Please log in first to submit delivery requests.",
        "warning"
      );
      return;
    }

    if (isManualPrice && !customPrice) {
      addToast(
        "خطأ في السعر ⚠️",
        "يرجى إدخال المبلغ المطلوب للتوصيل في الحقل اليدوي للمتابعة.",
        "error"
      );
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const orderTitle = shipTitle || `شحن ${shipCategory === 'parcel' ? 'طرد' : 'بضائع'}`;
      
      const simulatedAd: Ad = {
        id: `sim_del_${Date.now()}`,
        title: orderTitle,
        description: `طرد شحن عاجل للتوصيل من ${shipFrom} إلى ${shipTo} بوزن ${shipWeight} كجم باستخدام ${VEHICLES.find(v => v.id === selectedVehicleId)?.labelAr}.`,
        price: finalPrice,
        currency: currentMarket.currency,
        category: 'services',
        status: 'active',
        city: shipFrom,
        latitude: pickupCoords?.lat || currentMarket.cityCoordinates[shipFrom]?.lat || currentMarket.center.lat,
        longitude: pickupCoords?.lng || currentMarket.cityCoordinates[shipFrom]?.lng || currentMarket.center.lng,
        images: [],
        createdAt: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        views: 0,
        likes: 0,
        isFeatured: false,
        contactNumber: currentUser.phone || '0000000'
      };

      setAds(prev => [simulatedAd, ...prev]);
      setFilteredAds(prev => [simulatedAd, ...prev]);

      addToast(
        "تم إرسال الطلب بنجاح! 🚀",
        "تم تسجيل طلبك وجاري البحث عن كابتن شحن بالقرب منك.",
        "success"
      );
      
      setTestSimStep(1);
      setTestSimLogs(prev => [...prev, `[الخطوة 1] تم نشر طلب الشحن بنجاح برقم: ${simulatedAd.id}`]);
      
      // Auto-advance to Dispatch/Tracking view step
      setWizardStep(3);
      fetchShipments();

    } catch (err: any) {
      console.error(err);
      addToast("فشل نشر الطلب", err.message || "فشلت العملية", "error");
    }
  };

  // Diagnostics simulators
  const simulateDriverAccept = () => {
    setTestSimStep(2);
    setTestSimLogs(prev => [...prev, '[الخطوة 2] تم قبول طلب الشحن من الكابتن (سند اليماني) 🛵 وجاري التوجه لموقع الاستلام.']);
  };

  const simulateTransitRoute = () => {
    setTestSimStep(3);
    setTestSimProgress(0);
    setActiveShipmentId(`sim_ship_${Date.now()}`);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setTestSimProgress(progress);
      
      const pLat = pickupCoords?.lat || currentMarket.cityCoordinates[shipFrom]?.lat || currentMarket.center.lat;
      const pLng = pickupCoords?.lng || currentMarket.cityCoordinates[shipFrom]?.lng || currentMarket.center.lng;
      const dLat = deliveryCoords?.lat || currentMarket.cityCoordinates[shipTo]?.lat || currentMarket.center.lat;
      const dLng = deliveryCoords?.lng || currentMarket.cityCoordinates[shipTo]?.lng || currentMarket.center.lng;

      const currentLat = pLat + (dLat - pLat) * (progress / 100);
      const currentLng = pLng + (dLng - pLng) * (progress / 100);
      
      setLiveDriverCoords({ lat: currentLat, lng: currentLng });
      setTestSimLogs(prev => [...prev, `[محاكاة GPS] الكابتن يتحرك: (${currentLat.toFixed(5)}, ${currentLng.toFixed(5)})`]);

      if (progress >= 100) {
        clearInterval(interval);
        setTestSimStep(4);
        setTestSimLogs(prev => [...prev, '[الخطوة 3] المندوب وصل لموقع التسليم النهائي بنجاح! 🏁 بانتظار OTP التحقق.']);
      }
    }, 1200);
  };

  const simulatePayoutAndRating = () => {
    setTestSimStep(0);
    setLiveDriverCoords(null);
    setActiveShipmentId(null);
    setDriverBalance(prev => prev + finalPrice);
    localStorage.setItem('aswaq_driver_balance', (driverBalance + finalPrice).toString());

    addToast(
      "اكتمل التوصيل بنجاح! 🏆",
      `تم إدخال OTP التحقق بنجاح. تم تحويل المستحقات المالية (${finalPrice} ${currentMarket.currency}) لمحفظة المندوب.`,
      "success"
    );
    setTestSimLogs(prev => [...prev, `[الخطوة 4] تم التحقق من التسوية المالية وإكمال الشحنة. الرصيد المضاف: +${finalPrice}`]);
    
    // Auto return to first step for another booking
    setWizardStep(0);
  };

  const currentVehicleInfo = useMemo(() => {
    return VEHICLES.find(v => v.id === selectedVehicleId);
  }, [selectedVehicleId, VEHICLES]);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 sm:pb-24 font-sans">
      
      {/* Delivery Map Picker Modal */}
      {isPickingLocation && (
        <LocationMapPicker
          pickupCoords={pickupCoords}
          deliveryCoords={deliveryCoords}
          pickupAddress={pickupCoords ? shipFrom : undefined}
          deliveryAddress={deliveryCoords ? shipTo : undefined}
          onSetPickup={(lat, lng, address) => {
            setPickupCoords({ lat, lng });
            if (address) {
              setShipFrom(getCleanAddressName(address));
            } else {
              setShipFrom(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
          }}
          onSetDelivery={(lat, lng, address) => {
            setDeliveryCoords({ lat, lng });
            if (address) {
              setShipTo(getCleanAddressName(address));
            } else {
              setShipTo(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
          }}
          center={currentMarket.center}
          marketName={currentMarket.labelAr}
          mode={isPickingLocation}
          countryCode={currentMarket.countryCode}
          onClose={() => setIsPickingLocation(null)}
        />
      )}

      {/* Main Delivery Layout - Sleek Dark Glassmorphism */}
      <div className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/5 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl space-y-8 my-6 relative overflow-hidden">
        {/* Soft background ambient glows */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Header Title with Dev Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-6 gap-4 relative z-10">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20 shadow-inner">🚚</span>
              {t('app.delivery.deliveryTitle') || (isRtl ? 'خدمة الشحن والتوصيل الفوري' : 'Express Cargo & Delivery')}
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              {t('app.delivery.deliverySubtitle') || (isRtl ? 'احجز مندوباً لتوصيل طرودك وتتبع حركته مباشرة خطوة بخطوة.' : 'Book a courier to ship your packages and track them live on the map.')}
            </p>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={() => setDevModeEnabled(!devModeEnabled)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                devModeEnabled 
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/5' 
                  : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Settings size={14} className={devModeEnabled ? 'animate-spin' : ''} />
              <span>{isRtl ? 'أدوات المحاكاة (QA)' : 'QA Simulator'}</span>
            </button>
            <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-2xl font-mono tracking-wider uppercase">
              GPS Active
            </span>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="max-w-2xl mx-auto py-2 relative z-10">
          <div className="flex items-center justify-between relative px-2">
            {/* Step lines backdrops */}
            <div className="absolute left-6 right-6 top-5 h-0.5 bg-slate-800/80 rounded-full -z-10"></div>
            <div 
              className="absolute left-6 top-5 h-0.5 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full -z-10 transition-all duration-500"
              style={{ width: `${(wizardStep / 3) * 92}%` }}
            ></div>
            
            {/* Step 1 indicator */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => setWizardStep(0)} 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all cursor-pointer ${
                  wizardStep >= 0 
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/35 scale-105' 
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                {wizardStep > 0 ? '✓' : '1'}
              </button>
              <span className={`text-[10px] font-black tracking-tight ${wizardStep >= 0 ? 'text-white' : 'text-slate-500'}`}>
                {isRtl ? 'الموقع' : 'Location'}
              </span>
            </div>

            {/* Step 2 indicator */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => { if (pickupCoords && deliveryCoords) setWizardStep(1); }} 
                disabled={!pickupCoords || !deliveryCoords}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all ${
                  wizardStep >= 1 
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/35 scale-105 cursor-pointer' 
                    : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {wizardStep > 1 ? '✓' : '2'}
              </button>
              <span className={`text-[10px] font-black tracking-tight ${wizardStep >= 1 ? 'text-white' : 'text-slate-500'}`}>
                {isRtl ? 'الحمولة' : 'Details'}
              </span>
            </div>

            {/* Step 3 indicator */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => { if (pickupCoords && deliveryCoords && shipTitle) setWizardStep(2); }} 
                disabled={!pickupCoords || !deliveryCoords || !shipTitle}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all ${
                  wizardStep >= 2 
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/35 scale-105 cursor-pointer' 
                    : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {wizardStep > 2 ? '✓' : '3'}
              </button>
            <span className={`text-[10px] font-black tracking-tight ${wizardStep >= 2 ? 'text-white' : 'text-slate-500'}`}>
              {isRtl ? 'التسعير' : 'Vehicle'}
            </span>
          </div>
 
          {/* Step 4 indicator */}
          <div className="flex flex-col items-center gap-2">
            <div 
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all ${
                wizardStep >= 3 
                  ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/35 scale-105' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              4
            </div>
            <span className={`text-[10px] font-black tracking-tight ${wizardStep >= 3 ? 'text-white' : 'text-slate-500'}`}>
              {isRtl ? 'التتبع' : 'Tracking'}
            </span>
          </div>
        </div>
      </div>
 
      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 relative z-10">
        
        {/* Left Column: Form & Stepper Contents */}
        <div className="bg-[#0f1422]/90 backdrop-blur-md p-4 sm:p-6 rounded-3xl border border-white/5 flex flex-col justify-between min-h-[420px] shadow-xl">
          
          {/* Step 0: Locations Selection */}
          {wizardStep === 0 && (
            <div className="space-y-6 animate-fadeIn flex-grow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">{isRtl ? 'الخطوة 1: مسار التوصيل' : 'Step 1: Route Setup'}</h4>
                  <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold">Address</span>
                </div>
                
                {/* Uber-Style Route Selector Box */}
                <div className="relative bg-[#080b12] border border-white/5 p-3 sm:p-4 rounded-2xl flex flex-col gap-4">
                  {/* Vertical line indicator */}
                  <div className="absolute right-6 sm:right-7 top-10 bottom-10 w-0.5 bg-gradient-to-b from-emerald-500 to-rose-500 pointer-events-none"></div>
 
                  {/* Pickup Field */}
                  <div className="relative flex items-center gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-400 font-bold z-10 shrink-0">
                      ●
                    </div>
                    <div className="flex-1 text-right">
                      <label className="block text-[9px] text-slate-500 font-black mb-1">{isRtl ? 'نقطة الاستلام (Pickup):' : 'Pickup Address:'}</label>
                      <button
                        type="button"
                        onClick={() => setIsPickingLocation('pickup')}
                        className={`w-full flex items-center justify-between bg-slate-900/50 border rounded-xl px-3 py-2.5 text-[11px] sm:text-xs text-right cursor-pointer transition-all ${
                          pickupCoords ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <span className="truncate font-medium text-right dir-rtl">{pickupCoords ? shipFrom : (isRtl ? 'انقر لتحديد موقع الاستلام على الخريطة...' : 'Choose pickup...')}</span>
                        <MapPin size={14} className={pickupCoords ? 'text-emerald-400 animate-pulse shrink-0 ml-2' : 'text-slate-500 shrink-0 ml-2'} />
                      </button>
                    </div>
                  </div>
 
                  {/* Destination Field */}
                  <div className="relative flex items-center gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-[10px] text-rose-400 font-bold z-10 shrink-0">
                      ■
                    </div>
                    <div className="flex-1 text-right">
                      <label className="block text-[9px] text-slate-500 font-black mb-1">{isRtl ? 'وجهة التسليم (Destination):' : 'Drop-off Address:'}</label>
                      <button
                        type="button"
                        onClick={() => setIsPickingLocation('delivery')}
                        className={`w-full flex items-center justify-between bg-slate-900/50 border rounded-xl px-3 py-2.5 text-[11px] sm:text-xs text-right cursor-pointer transition-all ${
                          deliveryCoords ? 'border-rose-500/30 text-rose-400 bg-rose-500/5' : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <span className="truncate font-medium text-right dir-rtl">{deliveryCoords ? shipTo : (isRtl ? 'انقر لتحديد وجهة التوصيل على الخريطة...' : 'Choose destination...')}</span>
                        <MapPin size={14} className={deliveryCoords ? 'text-rose-400 animate-pulse shrink-0 ml-2' : 'text-slate-500 shrink-0 ml-2'} />
                      </button>
                    </div>
                  </div>
                </div>

                  {calculatedDistanceKm > 0 && (
                    <div className="p-4 bg-cyan-950/20 border border-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-between text-xs animate-fadeIn font-semibold">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        {isRtl ? 'مسافة المسار الجغرافي المستقيمة:' : 'Estimated direct route distance:'}
                      </span>
                      <span className="font-black font-sans text-sm tracking-tight">{calculatedDistanceKm.toFixed(2)} كم</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    disabled={!pickupCoords || !deliveryCoords}
                    onClick={() => setWizardStep(1)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-2 transition-all hover:scale-102 active:scale-98 shadow-lg shadow-cyan-500/20"
                  >
                    <span>{isRtl ? 'المتابعة لتفاصيل الشحنة' : 'Continue to Details'}</span>
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Cargo Details */}
            {wizardStep === 1 && (
              <div className="space-y-6 animate-fadeIn flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">{isRtl ? 'الخطوة 2: معلومات الشحنة' : 'Step 2: Cargo Details'}</h4>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold">Cargo</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1.5">{isRtl ? 'وصف الحمولة / اسم الشحنة:' : 'What are you shipping?'}</label>
                      <input
                        type="text"
                        value={shipTitle}
                        onChange={(e) => setShipTitle(e.target.value)}
                        placeholder={isRtl ? 'مثال: علبة أدوات طبية، وثائق عمل، طرد سريع...' : 'e.g. business documents, medical package...'}
                        className="w-full bg-[#080b12] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-2">{isRtl ? 'صنف الشحنة:' : 'Category:'}</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { id: 'parcel', label: isRtl ? 'طرد بريدي 📦' : 'Parcel 📦' },
                          { id: 'food', label: isRtl ? 'طعام وجبات 🍕' : 'Meals 🍕' },
                          { id: 'heavy', label: isRtl ? 'بضائع ثقيلة 🚚' : 'Heavy Cargo 🚚' },
                          { id: 'shuttle', label: isRtl ? 'توصيل ركاب 🛵' : 'Passenger 🛵' }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setShipCategory(cat.id as any)}
                            className={`py-3 px-2 text-center rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                              shipCategory === cat.id 
                                ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/5' 
                                : 'bg-[#080b12] border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[10px] text-slate-400 font-bold">{isRtl ? 'الوزن التقريبي للطلب:' : 'Approximate Weight:'}</label>
                        <span className="text-xs text-cyan-400 font-black font-sans bg-cyan-500/10 px-2.5 py-0.5 rounded-full">{shipWeight} {isRtl ? 'كجم' : 'kg'}</span>
                      </div>
                      <div className="relative py-2">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={shipWeight}
                          onChange={(e) => setShipWeight(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#080b12] rounded-full appearance-none cursor-pointer accent-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(0)}
                    className="bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-xs px-5 py-3 rounded-2xl cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight size={16} />
                    <span>{isRtl ? 'رجوع' : 'Back'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!shipTitle.trim()}
                    onClick={() => setWizardStep(2)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-2 transition-all hover:scale-102 active:scale-98 shadow-lg shadow-cyan-500/20"
                  >
                    <span>{isRtl ? 'اختيار وسيلة النقل' : 'Select Vehicle'}</span>
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Vehicle & Cost */}
            {wizardStep === 2 && (
              <div className="space-y-6 animate-fadeIn flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">{isRtl ? 'الخطوة 3: التسعير والنقل' : 'Step 3: Rates & Options'}</h4>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold">Rates</span>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">{isRtl ? 'اختر فئة كابتن النقل المناسبة:' : 'Select delivery option:'}</label>
                    
                    {/* Careem/Uber-Style Vehicles List */}
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {VEHICLES.map(vehicle => {
                        const estimatedRate = Math.round((baseCost + shipWeight * 300) * vehicle.multiplier);
                        const isSelected = selectedVehicleId === vehicle.id;
                        return (
                          <button
                            key={vehicle.id}
                            type="button"
                            onClick={() => setSelectedVehicleId(vehicle.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl border text-right transition-all cursor-pointer hover:bg-[#0e1424] ${
                              isSelected
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-500/5'
                                : 'bg-[#080b12] border-white/5 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Large Emoji Badge */}
                              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg border border-white/5 shadow-inner">
                                {vehicle.id === 'bike' ? '🚲' : vehicle.id === 'scooter' ? '🛵' : vehicle.id === 'car' ? '🚗' : vehicle.id === 'van' ? '🚐' : '🚚'}
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black block text-white">{isRtl ? vehicle.labelAr : vehicle.labelEn}</span>
                                <span className="text-[8px] text-slate-500 block mt-0.5">{isRtl ? 'وقت التوصيل المقدر:' : 'Delivery ETA:'} {vehicle.eta}</span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-cyan-400 font-mono bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                              {estimatedRate.toLocaleString()} {currentMarket.currency}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Pricing Pill Slider */}
                    <div className="grid grid-cols-2 gap-1 bg-[#080b12] p-1 rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setIsManualPrice(false)}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          !isManualPrice 
                            ? 'bg-cyan-500 text-slate-950 shadow-md' 
                            : 'text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        {isRtl ? 'تقدير ذكي تلقائي 🤖' : 'Auto Fare 🤖'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsManualPrice(true)}
                        className={`py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          isManualPrice 
                            ? 'bg-cyan-500 text-slate-950 shadow-md' 
                            : 'text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        {isRtl ? 'تحديد سعر يدوي ✍️' : 'Custom Fare ✍️'}
                      </button>
                    </div>

                    {isManualPrice ? (
                      <div className="bg-[#080b12] p-3.5 rounded-2xl border border-white/5 space-y-1.5 animate-fadeIn">
                        <label className="text-[9px] text-slate-500 font-bold block">{isRtl ? 'أدخل الأجرة المقترحة التي تود دفعها:' : 'Offer your delivery fare:'}</label>
                        <div className="relative flex items-center">
                          <input 
                            type="number"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-4 text-sm text-cyan-400 font-black outline-none focus:border-cyan-500/30"
                          />
                          <span className="absolute left-3 text-[10px] font-black text-slate-500">{currentMarket.currency}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-cyan-950/20 border border-cyan-500/10 rounded-2xl flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">{isRtl ? 'إجمالي الأجرة المتوقعة والضمان:' : 'Total Calculated Fare:'}</span>
                        <span className="text-cyan-400 font-black text-sm font-sans">{finalPrice.toLocaleString()} {currentMarket.currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-xs px-5 py-3 rounded-2xl cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <ChevronRight size={16} />
                    <span>{isRtl ? 'رجوع' : 'Back'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishOrder}
                    className="bg-gradient-to-l from-cyan-500 to-emerald-500 hover:opacity-90 text-slate-950 font-black text-xs px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-2 transition-all hover:scale-102 active:scale-98 shadow-lg shadow-cyan-500/20"
                  >
                    <Send size={12} />
                    <span>{isRtl ? 'تأكيد وحجز التوصيل الآن 🚀' : 'Confirm & Request Driver 🚀'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Dispatch & Tracking */}
            {wizardStep === 3 && (
              <div className="space-y-6 animate-fadeIn flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">{isRtl ? 'الخطوة 4: رادار المندوب' : 'Step 4: Dispatch Board'}</h4>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold animate-pulse">Live</span>
                  </div>

                  {/* Tracking View States */}
                  {testSimStep <= 1 ? (
                    /* Searching View */
                    <div className="py-10 flex flex-col items-center justify-center space-y-6 text-center animate-fadeIn">
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        <span className="absolute inset-0 rounded-3xl border border-cyan-500/10 animate-ping"></span>
                        <span className="absolute inset-3 rounded-2xl border border-cyan-500/20 animate-pulse"></span>
                        <span className="absolute inset-6 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                          <Loader2 className="animate-spin text-cyan-400" size={28} />
                        </span>
                      </div>
                      <div className="space-y-2">
                        <span className="text-sm font-black text-white block">{isRtl ? 'جاري البحث عن كابتن شحن قريب...' : 'Looking for nearby couriers...'}</span>
                        <span className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed block">
                          {isRtl ? 'يقوم رادار المنصة بإرسال طلبك حالياً لأقرب المندوبين المتواجدين بالمنطقة.' : 'Aswaq radar is dispatching your request to drivers in your vicinity.'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Driver En Route / Active Tracking Info Card */
                    <div className="space-y-4 animate-fadeIn">
                      
                      {/* Driver profile summary */}
                      <div className="bg-[#080b12] border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0">
                            👨‍✈️
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-white block">{isRtl ? 'الكابتن: سند اليماني' : 'Captain: Sanad Al-Yamani'}</span>
                            <span className="text-[9px] text-slate-500 block mt-0.5">{isRtl ? 'المركبة:' : 'Vehicle:'} {currentVehicleInfo?.labelAr || 'سكوتر 🛵'}</span>
                            <div className="flex items-center gap-1 mt-1">
                              <Star size={10} className="text-amber-400 fill-amber-400" />
                              <span className="text-[9px] font-black text-slate-400">4.9 (120 رحلة)</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Driver Status pill */}
                        <span className="px-3 py-1 text-[9px] font-black rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
                          {testSimStep === 2 ? (isRtl ? 'يتوجه للاستلام 🛵' : 'En Route 🛵') : testSimStep === 3 ? (isRtl ? 'شحنتك في الطريق 🛣️' : 'In Transit 🛣️') : (isRtl ? 'بانتظار التحقق 🏁' : 'Arrived 🏁')}
                        </span>
                      </div>

                      {/* Proximity / ETA statistics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#080b12] p-3 rounded-xl border border-white/5 text-right">
                          <span className="text-[8px] text-slate-500 font-bold block">{isRtl ? 'وقت الوصول المتوقع:' : 'ETA:'}</span>
                          <span className="text-xs font-black text-cyan-400 block font-sans mt-0.5">
                            {testSimStep === 2 ? (isRtl ? '5 دقائق' : '5 mins') : testSimStep === 3 ? (isRtl ? '12 دقيقة' : '12 mins') : (isRtl ? 'وصل المندوب' : 'Courier Arrived')}
                          </span>
                        </div>
                        <div className="bg-[#080b12] p-3 rounded-xl border border-white/5 text-right">
                          <span className="text-xs font-black text-cyan-400 block font-sans mt-0.5">
                            {testSimStep === 2 ? '1.8 كم' : testSimStep === 3 ? '6.4 كم' : '0.0 كم'}
                          </span>
                        </div>
                      </div>

                      {/* Proximity bar (step 3 route) */}
                      {testSimStep === 3 && (
                        <div className="space-y-2 py-1">
                          <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                            <span>{isRtl ? 'نقطة الاستلام' : 'Pickup'}</span>
                            <span className="text-cyan-400">{testSimProgress}%</span>
                            <span>{isRtl ? 'الوصول النهائي' : 'Drop-off'}</span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-1000" 
                              style={{ width: `${testSimProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons (Chat, Call, Share) */}
                      <div className="grid grid-cols-3 gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => alert(isRtl ? 'جاري الاتصال هاتفياً بالكابتن...' : 'Calling Driver...')}
                          className="bg-[#080b12] hover:bg-white/10 border border-white/5 py-3 rounded-xl text-[10px] font-black text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-102"
                        >
                          <Phone size={12} className="text-emerald-400" />
                          <span>{isRtl ? 'اتصال' : 'Call'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(isRtl ? 'تم فتح محادثة فورية مشفرة...' : 'Chat started...')}
                          className="bg-[#080b12] hover:bg-white/10 border border-white/5 py-3 rounded-xl text-[10px] font-black text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-102"
                        >
                          <MessageCircle size={12} className="text-cyan-400" />
                          <span>{isRtl ? 'دردشة' : 'Chat'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${API_ORIGIN}/track/sim_ship_active`);
                            addToast(isRtl ? "تم نسخ رابط التتبع! 🔗" : "Track link copied! 🔗", isRtl ? "يمكنك الآن مشاركة موقع الشحنة مع المستلم لمتابعتها مباشرة." : "Share this with the recipient to track live.", "success");
                          }}
                          className="bg-[#080b12] hover:bg-white/10 border border-white/5 py-3 rounded-xl text-[10px] font-black text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-102"
                        >
                          <Share2 size={12} className="text-rose-400" />
                          <span>{isRtl ? 'مشاركة' : 'Share'}</span>
                        </button>
                      </div>

                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <span className="text-[9px] text-slate-500 font-bold font-sans">
                    ID: {activeShipmentId || 'PENDING_DISPATCH'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep(0);
                      setTestSimStep(0);
                      setActiveShipmentId(null);
                      setLiveDriverCoords(null);
                    }}
                    className="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-black text-[10px] px-4 py-2.5 rounded-xl cursor-pointer transition-all self-end"
                  >
                    {isRtl ? 'إلغاء وطلب رحلة أخرى 🗑️' : 'Cancel & Rebook 🗑️'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Active Map Tracker */}
          <div className="space-y-4 flex flex-col">
            
            {/* Live Track Map Frame - Highly polished borderless frame */}
            <div className="bg-[#0f1422]/90 border border-white/5 rounded-3xl h-[330px] overflow-hidden relative shadow-2xl p-1.5">
              <div className="absolute inset-x-0 bottom-0 z-10 p-4 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between text-[10px] text-white/80 font-black">
                <span>{isRtl ? 'رادار تتبع الشحنات الحي' : 'Live Shipment Dispatch Radar'}</span>
                {calculatedDistanceKm > 0 && <span className="font-sans text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/25">{calculatedDistanceKm.toFixed(1)} km</span>}
              </div>
              
              <AdMap 
                ads={[]}
                selectedCity={shipFrom}
                onSelectAd={() => {}}
                center={currentMarket.center}
                cityCoordinates={currentMarket.cityCoordinates}
                marketCityIds={[]}
                deliveryPreview={{
                  pickup: pickupCoords,
                  delivery: deliveryCoords,
                  driver: liveDriverCoords
                }}
                nearbyDrivers={nearbyDrivers}
                countryCode={currentMarket.countryCode}
                platformMode="delivery"
              />
            </div>

            {/* Quick Route Info Overlay Widget under Map */}
            {pickupCoords && (
              <div className="bg-[#0f1422]/85 border border-white/5 p-4 rounded-2xl flex items-center justify-between text-xs animate-fadeIn shadow-lg">
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-bold block">{isRtl ? 'من:' : 'From:'}</span>
                  <span className="text-[10px] font-black text-white block truncate max-w-[140px]">{shipFrom ? (currentMarket.cityCoordinates[shipFrom]?.ar || shipFrom) : ''}</span>
                </div>
                <div className="text-center font-bold text-slate-650 px-2 shrink-0">
                  ⟶
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-bold block">{isRtl ? 'إلى:' : 'To:'}</span>
                  <span className="text-[10px] font-black text-white block truncate max-w-[140px]">{shipTo ? (currentMarket.cityCoordinates[shipTo]?.ar || shipTo) : ''}</span>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Collapsible Diagnostics Accordion Drawer (ECU Control Unit) */}
        {devModeEnabled && (
          <div className="border border-white/5 bg-[#0a0d16] rounded-3xl p-5 space-y-4 animate-fadeIn relative z-10 shadow-inner">
            <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
              <span className="text-xs font-black text-amber-400 flex items-center gap-2">
                <Activity size={14} className="animate-pulse" />
                {isRtl ? 'لوحة التحكم والمحاكاة التشخيصية (ECU Control Panel)' : 'System Diagnostics & QA Simulator'}
              </span>
              {driverBalance > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-black bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Wallet size={12} />
                  <span>{isRtl ? 'رصيد المندوب:' : 'Wallet:'} {driverBalance.toLocaleString()} {currentMarket.currency}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-right">
                <span className="text-xs font-black text-white block">📡 {isRtl ? 'تتبع موقع جهازك بالـ GPS الفعلي' : 'Live Device GPS Broadcasting'}</span>
                <span className="text-[9px] text-slate-500 font-medium block mt-1">{isRtl ? 'يقرأ الموقع الفعلي لجهازك عبر watchPosition ويبثه حيّاً للسيرفر.' : 'Broadcasting real-time hardware location via watchPosition hook.'}</span>
              </div>
              <button
                type="button"
                onClick={isLiveTracking ? stopLiveGpsTracking : startLiveGpsTracking}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isLiveTracking 
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                }`}
              >
                {isLiveTracking ? (isRtl ? 'إيقاف البث الجغرافي 🛑' : 'Stop Broadcast 🛑') : (isRtl ? 'بدء بث موقعي الحي 📡' : 'Start Broadcast 📡')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={simulateDriverAccept}
                disabled={testSimStep !== 1}
                className={`py-3 px-4 rounded-2xl text-xs font-black transition-all text-center ${
                  testSimStep === 1 
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-lg shadow-amber-500/10' 
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-40'
                }`}
              >
                {isRtl ? '1. محاكاة قبول السائق 👨‍✈️' : '1. Simulate Driver Accept 👨‍✈️'}
              </button>

              <button
                onClick={simulateTransitRoute}
                disabled={testSimStep !== 2}
                className={`py-3 px-4 rounded-2xl text-xs font-black transition-all text-center ${
                  testSimStep === 2 
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer shadow-lg shadow-emerald-500/10' 
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-40'
                }`}
              >
                {isRtl ? '2. تفعيل خط السير الميداني 🛵' : '2. Trigger Transit Route 🛵'}
              </button>

              <button
                onClick={simulatePayoutAndRating}
                disabled={testSimStep !== 4}
                className={`py-3 px-4 rounded-2xl text-xs font-black transition-all text-center ${
                  testSimStep === 4 
                    ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 cursor-pointer shadow-lg shadow-cyan-400/10' 
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed opacity-40'
                }`}
              >
                {isRtl ? '3. دفع الأجرة وتسوية الحساب 🏆' : '3. Payout & Settled 🏆'}
              </button>
            </div>

            {/* Live Terminal logs */}
            <div className="bg-black/95 p-4 rounded-2xl border border-white/5 space-y-2">
              <div className="flex justify-between text-[9px] text-slate-500 font-bold border-b border-white/5 pb-1.5">
                <span>{isRtl ? 'سجل تشغيل النظام وفحص GPS (Diagnostics Log)' : 'System Telemetry & Geolocation Log'}</span>
                <button 
                  onClick={() => setTestSimLogs([isRtl ? '[رادار الـ GPS] جاهز لتلقي طلبات الشحن...' : '[GPS Radar] Idle. Awaiting shipment dispatch...'])}
                  className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer transition-colors"
                >
                  {isRtl ? 'مسح السجل 🗑️' : 'Clear Telemetry 🗑️'}
                </button>
              </div>
              <div className="max-h-[120px] overflow-y-auto text-[10px] font-mono text-emerald-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed text-right select-all">
                {testSimLogs.map((log, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-slate-600">[{index + 1}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
