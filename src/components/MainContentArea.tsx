import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { Search, SearchX, RotateCcw, Sparkles, MapPin, X } from "lucide-react";
import AdCard from "./AdCard";
import { Ad } from "../types";
import { Market } from "../markets";
import type { AdMapHandle } from "../modules/maps/AdMap.tsx";

const AdMap = React.lazy(() => import("../modules/maps/AdMap.tsx"));

interface Props {
  viewMode: "map" | "grid";
  filteredAds: Ad[];
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  setSelectedAd: (ad: Ad) => void;
  referenceCoords: { lat: number; lng: number } | null;
  currentMarket: Market;
  favorites: string[];
  handleLikeToggle: (adId: string) => void;
  platformMode?: 'marketplace' | 'delivery' | 'social' | 'reels';
  onPlatformModeChange?: (mode: 'marketplace' | 'delivery' | 'social' | 'reels') => void;
  loading?: boolean;
  isDark?: boolean;
  onMapRef?: (ref: AdMapHandle | null) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onOpenAiAssistant?: () => void;
  selectedCategory?: string;
  onClearCategory?: () => void;
}

export default function MainContentArea({
  viewMode,
  filteredAds,
  selectedCity,
  setSelectedCity,
  setSelectedAd,
  referenceCoords,
  currentMarket,
  favorites,
  handleLikeToggle,
  platformMode,
  onPlatformModeChange,
  loading,
  isDark,
  onMapRef,
  hasMore,
  loadingMore,
  onLoadMore,
  searchQuery,
  onClearSearch,
  onOpenAiAssistant,
  selectedCategory,
  onClearCategory,
}: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-trigger loadMore when sentinel enters viewport (IntersectionObserver infinite scroll)
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);
  
  if (viewMode === "map") {
    return (
      <div id="ad-interactive-map" className={`h-[60vh] rounded-3xl overflow-hidden border shadow-2xl relative transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-slate-900/10"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <AdMap
            ref={onMapRef}
            ads={filteredAds}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            onSelectAd={setSelectedAd}
            referenceCoords={referenceCoords}
            center={currentMarket.center}
            cityCoordinates={currentMarket.cityCoordinates}
            marketCityIds={currentMarket.cities.map(c => c.id)}
            platformMode={platformMode}
            onPlatformModeChange={onPlatformModeChange}
            countryCode={currentMarket.countryCode}
          />
        </React.Suspense>
      </div>
    );
  }

  // "Load More" button – shown when hasMore=true and no IntersectionObserver fallback
  const renderLoadMore = () => {
    if (!hasMore && !loadingMore) return null;
    return (
      <div ref={sentinelRef} className="flex justify-center mt-10 mb-6">
        <button
          id="load-more-ads-btn"
          onClick={onLoadMore}
          disabled={loadingMore}
          className={`group relative flex items-center gap-3 px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 shadow-lg ${
            isDark
              ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-blue-500/30 hover:shadow-xl hover:scale-105'
              : 'bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:shadow-blue-400/30 hover:shadow-xl hover:scale-105'
          } disabled:opacity-60 disabled:scale-100 disabled:cursor-not-allowed`}
        >
          {loadingMore ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{isRtl ? 'جاري التحميل...' : 'Loading...'}</span>
            </>
          ) : (
            <>
              <span>{isRtl ? 'تحميل المزيد من الإعلانات' : 'Load More Listings'}</span>
              <span className="text-lg transition-transform group-hover:translate-y-0.5">↓</span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <main role="main" className="w-full flex flex-col gap-6 relative">
      
      {/* Interactive Map: Horizontal Top Layout (visible on desktop) */}
      <div id="ad-interactive-map" className={`hidden md:block w-full h-[325px] rounded-3xl overflow-hidden border shadow-xl relative transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200 shadow-slate-200/50'}`}>
        <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-slate-900/10"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <AdMap
            ref={onMapRef}
            ads={filteredAds}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            onSelectAd={setSelectedAd}
            referenceCoords={referenceCoords}
            center={currentMarket.center}
            cityCoordinates={currentMarket.cityCoordinates}
            marketCityIds={currentMarket.cities.map(c => c.id)}
            platformMode={platformMode}
            onPlatformModeChange={onPlatformModeChange}
            countryCode={currentMarket.countryCode}
          />
        </React.Suspense>
      </div>

      {/* Live Streams Horizontal List */}
      {filteredAds.some(ad => ad.isLive) && !loading && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-xl font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              {isRtl ? 'البث المباشر المتاح حالياً' : 'Live Streams Available Now'}
            </h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filteredAds.filter(ad => ad.isLive).map(ad => (
              <div key={ad.id} className="min-w-[280px] sm:min-w-[320px] snap-center shrink-0">
                <AdCard
                  ad={ad}
                  isFavorite={favorites.includes(ad.id)}
                  onLikeToggle={handleLikeToggle}
                  onClick={() => setSelectedAd(ad)}
                  currentMarket={currentMarket}
                  isDark={isDark}
                />
              </div>
            ))}
          </div>
          <hr className={`my-2 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`} />
        </div>
      )}

      {/* Active Search Results Banner Header */}
      {searchQuery && (
        <div id="search-results-anchor" className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-emerald-50/70 border-emerald-200/70 text-slate-800'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Search className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {isRtl ? 'نتائج البحث عن:' : 'Search results for:'}
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                  "{searchQuery}"
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {loading 
                  ? (isRtl ? '⏳ جاري البحث في قاعدة البيانات...' : '⏳ Searching database...') 
                  : (isRtl ? `✓ تم العثور على (${filteredAds.length}) إعلان مطابقة` : `✓ Found (${filteredAds.length}) matching ads`)
                }
              </p>
            </div>
          </div>

          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className={`self-end sm:self-center px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border cursor-pointer active:scale-95 ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
              }`}
            >
              <X className="w-3.5 h-3.5 text-rose-500" />
              {isRtl ? 'إلغاء البحث والعودة' : 'Clear search'}
            </button>
          )}
        </div>
      )}

      {/* Empty State when no ads match */}
      {!loading && filteredAds.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`w-full my-6 p-8 sm:p-14 rounded-3xl border text-center flex flex-col items-center justify-center relative overflow-hidden ${
            isDark 
              ? 'bg-slate-900/80 border-slate-800 text-slate-200 shadow-2xl' 
              : 'bg-white border-slate-200 text-slate-800 shadow-xl shadow-slate-100'
          }`}
        >
          {/* Decorative backdrop gradients */}
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 border shadow-inner ${
            isDark ? 'bg-slate-800/90 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
            <SearchX className="w-10 h-10 stroke-[2]" />
          </div>

          <h3 className="text-xl sm:text-2xl font-black mb-3 text-slate-900 dark:text-white">
            {searchQuery 
              ? (isRtl ? `لم نتمكن من العثور على أي نتائج مطابقة لـ "${searchQuery}"` : `No matching results found for "${searchQuery}"`)
              : (isRtl ? 'لا توجد إعلانات مطابقة للخيارات المحددة' : 'No ads found matching your criteria')
            }
          </h3>

          <p className={`text-xs sm:text-sm max-w-lg mb-8 leading-relaxed font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {searchQuery 
              ? (isRtl 
                  ? 'لم يتم العثور على إعلانات بهذا الاسم. جرّب البحث بكلمات عامة أخرى (مثل: شقق، سيارات، أثاث...)، أو اختر "كل المناطق" لتوسيع نطاق البحث.' 
                  : 'No ads found matching this query. Try searching with other common terms (e.g., apartments, cars, furniture...), or select "All Regions" to broaden your search.')
              : (isRtl
                  ? 'لم يتم نشر إعلانات نشطة بهذه المواصفات بعد. جرب إلغاء بعض الفلاتر لعرض مزيد من العروض.'
                  : 'No active ads currently match these specifications. Try clearing some filters to see more results.')
            }
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5">
            {(searchQuery || selectedCity || selectedCategory) && onClearSearch && (
              <button
                onClick={onClearSearch}
                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                {isRtl ? 'عرض كافة الإعلانات المتاحة' : 'View All Available Ads'}
              </button>
            )}

            {selectedCity && (
              <button
                onClick={() => setSelectedCity('')}
                className={`px-5 py-3.5 rounded-2xl border font-black text-xs sm:text-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4 text-emerald-500" />
                {isRtl ? 'البحث في كل المناطق' : 'Search in All Regions'}
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        /* Ads Grid - Expanded Full Width */
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <AdCard key={`skeleton-${i}`} loading={true} />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredAds.map((ad, index) => (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(index % 20, 8) * 0.04 }}
                >
                  <AdCard
                    ad={ad}
                    isFavorite={favorites.includes(ad.id)}
                    onLikeToggle={handleLikeToggle}
                    onClick={() => setSelectedAd(ad)}
                    currentMarket={currentMarket}
                    isDark={isDark}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {!loading && renderLoadMore()}
    </main>
  );
}
