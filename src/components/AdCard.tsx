/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, MouseEvent, useEffect } from 'react';
import { 
  Eye, Heart, MapPin, Calendar, CheckCircle2, User, Share2, ShieldCheck, Video,
  ChevronLeft, ChevronRight, Phone, MessageCircle, MessageSquare, Fuel, Gauge, Sparkles, Home, Briefcase, Car
} from 'lucide-react';
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
  onChatClick?: (ad: Ad) => void;
  isFavorite?: boolean;
  distanceInKm?: number;
  currentMarket?: Market;
  loading?: boolean;
  isDark?: boolean;
}

export default React.memo(function AdCard({ ad, onClick, onLikeToggle, onChatClick, isFavorite, distanceInKm, currentMarket, loading, isDark }: AdCardProps) {
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
      <div className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200 dark:border-slate-800/80 transition-all ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'} flex flex-col animate-shimmer shadow-sm`}>
        <div className="relative w-full aspect-video shrink-0 bg-slate-100 dark:bg-slate-950 animate-pulse" />
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

  // Fast sanitizer for images
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

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [internalLikes, setInternalLikes] = useState(ad?.likes || 0);
  const [internalViews, setInternalViews] = useState(ad?.views || 0);
  const [liked, setLiked] = useState(isFavorite);
  const [sharing, setSharing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const getDisplayImage = (index: number) => {
    if (!safeImages || safeImages.length === 0) {
      return 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';
    }
    const raw = safeImages[index % safeImages.length] || safeImages[0];
    if (!raw || typeof raw !== 'string') return 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';
    const trimmed = raw.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
  };

  const [imgSrc, setImgSrc] = useState(getDisplayImage(0));

  useEffect(() => {
    setImgSrc(getDisplayImage(currentImgIndex));
  }, [currentImgIndex, ad.images]);

  useEffect(() => {
    setInternalLikes(ad?.likes || 0);
  }, [ad?.likes]);

  useEffect(() => {
    setInternalViews(ad?.views || 0);
  }, [ad?.views]);

  useEffect(() => {
    setLiked(isFavorite);
  }, [isFavorite]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="none"><rect width="800" height="600" fill="%230f172a"/><path d="M400 220L480 340H320L400 220Z" fill="%2310b981" opacity="0.6"/><path d="M460 270L520 340H400L460 270Z" fill="%23059669" opacity="0.8"/><circle cx="340" cy="200" r="30" fill="%23f59e0b" opacity="0.8"/><text x="50%" y="78%" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="%2394a3b8" text-anchor="middle">أَسْوَاق 22 - صورة المعاينة</text></svg>`;
    const target = e.currentTarget;
    if (target.src !== fallbackSvg) {
      target.src = fallbackSvg;
    }
  };

  const handleNextImage = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (safeImages.length > 1) {
      setCurrentImgIndex((prev) => (prev + 1) % safeImages.length);
    }
  };

  const handlePrevImage = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (safeImages.length > 1) {
      setCurrentImgIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
    }
  };

  const cityObj = currentMarket?.cities?.find((c) => c.id === ad.city);
  const cityName = cityObj ? (isRtl ? cityObj.nameAr : cityObj.nameEn) : ad.city;
  
  const isUuidCategory = !!(ad.category && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ad.category) || ad.category.length > 25));
  const catObj = CATEGORIES?.find?.((c: any) => c.id === ad.category);
  const categoryName = catObj ? (isRtl ? catObj.nameAr : catObj.nameEn) : (isUuidCategory ? '' : ad.category);
  const districtName = ad.district;

  const handleLikeClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
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
    setInternalLikes(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
    
    apiFetch(`/api/ads/${ad.id}/like`, {
      method: 'POST',
      body: JSON.stringify({ action: newLikedState ? 'like' : 'unlike' })
    }).catch(() => {});
  };

  const handleShareClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
        toast.success(isRtl ? 'تم نسخ رابط الإعلان' : 'Ad link copied!');
        setTimeout(() => setSharing(false), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  };

  const handlePhoneClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const phone = ad.contactNumber || ad.user?.phone || '+967770000000';
    setShowPhone(true);
    toast.success(isRtl ? `رقم الاتصال: ${phone}` : `Phone: ${phone}`, { duration: 4000 });
    window.location.href = `tel:${phone}`;
  };

  const handleWhatsappClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const phone = (ad.contactNumber || ad.user?.phone || '').replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`${isRtl ? 'مرحباً، أود الاستفسار عن إعلانك في منصة أسواق:' : 'Hello, inquiring about your ad:'} ${ad.title}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleChatDirectClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onChatClick) {
      onChatClick(ad);
    } else if (onClick) {
      onClick(ad);
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

  const formatPrice = (num: number | undefined) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Specification Chips Renderer based on category & details
  const renderSpecChips = () => {
    const chips: { icon: string; label: string }[] = [];
    const cat = (ad.category || '').toLowerCase();

    // Vehicles / Cars
    if (cat.includes('car') || cat.includes('vehicle') || cat.includes('سيار') || cat.includes('مركب')) {
      if (ad.modelYear) chips.push({ icon: '📅', label: `${ad.modelYear}` });
      if (ad.kilometers) chips.push({ icon: '🛣️', label: `${ad.kilometers.toLocaleString()} كم` });
      if (ad.transmission) chips.push({ icon: '🕹️', label: ad.transmission === 'automatic' ? (isRtl ? 'أوتوماتيك' : 'Auto') : (isRtl ? 'عادي' : 'Manual') });
      if (ad.fuelType) chips.push({ icon: '⛽', label: ad.fuelType });
    }
    // Real Estate
    else if (cat.includes('real') || cat.includes('housing') || cat.includes('عقار') || cat.includes('سكن') || cat.includes('أرض')) {
      if (ad.rooms) chips.push({ icon: '🛏️', label: `${ad.rooms} ${isRtl ? 'غرف' : 'rooms'}` });
      if (ad.propertyType) chips.push({ icon: '🏠', label: ad.propertyType });
    }
    // Electronics
    else if (cat.includes('electronic') || cat.includes('phone') || cat.includes('إلكترون') || cat.includes('أجهزم')) {
      if (ad.brand) chips.push({ icon: '📱', label: ad.brand });
      if (ad.condition) chips.push({ icon: '✨', label: ad.condition === 'new' ? (isRtl ? 'جديد' : 'New') : (isRtl ? 'مستعمل' : 'Used') });
    }

    if (chips.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1 sm:mt-1.5">
        {chips.slice(0, 3).map((chip, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold border border-slate-200/60 dark:border-slate-700/50">
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
          </span>
        ))}
      </div>
    );
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
          transition={{ duration: 0.2 }}
          className={`group relative rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'} flex flex-col ${
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
        <span className={`absolute z-20 bg-rose-500 text-white font-black text-[8px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-lg shadow-rose-500/20 select-none ${ad.isFeatured ? 'top-10 sm:top-12' : 'top-2 sm:top-4'} ${isRtl ? 'right-2 sm:right-4' : 'left-2 sm:left-4'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-0.5"></span>
          🎥 {isRtl ? 'فيديو حقيقي' : 'Real Video'}
        </span>
      )}

      {/* Ad Cover Image Container with Interactive Mini Gallery */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-950 group/img">
        <img
          src={imgSrc}
          alt={ad.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 dark:from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />

        {/* Carousel Arrow Controls */}
        {safeImages.length > 1 && (
          <>
            <button
              onClick={isRtl ? handleNextImage : handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition-opacity"
              title="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={isRtl ? handlePrevImage : handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition-opacity"
              title="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Carousel Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
              {safeImages.slice(0, 5).map((_, idx) => (
                <span
                  key={idx}
                  className={idx === currentImgIndex ? "w-3 h-1.5 rounded-full bg-white transition-all" : "w-1.5 h-1.5 rounded-full bg-white/50 transition-all"}
                />
              ))}
            </div>
          </>
        )}

        {/* Favorite heart action button & Share action button */}
        <div className={isRtl ? "absolute top-3 sm:top-5 z-20 flex flex-col gap-2 left-3 sm:left-5" : "absolute top-3 sm:top-5 z-20 flex flex-col gap-2 right-3 sm:right-5"}>
          <button
            onClick={handleLikeClick}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-md shadow-lg ${
              liked
                ? 'bg-rose-500 border-rose-500 text-white shadow-rose-500/30'
                : 'bg-white/90 dark:bg-slate-950/80 border-slate-200 dark:border-white/10 hover:border-emerald-500/50 text-slate-500 dark:text-slate-300'
            }`}
            id={`ad-card-heart-${ad.id}`}
          >
            <motion.span 
               whileTap={{ scale: 1.4 }}
               transition={{ type: "spring", stiffness: 400, damping: 10 }}
               className="flex items-center justify-center"
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${liked ? 'fill-current' : ''}`} />
            </motion.span>
          </button>
          
          <button
            onClick={handleShareClick}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-md shadow-lg ${
              sharing
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-white/90 dark:bg-slate-950/80 border-slate-200 dark:border-white/10 hover:border-emerald-500/50 text-slate-500 dark:text-slate-300'
            }`}
            id={`ad-card-share-${ad.id}`}
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Category Label Overlay */}
        {categoryName && categoryName.trim() !== '' && (
          <span className={`absolute top-3 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700/35 text-slate-700 dark:text-slate-200 font-bold text-[9px] sm:text-[10px] px-2.5 py-1 rounded-lg ${isRtl ? 'right-3' : 'left-3'}`}>
            {categoryName}
          </span>
        )}
      </div>

      {/* Information Content Block */}
      <div className="p-3 sm:p-4 flex flex-col justify-between flex-grow space-y-2">
        <div className="space-y-1.5">
          {/* User & Trust Row */}
          {(() => {
            const cleanUserDisplayName = sanitizeName(ad.userName);
            return (
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/40">
                <div className="relative flex items-center justify-center">
                  <Avatar 
                    src={ad.userAvatar} 
                    name={cleanUserDisplayName}
                    sizeClassName="w-5 h-5 sm:w-6 sm:h-6"
                    className="rounded-full border border-slate-200 dark:border-slate-700"
                  />
                  {ad.userVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5 border border-white dark:border-slate-900">
                      <ShieldCheck className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] sm:text-xs font-bold truncate max-w-[100px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {cleanUserDisplayName}
                  </span>
                  {ad.userVerified && <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-500/20">{isRtl ? 'موثوق' : 'Verified'}</span>}
                </div>
              </div>
            );
          })()}

          {/* Micro Information Line */}
          <div className={`flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-500'} ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
            <span className="flex items-center gap-1 truncate max-w-[140px] sm:max-w-none">
              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="truncate">{cityName}{districtName ? ` - ${districtName}` : ''}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{relativeDateString()}</span>
            </span>
          </div>

          {/* Ad Title */}
          <h3 className={`text-xs sm:text-sm font-bold hover:text-emerald-600 dark:hover:text-emerald-400 line-clamp-2 transition-colors leading-snug ${isDark ? 'text-white' : 'text-slate-900'} ${isRtl ? 'text-right' : 'text-left'}`}>
            {ad.title}
          </h3>

          {/* Dynamic Specification Chips (Category Badges) */}
          {renderSpecChips()}
        </div>

        {/* Pricing & Actions Section */}
        <div className={`border-t pt-2.5 mt-auto space-y-2 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          <div className={`flex items-center justify-between gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
            {/* Price digits */}
            <div className={`flex items-baseline gap-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              <span className={`text-base sm:text-lg font-black ${isDark ? 'bg-gradient-to-l from-emerald-400 to-cyan-400 bg-clip-text text-transparent' : 'text-emerald-600'}`}>
                {formatPrice(ad.price)}
              </span>
              <span className={`text-[10px] sm:text-xs font-semibold ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>
                {isRtl ? getCurrencyAr(ad.currency) : ad.currency}
              </span>
            </div>

            {/* Engagement Counters */}
            <div className={`flex items-center gap-2 text-[10px] sm:text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {internalViews}
              </span>
            </div>
          </div>

          {/* Quick Action Bar (زر الاتصال، زر الواتساب، زر الدردشة) */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={handlePhoneClick}
              className="flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1.5 px-2 rounded-xl text-[10px] sm:text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
              title="اتصال تلفوني"
            >
              <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{showPhone ? (ad.contactNumber || 'اتصال') : (isRtl ? 'اتصل' : 'Call')}</span>
            </button>

            <button
              onClick={handleWhatsappClick}
              className="flex items-center justify-center gap-1 bg-emerald-600/10 dark:bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold py-1.5 px-2 rounded-xl text-[10px] sm:text-xs active:scale-95 transition-all"
              title="واتساب مباشر"
            >
              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{isRtl ? 'واتساب' : 'WhatsApp'}</span>
            </button>

            <button
              onClick={handleChatDirectClick}
              className="flex items-center justify-center gap-1 bg-cyan-600/10 dark:bg-cyan-500/20 hover:bg-cyan-500 hover:text-white text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-bold py-1.5 px-2 rounded-xl text-[10px] sm:text-xs active:scale-95 transition-all"
              title="محادثة منصة أسواق"
            >
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{isRtl ? 'شات' : 'Chat'}</span>
            </button>
          </div>
        </div>

      </div>
        </motion.a>
      )}
    </AnimatePresence>
  );
});
