import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import AdCard from "./AdCard";
import AdMap from "../modules/maps/AdMap.tsx";
import { Ad } from "../types";
import { Market } from "../markets";
import { AdMapHandle } from "../modules/maps/AdMap.tsx";

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
        <div className={`absolute top-4 right-4 z-10 backdrop-blur-md border p-3 rounded-2xl text-[10px] max-w-[200px] transition-colors ${isDark ? 'bg-black/60 border-slate-700/50 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600 shadow-lg'}`}>
          {t('hero.mapWatermark', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
        </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
      {/* Left Column: Ads Grid */}
      <div className="flex flex-col">
      
        {/* Live Streams Horizontal List */}
        {filteredAds.some(ad => ad.isLive) && !loading && (
          <div className="mb-8">
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

        <div className="grid gap-4 sm:grid-cols-2">
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

        {!loading && renderLoadMore()}
      </div>

      {/* Right Column: Map Preview - Sticky */}
      <div className="hidden md:block h-[calc(100vh-140px)] sticky top-[100px]">
        <div id="ad-interactive-map" className={`h-full rounded-3xl overflow-hidden border shadow-xl z-10 transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200 shadow-slate-200/50'}`}>
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
        </div>
      </div>
    </div>
  );
}
