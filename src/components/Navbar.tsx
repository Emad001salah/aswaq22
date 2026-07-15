/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MARKETS, Market } from '../markets.ts';
import { User, AppNotification } from '../types.ts';
import { Avatar } from './Avatar.tsx';
import { 
  Plus, 
  MessageSquare, 
  Bell, 
  Heart, 
  User as UserIcon, 
  LogOut, 
  LogIn, 
  ShieldAlert,
  Search,
  CheckCircle2,
  Menu,
  X,
  Sliders,
  Sun,
  Moon,
  Globe,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  notifications: AppNotification[];
  onOpenDashboard: (section: string) => void;
  onOpenAdminPanel: () => void;
  onOpenAiAssistant: () => void;
  onViewProfile: (user: User) => void;
  onLogout: () => void;
  onLoginClick: () => void;
  onNotificationClick: () => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onSwitchUserRole?: (userIndex: number) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  currentMarket: Market;
  onMarketChange: (market: Market) => void;
  platformMode: 'marketplace' | 'delivery' | 'social' | 'reels';
  onPlatformModeChange: (mode: 'marketplace' | 'delivery' | 'social' | 'reels') => void;
  platformSettings?: {
    commission: number;
    featuredPrice: number;
    appName: string;
    logoLetter: string;
    maintenanceMode: boolean;
    pushNotifications: boolean;
    logoUrl?: string;
  };
}

export default function Navbar({
  currentUser,
  unreadMessagesCount,
  unreadNotificationsCount,
  notifications,
  onOpenDashboard,
  onOpenAdminPanel,
  onOpenAiAssistant,
  onViewProfile,
  onLogout,
  onLoginClick,
  onNotificationClick,
  favoritesCount,
  onOpenFavorites,
  onSwitchUserRole,
  isDark,
  onToggleTheme,
  currentMarket,
  onMarketChange,
  platformMode,
  onPlatformModeChange,
  platformSettings
}: NavbarProps) {
  const { t, i18n } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showMarketMenu, setShowMarketMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    if (mobileMenuOpen) {
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
  }, [mobileMenuOpen]);

  const isRtl = i18n.language === 'ar';

  return (
    <nav className={`sticky top-0 z-[2000] pt-safe border-b transition-all duration-300 ${isDark ? 'glass-dark border-slate-800/85' : 'glass-light border-slate-200'} ${isRtl ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-6">
            <span 
              onClick={() => onOpenDashboard('home')}
              className="flex items-center gap-3 cursor-pointer group"
              id="nav-logo"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/25 group-hover:scale-110 group-hover:shadow-emerald-500/40 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-amber-400/20 to-transparent" />
                {platformSettings?.logoUrl ? (
                  <img src={platformSettings.logoUrl} alt="Logo" className="w-full h-full object-cover relative z-10" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-white font-black text-2xl relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] font-sans">
                     {platformSettings?.logoLetter || (isRtl ? currentMarket.labelAr[0] : currentMarket.labelEn[0])}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-black text-sm lg:text-xl tracking-tight transition-colors border-none p-0 bg-transparent flex items-center gap-1 lg:gap-1.5`}>
                  {platformSettings?.appName ? (
                    platformSettings.appName === 'أسواق' ? (
                      <span className="flex items-center gap-2">
                        <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 bg-clip-text text-transparent font-black tracking-wide text-2xl drop-shadow-[0_0_12px_rgba(16,185,129,0.15)] select-none">
                          أَسْوَاق
                        </span>
                      </span>
                    ) : (
                      <span>{platformSettings.appName}</span>
                    )
                  ) : (
                    <>أسواق</>
                  )}
                </span>
                <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold font-mono tracking-widest uppercase">
                  {currentMarket.labelEn}
                </span>
              </div>
            </span>

            {/* Smart Platform Switcher (Unified Context) */}
              <div className={`hidden md:flex items-center p-1 rounded-2xl border ml-2 xl:ml-4 transition-colors ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-100 border-slate-200'}`}>
                {[
                  { id: 'marketplace', label: t('navbar.home'), icon: '🛍️', color: 'bg-emerald-500' },
                  { id: 'delivery', label: t('navbar.delivery'), icon: '🚚', color: 'bg-cyan-500' },
                  { id: 'reels', label: t('navbar.reels'), icon: '🎬', color: 'bg-rose-500' },
                  { id: 'social', label: t('navbar.social'), icon: '👥', color: 'bg-fuchsia-500' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onPlatformModeChange(item.id as any)}
                    className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-4 py-1.5 rounded-xl text-[10px] lg:text-[11px] font-bold transition-all duration-300 ${
                      platformMode === item.id 
                        ? `${item.color} text-white shadow-lg` 
                        : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-950"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                ))}
              </div>

            {/* Market Switcher */}
            <div className="relative hidden md:block">
              <button 
                onClick={() => setShowMarketMenu(!showMarketMenu)}
                className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 transition-all font-bold text-[10px] lg:text-xs"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isRtl ? currentMarket.labelAr : currentMarket.labelEn}</span>
              </button>
              
              {showMarketMenu && (
                <div className={`absolute top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 overflow-y-auto max-h-[70vh] no-scrollbar ${isRtl ? 'right-0 text-right' : 'left-0 text-left'}`}>
                  {Object.values(MARKETS).map((market) => (
                    <button
                      key={market.id}
                      onClick={() => {
                        onMarketChange(market);
                        setShowMarketMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-xs font-bold transition-colors ${isRtl ? 'text-right' : 'text-left'} ${currentMarket.id === market.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      {isRtl ? `${market.labelAr} (${market.labelEn})` : `${market.labelEn} (${market.labelAr})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Controls & Navigation Buttons */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-3 xl:gap-4">
            
            {/* Language Switcher Button */}
            <button
              onClick={() => {
                const newLang = i18n.language === 'ar' ? 'en' : 'ar';
                i18n.changeLanguage(newLang);
                localStorage.setItem('app_language', newLang);
                const toRtl = newLang === 'ar';
                document.documentElement.dir = toRtl ? 'rtl' : 'ltr';
                document.documentElement.lang = newLang;
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[10px] xl:text-xs font-black font-sans hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 lg:gap-1.5 transition-all cursor-pointer"
              title={t('common.otherLanguage')}
              id="lang-switcher-btn"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('common.otherLanguage')}</span>
              <span className="lg:hidden">{i18n.language === 'ar' ? 'EN' : 'AR'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 lg:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title={isDark ? "Theme toggle" : "Theme toggle"}
            >
              {isDark ? <Sun className="w-4 h-4 lg:w-5 lg:h-5" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5" />}
            </button>

            {/* Create Ad Button - OpenSooq Yellow */}
            <button
              onClick={() => onOpenDashboard('create-ad')}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs xl:text-sm px-4 xl:px-6 py-2.5 rounded-xl shadow-md shadow-amber-400/20 transition-all cursor-pointer shrink-0"
              id="nav-btn-create"
            >
              <Plus className="w-4 h-4 xl:w-5 xl:h-5 stroke-[2.5]" />
              <span className="hidden md:inline">{t('navbar.addAd')}</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                
                {/* Favorites button */}
                <button 
                  onClick={onOpenFavorites}
                  className="p-1.5 lg:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-all relative cursor-pointer"
                  title={t('navbar.favs')}
                  id="nav-btn-favs"
                >
                  <Heart className="w-4 h-4 lg:w-5 lg:h-5" />
                  {favoritesCount > 0 && (
                    <span className="absolute 0 top-0 right-0 bg-red-500 text-white font-black text-[10px] w-4 h-4 lg:w-5 lg:h-5 rounded-full flex items-center justify-center animate-bounce">
                      {favoritesCount}
                    </span>
                  )}
                </button>

                {/* Messages button */}
                <button 
                  onClick={() => onOpenDashboard('messages')}
                  className="p-1.5 lg:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-all relative cursor-pointer"
                  title={t('navbar.chats')}
                  id="nav-btn-chat"
                >
                  <MessageSquare className="w-4 h-4 lg:w-5 lg:h-5" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute 0 top-0 right-0 bg-red-500 text-white font-black text-[10px] w-4 h-4 lg:w-5 lg:h-5 rounded-full flex items-center justify-center">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>

                {/* Notifications button */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowNotificationsDropdown(!showNotificationsDropdown);
                      setShowUserMenu(false);
                      onNotificationClick();
                    }}
                    className="p-1.5 lg:p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-all relative cursor-pointer"
                    title={t('navbar.notifications')}
                    id="nav-btn-notifs"
                  >
                    <Bell className="w-4 h-4 lg:w-5 lg:h-5" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute 0 top-0 right-0 bg-red-500 text-white font-black text-[10px] w-4 h-4 lg:w-5 lg:h-5 rounded-full flex items-center justify-center">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>

                  {showNotificationsDropdown && (
                    <div className={`absolute mt-3 w-80 rounded-2xl shadow-2xl overflow-hidden py-1 z-50 border transition-all duration-300 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 ${isRtl ? 'left-0' : 'right-0'}`}>
                      <div className={`px-4 py-3 border-b flex justify-between items-center bg-slate-50 border-slate-100 dark:bg-slate-900 dark:border-slate-800 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{t('navbar.notifications')}</span>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{t('navbar.latest')}</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            {t('navbar.noNotifications')}
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              className={`px-4 py-3 border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3 border-slate-50 dark:border-slate-800/40 ${isRtl ? 'text-right' : 'text-left'} ${!notif.read ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : ''}`}
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white">{notif.title}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{notif.description}</p>
                                <span className="text-[8px] text-slate-400 block mt-1">
                                  {new Date(notif.timestamp).toLocaleTimeString(isRtl ? 'ar-YE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Vertical Separator */}
                <div className="h-6 w-px bg-slate-200 mx-1" />

                {/* User Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowUserMenu(!showUserMenu);
                      setShowNotificationsDropdown(false);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 border border-transparent transition-all cursor-pointer"
                    id="nav-user-dropdown-btn"
                  >
                    <Avatar 
                      src={currentUser.avatar} 
                      name={currentUser.name} 
                      sizeClassName="w-8 h-8"
                      className="rounded-full border border-slate-200"
                    />
                    <div className={`hidden lg:block pl-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <p className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {currentUser.name}
                        {currentUser.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </p>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className={`absolute mt-3 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 ${isRtl ? 'left-0' : 'right-0'}`}>
                      <div className={`px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <p className="text-xs text-slate-500">{t('navbar.welcome')}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                      </div>

                      <button 
                        onClick={() => {
                          onViewProfile(currentUser);
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/50 font-bold ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {isRtl ? 'ملفي الشخصي (إعلاناتي)' : 'My Profile (My Ads)'}
                      </button>

                      <button 
                        onClick={() => {
                          onOpenDashboard('my-ads');
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 transition-colors cursor-pointer ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {t('navbar.myAds')}
                      </button>

                      <button 
                        onClick={() => {
                          onOpenDashboard('messages');
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 transition-colors flex justify-between items-center cursor-pointer ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}
                      >
                        <span>{t('navbar.chats')}</span>
                        {unreadMessagesCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{unreadMessagesCount}</span>}
                      </button>

                      <button 
                        onClick={() => {
                          onOpenDashboard('analytics');
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 transition-colors cursor-pointer ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {t('navbar.analytics')}
                      </button>

                      <button 
                        onClick={() => {
                          onOpenDashboard('settings');
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 transition-colors cursor-pointer ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {t('navbar.settings')}
                      </button>

                      {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                        <button 
                          onClick={() => {
                            onOpenAdminPanel();
                            setShowUserMenu(false);
                          }}
                          className={`w-full px-4 py-2.5 text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 cursor-pointer font-bold ${isRtl ? 'text-right' : 'text-left'}`}
                        >
                          <ShieldAlert className="w-4 h-4" />
                          {t('navbar.adminPanel')}
                        </button>
                      )}

                      <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pointer-events-none" />

                      <button 
                        onClick={() => {
                          onLogout();
                          setShowUserMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2 font-bold cursor-pointer ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        <LogOut className="w-4 h-4" />
                        {t('navbar.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-bold text-sm px-4 cursor-pointer"
                id="nav-btn-login"
              >
                {t('navbar.login')}
              </button>
            )}
          </div>

          {/* Mobile Menu Icon */}
          <div className="md:hidden flex items-center gap-2 sm:gap-3">
             {/* Quick Language Toggle on Mobile */}
            <button
              onClick={() => {
                const newLang = i18n.language === 'ar' ? 'en' : 'ar';
                i18n.changeLanguage(newLang);
                localStorage.setItem('app_language', newLang);
                const toRtl = newLang === 'ar';
                document.documentElement.dir = toRtl ? 'rtl' : 'ltr';
                document.documentElement.lang = newLang;
              }}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              title={t('common.otherLanguage')}
              id="mobile-lang-switcher-btn"
            >
              <Globe className="w-5 h-5 animate-pulse" />
            </button>

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-all dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={onOpenAiAssistant}
              className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"
              title={t('navbar.chatbot')}
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-all"
              id="nav-btn-mobile-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

        {/* Mobile Drawer menu */}
        {mobileMenuOpen && (
          <div className={`md:hidden fixed top-20 left-0 right-0 bottom-0 h-[calc(100vh-80px)] h-[calc(100dvh-80px)] overflow-y-auto overscroll-contain py-4 px-4 space-y-3 shadow-inner pb-28 z-[3000] border-t ${isDark ? 'bg-slate-950/98 backdrop-blur-md border-slate-800' : 'bg-slate-50/98 backdrop-blur-md border-slate-200'} ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className={`pb-3 mb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
               <p className="text-xs font-bold text-slate-500 mb-2 px-3">{t('navbar.smartPlatform')}</p>
               <div className="grid grid-cols-2 gap-2">
                 {[
                   { id: 'marketplace', label: t('navbar.home'), icon: '🛍️', color: 'bg-emerald-500' },
                   { id: 'delivery', label: t('navbar.delivery'), icon: '🚚', color: 'bg-cyan-500' },
                   { id: 'reels', label: t('navbar.reels'), icon: '🎬', color: 'bg-rose-500' },
                   { id: 'social', label: t('navbar.social'), icon: '👥', color: 'bg-fuchsia-500' }
                 ].map((item) => (
                   <button
                     key={item.id}
                     onClick={() => {
                       onPlatformModeChange(item.id as any);
                       setMobileMenuOpen(false);
                     }}
                     className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                       platformMode === item.id 
                         ? `${item.color} text-white shadow-md` 
                         : `bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border ${isDark ? 'border-slate-800' : 'border-slate-200'}`
                     }`}
                   >
                     <span>{item.icon}</span>
                     <span>{item.label}</span>
                   </button>
                 ))}
               </div>
            </div>

            <div className={`pb-3 mb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <p className="text-xs font-bold text-slate-500 mb-2 px-3">{t('navbar.countryMarket')}</p>
              <div className="px-3 relative">
                <select
                  value={currentMarket.id}
                  onChange={(e) => {
                    const market = Object.values(MARKETS).find(m => m.id === e.target.value);
                    if (market) onMarketChange(market);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-3 pl-8 pr-4 rounded-xl border text-sm font-bold outline-none cursor-pointer appearance-none ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'
                  }`}
                  style={{ textAlign: isRtl ? 'right' : 'left', direction: isRtl ? 'rtl' : 'ltr' }}
                >
                  {Object.values(MARKETS).map((market) => (
                    <option key={market.id} value={market.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                      {isRtl ? market.labelAr : market.labelEn}
                    </option>
                  ))}
                </select>
                <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRtl ? 'left-6' : 'right-6'}`}>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                onOpenAiAssistant();
                setMobileMenuOpen(false);
              }} 
              className={`w-full flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'} ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('navbar.chatbot')}</span>
            </button>

            <button 
              onClick={() => {
                onOpenDashboard('create-ad');
                setMobileMenuOpen(false);
              }} 
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-400 hover:bg-amber-500 rounded-xl font-bold text-slate-900 text-sm shadow-md shadow-amber-400/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              {t('navbar.addAd')}
            </button>

            {currentUser ? (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1">
                <div className={`flex items-center gap-2 px-3 py-2 mb-2 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                  <Avatar src={currentUser.avatar} name={currentUser.name} sizeClassName="w-8 h-8" className="rounded-full border border-slate-200 dark:border-slate-850" />
                  <div className={`flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500">{isRtl ? 'مستخدم موثق' : 'Verified User'}</p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    onViewProfile(currentUser);
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-emerald-600 flex items-center gap-2 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                >
                  <UserIcon className="w-4 h-4" />
                  {isRtl ? 'ملفي الشخصي' : 'My Profile'}
                </button>

                <button 
                  onClick={() => {
                    onOpenDashboard('my-ads');
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                >
                  <Plus className="w-4 h-4 text-emerald-500" />
                  {t('navbar.myAds')}
                </button>

                <button 
                  onClick={() => {
                    onOpenDashboard('messages');
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between cursor-pointer ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  <span className={`flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    {t('navbar.chats')}
                  </span>
                  {unreadMessagesCount > 0 && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">{unreadMessagesCount}</span>}
                </button>

                <button 
                  onClick={() => {
                    onOpenDashboard('analytics');
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                >
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  {t('navbar.analytics')}
                </button>

                <button 
                  onClick={() => {
                    onOpenDashboard('settings');
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                >
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  {t('navbar.settings')}
                </button>

                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <button 
                    onClick={() => {
                      onOpenAdminPanel();
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-bold text-red-650 dark:text-red-405 flex items-center gap-2 transition-colors text-red-600 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                  >
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    {t('navbar.adminPanel')}
                  </button>
                )}

                <hr className="border-slate-200 dark:border-slate-805/50 my-1" />

                <button 
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }} 
                  className={`w-full py-2 px-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg text-xs font-semibold text-red-600 flex items-center gap-2 cursor-pointer ${isRtl ? 'text-right justify-start' : 'text-left justify-start'}`}
                >
                  <LogOut className="w-4 h-4" />
                  {t('navbar.logout')}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  onLoginClick();
                  setMobileMenuOpen(false);
                }} 
                className="w-full py-2.5 rounded-xl border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold text-center text-sm cursor-pointer"
              >
                {t('navbar.unregisteredUser')}
              </button>
            )}
          </div>
      )}
    </nav>
  );
}
