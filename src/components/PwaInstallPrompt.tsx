'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  X, 
  Smartphone, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  ChevronRight, 
  Info 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveMediaUrl } from '../lib/config.ts';

interface PwaInstallPromptProps {
  isDark: boolean;
  isRtl: boolean;
  logoUrl?: string;
}

export default function PwaInstallPrompt({ isDark, isRtl, logoUrl }: PwaInstallPromptProps) {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installStep, setInstallStep] = useState<'intro' | 'guide'>('intro');

  const displayLogo = logoUrl ? resolveMediaUrl(logoUrl) : null;

  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Detect Mobile/Tablet devices only
    const checkMobile = () => {
      const userAgent = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
      const mobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 1024;
      const isTouchMobile = mobileUA || isSmallScreen;
      setIsMobileDevice(isTouchMobile);
      return isTouchMobile;
    };

    const isMobile = checkMobile();

    // Check if the app is already running in standalone (installed) mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
        || (navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsStandalone(!!isStandaloneMode);
      return !!isStandaloneMode;
    };

    if (!isMobile || checkStandalone()) {
      return;
    }

    // Detect iOS devices
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleIOS = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isAppleIOS);
      return isAppleIOS;
    };
    
    detectIOS();

    // Capture standard PWA installation event (Chrome/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Delay showing the prompt slightly for clean UX
      const hasDismissed = localStorage.getItem('aswaq_pwa_dismissed');
      if (!hasDismissed) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If it's iOS/Android Mobile and not standalone, show prompt to mobile users after delay
    const hasDismissed = localStorage.getItem('aswaq_pwa_dismissed');
    if (!hasDismissed) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setInstallStep('guide');
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA Install] User choice outcome: ${outcome}`);
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } else {
      // Direct guide for generic installation
      setInstallStep('guide');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days so we don't annoy the user
    localStorage.setItem('aswaq_pwa_dismissed', 'true');
  };

  // If Desktop PC, already installed, or shouldn't show, render nothing
  if (!isMobileDevice || isStandalone || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-x-0 bottom-[72px] sm:bottom-20 md:bottom-4 md:right-4 md:left-auto md:max-w-md z-[1000] p-4 pointer-events-none">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`pointer-events-auto w-full p-5 rounded-2xl shadow-2xl relative border overflow-hidden ${
            isDark 
              ? 'bg-slate-950/95 border-slate-800 text-white backdrop-blur-xl' 
              : 'bg-white/95 border-slate-100 text-slate-900 backdrop-blur-xl'
          }`}
          id="pwa-install-dialog"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -z-10" />

          {/* Close trigger */}
          <button
            onClick={handleDismiss}
            className={`absolute top-3 left-3 p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
            id="close-pwa-trigger"
          >
            <X className="w-4 h-4" />
          </button>

          {installStep === 'intro' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-emerald-500/20 shrink-0 bg-slate-900 flex items-center justify-center">
                  {displayLogo ? (
                    <img src={displayLogo} alt="App Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone className="w-6 h-6 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-sm font-black flex items-center gap-1.5 text-emerald-500">
                    <Smartphone className="w-3.5 h-3.5" />
                    {isRtl ? 'تحميل تطبيق أسواق' : 'Download Aswaq App'}
                  </h3>
                  <h4 className="text-xs font-bold mt-0.5">
                    {isRtl ? 'تثبيت المنصة كتطبيق هاتف ذكي!' : 'Install Aswaq on your device!'}
                  </h4>
                  <p className={`text-[11px] leading-relaxed mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isRtl 
                      ? 'تمتع بتجربة تصفح سريعة وآمنة، تواصل فوري عبر الإشعارات، وتوفير هائل في بيانات الإنترنت.'
                      : 'Enjoy faster search speed, native push notifications, and data savings with our premium mobile app.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  id="pwa-install-action"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRtl ? 'تثبيت التطبيق على الهاتف الآن' : 'Install App on Device Now'}</span>
                </button>
                
                <button
                  onClick={handleDismiss}
                  className={`px-3 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isDark 
                      ? 'border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white' 
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  id="pwa-cancel-action"
                >
                  {isRtl ? 'لاحقاً' : 'Later'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-emerald-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {isRtl ? 'طريقة تثبيت تطبيق أسواق' : 'How to install Aswaq'}
                </h3>
                <button 
                  onClick={() => setInstallStep('intro')}
                  className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:underline ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                  id="pwa-back-to-intro"
                >
                  <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                  {isRtl ? 'رجوع' : 'Back'}
                </button>
              </div>

              {isIOS ? (
                // iOS installation steps instructions (Safari)
                <div className="flex flex-col gap-3.5 my-1">
                  <p className={`text-[10px] leading-relaxed text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isRtl 
                      ? 'خطوات التثبيت لجميع هواتف الآيفون (iOS)' 
                      : 'Steps to install on any iPhone device (iOS)'}
                  </p>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                      }`}>
                        1
                      </div>
                      <p className="text-[11px] leading-relaxed flex items-center gap-1.5 flex-1 select-none">
                        <span>{isRtl ? 'انقر على زر المشاركة' : 'Tap the Share button'}</span>
                        <Share className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>{isRtl ? 'في متصفح سفاري.' : 'in Safari browser.'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'
                      }`}>
                        2
                      </div>
                      <p className="text-[11px] leading-relaxed flex items-center gap-1.5 flex-1 select-none">
                        <span>{isRtl ? 'اختر' : 'Choose'}</span>
                        <span className="font-extrabold text-emerald-500 flex items-center gap-1">
                          <PlusSquare className="w-4 h-4 inline" />
                          {isRtl ? 'إضافة للشاشة الرئيسية' : 'Add to Home Screen'}
                        </span>
                        <span>{isRtl ? 'من القائمة.' : '.'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Generic/Android steps instructions
                <div className="flex flex-col gap-3 my-1">
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isRtl 
                      ? 'اضغط على زر الخيارات (النقاط الثلاث ⋮) في أعلى المتصفح، ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
                      : 'Tap browser options (three dots ⋮) and choose "Install app" or "Add to Home Screen".'}
                  </p>
                </div>
              )}

              <button
                onClick={handleDismiss}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                id="pwa-done-action"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isRtl ? 'موافق، تم التنزيل' : 'Okay, I understand'}</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
