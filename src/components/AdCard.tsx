/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, MouseEvent, useEffect } from 'react';
import { Eye, Heart, MapPin, Calendar, CheckCircle2, User, Share2, ShieldCheck, Video } from 'lucide-react';
import { motion, PanInfo, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
import { Ad } from '../types.ts';
import { Market, getCurrencyAr, getCurrencyNameAr } from '../markets.ts';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../data.ts';
import toast from 'react-hot-toast';
import { Avatar, sanitizeName } from './Avatar.tsx';

interface AdCardProps {
  key?: string;
  ad?: Ad;
  onClick?: (ad: Ad) => void;
  onLikeToggle?: (adId: string) => void;
  isFavorite?: boolean;
  distanceInKm?: number;
  currentMarket?: Market;
  loading?: boolean;
  isDark?: boolean;
}

export default React.memo(function AdCard({ ad, onClick, onLikeToggle, isFavorite, distanceInKm, currentMarket, loading, isDark }: AdCardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const slugify = (text: string): string => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0621-\u064A-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const adUrl = (() => {
    if (!ad) return '#';
    const countryCode = currentMarket?.countryCode?.toLowerCase() || 'ye';
    
    const catId = ad.category;
    const categoryObject = CATEGORIES.find(c => c.id === catId);
    const categorySlug = categoryObject?.nameEn?.toLowerCase() || 'ads';
    
    const titleSlug = slugify(ad.title);
    return `/${countryCode}/${categorySlug}/${titleSlug}-${ad.id}`;
  })();

  // Skeleton Render
  if (loading || !ad) {
    return (
      <div className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800/80 transition-all ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'} flex flex-row sm:flex-col animate-shimmer h-[112px] sm:h-auto shadow-sm`}>
        <div className="relative w-28 h-28 sm:w-full sm:aspect-video shrink-0 bg-slate-100 dark:bg-slate-950 animate-pulse" />
        <div className="p-3 sm:p-5 flex flex-col justify-between flex-grow space-y-3">
          <div className="space-y-2">
            <div className="h-2 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-2 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded animate-pulse" />
          </div>
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-auto" />
        </div>
      </div>
    );
  }

  // Fast sanitizer for images to prevent ReferenceError/TypeError
  const safeImages = (Array.isArray(ad?.images)
    ? ad.images
    : (() => {
        try {
          if (ad?.images && typeof ad.images === 'string') {
            const parsed = JSON.parse(ad.images);
            if (Array.isArray(parsed)) return parsed;
          }
        } catch (e) {}
        return [];
      })()
  ).map((img: any) => (img && typeof img === 'object' ? img.url : img)).filter(Boolean);

  const [internalLikes, setInternalLikes] = useState(ad?.likes || 0);
  const [internalViews, setInternalViews] = useState(ad?.views || 0);
  const [liked, setLiked] = useState(isFavorite);
  const [sharing, setSharing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Chooses the best image to showcase: preference is given to local uploaded assets starting with "/uploads/"
  // over generic fallback placeholder links when both exist, or falls back to a clean placeholder.
  const getDisplayImage = () => {
    if (!safeImages || safeImages.length === 0) {
      return 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';
    }
    const raw = safeImages.find(img => typeof img === 'string' && img.trim().length > 0) || safeImages[0];
    if (!raw || typeof raw !== 'string') return 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';
    const trimmed = raw.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
  };

  const [imgSrc, setImgSrc] = useState(getDisplayImage());
  const [isImgLoaded, setIsImgLoaded] = useState(false);

  useEffect(() => {
    setImgSrc(getDisplayImage());
    setIsImgLoaded(false);
  }, [ad.images]);

  useEffect(() => {
    setInternalLikes(ad?.likes || 0);
  }, [ad?.likes]);

  useEffect(() => {
    setInternalViews(ad?.views || 0);
  }, [ad?.views]);

  useEffect(() => {
    setLiked(isFavorite);
  }, [isFavorite]);

  // Handle image errors dynamically
  const handleImageError = () => {
    if (imgSrc !== 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80') {
      const fallback = safeImages?.find(img => img && img !== imgSrc) || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';
      setImgSrc(fallback);
    }
  };

  // Look up names using market data and global categories
  const cityObj = currentMarket?.cities?.find((c) => c.id === ad.city);
  const cityName = cityObj ? (isRtl ? cityObj.nameAr : cityObj.nameEn) : ad.city;
  
  // Dynamically resolve localized category name (hide raw UUIDs)
  const isUuidCategory = !!(ad.category && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ad.category) || ad.category.length > 25));
  const catObj = CATEGORIES?.find?.((c: any) => c.id === ad.category);
  const categoryName = catObj ? (isRtl ? catObj.nameAr : catObj.nameEn) : (isUuidCategory ? '' : ad.category);
  const districtName = ad.district;

  const handleLikeClick = (e: MouseEvent) => {
    e.stopPropagation();
    
    if (!liked) {
      toast.success(isRtl ? 'تمت إضافة الإعلان للمفضلة' : 'Ad added to favorites!', {
        position: 'bottom-center',
      });
    }
    
    const newLikedState = !liked;
    setLiked(newLikedState);
    if (onLikeToggle) {
      onLikeToggle(ad.id);
    }
    // Locally adjust rating display
    setInternalLikes(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
    
    // Fire real endpoint hit in background
    const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
    apiFetch(`/api/ads/${ad.id}/like`, {
        method: 'POST',
        body: JSON.stringify({ action: newLikedState ? 'like' : 'unlike' })
      }).catch(() => {});
  };

  const handleShareClick = (e: MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/ad/${ad.id}`;
    const shareText = `${isRtl ? 'عروض أسواق' : 'Aswaq Deals'}: ${ad.title} - ${(ad.price || 0).toLocaleString()} ${isRtl ? getCurrencyAr(ad.currency) : ad.currency}`;

    if (navigator.share) {
      navigator.share({
        title: ad.title,
        text: shareText,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        setSharing(true);
        setTimeout(() => setSharing(false), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    setInternalViews(prev => prev + 1);
    if (onClick && ad) {
      onClick(ad);
    }
  };

  // Human date formatting with natural bilingual relative strings
  const relativeDateString = () => {
    const elapsed = Date.now() - new Date(ad.createdAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (isRtl) {
      if (days > 0) {
        if (days === 1) return 'منذ يوم';
        if (days === 2) return 'منذ يومين';
        if (days >= 3 && days <= 10) return `منذ ${days} أيام`;
        return `منذ ${days} يوم`;
      }
      if (hours > 0) {
        if (hours === 1) return 'منذ ساعة';
        if (hours === 2) return 'منذ ساعتين';
        if (hours >= 3 && hours <= 10) return `منذ ${hours} ساعات`;
        return `منذ ${hours} ساعة`;
      }
      if (minutes > 0) {
        if (minutes === 1) return 'منذ دقيقة';
        if (minutes === 2) return 'منذ دقيقتين';
        return `منذ ${minutes} دقيقة`;
      }
      return 'الآن';
    } else {
      if (days > 0) {
        if (days === 1) return '1 day ago';
        return `${days} days ago`;
      }
      if (hours > 0) {
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
      }
      if (minutes > 0) {
        if (minutes === 1) return '1 min ago';
        return `${minutes} mins ago`;
      }
      return 'Just now';
    }
  };

  // Price formatter with comma separator
  const formatPrice = (num: number | undefined) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.a
          layout
          href={adUrl}
          onClick={handleCardClick}
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            if (Math.abs(info.offset.x) > 120 || Math.abs(info.velocity.x) > 500) {
              setIsDismissed(true);
            }
          }}
          exit={{ opacity: 0, x: isRtl ? 300 : -300 }}
          transition={{ duration: 0.2 }}
          className={`group relative rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'} flex flex-row sm:flex-col ${
            ad.isFeatured
              ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/40 hover:border-emerald-500 shadow-lg shadow-emerald-500/5'
              : 'bg-white dark:bg-slate-900/60 backdrop-blur-sm border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-emerald-950/20'
          }`}
          id={`ad-card-${ad.id}`}
        >
      
      {/* Promotion Tag badge */}
      {ad.isFeatured && (
        <span className={`absolute top-2 sm:top-4 z-20 bg-emerald-500 text-white dark:text-slate-950 font-black text-[8px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-500/20 select-none ${isRtl ? 'right-2 sm:right-4' : 'left-2 sm:left-4'}`}>
          🔥 {isRtl ? 'مميز' : 'Featured'}
        </span>
      )}

      {/* Video Verification Badge */}
      {ad.videoUrl && (
        <span className={`absolute z-20 bg-rose-500 text-white font-black text-[8px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-lg shadow-rose-500/20 select-none ${isRtl ? `${ad.isFeatured ? 'top-10 sm:top-12' : 'top-2 sm:top-4'} right-2 sm:right-4` : `${ad.isFeatured ? 'top-10 sm:top-12' : 'top-2 sm:top-4'} left-2 sm:left-4`}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-0.5"></span>
          🎥 {isRtl ? 'تصوير حقيقي' : 'Real Video'}
        </span>
      )}

      {/* Ad Cover Image Container */}
      <div className="relative w-28 h-28 sm:w-full sm:aspect-video shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-950">
        <img
          src={imgSrc}
          alt={ad.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-in-out opacity-100 scale-100"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={handleImageError}
        />
        {/* Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 dark:from-slate-950 via-transparent to-transparent opacity-60" />

        {/* Favorite heart action button & Share action button */}
        <div className={`absolute top-3 sm:top-5 z-20 flex flex-col gap-2 ${isRtl ? 'left-3 sm:left-5' : 'right-3 sm:right-5'}`}>
          <button
            onClick={handleLikeClick}
            className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-md shadow-lg ${
              liked
                ? 'bg-rose-500 border-rose-500 text-white shadow-rose-500/30'
                : 'bg-white/90 dark:bg-slate-950/80 border-slate-200 dark:border-white/10 hover:border-emerald-500/50 text-slate-500 dark:text-slate-300'
            }`}
            id={`ad-card-heart-${ad.id}`}
          >
            <motion.span 
               whileTap={{ scale: 1.5 }}
               transition={{ type: "spring", stiffness: 400, damping: 10 }}
               className="flex items-center justify-center"
            >
              <Heart className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${liked ? 'fill-current' : ''}`} />
            </motion.span>
          </button>
          
          <button
            onClick={handleShareClick}
            className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-md shadow-lg ${
              sharing
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-white/90 dark:bg-slate-950/80 border-slate-200 dark:border-white/10 hover:border-emerald-500/50 text-slate-500 dark:text-slate-300'
            }`}
            id={`ad-card-share-${ad.id}`}
          >
            <Share2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Image count */}
        {safeImages.length > 1 && (
          <div className={`absolute bottom-2 z-10 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm ${isRtl ? 'left-2' : 'right-2'}`}>
            {safeImages.length} {isRtl ? 'صور' : 'photos'}
          </div>
        )}

        {/* Category Label Overlay */}
        {categoryName && categoryName.trim() !== '' && (
          <span className={`absolute bottom-2 sm:bottom-3 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700/35 text-slate-600 dark:text-slate-300 font-bold text-[8px] sm:text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg ${isRtl ? 'right-2 sm:right-4' : 'left-2 sm:left-4'}`}>
            {categoryName}
          </span>
        )}
      </div>

      {/* STATUS Watermark / Indicators */}
      {(ad.status === 'sold' || ad.status === 'expired' || ad.status === 'rejected') && (
        <div className="absolute inset-0 z-30 bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className={`border-[3px] px-6 py-2 rotate-[-12deg] rounded-2xl shadow-2xl transition-all duration-500 
            ${ad.status === 'sold' ? 'border-rose-500 bg-rose-500/10 shadow-rose-500/20' : 
              ad.status === 'expired' ? 'border-amber-500 bg-amber-500/10 shadow-amber-500/20' : 
              'border-slate-500 bg-slate-500/10 shadow-slate-500/20'}`}>
            <span className={`font-black text-2xl sm:text-3xl tracking-widest
              ${ad.status === 'sold' ? 'text-rose-500' : 
                ad.status === 'expired' ? 'text-amber-500' : 
                'text-slate-400'}`}>
              {ad.status === 'sold' ? (isRtl ? 'تـم الـبـيـع' : 'SOLD') : 
               ad.status === 'expired' ? (isRtl ? 'مـنـتـهـي' : 'EXPIRED') : 
               (isRtl ? 'مـرفـوض' : 'REJECTED')}
            </span>
          </div>
        </div>
      )}

      {/* Information Content Block */}
      <div className="p-3 sm:p-5 flex flex-col justify-between flex-grow min-h-0 sm:h-auto">
        <div className="space-y-1 sm:space-y-2">
          {/* User & Trust Row */}
          {(() => {
            const cleanUserDisplayName = sanitizeName(ad.userName);
            return (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/40">
                <div className="relative flex items-center justify-center">
                  <Avatar 
                    src={ad.userAvatar} 
                    name={cleanUserDisplayName}
                    sizeClassName="w-5 h-5 sm:w-6 sm:h-6"
                    className="rounded-full border border-slate-200 dark:border-slate-700"
                  />
                  {ad.userVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5 border border-white dark:border-slate-900">
                      <ShieldCheck className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={`text-[8px] sm:text-[10px] font-bold truncate max-w-[80px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {cleanUserDisplayName}
                  </span>
                  {ad.userVerified && <span className="text-[6px] sm:text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-tighter">{isRtl ? 'موثوق' : 'Verified'}</span>}
                </div>
              </div>
            );
          })()}

          {/* Micro Information Line */}
          <div className={`flex items-center justify-between gap-1 text-[8px] sm:text-[10px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
            <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
              <MapPin className="w-2.5 h-2.5 text-emerald-500" />
              <span className="truncate">{cityName}{districtName ? ` - ${districtName}` : ''}</span>
              {distanceInKm !== undefined && (
                <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-black px-1 py-0.5 rounded text-[7px] sm:text-[9px] mr-1 animate-pulse shrink-0 border border-emerald-100 dark:border-transparent">
                  📍 {distanceInKm >= 1 ? (isRtl ? `${distanceInKm.toFixed(0)} كم` : `${distanceInKm.toFixed(0)} km`) : (isRtl ? '< 1 كم' : '< 1 km')}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-2.5 h-2.5" />
              <span>
                {relativeDateString()} {` (${new Date(ad.createdAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US', {month: 'numeric', day: 'numeric'})} ${new Date(ad.createdAt).toLocaleTimeString(isRtl ? 'ar-YE' : 'en-US', {hour: '2-digit', minute: '2-digit', hour12: true})})`}
              </span>
            </span>
          </div>

          {/* Ad Title */}
          <h3 className={`text-[11px] sm:text-sm font-bold hover:text-emerald-600 dark:hover:text-emerald-400 line-clamp-1 sm:line-clamp-2 transition-colors leading-tight ${isDark ? 'text-white' : 'text-slate-900'} ${isRtl ? 'text-right' : 'text-left'}`}>
            {ad.title}
          </h3>

          {/* Job Type Badge */}
          {ad.jobType && (
            <div className={`flex items-center mt-0.5 sm:mt-2 ${isRtl ? 'justify-start' : 'justify-start'}`}>
              {ad.jobType === 'hiring' ? (
                <span className="inline-flex items-center gap-1 bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[7px] sm:text-[10px] font-black">
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400"></span>
                  {isRtl ? 'موظف مطلوب' : 'Hiring'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-950/40 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[7px] sm:text-[10px] font-black">
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-400"></span>
                  {isRtl ? 'بحث عن عمل' : 'Seeking Job'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom pricing section */}
        <div className={`border-t pt-2 sm:pt-4 mt-auto ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          <div className="flex flex-col gap-1">
            <div className={`flex items-center justify-between gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
              {/* Price digits */}
              <div className={`flex items-baseline gap-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                <span className={`text-sm sm:text-xl font-extrabold ${isDark ? 'bg-gradient-to-l from-emerald-400 to-cyan-400 bg-clip-text text-transparent' : 'text-emerald-600'}`}>
                  {formatPrice(ad.price)}
                </span>
                <span className={`text-[8px] sm:text-xs font-semibold ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>
                  {isRtl ? getCurrencyAr(ad.currency) : ad.currency}
                </span>
              </div>

               {/* Views engagement panel counters */}
              <div className={`flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Eye className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                  {internalViews}
                </span>
                <button 
                  onClick={handleLikeClick}
                  className="flex items-center gap-0.5 sm:gap-1 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  <Heart className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${liked ? 'text-rose-500 fill-current' : ''}`} />
                  {internalLikes}
                </button>
              </div>
            </div>

            {/* Currency conversion info on-hover or small text */}
            {ad.currency === 'USD' && currentMarket?.countryCode === 'YE' ? (
               <div className={`flex items-center gap-2 text-[7px] sm:text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                 <span className="text-emerald-500/80">{isRtl ? `≈ ${((ad.price || 0) * 535).toLocaleString()} ي.ر (صنعاء)` : `≈ ${((ad.price || 0) * 535).toLocaleString()} YER (Sanaa)`}</span>
                 <span className="text-cyan-500/80">{isRtl ? `≈ ${((ad.price || 0) * 1780).toLocaleString()} ي.ر (عدن)` : `≈ ${((ad.price || 0) * 1780).toLocaleString()} YER (Aden)`}</span>
               </div>
            ) : ad.currency === 'USD' && currentMarket && currentMarket.currency !== 'USD' ? (
               <div className={`flex items-center gap-2 text-[7px] sm:text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                 <span className="text-emerald-500/80">≈ {((ad.price || 0) * currentMarket.usdRate).toLocaleString(undefined, {maximumFractionDigits: 0})} {isRtl ? getCurrencyAr(currentMarket.currency) : currentMarket.currency}</span>
               </div>
            ) : ad.currency !== 'USD' && currentMarket && currentMarket.usdRate > 1 ? (
               <div className={`flex items-center gap-2 text-[7px] sm:text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                 <span className="text-emerald-500/80">≈ {((ad.price || 0) / currentMarket.usdRate).toLocaleString(undefined, {maximumFractionDigits: 1})} $</span>
               </div>
            ) : null}

            {/* Live Stream Join Button */}
            {ad.isLive && (
              <button 
                onClick={(e) => { e.stopPropagation(); onClick(ad); }}
                className="mt-2 w-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
              >
                <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse mr-0.5"></span>
                {isRtl ? 'انضم للبث' : 'Join Stream'}
              </button>
            )}
          </div>
        </div>

      </div>
        </motion.a>
      )}
    </AnimatePresence>
  );
})
