/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  MapPin,
  Gem,
  Car,
  Home,
  Tv,
  Smartphone,
  Briefcase,
  Sofa,
  Shield,
  BadgePercent,
  Laptop,
  Shirt,
  Wrench,
  Leaf,
  Bike,
  Truck,
  BookOpen,
  Utensils,
  HeartPulse,
  Hammer,
  Palette,
  Hexagon,
  ArrowRight,
  TrendingUp,
  Store,
  Mic,
  MicOff,
  Building,
  Hotel,
  Palmtree,
  CarFront,
  Play,
  Pause,
} from "lucide-react";
import { CITIES, CATEGORIES, DISTRICTS } from "../data.ts";
import { Category, City, Ad } from "../types.ts";
import { Market, getCurrencyAr } from "../markets.ts";

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  cars: Car,
  realestate: Home,
  electronics: Tv,
  phones: Smartphone,
  laptops: Laptop,
  rentals: Building,
  hotels: Hotel,
  resorts: Palmtree,
  car_rental: CarFront,
  furniture: Sofa,
  clothing: Shirt,
  jobs: Briefcase,
  services: Wrench,
  livestock: Leaf,
  bicycles: Bike,
  trucks: Truck,
  educational: BookOpen,
  food: Utensils,
  medical: HeartPulse,
  perfumes: Gem,
  construction: Hammer,
  custom_work: Palette,
  other: Hexagon,
};

const CATEGORY_BACKGROUNDS: Record<string, string> = {
  cars: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=50",
  realestate:
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=50",
  electronics:
    "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=400&q=50",
  phones:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=50",
  laptops:
    "https://images.unsplash.com/photo-1603481588273-2f908a9a7a1b?auto=format&fit=crop&w=400&q=50",
  rentals:
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=50",
  hotels:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=50",
  resorts:
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=400&q=50",
  car_rental:
    "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=400&q=50",
  furniture:
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=400&q=50",
  clothing:
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=50",
  jobs: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=50",
  services:
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=50",
  livestock:
    "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=400&q=50",
  bicycles:
    "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=400&q=50",
  trucks:
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=50",
  educational:
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=400&q=50",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=50",
  medical:
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=400&q=50",
  perfumes:
    "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=400&q=50",
  construction:
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=50",
  custom_work:
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=50",
  other:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=50",
};

interface HeroProps {
  onSearch: (filters: {
    query: string;
    category: string;
    city: string;
    district?: string;
  }) => void;
  onOpenAiAssistant: () => void;
  onSelectAd: (ad: Ad) => void;
  currentMarket: Market;
  isDark: boolean;
  categories?: any[];
  ads?: Ad[];
}

export default function Hero({
  onSearch,
  onOpenAiAssistant,
  onSelectAd,
  currentMarket,
  isDark,
  categories: categoriesProp,
  ads = [],
}: HeroProps) {
  const categories = categoriesProp || CATEGORIES;
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const carouselItems = React.useMemo(() => {
    const activeAndFeatured = (ads || []).filter(
      (ad) => ad.status === "active" && ad.isFeatured
    );
    if (activeAndFeatured.length > 0) {
      return activeAndFeatured.slice(0, 6);
    }
    return (ads || [])
      .filter((ad) => ad.status === "active")
      .slice(0, 6);
  }, [ads]);

  useEffect(() => {
    if (carouselItems.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselItems.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [carouselItems.length, isPaused]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [searchResults, setSearchResults] = useState<Ad[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return; // it will stop automatically when we set state or we can call recognition.stop() but we don't have reference.
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(isRtl ? "متصفحك لا يدعم البحث الصوتي" : "Your browser does not support voice search");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = isRtl ? 'ar-SA' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      performInstantSearch(transcript);
      setShowResults(true);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const districts = DISTRICTS.filter((d) => d.cityId === city);

  useEffect(() => {
    setDistrict("");
  }, [city]);

  const performInstantSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/ads/search?q=${encodeURIComponent(q)}&limit=5`,
      );
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setSearchResults(data.slice(0, 5));
      } else {
        console.warn("Search API returned non-JSON or error", res.status);
      }
    } catch (e) {
      console.error("Instant search failed", e);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) performInstantSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performInstantSearch]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowResults(false);
    onSearch({ query, category, city, district });
  };

  const handleCategorySelect = (id: string) => {
    // If clicking already selected, toggle off, else set
    const val = category === id ? "" : id;
    setCategory(val);
    onSearch({ query, category: val, city });
  };

  return (
    <div className={`border-b transition-colors duration-305 ${isRtl ? 'dir-rtl text-right' : 'dir-ltr text-left'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
      {/* Unique Premium Hero Area */}
      <div className="w-full relative h-[400px] md:h-[450px] overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1542459955-44cb294975d0?auto=format&fit=crop&w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 to-transparent" />

        <div className="relative z-10 px-4 text-center max-w-4xl mx-auto flex flex-col items-center -mt-16 sm:-mt-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black mb-6 backdrop-blur-md uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/5">
            <Shield className="w-3.5 h-3.5" />
            <span>{t('hero.safeTrade', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4 tracking-tighter drop-shadow-2xl">
            {isRtl ? (
              <>أسواق <span className="text-emerald-400">{currentMarket.labelAr}</span></>
            ) : (
              <><span className="text-emerald-400">{currentMarket.labelEn}</span> {t('hero.market')}</>
            )}
          </h1>
          <p className="text-sm md:text-lg text-slate-300 max-w-2xl font-bold leading-relaxed mb-8 opacity-90">
            {t('hero.description')}
          </p>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex flex-col items-center">
        {/* Dynamic Search Block */}
        <div className="w-full md:w-[85%] lg:w-[75%] -mt-12 md:-mt-16 mb-12 z-20">
          <form
            onSubmit={handleSearchSubmit}
            className={`flex flex-col md:flex-row rounded-2xl items-stretch shadow-2xl overflow-hidden border transition-all ${isDark ? 'bg-slate-900 border-slate-800 shadow-black/40 ring-slate-800/50' : 'bg-white border-slate-200 shadow-slate-200/60 ring-slate-100'}`}
            id="hero-search-form"
          >
            {/* Submit search button */}
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black h-14 md:h-18 px-10 flex items-center justify-center gap-2 transition-all w-full md:w-auto text-lg shadow-inner active:scale-95 cursor-pointer"
              id="search-submit-btn"
            >
              <Search className="w-5 h-5 stroke-[3]" />
              {t('hero.search')}
            </button>
              <div className={`flex-1 flex items-center border-l md:border-l-0 border-r relative transition-colors pr-12 lg:pr-14 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute ${isRtl ? 'left-3' : 'right-3'} p-2.5 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 animate-pulse'
                    : isDark
                      ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
                title={isListening ? (isRtl ? "إيقاف الاستماع" : "Stop Listening") : (isRtl ? "بحث صوتي" : "Voice Search")}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              <input
                type="text"
                placeholder={t('hero.searchPlaceholder')}
                className={`w-full bg-transparent text-sm h-14 md:h-18 outline-none font-bold px-6 transition-colors ${isRtl ? 'text-right' : 'text-left'} ${isDark ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                id="search-input-query"
              />

              {/* Instant Search Results Dropdown */}
              {showResults && query.length >= 2 && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowResults(false)}
                  />
                  <div className={`absolute top-full left-0 right-0 mt-3 border shadow-2xl rounded-2xl overflow-hidden z-50 transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className={`p-3 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                      <span className="text-[10px] font-black tracking-widest uppercase">
                        {t('hero.smartSearchResults')}
                      </span>
                      {searching && (
                        <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {searchResults.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto">
                        {searchResults.map((ad) => (
                          <button
                            key={ad.id}
                            type="button"
                            onClick={() => {
                              onSelectAd(ad);
                              setShowResults(false);
                            }}
                            className={`w-full p-4 flex items-center gap-4 transition-colors border-b last:border-0 group cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-50 hover:bg-emerald-50/50'}`}
                          >
                            <div className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border transition-colors ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                              <img src={ad.images?.[0] || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-bold truncate group-hover:text-emerald-600 transition-colors ${isDark ? 'text-slate-100 dark:text-white' : 'text-slate-900'}`}>
                                {ad.title}
                              </h4>
                              <p className="text-[11px] font-black text-emerald-600 mt-1">
                                {ad.price.toLocaleString()} {ad.currency}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      !searching && (
                        <div className="p-10 text-center text-slate-400 text-sm font-bold">
                          {t('hero.noMatches')}
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
            {/* City */}
            <div className={`flex items-center px-6 transition-colors ${isRtl ? 'md:border-r' : 'md:border-l'} ${isDark ? 'bg-slate-900 border-slate-800 focus-within:bg-slate-800/50' : 'bg-white border-slate-100 focus-within:bg-emerald-50/30'}`}>
              <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
              <select
                className={`w-full md:w-auto bg-transparent text-sm h-14 md:h-18 outline-none cursor-pointer font-black appearance-none mx-2 pr-2 transition-colors ${isRtl ? 'text-right' : 'text-left'} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                value={city}
                onChange={(e) => {
                  const val = e.target.value;
                  setCity(val);
                  onSearch({ query, category, city: val, district });
                }}
                id="search-input-city"
              >
                <option value="" className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-800"}>{t('hero.allRegions')}</option>
                <option value="gps" className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-800"}>📍 {t('hero.nearest')}</option>
                {currentMarket.cities.map((c) => (
                  <option key={c.id} value={c.id} className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-800"}>{isRtl ? c.nameAr : c.nameEn}</option>
                ))}
              </select>
            </div>
          </form>
        </div>

        {/* Featured Ads Slideshow (Carousel) */}
        {carouselItems.length > 0 && (
          <div className="w-full md:w-[85%] lg:w-[75%] mb-12 relative animate-fade-in" id="featured-carousel-block">
            <div className={`flex items-center justify-between mb-4 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className={`w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ${isPaused ? '' : 'animate-pulse'}`} />
                {isRtl ? 'أحدث العروض المميزة المثبتة' : 'Latest Featured Showcase'}
              </h3>
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-black px-3 py-1 sm:py-1.5 rounded-full border shadow-sm transition-all duration-300 cursor-pointer ${
                  isPaused 
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20' 
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
                title={isPaused ? (isRtl ? 'تفعيل التمرير التلقائي' : 'Enable auto-scroll') : (isRtl ? 'إيقاف التمرير التلقائي مؤقتاً' : 'Pause auto-scroll')}
              >
                {isPaused ? <Play className="w-3 h-3 animate-pulse" /> : <Pause className="w-3 h-3" />}
                <span>{isPaused ? (isRtl ? 'متوقف مؤقتاً' : 'Paused') : (isRtl ? 'تمرير تلقائي نشط' : 'Auto-scroll active')}</span>
              </button>
            </div>

            <div 
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className={`relative h-[200px] sm:h-[240px] rounded-3xl overflow-hidden border transition-all duration-500 hover:animate-gentle-pulse hover:border-emerald-500/40 hover:shadow-lg ${
                isDark 
                  ? 'bg-slate-900/40 border-slate-800 shadow-2xl shadow-black/40 hover:shadow-emerald-500/5' 
                  : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-emerald-500/10'
              }`} 
              id="featured-carousel-container"
            >
              {/* Slides wrapper with slide animation effect */}
              <div className="w-full h-full relative overflow-hidden">
                {carouselItems.map((ad, idx) => {
                  const safeImgs = Array.isArray(ad.images)
                    ? ad.images
                    : typeof ad.images === 'string'
                      ? (() => { try { return JSON.parse(ad.images); } catch (e) { return []; } })()
                      : [];
                  const displayImg = safeImgs[0] || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';

                  const cityObj = currentMarket.cities.find((c) => c.id === ad.city);
                  const cityName = cityObj ? (isRtl ? cityObj.nameAr : cityObj.nameEn) : ad.city;
                  const catObj = CATEGORIES?.find?.((c: any) => c.id === ad.category);
                  const catName = catObj ? (isRtl ? catObj.nameAr : catObj.nameEn) : ad.category;
                  const isActive = idx === activeSlide;

                  return (
                    <div
                      key={ad.id}
                      onClick={() => onSelectAd(ad)}
                      className={`absolute inset-0 w-full h-full flex flex-row transition-all duration-750 ease-in-out cursor-pointer group ${
                        isActive 
                          ? 'opacity-100 translate-x-0 z-10' 
                          : 'opacity-0 z-0'
                      }`}
                      style={{
                        transform: isActive 
                          ? 'none' 
                          : isRtl 
                            ? `translateX(${idx > activeSlide ? '100%' : '-100%'})`
                            : `translateX(${idx > activeSlide ? '-100%' : '100%'})`
                      }}
                      id={`carousel-slide-${ad.id}`}
                    >
                      {/* Left: Content Area */}
                      <div className={`flex-1 p-5 sm:p-7 flex flex-col justify-between h-full relative z-10 text-right ${isRtl ? 'order-1' : 'order-2 text-left'}`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="space-y-1.5 sm:space-y-2 pointer-events-none">
                          <div className={`flex flex-wrap items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                            <span className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 px-2.5 py-0.5 rounded-lg font-black">{catName}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 font-bold">
                              <MapPin className="w-3 h-3 text-emerald-500" />
                              {cityName}
                            </span>
                          </div>

                          <h4 className={`text-sm sm:text-xl font-black leading-tight line-clamp-1 sm:line-clamp-2 transition-colors group-hover:text-emerald-500 ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            {ad.title}
                          </h4>

                          {ad.description && (
                            <p className="hidden sm:line-clamp-2 text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed max-w-xl">
                              {ad.description}
                            </p>
                          )}
                        </div>

                        {/* Price & Action footer */}
                        <div className={`flex items-center justify-between gap-4 mt-auto ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                          {/* Price */}
                          <div className="flex flex-col text-right">
                            <span className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase">{isRtl ? 'السعر المقترح' : 'Pricing'}</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-sm sm:text-2xl font-black text-emerald-500 font-sans tracking-tight">
                                {ad.price.toLocaleString()}
                              </span>
                              <span className="text-[10px] sm:text-xs text-emerald-600 font-bold">
                                {isRtl ? getCurrencyAr(ad.currency) : ad.currency}
                              </span>
                            </div>
                          </div>

                          {/* CTA action button */}
                          <div className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] sm:text-xs transition-colors shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25 active:scale-95 duration-300">
                            <span>{isRtl ? 'تفاصيل العرض' : 'Deal Details'}</span>
                            <ArrowRight className={`w-3 sm:w-3.5 h-3 sm:h-3.5 transform transition-transform ${isRtl ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>

                      {/* Right/Left side: Visual display Image */}
                      <div className={`w-[35%] sm:w-[45%] h-full relative shrink-0 overflow-hidden ${isRtl ? 'order-2' : 'order-1'}`}>
                        <img 
                          src={displayImg || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80'} 
                          alt={ad.title}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-r pointer-events-none ${
                          isRtl 
                            ? isDark ? 'from-slate-900 via-slate-900/50 to-transparent' : 'from-white via-white/30 to-transparent'
                            : isDark ? 'from-transparent via-slate-900/50 to-slate-900' : 'from-transparent via-white/30 to-white'
                        }`} />
                        
                        {/* Featured badge */}
                        <div className={`absolute top-3 ${isRtl ? 'left-3' : 'right-3'}`}>
                          <span className="bg-amber-500 text-slate-1000 dark:text-slate-950 font-black text-[9px] px-2.5 py-1 rounded-full shadow-lg border border-amber-400 flex items-center gap-1 shrink-0">
                            ★ {isRtl ? 'مميز VIP' : 'VIP PRO'}
                          </span>
                        </div>

                        {/* Hover Pause Button visual indicator */}
                        <div className={`absolute bottom-3 ${isRtl ? 'right-3' : 'left-3'} z-30 transition-all duration-300 opacity-80 sm:opacity-0 sm:group-hover:opacity-100`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsPaused(!isPaused);
                            }}
                            className="bg-slate-950/70 hover:bg-slate-950 text-white w-8 h-8 rounded-xl border border-white/10 shadow-lg transition-all active:scale-90 duration-200 flex items-center justify-center cursor-pointer"
                            title={isPaused ? (isRtl ? 'متابعة التمرير التلقائي' : 'Resume auto-scroll') : (isRtl ? 'إيقاف مؤقت' : 'Pause auto-scroll')}
                          >
                            {isPaused ? (
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Pause className="w-3.5 h-3.5 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>



              {/* Dots Indicators */}
              {carouselItems.length > 1 && (
                <div className={`absolute bottom-3 ${isRtl ? 'left-6' : 'right-6'} z-20 flex gap-1.5`}>
                  {carouselItems.map((_, dIdx) => (
                    <button
                      key={dIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide(dIdx);
                      }}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        dIdx === activeSlide 
                          ? 'w-5 bg-emerald-500 shadow-sm shadow-emerald-500/20' 
                          : 'w-1.5 bg-slate-400 opacity-40 hover:opacity-100 hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Quick Filter icons */}
        <div className="w-full">
          <div className="mb-10">
             <div className="flex items-center gap-3 mb-4 overflow-x-auto no-scrollbar pb-2">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{t('hero.citiesTitle')}:</span>
               {currentMarket.cities.slice(0, 6).map(c => (
                 <button
                   key={c.id}
                   onClick={() => {
                     setCity(c.id);
                     onSearch({ query, category, city: c.id, district });
                     document.getElementById('ad-interactive-map')?.scrollIntoView({ behavior: 'smooth' });
                   }}
                   className={`px-4 py-2 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${city === c.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-500'}`}
                 >
                   <MapPin className={`w-3 h-3 ${city === c.id ? 'text-white' : 'text-emerald-500'}`} />
                   {isRtl ? c.nameAr : c.nameEn}
                 </button>
               ))}
               <button 
                 onClick={() => {
                    document.getElementById('ad-interactive-map')?.scrollIntoView({ behavior: 'smooth' });
                 }}
                 className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 underline underline-offset-4 decoration-emerald-500/30 shrink-0 cursor-pointer"
               >
                 {t('hero.showMap')}
               </button>
             </div>
          </div>

          <div className={`flex items-center justify-between xl:justify-start xl:gap-8 mb-6 pb-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
            <button className={`text-sm font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 group cursor-pointer ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
              <ArrowRight className={`w-4 h-4 transition-transform ${isRtl ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              {t('hero.browseAll')}
            </button>
            <h2 className={`text-2xl font-extrabold tracking-tight ${isRtl ? 'ml-auto' : 'mr-auto'} ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('hero.browseTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {categories.filter(c => c.id !== 'other').map((cat, index) => {
               const worksAsSelected = category === cat.id;
               const IconComponent = CATEGORY_ICONS[cat.id] || Hexagon;
               const bgImage =
                 CATEGORY_BACKGROUNDS[cat.id] || CATEGORY_BACKGROUNDS.other;

               const isPromoted = index === 0 || index === 1;

               return (
                 <button
                   key={cat.id}
                   type="button"
                   onClick={() => handleCategorySelect(cat.id)}
                   className={`relative p-5 rounded-2xl flex flex-col items-center justify-between text-center h-[130px] outline-none group cursor-pointer transition-all duration-300 overflow-hidden border ${
                     worksAsSelected
                       ? "border-emerald-500 shadow-xl shadow-emerald-500/20 scale-105 z-10"
                       : isDark ? "border-slate-800 hover:border-emerald-500" : "border-slate-100 hover:border-emerald-400 shadow-sm shadow-slate-100/50"
                   }`}
                   id={`hero-category-${cat.id}`}
                 >
                   {/* Background Image */}
                   <img src={bgImage || 'https://images.unsplash.com/photo-1541746972996-4e0b0f43e01a?auto=format&fit=crop&w=600&q=80'} className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${worksAsSelected ? "opacity-100 scale-105" : "opacity-80 group-hover:scale-110 group-hover:opacity-100 saturate-[0.25] group-hover:saturate-100"}`} alt="" />
                   {/* Gradient Overlay - Adds the artistic touch */}
                   <div
                     className={`absolute inset-0 transition-all duration-500 ${worksAsSelected ? "bg-emerald-900/30 dark:bg-slate-900/40 mix-blend-multiply" : isDark ? "bg-slate-950/75 group-hover:bg-slate-950/30" : "bg-white/75 group-hover:bg-white/30"}`}
                   />
                   <div
                     className={`absolute inset-0 bg-gradient-to-t ${worksAsSelected ? "from-emerald-900 via-emerald-900/60 to-transparent dark:from-slate-900 dark:via-slate-900/80" : isDark ? "from-slate-950 via-slate-950/80 to-transparent" : "from-white via-white/80 to-transparent"}`}
                   />

                   {isPromoted && !worksAsSelected && (
                     <span className={`absolute top-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm z-20 ${isRtl ? 'right-2' : 'left-2'}`}>
                       {isRtl ? 'رائج' : 'Hot'}
                     </span>
                   )}

                   <div
                     className={`mt-2 transition-transform duration-300 relative z-10 ${worksAsSelected ? "scale-110 text-white" : isDark ? "text-emerald-400 group-hover:scale-110 group-hover:-translate-y-1" : "text-emerald-700 group-hover:scale-110 group-hover:-translate-y-1"}`}
                   >
                     <IconComponent className="w-10 h-10 stroke-[2.5]" />
                   </div>

                   <div
                     className={`text-[12px] sm:text-[14px] font-bold leading-snug select-none tracking-tight w-full line-clamp-2 mt-auto relative z-10 p-1.5 rounded-lg ${worksAsSelected ? "text-white font-black drop-shadow-md" : isDark ? "text-slate-200" : "text-slate-800"}`}
                   >
                     {isRtl ? cat.nameAr : cat.nameEn}
                   </div>
                 </button>
               );
            })}
          </div>
        </div>

        {/* Promo Actions - Unique custom cards */}
        <div className={`mt-12 pt-10 border-t grid grid-cols-1 md:grid-cols-2 gap-6 w-full pb-10 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`bg-gradient-to-br from-emerald-900 to-slate-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between text-center relative overflow-hidden group ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className={`flex-1 relative z-10 w-full ${isRtl ? 'order-2 md:order-1 mt-6 md:mt-0 md:pl-8' : 'order-1 md:pr-8'}`}>
              <h3 className="text-2xl font-black text-white mb-3">
                {t('hero.sellTitle')}
              </h3>
              <p className="text-sm text-slate-300 mb-6 max-w-xs md:max-w-none mx-auto md:mx-0 font-medium">
                {t('hero.sellDescription', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
              </p>
              <button 
                onClick={() => {
                  onSearch({ query: "", category: "", city: "" });
                  document.getElementById('nav-btn-create')?.click();
                }}
                className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3.5 px-8 rounded-xl transition-colors text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {t('hero.sellButton')}
              </button>
            </div>
            <div className={`w-32 h-32 md:w-40 md:h-40 bg-emerald-800/30 rounded-2xl flex items-center justify-center border border-emerald-500/20 relative z-10 backdrop-blur-sm group-hover:scale-105 transition-transform duration-500 ${isRtl ? 'order-1 md:order-2' : 'order-2'}`}>
              <Store className="w-16 h-16 text-emerald-400" />
            </div>
          </div>

          <div className={`bg-white dark:bg-slate-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between text-center border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
            <div className={`flex-1 relative z-10 w-full ${isRtl ? 'order-2 md:order-1 mt-6 md:mt-0 md:pl-8' : 'order-1 md:pr-8'}`}>
              <div className={`flex items-center gap-2 mb-2 justify-center ${isRtl ? 'md:justify-start' : 'md:justify-start'}`}>
                 <span className="text-[10px] font-black text-amber-500 tracking-widest uppercase">{t('hero.discoveryLabel')}</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3 leading-tight">
                {t('hero.discoveryTitle', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs md:max-w-none mx-auto md:mx-0">
                {t('hero.discoveryDescription')}
              </p>
              <button 
                onClick={() => (window as any).toggleDiscovery?.()}
                className="w-full md:w-auto bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-bold py-3.5 px-8 rounded-xl transition-colors text-sm shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                {t('hero.discoveryButton')}
              </button>
            </div>
            <div className={`w-32 h-32 md:w-40 md:h-40 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 relative z-10 group-hover:scale-105 transition-transform duration-500 ${isRtl ? 'order-1 md:order-2' : 'order-2'}`}>
              <TrendingUp className="w-16 h-16 text-emerald-600 dark:text-emerald-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
