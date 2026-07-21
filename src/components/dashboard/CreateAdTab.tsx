/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Camera,
  Video,
  Loader2,
  Check,
  Sliders,
  Edit,
  TrendingUp,
  Scan,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

if (typeof window !== "undefined") {
  (window as any).L = L;
}

import VideoRecorder from "../VideoRecorder.tsx";
import { uploadFileWithProgress } from "../../lib/upload.ts";
import { User, Ad, Category } from "../../types.ts";
import { Market, getCurrencyNameAr } from "../../markets.ts";
import { CITIES, DISTRICTS, SUB_CATEGORIES } from "../../data.ts";

interface CreateAdTabProps {
  currentUser: User;
  currentMarket: Market;
  categories: Category[];
  editingAd: Ad | null;
  onCancelEdit: () => void;
  onAdCreated: (newAd: Ad) => void;
  onAdUpdated: (updatedAd: Ad) => void;
  onTabChange: (tab: string) => void;
  isDark: boolean;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
}

export default function CreateAdTab({
  currentUser,
  currentMarket,
  categories,
  editingAd,
  onCancelEdit,
  onAdCreated,
  onAdUpdated,
  onTabChange,
  isDark,
  addToast,
}: CreateAdTabProps) {
  const { t } = useTranslation();
  const isRtl = true;

  // Stepper state
  const [adStep, setAdStep] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState(false);

  // Form Field States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(currentMarket.currency || "USD");
  const [city, setCity] = useState(currentMarket.cities?.[0]?.id || "sanaa_city");
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState(categories[0]?.id || "");
  const [subCategory, setSubCategory] = useState("");
  const [adImages, setAdImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [adStatus, setAdStatus] = useState<"active" | "sold" | "expired">("active");
  const [contactNumber, setContactNumber] = useState(currentUser.phone || "");
  const [showPhone, setShowPhone] = useState(true);
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Map & Location States
  const [showOnMap, setShowOnMap] = useState<boolean>(true);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);

  // Video Spotlight States
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUploadXhr, setVideoUploadXhr] = useState<XMLHttpRequest | null>(null);

  // Dropdowns search states
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
  const [subCategorySearch, setSubCategorySearch] = useState("");

  // AI assistant loading states
  const [enhancing, setEnhancing] = useState(false);
  const [suggestingPrice, setSuggestingPrice] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // Category Specific States
  const [rooms, setRooms] = useState<number>(0);
  const [propertyType, setPropertyType] = useState<string>("apartment");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [make, setMake] = useState<string>("");
  const [modelYear, setModelYear] = useState<number | "">("");
  const [transmission, setTransmission] = useState<string>("automatic");
  const [fuelType, setFuelType] = useState<string>("gasoline");
  const [condition, setCondition] = useState<string>("used_mint");
  const [brand, setBrand] = useState<string>("");
  const [jobType, setJobType] = useState<"seeking" | "hiring">("hiring");

  // Sync edit values
  useEffect(() => {
    if (editingAd) {
      setTitle(editingAd.title);
      setDescription(editingAd.description);
      setPrice(String(editingAd.price));
      setCurrency(editingAd.currency);
      setCity(editingAd.city);
      setDistrict(editingAd.district || "");
      setCategory(editingAd.category);
      setSubCategory(editingAd.subCategory || "");
      setAdImages(editingAd.images || []);
      setVideoUrl(editingAd.videoUrl || "");
      setAdStatus(editingAd.status === "sold" ? "sold" : "active");
      setContactNumber(editingAd.contactNumber || "");
      setShowPhone(!!editingAd.contactNumber);
      setCustomCategoryName("");
      setLatitude(editingAd.latitude !== undefined ? editingAd.latitude : null);
      setLongitude(editingAd.longitude !== undefined ? editingAd.longitude : null);
      setShowOnMap(editingAd.showOnMap !== undefined ? editingAd.showOnMap : true);

      if (editingAd.category === "realestate") {
        setRooms(editingAd.rooms || 0);
        setPropertyType(editingAd.propertyType || "apartment");
        setAmenities(editingAd.amenities || []);
      } else if (editingAd.category === "cars") {
        setMake(editingAd.make || "");
        setModelYear(editingAd.modelYear || "");
        setTransmission(editingAd.transmission || "automatic");
        setFuelType(editingAd.fuelType || "gasoline");
      } else if (["electronics", "phones", "laptops"].includes(editingAd.category)) {
        setCondition(editingAd.condition || "used_mint");
        setBrand(editingAd.brand || "");
      } else if (editingAd.category === "jobs") {
        setJobType(editingAd.jobType || "hiring");
      }
    } else {
      setTitle("");
      setDescription("");
      setPrice("");
      setCurrency(currentMarket.currency || "USD");
      setCity(currentMarket.cities?.[0]?.id || "sanaa_city");
      setDistrict("");
      setCategory(categories[0]?.id || "");
      setSubCategory("");
      setAdImages([]);
      setVideoUrl("");
      setAdStatus("active");
      setContactNumber(currentUser.phone || "");
      setShowPhone(true);
      setCustomCategoryName("");
      setLatitude(null);
      setLongitude(null);
      setShowOnMap(true);
      setRooms(0);
      setPropertyType("apartment");
      setAmenities([]);
      setMake("");
      setModelYear("");
      setTransmission("automatic");
      setFuelType("gasoline");
      setCondition("used_mint");
      setBrand("");
      setJobType("hiring");
    }
  }, [editingAd, currentMarket, currentUser, categories]);

  // Synchronize jobType when category changes
  useEffect(() => {
    if (category === "jobs") {
      setJobType("hiring");
    }
  }, [category]);

  // Minimap initialization
  useEffect(() => {
    if (!showOnMap || adStep !== 3) return;

    // Determine initial center
    const cityCenter = currentMarket.cityCoordinates[city] || currentMarket.center;
    const initialLat = latitude || cityCenter.lat;
    const initialLng = longitude || cityCenter.lng;

    const minimapElement = document.getElementById("create-ad-minimap");
    if (!minimapElement) return;

    // Reset container HTML to avoid multiple map instances error in Leaflet
    minimapElement.innerHTML = '<div id="minimap-stage" style="width:100%; height:100%;"></div>';

    const stage = document.getElementById("minimap-stage");
    if (!stage) return;

    const map = L.map(stage, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 19,
    }).addTo(map);

    // Draggable pin for exact ad placement
    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setLatitude(pos.lat);
      setLongitude(pos.lng);
    });

    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setLatitude(lat);
      setLongitude(lng);
    });

    // Auto-locate if no coordinates are set
    if (!latitude && !longitude && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          map.setView([lat, lng], 14, { animate: true });
          marker.setLatLng([lat, lng]);
          setLatitude(lat);
          setLongitude(lng);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    (window as any)._createAdMinimap = { map, marker };

    return () => {
      if ((window as any)._createAdMinimap) {
        delete (window as any)._createAdMinimap;
      }
      try {
        map.off();
        map.remove();
      } catch (err) {
        console.warn("Minimap cleanup error:", err);
      }
      minimapElement.innerHTML = "";
    };
  }, [showOnMap, adStep, city, currentMarket]);

  const validateStep = (stepNum: number) => {
    if (stepNum === 1) {
      if (!title.trim() || !description.trim() || price === "") {
        addToast?.("تنبيه", "يرجى تعبئة الحقول الأساسية: العنوان، الوصف والسعر.", "error");
        return false;
      }
    }
    return true;
  };

  const handleLocalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (adImages.length + files.length > 5) {
      addToast?.("خطأ", "الحد الأقصى للصور هو 5 صور", "error");
      return;
    }

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        addToast?.("الملف كبير جداً ⚠️", `الملف "${file.name}" يتجاوز الحد الأقصى المسموح به للصور (15 ميجابايت).`, "error");
        continue;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const res = reader.result;
          setAdImages((prev) => {
            const next = [...prev, res];
            if (next.length === 1) {
              handleAiAnalyzeImage(res);
            }
            return next;
          });
        }
      };
      reader.readAsDataURL(file as File);
    }
  };

  const handleAiAnalyzeImage = async (url: string) => {
    if (!url) return;
    setAnalyzingImage(true);
    try {
      const response = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.category && categories.some((c) => c.id === data.category)) {
          setCategory(data.category);
        }
        if (data.suggestedPrice) setPrice(data.suggestedPrice.toString());
        if (data.condition) setCondition(data.condition);
        if (data.specs) {
          setDescription((prev) => {
            const base = prev || "";
            return base + "\n\nالمواصفات المستخرجة:\n" + data.specs;
          });
        }
        addToast?.("تحليل الذكاء الاصطناعي", "تم تحليل الصورة واستخراج البيانات المقترحة تلقائياً.", "success");
      }
    } catch (e) {
      console.error("AI Analysis failed", e);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleEnhanceAdDescription = async () => {
    if (!title) {
      addToast?.("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليقوم النظام بصياغة وتحسين الوصف التسويقي تلقائياً.", "info");
      return;
    }

    setEnhancing(true);
    try {
      const response = await fetch("/api/ai/enhance-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          rawDescription: description,
          category,
          city,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.enhancedText) {
          setDescription(data.enhancedText);
          addToast?.("تم تحسين الوصف", "تمت صياغة وصف تسويقي احترافي بنجاح.", "success");
        }
      }
    } catch (e) {
      console.error("Error enhancing ad description", e);
    } finally {
      setEnhancing(false);
    }
  };

  const handleSuggestPrice = async () => {
    if (!title) {
      addToast?.("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليتمكن الذكاء الاصطناعي من تقدير السعر واقتراحه.", "info");
      return;
    }
    setSuggestingPrice(true);
    try {
      const response = await fetch("/api/ai/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          currency,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestedPrice !== undefined && data.suggestedPrice !== null) {
          setPrice(data.suggestedPrice.toString());
          addToast?.("السعر المقترح", `تم اقتراح السعر: ${data.suggestedPrice} ${currency}`, "info");
        }
      }
    } catch (e) {
      console.error("Error suggesting price", e);
    } finally {
      setSuggestingPrice(false);
    }
  };

  const handleAiSuggestCategory = async () => {
    if (!title) {
      addToast?.("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليتمكن الذكاء الاصطناعي من اقتراح القسم المناسب.", "info");
      return;
    }
    setClassifying(true);
    try {
      const response = await fetch("/api/ai/classify-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.categoryId && categories.some((c) => c.id === data.categoryId)) {
          setCategory(data.categoryId);
          addToast?.("تصنيف الفئة", `الفئة المقترحة: ${categories.find(c=>c.id===data.categoryId)?.nameAr}`, "info");
        }
      }
    } catch (e) {
      console.error("Classification failed", e);
    } finally {
      setClassifying(false);
    }
  };

  const handleCreateAdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || price === "" || (showPhone && !contactNumber)) {
      addToast?.("خطأ في الإدخال", "يرجى تعبئة جميع الحقول المطلوبة: العنوان، الوصف، السعر، ورقم التواصل.", "error");
      return;
    }

    setCreating(true);
    const imageList = adImages.map((img) => (typeof img === "object" ? img : { url: img.trim() })).filter((img: any) => img.url !== "");

    const finalCategory = category === "other" && customCategoryName.trim() ? customCategoryName.trim() : category;

    const body = {
      title,
      description,
      price: Number(price),
      currency,
      city,
      district,
      category: finalCategory,
      subCategory,
      images: imageList,
      contactNumber: showPhone ? contactNumber : null,
      status: adStatus,
      showOnMap,
      latitude: latitude !== null ? latitude : (CITIES.find(c => c.id === city || c.nameAr === city)?.lat || 15.3694),
      longitude: longitude !== null ? longitude : (CITIES.find(c => c.id === city || c.nameAr === city)?.lng || 44.1910),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userVerified: currentUser.verified,
      videoUrl: videoUrl.trim() || undefined,
      ...(finalCategory === "realestate"
        ? {
            rooms,
            propertyType: propertyType as any,
            amenities,
          }
        : {}),
      ...(finalCategory === "cars"
        ? {
            make,
            modelYear: Number(modelYear),
            transmission: transmission as any,
            fuelType: fuelType as any,
          }
        : {}),
      ...(["electronics", "phones", "laptops"].includes(finalCategory)
        ? {
            condition: condition as any,
            brand,
          }
        : {}),
      ...(finalCategory === "jobs"
        ? {
            jobType: jobType,
          }
        : {}),
    };

    try {
      const url = editingAd ? `/api/ads/${editingAd.id}` : "/api/ads";
      const method = editingAd ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const savedAdData = await response.json();
        const finalAd = savedAdData.ad || savedAdData;
        if (editingAd) {
          onAdUpdated(finalAd);
          addToast?.("نجاح", "تم تحديث الإعلان وتعديله بنجاح.", "success");
        } else {
          onAdCreated(finalAd);
          addToast?.("نجاح", "تم نشر وإدراج إعلانك بنجاح في أسواق.", "success");
        }
        setCreationSuccess(true);
        setTimeout(() => {
          setCreationSuccess(false);
          onTabChange("my-ads");
        }, 1500);
      } else {
        const responseText = await response.text();
        alert(`فشل الحفظ: ${responseText}`);
      }
    } catch (e) {
      console.error("Submission failed", e);
      addToast?.("خطأ اتصال", "تعذر الاتصال بالخادم لحفظ الإعلان.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Form Fields Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className={`p-6 sm:p-8 rounded-[32px] border transition-all duration-300 ${isDark ? "bg-slate-900 border-slate-800 shadow-2xl shadow-black/10" : "bg-white border-slate-200/80 shadow-xl shadow-slate-200/50"}`}>
          <h3 className={`text-xl font-black flex items-center justify-between gap-2 mb-8 ${isDark ? "text-white" : "text-slate-900"}`}>
            <span className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl">
                <FileText className="text-emerald-500 w-5 h-5" />
              </div>
              {editingAd ? "تعديل تفاصيل الإعلان" : "تفاصيل الإعلان الجديد"}
            </span>
            {editingAd && (
              <button
                type="button"
                onClick={onCancelEdit}
                className={`flex items-center gap-1.5 px-3 py-1.5 border group text-[10px] rounded-lg font-bold transition-all shrink-0 cursor-pointer ${isDark ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-emerald-500/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"}`}
              >
                إلغاء التعديل
              </button>
            )}
          </h3>

          {/* Stepper progress indicator */}
          <div className="flex items-center justify-between mb-8 px-2 select-none">
            {[
              { step: 1, label: isRtl ? "التفاصيل الأساسية" : "Basic Details" },
              { step: 2, label: isRtl ? "الصور والوسائط" : "Media Files" },
              { step: 3, label: isRtl ? "الموقع والاتصال" : "Location & Contact" },
            ].map((s, idx) => (
              <React.Fragment key={s.step}>
                {idx > 0 && (
                  <div className={`flex-grow h-1 mx-2 rounded-full transition-all duration-300 ${adStep >= s.step ? "bg-emerald-500" : isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                )}
                <div
                  className="flex flex-col items-center gap-1.5 cursor-pointer"
                  onClick={() => {
                    if (s.step < adStep) {
                      setAdStep(s.step);
                    } else if (s.step > adStep) {
                      if (adStep === 1 && validateStep(1)) {
                        if (s.step === 3) {
                          setAdStep(3);
                        } else {
                          setAdStep(2);
                        }
                      } else if (adStep === 2) {
                        setAdStep(s.step);
                      }
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${adStep === s.step ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20" : adStep > s.step ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-950 text-slate-500 border border-slate-855 border-slate-800"}`}>
                    {s.step}
                  </div>
                  <span className={`text-[9px] font-black tracking-tighter transition-colors duration-300 ${adStep === s.step ? "text-emerald-500" : isDark ? "text-slate-500" : "text-slate-400"}`}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <form onSubmit={handleCreateAdSubmit} className="space-y-6">
            {adStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
                {/* Title */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                    {t("dashboard.adTitle")}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={70}
                    placeholder={t("dashboard.adTitlePlaceholder")}
                    className={`w-full h-12 border rounded-xl px-4 outline-none focus:border-emerald-500 text-sm text-right font-bold transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"}`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    id="ad-input-title"
                  />
                </div>

                {/* Description Box with integrated Enhancer button */}
                <div className="space-y-1.5 text-right">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-bold block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t("dashboard.description")}
                    </label>
                    <button
                      type="button"
                      onClick={handleEnhanceAdDescription}
                      disabled={enhancing || !title}
                      className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 hover:opacity-80 disabled:opacity-50 select-none cursor-pointer"
                    >
                      {enhancing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("dashboard.enhancing")}
                        </>
                      ) : (
                        <>
                          <Edit className="w-3.5 h-3.5" />
                          💡 {t("dashboard.enhanceDescription")}
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    required
                    placeholder={t("dashboard.descriptionPlaceholder")}
                    className={`w-full border rounded-xl p-4 outline-none focus:border-emerald-500 text-sm text-right leading-relaxed transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    id="ad-input-desc"
                  />
                </div>

                {/* Price and currency Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-right font-bold">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 block">
                        {t("dashboard.price")}
                      </label>
                      <button
                        type="button"
                        onClick={handleSuggestPrice}
                        disabled={suggestingPrice || !title}
                        className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50 select-none cursor-pointer"
                      >
                        {suggestingPrice ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            {t("dashboard.suggesting")}
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3 text-cyan-400" />
                            💡 {t("dashboard.suggestPrice")}
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder={t("dashboard.pricePlaceholder")}
                      className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs font-bold text-right transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-900"}`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      id="ad-input-price"
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-slate-400 block">
                      العملة
                    </label>
                    <select
                      className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs text-right font-medium cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-900"}`}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      id="ad-input-currency"
                    >
                      <option value="USD">دولار أمريكي (USD)</option>
                      {currentMarket.currency !== "USD" && (
                        <option value={currentMarket.currency}>
                          {currentMarket.currency === "YER" ? "ريال يمني" : currentMarket.currency === "SAR" ? "ريال سعودي" : currentMarket.currency} ({currentMarket.currency})
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Category and Subcategory Selector Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-right">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 block">
                        القسم / الفئة
                      </label>
                      <button
                        type="button"
                        onClick={handleAiSuggestCategory}
                        disabled={classifying || !title}
                        className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 select-none cursor-pointer"
                      >
                        {classifying ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                            جاري تحليل المحتوى...
                          </>
                        ) : (
                          <>
                            <Scan className="w-3 h-3 text-emerald-400" />
                            💡 اقترح الفئة الأنسب
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative" id="ad-input-category">
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className={`w-full h-11 border rounded-xl px-4 outline-none transition-all text-xs text-right font-medium flex items-center justify-between cursor-pointer ${isCategoryDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-900"}`}
                      >
                        <Sliders className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isCategoryDropdownOpen ? "rotate-180 text-emerald-400" : ""}`} />
                        <span>{categories.find((c) => c.id === category)?.nameAr || "اختر القسم / الفئة..."}</span>
                      </button>

                      {isCategoryDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-[1050]" onClick={() => setIsCategoryDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[1051] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                            <div className={`p-2 border-b ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-100"}`}>
                              <input
                                type="text"
                                placeholder="بحث عن قسم..."
                                className={`w-full border rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-emerald-500 transition-colors ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                              <button
                                type="button"
                                onClick={() => {
                                  setCategory("");
                                  setSubCategory("");
                                  setIsCategoryDropdownOpen(false);
                                  setCategorySearch("");
                                }}
                                className="w-full text-right px-3 py-2 text-[11px] text-slate-500 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                اختر القسم / الفئة...
                              </button>
                              {categories
                                .filter((c) => c.nameAr.toLowerCase().includes(categorySearch.toLowerCase()))
                                .map((cat) => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      setCategory(cat.id);
                                      setSubCategory("");
                                      setIsCategoryDropdownOpen(false);
                                      setCategorySearch("");
                                    }}
                                    className={`w-full text-right px-3 py-2 text-[11px] rounded-lg transition-all flex items-center justify-between group cursor-pointer ${category === cat.id ? "bg-emerald-500/10 text-emerald-400 font-bold" : "text-slate-300 hover:bg-slate-800"}`}
                                  >
                                    {category === cat.id && <Check className="w-3 h-3 text-emerald-400" />}
                                    <span>{cat.nameAr}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SubCategory Selection */}
                  {(() => {
                    const activeCatObj = categories.find((c) => c.id === category);
                    const currentSubCategories = activeCatObj?.subCategories && activeCatObj.subCategories.length > 0 ? activeCatObj.subCategories : SUB_CATEGORIES[category] || [];

                    if (currentSubCategories.length === 0) return null;

                    return (
                      <div className="space-y-1.5 text-right">
                        <label className="text-xs font-bold text-slate-400 block">
                          التصنيف الفرعي
                        </label>
                        <div className="relative" id="ad-input-subcategory">
                          <button
                            type="button"
                            onClick={() => setIsSubCategoryDropdownOpen(!isSubCategoryDropdownOpen)}
                            className={`w-full h-11 border rounded-xl px-4 outline-none transition-all text-xs text-right font-medium flex items-center justify-between cursor-pointer ${isSubCategoryDropdownOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-900"}`}
                          >
                            <Sliders className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isSubCategoryDropdownOpen ? "rotate-180 text-emerald-400" : ""}`} />
                            <span>{currentSubCategories.find((s: any) => s.id === subCategory)?.nameAr || "اختر تصنيفاً فرعياً"}</span>
                          </button>

                          {isSubCategoryDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-[1052]" onClick={() => setIsSubCategoryDropdownOpen(false)} />
                              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[1053] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                                <div className={`p-2 border-b ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-100"}`}>
                                  <input
                                    type="text"
                                    placeholder="بحث عن تصنيف فرعي..."
                                    className={`w-full border rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-emerald-500 transition-colors ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                                    value={subCategorySearch}
                                    onChange={(e) => setSubCategorySearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="max-h-[180px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubCategory("");
                                      setIsSubCategoryDropdownOpen(false);
                                      setSubCategorySearch("");
                                    }}
                                    className="w-full text-right px-3 py-2 text-[11px] text-slate-500 hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    إلغاء التحديد
                                  </button>
                                  {currentSubCategories
                                    .filter((s: any) => s.nameAr.toLowerCase().includes(subCategorySearch.toLowerCase()))
                                    .map((sub: any) => (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => {
                                          setSubCategory(sub.id);
                                          setIsSubCategoryDropdownOpen(false);
                                          setSubCategorySearch("");
                                        }}
                                        className={`w-full text-right px-3 py-2 text-[11px] rounded-lg transition-all flex items-center justify-between group cursor-pointer ${subCategory === sub.id ? "bg-emerald-500/10 text-emerald-400 font-bold" : "text-slate-300 hover:bg-slate-800"}`}
                                      >
                                        {subCategory === sub.id && <Check className="w-3 h-3 text-emerald-400" />}
                                        <span>{sub.nameAr}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {category === "other" && (
                  <div className="space-y-1.5 mt-2 bg-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl text-right">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                      <span>✏️ اكتب اسم القسم المخصص الجديد:</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: خناجر وعقيق يماني، مستلزمات طبية، أدوات طاقة شمسية..."
                      className={`w-full h-11 border rounded-xl px-4 outline-none text-xs text-right font-medium transition-colors ${isDark ? "bg-slate-950 border-emerald-500/30 focus:border-emerald-400 text-slate-200" : "bg-white border-slate-200 focus:border-emerald-500 text-slate-900"}`}
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-slate-500">
                      سيتم تصنيف إعلانك مباشرة تحت هذا القسم المخصص وعرضه للزوار.
                    </p>
                  </div>
                )}

                {/* Real Estate Specific Advanced Fields */}
                {category === "realestate" && (
                  <div className={`p-6 rounded-2xl space-y-6 text-right border transition-colors ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200 shadow-sm"}`}>
                    <div className="flex items-center gap-2 justify-end">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black text-white">تفاصيل العقار المتقدمة</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">نوع العقار</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "villa", label: "فيلا" },
                            { id: "apartment", label: "شقة" },
                            { id: "land", label: "أرض / مقسم" },
                            { id: "building", label: "عمارة / بيت" },
                            { id: "commercial", label: "تجاري" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setPropertyType(item.id)}
                              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${propertyType === item.id ? "bg-emerald-500 text-slate-950 border-emerald-500" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {propertyType !== "land" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 block">عدد الغرف</label>
                          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-1.5 w-max">
                            <button
                              type="button"
                              onClick={() => setRooms(Math.max(0, rooms - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-850 flex items-center justify-center text-slate-300 hover:text-white"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-white">{rooms}</span>
                            <button
                              type="button"
                              onClick={() => setRooms(rooms + 1)}
                              className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 hover:bg-emerald-400 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 block">الخدمات الأساسية المتوفرة</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {[
                          { id: "water", label: "مشروع مياه" },
                          { id: "electricity", label: "كهرباء" },
                          { id: "solar", label: "طاقة شمسية" },
                          { id: "well", label: "بئر / خزان" },
                          { id: "fiber", label: "إنترنت فايبر" },
                          { id: "parking", label: "موقف سيارات" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setAmenities((prev) => (prev.includes(item.id) ? prev.filter((i) => i !== item.id) : [...prev, item.id]));
                            }}
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${amenities.includes(item.id) ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-500"}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cars Specific Advanced Fields */}
                {category === "cars" && (
                  <div className={`p-6 rounded-2xl space-y-6 text-right border transition-colors ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200 shadow-sm"}`}>
                    <div className="flex items-center gap-2 justify-end">
                      <Sliders className="w-4 h-4 text-yellow-400" />
                      <h4 className="text-xs font-black text-white">تفاصيل السيارة المتقدمة</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">ماركة السيارة</label>
                        <select
                          className={`w-full h-11 border rounded-xl px-4 outline-none text-xs text-right cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-yellow-500" : "bg-white border-slate-200 text-slate-900 focus:border-yellow-500"}`}
                          value={make}
                          onChange={(e) => setMake(e.target.value)}
                        >
                          <option value="">اختر الماركة...</option>
                          {["تويوتا", "لكزس", "نيسان", "كيا", "هيونداي", "فورد", "مرسيدس", "هوندا"].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">سنة الصنع</label>
                        <select
                          className={`w-full h-11 border rounded-xl px-4 outline-none text-xs text-right cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-yellow-500" : "bg-white border-slate-200 text-slate-900 focus:border-yellow-500"}`}
                          value={modelYear}
                          onChange={(e) => setModelYear(e.target.value ? parseInt(e.target.value) : "")}
                        >
                          <option value="">اختر السنة...</option>
                          {Array.from({ length: 26 }, (_, i) => 2025 - i).map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">ناقل الحركة</label>
                        <div className="flex gap-2">
                          {[
                            { id: "automatic", label: "تماتيك" },
                            { id: "manual", label: "عادي" },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setTransmission(t.id)}
                              className={`flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${transmission === t.id ? "bg-yellow-500 text-slate-950 border-yellow-500" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">نوع الوقود</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "gasoline", label: "بترول" },
                            { id: "diesel", label: "ديزل" },
                            { id: "hybrid", label: "هايبرد" },
                            { id: "solar", label: "طاقة شمسية" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFuelType(f.id)}
                              className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${fuelType === f.id ? "bg-yellow-500/10 border-yellow-500 text-yellow-400" : "bg-slate-900 border-slate-800 text-slate-500"}`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Electronics Specific Advanced Fields */}
                {["electronics", "phones", "laptops"].includes(category) && (
                  <div className={`p-6 rounded-2xl space-y-6 text-right border transition-colors ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200 shadow-sm"}`}>
                    <div className="flex items-center gap-2 justify-end">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-black text-white">تفاصيل الجهاز المتقدمة</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">حالة الجهاز</label>
                        <select
                          className={`w-full h-11 border rounded-xl px-4 outline-none text-xs text-right cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                        >
                          {[
                            { id: "new", label: "جديد (كرت)" },
                            { id: "used_mint", label: "مستخدم (نظيف جداً)" },
                            { id: "used_good", label: "مستخدم (شبه جديد)" },
                            { id: "used_fair", label: "مستخدم (بحالة جيدة)" },
                          ].map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block">الماركة / الشركة</label>
                        <input
                          type="text"
                          placeholder="مثلاً: Apple, Samsung, Sony..."
                          className={`w-full h-11 border rounded-xl px-4 outline-none text-xs text-right font-medium transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Jobs Specific Advanced Fields */}
                {category === "jobs" && (
                  <div className={`p-6 rounded-2xl space-y-6 text-right border transition-colors ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200 shadow-sm"}`}>
                    <div className="flex items-center gap-2 justify-end">
                      <Briefcase className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-black text-white">نوع الإعلان الوظيفي</h4>
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setJobType("hiring")}
                        className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${jobType === "hiring" ? "bg-purple-500/10 border-purple-500 text-purple-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                      >
                        <span className="text-xl">🏢</span>
                        <span>أصحاب العمل (مطلوب موظف/توظيف)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setJobType("seeking")}
                        className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${jobType === "seeking" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                      >
                        <span className="text-xl">👨‍💻</span>
                        <span>سيرة ذاتية (أبحث عن عمل)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Selection (Active / Sold / Expired) */}
                <div className={`p-6 sm:p-8 rounded-3xl border transition-colors text-right ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  <div className="flex items-center gap-2 mb-6 justify-end">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <h3 className={`text-lg font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>حالة الإعلان الحالية</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "active", label: "نشط" },
                      { id: "sold", label: "مباع" },
                      { id: "expired", label: "منتهي" },
                    ].map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setAdStatus(status.id as any)}
                        className={`py-4 rounded-2xl text-xs font-black transition-all border flex flex-col items-center justify-center gap-2 cursor-pointer ${adStatus === status.id ? (status.id === "active" ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20" : status.id === "sold" ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20" : "bg-slate-700 text-white border-slate-600 shadow-lg shadow-slate-900/40") : isDark ? "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-500/50"}`}
                      >
                        <span className="text-[12px]">{status.label}</span>
                        {adStatus === status.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 1 actions */}
                <div className="flex justify-end pt-6 border-t border-slate-800/40">
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep(1)) setAdStep(2);
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-550 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                  >
                    <span>الخطوة التالية (الصور والوسائط) ➡️</span>
                  </button>
                </div>
              </div>
            )}

            {adStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                <div className={`p-6 sm:p-8 rounded-3xl border transition-colors text-right ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  <h3 className={`text-lg font-black flex items-center gap-2 mb-6 justify-end ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    <Camera className="text-emerald-500 w-5 h-5" />
                    صور وفيديو العرض (بحد أقصى 5)
                  </h3>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {adImages.map((img, idx) => (
                      <div key={idx} className={`relative group rounded-2xl aspect-square overflow-hidden border-2 flex items-center justify-center transition-all ${isDark ? "bg-slate-950 border-slate-800 shadow-xl shadow-black/20" : "bg-slate-100 border-slate-200 shadow-sm"}`}>
                        <img src={img} alt={`Ad img ${idx}`} className="w-full h-full object-cover" />
                        {idx === 0 && <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wider">الرئيسية</div>}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[1px]">
                          <button
                            type="button"
                            onClick={() => setAdImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-[10px] font-black shadow-lg transition-transform active:scale-95 border-none cursor-pointer"
                          >
                            حذف ❌
                          </button>
                        </div>
                      </div>
                    ))}

                    {adImages.length < 5 && (
                      <label className={`relative group rounded-2xl border-2 border-dashed p-4 transition-all flex flex-col items-center justify-center text-center aspect-square cursor-pointer min-h-[140px] ${isDark ? "border-slate-800 bg-slate-950 hover:border-emerald-500/50" : "border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50/50"}`}>
                        <Camera className={`w-8 h-8 mb-2 transition-colors ${isDark ? "text-slate-500 group-hover:text-emerald-400" : "text-slate-400 group-hover:text-emerald-600"}`} />
                        <span className={`text-[11px] font-black ${isDark ? "text-slate-200" : "text-slate-700"}`}>أضف صورة</span>
                        <span className="text-[9px] text-slate-500 mt-1">({adImages.length}/5)</span>
                        <input type="file" accept="image/*" multiple onChange={handleLocalImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Spotlight video record/url */}
                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 mt-4 text-right">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="text-right">
                        <label className="text-xs font-black text-slate-200">ترويج إعلانك بفيديو واقعي (Spotlight)</label>
                        <p className="text-[10px] text-slate-500 mt-0.5">صوّر بفيديو حيّ لزيادة مصداقية السلعة وسرعة البيع وضمان درع الأمان</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={uploadingVideo}
                      onClick={() => setShowVideoRecorder(true)}
                      className="bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-400 text-white text-[10px] font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer self-start sm:self-auto"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{uploadingVideo ? "جاري الرفع والمعالجة..." : "تصوير فيديو حقيقي مباشر 🎥"}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="ضع هنا رابط الفيديو (يوتيوب/تيك توك) أو صوّر فيديو واقعياً..."
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs outline-none transition-all pl-12 text-right ${isDark ? "bg-slate-950/70 border-slate-800 text-white focus:border-red-500" : "bg-white border-slate-200 text-slate-900 focus:border-red-500"}`}
                    />
                    {uploadingVideo && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-xl text-[9px] font-bold">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin shrink-0"></span>
                        <span>جاري الرفع: {videoProgress}%</span>
                        <button
                          type="button"
                          onClick={() => videoUploadXhr?.abort()}
                          className="bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black cursor-pointer transition-colors"
                        >
                          إلغاء ❌
                        </button>
                      </div>
                    )}
                    {!uploadingVideo && videoUrl && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold">
                        <Check className="w-2.5 h-2.5" />
                        جاهز وموثّق
                      </div>
                    )}
                  </div>
                </div>

                {showVideoRecorder && (
                  <VideoRecorder
                    onCapture={async (blob) => {
                      if (blob.size > 150 * 1024 * 1024) {
                        addToast?.("الملف كبير جداً ⚠️", "الحد الأقصى المسموح به للفيديوهات هو 150 ميجابايت.", "error");
                        return;
                      }

                      setUploadingVideo(true);
                      setVideoProgress(0);
                      setShowVideoRecorder(false);

                      const formData = new FormData();
                      const file = new File([blob], `recorded-${Date.now()}.webm`, { type: "video/webm" });
                      formData.append("file", file);

                      const uploadXhr = uploadFileWithProgress({
                        url: "/api/storage/upload",
                        formData,
                        onProgress: (percent) => {
                          setVideoProgress(percent);
                        },
                        onSuccess: (data) => {
                          if (data && (data.success || data.url)) {
                            setVideoUrl(data.url);
                            addToast?.("تم الرفع بنجاح ✅", "تم رفع ومعالجة الفيديو بنجاح.", "success");
                          } else {
                            const url = URL.createObjectURL(blob);
                            setVideoUrl(url);
                          }
                          setUploadingVideo(false);
                          setVideoUploadXhr(null);
                        },
                        onError: (err) => {
                          console.error("Video upload failed, falling back to local blob URL", err);
                          const url = URL.createObjectURL(blob);
                          setVideoUrl(url);
                          addToast?.("فشل الرفع ⚠️", "حدث خطأ أثناء رفع الفيديو للشبكة، تم الحفظ محلياً كمسودة.", "error");
                          setUploadingVideo(false);
                          setVideoUploadXhr(null);
                        },
                        onAbort: () => {
                          addToast?.("تم إلغاء الرفع ❌", "تم إلغاء رفع ملف الفيديو بطلب من المستخدم.", "info");
                          setUploadingVideo(false);
                          setVideoUploadXhr(null);
                        },
                      });

                      setVideoUploadXhr(uploadXhr);
                    }}
                    onClose={() => setShowVideoRecorder(false)}
                  />
                )}

                {/* Manual Image URL Option */}
                <div className="pt-2 text-right">
                  <p className="text-[10px] text-slate-400 font-bold mb-1.5">أو قم بلصق روابط إنترنت مباشرة للصور إضافية:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="أو اكتب رابط الصورة يدوياً واضغط إضافة..."
                      className={`flex-1 h-9 border rounded-lg px-3 text-[10px] outline-none text-right transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-700" : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"}`}
                      id="manual-image-url"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("manual-image-url") as HTMLInputElement;
                        if (input?.value?.trim()) {
                          if (adImages.length >= 5) {
                            addToast?.("خطأ", "الحد الأقصى للصور هو 5 صور", "error");
                            return;
                          }
                          setAdImages((prev) => {
                            const next = [...prev, input.value.trim()];
                            if (next.length === 1) handleAiAnalyzeImage(input.value.trim());
                            return next;
                          });
                          input.value = "";
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-4 rounded-lg cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setAdStep(1)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-slate-700"
                  >
                    <span>⬅️ السابق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdStep(3)}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-550 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                  >
                    <span>الخطوة التالية (الموقع والاتصال) ➡️</span>
                  </button>
                </div>
              </div>
            )}

            {adStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                {/* Geolocation selector */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl text-right border transition-colors ${isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">مدينة العرض</label>
                    <select
                      className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs text-right font-medium cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-900"}`}
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setDistrict("");
                      }}
                      id="ad-input-city"
                    >
                      {(currentMarket?.cities || CITIES).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">المنطقة (المديرية)</label>
                    <select
                      className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs text-right font-medium cursor-pointer transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-900"}`}
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      id="ad-input-district"
                    >
                      <option value="">كل المناطق</option>
                      {DISTRICTS.filter((d: any) => d.cityId === city).map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone Toggle */}
                <div className={`flex items-center justify-between p-4 rounded-xl mt-6 border transition-colors ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-xs font-bold text-slate-300">إظهار رقم الهاتف للتواصل المباشر (واتساب واتصال)</span>
                  <button
                    type="button"
                    onClick={() => setShowPhone(!showPhone)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 transition-all cursor-pointer ${showPhone ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"}`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </button>
                </div>

                {showPhone && (
                  <div className="space-y-1.5 mt-4 text-right">
                    <label className="text-xs font-bold text-slate-400 block">رقم التواصل المباشر للإعلان</label>
                    <input
                      type="text"
                      required
                      className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs font-mono text-right transition-colors ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-900"}`}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      id="ad-input-phone"
                    />
                  </div>
                )}

                {/* Toggle Map Visibility */}
                <div className={`flex items-center justify-between p-4 rounded-xl mt-6 border transition-colors ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-xs font-bold text-slate-300">ظهور الإعلان على الخريطة</span>
                  <button
                    type="button"
                    onClick={() => setShowOnMap(!showOnMap)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 transition-all cursor-pointer ${showOnMap ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"}`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </button>
                </div>

                {showOnMap && (
                  <div className={`p-4 rounded-xl mt-3 space-y-3 text-right border transition-colors ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-xs font-bold text-slate-300">📍 تحديد موقعي الدقيق بالـ GPS</span>
                        <span className="text-[10px] text-slate-500">لإظهار موقع هذا المنتج أو الخدمة بدقة متناهية على الخريطة للمشترين</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            setFetchingGps(true);
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                setLatitude(lat);
                                setLongitude(lng);
                                setFetchingGps(false);
                                if ((window as any)._createAdMinimap) {
                                  const { map, marker } = (window as any)._createAdMinimap;
                                  map.setView([lat, lng], 14, { animate: true });
                                  marker.setLatLng([lat, lng]);
                                }
                              },
                              (error) => {
                                console.error(error);
                                addToast?.("خطأ", "عذراً، فشل تحديد موقعك الجغرافي. تأكد من إعطاء إذن الوصول للمتصفح.", "error");
                                setFetchingGps(false);
                              },
                              { enableHighAccuracy: true, timeout: 6000 }
                            );
                          } else {
                            addToast?.("خطأ", "المتصفح لا يدعم تحديد الموقع الجغرافي.", "error");
                          }
                        }}
                        disabled={fetchingGps}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs rounded-lg font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {fetchingGps ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            جاري التحديد...
                          </>
                        ) : latitude !== null && longitude !== null ? (
                          "تحديث الموقع الحالي 🔄"
                        ) : (
                          "الحصول على موقعي 📍"
                        )}
                      </button>
                    </div>

                    {latitude !== null && longitude !== null ? (
                      <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2.5 border border-emerald-500/20">
                        <button
                          type="button"
                          onClick={() => {
                            setLatitude(null);
                            setLongitude(null);
                            if ((window as any)._createAdMinimap) {
                              const { map, marker } = (window as any)._createAdMinimap;
                              const cityCenter = currentMarket.cityCoordinates[city] || currentMarket.center;
                              map.setView([cityCenter.lat, cityCenter.lng], 13, { animate: true });
                              marker.setLatLng([cityCenter.lat, cityCenter.lng]);
                            }
                          }}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            تم التقاط موقعك الحالي بنجاح
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">خط العرض: {latitude.toFixed(6)} • خط الطول: {longitude.toFixed(6)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 font-medium text-right">
                        ⚠️ إذا لم تقم بتحديد موقعك بالـ GPS، فسيظهر إعلانك تلقائياً متمركزاً حول وسط المدينة المحددة في الإعلان.
                      </div>
                    )}

                    {/* Draggable Minimap */}
                    <div className="relative mt-2">
                      <div id="create-ad-minimap" className="w-full h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner z-[50]"></div>
                      <div className={`absolute top-2 right-2 p-1.5 rounded-lg text-[9px] font-black z-[60] border transition-colors ${isDark ? "bg-slate-950/90 text-slate-400 border-slate-800" : "bg-white/90 text-slate-700 border-slate-200 shadow-md"}`}>🗺️ اسحب الدبوس لتحديد الموقع الفعلي الدقيق</div>
                    </div>
                  </div>
                )}

                {/* Step 3 Actions */}
                <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setAdStep(2)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-slate-700 w-1/3"
                  >
                    ⬅️ السابق
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-grow flex items-center justify-center gap-2 bg-gradient-to-l from-emerald-500 to-cyan-500 text-slate-950 font-black h-12 rounded-xl text-sm transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                    id="ad-create-submit"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        {editingAd ? "جاري تحديث وحفظ الإعلان..." : `جاري نشر وإدراج الإعلان في أسواق ${currentMarket.labelAr}...`}
                      </>
                    ) : editingAd ? (
                      "حفظ وتحديث التعديلات الآن"
                    ) : (
                      "نشر وإدراج الإعلان في المنصة الآن"
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Side Tips / Support Column */}
      <div className="lg:col-span-1 space-y-6 text-right">
        {/* 1. Live preview card */}
        <div className={`p-6 rounded-[2rem] border transition-colors ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
          <h4 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-wider">👁️ معاينة البث والظهور المباشر</h4>
          <div className={`aspect-video w-full rounded-2xl overflow-hidden relative group border transition-colors ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200 shadow-inner"}`}>
            {adImages.length > 0 ? (
              <img src={adImages[0]} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                <Camera className="w-8 h-8" />
                <span className="text-[10px]">بانتظار إرفاق صور السلعة...</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
              <span className="text-[11px] font-black text-white truncate">{title || "عنوان إعلانك الرائع هنا..."}</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold mt-1">
                {price ? `${price} ${currency}` : "0.00 YER"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Marketing tips card */}
        <div className={`p-6 rounded-[2rem] border transition-colors ${isDark ? "bg-emerald-950/20 border-emerald-500/20 text-slate-300" : "bg-emerald-50/80 border-emerald-200 text-slate-800 shadow-sm"}`}>
          <div className="flex items-center gap-2 mb-3 justify-end">
            <span className="text-lg">💡</span>
            <h4 className={`text-xs font-black ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>كيف تبيع سلعتك بأسرع وقت؟</h4>
          </div>
          <ul className="space-y-3.5 text-[11px] font-medium leading-relaxed">
            <li className="flex items-start gap-2 justify-end">
              <span>ضع عنواناً مختصراً ودقيقاً يحتوي على الكلمات المفتاحية الأكثر بحثاً.</span>
              <span className="text-emerald-500 shrink-0">1.</span>
            </li>
            <li className="flex items-start gap-2 justify-end">
              <span>الصور عالية الدقة الملتقطة في إضاءة جيدة تزيد المبيعات بنسبة 70%.</span>
              <span className="text-emerald-500 shrink-0">2.</span>
            </li>
            <li className="flex items-start gap-2 justify-end">
              <span>استعن بميزة "تحسين الوصف بالذكاء الاصطناعي" للحصول على صياغة احترافية مميزة.</span>
              <span className="text-emerald-500 shrink-0">3.</span>
            </li>
            <li className="flex items-start gap-2 justify-end">
              <span>أضف موقعك بالـ GPS ليجدك المشترون القريبون منك بكل سهولة عبر الخريطة.</span>
              <span className="text-emerald-500 shrink-0">4.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}


