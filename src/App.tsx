/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import React, { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import {
  Plus,
  MapPin,
  MessageSquare,
  CheckCircle2,
  ArrowLeft,
  Search,
  ShieldAlert,
  User as UserIcon,
  Heart,
  ChevronDown,
  ChevronUp,
  X,
  Mail,
  Lock,
  Phone,
  ArrowUpRight,
  Info,
  Sliders,
  RotateCcw,
  Home,
  Map,
  ChevronLeft,
  Briefcase,
  Car,
  Smartphone,
  Globe,
  Users,
  Film,
  ShoppingBag,
  Truck,
  Tag,
  CheckCircle,
  Send,
  CornerDownLeft,
  Image as ImageIcon,
  FileText,
  Video,
  Share2,
  Navigation,
  Star,
  Trash2
} from "lucide-react";
import PwaInstallPrompt from "./components/PwaInstallPrompt.tsx";

import { User, Ad, ChatMessage, AppNotification, UserRole } from "./types.ts";
import { CITIES, CATEGORIES, INITIAL_USERS, DISTRICTS, SUB_CATEGORIES } from "./data.ts";
import { useTheme } from "./context/ThemeContext.tsx";
import { useMarket } from "./context/MarketContext.tsx";
import { apiFetch } from "./lib/api";

import { AnimatePresence, motion } from "motion/react";
import { MARKETS, Market } from "./markets.ts";
import Navbar from "./components/Navbar.tsx";
import Hero from "./components/Hero.tsx";
import AdCard from "./components/AdCard.tsx";
import type { AdMapHandle } from "./modules/maps/AdMap.tsx";
// Widget and modal components — lazy loaded, only appear on demand
const HelpCenter = React.lazy(() => import("./components/HelpCenter.tsx"));
const AiSearchModal = React.lazy(() => import("./components/AiSearchModal.tsx"));
const UserProfileModal = React.lazy(() => import("./components/UserProfileModal.tsx"));
const ExchangeRatesWidget = React.lazy(() => import("./components/ExchangeRatesWidget.tsx"));
const PriceInsightsWidget = React.lazy(() => import("./components/PriceInsightsWidget.tsx"));
import { Toaster } from "react-hot-toast";
import ToastContainer, { ToastMessage } from "./components/Toast.tsx";
import socket, { joinRoom } from "./lib/socket.ts";
import MainContentArea from "./components/MainContentArea.tsx";
import { setupPushNotifications } from "./lib/native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./lib/firebase";
import { API_BASE_URL } from "./lib/config";
import { loadGoogleMapsScript } from "./modules/maps/googleMaps.ts";

// Heavy modals — lazy loaded since they only appear on user interaction
const AuthModal = React.lazy(() => import("./components/AuthModal.tsx"));
const WelcomeFlow = React.lazy(() => import("./components/WelcomeFlow.tsx"));
const LocationMapPicker = React.lazy(() => import("./modules/maps/LocationMapPicker.tsx"));
const IdentityVerificationModal = React.lazy(() => import("./components/IdentityVerificationModal.tsx"));
const OtpVerification = React.lazy(() => import("./components/OtpVerification.tsx").then(m => ({ default: m.OtpVerification })));

import JobPortal from "./components/JobPortal.tsx";

// Heavy pages — lazy loaded since they only appear on user navigation
const Dashboard = React.lazy(() => import("./components/Dashboard.tsx"));
const AdminPanel = React.lazy(() => import("./components/AdminPanel.tsx"));
const AdMap = React.lazy(() => import("./modules/maps/AdMap.tsx"));
const SpotlightFeed = React.lazy(() => import("./components/SpotlightFeed.tsx"));
const DeliveryDashboard = React.lazy(() => import("./modules/shipping/DeliveryDashboard.tsx"));
// AdModal is large (129 KB) — lazy loaded to remove it from the initial bundle
const AdModal = React.lazy(() => import("./components/AdModal.tsx"));

// Global geographical anchors for distance calculations
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  sanaa_city: { lat: 15.3694, lng: 44.1910 },
  aden: { lat: 12.7855, lng: 45.0186 },
  taiz: { lat: 13.5795, lng: 44.0206 },
  hadramout: { lat: 15.9333, lng: 48.7833 },
  ibb: { lat: 13.9669, lng: 44.1822 },
  hodeidah: { lat: 14.7979, lng: 42.9530 },
  marib: { lat: 15.4619, lng: 45.3253 },
  saada: { lat: 16.9402, lng: 43.7639 },
  hajjah: { lat: 15.6939, lng: 43.6019 },
  amran: { lat: 15.6601, lng: 43.9439 },
  al_jawf: { lat: 16.4750, lng: 45.4200 },
  al_mahra: { lat: 16.2167, lng: 52.1667 },
  socotra: { lat: 12.4634, lng: 53.8237 },
  abyan: { lat: 13.5833, lng: 45.7500 },
  lahj: { lat: 13.1667, lng: 44.8333 },
  shabwa: { lat: 14.5333, lng: 46.8333 },
  al_bayda: { lat: 14.2122, lng: 45.4744 },
  dhale: { lat: 13.6953, lng: 44.7314 },
  al_mawit: { lat: 15.4701, lng: 43.5448 },
  raymah: { lat: 14.6300, lng: 43.7100 }
};

// Haversine formula
const getDistanceInKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const LazyFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[350px] w-full py-16 space-y-4">
    <div className="w-10 h-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
    <span className="text-xs font-bold text-slate-500">جاري تحميل المحتوى بشكل آمن...</span>
  </div>
);

const formatPrice = (price: any) => {
  if (price === undefined || price === null || isNaN(Number(price))) return '0';
  return new Intl.NumberFormat("en-US").format(Number(price));
};

export function slugify(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\u0621-\u064A-]+/g, '') // Keep alphanumeric, Arabic chars and -
    .replace(/--+/g, '-')          // Replace multiple - with single -
    .replace(/^-+/, '')            // Trim - from start
    .replace(/-+$/, '');           // Trim - from end
}

export default function App() {
  // Market Logic
  const { market: currentMarket, setMarket: setCurrentMarket } = useMarket();
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  // Navigation page views: 'home' | 'create-ad' | 'my-ads' | 'analytics' | 'messages' | 'settings'
  const [currentTab, setCurrentTab] = useState("home");

  // Search & Filters parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    if (selectedCategory && isJobsCategorySelected(selectedCategory)) {
      setPlatformMode('jobs');
    }
  }, [selectedCategory]);
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  
  // Top-level App State Declarations (prevents initialization TDZ hoisting errors)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aswaq_current_user');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        console.error('Failed to parse current user from localStorage', e);
        return null;
      }
    }
    return null;
  });
  const [selectedUserPreview, setSelectedUserPreview] = useState<User | null>(null);
  const [platformMode, setPlatformMode] = useState<'marketplace' | 'delivery' | 'social' | 'reels'>('marketplace');
  const [viewMode, setViewMode] = useState<"split" | "grid" | "map">("split");
  
  // ── Auth Persistence via our own JWT ────────────────────────────────────
  // We use inMemoryPersistence for Firebase (to bypass Edge tracking prevention).
  // Session persistence is handled by our backend JWT stored in localStorage.
  useEffect(() => {
  const handler = CapApp.addListener('appUrlOpen', async (event) => {
    const url = new URL(event.url);
    if (url.protocol === 'com.aswaq.enterprise:') {
      // أغلق المتصفح الخارجي فوراً بعد العودة
      try { await Browser.close(); } catch (_) {}
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      const userStr = url.searchParams.get('user');
      if (accessToken && refreshToken && userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          localStorage.setItem('aswaq_access_token', accessToken);
          localStorage.setItem('auth_token', accessToken);
          localStorage.setItem('aswaq_refresh_token', refreshToken);
          localStorage.setItem('aswaq_current_user', JSON.stringify(user));
          setCurrentUser(user);
          window.history.replaceState({}, document.title, '/');
        } catch (e) {
          console.error('Failed to parse deep‑link auth payload', e);
        }
      }
    }
  });
  return () => { handler.then((h) => h.remove()).catch(() => {}); };
  }, []);
useEffect(() => {
    // ── التقاط نتيجة OAuth من الويب (عودة من سيرفر Google) ──────────────────
  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'success') {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userStr = params.get('user');
    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        localStorage.setItem('aswaq_access_token', accessToken);
        localStorage.setItem('auth_token', accessToken);
        localStorage.setItem('aswaq_refresh_token', refreshToken);
        localStorage.setItem('aswaq_current_user', JSON.stringify(user));
        setCurrentUser(user);
      } catch (e) {
        console.error('[App] Failed to parse web OAuth payload', e);
      }
    }
    // نظّف الرابط من معطيات التوكن
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (params.get('auth') === 'error') {
    console.error('[App] Web OAuth failed:', params.get('reason'));
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
useEffect(() => {
    let cancelled = false;

    const syncFirebaseUserToBackend = async (fbUser: any) => {
      try {
        if (!fbUser || cancelled) return;

        const idToken = await fbUser.getIdToken(true);

        const r = await fetch('/api/v1/auth/firebase/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (!r.ok || cancelled) return;

        const d = await r.json();
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) {
          localStorage.setItem('aswaq_current_user', JSON.stringify(d.user));
          setCurrentUser(d.user);
          console.log('[App] Firebase sign-in synchronized:', d.user.name);
        }
      } catch (e) {
        console.error('[App] Firebase sync error:', e);
      }
    };

    // ─── OAuth Callback Processing (Google OAuth 2.0 direct backend redirect) ───
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userStr = params.get('user');

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        localStorage.setItem('aswaq_access_token', accessToken);
        localStorage.setItem('aswaq_refresh_token', refreshToken);
        localStorage.setItem('aswaq_current_user', JSON.stringify(user));
        setCurrentUser(user);
        
        // Clean URL parameters from the address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('[App] Session established from direct Google OAuth redirect:', user.name);
        return;
      } catch (e) {
        console.error('Failed to parse Google OAuth redirect payload:', e);
      }
    }

    // On load: restore session from our stored JWT / user data
    const restoreSession = async () => {
      const storedUser = localStorage.getItem('aswaq_current_user');
      const storedToken = localStorage.getItem('aswaq_access_token');

      if (storedUser && storedToken) {
        try {
          // Verify token with backend
          const res = await fetch('/api/users/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            const user = data.user ?? data;
            console.log('[App] Session restored from JWT:', user.name);
            localStorage.setItem('aswaq_current_user', JSON.stringify(user));
            setCurrentUser(user);
            return;
          }
          
          if (res.status === 401 || res.status === 403) {
            // Token expired — try to refresh using stored refresh token
            const storedRefreshToken = localStorage.getItem('aswaq_refresh_token');
            if (storedRefreshToken) {
              console.log('[App] Access token expired, attempting refresh...');
              try {
                const refreshRes = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken: storedRefreshToken }),
                });
                if (refreshRes.ok) {
                  const newTokens = await refreshRes.json();
                  localStorage.setItem('aswaq_access_token', newTokens.accessToken);
                  localStorage.setItem('auth_token', newTokens.accessToken);
                  if (newTokens.refreshToken) {
                    localStorage.setItem('aswaq_refresh_token', newTokens.refreshToken);
                  }
                  // Retry /me with new access token
                  const retryRes = await fetch('/api/users/me', {
                    headers: { Authorization: `Bearer ${newTokens.accessToken}` },
                  });
                  if (retryRes.ok) {
                    const retryData = await retryRes.json();
                    const retryUser = retryData.user ?? retryData;
                    console.log('[App] Session restored via refresh token:', retryUser.name);
                    localStorage.setItem('aswaq_current_user', JSON.stringify(retryUser));
                    setCurrentUser(retryUser);
                    return;
                  }
                }
              } catch (refreshErr) {
                console.error('[App] Refresh token request failed:', refreshErr);
              }
            }
            // Fallback: use cached user optimistically so user is never logged out
            try {
              const cached = JSON.parse(storedUser);
              console.log('[App] Session check fallback - using cached user:', cached.name);
              setCurrentUser(cached);
            } catch { /* ignore */ }
          } else {
            throw new Error(`Backend error ${res.status}`);
          }
        } catch {
          // Network error or 5xx - use cached user optimistically
          try {
            const cached = JSON.parse(storedUser);
            console.log('[App] Network unavailable - using cached user:', cached.name);
            setCurrentUser(cached);
          } catch { /* ignore */ }
        }
      }
    };

    restoreSession();



    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;

      const storedUserStr = localStorage.getItem('aswaq_current_user');
      const hasToken = !!localStorage.getItem('aswaq_access_token');
      
      // Prevent Firebase Auth from auto-overwriting current user session with a different account
      if (hasToken && storedUserStr) {
        try {
          const storedUser = JSON.parse(storedUserStr);
          if (storedUser && (
            (storedUser.email && fbUser.email && storedUser.email.toLowerCase() !== fbUser.email.toLowerCase()) ||
            (storedUser.phone && fbUser.phoneNumber && storedUser.phone !== fbUser.phoneNumber)
          )) {
            console.warn('[App] Firebase auth user differs from logged-in user. Skipping auto-sync.');
            return;
          }
        } catch (_) {}
      }

      if (hasToken && !cancelled) return;

      await syncFirebaseUserToBackend(fbUser);
    });

    const handleAuthRequired = () => {
      // Only prompt login if the user truly has no valid token in storage.
      // If a token still exists, this is a transient 401 (e.g. server restart)
      // and we should NOT kick the user out of their session.
      const hasToken = !!(localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token'));
      if (hasToken) {
        console.warn('[App] auth-required fired but token still exists — suppressing login modal (transient 401).');
        return;
      }
      console.warn('[App] Authentication required event received. Prompting login...');
      addToast('مطلوب تسجيل الدخول', 'يرجى تسجيل الدخول للوصول لهذه العملية.', 'info');
      triggerLoginFlow('splash');
    };

    window.addEventListener('aswaq:auth-required', handleAuthRequired);

    return () => {
      cancelled = true;
      unsubscribeAuth();
      window.removeEventListener('aswaq:auth-required', handleAuthRequired);
    };
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  // 1. Synchronize URL state on load / pathname changes
  useEffect(() => {
    const syncRouteToState = async () => {
      const pathname = location.pathname;
      if (!pathname || pathname === '/') return;

      // Handle /profile & /account
      if (pathname === '/profile' || pathname === '/account') {
        setCurrentTab('profile');
        if (currentUser) {
          setSelectedUserPreview(currentUser);
        }
        document.title = 'ملفي الشخصي | أسواق';
        return;
      }

      if (pathname === '/messages') { setCurrentTab('messages'); document.title = 'الرسائل والمحادثات | أسواق'; return; }
      if (pathname === '/notifications') { setCurrentTab('notifications'); document.title = 'الإشعارات والتنبيهات | أسواق'; return; }
      if (pathname === '/my-ads') { setCurrentTab('my-ads'); document.title = 'إعلاناتي | أسواق'; return; }
      if (pathname === '/analytics') { setCurrentTab('analytics'); document.title = 'تحليلات الأداء | أسواق'; return; }

      // 0. Parse Query Parameters & Hash for Shared Links (?adId=..., ?userId=..., ?ad=..., #ad-...)
      const searchParams = new URLSearchParams(window.location.search);
      const sharedAdId = searchParams.get('adId') || searchParams.get('ad') || searchParams.get('post');
      const sharedUserId = searchParams.get('userId') || searchParams.get('user');
      const hash = window.location.hash || '';
      const hashAdId = (hash.startsWith('#ad-') || hash.startsWith('#post-')) ? hash.replace(/^#(ad|post)-/, '') : null;

      const targetAdId = sharedAdId || hashAdId;
      if (targetAdId && selectedAd?.id !== targetAdId) {
        try {
          const res = await fetch(`/api/ads/${targetAdId}`);
          if (res.ok) {
            const adData = await res.json();
            setSelectedAd(adData);
          }
        } catch (e) {
          console.error('Failed to fetch shared ad from query parameter', e);
        }
      }

      if (sharedUserId && selectedUserPreview?.id !== sharedUserId) {
        try {
          const res = await fetch(`/api/v1/users/${sharedUserId}`);
          if (res.ok) {
            const u = await res.json();
            setSelectedUserPreview(u);
          }
        } catch (e) {
          console.error('Failed to fetch shared user profile from query parameter', e);
        }
      }

      // Handle /profile/:id
      if (pathname.startsWith('/profile/')) {
        const uid = pathname.replace('/profile/', '');
        if (uid && selectedUserPreview?.id !== uid) {
          try {
            const res = await fetch(`/api/v1/users/${uid}`);
            if (res.ok) {
              const u = await res.json();
              setSelectedUserPreview(u);
            }
          } catch (e) {
            console.error('Failed to fetch profile from URL', e);
          }
        }
        return;
      }

      // Handle section routes
      if (pathname === '/reels') { setPlatformMode('spotlight'); document.title = 'شورتس وسواري أسواق | فيديوهات الإعلانات'; return; }
      if (pathname === '/jobs') { setPlatformMode('jobs'); document.title = 'بوابة الوظائف والفرص | أسواق'; return; }
      if (pathname === '/delivery') { setPlatformMode('delivery'); document.title = 'خدمات الشحن والتوصيل | أسواق'; return; }
      if (pathname === '/create-ad') { setPlatformMode('create'); document.title = 'إضافة إعلان جديد | أسواق'; return; }

      // Skip sync if it's dynamic search page
      if (pathname.startsWith('/search/')) {
        const query = decodeURIComponent(pathname.substring(8));
        setSearchQuery(query);
        setCurrentTab('home');
        return;
      }

      // Check if it's an ad URL (starts with country and has UUID)
      const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const match = pathname.match(uuidRegex);
      if (match) {
        const adId = match[0];
        if (selectedAd?.id !== adId) {
          try {
            const res = await fetch(`/api/ads/${adId}`);
            if (res.ok) {
              const adData = await res.json();
              setSelectedAd(adData);
            }
          } catch (e) {
            console.error('Failed to auto-fetch ad details from URL', e);
          }
        }
        return;
      }

      // Check landing pages: /:country/:category or /:country/:city/:category
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        const countryCode = segments[0].toUpperCase();
        if (MARKETS[countryCode]) {
          setCurrentMarket(MARKETS[countryCode]);
        }

        if (segments.length === 2) {
          const categorySlug = segments[1].toLowerCase();
          const category = CATEGORIES.find(c => c.nameEn.toLowerCase() === categorySlug);
          if (category) {
            setSelectedCategory(category.id);
          }
        } else if (segments.length === 3) {
          const citySlug = segments[1];
          const categorySlug = segments[2].toLowerCase();
          
          const market = MARKETS[countryCode];
          if (market) {
            const city = market.cities.find(c => slugify(c.nameEn) === citySlug);
            if (city) {
              setSelectedCity(city.id);
            }
          }
          const category = CATEGORIES.find(c => c.nameEn.toLowerCase() === categorySlug);
          if (category) {
            setSelectedCategory(category.id);
          }
        }
      }
    };

    syncRouteToState();
  }, [location.pathname]);

  // Load Google Maps Script once globally
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        console.log('[App] Google Maps with Places loaded.');
      })
      .catch(err => {
        console.error('[App] Failed to load Google Maps:', err);
      });
  }, []);
  
  // Detect Location on Mount
  useEffect(() => {
    return;
    const detectMarket = async () => {
      try {
        let countryCode = null;
        let cData: any = null;
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          if (data && data.country_code) {
             countryCode = data.country_code;
             cData = data;
          }
        } catch (ipapiError) {
          console.log("ipapi.co failed, trying api.country.is");
          const fallbackRes = await fetch("https://api.country.is/");
          const fallbackData = await fallbackRes.json();
          if (fallbackData && fallbackData.country) {
             countryCode = fallbackData.country;
          }
        }
        
        if (countryCode) {
          if (MARKETS[countryCode]) {
             setCurrentMarket(MARKETS[countryCode]);
             console.log("Market switched based on IP:", countryCode);
          } else {
             // Dynamically generate the market!
             const arName = new Intl.DisplayNames(['ar'], { type: 'region' }).of(countryCode) || countryCode;
             const enName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
             
             const dynamicCities: any[] = [];
             const dynamicCoords: any = {};
             
             // Add detected city if available
             if (cData && cData.city) {
                dynamicCities.push({ id: cData.city.toLowerCase(), nameAr: cData.city, nameEn: cData.city });
                dynamicCoords[cData.city.toLowerCase()] = { 
                   lat: cData.latitude || 24, 
                   lng: cData.longitude || 45, 
                   ar: cData.city 
                };
             } else {
                dynamicCities.push({ id: 'all_regions', nameAr: 'كل المناطق', nameEn: 'All Regions' });
                dynamicCoords['all_regions'] = { lat: 24, lng: 45, ar: 'كل المناطق' };
             }

             // Attempt to fetch cities for this country from countriesnow.space
             try {
                const citiesRes = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ country: enName })
                });
                const citiesData = await citiesRes.json();
                if (citiesData && !citiesData.error && Array.isArray(citiesData.data)) {
                   const fetchedCities = citiesData.data.slice(0, 30); // Take up to 30 cities
                   fetchedCities.forEach((city: string) => {
                      const cId = city.toLowerCase().replace(/\s+/g, '_');
                      if (!dynamicCities.find(c => c.id === cId)) {
                         dynamicCities.push({ id: cId, nameAr: city, nameEn: city });
                         dynamicCoords[cId] = { lat: cData?.latitude || 24, lng: cData?.longitude || 45, ar: city };
                      }
                   });
                }
             } catch(e) {
                console.log("Failed to fetch cities dynamically", e);
             }
             
             const newMarket: Market = {
               id: countryCode,
               countryCode: countryCode,
               labelAr: arName,
               labelEn: enName,
               center: { lat: cData?.latitude || 24, lng: cData?.longitude || 45 },
               currency: cData?.currency || 'USD',
               cities: dynamicCities,
               cityCoordinates: dynamicCoords
             };
             
             MARKETS[countryCode] = newMarket; // Register it globally
             setCurrentMarket(newMarket);
             console.log("Dynamic market created for", countryCode);
          }
        }
      } catch (e) {
        console.log("Market detection failed, defaulting to Yemen", e);
      }
    };
    detectMarket();
  }, []);

  // Global States
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const isDark = theme === 'dark';
  
  const isJobsCategorySelected = (cat: string) => {
    if (!cat) return false;
    const lower = cat.toLowerCase();
    if (lower === 'jobs' || lower === '27a06a9e-3d5e-7f67-eb60-4a39536208c9' || lower.includes('وظائف') || lower.includes('فرص')) return true;
    const match = categories.find((c: any) => c.id === cat || c.nameAr === cat) || CATEGORIES.find(c => c.id === cat || c.nameAr === cat);
    if (!match) return false;
    const matchId = (match.id || '').toLowerCase();
    const matchNameAr = (match.nameAr || '').toLowerCase();
    return matchId === 'jobs' || matchNameAr.includes('وظائف') || matchNameAr.includes('فرص');
  };
  
  const [isInIframe, setIsInIframe] = useState(false);
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      window.location.hostname = 'localhost';
    }
  }, []);

  const [ads, setAds] = useState<Ad[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(() => {
    try {
      localStorage.removeItem('aswaq_cached_categories'); // Purge legacy cache
      const cached = localStorage.getItem('aswaq_cached_categories_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return CATEGORIES;
  });

  const fetchLiveCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const result = await res.json();
        const categoriesList = Array.isArray(result) ? result : (result.data && Array.isArray(result.data) ? result.data : []);
        if (categoriesList && categoriesList.length > 0) {
          // Strict deduplication for Cars & Electronics and removal of "General"
          const seen = new Set<string>();
          const deduplicatedList = categoriesList.filter((cat: any) => {
            const normName = (cat.nameAr || '').trim();
            if (normName === 'عام' || normName === 'General') return false;

            // Merge "سيارات" and "سيارات ومركبات" into single "سيارات ومركبات"
            if (normName === 'سيارات' || normName === 'سيارات ومركبات') {
              if (seen.has('cars_vehicle_group')) return false;
              seen.add('cars_vehicle_group');
              cat.nameAr = 'سيارات ومركبات';
              return true;
            }

            // Merge "إلكترونيات" and "إلكترونيات وأجهزة منزلية" into single "إلكترونيات وأجهزة منزلية"
            if (normName === 'إلكترونيات' || normName === 'إلكترونيات وأجهزة منزلية') {
              if (seen.has('electronics_appliances_group')) return false;
              seen.add('electronics_appliances_group');
              cat.nameAr = 'إلكترونيات وأجهزة منزلية';
              return true;
            }

            const key = cat.id || normName;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const getCuratedOrderIndex = (cat: any) => {
            if (!cat) return 999;
            const directIndex = CATEGORIES.findIndex(c => c.id === cat.id || c.nameAr === cat.nameAr);
            if (directIndex !== -1) return directIndex;

            const nameAr = cat.nameAr || '';
            const nameEn = cat.nameEn || '';
            const icon = (cat.icon || '').toLowerCase();
            const id = (cat.id || '').toLowerCase();

            if (id === 'jobs' || nameAr.includes('وظائف') || nameAr.includes('فرص') || nameEn.toLowerCase().includes('job') || icon === 'briefcase') return 0;
            if (id === 'car_rental' || nameAr.includes('تأجير سيارات') || nameEn.toLowerCase().includes('car rental') || icon === 'carfront') return 6;
            if (id === 'cars' || (nameAr.includes('سيارات') && !nameAr.includes('تأجير')) || nameEn.toLowerCase().includes('car') || icon === 'car') return 1;
            if (id === 'realestate' || nameAr.includes('عقارات') || nameAr.includes('أراضي') || nameEn.toLowerCase().includes('real') || icon === 'home') return 2;
            if (id === 'rentals' || nameAr.includes('سكن') || nameAr.includes('إيجار') || nameEn.toLowerCase().includes('rent') || icon === 'building') return 3;
            if (id === 'hotels' || nameAr.includes('فنادق') || nameEn.toLowerCase().includes('hotel') || icon === 'hotel') return 4;
            if (id === 'resorts' || nameAr.includes('منتجعات') || nameEn.toLowerCase().includes('resort') || icon === 'palmtree') return 5;
            if (id === 'electronics' || nameAr.includes('إلكترونيات') || nameEn.toLowerCase().includes('electronic') || icon === 'tv') return 7;
            return 99;
          };

          const sortedData = [...deduplicatedList].sort((a: any, b: any) => {
            const indexA = getCuratedOrderIndex(a);
            const indexB = getCuratedOrderIndex(b);
            if (indexA !== indexB) return indexA - indexB;
            return (a.nameAr || '').localeCompare(b.nameAr || '');
          });

          setCategories(sortedData);
          try {
            localStorage.setItem('aswaq_cached_categories', JSON.stringify(sortedData));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error fetching dynamic categories:', e);
    }
  };

  useEffect(() => {
    fetchLiveCategories();
    // Expose on window for AdminPanel to trigger refresh
    (window as any).refreshAppCategories = fetchLiveCategories;
    return () => {
      delete (window as any).refreshAppCategories;
    };
  }, []);

  const [platformSettings, setPlatformSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('aswaq_platform_settings');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return {
      commission: 0,
      featuredPrice: 5,
      appName: 'أسواق',
      logoLetter: 'أ',
      maintenanceMode: false,
      pushNotifications: true,
      logoUrl: ''
    };
  });
  const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('aswaq_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('aswaq_current_user');
    }
  }, [currentUser]);

  // Auto-detect and switch market based on user phone prefix
  useEffect(() => {
    if (currentUser?.phone) {
      const phonePrefixToMarket: Record<string, string> = {
        '962': 'JO',
        '967': 'YE',
        '966': 'SA',
        '970': 'PS',
        '20': 'EG',
        '971': 'AE',
        '974': 'QA',
        '965': 'KW',
        '968': 'OM',
        '973': 'BH',
        '964': 'IQ',
        '963': 'SY',
        '961': 'LB',
        '212': 'MA',
        '213': 'DZ',
        '216': 'TN',
        '218': 'LY',
        '249': 'SD',
        '252': 'SO',
        '222': 'MR',
        '253': 'DJ',
        '269': 'KM',
      };
      
      const cleanPhone = currentUser.phone.replace(/^\+/, '');
      let detectedMarketId: string | null = null;
      for (const prefix of Object.keys(phonePrefixToMarket)) {
        if (cleanPhone.startsWith(prefix)) {
          detectedMarketId = phonePrefixToMarket[prefix];
          break;
        }
      }
      
      if (detectedMarketId && MARKETS[detectedMarketId] && currentMarket.id !== detectedMarketId) {
        setCurrentMarket(MARKETS[detectedMarketId]);
      }
    }
  }, [currentUser?.phone, currentMarket.id, setCurrentMarket]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [showFollowedSellersOnly, setShowFollowedSellersOnly] = useState(false);
  const [followedSellers, setFollowedSellers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "favs" | "followed">(
    "all",
  );
  const [distanceRef, setDistanceRef] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("followed_sellers");
      if (saved) setFollowedSellers(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load followed sellers", e);
    }
  }, []);

  useEffect(() => {
    if (followedSellers.length > 0) {
      localStorage.setItem("followed_sellers", JSON.stringify(followedSellers));
      if (socket && typeof window !== 'undefined') {
        socket.emit('register-followed-sellers', { sellerIds: followedSellers });
      }
    }
  }, [followedSellers]);

  const toggleFollowSeller = (userId: string) => {
    if (followedSellers.includes(userId)) {
      setFollowedSellers((prev) => prev.filter((id) => id !== userId));
    } else {
      setFollowedSellers((prev) => [...prev, userId]);
    }
  };

  const getCountryFromCity = (cityId: string) => {
    return Object.values(MARKETS).find(market => market.cities.some(city => city.id === cityId))?.countryCode;
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast(
        isRtl ? "تم استعادة الاتصال بالإنترنت 📶" : "Internet Connection Restored 📶",
        isRtl ? "أنت متصل بالإنترنت الآن ويمكنك متابعة تصفح المنصة." : "You are online now. You can continue using the platform.",
        "success"
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast(
        isRtl ? "انقطع الاتصال بالإنترنت ⚠️" : "Internet Connection Interrupted ⚠️",
        isRtl ? "يرجى التحقق من الشبكة. قد لا تعمل بعض الميزات لحظياً." : "Please check your network. Some features may not work temporarily.",
        "error"
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isRtl]);

  // Community Trading Polls state trackers
  const [marketPolls, setMarketPolls] = useState<any[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});
  const [activePollIndex, setActivePollIndex] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/polls?countryCode=${currentMarket.countryCode}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setMarketPolls(data);
        }
      })
      .catch(err => console.error("Failed to fetch polls:", err));

    try {
      const savedVotes = localStorage.getItem('aswaq_voted_polls');
      if (savedVotes) {
        setVotedPolls(JSON.parse(savedVotes));
      }
    } catch (e) {
      console.error('Failed to parse voted polls from localStorage', e);
    }
  }, [currentMarket.countryCode]);

  const handlePollVote = async (pollId: string, optionIndex: number) => {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex })
      });
      const result = await res.json();
      if (result.success) {
        setMarketPolls(prev => prev.map(p => p.id === pollId ? { ...p, votes: result.votes } : p));
        const newVotes = { ...votedPolls, [pollId]: optionIndex };
        setVotedPolls(newVotes);
        localStorage.setItem('aswaq_voted_polls', JSON.stringify(newVotes));
        addToast(isRtl ? "تم تسجيل صوتك بنجاح! 🗳️" : "Vote recorded successfully! 🗳️", "", "success");
      }
    } catch (err) {
      console.error("Voting failed:", err);
    }
  };

  // Geolocation & Proximity States
  const [referenceCoords, setReferenceCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [referenceLabel, setReferenceLabel] = useState<string>("");
  const [sortByDistance, setSortByDistance] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Active overlays
  const handleSelectAd = (ad: Ad | null) => {
    if (ad && (ad.isLive || (ad as any).isPromo)) {
      setSelectedSpotlightId(ad.id);
      setShowDiscovery(true);
    } else {
      setSelectedAd(ad);
      if (ad) {
        const city = currentMarket.cities.find(c => c.id === ad.city || c.nameAr === ad.city || c.nameEn === ad.city);
        const countryCode = currentMarket.countryCode.toLowerCase();
        
        const catId = ad.category;
        const categoryObject = CATEGORIES.find(c => c.id === catId);
        const categorySlug = categoryObject?.nameEn?.toLowerCase() || 'ads';
        
        const titleSlug = slugify(ad.title);
        navigate(`/${countryCode}/${categorySlug}/${titleSlug}-${ad.id}`);
      }
    }
  };
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const mapRef = React.useRef<AdMapHandle>(null);
  useEffect(() => {
    if (viewMode === "map") {
      const mapElement = document.getElementById("ad-interactive-map");
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [viewMode]);
  
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [selectedSpotlightId, setSelectedSpotlightId] = useState<string | undefined>(undefined);
  const [showWelcomeFlow, setShowWelcomeFlow] = useState(false);
  const [welcomeFlowInitialStep, setWelcomeFlowInitialStep] = useState<'splash' | 'features' | 'auth'>('splash');
  const triggerLoginFlow = (initialStep: 'splash' | 'features' | 'auth' = 'splash') => {
    setWelcomeFlowInitialStep(initialStep);
    setShowWelcomeFlow(true);
  };

  // 2. Synchronize state to URL pathname & Document Title
  useEffect(() => {
    if (selectedUserPreview) {
      const isOwn = currentUser && (
        currentUser.id === selectedUserPreview.id || 
        (currentUser.email && selectedUserPreview.email && currentUser.email.toLowerCase() === selectedUserPreview.email.toLowerCase())
      );
      const targetPath = isOwn ? '/profile' : `/profile/${selectedUserPreview.id}`;
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: false });
      }
      document.title = isOwn ? 'ملفي الشخصي | أسواق' : `الملف الشخصي - ${selectedUserPreview.name} | أسواق`;
      return;
    }

    if (currentTab === 'profile' || currentTab === 'account') {
      if (location.pathname !== '/profile') {
        navigate('/profile');
      }
      document.title = 'إعدادات الحساب والبروفايل | أسواق';
      return;
    }

    if (currentTab === 'messages') {
      if (location.pathname !== '/messages') {
        navigate('/messages');
      }
      document.title = 'الرسائل والمحادثات | أسواق';
      return;
    }

    if (currentTab === 'notifications') {
      if (location.pathname !== '/notifications') {
        navigate('/notifications');
      }
      document.title = 'الإشعارات والتنبيهات | أسواق';
      return;
    }

    if (currentTab === 'my-ads') {
      if (location.pathname !== '/my-ads') {
        navigate('/my-ads');
      }
      document.title = 'إعلاناتي | أسواق';
      return;
    }

    if (currentTab === 'analytics') {
      if (location.pathname !== '/analytics') {
        navigate('/analytics');
      }
      document.title = 'تحليلات الأداء | أسواق';
      return;
    }

    if (platformMode === 'spotlight' && location.pathname !== '/reels') {
      navigate('/reels');
      document.title = 'شورتس وسواري أسواق | فيديوهات الإعلانات';
      return;
    }

    if (platformMode === 'jobs' && location.pathname !== '/jobs') {
      navigate('/jobs');
      document.title = 'بوابة الوظائف والفرص | أسواق';
      return;
    }

    if (platformMode === 'delivery' && location.pathname !== '/delivery') {
      navigate('/delivery');
      document.title = 'خدمات الشحن والتوصيل | أسواق';
      return;
    }

    if (platformMode === 'create' && location.pathname !== '/create-ad') {
      navigate('/create-ad');
      document.title = 'إضافة إعلان جديد | أسواق';
      return;
    }

    // Avoid updating URL if we are currently looking at an ad detail page
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (location.pathname.match(uuidRegex) || selectedAd) return;

    if (platformMode === 'marketplace') {
      const countryCode = currentMarket.countryCode.toLowerCase();
      const categoryObject = CATEGORIES.find(c => c.id === selectedCategory);
      const cat = categoryObject?.nameEn?.toLowerCase() || '';
      
      if (selectedCity) {
        const market = MARKETS[currentMarket.countryCode];
        const city = market?.cities.find(c => c.id === selectedCity);
        if (city && cat) {
          const citySlug = slugify(city.nameEn);
          navigate(`/${countryCode}/${citySlug}/${cat}`);
          return;
        }
      }
      
      if (cat) {
        navigate(`/${countryCode}/${cat}`);
      } else if (location.pathname !== '/') {
        navigate('/');
      }
      document.title = 'أسواق | منصة الإعلانات المجانية في الوطن العربي — بيع، شراء، تأجير';
    }
  }, [selectedUserPreview, currentTab, platformMode, currentMarket.countryCode, selectedCategory, selectedCity]);

  // 3. Synchronize selectedAd state reset to parent URL pathname
  useEffect(() => {
    if (!selectedAd && !selectedUserPreview && ['/reels', '/jobs', '/delivery', '/create-ad', '/profile'].includes(location.pathname)) {
      return;
    }
    if (!selectedAd) {
      const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (location.pathname.match(uuidRegex)) {
        const countryCode = currentMarket.countryCode.toLowerCase();
        const categoryObject = CATEGORIES.find(c => c.id === selectedCategory);
        const cat = categoryObject?.nameEn?.toLowerCase() || '';
        navigate(cat ? `/${countryCode}/${cat}` : '/');
      }
    }
  }, [selectedAd]);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [targetUpgradeRole, setTargetUpgradeRole] = useState<'merchant' | 'driver' | 'subscriber'>('merchant');
  const [pendingAd, setPendingAd] = useState<Ad | null>(null);
  const [showAdOtp, setShowAdOtp] = useState(false);
  // On-Demand Delivery & Shipping States
  const [deliveryOrders, setDeliveryOrders] = useState<{
    id: string,
    title: string,
    category: string,
    from: string,
    to: string,
    weight: number,
    priceEstimate: number,
    pickupCoords?: { lat: number, lng: number },
    deliveryCoords?: { lat: number, lng: number },
    clientName: string,
    status: string,
    driverName: string | null
  }[]>([]);

  const [deliveryDrivers, setDeliveryDrivers] = useState<{
    id: string,
    name: string,
    vehicle: string,
    status: string,
    rating: number,
    currentCity: string
  }[]>([]);

  const [activeDriverTask, setActiveDriverTask] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('aswaq_active_task');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse active driver task from localStorage', e);
      return null;
    }
  });
  // Shipping origin and destination state
  const [shipFrom, setShipFrom] = useState<string>('');
  const [shipTo, setShipTo] = useState<string>('');
  const [driverBalance, setDriverBalance] = useState<number>(() => {
    const saved = localStorage.getItem('aswaq_driver_balance');
    return saved ? parseInt(saved) : 0;
  });
  const [pocketAlertsEnabled, setPocketAlertsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('aswaq_pocket_alerts');
    return saved === null ? true : saved === 'true';
  });
  const [showDriverRecruitCard, setShowDriverRecruitCard] = useState<boolean>(true);

  // Persistence Effects
  useEffect(() => {
    if (activeDriverTask) {
      localStorage.setItem('aswaq_active_task', JSON.stringify(activeDriverTask));
    } else {
      localStorage.removeItem('aswaq_active_task');
    }
  }, [activeDriverTask]);

  useEffect(() => {
    localStorage.setItem('aswaq_driver_balance', driverBalance.toString());
  }, [driverBalance]);

  useEffect(() => {
    localStorage.setItem('aswaq_pocket_alerts', pocketAlertsEnabled.toString());
  }, [pocketAlertsEnabled]);

  useEffect(() => {
    // Set defaults for shipment forms
    const firstCity = currentMarket.cities?.[0];
    const secondCity = currentMarket.cities?.[1] || firstCity;
    if (firstCity) setShipFrom(firstCity.id);
    if (secondCity) setShipTo(secondCity.id);
    // Clear all client-side mock data states completely
    setAds([]);
    setFilteredAds([]);
    setSocialPosts([]);
    setProductReels([]);
    setDeliveryDrivers([]);
    setDeliveryOrders([]);

    // Fetch real production data from database matching the new market
    fetchAds();
    fetchPromoVideos();
    fetchNotifications();
    fetchMessages();
    fetchPlatformSettings();
  }, [currentMarket.countryCode]);

  // Social Community Network States
  const [socialPosts, setSocialPosts] = useState<any[]>([]);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<Record<string, { commentId: string; commentAuthor: string }>>({});

  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const handleDeleteSocialPost = (postId: string) => {
    setSocialPosts(prev => prev.filter(p => p.id !== postId));
    addToast(
      isRtl ? "تم حذف المنشور" : "Post Deleted",
      isRtl ? "لقد تمت إزالة المنشور بنجاح." : "The post has been successfully removed.",
      "success"
    );
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowWelcomeFlow(false);
    addToast(
      isRtl ? `مرحباً بك، ${user.name} 👋` : `Welcome, ${user.name} 👋`,
      isRtl ? "تم تسجيل دخولك بنجاح إلى منصة أسواق." : "You have successfully logged in to Aswaq.",
      "success"
    );
  };

  const handleIdentityVerifyFinish = (docs: string[]) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        role: targetUpgradeRole === 'merchant' ? UserRole.MERCHANT : (targetUpgradeRole === 'driver' ? UserRole.USER : currentUser.role),
        identityVerified: true,
        identityDocuments: docs,
        verified: true
      };
      setCurrentUser(updatedUser);
      setShowIdentityModal(false);
      addToast(
        isRtl ? "تم استلام الطلب" : "Request Received",
        isRtl ? "جاري مراجعة وثائقك من قبل فريقنا المختص." : "Your documents are being reviewed by our dedicated team.",
        "info"
      );
    }
  };

  const handleLikeSocialComment = (postId: string, commentId: string) => {
    setSocialPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map((comm) => {
              if (comm.id === commentId) {
                const likedBy = comm.likedBy || [];
                const currentUserId = currentUser?.id || "anon";
                const alreadyLiked = likedBy.includes(currentUserId);
                return {
                  ...comm,
                  likes: alreadyLiked ? (comm.likes || 1) - 1 : (comm.likes || 0) + 1,
                  likedBy: alreadyLiked ? likedBy.filter((id) => id !== currentUserId) : [...likedBy, currentUserId],
                };
              }
              return comm;
            }),
          };
        }
        return post;
      })
    );
  };

  const handleLikeSocialReply = (postId: string, commentId: string, replyId: string) => {
    setSocialPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map((comm) => {
              if (comm.id === commentId) {
                const updatedReplies = (comm.replies || []).map((rep: any) => {
                  if (rep.id === replyId) {
                    const likedBy = rep.likedBy || [];
                    const currentUserId = currentUser?.id || "anon";
                    const alreadyLiked = likedBy.includes(currentUserId);
                    return {
                      ...rep,
                      likes: alreadyLiked ? (rep.likes || 1) - 1 : (rep.likes || 0) + 1,
                      likedBy: alreadyLiked ? likedBy.filter((id: string) => id !== currentUserId) : [...likedBy, currentUserId],
                    };
                  }
                  return rep;
                });
                return {
                  ...comm,
                  replies: updatedReplies,
                };
              }
              return comm;
            }),
          };
        }
        return post;
      })
    );
  };

  const handleAddSocialComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const target = replyTarget[postId];

    setSocialPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          if (target) {
            // Replying to a specific comment
            return {
              ...post,
              comments: post.comments.map((comm) => {
                if (comm.id === target.commentId) {
                  const currentReplies = comm.replies || [];
                  const newReply = {
                    id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    author: currentUser?.name || (isRtl ? "مستخدم نشط" : "Active User"),
                    comment: text,
                    createdAt: new Date().toISOString(),
                    likes: 0,
                    likedBy: [] as string[],
                  };
                  return {
                    ...comm,
                    replies: [...currentReplies, newReply],
                  };
                }
                return comm;
              }),
            };
          } else {
            // Regular comment
            const newComment = {
              id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              author: currentUser?.name || (isRtl ? "مستخدم نشط" : "Active User"),
              comment: text,
              likes: 0,
              likedBy: [] as string[],
              replies: [] as any[],
              createdAt: new Date().toISOString(),
            };
            return {
              ...post,
              comments: [...post.comments, newComment],
            };
          }
        }
        return post;
      })
    );

    // Clear input field and reply target
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: "",
    }));
    setReplyTarget((prev) => {
      const copy = { ...prev };
      delete copy[postId];
      return copy;
    });

    addToast(
      isRtl ? "تم إضافة مشاركتك بنجاح! 💬" : "Interaction posted! 💬",
      isRtl ? "تمت إضافة تفاعلك وتحديث نبض المشاركة بنجاح." : "Your interaction was added to the post.",
      "success"
    );
  };

  // Reels and Video Mode
  const [productReels, setProductReels] = useState<any[]>([]);

  // Jordanian Market Data
  const JO_ADS = [
    {
      id: 'ad_jo_1',
      title: 'تويوتا كامري هايبرد 2023 فحص 4 جيد كرت ملاءة 🚗🔋',
      description: 'تويوتا كامري موديل 2023 هايبرد ممتازة جداً واقتصادية للغاية. لون فضي ميتاليك، فحص كامل 7 جيد بدون ملاحظات (كرت أبيض)، فتحة سقف، كراسي جلد كهرباء، رادار تحديد مسار، مانع تصادم، شاشة ترفيه داعمة لـ Apple CarPlay و Android Auto. السيارة ممشاها قليل وجاهزة للتنازل الفوري في عمان حرة الزرقاء.',
      price: 24500,
      currency: 'JOD',
      city: 'amman',
      category: 'cars',
      images: [
        'https://images.unsplash.com/photo-1617469767053-d3b508a0d822?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0795554321',
      status: 'active',
      views: 340,
      likes: 28,
      isFeatured: true,
      latitude: 31.9522,
      longitude: 35.9106,
      videoUrl: 'https://player.vimeo.com/external/394301551.sd.mp4?s=ff7fedf4bb9bc3dc9391b1a43a758bdee1aa6ef8&profile_id=165&oauth2_token_id=57447761',
      createdAt: '2026-06-01T08:30:00Z',
      userId: 'jo_user_1'
    },
    {
      id: 'ad_jo_2',
      title: 'شقة فاخرة مفروشة للبيع في عبدلي بوليفارد 🏢🌟',
      description: 'لهواة الرقي والاستثمار، شقة سوبر ديلوكس مفروشة بالكامل مساحة 145 متر مربع تقع في الطابق السادس بموقع استراتيجي مطل على بوليفارد العبدلي عمان. تتكون من غرفتين نوم (واحدة ماستر)، صالون معيشة واسع، مطبخ أمريكي مجهز بكافة الأجهزة الكهربائية، بلكونة زجاجية جميلة، مكيفات مركزي بالكامل، حراسة وموقف سيارة تحت الأرض ومصعد بأرقام سرية للملاك.',
      price: 135000,
      currency: 'JOD',
      city: 'amman',
      category: 'realestate',
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0781112223',
      status: 'active',
      views: 215,
      likes: 19,
      isFeatured: true,
      latitude: 31.9612,
      longitude: 35.9015,
      videoUrl: 'https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761',
      createdAt: '2026-06-01T10:00:00Z',
      userId: 'jo_user_2'
    },
    {
      id: 'ad_jo_3',
      title: 'جهاز بلايستيشن 5 مع يدتين أصليتين وألعاب مميزة 🎮🔥',
      description: 'جهاز PS5 Slim نسخة الأقراص بحالة الوكالة غير مستخدم ومفتوح لتجربة التشغيل فقط. يأتي معه يدتان تحكم أصليتين DualSense ومجموعة من 4 ألعاب قوية جداً (FC 25, God of War Ragnarok, GTA V, Spider-Man 2). كفالة سارية لمدة سنة كاملة من الوكيل الرسمي في الأردن، التوصيل متاح لكافة مناطق إربد وعمان.',
      price: 360,
      currency: 'JOD',
      city: 'irbid',
      category: 'laptops',
      images: [
        'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0770001112',
      status: 'active',
      views: 110,
      likes: 15,
      isFeatured: false,
      latitude: 32.5514,
      longitude: 35.8514,
      createdAt: '2026-06-01T11:45:00Z',
      userId: 'jo_user_3'
    },
    {
      id: 'ad_jo_4',
      title: 'هاتف ايفون 15 برو ماكس 256 جيجا تيتانيوم طبيعي 📱💎',
      description: 'ايفون 15 برو ماكس، سعة 256 جيجا بايت، لون تيتانيوم طبيعي (Natural Titanium)، نسبة البطارية 98% فما فوق، الجهاز بحالة لا تفرق عن الجديد إطلاقاً بدون أي خدش أو علامات استخدام. يدعم تشغيل شريحتين (eSIM + Physical)، غير مفتوح ولم يتم عمل أي صيانة له. البيع يشمل الصندوق الأصلي وكبل الشحن وكفر هداية مميز.',
      price: 690,
      currency: 'JOD',
      city: 'amman',
      category: 'phones',
      images: [
        'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0770001112',
      status: 'active',
      views: 180,
      likes: 22,
      isFeatured: true,
      latitude: 31.9443,
      longitude: 35.8821,
      createdAt: '2026-05-31T15:20:00Z',
      userId: 'jo_user_3'
    },
    {
      id: 'ad_jo_5',
      title: 'مطلوب مبرمج ويب ومطور React ذو خبرة لدى شركة برمجية 💻🚀',
      description: 'تعلن إحدى أكبر كبرى شركات التكنولوجيا البرمجية في عمان العبدلي عن حاجتها لمطور ويب محترف ذي خبرة واسعة في استخدام React, Next.js, و TypeScript وتصميم الواجهات الأنيقة. بيئة عمل رائعة، رواتب وحوافز مجزية حسب الخبرات، دوام مرن بشكل هجين (حضوري وعن بعد). يرجى التقديم وإرفاق السيرة الذاتية عبر زر الاتصال أو الواتساب المباشر.',
      price: 900,
      currency: 'JOD',
      city: 'amman',
      category: 'jobs',
      jobType: 'hiring',
      images: [
        'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0781112223',
      status: 'active',
      views: 75,
      likes: 4,
      isFeatured: false,
      createdAt: '2026-06-01T12:00:00Z',
      userId: 'jo_user_2'
    },
    {
      id: 'ad_jo_6',
      title: 'طلب توظيف: مهندس كهرباء وأنظمة طاقة شمسية في الشمال ⚡🔋',
      description: 'أنا مهندس كهرباء أردني مقيم في إربد، لدي خبرة 5 سنوات في مجالات تصميم وتركيب وصيانة أنظمة الطاقة الشمسية الكهروضوئية المتكاملة للمباني السكنية والمصانع والآبار. حاصل على رخص ممارسة المهنة وأجيد استخدام برامج التصميم الهندسية ومستعد للعمل والبدء الفوري لدى أي شركة في عمان أو الشمال.',
      price: 0,
      currency: 'JOD',
      city: 'irbid',
      category: 'jobs',
      jobType: 'seeking',
      images: [
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80'
      ],
      contactNumber: '0770001112',
      status: 'active',
      views: 31,
      likes: 1,
      isFeatured: false,
      createdAt: '2026-06-01T13:00:00Z',
      userId: 'jo_user_3'
    },
    ...Array.from({ length: 45 }).map((_, i) => ({
      id: `mock_ad_jo_${i + 10}`,
      title: `إعلان تجريبي مبوب رقم ${i+1} للتصفح - الأردن`,
      description: `هذا الإعلان تم إنشاؤه تلقائياً لملئ النظام بالبيانات لتسهيل عملية التقييم والملاحظة. يتضمن كافة التفاصيل المطلوبة. الإعلان رقم ${i+1} يحتوي على معلومات تجريبية للواجهة.`,
      price: 150 + (i * 25),
      currency: 'JOD',
      city: i % 3 === 0 ? 'irbid' : (i % 3 === 1 ? 'zarqa' : 'amman'),
      category: ['cars', 'realestate', 'electronics', 'services', 'jobs', 'laptops', 'phones', 'clothes'][i % 8],
      images: [`https://picsum.photos/seed/${i + 200}/800/600`],
      contactNumber: '0790000000',
      status: 'active',
      views: 15 + i * 4,
      likes: i,
      isFeatured: i % 6 === 0,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      userId: i % 2 === 0 ? 'jo_user_1' : 'jo_user_2',
      latitude: 31.95 + (Math.random() * 0.1 - 0.05),
      longitude: 35.91 + (Math.random() * 0.1 - 0.05),
    }))
  ];

  const JO_POSTS = [
    {
      id: "jo_post_1",
      authorId: "jo_user_1",
      authorName: "عمر المجالي",
      authorHandle: "omar_cars",
      authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80",
      content: "عشاق التميز في عمان، وصلت حديثاً تشكيلة واسعة من السيارات الهجينة والكهربائية (تويوتا، بي واي دي، تسلا) بخصومات حصرية لعملاء تطبيق أسواق الأردن! تفضلوا بزيارة فرعنا الجديد في العبدلي أو تواصلوا لمعاينة الفحص كرت 🚗🔋🔌",
      image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
      createdAt: "2026-06-01T09:00:00.000Z",
      likes: 42,
      likedBy: [] as string[],
      comments: [
        { id: "jc1", author: "أنس القضاه", comment: "كم سعر الهيلوكس أو الكامري كاش بالله عليك؟" }
      ]
    },
    {
      id: "jo_post_2",
      authorId: "jo_user_2",
      authorName: "رانيا سويدان",
      authorHandle: "rania_decor",
      authorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
      content: "لكل الباحثين عن تشطيبات سوبر ديلوكس وديكورات تضفي الفخامة على بيوتهم في دابوق والجبيهة والعبدلي، يسعدنا تقديم استشارة مجانية وخصم 15% على التصاميم الداخلية هذا الشهر. يسعدني سماع آرائكم بالعمل الأخير المرفق! 🏡🎨🌟",
      image: "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=800&q=80",
      createdAt: "2026-06-01T15:10:00.000Z",
      likes: 19,
      likedBy: [] as string[],
      comments: []
    }
  ];

  const JO_REELS = [
    {
      id: "jo_reel_1",
      sellerName: "التميز العقاري",
      sellerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
      title: "عرض حصري: شقة مودرن مفروشة في الطابق السادس بالعبدلي بوليفارد 🏢",
      videoUrl: "https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761",
      price: 135000,
      likes: 85,
      likedBy: [] as string[],
      comments: 18,
      commentList: [
        { id: "jcr1", author: "أدهم النابلسي", text: "ما شاء الله، إطلالة خرافية وتشطيب فاخر جداً!", time: "منذ ساعة" }
      ],
      shares: 9,
      views: 740,
    },
    {
      id: "jo_reel_2",
      sellerName: "عمر المجالي للمركبات",
      sellerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80",
      title: "استعراض قيادة ومواصفات تويوتا كامري 2023 هايبرد فحص هندسي كرت 🚗🔋",
      videoUrl: "https://player.vimeo.com/external/394301551.sd.mp4?s=ff7fedf4bb9bc3dc9391b1a43a758bdee1aa6ef8&profile_id=165&oauth2_token_id=57447761",
      price: 24500,
      likes: 120,
      likedBy: [] as string[],
      comments: 34,
      commentList: [],
      shares: 14,
      views: 1250,
    },
    ...Array.from({ length: 15 }).map((_, i) => ({
      id: `mock_reel_jo_${i + 10}`,
      sellerName: `بائع تجريبي الأردن ${i + 1}`,
      sellerAvatar: `https://picsum.photos/seed/${i + 300}/150/150`,
      title: `إعلان فيديو ريلز للسيارات والعقارات الاستعراضية رقم ${i+1} 🔥 شاهد المواصفات`,
      videoUrl: i % 2 === 0 ? "https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761" : "https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761",
      price: 1000 + (i * 1234),
      likes: 45 + (i * 7),
      likedBy: [] as string[],
      comments: 10 + i,
      commentList: [{ id: `rc_${i}`, author: 'مستخدم تجريبي', text: 'ممتاز جداً، هل يوجد تقسيط؟', time: 'منذ ساعتين' }],
      shares: 2 + i,
      views: 300 + (i * 123),
    }))
  ];

  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [showReelComments, setShowReelComments] = useState(false);

  // View count increment effect for active reel
  useEffect(() => {
    if (platformMode === 'reels') {
      const timer = setTimeout(() => {
        setProductReels((prev) =>
          prev.map((reel, idx) =>
            idx === currentReelIndex ? { ...reel, views: reel.views + 1 } : reel
          )
        );
      }, 1500); // 1.5s watching counts as a view!
      return () => clearTimeout(timer);
    }
  }, [currentReelIndex, platformMode]);
  
  // Welcome flow status
  const [loginEmail, setLoginEmail] = useState("");

  // Notifications and messages counts
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState<ChatMessage[]>([]);

  const [isMainCategoryDropdownOpen, setIsMainCategoryDropdownOpen] = useState(false);
  const [selectedJobType, setSelectedJobType] = useState<
    "all" | "seeking" | "hiring"
  >("all");

  // Advanced Real Estate Filters
  const [selectedRooms, setSelectedRooms] = useState<number | "">("");
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  // Advanced Vehicle Filters
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [selectedTransmission, setSelectedTransmission] = useState<string>("");
  const [selectedFuelType, setSelectedFuelType] = useState<string>("");

  // Advanced Electronics Filters
  const [selectedCondition, setSelectedCondition] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  // General Sidebar Filters
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [universalCondition, setUniversalCondition] = useState<string>(""); // 'new' | 'used'
  const [timeRange, setTimeRange] = useState<string>(""); // '24h' | '7d' | '30d'
  const [showSold, setShowSold] = useState(false);
  const [showSidebarFilters, setShowSidebarFilters] = useState(false);

  // Experience roles toggler state (super convenient for AI Studio reviewers to swap roles on the fly!)
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(currentUser?.role === 'admin');

  // Hybrid Mode Active Forms States
  const [shipCategory, setShipCategory] = useState<'parcel' | 'food' | 'heavy' | 'shuttle'>('parcel');
  // shipFrom and shipTo are already declared above (line ~500)
  const [shipWeight, setShipWeight] = useState(5);
  const [shipTitle, setShipTitle] = useState('');
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState<number | string>('');
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [ratingOrder, setRatingOrder] = useState<any | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState<'pickup' | 'delivery' | null>(null);

  // Delivery Diagnostic & QA simulator states
  const [testSimStep, setTestSimStep] = useState<number>(0); // 0: idle, 1: order_scheduled, 2: driver_dispatched, 3: live_transit, 4: delivered
  const [testSimLogs, setTestSimLogs] = useState<string[]>(['[أنظمة التشخيص] النواة جاهزة للبدء بفحص واختبار تكامل التوصيل الجغرافي.']);
  const [testSimProgress, setTestSimProgress] = useState<number>(0);
  const [activeDiagnosticOrderId, setActiveDiagnosticOrderId] = useState<string | null>(null);

  const [newPostText, setNewPostText] = useState('');
  const [selectedSocialImage, setSelectedSocialImage] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'file'>('image');

  // Real-time Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Lock body scroll when overlay/modals are active to prevent background scrolling (touch/desktop drag)
  useEffect(() => {
    const isModalOpen = !!(
      selectedAd ||
      selectedUserPreview ||
      showAiModal ||
      showDiscovery ||
      showAdminModal ||
      showWelcomeFlow ||
      showReelComments
    );

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [
    selectedAd,
    selectedUserPreview,
    showAiModal,
    showDiscovery,
    showAdminModal,
    showWelcomeFlow,
    showReelComments
  ]);

  const addToast = (
    title: string,
    description: string,
    type: "message" | "notification" | "success" | "info" | "error",
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Socket monitoring
  useEffect(() => {
    if (currentUser?.id) {
      joinRoom(currentUser.id);

      const fetchFavorites = async () => {
        try {
          const response = await fetch(`/api/users/${currentUser.id}/favorites`);
          if (response.ok) {
            const data = await response.json();
            setFavorites(data);
          }
        } catch (e) {
          console.error("Failed to fetch favorites", e);
        }
      };
      fetchFavorites();

      const handleNewMessage = (msg: ChatMessage) => {
        // Find the sender name if possible
        const sender = INITIAL_USERS.find((u) => u.id === msg.senderId);
        addToast(
          `رسالة جديدة من: ${sender?.name || "مستخدم"}`,
          msg.text,
          "message",
        );
        fetchMessages();
      };

      const handleNewNotification = (notif: AppNotification) => {
        addToast(notif.title, notif.description, "notification");
        fetchNotifications();
      };

      const handleLiveStreamNotification = async (notif: {
        id: string;
        title: string;
        description: string;
        type: string;
        streamId: string;
        sellerId: string;
      }) => {
        // High priority live stream announcement toast!
        addToast(notif.title, notif.description, "notification");

        // Save notification to the database for this user
        if (currentUser?.id) {
          try {
            await fetch("/api/notifications/save-recipient", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: currentUser.id,
                title: notif.title,
                description: notif.description,
                type: "live_broadcast"
              })
            });
            // Fetch updated notifications
            fetchNotifications();
          } catch (e) {
            console.error("Failed to persist live stream notification:", e);
          }
        }
      };

      socket.on("new-message", handleNewMessage);
      socket.on("new-notification", handleNewNotification);
      socket.on("live-stream-notification", handleLiveStreamNotification);

      return () => {
        socket.off("new-message", handleNewMessage);
        socket.off("new-notification", handleNewNotification);
        socket.off("live-stream-notification", handleLiveStreamNotification);
      };
    }
  }, [currentUser?.id]);

  const fetchPlatformSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings", {
        headers: {
          'x-user-email': currentUser?.email || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPlatformSettings(data);
        localStorage.setItem('aswaq_platform_settings', JSON.stringify(data));
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  // 1. Fetch live listings
  useEffect(() => {
    fetchAds();
    fetchPromoVideos();
    fetchNotifications();
    fetchMessages();
    fetchPlatformSettings();
  }, []);

  // 1.1. Dynamic Favicon update when logoUrl changes
  useEffect(() => {
    if (platformSettings?.logoUrl) {
      // Remove any existing icon links
      document.querySelectorAll("link[rel*='icon']").forEach(el => el.parentNode?.removeChild(el));

      const isBase64 = platformSettings.logoUrl.startsWith('data:');
      // Only add cache-busting for real URLs, not Base64 data URIs
      const href = isBase64
        ? platformSettings.logoUrl
        : `${platformSettings.logoUrl}?v=${Date.now()}`;

      // Add both rel types for maximum browser compatibility
      ['icon', 'shortcut icon'].forEach(rel => {
        const link = document.createElement('link');
        link.type = 'image/png';
        link.rel = rel;
        link.href = href;
        document.head.appendChild(link);
      });
    }
  }, [platformSettings?.logoUrl]);

  const fetchPromoVideos = async () => {
    try {
      const response = await fetch("/api/promo");
      if (response.ok) {
        const data = await response.json();
        setPromoVideos(data);
      }
    } catch (e) {
      console.error("Failed to fetch promos", e);
    }
  };

  const fetchAds = async () => {
    setLoading(true);
    setNextCursor(undefined);
    try {
      const response = await fetch("/api/ads?limit=20");
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        // Support both paginated { ads, nextCursor } and legacy array response
        const adsArray: Ad[] = Array.isArray(data) ? data : (data.ads || []);
        const cursor: string | undefined = data.nextCursor;
        const marketFiltered = adsArray.filter((ad: Ad) =>
          currentMarket.cities.some(c => c.id === ad.city || c.nameAr === ad.city || c.nameEn === ad.city)
        );
        setAds(marketFiltered);
        setFilteredAds(marketFiltered);
        setNextCursor(cursor);
        setHasMore(!!cursor);
      } else {
        console.warn("Ads API failed or returned non-JSON");
      }
    } catch (e: any) {
      if (e.message !== "Failed to fetch") {
        console.error("Error fetching ads", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMoreAds = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/ads?limit=20&cursor=${nextCursor}`);
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        const adsArray: Ad[] = Array.isArray(data) ? data : (data.ads || []);
        const cursor: string | undefined = data.nextCursor;
        const marketFiltered = adsArray.filter((ad: Ad) =>
          currentMarket.cities.some(c => c.id === ad.city || c.nameAr === ad.city || c.nameEn === ad.city)
        );
        setAds(prev => [...prev, ...marketFiltered]);
        setFilteredAds(prev => [...prev, ...marketFiltered]);
        setNextCursor(cursor);
        setHasMore(!!cursor);
      }
    } catch (e: any) {
      console.error("Error loading more ads", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const url = currentUser ? `/api/notifications?userId=${currentUser.id}` : "/api/notifications";
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setNotifications(data);
        setUnreadNotificationsCount(data.filter((n: any) => !n.read).length);
      } else {
        console.warn("Notifications API failed or returned non-JSON");
      }
    } catch (e: any) {
      if (e.message !== "Failed to fetch") {
        console.error("Error loading notifs", e);
      }
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/messages");
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data: ChatMessage[] = await response.json();
        if (currentUser) {
          // Unread counts directed at current user
          const unread = data.filter(
            (m) => m.receiverId === currentUser.id && !m.read,
          );
          setUnreadMessages(unread);
        }
      } else {
        console.warn("Chats API failed or returned non-JSON");
      }
    } catch (e: any) {
      if (e.message !== "Failed to fetch") {
        console.error("Error loading message summaries", e);
      }
    }
  };

  // Repeatedly poll for any auto-responses or listings updates
  useEffect(() => {
    const timer = setInterval(() => {
      fetchMessages();
      fetchNotifications();
    }, 6000);
    return () => clearInterval(timer);
  }, [currentUser]);

  // Handle initialization of Firebase Cloud Messaging / Native Push Notifications
  useEffect(() => {
    setupPushNotifications(currentUser?.id || null, (title, body) => {
      // Direct call to standard user notification banner (Toast alert) in UI
      addToast(title, body, "notification");
      
      // Instantly refresh the user's notifications feed
      fetchNotifications();
    });
  }, [currentUser]);

  // Apply filters and sorting in server
  useEffect(() => {
    const fetchFilteredAds = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (selectedCity) params.append("city", selectedCity);
      if (selectedDistrict) params.append("district", selectedDistrict);
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedSubCategory) params.append("subCategory", selectedSubCategory);
      if (minPrice !== "") params.append("minPrice", String(minPrice));
      if (maxPrice !== "") params.append("maxPrice", String(maxPrice));
      if (selectedJobType !== "all") params.append("jobType", selectedJobType);
      if (selectedRooms !== "") params.append("rooms", String(selectedRooms));
      if (selectedPropertyType) params.append("propertyType", selectedPropertyType);
      if (selectedMake) params.append("make", selectedMake);
      if (selectedYear !== "") params.append("modelYear", String(selectedYear));
      if (selectedTransmission) params.append("transmission", selectedTransmission);
      if (selectedFuelType) params.append("fuelType", selectedFuelType);
      if (selectedCondition) params.append("condition", selectedCondition);
      if (selectedBrand) params.append("brand", selectedBrand);

      try {
        const response = await fetch(`/api/ads/search?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Filter by market cities in client as a temporary fallback before backend fully handles market scoping
          if (Array.isArray(data)) {
            const filtered = data.filter((ad: Ad) => {
              const matchesNameOrId = currentMarket.cities.some(
                  c => c.id === ad.city || c.nameAr === ad.city || c.nameEn === ad.city
              );
              return matchesNameOrId;
            });
            setFilteredAds(filtered);
          } else {
            setFilteredAds([]);
          }
        }
      } catch (e: any) {
        if (e && e.message !== "Failed to fetch") {
          console.error("Error fetching filtered ads", e);
        }
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchFilteredAds, 300);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    selectedCity,
    selectedDistrict,
    selectedCategory,
    selectedSubCategory,
    selectedJobType,
    selectedRooms,
    selectedPropertyType,
    selectedMake,
    selectedYear,
    selectedTransmission,
    selectedFuelType,
    selectedCondition,
    selectedBrand,
    minPrice,
    maxPrice,
    currentMarket,
  ]);


  // Handle GPS Detection
  const handleGpsDetection = () => {
    if (!navigator.geolocation) {
      setGpsError("متصفحك لا يدعم خاصية تحديد الموقع");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setReferenceCoords({ lat: latitude, lng: longitude });
        setReferenceLabel("موقعي الحالي");
        setSortByDistance(true);
        setGpsLoading(false);
        setDistanceRef("gps");
        addToast(
          "تم تحديد موقعك",
          "تم تفعيل ترتيب العروض حسب المسافة من موقعك الحالي بنجاح",
          "success",
        );
      },
      (error) => {
        console.error("GPS Error:", error);
        setGpsError("فشل الوصول لموقعك الجغرافي. تأكد من منح الإذن للمتصفح.");
        setGpsLoading(false);
        addToast(
          "خطأ في الموقع",
          "تعذر الوصول لموقعك الجغرافي حالياً",
          "notification",
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleUpdateProfile = async (updatedData: Partial<User>) => {
    if (!currentUser) return;
    
    const hasBase64 = 
      (updatedData.avatar && updatedData.avatar.startsWith('data:image/')) || 
      (updatedData.coverPhoto && updatedData.coverPhoto.startsWith('data:image/'));

    try {
      let finalData = { ...updatedData };

      if (hasBase64) {
        addToast("جاري الرفع", "جاري تحسين ورفع الصور الشخصية والحائط سحابياً...", "info");
        
        // 1. Process avatar
        if (updatedData.avatar && updatedData.avatar.startsWith('data:image/')) {
          try {
            const file = dataURLtoFile(updatedData.avatar, 'avatar.jpg');
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await apiFetch('/api/storage/upload', {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const resData = await res.json();
              finalData.avatar = resData.url;
            }
          } catch (err) {
            console.error('Failed to auto-upload avatar:', err);
          }
        }

        // 2. Process coverPhoto
        if (updatedData.coverPhoto && updatedData.coverPhoto.startsWith('data:image/')) {
          try {
            const file = dataURLtoFile(updatedData.coverPhoto, 'cover.jpg');
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await apiFetch('/api/storage/upload', {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const resData = await res.json();
              finalData.coverPhoto = resData.url;
            }
          } catch (err) {
            console.error('Failed to auto-upload cover:', err);
          }
        }
      }

      const response = await apiFetch(`/api/v1/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        const formattedUser = {
          ...updatedUser,
          role: updatedUser.role ? updatedUser.role.toLowerCase() : currentUser.role
        };
        setCurrentUser(formattedUser);
        localStorage.setItem('aswaq_current_user', JSON.stringify(formattedUser));
        if (selectedUserPreview && selectedUserPreview.id === formattedUser.id) {
          setSelectedUserPreview(formattedUser);
        }
        addToast("تم التحديث", "تم تحديث بيانات ملفك الشخصي بنجاح", "success");
      } else {
        const responseText = await response.text();
        console.error("Profile update failed server response:", responseText);
        let errorMsg = "فشل تحديث الملف الشخصي في خادم أسواق";
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.message) errorMsg = parsed.message;
        } catch {}
        addToast("خطأ في التحديث", errorMsg, "error");
      }
    } catch (e) {
      console.error("Profile update failed", e);
      addToast("خطأ", "فشل تحديث الملف الشخصي", "notification");
    }
  };

  const handleReportAd = async (adId: string, reason: string) => {
    try {
      const response = await fetch(`/api/ads/${adId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser?.id, reason }),
      });
      if (response.ok) {
        addToast("تم البلاغ", "نشكرك على إبلاغنا، سيقوم فريق المراجعة بالتحقق", "success");
      }
    } catch (e) {
      console.error("Report failed", e);
    }
  };

  // Sync reference coords when city ref changes
  useEffect(() => {
    if (distanceRef === "gps") return; // Don't override if gps is active

    const coords = currentMarket.cityCoordinates[distanceRef];
    if (distanceRef && coords) {
      setReferenceCoords({ lat: coords.lat, lng: coords.lng });
      setReferenceLabel(currentMarket.cities.find((c) => c.id === distanceRef)?.nameAr || "");
      setSortByDistance(true);
    } else if (!distanceRef) {
      setSortByDistance(false);
      setReferenceCoords(null);
    }
  }, [distanceRef, currentMarket]);

  // Update calculation coordinates function to use current market city coordinates
  const getAdCoordsForCalculation = (ad: Ad, index: number = 0) => {
    const adLat = Number(ad.latitude);
    const adLng = Number(ad.longitude);

    if (!isNaN(adLat) && !isNaN(adLng) && adLat !== 0 && adLng !== 0) {
      return { lat: adLat, lng: adLng };
    }

    const cityKey = ad.city?.toLowerCase() || "";
    const base = currentMarket.cityCoordinates[cityKey] || { lat: currentMarket.center.lat, lng: currentMarket.center.lng };
    const offsetIndex =
      (ad.id ? parseInt(ad.id.replace(/\D/g, "")) : 0) || index || 1;
    const angle = offsetIndex * 137.5 * (Math.PI / 180);
    const radius = 0.05 + (offsetIndex % 7) * 0.015;
    const latOffset = Math.sin(angle) * radius * 0.85;
    const lngOffset = Math.cos(angle) * radius;

    return {
      lat: Number(base.lat) + latOffset,
      lng: Number(base.lng) + lngOffset,
    };
  };

  // Handle Search Triggered by Hero block
  const handleHeroSearch = (filters: {
    query: string;
    category: string;
    city: string;
    district?: string;
  }) => {
    // Smart Intent Detection & Context Switching
    const deliveryKeywords = ['توصيل', 'شحن', 'سائق', 'طرد', 'طلب', 'مندوب', 'نقل', 'بضاعة'];
    const socialKeywords = ['نبض', 'تفاعل', 'نشر', 'بوست', 'خبر', 'صديق', 'مشور', 'ستوري'];
    const q = filters.query.toLowerCase();

    if (deliveryKeywords.some(k => q.includes(k))) {
      setPlatformMode('delivery');
      addToast("المساعد الذكي 🤖", "تم كشف اهتمامك بالخدمات اللوجستية - تم تكييف المنصة لخدمة طلباتك فورياً", "success");
    } else if (socialKeywords.some(k => q.includes(k))) {
      setPlatformMode('social');
      addToast("المساعد الذكي 🤖", "نقلك إلى عالم التفاعل الاجتماعي - تصفح نبض أسواق وتواصل مع الآخرين", "success");
    }

    setSearchQuery(filters.query);
    setSelectedCategory(filters.category);

    if (filters.city === "gps") {
      setSelectedCity("");
      setSelectedDistrict("");
      handleGpsDetection();
    } else {
      setSelectedCity(filters.city);
      setSelectedDistrict(filters.district || "");
    }

    setSelectedJobType("all");
    setCurrentTab("home"); // Reset tab view
    setShowFavsOnly(false);
  };

  // Create Ad success callback
  const handleAdCreated = (newAd: Ad) => {
    // Requirements check: First ad must have OTP
    if (currentUser && !currentUser.hasPostedAd) {
      setPendingAd(newAd);
      setShowAdOtp(true);
      return;
    }
    setAds((prev) => [newAd, ...prev]);
    setFilteredAds((prev) => [newAd, ...prev]);
  };

  // Delete Ad
  const handleAdDeleted = async (adId: string) => {
    try {
      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
      const response = await fetch(`/api/ads/${adId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      if (response.ok) {
        setAds((prev) => prev.filter((a) => a.id !== adId));
        setFilteredAds((prev) => prev.filter((a) => a.id !== adId));
        if (selectedAd?.id === adId) setSelectedAd(null);
      }
    } catch (e) {
      console.error("Error deleting ad", e);
    }
  };

  // Change ad active/sold status
  const handleAdStatusChange = async (
    adId: string,
    status: string,
    isFeatured?: boolean,
  ) => {
    try {
      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
      const response = await fetch(`/api/ads/${adId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          status,
          ...(isFeatured !== undefined && { isFeatured })
        }),
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const updatedAd = await response.json();
           setAds((prev) => prev.map((a) => (a.id === adId ? updatedAd : a)));
           setFilteredAds((prev) => prev.map((a) => (a.id === adId ? updatedAd : a)));
           if (selectedAd?.id === adId) {
             setSelectedAd(updatedAd);
           }
        } else {
           console.warn("Ad status update failed - non-JSON response");
        }
      }
    } catch (e) {
      console.error("Error setting ad status", e);
    }
  };

  // Toggle Favorite list
  const handleLikeToggle = async (adId: string) => {
    const isAdding = !favorites.includes(adId);
    // Optimistic UI toggle
    setFavorites((prev) => {
      if (prev.includes(adId)) {
        return prev.filter((id) => id !== adId);
      }
      return [...prev, adId];
    });

    // Notify backend
    if (currentUser) {
      try {
        const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
        await fetch(`/api/users/${currentUser.id}/favorites`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ adId, action: isAdding ? 'add' : 'remove' })
        });
      } catch (e) {
        console.error("Failed to sync favorite status", e);
      }
    }
  };

  const handleSharePost = (post: any) => {
    const textMsg = `${isRtl ? 'شاهد هذا المنشور على نبض أسواق' : 'Check out this post on Aswaq Pulse'}: "${post.content || post.authorName}"`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#post-${post.id}` : '';
    
    if (navigator.share) {
      navigator.share({
        title: post.authorName,
        text: textMsg,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${textMsg}\n${shareUrl}`);
      addToast(t('spotlight.copiedToast'), "", "success");
    }
  };

  // Handle login from WelcomeFlow
  // Called by WelcomeFlow after successful login — receives the full user object
  const handleFlowLogin = (user: any) => {
    setCurrentUser(user);
    setShowWelcomeFlow(false);
    addToast(
      isRtl ? `أهلاً بعودتك، ${user.name} 👋` : `Welcome back, ${user.name} 👋`,
      isRtl ? 'تم تسجيل دخولك بنجاح إلى منصة أسواق.' : 'You have successfully logged in to Aswaq.',
      'success',
    );
  };

  // Called by WelcomeFlow after successful registration — receives the full user object
  const handleFlowRegister = (user: any) => {
    setCurrentUser(user);
    setShowWelcomeFlow(false);
    addToast(
      isRtl ? 'مرحباً بك في أسواق 🎉' : 'Welcome to Aswaq 🎉',
      isRtl ? 'تم إنشاء حسابك بنجاح، نتمنى لك تجربة رائعة!' : 'Your account has been created successfully!',
      'success',
    );
  };

  // Interactive Logistics Driver Engine
  const handleAcceptDeliveryOrder = (orderId: string) => {
    if (!currentUser) {
      addToast(
        "تنبيه المنظومة 🔐",
        "الرجاء تسجيل الدخول أو إنشاء حساب لتشغيل ميزات المنظومة اللوجستية.",
        "error"
      );
      setShowWelcomeFlow(true);
      return;
    }

    const order = deliveryOrders.find(o => o.id === orderId);
    if (!order) return;

    if (currentUser.role !== 'driver') {
      addToast(
        "تنبيه: أنت لست مسجلاً كسائق 👨‍✈️",
        "تم عرض كرت التوظيف وبقية تفاصيل تفعيل الحساب للسائقين الباحثين عن عمل في العمود الجانبي فورا!",
        "info"
      );
      setShowDriverRecruitCard(true);
      return;
    }

    if (activeDriverTask) {
      addToast(
        "خطأ في قبول الطلب ❌",
        "لديك بالفعل طلب نشط قيد التوصيل حالياً. أكمل الطلب الحالي أولاً!",
        "error"
      );
      return;
    }

    const updatedOrders = deliveryOrders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'accepted', driverName: currentUser.name };
      }
      return o;
    });
    setDeliveryOrders(updatedOrders);
    
    setActiveDriverTask({
      ...order,
      status: 'accepted',
      driverName: currentUser.name
    });

    if (navigator.vibrate) {
      navigator.vibrate([150, 100, 150]);
    }

    addToast(
      "تم قبول طلب التوصيل بنجاح 🛵",
      `تم استلام الطلب: ${order.title} شحنتك قيد النقل الآن. بالتوفيق!`,
      "success"
    );
  };

  const handleCompleteDelivery = () => {
    if (!activeDriverTask) return;

    const payout = activeDriverTask.priceEstimate || 1500;
    setDriverBalance(prev => prev + payout);

    const updatedOrders = deliveryOrders.filter(o => o.id !== activeDriverTask.id);
    setDeliveryOrders(updatedOrders);

    addToast(
      "تم تسليم الطرد بنجاح! 💸",
      `أحسنت! تم إتمام التوصيل للعميل واستلام الأجرة: ${payout.toLocaleString()} ${currentMarket.currency} نقداً/محفظة.`,
      "success"
    );

    // Save for rating simulation (usually the client would see this)
    setRatingOrder(activeDriverTask);
    setTrackingOrder(null);
    setActiveDriverTask(null);
  };

  const startDiagnosticsSimulation = () => {
    setTestSimStep(1);
    setTestSimProgress(0);
    const pCoords = pickupCoords || currentMarket.cityCoordinates[shipFrom];
    const dCoords = deliveryCoords || currentMarket.cityCoordinates[shipTo];
    
    const activePickup = pCoords || currentMarket.cityCoordinates['sanaa_city'] || { lat: 15.3694, lng: 44.1910 };
    const activeDelivery = dCoords || currentMarket.cityCoordinates['aden'] || { lat: 12.7855, lng: 45.0186 };
    
    setPickupCoords(activePickup);
    setDeliveryCoords(activeDelivery);
    
    const trackingId = `diag_order_${Date.now()}`;
    setActiveDiagnosticOrderId(trackingId);
    
    setTestSimLogs([
      `[⏱️ ${new Date().toLocaleTimeString()}] البدء: تشغيل محرك الفحص الجغرافي اللوجستي الشامل.`,
      `[📍 ${new Date().toLocaleTimeString()}] الإحداثيات: الاستلام من (${activePickup.lat.toFixed(4)}, ${activePickup.lng.toFixed(4)}) -> التسليم في (${activeDelivery.lat.toFixed(4)}, ${activeDelivery.lng.toFixed(4)})`,
      `[💸 ${new Date().toLocaleTimeString()}] الحسابات: التكلفة التقديرية التلقائية تعادل ${((shipWeight * 700) + 11000).toLocaleString()} ${currentMarket.currency}`
    ]);
    addToast("فحص الشحن: تم الجدولة 📋", "تم جدولة طرد الفحص وتأكيد سلامة خوارزميات التسعير وتثبيت المواقع الجغرافية بنجاح بنسبة 100%.", "success");
  };

  const simulateDriverAccept = () => {
    if (testSimStep !== 1) return;
    setTestSimStep(2);
    setTestSimLogs(prev => [
      ...prev,
      `[👨‍✈️ ${new Date().toLocaleTimeString()}] قبول الطلب: الكابتن "وسام الصنعاني" (رقم العضوية #7480) استلم مهمة الشحن بنجاح.`,
      `[📳 ${new Date().toLocaleTimeString()}] رنين الجيب: نظام Pocket Alerts أرسل نبضات اهتزازية لخلوي السائق: [Vibrate Active].`
    ]);
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    addToast("فحص الشحن: قبول السائق 🛵", "تم ربط الكابتن بالطلب وتنشيط التنبيه المستدير وهاتف الجيب بنجاح دون أي تأخير.", "info");
  };

  const simulateTransitRoute = () => {
    if (testSimStep !== 2) return;
    setTestSimStep(3);
    setTestSimProgress(0);
    setTestSimLogs(prev => [
      ...prev,
      `[⚡ ${new Date().toLocaleTimeString()}] النقل الجغرافي: تفعيل رادار بث الإحداثيات المستمر GPS ببطانية دقة 5 أمتار.`,
      `[🔄 ${new Date().toLocaleTimeString()}] جاري تتبع المسار الحي اللحظي على الخريطة الآن...`
    ]);

    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += 10;
      if (currentPct > 100) {
        currentPct = 100;
        clearInterval(interval);
        setTestSimStep(4);
        setTestSimLogs(prev => [
          ...prev,
          `[🏁 ${new Date().toLocaleTimeString()}] الوصول: المركبة اللوجستية وصلت لنقطة تسليم العميل بنجاح تام.`,
          `[📦 ${new Date().toLocaleTimeString()}] التسليم: تم التحقق من سلامة البضائع وبصمة التسليم الرقمية للعملية.`
        ]);
        addToast("فحص الشحن: تم الوصول للتسليم 🏁", "وصل السائق إلى وجهته بدقة متكاملة. بانتظار تحويل الأجرة وتقييم العميل.", "success");
      } else {
        setTestSimProgress(currentPct);
        if (currentPct % 20 === 0) {
          setTestSimLogs(prev => [
            ...prev,
            `[📡 ${new Date().toLocaleTimeString()}] بث GPS: السائق قطع ${currentPct}% من المسار الإجمالي بنجاح وبسرعة 45 كم/س.`
          ]);
        }
      }
    }, 450);
  };

  const simulatePayoutAndRating = () => {
    if (testSimStep !== 4) return;
    const fee = (shipWeight * 700) + 11000;
    setDriverBalance(prev => prev + fee);
    setTestSimLogs(prev => [
      ...prev,
      `[💳 ${new Date().toLocaleTimeString()}] الأجر والعمولة: تحويل مبلغ ${fee.toLocaleString()} ${currentMarket.currency} لمحفظة السائق بنجاح 100%.`,
      `[⭐️ ${new Date().toLocaleTimeString()}] تقييم وتصنيف النجمي: تم تسجيل تقييم العميل للمهمة (5/5 نجمة - ممتاز وسريع للغاية).`,
      `[✅ ${new Date().toLocaleTimeString()}] إنهاء الفحص: تم التحقق من سلامة وصلاحية كافة العمليات اللوجستية وتأكيد أنها خالية من الأخطاء والعيوب بنسبة 100%!`
    ]);
    setTestSimStep(0);
    addToast("اكتمال فحص الخدمة الدقيق بنجاح 🏆", "محاكاة دورة حياة الشحن تمت بالكامل بأمان وبدقة لامتناهية مع سلامة ترحيل القيود المالية وقراءة GPS!", "success");
  };

  const handleTogglePocketAlerts = () => {
    const nextVal = !pocketAlertsEnabled;
    setPocketAlertsEnabled(nextVal);
    if (nextVal) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      addToast(
        "تنبيهات الجيب نشطة 📳",
        "عند قفل الشاشة ووضع الهاتف بجيبك، سيهتز رنين الجيب بقوة لتنبيهك فور صدور أي شحنة جديدة بالقرب!",
        "success"
      );
    } else {
      addToast(
        "تم إيقاف تنبيهات الجيب 🔕",
        "تم تعطيل اهتزاز الرنين التلقائي في الخلفية.",
        "info"
      );
    }
  };

  const handleActivateDriverMode = () => {
    if (!currentUser) {
      addToast(
        "يرجى تسجيل الدخول 👤",
        "قم بإنشاء حساب في المنصة لتتمكن من تفعيل رتبة السائق والعمل معنا بحرية.",
        "error"
      );
      setShowWelcomeFlow(true);
      return;
    }

    if (!currentUser.verified) {
      addToast(
        "حسابك غير موثق ⚠️",
        "للموثوقية والأمان في أسواق، لا يمكن تفعيل حساب السائق إلا إذا كان حسابك موثقاً من قبل الإدارة. يرجى إرسال وثائقك في قسم الملف الشخصي.",
        "error"
      );
      return;
    }

    const upgradedUser = { ...currentUser, role: 'driver' as any };
    setCurrentUser(upgradedUser);

    addToast(
      "مبروك! تفعيل حساب سائق بنجاح 🛵🎉",
      "أنت الآن سائق معتمد في المنظومة الهجينة! يمكنك قبول طلبات الشحن وتلقي تنبيهات الجيب الفورية.",
      "success"
    );
    setShowDriverRecruitCard(false);
  };

  // Role switching mock helper (extremely friendly and satisfying for immediate reviews!)
  const switchUserRole = (userIndex: number) => {
    const targetUser = INITIAL_USERS[userIndex];
    if (!targetUser) return;

    setCurrentUser(targetUser);

    // Provide beautiful visual feedback
    addToast(
      "تبديل الحساب بنجاح 👥",
      `أنت الآن تتصفح كـ: ${targetUser.name} (${targetUser.role === "admin" ? "مدير المنصة" : targetUser.role === "merchant" || targetUser.role === "store" ? "حساب بائع" : "حساب مشتري"})`,
      "success",
    );

    // Immediately route to proper panels/dashboards based on the chosen role
    if (targetUser.role === "admin") {
      setCurrentTab("home");
      setShowAdminModal(true);
    } else if (
      targetUser.role === "merchant" ||
      targetUser.role === "store" ||
      targetUser.id === "user_1"
    ) {
      setCurrentTab("my-ads");
    } else {
      setCurrentTab("home");
    }

    fetchMessages();
    fetchNotifications();
  };

  // Mark all notifications read
  const handleNotificationRead = async () => {
    setUnreadNotificationsCount(0);
    try {
      await fetch("/api/notifications/read", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentUser ? { userId: currentUser.id } : {})
      });
    } catch (e) {}
  };

  // Select ad via AI Title recommendation
  const handleSelectAdByTitle = (title: string) => {
    const matchedAd = ads.find((a) =>
      a.title.toLowerCase().includes(title.toLowerCase()),
    );
    if (matchedAd) {
      setSelectedAd(matchedAd);
      setShowAiModal(false);
    }
  };

  // Intercept tab changes. If trying to access protected views without login, show login instead.
  const handleTabChange = (tab: string) => {
    if (tab === "map") {
      setCurrentTab("home");
      setViewMode("map");
      setPlatformMode('marketplace');
      if (mapRef.current) {
        mapRef.current.triggerLocation();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const isPublicTab = tab === "home" || tab === "create-ad";
    if (!isPublicTab && !currentUser) {
      setShowWelcomeFlow(true);
      return;
    }
    setCurrentTab(tab);
    setPlatformMode('marketplace');
    if (tab === "home") {
      setViewMode("split");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    (window as any).toggleDiscovery = () => setShowDiscovery(prev => !prev);
    (window as any).setPlatformMode = (mode: any) => setPlatformMode(mode);
  }, []);

  // Sync platformMode 'reels' with full screen discovery
  useEffect(() => {
    if (platformMode === 'reels') {
      setShowDiscovery(true);
    }
  }, [platformMode]);

  const GUEST_USER: User = {
    id: 'guest_user',
    name: isRtl ? 'زائر' : 'Guest',
    email: 'guest@aswaq.app',
    phone: '',
    role: UserRole.USER,
    avatar: null,
    verified: false,
    rating: 0,
    active: true,
    joinDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-hidden ${isDark ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"} flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white`}
    >
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-gradient-to-l from-rose-500 to-rose-600 font-bold text-center text-white py-3.5 text-xs px-4 flex items-center justify-center gap-2 select-none dir-rtl shrink-0 border-b border-rose-400/30 animate-pulse z-[9999]">
          <span>⚠️ {isRtl ? "تنبيه: انقطع الاتصال بالشبكة! يرجى التحقق من اتصالك بالإنترنت." : "Alert: Internet disconnected! Please check your network connection."}</span>
        </div>
      )}

      {/* Iframe Warning Banner — hidden when WelcomeFlow is open */}
      {isInIframe && !showWelcomeFlow && (
        <div className="bg-gradient-to-l from-amber-500 to-amber-600 font-bold text-center text-slate-950 py-3.5 text-[11px] sm:text-xs px-4 flex flex-col sm:flex-row items-center justify-center gap-2 select-none dir-rtl shrink-0 border-b border-amber-400/30">
          <span>⚠️ تنبيه المعاينة: لتسجيل الدخول بجوجل بنجاح، يرجى فتح التطبيق في نافذة مستقلة خارج إطار المعاينة.</span>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer text-[10px] font-black"
          >
            اضغط هنا لفتح التطبيق في علامة تبويب جديدة 🌐
          </button>
        </div>
      )}

      {/* Dynamic role feedback alerts if logged in as Admin — hidden when WelcomeFlow is open */}
      {(currentUser?.role === "admin" || currentUser?.role === "super_admin") && !showWelcomeFlow && (
        <div className="bg-gradient-to-l from-amber-600 to-amber-700 font-bold text-center text-slate-950 py-2.5 text-xs px-4 flex items-center justify-center gap-2 select-none dir-rtl shrink-0">
          <ShieldAlert className="w-4 h-4 animate-bounce" />
          <span>
            {t('navbar.adminBanner')}
          </span>
        </div>
      )}

      {/* Top Navigation Global elements — hidden when WelcomeFlow is open */}
      {!showWelcomeFlow && <Navbar
        currentUser={currentUser}
        unreadMessagesCount={unreadMessages.length}
        unreadNotificationsCount={unreadNotificationsCount}
        notifications={notifications}
        onOpenDashboard={handleTabChange}
        onOpenAdminPanel={() => {
          if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
            setShowAdminModal(true);
          } else {
            console.error('Unauthorized access attempt to Admin Panel');
          }
        }}
        onOpenAiAssistant={() => setShowAiModal(true)}
        onViewProfile={(user) => setSelectedUserPreview(user)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLogout={async () => {
          try {
            const token = localStorage.getItem('aswaq_refresh_token');
            if (token) {
              await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: token }),
              });
            }
          } catch (e) {
            console.error('Logout API error', e);
          }
          try {
            await signOut(auth);
          } catch (_) {}
          localStorage.removeItem('aswaq_access_token');
          localStorage.removeItem('aswaq_refresh_token');
          localStorage.removeItem('aswaq_current_user');
          localStorage.removeItem('auth_token');
          setCurrentUser(null);
          setNotifications([]);
          setUnreadNotificationsCount(0);
          if (socket) {
            socket.disconnect();
            socket.connect();
          }
          addToast(
            "تم تسجيل الخروج",
            `تم تسجيل خروجك بأمان من أسواق ${currentMarket.labelAr}`,
            "success",
          );
        }}
        onLoginClick={() => {
          triggerLoginFlow('splash');
        }}
        onNotificationClick={handleNotificationRead}
        favoritesCount={favorites.length}
        onOpenFavorites={() => {
          setCurrentTab("home");
          setActiveTab("favs");
        }}
        onSwitchUserRole={switchUserRole}
        currentMarket={currentMarket}
        onMarketChange={setCurrentMarket}
        platformMode={platformMode}
        onPlatformModeChange={setPlatformMode}
        platformSettings={platformSettings}
      />}
      <ToastContainer
        toasts={toasts}
        onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <PwaInstallPrompt isDark={theme === 'dark'} isRtl={isRtl} />

      {/* Unified Intelligent Context Banner — hidden when WelcomeFlow is open */}
      {!showWelcomeFlow && (
      <div className="bg-gradient-to-r from-emerald-600/5 via-cyan-600/5 to-fuchsia-600/5 border-b border-slate-200 dark:border-slate-800 py-2 px-4 shadow-sm select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase dir-rtl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>تجارة مباشرة</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>لوجستيات ذكية</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
              <span>تفاعل اجتماعي</span>
            </div>
          </div>
          <p className="animate-pulse hidden sm:block">
            {platformMode === 'marketplace' ? 'تصفح الإعلانات المباشرة في منطقتك' : 
             platformMode === 'delivery' ? 'نظام دقيق لتتبع الشحنات والطرود فورياً' : 
             'نبض أسواق: تواصل مباشرة مع التجار والمشترين'}
          </p>
        </div>
      </div>
      )}

      {/* Main Layout views router */}
      <div className="flex-grow">
        {(currentTab === "home" || !currentUser) && currentTab !== "create-ad" ? (
          <div className="pb-32">
            {/* Main Content Router based on Platform Mode */}
            <AnimatePresence mode="wait">
              {platformMode === 'marketplace' && (
                <motion.div
                  key="marketplace-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Elegant Hero blocks */}
                  {!selectedCategory && (
                    <Hero
                      onSearch={handleHeroSearch}
                      onOpenAiAssistant={() => setShowAiModal(true)}
                      onSelectAd={handleSelectAd}
                      currentMarket={currentMarket}
                      isDark={isDark}
                      categories={categories}
                      ads={ads}
                    />
                  )}

                  <div
                    className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${!selectedCategory ? "mt-12 space-y-12" : "mt-6"}`}
                  >
                  {/* Cities & Districts Horizontal Scroll */}
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-sm mb-6 mt-4">
                    <button
                      onClick={() => {
                        setSelectedCity("");
                        setSelectedDistrict("");
                        setDistanceRef("");
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-colors border ${
                        selectedCity === ""
                          ? "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                          : "bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                      }`}
                    >
                      {selectedCity ? <X className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                      {t('filters.allCities', { defaultValue: 'كل المدن' })}
                    </button>
                    
                    {!selectedCity ? (
                      // Show all cities in the current market
                      currentMarket.cities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => setSelectedCity(city.id)}
                          className={`px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-all border bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50`}
                        >
                          {isRtl ? city.nameAr : city.nameEn}
                        </button>
                      ))
                    ) : (
                      // City is selected, show "All districts" and list of districts
                      <>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />
                        <button
                          onClick={() => setSelectedDistrict("")}
                          className={`px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-all border ${
                            selectedDistrict === ""
                              ? "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                              : "bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                          }`}
                        >
                          {t('filters.allDistricts', { defaultValue: 'كل مناطق' })} {isRtl ? currentMarket.cities.find(c => c.id === selectedCity)?.nameAr : currentMarket.cities.find(c => c.id === selectedCity)?.nameEn}
                        </button>
                        {DISTRICTS.filter((d) => d.cityId === selectedCity).map((dist) => (
                          <button
                            key={dist.id}
                            onClick={() => setSelectedDistrict(dist.id)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-all border ${
                              selectedDistrict === dist.id
                                ? "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                                : "bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                            }`}
                          >
                            {isRtl ? dist.nameAr : dist.nameEn}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

              {/* When category is selected, show Category Details Header */}
              {selectedCategory && (
                <div className="mb-6 space-y-4">
                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                    <span
                      onClick={() => setSelectedCategory("")}
                      className="hover:text-emerald-500 cursor-pointer transition-colors"
                    >
                      الرئيسية
                    </span>
                    <ChevronLeft className="w-3 h-3" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {categories.find((c) => c.id === selectedCategory)
                        ?.nameAr || "القسم"}
                    </span>
                  </div>

                  {/* Title & Stats */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-3">
                        إعلانات{" "}
                        {
                          categories.find((c) => c.id === selectedCategory)
                            ?.nameAr
                        }{" "}
                        في {currentMarket.labelAr}
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full">
                          ({filteredAds.length}) إعلان
                        </span>
                      </h1>
                    </div>
                  </div>

                  {/* Subcategories Horizontal scroll */}
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-sm">
                    <button
                      onClick={() => {
                        setSelectedCategory("");
                        setSelectedSubCategory("");
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 font-bold text-xs shrink-0 transition-colors border border-rose-100 dark:border-rose-900/30"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t('filters.backToAll')}
                    </button>
                    {(SUB_CATEGORIES[selectedCategory] || categories.find(c => c.id === selectedCategory)?.subCategories || []).length > 0 && (
                      <>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />
                        <button
                          onClick={() => setSelectedSubCategory("")}
                          className={`px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-all border ${
                            selectedSubCategory === ""
                              ? "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                              : "bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                          }`}
                        >
                          الكل
                        </button>
                        {(SUB_CATEGORIES[selectedCategory] || categories.find(c => c.id === selectedCategory)?.subCategories || []).map((sub: any) => (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedSubCategory(sub.id)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition-all border ${
                              selectedSubCategory === sub.id
                                ? "bg-emerald-500 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500"
                                : "bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                            }`}
                          >
                            {isRtl ? sub.nameAr : sub.nameEn}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={`flex flex-col lg:flex-row gap-8 items-start`}>
                {/* Category Details Sidebar */}
                {selectedCategory && (
                  <div className="w-full lg:w-72 shrink-0 space-y-6 lg:sticky lg:top-24 mb-8 lg:mb-0">
                    {/* Categories Tree */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 mb-4">
                        الأقسام
                      </h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => setSelectedCategory("")}
                          className="block text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          جميع الأقسام
                        </button>
                        <div className="space-y-2 dir-rtl pr-3 border-r-2 border-emerald-500">
                          <span className="block text-xs font-black text-slate-900 dark:text-slate-100">
                            {
                              categories.find((c) => c.id === selectedCategory)
                                ?.nameAr
                            }
                          </span>
                          <div className="space-y-2 pr-3">
                            <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              • أحدث العروض ({filteredAds.length})
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-500 cursor-pointer">
                              عروض موثوقة (VIP)
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-500 cursor-pointer">
                              عروض مخفضة
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Smart Tags Placeholder from user prompt */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          وسوم
                          ذكية
                        </h3>
                        <button className="text-[10px] text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-slate-800 p-1.5 rounded-lg">
                          <Info className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          الحالة: جديد
                        </span>
                        <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          السعر: مفاوضة
                        </span>
                        <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          شحن متوفر
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feed & Tools */}
                <div className="flex-1 min-w-0 w-full space-y-6">
                  {/* Dynamic Filter Chips and Reset All */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Universal Condition Filter */}
                    <select 
                      value={selectedCondition}
                      onChange={(e) => setSelectedCondition(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full px-4 py-1.5 text-[10px] font-black outline-none cursor-pointer"
                    >
                      <option value="">كل الحالات</option>
                      <option value="new">جديد</option>
                      <option value="used">مستعمل</option>
                      <option value="refurbished">مجدد</option>
                    </select>

                    {searchQuery && (
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2">
                        {searchQuery}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                      </span>
                    )}
                    {selectedCategory && (
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2">
                        {categories.find(c => c.id === selectedCategory)?.nameAr}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory("")} />
                      </span>
                    )}
                    {selectedCity && (
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2">
                        {currentMarket.cities.find(c => c.id === selectedCity)?.nameAr}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCity("")} />
                      </span>
                    )}
                    {(searchQuery || selectedCategory || selectedCity || selectedMake || selectedYear || selectedTransmission || selectedFuelType || selectedBrand || selectedCondition || minPrice || maxPrice) && (
                      <button 
                         onClick={() => {
                            setSearchQuery("");
                            setSelectedCategory("");
                            setSelectedCity("");
                            setSelectedDistrict("");
                            setSelectedMake("");
                            setSelectedYear("");
                            setSelectedTransmission("");
                            setSelectedFuelType("");
                            setSelectedBrand("");
                            setSelectedCondition("");
                            setMinPrice("");
                            setMaxPrice("");
                         }}
                         className="text-[10px] font-black text-rose-500 hover:text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all bg-rose-500/5"
                      >
                         <RotateCcw className="w-3 h-3" />
                         تصفير الكل
                      </button>
                    )}
                  </div>

                  {/* Proximity and Geolocation Toolstrip (Compact) */}
                  <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 px-4 rounded-xl gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {t('dashboard.orderByProximity')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none text-xs text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg flex-1 md:w-48 appearance-none cursor-pointer text-right min-w-[140px]"
                        value={distanceRef}
                        onChange={(e) => setDistanceRef(e.target.value)}
                      >
                        <option value="">{t('dashboard.selectCenter')}</option>
                        <option value="gps">📍 موقعي الحالي (GPS)</option>
                        {currentMarket.cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.nameAr}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleGpsDetection}
                        disabled={gpsLoading}
                        className={`flex items-center justify-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all whitespace-nowrap shadow-sm shrink-0 ${gpsLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {gpsLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline leading-none">
                          تحديد GPS
                        </span>
                      </button>
                    </div>
                    {gpsError && (
                      <span className="text-[10px] text-rose-500 font-bold w-full md:w-auto text-center md:text-right">
                        {gpsError}
                      </span>
                    )}
                  </div>

                  {/* Main Filter Tabs */}
                  {!selectedCategory && (
                    <div className="flex flex-col gap-4">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {t('dashboard.personalizedFeed')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setActiveTab("all")}
                          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all border ${activeTab === "all" ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"}`}
                        >
                          🌍 {t('dashboard.allAds', { market: currentMarket.labelAr })}{" "}
                          <span className="text-[10px] opacity-60">
                            ({ads.length})
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab("favs")}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${activeTab === "favs" ? "bg-pink-500/10 border-pink-500 text-pink-400 shadow-lg shadow-pink-500/10" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"}`}
                        >
                          💗 {t('dashboard.favorites')}{" "}
                          <span className="text-[10px] opacity-60">
                            ({favorites.length})
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab("followed")}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${activeTab === "followed" ? "bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"}`}
                        >
                          👥 {t('dashboard.following')}{" "}
                          <span className="text-[10px] opacity-60">
                            ({followedSellers.length})
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedCategory && (
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <h2 className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {t('dashboard.updatingLocalAds', { market: currentMarket.labelAr })}...
                        </h2>
                      </div>
                      <div className="relative z-20 min-w-48 w-full md:w-auto">
                        <button
                          onClick={() => setIsMainCategoryDropdownOpen(!isMainCategoryDropdownOpen)}
                          className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all shadow-sm group hover:border-emerald-500/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                              <Tag className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-[12px] font-black text-slate-900 dark:text-white">
                              {selectedCategory ? categories.find(c => c.id === selectedCategory)?.nameAr || "كل الفئات" : "كل الفئات"}
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isMainCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isMainCategoryDropdownOpen && (
                          <div 
                            className="fixed inset-0 z-[1040]" 
                            onClick={() => setIsMainCategoryDropdownOpen(false)} 
                          />
                        )}
                        <div 
                          className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden transition-all duration-300 origin-top z-[1050] ${isMainCategoryDropdownOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}
                        >
                          <div className="max-h-60 overflow-y-auto no-scrollbar scroll-smooth p-2 space-y-1">
                            {[
                              { id: "", nameAr: "كل الفئات" },
                              ...categories,
                            ].map((cat) => {
                              const isActive = cat.id === selectedCategory;
                              return (
                                <button
                                  key={cat.id || "all"}
                                  onClick={() => {
                                    setSelectedCategory(cat.id);
                                    setIsMainCategoryDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-right transition-all group ${
                                    isActive 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="text-[12px] font-black">{cat.nameAr}</span>
                                  {isActive && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Advanced Real Estate Filters UI */}
                  <AnimatePresence>
                    {selectedCategory === "realestate" && (
                      <motion.div
                        key="real-estate-filters"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-emerald-600/10 border border-emerald-600/20 p-6 rounded-3xl space-y-4 mb-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-5 h-5 text-emerald-500" />
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">تصفية العقارات</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <select 
                              value={selectedPropertyType}
                              onChange={(e) => setSelectedPropertyType(e.target.value)}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">نوع العقار</option>
                              <option value="villa" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">فيلا</option>
                              <option value="apartment" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">شقة</option>
                              <option value="land" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">أرض</option>
                              <option value="commercial" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">تجاري</option>
                            </select>
                            <select 
                              value={selectedRooms === "" ? "" : selectedRooms.toString()}
                              onChange={(e) => setSelectedRooms(e.target.value ? parseInt(e.target.value) : "")}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">عدد الغرف</option>
                              {[1, 2, 3, 4, 5, 6].map(r => (
                                <option key={r} value={r} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">{r}+ غرف</option>
                              ))}
                            </select>
                            <div className="flex bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 gap-1">
                              <button
                                onClick={() => setSelectedAmenities(prev => prev.includes('furnished') ? prev.filter(a => a !== 'furnished') : [...prev, 'furnished'])}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedAmenities.includes('furnished') ? "bg-emerald-500 text-white" : "text-slate-500"}`}
                              >
                                مفروش
                              </button>
                              <button
                                onClick={() => setSelectedAmenities(prev => prev.includes('parking') ? prev.filter(a => a !== 'parking') : [...prev, 'parking'])}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedAmenities.includes('parking') ? "bg-emerald-500 text-white" : "text-slate-500"}`}
                              >
                                كراج
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {selectedCategory === "cars" && (
                      <motion.div
                        key="cars-filters"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-amber-600/10 border border-amber-600/20 p-6 rounded-3xl space-y-4 mb-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Car className="w-5 h-5 text-amber-500" />
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">تصفية السيارات</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <select 
                              value={selectedMake}
                              onChange={(e) => setSelectedMake(e.target.value)}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">ماركة السيارة</option>
                              {["تويوتا", "لكزس", "نيسان", "هيونداي", "كيا", "مرسيدس"].map(m => (
                                <option key={m} value={m} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">{m}</option>
                              ))}
                            </select>
                            <select 
                              value={selectedTransmission}
                              onChange={(e) => setSelectedTransmission(e.target.value)}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">ناقل الحركة</option>
                              <option value="automatic" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">تماتيك</option>
                              <option value="manual" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">عادي</option>
                            </select>
                            <select 
                              value={selectedFuelType}
                              onChange={(e) => setSelectedFuelType(e.target.value)}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">نوع الوقود</option>
                              <option value="gasoline" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">بترول</option>
                              <option value="diesel" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">ديزل</option>
                              <option value="hybrid" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">هايبرد</option>
                            </select>
                            <select 
                              value={selectedYear}
                              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : "")}
                              className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                            >
                              <option value="" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">سنة الصنع</option>
                              {Array.from({ length: 15 }, (_, i) => 2025 - i).map(y => (
                                <option key={y} value={y} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">{y}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {["electronics", "phones", "laptops"].includes(selectedCategory) && (
                      <motion.div
                        key="electronics-filters"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-3xl space-y-4 mb-6 shadow-sm">
                           <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="w-5 h-5 text-blue-500" />
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">تصفية الإلكترونيات والذكاء</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                              {["الكل", "apple", "samsung", "iphone", "hp", "dell", "lenovo"].map(b => (
                                <button
                                  key={b}
                                  onClick={() => setSelectedBrand(b === "الكل" ? "" : b)}
                                  className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all whitespace-nowrap ${selectedBrand.toLowerCase() === (b === "الكل" ? "" : b) ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600"}`}
                                >
                                  {b.toUpperCase()}
                                </button>
                              ))}
                            </div>
                            <select 
                              value={selectedCondition}
                              onChange={(e) => setSelectedCondition(e.target.value)}
                              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            >
                              <option value="">الحالة العامة</option>
                              <option value="new">جديد كرت</option>
                              <option value="used_mint">مستعمل نظيف جداً</option>
                              <option value="used">مستعمل</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Job Portal integration or standard view */}
                  {isJobsCategorySelected(selectedCategory) ? (
                    <div className="mt-8">
                      <JobPortal
                        currentUser={currentUser || GUEST_USER}
                        isDark={isDark}
                        ads={ads}
                        onSelectAd={setSelectedAd}
                        addToast={addToast}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Sovereign Market Insights Indicator */}
                      <div className="mt-8 space-y-6">
                        {currentMarket.countryCode === 'YE' && <ExchangeRatesWidget />}
                        <PriceInsightsWidget ads={ads} currentMarket={currentMarket} />
                      </div>

                      {/* View Mode Switching Logic */}
                      <MainContentArea
                        onMapRef={(ref) => mapRef.current = ref}
                        viewMode={viewMode}
                        filteredAds={filteredAds}
                        selectedCity={selectedCity}
                        setSelectedCity={setSelectedCity}
                        setSelectedAd={handleSelectAd}
                        referenceCoords={referenceCoords}
                        currentMarket={currentMarket}
                        favorites={favorites}
                        handleLikeToggle={handleLikeToggle}
                        platformMode={platformMode}
                        onPlatformModeChange={setPlatformMode}
                        loading={loading}
                        isDark={isDark}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        onLoadMore={loadMoreAds}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}



              {platformMode === "jobs" && (
                <motion.div
                  key="jobs-platform-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
                >
                  <JobPortal
                    currentUser={currentUser || GUEST_USER}
                    isDark={isDark}
                    ads={ads}
                    onSelectAd={setSelectedAd}
                    addToast={addToast}
                  />
                </motion.div>
              )}

              {platformMode === "delivery" && (
                <React.Suspense fallback={<LazyFallback />}>
                  <DeliveryDashboard
                    currentUser={currentUser}
                    currentMarket={currentMarket}
                    isRtl={isRtl}
                    addToast={addToast}
                    ads={ads}
                    setAds={setAds}
                    setFilteredAds={setFilteredAds}
                  />
                </React.Suspense>
              )}

              {platformMode === "social" && (
                <motion.div
                  key="social-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8"
                >
                  <div className={`bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-900/90 backdrop-blur-2xl border border-white/5 p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] space-y-6 sm:space-y-8 ${isRtl ? 'dir-rtl text-right' : 'dir-ltr text-left'} my-6 sm:my-8`}>
                      <div className={`flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 gap-4 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={isRtl ? 'text-right' : 'text-left'}>
                          <h3 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-indigo-400 flex items-center gap-2">
                             💬 {t('social.communityTitle')}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xl">
                             {t('social.communitySubtitle')}
                          </p>
                        </div>
                        <span className="self-start md:self-center text-[10px] bg-gradient-to-r from-fuchsia-500/10 to-indigo-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-4 py-1.5 rounded-full font-black tracking-wider animate-pulse flex items-center gap-2 shadow-lg shadow-fuchsia-500/5">
                           <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                           {t('social.pulseActive')}
                        </span>
                      </div>



                      {/* 📊 نبض الأسواق: منبر استطلاعات الرأي والنبض السعري التفاعلي */}
                      <div className="bg-gradient-to-br from-[#120c1e]/80 to-slate-950/80 p-5 sm:p-6 rounded-[2rem] border border-fuchsia-500/10 shadow-xl space-y-5 relative overflow-hidden group">
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-fuchsia-500/10 blur-[80px] rounded-full pointer-events-none transition-all group-hover:bg-fuchsia-500/20" />
                        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4">
                          <div>
                            <span className="text-[9px] bg-gradient-to-r from-fuchsia-500 to-indigo-650 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md shadow-fuchsia-500/10">جديد تفاعلي</span>
                            <h4 className="text-sm font-black text-white mt-2.5 flex items-center gap-1.5">
                              📊 {isRtl ? 'منبر استطلاعات الرأي ونبض الأسعار الإقليمي' : 'Regional Market Polls & Pricing Pulse'}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                              {isRtl ? 'شارك برأيك في نقاشات السوق وتبادل التوقعات السعرية والضمانات مع التجار بشكل مباشر!' : 'Share your opinion on market trends, exchange rates and commercial guarantees.'}
                            </p>
                          </div>
                          
                          {/* Tabs to switch active poll */}
                          <div className="flex gap-1.5 shrink-0 self-start md:self-center">
                            <button
                              type="button"
                              onClick={() => setActivePollIndex(0)}
                              className={`px-4 py-1.5 text-[9.5px] font-bold rounded-xl transition-all border ${
                                activePollIndex === 0
                                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/5'
                                  : 'bg-slate-900/60 text-slate-500 border-white/5 hover:text-slate-400 hover:bg-slate-800/40'
                              }`}
                            >
                              التوقعات العقارية
                            </button>
                            <button
                              type="button"
                              onClick={() => setActivePollIndex(1)}
                              className={`px-4 py-1.5 text-[9.5px] font-bold rounded-xl transition-all border ${
                                activePollIndex === 1
                                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/5'
                                  : 'bg-slate-900/60 text-slate-500 border-white/5 hover:text-slate-400 hover:bg-slate-800/40'
                              }`}
                            >
                              ترقية الخدمات والضمان
                            </button>
                          </div>
                        </div>

                        {marketPolls.length > 0 && marketPolls[activePollIndex] ? (
                          <div className="space-y-3">
                            <p className="text-[11px] font-black leading-relaxed text-slate-200">
                              ❓ "{marketPolls[activePollIndex].question}"
                            </p>
                            
                            <div className="space-y-2">
                              {marketPolls[activePollIndex].options.map((optText: string, idx: number) => {
                                const poll = marketPolls[activePollIndex];
                                const votes = poll.votes || [0, 0, 0];
                                const total = votes.reduce((acc: number, curr: number) => acc + curr, 0);
                                const v = votes[idx] || 0;
                                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                                const hasVoted = votedPolls[poll.id] !== undefined;
                                const isSelected = votedPolls[poll.id] === idx;

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (hasVoted) return;
                                      handlePollVote(poll.id, idx);
                                    }}
                                    className={`relative p-3 rounded-xl border transition-all duration-300 ${
                                      hasVoted ? 'cursor-default' : 'cursor-pointer hover:bg-slate-900 hover:border-slate-700'
                                    } ${
                                      isSelected 
                                        ? 'border-fuchsia-500/60 bg-fuchsia-500/5' 
                                        : 'border-slate-800 bg-slate-950/40'
                                    }`}
                                  >
                                    {/* Vote percentage bar indicator behind text */}
                                    {hasVoted && (
                                      <div 
                                        className="absolute right-0 top-0 bottom-0 bg-fuchsia-500/10 rounded-xl transition-all duration-1000" 
                                        style={{ width: `${pct}%` }}
                                      />
                                    )}

                                    <div className="relative flex items-center justify-between text-[10.5px]">
                                      <span className={`font-medium ${isSelected ? 'text-fuchsia-400 font-extrabold' : 'text-slate-300'}`}>{optText}</span>
                                      {hasVoted && (
                                        <span className="font-extrabold text-fuchsia-400 ml-2 font-mono">{pct}% ({v} صوت)</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex justify-between items-center text-[8.5px] text-slate-500 pt-1">
                              <span>📅 ينتهي الاستطلاع: قريباً</span>
                              <span>🗳️ إجمالي المشاركات: {marketPolls[activePollIndex].votes?.reduce((acc: number, curr: number) => acc + curr, 0) || 0} صوت</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-10 text-center">
                            <span className="text-[10px] text-slate-500">جاري تحميل الاستطلاعات...</span>
                          </div>
                        )}
                      </div>

                      {/* Post Publisher */}
                      <div className="bg-slate-950/85 p-5 sm:p-6 rounded-[2rem] border border-white/5 shadow-2xl space-y-4">
                        {!currentUser ? (
                          /* ── Guest Login Prompt ── */
                          <div className="flex flex-col items-center gap-4 py-6 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div>
                              <p className="text-sm font-black text-white mb-1">سجّل دخولك للمشاركة</p>
                              <p className="text-xs text-slate-500">يمكنك التصفح بحرية، لكن للنشر والتفاعل تحتاج إلى حساب</p>
                            </div>
                            <button
                              onClick={() => triggerLoginFlow('splash')}
                              className="px-6 py-2.5 rounded-2xl bg-fuchsia-500 text-white text-sm font-black hover:bg-fuchsia-400 transition-all shadow-lg shadow-fuchsia-500/20"
                            >
                              تسجيل الدخول / إنشاء حساب
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-4">
                              {currentUser?.avatar ? (
                                <img 
                                  src={currentUser.avatar} 
                                  className="w-11 h-11 rounded-2xl object-cover shrink-0 cursor-pointer hover:opacity-90 hover:scale-105 transition-all ring-2 ring-white/10" 
                                  onClick={() => {
                                    if (currentUser) {
                                      setSelectedUserPreview(currentUser);
                                      navigate('/profile');
                                    }
                                  }}
                                />
                          ) : (
                            <div 
                              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-indigo-650 flex items-center justify-center text-white text-sm font-black shrink-0 cursor-pointer hover:scale-105 transition-all ring-2 ring-white/10"
                              onClick={() => {
                                if (currentUser) {
                                  setSelectedUserPreview(currentUser);
                                  navigate('/profile');
                                }
                              }}
                            >
                              {currentUser?.name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-4">
                            <textarea
                              placeholder={t('social.postPlaceholder', { name: currentUser?.name || t('social.merchant') })}
                              value={newPostText}
                              onChange={(e) => setNewPostText(e.target.value)}
                              rows={3}
                              className="w-full bg-[#0a0f1d]/60 border border-white/5 focus:border-fuchsia-500/50 rounded-2xl p-4 text-xs text-white placeholder:text-slate-500 outline-none transition-all resize-none shadow-inner"
                            />
                            
                            {/* Media upload buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
                              <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  setMediaType('image');
                                  mediaInputRef.current?.click();
                                }}
                                title={t('social.addImage')}
                                className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 shrink-0"
                              >
                                <ImageIcon size={18} className="text-emerald-400" />
                              </button>
                              <button 
                                onClick={() => {
                                  setMediaType('video');
                                  mediaInputRef.current?.click();
                                }}
                                title={t('social.addVideo')}
                                className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 shrink-0"
                              >
                                <Video size={18} className="text-cyan-400" />
                              </button>
                              <button 
                                onClick={() => {
                                  setMediaType('file');
                                  mediaInputRef.current?.click();
                                }}
                                title={t('social.addFile')}
                                className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 shrink-0"
                              >
                                <FileText size={18} className="text-amber-400" />
                              </button>
                              <button 
                                onClick={() => addToast(t('social.addLocation'), t('social.previewMedia'), "success")}
                                title={t('social.addLocation')}
                                className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 shrink-0"
                              >
                                <MapPin size={18} className="text-rose-400" />
                              </button>
                              
                              <input 
                                type="file"
                                ref={mediaInputRef}
                                className="hidden"
                                accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      setSelectedMedia(prev => [...prev, { type: mediaType, url: reader.result, name: file.name }]);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </div>
                          </div>

                            {/* Media Previews */}
                            {selectedMedia.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {selectedMedia.map((m, i) => (
                                  <div key={i} className="relative group/media">
                                    {m.type === 'image' ? (
                                      <img src={m.url} className="w-16 h-16 rounded-lg object-cover border border-slate-800" />
                                    ) : m.type === 'video' ? (
                                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-800">
                                        <Video size={16} className="text-cyan-400" />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-800">
                                        <FileText size={16} className="text-amber-400" />
                                      </div>
                                    )}
                                    <button 
                                      onClick={() => setSelectedMedia(prev => prev.filter((_, idx) => idx !== i))}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center scale-0 group-hover/media:scale-100 transition-transform cursor-pointer"
                                    >
                                      <X size={10} strokeWidth={3} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Visual background preset selects */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-800">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 w-full sm:w-auto">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{t('social.backgroundPreset')}</span>
                            {[
                              { id: "car", url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80", icon: "🚗" },
                              { id: "building", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80", icon: "🏡" },
                              { id: "phone", url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80", icon: "📱" }
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => setSelectedSocialImage(opt.url)}
                                className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 shrink-0 ${selectedSocialImage === opt.url ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 font-bold" : "bg-slate-900 text-slate-400 border border-slate-850"}`}
                              >
                                <span>{opt.icon}</span>
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              if (!currentUser || currentUser.id === 'guest_user') {
                                triggerLoginFlow('splash');
                                return;
                              }
                              if (!newPostText.trim() && selectedMedia.length === 0) return;
                              const newPost = {
                                id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                authorId: currentUser?.id || "anon",
                                authorName: currentUser?.name || (isRtl ? "ضيف المنصة المجهول" : "Anonymous Guest"),
                                authorHandle: (currentUser?.role === "merchant" && currentUser?.isVerified === "verified") ? (isRtl ? "تاجر_موثق" : "verified_merchant") : "",
                                authorAvatar: currentUser?.avatar || undefined,
                                content: newPostText,
                                image: selectedSocialImage,
                                media: selectedMedia,
                                createdAt: new Date().toISOString(),
                                likes: 0,
                                likedBy: [] as string[],
                                comments: [] as any[]
                              };

                              setSocialPosts(prev => [newPost, ...prev]);
                              setNewPostText('');
                              setSelectedSocialImage(null);
                              setSelectedMedia([]);
                              addToast(
                                t('social.postSuccess'),
                                t('social.postSuccessDetail'),
                                "success"
                              );
                            }}
                            disabled={!newPostText.trim() && selectedMedia.length === 0}
                            className="w-full sm:w-auto px-5 py-2 bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-fuchsia-500/10 border-none"
                          >
                            {t('social.publishPost')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                      {/* Posts Stack Feed */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...socialPosts]
                          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                          .map(post => {
                          return (
                            <div key={post.id} className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden flex flex-col justify-between">
                              {/* Post Header */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => {
                                  const usr = INITIAL_USERS.find(u => u.id === post.authorId);
                                  if (usr) setSelectedUserPreview(usr);
                                }}>
                                  <img src={post.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-800 group-hover:ring-fuchsia-500 transition-all" />
                                  <div className="text-right">
                                    <span className="text-xs font-extrabold text-white block group-hover:text-fuchsia-400 transition-colors">{post.authorName}</span>
                                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                                      {(post.authorHandle === 'تاجر_موثق' || post.authorHandle === 'verified_merchant') && (
                                        <span className="text-[9px] text-fuchsia-400 font-mono font-bold">@{post.authorHandle}</span>
                                      )}
                                      {post.createdAt && (
                                        <span className="text-[8px] text-slate-500 font-bold whitespace-nowrap">
                                          ⏱️ {new Date(post.createdAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US', {month: 'numeric', day: 'numeric'})} {new Date(post.createdAt).toLocaleTimeString(isRtl ? 'ar-YE' : 'en-US', {hour: '2-digit', minute: '2-digit'})}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                  <div className="flex items-center gap-2">
                                    {(post.authorId === currentUser?.id || currentUser?.role === 'admin') && (
                                      <button
                                        onClick={() => setPostToDelete(post.id)}
                                        className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
                                        title={isRtl ? "حذف المنشور" : "Delete Post"}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                    {post.authorId !== currentUser?.id && (post.authorHandle === 'تاجر_موثق' || post.authorHandle === 'verified_merchant') && (
                                      <button
                                        onClick={() => {
                                           toggleFollowSeller(post.authorId);
                                           addToast(
                                             followedSellers.includes(post.authorId) ? t('social.unfollowed') : t('social.followedSuccess'),
                                             followedSellers.includes(post.authorId) ? t('social.unfollowedDetail', { name: post.authorName }) : t('social.followedDetail', { name: post.authorName }),
                                             "success"
                                           );
                                        }}
                                        className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all border-none ${followedSellers.includes(post.authorId) ? "bg-slate-900 text-slate-400" : "bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-400"}`}
                                      >
                                        {followedSellers.includes(post.authorId) ? t('social.following') : t('social.followMerchant')}
                                      </button>
                                    )}
                                  </div>
                              </div>

                              {/* Post Content */}
                              <div className="px-4 pb-3 space-y-3">
                                {post.content && <p className="text-xs text-slate-200 leading-relaxed font-normal">{post.content}</p>}
                                
                                {post.image && (
                                  <div className="w-full h-44 rounded-xl overflow-hidden relative border border-slate-850">
                                    <img src={post.image || undefined} className="w-full h-full object-cover" />
                                  </div>
                                )}

                                {/* Display Attached Media */}
                                {post.media && post.media.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {post.media.map((m: any, i: number) => (
                                      <div key={i} className="max-w-full">
                                        {m.type === 'image' ? (
                                          <img src={m.url || undefined} className="max-h-48 rounded-xl object-contain border border-slate-800" />
                                        ) : m.type === 'video' ? (
                                          <video src={m.url || undefined} controls className="max-h-48 rounded-xl border border-slate-800 w-full" />
                                        ) : (
                                          <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[10px] text-slate-300">
                                            <FileText size={14} className="text-amber-400" />
                                            <span className="truncate max-w-[150px]">{m.name}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Like and comment stats interactive */}
                              <div className="p-3 bg-slate-900/60 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400">
                                 <div className="flex items-center gap-4">
                                   <button
                                     onClick={() => {
                                       setSocialPosts(prev => prev.map(p => {
                                         if (p.id === post.id) {
                                           const alreadyLiked = p.likedBy.includes(currentUser?.id || 'anon');
                                           return {
                                             ...p,
                                             likes: alreadyLiked ? p.likes - 1 : p.likes + 1,
                                             likedBy: alreadyLiked ? p.likedBy.filter(id => id !== (currentUser?.id || 'anon')) : [...p.likedBy, (currentUser?.id || 'anon')]
                                           };
                                         }
                                         return p;
                                        }));
                                        addToast(t('social.greatInteraction'), t('social.greatInteractionDetail'), "success");
                                     }}
                                     className={`flex items-center gap-1.5 cursor-pointer font-bold transition-colors ${post.likedBy.includes(currentUser?.id || 'anon') ? "text-rose-500" : "hover:text-rose-450 text-slate-400"}`}
                                   >
                                     <span>❤️ {post.likes} {t('social.interactions')}</span>
                                   </button>
                                   <span className="text-[10px] text-slate-500">💬 {post.comments.length} {t('social.customerComments')}</span>
                                 </div>
                                 
                                 <div className="flex items-center gap-3">
                                   <button 
                                     onClick={() => handleSharePost(post)}
                                     title={t('spotlight.share')}
                                     className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-400 hover:text-blue-400 transition-colors"
                                   >
                                     <Share2 size={14} />
                                     <span className="text-[10px]">{t('spotlight.share')}</span>
                                   </button>
                                   <span className="text-[9px] text-slate-500 font-mono font-bold">{t('social.verifiedSystem')}</span>
                                 </div>
                              </div>

                              {/* Live Comment Listing */}
                              {post.comments.length > 0 && (
                                <div className="bg-slate-950/80 px-4 py-2.5 border-t border-slate-850 text-xs text-right max-h-[160px] overflow-y-auto space-y-3.5 col-span-1">
                                  {post.comments.map((comm) => {
                                    const commLikes = comm.likes || 0;
                                    const isCommLiked = comm.likedBy?.includes(currentUser?.id || "anon");
                                    const commReplies = comm.replies || [];
                                    return (
                                      <div key={comm.id} className="border-b border-slate-900/40 pb-2.5 pt-1 last:border-0 last:pb-0">
                                        <div className="flex items-start justify-between gap-2 text-right">
                                          <div className="flex-1">
                                            <span className="font-extrabold text-fuchsia-400 text-[10px] ml-1.5">{comm.author}:</span>
                                            <span className="text-slate-300 text-[10px] inline-block">{comm.comment}</span>
                                          </div>
                                        </div>
                                        
                                        {/* Interaction Actions for Each Comment */}
                                        <div className="flex items-center gap-4 mt-1 px-1 text-[9px] text-slate-550 font-sans justify-end">
                                          {/* Like comment */}
                                          <button
                                            type="button"
                                            onClick={() => handleLikeSocialComment(post.id, comm.id)}
                                            className={`flex items-center gap-1 hover:text-rose-450 transition-colors cursor-pointer ${isCommLiked ? "text-rose-500 font-bold" : "text-slate-500"}`}
                                            title={isRtl ? "أعجبني" : "Like"}
                                          >
                                            <span>❤️</span>
                                            <span>{commLikes}</span>
                                          </button>

                                          {/* Reply to comment trigger */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReplyTarget((prev) => ({
                                                ...prev,
                                                [post.id]: { commentId: comm.id, commentAuthor: comm.author },
                                              }));
                                            }}
                                            className="hover:text-fuchsia-400 text-slate-500 transition-colors flex items-center gap-1 cursor-pointer"
                                            title={isRtl ? "رد على هذا التعليق" : "Reply to this comment"}
                                          >
                                            <span>💬</span>
                                            <span>{isRtl ? "رد" : "Reply"}</span>
                                          </button>
                                        </div>

                                        {/* Nested Replies inside each comment */}
                                        {commReplies.length > 0 && (
                                          <div className="mr-3 mt-2 pr-2.5 border-r-2 border-slate-800 space-y-2">
                                            {commReplies.map((rep: any) => {
                                              const repLikes = rep.likes || 0;
                                              const isRepLiked = rep.likedBy?.includes(currentUser?.id || "anon");
                                              return (
                                                <div key={rep.id} className="bg-slate-900/10 rounded-xl p-1.5 border border-slate-900/20 text-right">
                                                  <div className="flex items-start gap-1">
                                                    <CornerDownLeft className="w-2.5 h-2.5 text-slate-600 mt-0.5 ml-1 flex-shrink-0" />
                                                    <div className="flex-1">
                                                      <span className="font-extrabold text-fuchsia-450 text-[10px] ml-1.5">{rep.author}:</span>
                                                      <span className="text-slate-300 text-[10px] inline-block">{rep.comment}</span>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Like nested reply */}
                                                  <div className="flex items-center gap-3 mt-1.5 px-3 text-[8px] text-slate-550 font-sans justify-end">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleLikeSocialReply(post.id, comm.id, rep.id)}
                                                      className={`flex items-center gap-1 hover:text-rose-450 transition-colors cursor-pointer ${isRepLiked ? "text-rose-500 font-bold" : "text-slate-500"}`}
                                                    >
                                                      <span>❤️</span>
                                                      <span>{repLikes}</span>
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Active Reply Banner Indicator */}
                              {replyTarget[post.id] && (
                                <div className="px-3 py-1.5 bg-fuchsia-950/30 border-t border-slate-850 flex items-center justify-between text-[10px] text-fuchsia-300">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownLeft className="w-3 h-3 text-fuchsia-400" />
                                    <span>{isRtl ? `جاري الرد على تعليق ${replyTarget[post.id].commentAuthor}` : `Replying to ${replyTarget[post.id].commentAuthor}`}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyTarget((prev) => {
                                        const copy = { ...prev };
                                        delete copy[post.id];
                                        return copy;
                                      });
                                    }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Interactive Comment Input Box */}
                              <div className="p-3 bg-slate-900/30 border-t border-slate-850 flex items-center gap-2">
                                <img
                                  src={currentUser?.avatar || undefined}
                                  className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800"
                                  alt="My Avatar"
                                />
                                <div className="flex-1 flex items-center bg-slate-950 border border-slate-850 rounded-xl px-3 py-1 focus-within:border-fuchsia-500/80 transition-colors">
                                  <input
                                    type="text"
                                    placeholder={
                                      replyTarget[post.id]
                                        ? (isRtl ? "اكتب رداً..." : "Write a reply...")
                                        : (isRtl ? "اكتب تعليقاً على هذا المنشور..." : "Write a comment on this post...")
                                    }
                                    value={commentInputs[post.id] || ""}
                                    onChange={(e) =>
                                      setCommentInputs((prev) => ({
                                        ...prev,
                                        [post.id]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddSocialComment(post.id);
                                      }
                                    }}
                                    className="flex-1 bg-transparent text-xs text-slate-100 outline-none border-none py-1 text-right placeholder-slate-700"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddSocialComment(post.id)}
                                    disabled={!(commentInputs[post.id] || "").trim()}
                                    className="p-1 mr-1 text-fuchsia-400 hover:text-fuchsia-300 disabled:text-slate-800 transition-colors cursor-pointer"
                                    title={isRtl ? "إرسال" : "Send"}
                                  >
                                    <Send className="w-3.5 h-3.5 fill-current transform rotate-180" />
                                  </button>
                                </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            <div className="mt-16 border-t border-slate-200 dark:border-zinc-900 pt-12">
              <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isRtl ? 'text-right dir-rtl' : 'text-left dir-ltr'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <div className="inline-block bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                        {t('branding.leadingPlatform', { country: isRtl ? (currentMarket.countryCode === 'YE' ? 'يمنية' : currentMarket.countryCode === 'SA' ? 'سعودية' : currentMarket.countryCode === 'EG' ? 'مصرية' : currentMarket.countryCode === 'AE' ? 'إماراتية' : currentMarket.countryCode === 'JO' ? 'أردنية' : 'عربية') : (currentMarket.countryCode === 'YE' ? 'Yemeni' : currentMarket.countryCode === 'SA' ? 'Saudi' : currentMarket.countryCode === 'EG' ? 'Egyptian' : currentMarket.countryCode === 'AE' ? 'Emirati' : currentMarket.countryCode === 'JO' ? 'Jordanian' : 'Arab') })}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold leading-tight">
                      {t('branding.eraTitle')}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      {t('branding.eraDesc', { l: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[2.5rem] border border-zinc-800 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center overflow-hidden relative z-10 shadow-2xl bg-zinc-900/50 border border-zinc-800 p-1.5">
                      {platformSettings?.logoUrl ? (
                        <img src={platformSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full bg-yellow-500 flex items-center justify-center shadow-yellow-500/20">
                          <span className="text-black font-black text-3xl">
                            {platformSettings?.logoLetter || (isRtl ? currentMarket.labelAr[0] : currentMarket.labelEn[0])}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black mb-1 tracking-tighter text-white">
                        {t('branding.marketTitle', { l: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
                      </h4>
                      <p className="text-zinc-500 max-w-sm text-xs leading-relaxed">
                        {t('branding.marketTagline', { l: isRtl ? currentMarket.labelAr : currentMarket.labelEn })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <React.Suspense fallback={<LazyFallback />}>
            <Dashboard
              currentUser={currentUser || GUEST_USER}
              currentMarket={currentMarket}
              ads={ads}
              onAdCreated={(newAd) => {
                setAds(prev => [newAd, ...prev]);
                handleTabChange('home');
              }}
              onAdDeleted={handleAdDeleted}
              onAdStatusChange={handleAdStatusChange}
              onAdUpdated={(updatedAd) => {
                setAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
                setFilteredAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
                if (selectedAd?.id === updatedAd.id) {
                  setSelectedAd(updatedAd);
                }
              }}
              initialTab={currentTab}
              onTabChange={handleTabChange}
              onSelectAd={handleSelectAd}
              isDark={isDark}
              unreadMessagesCount={unreadMessages.length}
              categories={categories}
              addToast={addToast}
              onUpdateUser={setCurrentUser}
            />
          </React.Suspense>
        )}
      </div>

      {/* Improved Dynamic Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-10 pb-24 md:pb-10 dir-rtl text-slate-400 text-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-8">

          {/* Copyright & Branding */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl font-black text-slate-100 tracking-tighter">
              {isRtl ? currentMarket.labelAr : currentMarket.labelEn}
            </div>
            <p className="text-xs text-slate-600 font-medium">
              {isRtl ? `أسواق © ${new Date().getFullYear()}` : t('footer.copy', { market: currentMarket.labelEn, year: new Date().getFullYear() })}
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-bold text-slate-300">
            <span
              onClick={() =>
                addToast(
                  t('footer.tos'),
                  t('footer.tosDetail', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn }),
                  "success",
                )
              }
              className="hover:text-emerald-400 cursor-pointer transition-colors tracking-wide"
            >
              {t('footer.tos')}
            </span>
            <span
              onClick={() =>
                addToast(
                  t('footer.privacy'),
                  t('footer.privacyDetail'),
                  "success",
                )
              }
              className="hover:text-emerald-400 cursor-pointer transition-colors tracking-wide"
            >
              {t('footer.privacy')}
            </span>
            <span
              onClick={() =>
                addToast(
                  t('footer.contact'),
                  t('footer.contactDetail', { market: isRtl ? currentMarket.labelAr : currentMarket.labelEn }),
                  "success",
                )
              }
              className="hover:text-emerald-400 cursor-pointer transition-colors tracking-wide"
            >
              {t('footer.contact')}
            </span>
            <span
              onClick={() => setShowHelpCenter(true)}
              className="hover:text-emerald-400 cursor-pointer transition-colors flex items-center gap-1.5 tracking-wide"
            >
              🛡️ {isRtl ? "مركز المساعدة" : "Help Center"}
            </span>
          </nav>
        </div>
      </footer>

      {/* --- Overlay Modals Router --- */}

      {/* Help & Support Center Modal */}
      {showHelpCenter && (
        <HelpCenter
          onClose={() => setShowHelpCenter(false)}
          isDark={isDark}
          addToast={addToast}
          platformSettings={platformSettings}
        />
      )}

      {/* 1. Global System Admin Panel Modal */}
      {showAdminModal && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
        <React.Suspense fallback={<LazyFallback />}>
          <AdminPanel
            onClose={() => setShowAdminModal(false)}
            ads={ads}
            currentUser={currentUser}
            onAdDeleted={handleAdDeleted}
            onAdStatusChange={handleAdStatusChange}
            onViewAd={(ad) => {
              if (ad.isLive || (ad as any).isPromo) {
                setSelectedSpotlightId(ad.id);
                setShowDiscovery(true);
                setShowAdminModal(false);
              } else {
                setSelectedAd(ad);
              }
            }}
            onViewUser={(user) => {
              setSelectedUserPreview(user);
            }}
            onSettingsSaved={fetchPlatformSettings}
            addToast={addToast}
          />
        </React.Suspense>
      )}

      {/* 2. Ad Detail Modal Overlay */}
      {selectedAd && (
        <AdModal
          ad={selectedAd}
          currentUser={currentUser}
          onClose={() => setSelectedAd(null)}
          onLoginRequest={() => {
            setShowWelcomeFlow(true);
          }}
          onAdStatusChange={handleAdStatusChange}
          onAdUpdated={(updatedAd) => {
            setAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
            setFilteredAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
            setSelectedAd(updatedAd);
          }}
          onReportAd={handleReportAd}
          isAdmin={currentUser?.role === "admin"}
          followedSellers={followedSellers}
          onToggleFollowSeller={toggleFollowSeller}
          onViewUser={(user) => {
            setSelectedUserPreview(user);
            setSelectedAd(null); // Close ad modal to show profile
          }}
          currentMarket={currentMarket}
          isDark={isDark}
          favorites={favorites}
          onLikeToggle={handleLikeToggle}
        />
      )}

      {/* 3. User Profile Preview Modal */}
      {selectedUserPreview && (
        <UserProfileModal 
          user={selectedUserPreview}
          ads={ads}
          promoVideos={promoVideos}
          onClose={() => setSelectedUserPreview(null)}
          onViewAd={(ad) => {
            setSelectedAd(ad);
          }}
          currentUser={currentUser}
          onUpdateProfile={handleUpdateProfile}
          onViewStore={(uid) => {
            const userAds = ads.filter(a => a.userId === uid);
            setFilteredAds(userAds);
            setSelectedUserPreview(null);
            setPlatformMode('marketplace');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onVerifyIdentity={(role) => {
            setTargetUpgradeRole(role);
            setShowIdentityModal(true);
            setSelectedUserPreview(null);
          }}
          addToast={addToast}
        />
      )}

      {/* 4. AI Grounded Search Helper modal */}
      {showAiModal && (
        <AiSearchModal
          onClose={() => setShowAiModal(false)}
          onSelectAdByTitle={handleSelectAdByTitle}
        />
      )}

      {/* 4. Auth Welcome & Onboarding Flow */}
      <AnimatePresence>
        {showWelcomeFlow && (
          <WelcomeFlow
            onClose={() => setShowWelcomeFlow(false)}
            onLogin={handleFlowLogin}
            onRegister={handleFlowRegister}
            currentMarket={currentMarket}
            platformSettings={platformSettings}
            initialStep={welcomeFlowInitialStep}
          />
        )}
      </AnimatePresence>

      {/* 5. Role Switcher Tool Panel */}
      {showRoleSwitcher && currentUser?.role === 'admin' && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:right-auto z-40 p-4 bg-slate-900/95 border border-slate-800 backdrop-blur rounded-2xl shadow-2xl max-w-[calc(100%-2rem)] md:max-w-xs text-right dir-rtl shrink-0">
          <div className="flex items-center justify-between gap-4 mb-2 border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" />
              {t('debug.toolTitle')}
            </span>
            <button
              onClick={() => setShowRoleSwitcher(false)}
              className="text-slate-500 hover:text-white"
              title={t('debug.hide')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-slate-500 leading-normal">
            {t('debug.hint')}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5 justify-end">
            <button
              onClick={() => switchUserRole(2)}
              className={`px-2 py-1 rounded text-[9px] font-bold ${
                currentUser?.id === "user_3"
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t('debug.buyer')}
            </button>
            <button
              onClick={() => switchUserRole(0)}
              className={`px-2 py-1 rounded text-[9px] font-bold ${
                currentUser?.id === "user_1"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t('debug.seller')}
            </button>
            <button
              onClick={() => switchUserRole(3)}
              className={`px-2 py-1 rounded text-[9px] font-bold ${
                currentUser?.id === "user_admin"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t('debug.admin')}
            </button>
          </div>
        </div>
      )}

            {/* 9. Shipment Tracking Modal Overlay */}
      {trackingOrder && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 dir-rtl">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTrackingOrder(null)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex flex-col h-[85vh] sm:h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Navigation className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{t('app.delivery.trackShipment')}</h3>
                    <p className="text-xs text-slate-400">{trackingOrder.title}</p>
                  </div>
               </div>
               <button 
                 onClick={() => setTrackingOrder(null)}
                 className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
               >
                 <X size={20} />
               </button>
            </div>

            {/* Map Container */}
            <div className="flex-grow relative bg-slate-950 overflow-hidden">
              <React.Suspense fallback={<LazyFallback />}>
                <AdMap 
                   ads={[]}
                   selectedCity={trackingOrder.from}
                   onSelectAd={() => {}}
                   center={currentMarket.center}
                   cityCoordinates={currentMarket.cityCoordinates}
                   marketCityIds={[]}
                   deliveryPreview={{
                     pickup: trackingOrder.pickupCoords,
                     delivery: trackingOrder.deliveryCoords
                   }}
                   countryCode={currentMarket.countryCode}
                />
              </React.Suspense>
               
               {/* Map Overlay Info */}
               <div className="absolute top-6 right-6 left-6 z-10 flex flex-col sm:flex-row gap-3 pointer-events-none">
                  <div className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1 shadow-2xl">
                    <span className="text-[10px] text-slate-500 block font-bold mb-1 uppercase tracking-wider">{t('app.delivery.pickup')}</span>
                    <p className="text-xs text-white font-bold">{currentMarket.cityCoordinates[trackingOrder.from]?.ar || trackingOrder.from}</p>
                  </div>
                  <div className="bg-[#0b0f1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1 shadow-2xl">
                    <span className="text-[10px] text-slate-500 block font-bold mb-1 uppercase tracking-wider">{t('app.delivery.delivery')}</span>
                    <p className="text-xs text-white font-bold">{currentMarket.cityCoordinates[trackingOrder.to]?.ar || trackingOrder.to}</p>
                  </div>
               </div>

               {/* Driver Status Pulse Overlay */}
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-auto px-6 py-3 bg-cyan-500 text-slate-950 rounded-full font-black text-xs shadow-2xl flex items-center gap-3 animate-bounce">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-900"></span>
                  </span>
                  {isRtl ? 'السائق في طريقه للمستلم حالياً 🛵⚡' : 'Driver is currently on the way 🛵⚡'}
               </div>
            </div>

            {/* Footer Details */}
            <div className="p-6 bg-slate-950 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
               <div>
                 <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? 'حالة الشحنة' : 'Shipment Status'}</span>
                 <span className="text-xs text-emerald-400 font-black">{isRtl ? 'جاري التوصيل ✅' : 'Out for delivery ✅'}</span>
               </div>
               <div>
                 <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? 'المبلغ المستحق' : 'Amount Due'}</span>
                 <span className="text-xs text-white font-black">{trackingOrder.priceEstimate?.toLocaleString()} {currentMarket.currency}</span>
               </div>
               <div>
                 <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? 'الوزن التقريبي' : 'Approx. Weight'}</span>
                 <span className="text-xs text-white font-black">{trackingOrder.weight} {isRtl ? 'كجم' : 'kg'}</span>
               </div>
               <div className="flex flex-col gap-2">
                 <button 
                   onClick={() => {
                     addToast(isRtl ? "مشاركة موقع السائق" : "Share Driver Location", isRtl ? "جاري تجهيز رابط تتبع مباشر للمشاركة..." : "Preparing live track link for sharing...", "info");
                   }}
                   className="w-full bg-white/10 text-white rounded-xl px-4 py-2.5 text-[10px] font-black hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/10"
                 >
                   <Share2 size={12} />
                   {isRtl ? 'مشاركة التتبع' : 'Share Tracking'}
                 </button>
                 <a 
                   href="tel:+962790000000" 
                   className="w-full bg-cyan-500 text-slate-950 rounded-xl px-4 py-2.5 text-[10px] font-black hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                 >
                   <Phone size={12} />
                   {isRtl ? 'اتصال بالسائق 📞' : 'Call Driver 📞'}
                 </a>
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 11. Driver Rating Modal */}
      {ratingOrder && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 sm:p-6 dir-rtl">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
          >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <div className="relative">
                <div className="absolute inset-0 blur-xl bg-emerald-500 opacity-20 animate-pulse" />
                <CheckCircle size={40} className="relative z-10" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2">
              {isRtl ? 'تم التوصيل بنجاح! 🎉' : 'Delivery Successful! 🎉'}
            </h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {isRtl 
                ? 'شكراً لاستخدامك أسواق. كيف كانت تجربتك مع السائق اليوم؟ تقييمك يساعدنا في تحسين الخدمة.' 
                : 'Thank you for using Aswaq. How was your experience with the driver today? Your rating helps us improve.'}
            </p>

            {/* Driver Profile Mini */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 mb-8 flex items-center gap-4 text-right">
               <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 overflow-hidden">
                 {ratingOrder.driverName ? (
                    <div className="w-full h-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-black text-lg">
                      {ratingOrder.driverName.charAt(0)}
                    </div>
                 ) : <UserIcon size={24} />}
               </div>
               <div className="flex-grow">
                 <span className="text-[10px] text-slate-500 block font-bold mb-0.5">{isRtl ? 'السائق المسؤول' : 'Assigned Driver'}</span>
                 <p className="text-sm text-white font-black">{ratingOrder.driverName || (isRtl ? 'سائق أسواق' : 'Aswaq Driver')}</p>
               </div>
            </div>

            {/* Star Rating Section */}
            <div className="flex items-center justify-center gap-3 mb-8">
               {[1, 2, 3, 4, 5].map((star) => (
                 <button
                   key={star}
                   onClick={() => setRatingStars(star)}
                   onMouseEnter={() => setRatingStars(star)}
                   className="group relative transition-transform hover:scale-125"
                 >
                   <Star 
                     size={36} 
                     className={`transition-all duration-300 ${
                       star <= ratingStars 
                         ? 'fill-orange-400 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]' 
                         : 'text-slate-700 hover:text-slate-500'
                     }`} 
                   />
                 </button>
               ))}
            </div>

            {/* Comment Area */}
            <div className="mb-8">
               <textarea 
                 value={ratingComment}
                 onChange={(e) => setRatingComment(e.target.value)}
                 placeholder={isRtl ? 'أضف تعليقاً حول الخدمة (اختياري)...' : 'Add a comment about the service (optional)...'}
                 className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/30 transition-all resize-none h-24"
               />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (ratingStars === 0) {
                    addToast(isRtl ? "تنبيه ⭐️" : "Alert ⭐️", isRtl ? "من فضلك اختر عدد النجوم للتقييم" : "Please select a star rating", "info");
                    return;
                  }
                  addToast(isRtl ? "شكراً لك! ❤️" : "Thank you! ❤️", isRtl ? "تم إرسال تقييمك بنجاح للمنظومة." : "Your rating has been submitted successfully.", "success");
                  setRatingOrder(null);
                  setRatingStars(0);
                  setRatingComment('');
                }}
                className="w-full py-4 bg-cyan-500 text-slate-950 font-black rounded-2xl hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 group"
              >
                {isRtl ? 'إرسال التقييم' : 'Submit Rating'}
                <Send size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => {
                  setRatingOrder(null);
                  setRatingStars(0);
                  setRatingComment('');
                }}
                className="w-full py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                {isRtl ? 'تخطي' : 'Skip'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* 10. Stunning Mobile Sticky Bottom Navigation */}
      {!showWelcomeFlow && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[2000] pb-safe px-3 pt-2 md:hidden pointer-events-none">
          <div className="bg-[#0b0f1a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-1.5 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto h-[72px] mb-2 relative overflow-visible">
            
            {/* Marketplace */}
            <button
              onClick={() => {
                setPlatformMode("marketplace");
                handleTabChange("home");
                setActiveTab("all");
                setViewMode("split");
              }}
              className={`flex flex-col items-center justify-center w-[20%] h-full transition-all duration-300 relative ${
                platformMode === "marketplace" && currentTab === "home" && viewMode !== "map"
                  ? "text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Home className={`w-[22px] h-[22px] mb-1.5 transition-transform duration-300 ${platformMode === "marketplace" && currentTab === "home" && viewMode !== "map" ? "scale-110" : ""}`} />
              <span className="text-[10px] font-bold tracking-tight">{t('nav.home')}</span>
              {platformMode === "marketplace" && currentTab === "home" && viewMode !== "map" && (
                <div className="absolute -top-1.5 w-8 h-1 rounded-b-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              )}
            </button>

            {/* Reels */}
            <button
              onClick={() => setPlatformMode("reels")}
              className={`flex flex-col items-center justify-center w-[20%] h-full transition-all duration-300 relative ${
                platformMode === "reels"
                  ? "text-rose-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Film className={`w-[22px] h-[22px] mb-1.5 transition-transform duration-300 ${platformMode === "reels" ? "scale-110" : ""}`} />
              <span className="text-[10px] font-bold tracking-tight">{t('nav.reels')}</span>
              {platformMode === "reels" && (
                <div className="absolute -top-1.5 w-8 h-1 rounded-b-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]" />
              )}
            </button>

            {/* Add (Center Floating) */}
            <div className="w-[20%] h-full flex justify-center -mt-10 relative z-50">
              <button
                onClick={() => handleTabChange("create-ad")}
                className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 rounded-full shadow-[0_8px_25px_rgba(16,185,129,0.5)] flex items-center justify-center active:scale-95 transition-all border-[4px] border-[#0b0f1a] cursor-pointer"
              >
                <Plus className="w-6 h-6 stroke-[3.5]" />
              </button>
            </div>

            {/* Map (الخريطة) */}
            <button
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.triggerLocation();
                }
                handleTabChange("home");
                setViewMode("map");
              }}
              className={`flex flex-col items-center justify-center w-[20%] h-full transition-all duration-300 relative ${
                currentTab === "home" && viewMode === "map"
                  ? "text-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Map className={`w-[22px] h-[22px] mb-1.5 transition-transform duration-300 ${currentTab === "home" && viewMode === "map" ? "scale-110" : ""}`} />
              <span className="text-[10px] font-bold tracking-tight">{t('nav.map')}</span>
              {currentTab === "home" && viewMode === "map" && (
                <div className="absolute -top-1.5 w-8 h-1 rounded-b-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              )}
            </button>

            {/* Chats */}
            <button
              onClick={() => handleTabChange("messages")}
              className={`flex flex-col items-center justify-center w-[20%] h-full transition-all duration-300 relative ${
                currentTab === "messages"
                  ? "text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <div className="relative">
                 <MessageSquare className={`w-[22px] h-[22px] mb-1.5 transition-transform duration-300 ${currentTab === "messages" ? "scale-110" : ""}`} />
                 {unreadMessages.length > 0 && (
                   <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0b0f1a]">
                     {unreadMessages.length > 9 ? '+9' : unreadMessages.length}
                   </span>
                 )}
              </div>
              <span className="text-[10px] font-bold tracking-tight">{t('nav.messages')}</span>
              {currentTab === "messages" && (
                <div className="absolute -top-1.5 w-8 h-1 rounded-b-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Map Picker Overlay (Moved to root level for correct stacking context) */}
      {platformMode === "delivery" && isPickingLocation && (
        <LocationMapPicker
          pickupCoords={pickupCoords}
          deliveryCoords={deliveryCoords}
          onSetPickup={(lat, lng) => setPickupCoords({ lat, lng })}
          onSetDelivery={(lat, lng) => setDeliveryCoords({ lat, lng })}
          center={
            isPickingLocation === 'pickup' 
              ? (currentMarket.cityCoordinates[shipFrom] || currentMarket.center)
              : (currentMarket.cityCoordinates[shipTo] || currentMarket.center)
          }
          mode={isPickingLocation}
          onClose={() => setIsPickingLocation(null)}
        />
      )}
      <AnimatePresence>
        {(showDiscovery || platformMode === 'reels') && (
          <React.Suspense fallback={<LazyFallback />}>
            <SpotlightFeed 
              ads={(() => {
                const countryAds = ads.filter(ad => getCountryFromCity(ad.city) === currentMarket.countryCode);
                if (selectedSpotlightId && !countryAds.some(a => a.id === selectedSpotlightId)) {
                  const targetAd = ads.find(a => a.id === selectedSpotlightId);
                  if (targetAd) return [targetAd, ...countryAds];
                }
                return countryAds;
              })()}
              initialAdId={selectedSpotlightId}
              onSelectAd={(ad) => {
                setSelectedAd(ad);
                setShowDiscovery(false);
                setSelectedSpotlightId(undefined);
                setPlatformMode('marketplace');
              }} 
              onSelectUser={(user) => {
                setSelectedUserPreview(user);
                setShowDiscovery(false);
                setSelectedSpotlightId(undefined);
                setPlatformMode('marketplace');
              }}
              onClose={() => {
                setShowDiscovery(false);
                setSelectedSpotlightId(undefined);
                setPlatformMode('marketplace');
              }}
              countryCode={currentMarket.countryCode}
              currentUser={currentUser}
              onLoginRequest={() => {
                setShowDiscovery(false);
                triggerLoginFlow('splash');
              }}
              onAdUpdated={(updatedAd) => {
                setAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
                setFilteredAds((prev) => prev.map((a) => (a.id === updatedAd.id ? updatedAd : a)));
              }}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
      {/* Global Post Deletion Confirmation Dialog */}
      <AnimatePresence>

        {showIdentityModal && (
          <IdentityVerificationModal
            isOpen={showIdentityModal}
            onClose={() => setShowIdentityModal(false)}
            onSuccess={handleIdentityVerifyFinish}
            isDark={isDark}
            targetRole={targetUpgradeRole}
          />
        )}
        {showAdOtp && pendingAd && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl dir-rtl">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative">
              <button 
                onClick={() => {
                  setShowAdOtp(false);
                  setPendingAd(null);
                }}
                className="absolute top-6 left-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
              <div className="text-center mb-6">
                <h3 className="text-xl font-black text-white">التحقق الهاتفي الأول</h3>
                <p className="text-xs text-slate-400 mt-2">طلبك لنشر أول إعلان يتطلب تأكيد رقم هاتفك أولاً.</p>
              </div>
              <OtpVerification 
                phoneNumber={pendingAd.contactNumber}
                onVerify={() => {
                  if (pendingAd && currentUser) {
                     const adToPost = { ...pendingAd, userVerified: true };
                     setAds((prev) => [adToPost, ...prev]);
                     setFilteredAds((prev) => [adToPost, ...prev]);
                     
                     setCurrentUser({ ...currentUser, phoneVerified: true, hasPostedAd: true });
                     setShowAdOtp(false);
                     setPendingAd(null);
                     
                     addToast(
                       isRtl ? "تم التحقق ونشر الإعلان" : "Verified and Posted",
                       isRtl ? "تم تأكيد رقمك ونشر إعلانك الأول بنجاح." : "Your number is verified and your first ad is posted.",
                       "success"
                     );
                  }
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
      {postToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl dir-rtl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-right p-8 relative animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setPostToDelete(null)}
              className="absolute top-6 left-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-4 mt-2">
              <div className="inline-flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full p-5 mb-6">
                <Trash2 className="w-10 h-10 font-bold" />
              </div>

              <h3 className="text-xl font-black text-white">
                حذف المنشور التجاري
              </h3>
              <p className="text-xs text-slate-400 mt-3 font-sans leading-relaxed">
                هل أنت متأكد من رغبتم في حذف هذا المنشور بشكل نهائي؟ سيتم مسح كافة التفاعلات والتعليقات المرتبطة به.
              </p>
            </div>

            <div className="flex gap-4 font-sans mt-4">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="flex-1 h-14 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (postToDelete) {
                    handleDeleteSocialPost(postToDelete);
                    setPostToDelete(null);
                  }
                }}
                className="flex-[2] h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-2xl shadow-rose-900/40 cursor-pointer active:scale-95"
              >
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster position="bottom-center" />
    </div>
  );
}
