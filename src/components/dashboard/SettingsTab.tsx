/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Camera, Bell, X, CheckCircle2, Scan, RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import { User, Ad } from "../../types.ts";
import { Market } from "../../markets.ts";
import { CITIES } from "../../data.ts";
import { API_BASE_URL } from "../../lib/config";
import { apiFetch } from "../../lib/api";
import { Avatar } from "../Avatar";

interface SettingsTabProps {
  currentUser: User;
  currentMarket: Market;
  ads: Ad[];
  isDark: boolean;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
  onUpdateUser?: (user: User) => void;
}

export default function SettingsTab({
  currentUser,
  currentMarket,
  ads,
  isDark,
  addToast,
  onUpdateUser,
}: SettingsTabProps) {
  const isRtl = true;

  const cleanBio = (bio?: string | null) => (bio && bio.includes('Test Bio') ? '' : (bio || ''));
  const cleanAvatar = (avatar?: string | null) => (avatar && (avatar.includes('photo-1535713875002-d1d0cf377fde') || avatar.includes('unsplash')) ? '' : (avatar || ''));

  // Form states
  const [profileName, setProfileName] = useState(currentUser.name || "");
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || "");
  const [profileBio, setProfileBio] = useState(cleanBio(currentUser.bio));
  const [profileAvatar, setProfileAvatar] = useState(cleanAvatar(currentUser.avatar));
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || "");
      setProfilePhone(currentUser.phone || "");
      setProfileBio(cleanBio(currentUser.bio));
      setProfileAvatar(cleanAvatar(currentUser.avatar));
    }
  }, [currentUser]);
  
  // Notification preference states
  const [priceDropAlerts, setPriceDropAlerts] = useState((currentUser as any).priceDropAlerts !== false);
  const [newAdAlerts, setNewAdAlerts] = useState(!!(currentUser as any).newAdAlerts);
  const [alertCity, setAlertCity] = useState(
    (currentUser as any).alertCity || 
    currentMarket?.cities?.[0]?.id || 
    (currentMarket?.id === 'YE' ? 'sanaa_city' : currentMarket?.cities?.[0]?.id)
  );

  const [settingsSaved, setSettingsSaved] = useState(false);

  // KYC Verification States
  const [kycMode, setKycMode] = useState<'idle' | 'camera' | 'captured'>('idle');
  const [kycPhoto, setKycPhoto] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycStep, setKycStep] = useState<1 | 2>(1); // 1: ID Card, 2: Face
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load user's favorited ads list for price alerts
  const [favoritedAds, setFavoritedAds] = useState<Ad[]>([]);

  useEffect(() => {
    if (currentUser?.id) {
      const fetchFavs = async () => {
        try {
          const res = await fetch(`/api/users/${currentUser.id}/favorites`);
          if (res.ok) {
            const favIds = await res.json();
            const matchedAds = ads.filter(ad => favIds.includes(ad.id));
            setFavoritedAds(matchedAds);
          }
        } catch (err) {
          console.error("Failed to load favorites for preferences", err);
        }
      };
      fetchFavs();
    }
  }, [currentUser?.id, ads]);

  const formatPrice = (num?: number) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // منع الإرسال المتكرر
    setIsSaving(true);

    try {
      // أرسل فقط الحقول الموجودة فعلاً في قاعدة البيانات
      const payload: Record<string, any> = {
        name: profileName,
        phone: profilePhone || null,
        bio: profileBio || null,
        avatar: profileAvatar || null,
      };

      const res = await apiFetch(`/api/v1/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        const mergedUser = {
          ...currentUser,
          ...updatedUser,
          // احتفظ بالتفضيلات المحلية (غير موجودة في DB)
          priceDropAlerts,
          newAdAlerts,
          alertCity,
        };
        localStorage.setItem('aswaq_current_user', JSON.stringify(mergedUser));
        onUpdateUser?.(mergedUser);
        setSettingsSaved(true);
        addToast?.("تم حفظ التغييرات", "تم حفظ إعدادات حسابك وتحديثها بنجاح.", "success");
        setTimeout(() => setSettingsSaved(false), 3000);
      } else {
        let errMsg = 'حدث خطأ أثناء الحفظ.';
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch (_) {}
        console.error('[SettingsTab] Save failed. Status:', res.status, errMsg);
        addToast?.("فشل الحفظ", errMsg, "error");
      }
    } catch (err) {
      console.error("[SettingsTab] Network error during save:", err);
      addToast?.("خطأ في الاتصال", "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.", "error");
    } finally {
      setIsSaving(false);
    }

    // احفظ تفضيلات الإشعارات محلياً فقط (لا ترسلها للسيرفر)
    const localPrefs = {
      priceDropAlerts,
      newAdAlerts,
      alertCity,
    };
    localStorage.setItem('aswaq_user_prefs', JSON.stringify(localPrefs));
  };

  // KYC Camera methods
  const startKycCamera = async () => {
    setKycMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setKycMode('idle');
      addToast?.("خطأ الكاميرا", "يرجى منح صلاحية الكاميرا لإتمام التحقق.", "error");
    }
  };

  const stopKycCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setKycMode('idle');
  };

  const captureKycPhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setKycPhoto(dataUrl);
        setKycMode('captured');
        stopKycCamera();
      }
    }
  };

  return (
    <div className="mt-8 max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800">
      <h3 className="text-lg font-black text-white mb-6">
        إعدادات وبيانات الحساب الشخصي
      </h3>

      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">
            الاسم التجاري أو الشخصي
          </label>
          <input
            type="text"
            required
            className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 text-xs outline-none text-right"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            id="setting-name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">
            رقم الهاتف للتواصل (يفضل واتساب)
          </label>
          <input
            type="text"
            required
            className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 text-xs outline-none text-right font-mono"
            value={profilePhone}
            onChange={(e) => setProfilePhone(e.target.value)}
            id="setting-phone"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400">
            نبذة تعريفية أو وصف مختصر للمتجر
          </label>
          <textarea
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-xs outline-none text-right placeholder:text-slate-600"
            placeholder="اكتب شيئاً عن مهنتك، مقتنياتك أو ساعات دوام متجرك وتواجدك..."
            value={profileBio}
            onChange={(e) => setProfileBio(e.target.value)}
            id="setting-bio"
          />
        </div>

        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-slate-400">
            صورة الملف الشخصي
          </label>
          <div className="flex items-center gap-4">
            <Avatar
              src={profileAvatar}
              name={profileName || currentUser.name}
              sizeClassName="w-16 h-16"
              className="rounded-2xl border border-slate-700 shadow-md"
            />
            <label className="flex-1 cursor-pointer">
              <div className="h-11 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 text-xs font-bold transition-all border border-slate-700">
                {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Camera className="w-4 h-4" />}
                {isUploadingAvatar ? "جاري رفع الصورة..." : "تغيير الصورة"}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingAvatar}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setIsUploadingAvatar(true);
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await apiFetch('/api/storage/upload', {
                      method: 'POST',
                      body: formData,
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.url) {
                        setProfileAvatar(data.url);
                        addToast?.('تم رفع الصورة', 'تم رفع الصورة الشخصية سحابياً بنجاح', 'success');
                      }
                    } else {
                      // Fallback to Base64 preview if cloud upload returns non-ok
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') setProfileAvatar(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  } catch (err) {
                    console.error('Avatar upload error:', err);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (typeof reader.result === 'string') setProfileAvatar(reader.result);
                    };
                    reader.readAsDataURL(file);
                  } finally {
                    setIsUploadingAvatar(false);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* نظام تفضيلات الإشعارات */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 space-y-4" id="notification-preferences-sec">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-black text-slate-200">
              نظام تفضيلات الإشعارات والتنبيهات المخصصة
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-4">
            {/* 1. Price drop alert toggle */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1 text-right">
                <label className="text-xs font-bold text-slate-300 block">
                  تنبيهات انخفاض الأسعار للسلع المتابعة
                </label>
                <span className="text-[10px] text-slate-500 block leading-relaxed">
                  الرصد الذكي التلقائي لأسعار السلع والأصول التي تبدي اهتماماً بها أو تضيفها للمفضلة، لتلقي تنبيه فوري فور قيام البائع بتخفيض السعر.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPriceDropAlerts(!priceDropAlerts)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                  priceDropAlerts ? "bg-emerald-500" : "bg-slate-800"
                }`}
                id="pref-price-toggle"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-slate-950 shadow-md transform duration-200 ${
                    priceDropAlerts ? "-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <hr className="border-slate-800/40" />

            {/* 2. New ad alert toggle */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1 text-right">
                <label className="text-xs font-bold text-slate-300 block">
                  تنبيهات نشر إعلانات جديدة في منطقتك
                </label>
                <span className="text-[10px] text-slate-500 block leading-relaxed">
                  متابعة لكافة الإعلانات المضافة حديثاً في المحافظة/المنطقة التي تختارها لتكون أول من يطّلع على الفرص والصفقات الحصرية.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNewAdAlerts(!newAdAlerts)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                  newAdAlerts ? "bg-emerald-500" : "bg-slate-800"
                }`}
                id="pref-area-toggle"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-slate-950 shadow-md transform duration-200 ${
                    newAdAlerts ? "-translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 2b. Select alert city if active */}
            {newAdAlerts && (
              <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-800/20 text-right">
                <label className="text-[10px] font-black text-slate-400">
                  اختر المحافظة أو المنطقة المستهدفة للتنبيهات:
                </label>
                <select
                  value={alertCity}
                  onChange={(e) => setAlertCity(e.target.value)}
                  className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 text-slate-300 text-xs outline-none text-right cursor-pointer focus:border-emerald-500/50"
                  id="pref-city-select"
                >
                  {(currentMarket?.cities || CITIES).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Followed Goods display with price labels */}
          <div className="space-y-2 mt-4 text-right">
            <h5 className="text-[11px] font-bold text-slate-400">
              العقود والسلع التي تتابعها لتغيرات السعر ({favoritedAds.length})
            </h5>

            {favoritedAds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="tracked-ads-list">
                {favoritedAds.map((ad) => {
                  let imagesList = [];
                  try {
                    imagesList = typeof ad.images === 'string' ? JSON.parse(ad.images) : ad.images;
                  } catch (e) {
                    imagesList = [];
                  }
                  const adImg = (Array.isArray(imagesList) && imagesList.length > 0) 
                    ? imagesList[0] 
                    : "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=300&q=80";
                  
                  return (
                    <div 
                      key={ad.id} 
                      className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/20 border border-slate-800/40 hover:border-slate-800 transition-all dir-rtl"
                    >
                      <img 
                        src={adImg || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'} 
                        alt={ad.title} 
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-880 border-slate-800"
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <h6 className="text-[11px] font-bold text-slate-200 truncate">{ad.title}</h6>
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {formatPrice(ad.price)} {ad.currency || 'YER'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                          رصد دائم
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-2xl bg-slate-950/10 border border-slate-800/20 text-slate-500 text-[10px] leading-relaxed">
                لم تقم بإضافة أي سلعة للمفضلة بعد. عند إعجابك وتفضيلك لأي سلعة، ستظهر هنا تلقائياً لمتابعة السعر.
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || isUploadingAvatar}
          className={`w-full text-slate-950 font-black h-11 rounded-xl text-xs transition-all cursor-pointer mt-4 flex items-center justify-center gap-2 ${
            isSaving || isUploadingAvatar
              ? 'bg-emerald-700 opacity-60 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95'
          }`}
          id="setting-save-btn"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              جاري الحفظ...
            </>
          ) : (
            'حفظ وتثبيت إعدادات الحساب'
          )}
        </button>

        {settingsSaved && (
          <div className="p-3 text-center bg-emerald-950 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-bold select-none">
            ✅ تم حفظ تفاصيل وإعدادات حسابك بنجاح!
          </div>
        )}
      </form>

      {/* Golden Trust Verification Section */}
      <div className="mt-8 pt-8 border-t border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
          <h4 className="text-sm font-black text-slate-200">
            برنامج توثيق الحسابات والتاجر المضمون
          </h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          توثيق الحساب يزيد من ثقة المشترين في إعلاناتك بمعدل{" "}
          <span className="text-emerald-400 font-bold">5 أضعاف</span> ويمنحك
          شارة التوثيق الملكية الخضراء على المنصة.
        </p>

        {currentUser.verified ? (
          <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-800/40 text-emerald-400 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto animate-bounce fill-emerald-950" />
            <p className="text-xs font-black">
              تهانينا! حسابك موثق بالكامل وشارتك الخضراء مفعلة بنجاح.
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              الاسم الموثق: {currentUser.name}
            </p>
          </div>
        ) : (
          <div
            className="p-5 rounded-2xl bg-slate-950/45 border border-slate-800 space-y-4"
            id="kyc-verification-box"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h5 className="text-[11px] font-bold text-slate-200">الخطوة {kycStep}: {kycStep === 1 ? 'تصوير بطاقة الهوية' : 'التحقق من ملامح الوجه'}</h5>
                <p className="text-[9px] text-slate-500">يرجى وضع {kycStep === 1 ? 'البطاقة الشخصية' : 'وجهك'} بوضوح في الإطار</p>
              </div>
              <div className="flex gap-1">
                <div className={`w-6 h-1 rounded-full ${kycStep === 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                <div className={`w-6 h-1 rounded-full ${kycStep === 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
              </div>
            </div>

            {kycMode === 'idle' && !kycPhoto && (
              <div 
                onClick={startKycCamera}
                className="aspect-video relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900 flex flex-col items-center justify-center gap-3 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300">اضغط لفتح الكاميرا وبدء التحقق</span>
              </div>
            )}

            {kycMode === 'camera' && (
              <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-slate-800">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-[80%] h-[70%] border-2 border-emerald-500/30 rounded-xl border-dashed">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                   </div>
                </div>
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-4">
                  <button
                    type="button"
                    onClick={stopKycCamera}
                    className="w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-rose-500 transition-colors pointer-events-auto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={captureKycPhoto}
                    className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 pointer-events-auto border-4 border-white/20"
                  >
                    <Scan className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {kycMode === 'captured' && kycPhoto && (
              <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
                <img src={kycPhoto} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-emerald-500 text-white text-[8px] font-black uppercase tracking-tighter">
                  Captured Successfully
                </div>
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-4">
                  <button
                    type="button"
                    onClick={() => {
                      setKycPhoto(null);
                      startKycCamera();
                    }}
                    className="h-9 px-4 rounded-full bg-slate-950/80 backdrop-blur-md flex items-center gap-2 text-slate-300 text-[10px] font-bold hover:text-white transition-colors border border-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة المحاولة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (kycStep === 1) {
                        setKycStep(2);
                        setKycPhoto(null);
                        setKycMode('idle');
                      } else {
                        setKycLoading(true);
                        setTimeout(() => {
                          currentUser.verified = true;
                          setKycLoading(false);
                          setSettingsSaved(true);
                          addToast?.("تم التوثيق بنجاح", "تهانينا! تم توثيق حسابك بالكامل بالبطاقة الشخصية ومطابقة الوجه.", "success");
                          setTimeout(() => setSettingsSaved(false), 3000);
                        }, 2000);
                      }
                    }}
                    className="h-9 px-6 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
                  >
                    {kycStep === 1 ? 'متابعة الخطوة التالية' : 'إنهاء وتوثيق الحساب'}
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {kycLoading && (
              <div className="py-8 flex flex-col items-center justify-center gap-4">
                 <div className="relative">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <ShieldAlert className="w-4 h-4 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                 </div>
                 <div className="text-center">
                    <p className="text-[11px] font-bold text-slate-200">جاري معالجة البيانات ضوئياً وتأكيد الهوية...</p>
                    <p className="text-[9px] text-slate-500 mt-1">يتم استخدام تقنيات الذكاء الاصطناعي لمطابقة الصورة بالبيانات المسجلة</p>
                 </div>
              </div>
            )}

            {!kycLoading && (
               <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                 بمجرد الضغط على إرسال، فإنك توافق على شروط الاستخدام في <span className="text-slate-400 underline cursor-pointer">أسواق</span> للتحقق من هويتك الشخصية لغرض زيادة الموثوقية فقط.
               </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
