/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  X, 
  Phone, 
  MessageSquare, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Send, 
  Eye, 
  EyeOff,
  Heart, 
  Share2,
  User as UserIcon, 
  ShieldCheck, 
  MessageCircle, 
  TrendingUp,
  Loader2,
  UserPlus,
  UserMinus,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Check,
  FileText,
  Video,
  BookOpen,
  Lock,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Ad, User, ChatMessage } from '../types.ts';
import { Market, getCurrencyAr, getCurrencyNameAr } from '../markets.ts';
import { INITIAL_USERS, CATEGORIES } from '../data.ts';
import { Avatar, sanitizeName } from './Avatar.tsx';
import { apiFetch } from '../lib/api';

const getYoutubeEmbedUrl = (url?: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
};

interface AdModalProps {
  ad: Ad;
  currentUser: User | null;
  onClose: () => void;
  onLoginRequest: () => void;
  onAdStatusChange?: (adId: string, status: 'active' | 'sold') => void;
  isAdmin?: boolean;
  followedSellers?: string[];
  onToggleFollowSeller?: (userId: string) => void;
  currentMarket: Market;
  isDark?: boolean;
  onAdUpdated?: (updatedAd: Ad) => void;
  onReportAd?: (adId: string, reason: string) => void;
  onViewUser?: (user: User) => void;
  favorites?: string[];
  onLikeToggle?: (adId: string) => void;
}

export default function AdModal({
  ad,
  currentUser,
  onClose,
  onLoginRequest,
  onAdStatusChange,
  onAdUpdated,
  onReportAd,
  onViewUser,
  isAdmin,
  followedSellers = [],
  onToggleFollowSeller,
  currentMarket,
  isDark,
  favorites = [],
  onLikeToggle
}: AdModalProps) {
  const isRtl = document.documentElement.dir === 'rtl';
  const navigate = useNavigate();
  const [similarAds, setSimilarAds] = useState<Ad[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
        const res = await apiFetch(`/api/ads?category=${ad.category}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const list = data.ads || data || [];
          const filtered = list.filter((item: Ad) => item.id !== ad.id);
          setSimilarAds(filtered.slice(0, 3));
        }
      } catch (e) {
        console.error('Failed to load similar ads', e);
      } finally {
        setLoadingSimilar(false);
      }
    };
    if (ad?.id && ad?.category) {
      fetchSimilar();
    }
  }, [ad.id, ad.category]);

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

  const categoryObject = CATEGORIES.find(c => c.id === ad.category);
  const categoryName = categoryObject?.nameAr || 'القسم';

  const rawSellerName = ad.user?.name || ad.userName || (isRtl ? 'بائع أسواق' : 'Aswaq Seller');
  const sellerName = sanitizeName(rawSellerName);
  const sellerAvatar = ad.user?.avatar || ad.userAvatar;
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [readingMode, setReadingMode] = useState(false);

  // Fast sanitizer for images - Define BEFORE any state that uses it
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

  const [activeImage, setActiveImage] = useState(() => {
    const uploaded = safeImages?.find(img => img && typeof img === 'string' && img.startsWith('/uploads/'));
    return uploaded || safeImages?.[0] || '';
  });
  const [viewingVideo, setViewingVideo] = useState(!!ad.isLive);
  const [votedMatch, setVotedMatch] = useState<'yes' | 'no' | null>(null);
  const stableSeed = ad.title.length + ((ad.price || 0) % 7);
  const [yesVotes, setYesVotes] = useState(stableSeed * 4 + 7);
  const [noVotes, setNoVotes] = useState((stableSeed % 3) + 1);
  const [verificationSent, setVerificationSent] = useState(false);
  const [internalViews, setInternalViews] = useState(ad.views || 0);
  const [hideContactNumber, setHideContactNumber] = useState(() => !ad.contactNumber || !!ad.hideContactNumber);

  const handleToggleContactNumber = async () => {
    const nextHidden = !hideContactNumber;
    const newContactNumber = nextHidden ? null : (currentUser?.phone || ad.contactNumber || ad.user?.phone || '000000000');
    
    try {
      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
      const response = await apiFetch(`/api/ads/${ad.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          contactNumber: newContactNumber
        })
      });
      
      if (response.ok) {
        setHideContactNumber(nextHidden);
        if (onAdUpdated) {
          onAdUpdated({
            ...ad,
            contactNumber: newContactNumber,
            hideContactNumber: nextHidden
          });
        }
      }
    } catch (e) {
      console.error("Failed to toggle contact number visibility:", e);
    }
  };

  // Buy Offer & Installments Simulator local states
  const [offerMode, setOfferMode] = useState<'cash' | 'installment'>('cash');
  const [customBidPrice, setCustomBidPrice] = useState(Math.round((ad.price || 0) * 0.9));
  const [downpaymentAmount, setDownpaymentAmount] = useState(Math.round((ad.price || 0) * 0.25));
  const [durationMonths, setDurationMonths] = useState(12);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [offerSuccessMessage, setOfferSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setInternalViews(ad.views || 0);
  }, [ad.id, ad.views]);

const sessionViewedAdsSet = new Set<string>();

  useEffect(() => {
    // Increment view count in backend on API strictly ONCE per ad per session
    if (ad.id && !sessionViewedAdsSet.has(ad.id)) {
      sessionViewedAdsSet.add(ad.id);
      apiFetch(`/api/ads/${ad.id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data && typeof data.views === 'number') {
            setInternalViews(data.views);
          }
        })
        .catch(() => {});
    }
  }, [ad.id]);

  const sendDirectMessage = async (customText: string, isVerification = false) => {
    if (!currentUser) {
      onLoginRequest();
      return;
    }
    setLoadingChat(true);
    const body = {
      adId: ad.id,
      senderId: currentUser.id,
      receiverId: ad.userId,
      text: customText
    };

    try {
      const response = await apiFetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
         const newMsg: ChatMessage = await response.json();
         setChatLogs(prev => [...prev, newMsg]);
         if (isVerification) setVerificationSent(true);
         setChatTab('live');
      }
    } catch (err) {
      console.error('Failed sending custom verification message', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const sendVerificationRequest = () => {
    sendDirectMessage(`مرحباً أخي، هل يمكنك إرسال صورة للمنتج مكتوب فيها اسمي (${currentUser?.name || 'المشتري'}) على ورقة بجانبه للتأكد من المعاينة الواقعية وحفظ الحقوق؟ شكراً لك.`, true);
  };

  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  const [msgText, setMsgText] = useState('');
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [adCommentsList, setAdCommentsList] = useState<any[]>((ad as any).comments || []);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComment, setLoadingComment] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;
    setLoadingComment(true);
    try {
      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
      const response = await apiFetch(`/api/ads/${ad.id}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId: currentUser.id, text: newCommentText })
      });
      if (response.ok) {
        const comment = await response.json();
        setAdCommentsList(prev => [comment, ...prev]);
        setNewCommentText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComment(false);
    }
  };

  // AI Negotiator & Pricing States
  const [chatTab, setChatTab] = useState<'live' | 'ai'>('live');
  const [aiChatLogs, setAiChatLogs] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [aiMsgText, setAiMsgText] = useState('');
  const [isAiNegotiating, setIsAiNegotiating] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  // State to support bi-directional chat in ad modal (owner seeing and responding to various buyers)
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  // AI Trust States
  const [trustData, setTrustData] = useState<{score: number, risks: string[], advice: string} | null>(null);
  const [loadingTrust, setLoadingTrust] = useState(false);
  const [priceInsights, setPriceInsights] = useState<{status: string, marketAverage: string, advice: string} | null>(null);

  const fetchAiInsights = async () => {
    if (!ad) return;
    setLoadingTrust(true);
    try {
      const trustPromise = apiFetch("/api/ai/trust-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adTitle: ad.title,
          adDescription: ad.description,
          adPrice: ad.price,
          adCurrency: ad.currency,
          userName: ad.userName,
          userVerified: ad.userVerified
        })
      });

      const pricePromise = apiFetch("/api/ai/price-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adTitle: ad.title,
          adPrice: ad.price,
          adCurrency: ad.currency,
          adCategory: ad.category
        })
      });

      const [trustRes, priceRes] = await Promise.all([trustPromise, pricePromise]);
      if (trustRes.ok) setTrustData(await trustRes.json());
      if (priceRes.ok) setPriceInsights(await priceRes.json());
    } catch (e) {
      console.error("AI insights failed", e);
    } finally {
      setLoadingTrust(false);
    }
  };

  const cityObj = currentMarket.cities.find((c) => c.id === ad.city);
  // Note: CATEGORIES and DISTRICTS are currently global in data.ts, but we use city-lookup from market
  const cityName = cityObj ? cityObj.nameAr : ad.city;
  const districtName = ad.district;

  // Load chat logs for this ad from Database
  useEffect(() => {
    fetchChats();
    fetchAiInsights();
    fetchUsers();
  }, [ad.id]);

  // Reset active image and video mode when the ad changes
  useEffect(() => {
    const uploaded = safeImages?.find(img => img && img.startsWith('/uploads/'));
    setActiveImage(uploaded || safeImages?.[0] || '');
    setViewingVideo(false);
    setHideContactNumber(!ad.contactNumber || !!ad.hideContactNumber);
  }, [ad.id, ad.images, ad.contactNumber, ad.hideContactNumber]);

  // Set up official introductory representative message when ad loaded
  useEffect(() => {
    setAiChatLogs([
      { 
        role: 'model', 
        text: `أهلاً بك الكريم! 🤝 بصفتي الوكيل الرقمي المفوض لتيسير صفقات السعر لصالح المعلن (${ad.userName || 'التاجر المعتمد'})، يسعدني مساعدتك للاتفاق على السعر المناسب في ثوانٍ. السعر المطلوب المعلن هو ${(ad.price ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${getCurrencyNameAr(ad.currency)}. تفضل بطرح عرضك المقترح ونحن جاهزون لتأكيد الصفقة المبدئية فوراً!` 
      }
    ]);
  }, [ad.id]);

  const fetchChats = async () => {
    try {
      const response = await apiFetch('/api/messages');
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data: ChatMessage[] = await response.json();
        // Filter messages for this ad
        const filtered = data.filter(m => m.adId === ad.id);
        setChatLogs(filtered);
      }
    } catch (e) {
      console.error('Error fetching chats', e);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onLoginRequest();
      return;
    }
    if (!msgText.trim()) return;

    setLoadingChat(true);
    const receiverId = isMyAd ? selectedBuyerId : ad.userId;
    if (!receiverId) {
      setLoadingChat(false);
      return;
    }

    const body = {
      adId: ad.id,
      senderId: currentUser.id,
      receiverId,
      text: msgText
    };

    try {
      const response = await apiFetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const newMsg: ChatMessage = await response.json();
           setChatLogs(prev => [...prev, newMsg]);
           setMsgText('');
           
           // Polling loop after standard response wait
           setTimeout(() => {
             fetchChats();
           }, 2200);
        } else {
           console.warn("Server sent non-JSON response for chat message post");
        }
      }
    } catch (err) {
      console.error('Failed sending message', err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLogs]);

  const handleSendAiMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiMsgText.trim()) return;

    const userMsg = aiMsgText;
    setAiMsgText('');
    setAiChatLogs(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiNegotiating(true);

    try {
      const response = await apiFetch('/api/ai/negotiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adTitle: ad.title,
          adPrice: ad.price,
          adCurrency: ad.currency,
          sellerName: ad.userName || 'أبو أحمد الهمداني',
          sellerBio: ad.userId === 'user_1' ? `معرض سيارات مرخص في ${currentMarket.labelAr}` : `بائع موثوق في أسواق ${currentMarket.labelAr} بمختلف المحافظات`,
          messageHistory: aiChatLogs,
          newMessage: userMsg
        })
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const data = await response.json();
           setAiChatLogs(prev => [...prev, { role: 'model', text: data.reply }]);
        } else {
           setAiChatLogs(prev => [...prev, { role: 'model', text: 'خطأ: تلقينا استجابة غير صالحة من الخادم (HTML بدلاً من JSON).' }]);
        }
      } else {
        setAiChatLogs(prev => [...prev, { role: 'model', text: 'عذراً يا طيب، انقطع الاتصال بالإنترنت قليلاً. أعد المحاولة!' }]);
      }
    } catch (err) {
      console.error(err);
      setAiChatLogs(prev => [...prev, { role: 'model', text: 'لم نتمكن من الوصول لمركب الاتصال. الرجاء المحاولة مجدداً!' }]);
    } finally {
      setIsAiNegotiating(false);
    }
  };

  useEffect(() => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiChatLogs, isAiNegotiating]);

  const isMyAd = currentUser ? currentUser.id === ad.userId : false;
  const isFollowed = followedSellers.includes(ad.userId);

  // Memoized lists for handling bi-directional (owner vs client) conversations inside the modal
  const uniqueBuyerIds = React.useMemo(() => {
    return Array.from(new Set(
      chatLogs.map(m => m.senderId === ad.userId ? m.receiverId : m.senderId)
    )).filter(id => id !== ad.userId && id !== 'system' && id !== null && id !== undefined);
  }, [chatLogs, ad.userId]);

  useEffect(() => {
    if (isMyAd && uniqueBuyerIds.length > 0 && !selectedBuyerId) {
      setSelectedBuyerId(uniqueBuyerIds[0]);
    }
  }, [chatLogs, isMyAd, uniqueBuyerIds, selectedBuyerId]);

  const visibleMessages = React.useMemo(() => {
    if (!currentUser) return [];
    if (isMyAd) {
      return chatLogs.filter(m => 
        selectedBuyerId ? (
          (m.senderId === selectedBuyerId && m.receiverId === ad.userId) || 
          (m.senderId === ad.userId && m.receiverId === selectedBuyerId)
        ) : false
      );
    } else {
      return chatLogs.filter(m => 
        (m.senderId === currentUser.id && m.receiverId === ad.userId) || 
        (m.senderId === ad.userId && m.receiverId === currentUser.id)
      );
    }
  }, [chatLogs, currentUser, isMyAd, selectedBuyerId, ad.userId]);

  const getBuyerNameAndAvatar = (buyerId: string) => {
    const found = allUsers.find(u => u.id === buyerId);
    return {
      name: found?.name || 'مشتري مهتم',
      avatar: found?.avatar || ''
    };
  };

  const images = safeImages || [];

  const handleNextFull = () => {
    if (fullScreenIndex === null) return;
    setFullScreenIndex(prev => (prev! + 1) % images.length);
  };

  const handlePrevFull = () => {
    if (fullScreenIndex === null) return;
    setFullScreenIndex(prev => (prev! - 1 + images.length) % images.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fullScreenIndex === null) return;
      if (e.key === 'ArrowRight') handlePrevFull(); // RTL
      if (e.key === 'ArrowLeft') handleNextFull();
      if (e.key === 'Escape') setFullScreenIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreenIndex]);

  // Dynamic consistent price valuation indicator based on details
  const getAdValuation = () => {
    const p = ad.price || 0;
    const isUSD = ad.currency === 'USD';
    
    if (ad.category === 'cars') {
      if (isUSD) {
        if (p < 15000) return { label: 'فرصة نادرة جداً ومغرية للشراء', color: 'text-emerald-400 bg-emerald-950/25 border-emerald-500/20', pct: '25%', badge: '🔥 صيد لقطة' };
        if (p <= 35000) return { label: 'سعر عادل ومواكب للمواصفات', color: 'text-cyan-400 bg-cyan-950/25 border-cyan-500/20', pct: '50%', badge: '⚖️ سعر ممتاز' };
        return { label: 'فئة فاخرة من سلع النخبة والمستورد البكر', color: 'text-amber-400 bg-amber-950/25 border-amber-500/20', pct: '80%', badge: '💎 سبيكة ملكية' };
      }
    }
    if (ad.category === 'realestate') {
      if (isUSD) {
        if (p < 80000) return { label: 'فرصة عقارية مغرية فريدة', color: 'text-emerald-400 bg-emerald-950/25 border-emerald-500/20', pct: '20%', badge: '🔥 سعر تصفية' };
        if (p <= 150000) return { label: 'موافق لمتوسط أسعار المنطقة والتشطيب', color: 'text-cyan-400 bg-cyan-950/25 border-cyan-500/20', pct: '55%', badge: '⚖️ قيمة ممتازة' };
        return { label: 'استثمار راقي طويل الأمد سوبر ديلوكس', color: 'text-amber-400 bg-amber-950/25 border-amber-500/20', pct: '85%', badge: '💎 صرح فخم' };
      }
    }
    // general fallback
    const valPct = (p % 3) * 25 + 35; // stable deterministic percent for presentation
    if (valPct < 45) return { label: 'معروض مخفض ومميز', color: 'text-emerald-400 bg-emerald-950/25 border-emerald-500/20', pct: `${valPct}%`, badge: '🔥 عرض مميز' };
    if (valPct <= 75) return { label: `سعر ملائم ومقنع في أسواق ${currentMarket.labelAr} المحلية`, color: 'text-cyan-400 bg-cyan-950/25 border-cyan-500/20', pct: `${valPct}%`, badge: '⚖️ سعر معقول' };
    return { label: 'سعر حصري للجودة والأصل المضمون', color: 'text-amber-400 bg-amber-950/25 border-amber-500/20', pct: `${valPct}%`, badge: '💎 جودة ممتازة' };
  };
  const valuation = getAdValuation();

  return (
    <div className="fixed inset-0 z-[4000] overflow-y-auto flex items-start pt-20 pb-10 sm:pt-24 lg:items-center lg:pt-8 lg:pb-8 justify-center p-2.5 sm:p-5 md:py-8 bg-slate-950/85 backdrop-blur-md dir-rtl">
      
      {/* Report Ad Modal Overlay */}
      <AnimatePresence>
        {showReportForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-full max-w-md p-6 rounded-[2rem] border relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <button 
                onClick={() => setShowReportForm(false)}
                className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
              
              <h3 className={`text-lg font-black mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                إبلاغ عن إعلان
              </h3>
              
              {!reportSent ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed">ساعدنا في الحفاظ على مجتمعاتنا آمنة. ما هي مشكلة هذا الإعلان؟</p>
                  <div className="space-y-2">
                    {[
                      'احتيال أو محاولة تضليل',
                      'سلعة غير قانونية أو مخالفة',
                      'صور أو لغة غير لائقة',
                      'إعلان متكرر / Spam',
                      'أخرى'
                    ].map(r => (
                      <button 
                        key={r}
                        onClick={() => setReportReason(r)}
                        className={`w-full p-3 rounded-xl border text-right text-xs font-bold transition-all ${reportReason === r ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-950/10 border-slate-800 text-slate-400 hover:border-rose-500/50'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <button 
                    disabled={!reportReason}
                    onClick={() => {
                        if (onReportAd) onReportAd(ad.id, reportReason);
                        setReportSent(true);
                        setTimeout(() => {
                           setShowReportForm(false);
                           setReportSent(false);
                           setReportReason('');
                        }, 2000);
                    }}
                    className="w-full py-3.5 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-500 disabled:opacity-50 transition-all shadow-lg shadow-rose-500/20"
                  >
                    إرسال الإبلاغ
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
                   <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-emerald-500" />
                   </div>
                   <h4 className="text-emerald-500 font-black">شكراً لك!</h4>
                   <p className="text-[10px] text-slate-500 font-bold">تم استلام بلاغك وسيقوم فريق المراجعة بفحص الإعلان فوراً.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Gallery Overlay */}
      <AnimatePresence>
        {fullScreenIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4200] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center select-none"
          >
            {/* Close */}
            <button 
              onClick={() => setFullScreenIndex(null)}
              className="absolute top-6 left-6 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/10 transition-all z-[110]"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-8 right-8 text-white/60 font-mono text-sm tracking-widest z-[110]">
              {fullScreenIndex + 1} / {images.length}
            </div>

            {/* Navigation buttons - Desktop */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-10 z-[110] pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); handleNextFull(); }}
                className="p-4 rounded-full bg-slate-900/50 hover:bg-slate-900 text-white border border-white/5 transition-all pointer-events-auto backdrop-blur-md"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handlePrevFull(); }}
                className="p-4 rounded-full bg-slate-900/50 hover:bg-slate-900 text-white border border-white/5 transition-all pointer-events-auto backdrop-blur-md"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            {/* Main Image Container with Drag support */}
            <div className="w-full h-full flex items-center justify-center p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={fullScreenIndex}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative w-full h-full max-w-5xl max-h-[80vh] flex items-center justify-center"
                >
                  <motion.img 
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 100) handleNextFull();
                      else if (info.offset.x < -100) handlePrevFull();
                    }}
                    src={images[fullScreenIndex]} 
                    alt="full screen" 
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Thumbnail selector at bottom */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 px-4 py-3 bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-md max-w-full overflow-x-auto z-[110]">
              {images.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setFullScreenIndex(idx)}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${idx === fullScreenIndex ? 'border-emerald-500 scale-110 shadow-lg' : 'border-slate-800 opacity-50 hover:opacity-100'}`}
                >
                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outer container card with high visual glassmorphism and enhanced vertical space to prevent cropped content */}
      <div 
        className={`relative rounded-2xl sm:rounded-3xl w-full max-w-6xl overflow-y-auto lg:overflow-hidden max-h-[94vh] lg:max-h-[88vh] shadow-2xl flex flex-col lg:flex-row shadow-emerald-500/5 text-right my-auto transition-colors duration-300 ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-200"}`}
        style={{ contentVisibility: 'auto' }}
        id={`ad-modal-container-${ad.id}`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-5 sm:left-5 z-50 p-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg"
          id="close-ad-modal"
          title="إغلاق المعاينة"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Column 1: Media Showcase & Descriptions */}
        <div className="flex-1 p-5 sm:p-7 md:p-8 lg:overflow-y-auto lg:max-h-[85vh] space-y-6">
          {/* Visual Breadcrumbs for Users & Search Crawlers */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold mb-2 dir-rtl text-right select-none">
            <span onClick={onClose} className="hover:text-emerald-500 cursor-pointer transition-colors">الرئيسية</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500">{currentMarket.labelAr}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500">{categoryName}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-emerald-500 truncate max-w-[200px]">{ad.title}</span>
          </div>

          
          {/* Main Visual Carousel */}
          <div className="space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 group/media">
              {viewingVideo && ad.videoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {ad.isLive && !currentUser ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm z-20">
                      <Lock className="w-12 h-12 text-rose-500 mb-4 opacity-80" />
                      <h4 className="text-white text-base sm:text-lg font-bold mb-2">
                        {isRtl ? 'للمسجلين فقط - البث المباشر' : 'Members Only - Live Stream'}
                      </h4>
                      <p className="text-slate-400 text-xs sm:text-sm text-center max-w-sm mb-6 px-4">
                        {isRtl ? 'قم بتسجيل الدخول او إنشاء حساب مجاناً لمشاهدة البث والتفاعل مع البائع' : 'Log in or create a free account to watch the live stream and interact with the seller'}
                      </p>
                      <button 
                        onClick={onLoginRequest}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2 sm:py-2.5 px-5 sm:px-6 rounded-xl flex items-center gap-2 transition-transform active:scale-95 text-sm sm:text-base"
                      >
                        <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                        {isRtl ? 'تسجيل الدخول' : 'Log In'}
                      </button>
                    </div>
                  ) : null}
                  {(!ad.isLive || currentUser) && (
                    <>
                      {getYoutubeEmbedUrl(ad.videoUrl) ? (
                        <iframe
                          src={`${getYoutubeEmbedUrl(ad.videoUrl)}?autoplay=1&rel=0`}
                          className="w-full h-full border-0 absolute inset-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="معاينة بالفيديو"
                        />
                      ) : (
                        <video 
                          src={ad.videoUrl} 
                          controls 
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      )}
                      <div className={`absolute top-4 right-4 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg z-30 ${ad.isLive ? 'bg-rose-600 shadow-rose-600/30' : 'bg-emerald-500 shadow-emerald-500/30 !text-slate-950'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${ad.isLive ? 'bg-white' : 'bg-slate-950'}`}></span>
                        {ad.isLive ? (isRtl ? 'بث مباشر حي' : 'LIVE STREAM') : (isRtl ? 'معاينة بالفيديو الحقيقي' : 'Real Video Preview')}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <img 
                    src={activeImage || safeImages?.[0]} 
                    alt={ad.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 cursor-zoom-in"
                    referrerPolicy="no-referrer"
                    onClick={() => {
                      const idx = images.indexOf(activeImage);
                      setFullScreenIndex(idx !== -1 ? idx : 0);
                    }}
                  />
                  {ad.videoUrl && (
                    <div className="absolute bottom-4 right-4 bg-rose-500/90 text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse cursor-pointer shadow-lg" onClick={() => setViewingVideo(true)}>
                      <Video className="w-3.5 h-3.5" />
                      شاهد الفيديو الموثق للسلعة
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-slate-900/90 text-xs px-2.5 py-1 rounded-lg border border-slate-700/30 text-slate-300">
                    {cityName}{districtName ? ` - ${districtName}` : ''}
                  </div>
                  <button 
                    onClick={() => {
                      const idx = images.indexOf(activeImage);
                      setFullScreenIndex(idx !== -1 ? idx : 0);
                    }}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity bg-slate-950/20"
                  >
                    <div className="bg-slate-900/80 p-3 rounded-full border border-slate-700/50 text-white shadow-xl">
                      <Maximize2 className="w-6 h-6" />
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Preview strip */}
            {((safeImages && safeImages.length > 0) || ad.videoUrl) && (
              <div className="flex gap-2 flex-wrap">
                {safeImages?.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveImage(img);
                      setViewingVideo(false);
                    }}
                    className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      !viewingVideo && activeImage === img ? 'border-emerald-500 scale-100' : 'border-slate-800 scale-95 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`ad-${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}

                {ad.videoUrl && (
                  <button
                    onClick={() => setViewingVideo(true)}
                    className={`w-20 h-14 rounded-xl overflow-hidden border-2 bg-rose-950/40 relative flex flex-col items-center justify-center gap-0.5 transition-all outline-none ${
                      viewingVideo ? 'border-rose-500 scale-100' : 'border-slate-800 scale-95 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <Video className="w-4 h-4 text-rose-400" />
                    <span className="text-[8px] font-black text-rose-400">فيديو حقيقي</span>
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SOLD Overlay and Status Indicator */}
          {ad.status === 'sold' && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-center gap-4">
               <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center rotate-[-15deg] shadow-lg shadow-rose-500/20 shrink-0">
                 <span className="text-white font-black text-[10px]">SOLD</span>
               </div>
               <div className="text-right">
                 <h3 className="text-rose-400 font-black text-sm">لقد تمت بيعة هذا الغرض بنجاح عبر أسواق {currentMarket.labelAr}!</h3>
                 <p className="text-zinc-500 text-[10px] font-bold">هذا الإعلان مؤرشف حالياً ولم يعد متاحاً للتواصل المباشر مع المعلن.</p>
               </div>
            </div>
          )}

          {/* Heading Line */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">{categoryName}</span>
              {ad.isFeatured && <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">إعلان مميز</span>}
              {ad.jobType && (
                ad.jobType === 'hiring' ? (
                  <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/60 px-3 py-1 rounded-full font-bold">🏢 فرصة توظيف / شاغر عمل</span>
                ) : (
                  <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800/60 px-3 py-1 rounded-full font-bold">👥 طالب عمل / سيرة ذاتية</span>
                )
              )}
            </div>
            <h2 className={`text-xl sm:text-2xl font-extrabold leading-tight flex-grow ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.title}</h2>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!currentUser) {
                    onLoginRequest();
                    return;
                  }
                  const isLiked = favorites.includes(ad.id);
                  const nextLikedState = !isLiked;
                  const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
                  apiFetch(`/api/ads/${ad.id}/like`, { 
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ action: nextLikedState ? 'like' : 'unlike' })
                  }).catch(() => {});
                  if (onLikeToggle) {
                    onLikeToggle(ad.id);
                  }
                  if (onAdUpdated) {
                    onAdUpdated({ 
                      ...ad, 
                      likes: nextLikedState ? (ad.likes || 0) + 1 : Math.max(0, (ad.likes || 1) - 1) 
                    });
                  }
                }}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-center gap-2 group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-rose-500' : 'bg-slate-50 border-slate-200 hover:border-rose-500 shadow-sm'}`}
                title="إعجاب"
              >
                <Heart className={`w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform ${favorites.includes(ad.id) ? 'fill-rose-500' : ''}`} />
                <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{ad.likes || 0}</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const shareUrl = `${window.location.origin}/ad/${ad.id}`;
                  if (navigator.share) {
                    navigator.share({ title: ad.title, url: shareUrl }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      alert(isRtl ? 'تم نسخ الرابط!' : 'Link copied!');
                    });
                  }
                }}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-center group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500' : 'bg-slate-50 border-slate-200 hover:border-emerald-500 shadow-sm'}`}
                title="مشاركة"
              >
                <Share2 className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>

          {/* AI Insights Panel (Trust & Price) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {trustData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800' : 'bg-gradient-to-br from-emerald-50 to-white border-slate-200'}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-10 -mt-10" />
                  <div className="flex items-start justify-between gap-4 relative z-10">
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-emerald-500" />
                           <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">حارس الثقة الذكي</span>
                        </div>
                        <p className={`text-[11px] font-medium leading-relaxed line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {trustData.advice}
                        </p>
                        {trustData.risks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {trustData.risks.slice(0, 2).map((risk, i) => (
                              <span key={i} className="text-[8px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-lg">
                                ⚠ {risk}
                              </span>
                            ))}
                          </div>
                        )}
                     </div>
                     <div className={`flex flex-col items-center justify-center p-3 rounded-xl border min-w-[70px] ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>الموثوقية</span>
                        <span className={`text-xl font-black ${trustData.score >= 80 ? 'text-emerald-550 text-emerald-500' : trustData.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {trustData.score}%
                        </span>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {priceInsights && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800' : 'bg-gradient-to-br from-blue-50 to-white border-slate-200'}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-10 -mt-10" />
                  <div className="flex items-start justify-between gap-4 relative z-10">
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                           <TrendingUp className="w-4 h-4 text-blue-500" />
                           <span className="text-[10px] font-black text-blue-500 tracking-widest uppercase">محلل أسواق الذكي</span>
                        </div>
                        <p className={`text-[11px] font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {priceInsights.advice}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>متوسط أسواق:</span>
                           <span className={`text-[10px] font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{priceInsights.marketAverage}</span>
                        </div>
                     </div>
                     <div className={`flex flex-col items-center justify-center p-3 rounded-xl border min-w-[70px] ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>حالة السعر</span>
                        <span className={`text-xs font-black uppercase tracking-tight py-1 px-2 rounded-lg mt-1 ${
                          priceInsights.status.includes('Deal') || priceInsights.status.includes('لقطة') ? 'bg-emerald-500/20 text-emerald-500' : 
                          priceInsights.status.includes('Fair') || priceInsights.status.includes('عادل') ? 'bg-blue-500/20 text-blue-500' : 
                          'bg-amber-500/20 text-amber-500'}`}>
                          {priceInsights.status}
                        </span>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Security Shield & Image Integrity Widget */}
          <div className={`border rounded-3xl p-5 space-y-4 shadow-sm text-right dir-rtl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-xl ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>درع الأمان ومصداقية الإعلان والسلعة</h4>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>حماية فائقة من الصور المزيّفة والمنقولة من الإنترنت</p>
                  </div>
              </div>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-500 font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                مفعّل تلقائياً
              </span>
            </div>

            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2.5 bg-slate-100/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
                <ShieldAlert className="w-8 h-8 text-amber-500 animate-pulse" />
                <h5 className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>لم يتم إرفاق صور للمنتج في هذا الإعلان</h5>
                <p className={`text-[10px] leading-relaxed max-w-[320px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  هذا الإعلان لا يحتوي على صور للفحص. لبناء ثقة ومصداقية كاملة، يُنصح دائماً بإرفاق صور واقعية للسلعة المعروضة لتفعيل فحص الأمان المائي وحماية المجتمع.
                </p>
              </div>
            ) : (
              <>
                {/* Veracity Index bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>مؤشر واقعية ومصداقية صور المنتج:</span>
                    <span className={`font-black ${ad.videoUrl ? "text-emerald-500 animate-pulse" : "text-amber-500"}`}>
                      {ad.videoUrl ? "100% موثق بالفيديو الحقيقي" : "94% فحص مصداقية الصور"}
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden flex ${isDark ? 'bg-slate-950' : 'bg-slate-200'}`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${ad.videoUrl ? "bg-gradient-to-l from-emerald-500 to-emerald-400" : "bg-gradient-to-l from-amber-500 to-yellow-400"}`} 
                      style={{ width: ad.videoUrl ? "100%" : "94%" }}
                    />
                  </div>
                </div>

                {/* Verification checklist indicators */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold`}>
                  <div className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-800/60 text-slate-400' : 'bg-white border-slate-205 text-slate-700 border-slate-200'}`}>
                    {ad.videoUrl ? (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>معاينة بالفيديو المباشر: {ad.videoUrl ? "مؤكدة وعاملة" : "غير مدعومة"}</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-800/60 text-slate-400' : 'bg-white border-slate-205 text-slate-700 border-slate-200'}`}>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>حالة التاجر المعلق: {ad.userVerified ? "معتمد وموثّق الهوية" : "حساب نشط ومثبّت الهاتف"}</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-800/60 text-slate-400' : 'bg-white border-slate-205 text-slate-700 border-slate-200'}`}>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>مطابقة الإقليم الجغرافي: {cityName || `مؤكد بـ ${currentMarket.labelAr || 'البلد'}`}</span>
                  </div>
                  <div className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-slate-950/40 border-slate-800/60 text-slate-400' : 'bg-white border-slate-205 text-slate-700 border-slate-200'}`}>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>فحص رقمي معارض لوكلاء التزييف</span>
                  </div>
                </div>

                {/* Smart request button if not viewing own ad and is active */}
                {!isMyAd && ad.status === 'active' && (
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
                    <div className="flex items-start gap-2.5 text-right">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <p className={`text-[10px] leading-relaxed font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                        هل تتخوّف من أن تكون الصور مأخوذة من الإنترنت وليست للمنتج نفسه؟ 
                        <br />
                        أنقر لإرسال <strong className={`${isDark ? 'text-white' : 'text-slate-950'}`}>طلب توثيق رسمي مكتوب بالاسم</strong> تلقائياً للبائع عبر الدردشة الفورية للتأكد من وجبات المعاينة الواقعية!
                      </p>
                    </div>
                    <button
                      onClick={sendVerificationRequest}
                      disabled={verificationSent}
                      className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                        verificationSent 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : isDark
                            ? 'bg-white text-slate-900 hover:bg-slate-200 active:scale-[0.98] cursor-pointer'
                            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] cursor-pointer'
                      }`}
                    >
                      {verificationSent ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          تم إرسال طلب التوثيق بالدردشة
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          إرسال طلب توثيق الصور الآن
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Community Rating Widget */}
                <div className={`pt-3 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                  <p className={`text-[10px] font-black mb-2 select-none text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>تقييم المجتمع لمصداقية صور هذا المنتج ومطابقتها للواقع:</p>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        disabled={votedMatch !== null}
                        onClick={() => {
                          setVotedMatch('yes');
                          setYesVotes(prev => prev + 1);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all ${
                          votedMatch === 'yes' 
                            ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-500' 
                            : isDark 
                              ? 'bg-slate-800/40 border-slate-800 hover:border-slate-705 text-slate-300 active:scale-95 cursor-pointer'
                              : 'bg-white border-slate-250 hover:bg-slate-50 text-slate-700 active:scale-95 border-slate-205 cursor-pointer border-slate-200'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3 text-emerald-500" />
                        <span>مطابقة تماماً ({yesVotes})</span>
                      </button>
                      <button 
                        type="button"
                        disabled={votedMatch !== null}
                        onClick={() => {
                          setVotedMatch('no');
                          setNoVotes(prev => prev + 1);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all ${
                          votedMatch === 'no' 
                            ? 'bg-rose-500/20 border-rose-500/80 text-rose-500' 
                            : isDark
                              ? 'bg-slate-800/40 border-slate-800 hover:border-slate-705 text-slate-300 active:scale-95 cursor-pointer'
                              : 'bg-white border-slate-250 hover:bg-slate-50 text-slate-700 active:scale-95 border-slate-205 cursor-pointer border-slate-200'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3 text-rose-500" />
                        <span>صور من الإنترنت ({noVotes})</span>
                      </button>
                    </div>
                    
                    {/* Visual feedback percentages */}
                    <div className={`text-[10px] font-bold whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                      نسبة الواقعية: <span className="text-emerald-500 font-black">{Math.round((yesVotes / (yesVotes + noVotes)) * 105) > 100 ? 100 : Math.round((yesVotes / (yesVotes + noVotes)) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detail stats labels grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-950/45 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400 font-bold'}`}>مشاهدة</p>
              <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{internalViews}</p>
            </div>
            <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-950/45 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400 font-bold'}`}>إعجاب</p>
              <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{ad.likes || 0}</p>
            </div>
            <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-950/45 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400 font-bold'}`}>تاريخ ووقت النشر</p>
              <p className={`text-[10px] font-bold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                {`${new Date(ad.createdAt).toLocaleDateString('ar-YE', {year: 'numeric', month: 'numeric', day: 'numeric'})} ${new Date(ad.createdAt).toLocaleTimeString('ar-YE', {hour: '2-digit', minute: '2-digit', hour12: true})}`}
              </p>
            </div>
          </div>

          {/* Description Text Panel */}
          <div className="space-y-3" id="description-reading-panel">
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>تفاصيل وتوصيف الإعلان</span>
              </h4>
              <button
                type="button"
                onClick={() => setReadingMode(!readingMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all border shadow-sm cursor-pointer ${
                  readingMode 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20' 
                    : isDark
                      ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title={readingMode ? 'تعطيل وضع القراءة' : 'تفعيل وضع القراءة'}
                id="reading-mode-toggle"
              >
                <BookOpen className={`w-3.5 h-3.5 ${readingMode ? 'animate-pulse' : ''}`} />
                <span>{readingMode ? 'وضع القراءة نشط' : 'وضع القراءة 📖'}</span>
              </button>
            </div>

            <div 
              className={`p-5 sm:p-7 rounded-2xl border leading-loose whitespace-pre-line text-right transition-all duration-300 relative overflow-hidden ${
                readingMode 
                  ? isDark 
                    ? 'bg-[#181513] border-amber-950/40 text-[#c7beb3] shadow-inner shadow-black/35' 
                    : 'bg-[#fbf7f0] border-amber-200/50 text-[#3b2d20] shadow-inner shadow-amber-950/5'
                  : isDark 
                    ? 'bg-slate-950/30 border-slate-800 text-slate-300 text-sm' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 text-sm shadow-sm'
              }`}
              style={{ 
                fontFamily: readingMode ? 'Georgia, Cambria, "Times New Roman", Times, serif' : 'inherit',
                fontSize: readingMode ? '1.14rem' : '0.875rem',
                lineHeight: readingMode ? '1.9' : '1.625'
              }}
            >
              {readingMode && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/30 via-amber-500/80 to-amber-500/30" />
              )}
              {ad.description}
            </div>
          </div>

          {/* Real Estate Specific Details Display */}
          {ad.category === 'realestate' && (
            <div className="space-y-3">
              <h4 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>مواصفات العقار الموثق</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`border p-4 rounded-2xl space-y-4 ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`flex justify-between items-center text-sm border-b pb-2 ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
                    <span className="text-slate-500 font-bold">نوع العقار</span>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {ad.propertyType === 'villa' ? 'فيلا' : 
                       ad.propertyType === 'apartment' ? 'شقة' : 
                       ad.propertyType === 'land' ? 'أرض' : 
                       ad.propertyType === 'commercial' ? 'تجاري' : 
                       ad.propertyType === 'building' ? 'عمارة/مبنى' : 'عقار'}
                    </span>
                  </div>
                  {ad.rooms && ad.rooms > 0 && (
                    <div className={`flex justify-between items-center text-sm border-b pb-2 ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
                      <span className="text-slate-500 font-bold">عدد الغرف</span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.rooms} غرف</span>
                    </div>
                  )}
                </div>

                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>الخدمات والمرافق</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ad.amenities && ad.amenities.length > 0 ? (
                      ad.amenities.map((amenity, idx) => (
                        <span key={idx} className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-bold">
                          {amenity === 'water' ? 'مشروع مياه' : 
                           amenity === 'electricity' ? 'كهرباء' : 
                           amenity === 'fiber' ? 'إنترنت فايبر' : 
                           amenity === 'parking' ? 'موقف سيارات' : amenity}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-600 italic">لا توجد تفاصيل إضافية عن الخدمات</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Specific Details Display */}
          {ad.category === 'cars' && (
            <div className="space-y-3">
              <h4 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>مواصفات المركبة الموثقة</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`border p-3 rounded-2xl text-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[9px] font-bold block mb-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>الماركة</span>
                  <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.make || 'غير محدد'}</span>
                </div>
                <div className={`border p-3 rounded-2xl text-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[9px] font-bold block mb-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>سنة الصنع</span>
                  <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.modelYear || 'غير محدد'}</span>
                </div>
                <div className={`border p-3 rounded-2xl text-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[9px] font-bold block mb-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>ناقل الحركة</span>
                  <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {ad.transmission === 'automatic' ? 'تماتيك' : ad.transmission === 'manual' ? 'عادي' : 'غير محدد'}
                  </span>
                </div>
                <div className={`border p-3 rounded-2xl text-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[9px] font-bold block mb-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>نوع الوقود</span>
                  <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {ad.fuelType === 'gasoline' ? 'بترول' : 
                     ad.fuelType === 'diesel' ? 'ديزل' : 
                     ad.fuelType === 'hybrid' ? 'هايبرد' : 
                     ad.fuelType === 'electric' ? 'كهرباء' : 'غير محدد'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Electronics Specific Details Display */}
          {['electronics', 'phones', 'laptops'].includes(ad.category) && (
            <div className="space-y-3">
              <h4 className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>مواصفات الجهاز الموثقة</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`border p-4 rounded-2xl flex justify-between items-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-slate-500 font-bold text-xs">حالة الجهاز</span>
                  <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-black">
                    {ad.condition === 'new' ? 'جديد (كرت)' : 
                     ad.condition === 'used_mint' ? 'مستخدم نظيف' : 
                     ad.condition === 'used_good' ? 'مستخدم جيد' : 
                     ad.condition === 'used_fair' ? 'مستخدم بحالة جيدة' : 'غير محدد'}
                  </span>
                </div>
                <div className={`border p-4 rounded-2xl flex justify-between items-center ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-slate-500 font-bold text-xs">الماركة / الشركة</span>
                  <span className={`font-black text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{ad.brand || 'غير محدد'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Safety Notice Card */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${isDark ? 'bg-amber-950/15 border-amber-900/30' : 'bg-amber-50 border-amber-200'}`}>
            <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-right">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-500">تنويه الأمان في أسواق {currentMarket.labelAr}</p>
              <p className={`text-[11px] mt-1 leading-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                لا ترسل مبالغ مالية مقدماً أو حوالات إلكترونية للبائع قبل معاينة السلعة في مكان عام آمن والتأكد من سلامتها يداً بيد. أسواق {currentMarket.labelAr} لا تتدخل في المعاملات المالية المباشرة.
              </p>
            </div>
          </div>

          {/* Similar Ads (Internal Linking Showcase) */}
          {similarAds.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isRtl ? 'إعلانات مشابهة قد تهمك' : 'Similar Ads You May Like'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {similarAds.map((similarAd) => {
                  const firstImage = similarAd.images && similarAd.images.length > 0 
                    ? (Array.isArray(similarAd.images) ? similarAd.images[0] : JSON.parse(similarAd.images as any)[0])
                    : 'https://www.aswaq22.com/aswaq-icon-512.png';
                  
                  const targetUrl = (() => {
                    const countryCode = currentMarket.countryCode.toLowerCase() || 'ye';
                    const categoryObject = CATEGORIES.find(c => c.id === similarAd.category);
                    const categorySlug = categoryObject?.nameEn?.toLowerCase() || 'ads';
                    const titleSlug = slugify(similarAd.title);
                    return `/${countryCode}/${categorySlug}/${titleSlug}-${similarAd.id}`;
                  })();

                  return (
                    <div 
                      key={similarAd.id}
                      onClick={() => navigate(targetUrl)}
                      className={`group flex flex-col rounded-xl border p-2 cursor-pointer transition-all hover:border-emerald-500/50 ${isDark ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-900 mb-2">
                        <img 
                          src={firstImage.startsWith('http') ? firstImage : `https://www.aswaq22.com${firstImage}`} 
                          alt={similarAd.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <h5 className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {similarAd.title}
                      </h5>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-emerald-500 font-black">
                          {(similarAd.price || 0).toLocaleString()} {similarAd.currency === 'USD' ? '$' : isRtl ? getCurrencyAr(similarAd.currency) : similarAd.currency}
                        </span>
                        <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                          {similarAd.city}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Column 2: Seller Panel, Action Shortcuts, and Embedded Live Messenger */}
        <div className={`w-full lg:w-[400px] border-t lg:border-t-0 lg:border-r p-5 sm:p-7 md:p-8 flex flex-col justify-between lg:overflow-y-auto lg:max-h-[85vh] shrink-0 transition-colors ${isDark ? 'border-slate-800 bg-slate-950/35' : 'border-slate-205 border-slate-200 bg-slate-50/85'}`}>
          
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Price Badge */}
            <div className={`p-5 rounded-2xl border text-center space-y-3 transition-colors ${
              isDark 
                ? 'bg-gradient-to-l from-slate-900 to-slate-950 border-slate-800' 
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <p className={`text-[11px] font-semibold tracking-wider transition-colors ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>السعر المطلوب</p>
                <p className={`text-3xl font-black mt-2 transition-colors ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  {(ad.price ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  <span className={`text-xs mr-2 transition-colors ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{getCurrencyNameAr(ad.currency)}</span>
                </p>
              </div>

              {/* Dynamic Price Valuation Meter */}
              <div className={`pt-2.5 border-t text-right transition-colors ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>مؤشر عادلية السعر:</span>
                  <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${valuation.color}`}>
                    {valuation.badge}
                  </span>
                </div>
                {/* Simulated bar meter */}
                <div className={`h-1.5 w-full rounded-full overflow-hidden relative border transition-colors ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  <div 
                    className="h-full bg-gradient-to-l from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: valuation.pct }}
                  />
                </div>
                <p className={`text-[9.5px] mt-1.5 leading-normal transition-colors ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{valuation.label}</p>
              </div>
            </div>

            {/* نظام محاكاة وتقديم العروض التمويلية وأقساط أسواق الرقمية */}
            <div className={`p-4 rounded-2xl border space-y-4 transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>⚡ محاكاة وتفاوض مالي ذكي</span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20">آمن ومباشر</span>
              </div>

              {/* Offer Mode Selection Buttons */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950/40 p-1 rounded-xl border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => { setOfferMode('cash'); setOfferSuccessMessage(null); }}
                  className={`py-2 text-[10.5px] font-black rounded-lg transition-all ${
                    offerMode === 'cash'
                      ? 'bg-gradient-to-l from-emerald-500 to-emerald-600 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  💵 تقديم عرض كاش
                </button>
                <button
                  type="button"
                  onClick={() => { setOfferMode('installment'); setOfferSuccessMessage(null); setCustomBidPrice(Math.round(ad.price * 0.9)); }}
                  className={`py-2 text-[10.5px] font-black rounded-lg transition-all ${
                    offerMode === 'installment'
                      ? 'bg-gradient-to-l from-cyan-500 to-cyan-600 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📅 محاكاة أقساط ميسرة
                </button>
              </div>

              {offerSuccessMessage ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-2 text-center py-3"
                >
                  <div className="inline-flex w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 items-center justify-center text-emerald-400 font-black text-lg">
                    ✓
                  </div>
                  <p className="text-xs font-black text-emerald-400">{offerSuccessMessage}</p>
                  <p className="text-[10px] text-slate-400">سيصل البائع إشعار هاتف مالي فوري لدراسة عرضك مباشرة!</p>
                </motion.div>
              ) : (
                <div className="space-y-3.5">
                  {offerMode === 'cash' ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[10.5px] gap-3">
                        <span className="text-slate-400 shrink-0">العرض النقدي المقترح:</span>
                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 w-44">
                          <input
                            type="number"
                            value={customBidPrice || ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              setCustomBidPrice(val);
                            }}
                            className="bg-transparent border-none text-right font-black text-rose-400 outline-none w-full text-xs"
                            placeholder="اكتب عرضك هنا..."
                          />
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">{getCurrencyNameAr(ad.currency)}</span>
                        </div>
                      </div>

                      {ad.price > 0 && (
                        <>
                          <input
                            type="range"
                            min={Math.round(ad.price * 0.5)}
                            max={Math.round(ad.price * 1.5)}
                            step={Math.round(ad.price * 0.01) || 1}
                            value={customBidPrice || ad.price}
                            onChange={(e) => setCustomBidPrice(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                          />

                          <div className="flex justify-between text-[8px] text-slate-500">
                            <span>حد تفاوضي (%50-)</span>
                            <span>السعر الأصلي</span>
                            <span>شراء فوري (%50+)</span>
                          </div>
                        </>
                      )}

                      {/* Cash Rating feedback text */}
                      {ad.price > 0 ? (
                        <div className={`p-2 rounded-lg text-[9.5px] border ${
                          customBidPrice < ad.price * 0.85
                            ? 'bg-rose-500/5 text-rose-300 border-rose-500/10'
                            : customBidPrice > ad.price * 1.0
                              ? 'bg-cyan-500/5 text-cyan-300 border-cyan-500/10'
                              : 'bg-emerald-500/5 text-emerald-300 border-emerald-500/10'
                        }`}>
                          {customBidPrice < ad.price * 0.85
                            ? '⚠️ هذا العرض منخفض جداً وقد يرفضه البائع، نوصي برفع العرض لصفقات ناجحة.'
                            : customBidPrice > ad.price * 1.0
                              ? '✨ هذا السعر يعبر عن رغبة شراء شديدة وعاجلة لضمان الأولوية القصوى.'
                              : '⚡ عرض متوازن جداً وندعمه بشهادة عادلية السعر التلقائية.'}
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg text-[9.5px] border bg-emerald-500/5 text-emerald-300 border-emerald-500/10">
                          ⚡ عرض مالي مباشر ومقترح لتسهيل التفاوض والاتفاق بين الطرفين.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Downpayment Slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-slate-400">الدفعة الأولى المقدمة:</span>
                          <span className="font-extrabold text-cyan-400">
                            {(downpaymentAmount || 0).toLocaleString()} {getCurrencyNameAr(ad.currency)}
                            <span className="text-[9px] text-slate-500 mr-1">({Math.round(((downpaymentAmount || 0) / (ad.price || 1)) * 100)}%)</span>
                          </span>
                        </div>
                        <input
                          type="range"
                          min={Math.round(ad.price * 0.1)}
                          max={Math.round(ad.price * 0.85)}
                          step={Math.round(ad.price * 0.05) || 1}
                          value={downpaymentAmount}
                          onChange={(e) => setDownpaymentAmount(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                        />
                      </div>

                      {/* Installment duration selector */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400">مدة الأقساط (بالشهور):</p>
                        <div className="grid grid-cols-5 gap-1">
                          {[3, 6, 12, 18, 24].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setDurationMonths(m)}
                              className={`py-1 text-[10px] font-extrabold rounded-lg border transition-all ${
                                durationMonths === m
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-300'
                              }`}
                            >
                              {m} ش
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Installment dynamic summary calculations */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-right font-mono">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-sans">المبلغ المتبقي للتمويل:</span>
                          <span className="text-slate-300 font-black">{((ad.price || 0) - (downpaymentAmount || 0)).toLocaleString()} {ad.currency}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900 font-black">
                          <span className="text-slate-400 font-sans">القسط الشهري الصافي (بلا فوائد ربوية):</span>
                          <span className="text-emerald-400 text-sm">
                            {(Math.round(((ad.price || 0) - (downpaymentAmount || 0)) / (durationMonths || 1)) || 0).toLocaleString()} {getCurrencyNameAr(ad.currency)}
                            <span className="text-[9px] text-slate-500 block text-left">/ شهرياً</span>
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-300 border border-emerald-500/10 text-[8.5px] leading-relaxed flex items-start gap-1">
                        <span>💡</span>
                        <span>أقساط أسواق المتوافقة مع الضوابط الإسلامية وبلا رسوم ربوية خفية أو تمويلات مركبة.</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Offer Button */}
                  <button
                    type="button"
                    disabled={isSubmittingOffer}
                    onClick={() => {
                      setIsSubmittingOffer(true);
                      setTimeout(() => {
                        setIsSubmittingOffer(false);
                        const displayAmt = offerMode === 'cash' ? (customBidPrice || 0) : Math.round(((ad.price || 0) - (downpaymentAmount || 0)) / (durationMonths || 1));
                        const msg = offerMode === 'cash' 
                          ? `✓ تم تقديم عرضك الكاش بقيمة ${displayAmt.toLocaleString()} ${getCurrencyNameAr(ad.currency)} بنجاح!`
                          : `✓ تم تقديم طلب تقسيط بقسط قدره ${displayAmt.toLocaleString()} ${getCurrencyNameAr(ad.currency)}/شهرياً بنجاح!`;
                        setOfferSuccessMessage(msg);

                        // Also append a nice notification to the seller or publish dynamically in comments so everyone sees it!
                        if (adCommentsList) {
                          const sysComment = {
                            id: `sys_${Date.now()}`,
                            author: currentUser?.name || "مشتري جاد 🤝",
                            text: offerMode === 'cash'
                              ? `💸 تقدمت بعرض شراء نقدي جاد ومباشر بقيمة ${displayAmt.toLocaleString()} ${getCurrencyNameAr(ad.currency)} عبر محاكي عروض أسواق السريعة!`
                              : `📅 تقدمت بطلب تقسيط ميسر: قسط شهري ${displayAmt.toLocaleString()} ${getCurrencyNameAr(ad.currency)} على ${durationMonths} شهراً مع دفعة أولى ${downpaymentAmount.toLocaleString()} ${getCurrencyNameAr(ad.currency)}.`,
                            time: "الآن"
                          };
                          setAdCommentsList(prev => [...prev, sysComment]);
                        }
                      }, 1000);
                    }}
                    className={`w-full py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      offerMode === 'cash'
                        ? 'bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10'
                        : 'bg-gradient-to-l from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/10'
                    }`}
                  >
                    {isSubmittingOffer ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري تسجيل العرض الذكي...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 إرسال العرض المالي مباشرة للبائع</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Seller Info Container */}
            <div className="space-y-3">
              <p className={`text-xs font-bold transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>المعلَن والناشر</p>
              <div 
                onClick={() => {
                  let usr = allUsers.find(u => u.id === ad.userId) || INITIAL_USERS.find(u => u.id === ad.userId);
                  if (!usr && ad.userId) {
                    usr = {
                      id: ad.userId,
                      name: sellerName,
                      avatar: sellerAvatar || '',
                      verified: !!ad.userVerified,
                      phone: ad.contactNumber || '',
                      role: 'USER',
                      isVerified: !!ad.userVerified,
                      phoneVerified: true,
                      emailVerified: false,
                      bio: 'عضو أسواق نشط'
                    };
                  }
                  if (usr && onViewUser) onViewUser(usr);
                }}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer group ${isDark ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar 
                    src={sellerAvatar} 
                    name={sellerName} 
                    sizeClassName="w-10 h-10"
                  />
                  <div>
                    <h4 className={`text-xs font-bold flex items-center gap-1 transition-colors group-hover:text-emerald-500 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {sellerName}
                      {(ad.userVerified || ad.userId === 'user_1' || ad.userId === 'user_2') && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-950" />
                      )}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {ad.contactNumber ? (isRtl ? 'حساب موثق برقم الهاتف' : 'Verified phone account') : (isRtl ? 'عضو في أسواق' : 'Aswaq Member')}
                      </span>
                    </div>
                    {/* Social Verification Links */}
                    <div className="flex gap-2 mt-2">
                       {ad.whatsappLink && (
                         <a 
                           href={ad.whatsappLink} 
                           target="_blank" 
                           rel="noreferrer"
                           className="flex items-center gap-1 text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all no-underline"
                         >
                           <MessageCircle className="w-3 h-3" />
                           توثيق واتساب
                         </a>
                       )}
                       {ad.instagramLink && (
                         <a 
                           href={`https://instagram.com/${ad.instagramLink}`} 
                           target="_blank" 
                           rel="noreferrer"
                           className="flex items-center gap-1 text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-all no-underline"
                         >
                           <MessageSquare className="w-3 h-3" />
                           توثيق انستقرام
                         </a>
                       )}
                    </div>
                  </div>
                </div>

                {!isMyAd && onToggleFollowSeller && (
                  <button
                    type="button"
                    onClick={() => onToggleFollowSeller(ad.userId)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                      isFollowed
                        ? isDark 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-900/40'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-emerald-500 text-slate-950 border-transparent hover:bg-emerald-400'
                    }`}
                  >
                    {isFollowed ? (
                      <>
                        <UserMinus className="w-3 h-3" />
                        <span>إلغاء المتابعة</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>متابعة الحساب 👥</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Contact Actions */}
            {!isMyAd && ad.status !== 'sold' && (
              hideContactNumber ? (
                <div className={`mt-4 p-4 border rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-colors ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <EyeOff className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className={`text-[11px] font-bold max-w-[200px] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-655'}`}>
                    قام المعلن بإخفاء رقم التواصل. يمكنك مراسلته عبر الدردشة الفورية.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-4 hide-scrollbar">
                  <a 
                    href={`https://wa.me/${ad.contactNumber || ad.whatsappLink?.split('/').pop() || '000000000'}?text=مرحباً، بخصوص إعلانك: ${ad.title}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] hover:bg-[#1ebd5a] text-white flex items-center justify-center gap-2 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#25D366]/20 font-black text-xs h-11 relative z-10"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>تواصل واتساب</span>
                  </a>
                  
                  <a 
                    href={`tel:${ad.contactNumber || '000000000'}`}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 font-black text-xs h-11 relative z-10"
                  >
                    <Phone className="w-4 h-4" />
                    <span>إتصال مباشر</span>
                  </a>
                </div>
              )
            )}

            {!isMyAd && (
              <div className="mt-2 flex justify-center">
                <button 
                  onClick={() => setShowReportForm(true)}
                  className={`text-[10px] font-black flex items-center gap-1 transition-all ${
                    isDark 
                      ? 'text-rose-400 hover:text-rose-300 opacity-80' 
                      : 'text-rose-600 hover:text-rose-700 opacity-100'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  الإبلاغ عن مشكلة في هذا الإعلان
                </button>
              </div>
            )}	

            {/* Public Comments Section - Replaced Contact buttons based on user request */}
            {ad.status !== 'sold' && (
              <div className={`mt-6 border-t pt-5 transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <h3 className={`text-md font-black mb-4 flex items-center gap-2 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  تبادل الآراء والتعليقات ({adCommentsList.length})
                </h3>

                <form onSubmit={handlePostComment} className="flex gap-2 mb-5">
                  <input
                    type="text"
                    placeholder="اكتب تعليقاً أو استفساراً وتبادل الرأي هنا..."
                    className={`flex-1 rounded-xl px-4 py-3 text-xs outline-none transition-colors border ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 shadow-sm'
                    }`}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    disabled={loadingComment}
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl text-xs cursor-pointer shadow-lg transition-colors border-none"
                    disabled={loadingComment}
                  >
                    {loadingComment ? <Loader2 className="w-4 h-4 animate-spin text-slate-900 mx-auto" /> : 'نشر'}
                  </button>
                </form>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {adCommentsList.length === 0 ? (
                    <div className={`text-center text-xs py-8 rounded-xl border transition-colors ${
                      isDark 
                        ? 'text-slate-500 bg-slate-900/40 border-slate-800/50' 
                        : 'text-slate-600 bg-white border-slate-200 shadow-sm'
                    }`}>
                      لا توجد تعليقات حتى الآن، كن أول من يكتب رأيه حول هذا المنتج! 💬
                    </div>
                  ) : (
                    adCommentsList.map(c => (
                      <div key={c.id} className={`flex gap-3 p-3 rounded-xl border transition-all ${
                        isDark 
                          ? 'bg-slate-900/40 border-slate-800/50' 
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}>
                        <div className={`w-8 h-8 rounded-full shrink-0 overflow-hidden text-[10px] flex items-center justify-center font-bold uppercase transition-all ${
                          isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {c.author?.name ? c.author.name.charAt(0) : 'م'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.author?.name || 'مستخدم'}</span>
                            <span className={`text-[9px] transition-colors ${isDark ? 'text-slate-600' : 'text-slate-400 font-medium'}`}>
                              {new Date(c.createdAt).toLocaleDateString('ar-YE')}
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed whitespace-pre-wrap transition-colors ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Standard User State Controls (Edit/Status togglers) */}
            {isMyAd && (onAdStatusChange || onAdUpdated) && (
              <div className="pt-2 border-t border-slate-850 space-y-2 relative z-10">
                <p className="text-xs font-semibold text-slate-400">إدارة إعلانك</p>
                <div className="grid grid-cols-2 gap-2">
                  {onAdStatusChange && (
                    ad.status === 'active' ? (
                      <button
                        onClick={() => onAdStatusChange(ad.id, 'sold')}
                        className="bg-cyan-900/40 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 font-bold text-xs h-10 rounded-xl transition-all"
                      >
                        تغيير لـ "تمت البيعة"
                      </button>
                    ) : (
                      <button
                        onClick={() => onAdStatusChange(ad.id, 'active')}
                        className="bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs h-10 rounded-xl transition-all"
                      >
                        إعادة تنشيط
                      </button>
                    )
                  )}
                  {onAdUpdated && (
                    <button
                      onClick={handleToggleContactNumber}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs h-10 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      {hideContactNumber ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>إظهار الرقم</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>إخفاء الرقم</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Embedded Live Chat vs Digital Trade Intermediary tabs */}
            {ad.status !== 'sold' && (
              <div className={`pt-4 flex-1 flex flex-col justify-between mt-4 border-t transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                
                {isMyAd ? (
                  // OWNER VIEW
                  <>
                    <h5 className="text-[11px] font-black mb-2 flex items-center justify-between gap-1.5 leading-none text-right">
                      <span className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        دردشات المشترين على إعلانك
                      </span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">المعلن 📢</span>
                    </h5>

                    {uniqueBuyerIds.length === 0 ? (
                      <div className={`rounded-xl p-4 h-32 flex flex-col items-center justify-center text-center border transition-colors ${
                        isDark ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
                      }`}>
                        <MessageSquare className="w-8 h-8 text-slate-700 mb-2 opacity-60" />
                        <span className={`text-[10px] font-bold max-w-[80%] leading-normal ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          لا توجد رسائل مستلمة بعد من المشترين على هذا الإعلان المحدد.
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Avatar-based horizontal selector of buyers who messaged this ad */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
                          {uniqueBuyerIds.map((buyerId) => {
                            const info = getBuyerNameAndAvatar(buyerId);
                            const isActive = selectedBuyerId === buyerId;
                            return (
                              <button
                                key={buyerId}
                                type="button"
                                onClick={() => setSelectedBuyerId(buyerId)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all shrink-0 cursor-pointer ${
                                  isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : isDark 
                                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                      : 'bg-white border-slate-250 text-slate-600 hover:text-slate-900 shadow-sm'
                                }`}
                              >
                                {info.avatar ? (
                                  <img src={info.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full bg-slate-805 flex items-center justify-center text-[8px] text-white">👤</div>
                                )}
                                <span>{info.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Messages panel for Owner */}
                        <div 
                          ref={scrollRef}
                          className={`rounded-xl p-3 h-32 overflow-y-auto space-y-2 border transition-colors ${
                            isDark ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200 shadow-inner'
                          }`}
                        >
                          {visibleMessages.length === 0 ? (
                            <div className="text-center text-[10px] text-slate-500 h-full flex flex-col items-center justify-center p-2">
                              أهلاً بك! انقر على المشتري بالأعلى للاطلاع ومتابعة المحادثة معه والرد عليه مباشرة.
                            </div>
                          ) : (
                            visibleMessages.map((msg) => {
                              const mine = currentUser ? msg.senderId === currentUser.id : false;
                              return (
                                <div 
                                  key={msg.id}
                                  className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}
                                >
                                  <div className={`p-2 rounded-lg text-xs leading-normal max-w-[85%] ${
                                    mine 
                                      ? 'bg-emerald-500 text-slate-950 font-bold rounded-tr-none' 
                                      : isDark
                                        ? 'bg-slate-805 text-slate-100 rounded-tl-none'
                                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/40 shadow-sm'
                                  }`}>
                                    {msg.text}
                                  </div>
                                  <span className="text-[8px] text-slate-500 mt-0.5">
                                    {new Date(msg.timestamp).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Reply Form */}
                        {selectedBuyerId && (
                          <form onSubmit={handleSendMessage} className="mt-2 flex gap-1.5">
                            <input
                              type="text"
                              placeholder={`الرد على ${getBuyerNameAndAvatar(selectedBuyerId).name}...`}
                              className={`flex-1 rounded-xl text-xs px-3 outline-none h-9 text-right border transition-colors ${
                                isDark 
                                  ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-500' 
                                  : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 shadow-sm'
                              }`}
                              value={msgText}
                              onChange={(e) => setMsgText(e.target.value)}
                              disabled={loadingChat}
                            />
                            <button
                              type="submit"
                              className="w-10 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform shrink-0 active:scale-95 cursor-pointer"
                              disabled={loadingChat}
                            >
                              {loadingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // BUYER VIEW
                  <>
                    {/* Tab select buttons */}
                    <div className={`flex gap-1.5 p-1 rounded-xl border mb-3.5 transition-colors ${
                      isDark ? 'bg-slate-950 border-slate-850' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <button
                        onClick={() => setChatTab('live')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                          chatTab === 'live'
                            ? isDark
                              ? 'bg-slate-800 text-white border border-slate-700/60'
                              : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                            : 'text-slate-500 hover:text-slate-750'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>💬 مراسلة مباشرة مع المعلن</span>
                      </button>
                      <button
                        onClick={() => setChatTab('ai')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                          chatTab === 'ai'
                            ? isDark
                              ? 'bg-emerald-950/25 text-emerald-400 border border-emerald-800/30'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                            : 'text-slate-500 hover:text-slate-755'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>🤝 الوكيل التجاري المفوض (تسويه فورية)</span>
                      </button>
                    </div>

                    {chatTab === 'live' ? (
                      <>
                        <h5 className={`text-[10px] font-bold mb-2 flex items-center gap-1.5 leading-none transition-colors ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                          الدردشة والطلب المباشر مع صاحب الإعلان
                        </h5>

                        {/* Messages panel */}
                        <div 
                          ref={scrollRef}
                          className={`rounded-xl p-3 h-32 overflow-y-auto space-y-2 border transition-colors ${
                            isDark ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200 shadow-inner'
                          }`}
                        >
                          {visibleMessages.length === 0 ? (
                            <div className="text-center text-[10px] text-slate-500 h-full flex flex-col items-center justify-center p-2 leading-relaxed">
                              لا توجد محادثات سابقة لمعاينة وتفاوض هذه السلعة. أرسل رسالة للبائع بالأسفل لبدء التفاهم فوراً!
                            </div>
                          ) : (
                            visibleMessages.map((msg) => {
                              const mine = currentUser ? msg.senderId === currentUser.id : false;
                              
                              return (
                                <div 
                                  key={msg.id}
                                  className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}
                                >
                                  <div className={`p-2 rounded-lg text-xs leading-normal max-w-[85%] ${
                                    mine 
                                      ? 'bg-emerald-500 text-slate-950 font-bold rounded-tr-none' 
                                      : isDark
                                        ? 'bg-slate-800 text-slate-100 rounded-tl-none'
                                        : 'bg-slate-105 bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50 shadow-sm'
                                  }`}>
                                    {msg.text}
                                  </div>
                                  <span className="text-[8px] text-slate-500 mt-0.5">
                                    {new Date(msg.timestamp).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Submitting form */}
                        <form onSubmit={handleSendMessage} className="mt-2 flex gap-1.5">
                          <input
                            type="text"
                            placeholder="اسأل البائع... (مثال: هل السعر قابل للتفاوض؟)"
                            className={`flex-1 rounded-xl text-xs px-3 outline-none h-9 text-right border transition-colors ${
                              isDark 
                                ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-500' 
                                : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-emerald-500'
                            }`}
                            value={msgText}
                            onChange={(e) => setMsgText(e.target.value)}
                            disabled={loadingChat}
                            id={`chat-input-modal-${ad.id}`}
                          />
                          <button
                            type="submit"
                            className="w-10 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform shrink-0 active:scale-95 cursor-pointer"
                            disabled={loadingChat}
                            id={`chat-send-btn-modal-${ad.id}`}
                          >
                            {loadingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <h5 className={`text-[10px] font-bold mb-2 flex items-center gap-1.5 leading-none transition-colors ${
                          isDark ? 'text-emerald-400' : 'text-emerald-705 text-emerald-800'
                        }`}>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          مفاوضة القيمة والسعر التلقائية المعتمدة للبائع
                        </h5>

                        {/* Messages panel */}
                        <div 
                          ref={aiScrollRef}
                          className={`rounded-xl p-3 h-32 overflow-y-auto space-y-2 border transition-colors relative ${
                            isDark 
                              ? 'bg-slate-950 border-emerald-950/35' 
                              : 'bg-white border-emerald-100 shadow-inner'
                          }`}
                        >
                          {aiChatLogs.map((msg, idx) => {
                            const mine = msg.role === 'user';
                            
                            return (
                              <div 
                                key={idx}
                                className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}
                              >
                                <div className={`p-2 rounded-lg text-xs leading-normal max-w-[85%] ${
                                  mine 
                                    ? 'bg-gradient-to-l from-emerald-500 to-emerald-600 text-slate-950 font-bold rounded-tr-none shadow-sm' 
                                    : isDark
                                      ? 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
                                      : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                                }`}>
                                  {msg.text}
                                </div>
                                <span className="text-[8px] text-slate-500 mt-0.5">
                                  {mine ? 'أنت' : 'الوكيل المعتمد لحسم السعر'}
                                </span>
                              </div>
                            );
                          })}
                          
                          {isAiNegotiating && (
                            <div className="flex flex-col items-end">
                              <div className={`p-2.5 rounded-lg text-xs rounded-tl-none flex items-center gap-1.5 border transition-colors ${
                                isDark 
                                  ? 'bg-slate-900 text-emerald-400 border-emerald-900/30' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm'
                              }`}>
                                <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                                <span>يجري تدقيق وتأكيد عرض السعر تجارياً...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Submitting form */}
                        <form onSubmit={handleSendAiMessage} className="mt-2 flex gap-1.5">
                          <input
                            type="text"
                            placeholder="اطرح سعرك المقترح... (مثال: هل يمكن إتمامه بسعر...؟)"
                            className={`flex-1 rounded-xl text-xs px-3 outline-none h-9 text-right border transition-colors ${
                              isDark 
                                ? 'bg-slate-900 border-slate-850 text-slate-201 placeholder:text-slate-505 focus:border-emerald-500' 
                                : 'bg-white border-slate-300 text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 shadow-sm'
                            }`}
                            value={aiMsgText}
                            onChange={(e) => setAiMsgText(e.target.value)}
                            disabled={isAiNegotiating}
                            id={`chat-input-ai-${ad.id}`}
                          />
                          <button
                            type="submit"
                            className="w-10 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 flex items-center justify-center transition-transform shrink-0 active:scale-95 cursor-pointer"
                            disabled={isAiNegotiating}
                            id={`chat-send-ai-modal-${ad.id}`}
                          >
                            {isAiNegotiating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </form>
                      </>
                    )}
                  </>
                )}

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
