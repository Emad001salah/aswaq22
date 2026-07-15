/**
 * WelcomeFlow – Premium onboarding / auth entry for Aswaq platform
 * Rebuilt from scratch with a professional, animated dark-mode UI.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Zap,
  Users,
  TrendingUp,
  Star,
  ChevronRight,
  X,
  Loader2,
  Phone,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Smartphone,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Market } from '../markets.ts';
import { COUNTRIES } from '../constants/countries.ts';
import { auth } from '../lib/firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { API_BASE_URL, API_ORIGIN } from '../lib/config';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/phoneAuth';

/* ────────────────────────────────────────────────────────────────── */
/*  Types                                                             */
/* ────────────────────────────────────────────────────────────────── */

type AuthMode = 'login' | 'signup';
type FlowStep = 'splash' | 'features' | 'auth';
type PhoneStep = 'input' | 'otp';

interface WelcomeFlowProps {
  onClose: () => void;
  onLogin: (user: any) => void;
  onRegister: (user: any) => void;
  currentMarket: Market;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Animation variants                                                */
/* ────────────────────────────────────────────────────────────────── */

const fadeSlide = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.25 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

/* ────────────────────────────────────────────────────────────────── */
/*  Feature cards data                                                */
/* ────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: ShieldCheck,
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/25',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    title: 'أمان ومصداقية عالية',
    desc: 'تحقق من هوية البائعين والمشترين وضمان الحماية الكاملة للمعاملات التجارية.',
  },
  {
    icon: MapPin,
    color: 'from-blue-500 to-cyan-500',
    glow: 'shadow-blue-500/25',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    title: 'إعلانات تفاعلية بالخريطة',
    desc: 'اكتشف الإعلانات القريبة منك عبر خرائط ذكية تتكيف مع موقعك الجغرافي.',
  },
  {
    icon: Zap,
    color: 'from-yellow-500 to-amber-500',
    glow: 'shadow-yellow-500/25',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    title: 'بحث ذكي بالذكاء الاصطناعي',
    desc: 'محرك بحث يفهم لغتك ويعرض أدق النتائج في أقل من ثانية واحدة.',
  },
  {
    icon: TrendingUp,
    color: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/25',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    title: 'أسعار لحظية ومقارنات',
    desc: 'راقب تحركات الأسعار وتحليل السوق لاتخاذ أفضل القرارات التجارية.',
  },
  {
    icon: Users,
    color: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/25',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    title: 'مجتمع تجاري نشط',
    desc: 'أكثر من 50,000 بائع وتاجر يثقون بأسواق لإدارة أعمالهم يومياً.',
  },
  {
    icon: Star,
    color: 'from-orange-500 to-amber-600',
    glow: 'shadow-orange-500/25',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    title: 'ريلز تسويقية ومميزة',
    desc: 'شاهد وشارك فيديوهات قصيرة لمنتجاتك وترقَّ في نتائج البحث.',
  },
];

const ROLES = [
  { id: 'individual', label: 'فرد / مشتري', emoji: '👤' },
  { id: 'merchant', label: 'تاجر / بائع', emoji: '🏪' },
  { id: 'broker', label: 'وسيط عقاري', emoji: '🏠' },
  { id: 'driver', label: 'سائق / مندوب', emoji: '🚗' },
];

/* ────────────────────────────────────────────────────────────────── */
/*  Tiny reusable sub-components                                      */
/* ────────────────────────────────────────────────────────────────── */

const GlowDot = ({ color }: { color: string }) => (
  <div className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
);

const ProgressDots = ({ steps, current }: { steps: number; current: number }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: steps }).map((_, i) => (
      <div
        key={i}
        className={`rounded-full transition-all duration-500 ${
          i === current
            ? 'w-6 h-2 bg-emerald-500'
            : i < current
            ? 'w-2 h-2 bg-emerald-700'
            : 'w-2 h-2 bg-zinc-800'
        }`}
      />
    ))}
  </div>
);

const InputField = ({
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  dir,
  rightEl,
}: {
  icon: any;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  dir?: 'ltr' | 'rtl';
  rightEl?: React.ReactNode;
}) => (
  <div className="relative group">
    <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors z-10" />
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full bg-slate-950/70 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500/70 rounded-2xl py-4 pr-11 pl-4 text-sm text-white outline-none transition-all font-medium placeholder:text-zinc-600"
    />
    {rightEl && <div className="absolute left-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
  </div>
);

/* ────────────────────────────────────────────────────────────────── */
/*  Step 1: Splash                                                    */
/* ────────────────────────────────────────────────────────────────── */

const SplashStep = ({
  market,
  onNext,
  onClose,
}: {
  market: Market;
  onNext: () => void;
  onClose: () => void;
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const marketName = isRtl ? market.labelAr : market.labelEn;

  return (
    <motion.div key="splash" variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="flex flex-col items-center text-center gap-10 max-w-md w-full">
      {/* Logo bubble */}
      <div className="relative">
        <div className="absolute -inset-8 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none" />
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-36 h-36 rounded-[2.8rem] bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30 flex items-center justify-center"
        >
          <span className="text-6xl font-black text-slate-950 select-none" style={{ fontFamily: 'Georgia, serif' }}>
            أ
          </span>
          {/* Animated ring */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="absolute inset-0 rounded-[2.8rem] border-2 border-emerald-400"
          />
        </motion.div>
      </div>

      {/* Text */}
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tighter">
          مرحباً في{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
            أسواق
          </span>
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed max-w-xs mx-auto">
          المنصة التجارية الأذكى في المنطقة — بيع واشترِ بسرعة وأمان لا مثيل لهما.
        </p>
      </div>

      {/* Stats bar */}
      <div className="w-full grid grid-cols-3 gap-3">
        {[
          { value: '+50K', label: 'مستخدم نشط' },
          { value: '+200K', label: 'إعلان منشور' },
          { value: '4.9★', label: 'تقييم المتجر' },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl py-3 px-2 text-center">
            <div className="text-lg font-black text-white">{s.value}</div>
            <div className="text-[9px] text-zinc-500 mt-0.5 font-bold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="w-full space-y-3">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-5 rounded-[1.75rem] bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-lg shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all"
        >
          ابدأ رحلتك معنا
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <button
          onClick={onClose}
          className="w-full py-3 text-zinc-600 hover:text-zinc-400 text-sm font-bold transition-colors"
        >
          تصفح كزائر
        </button>
      </div>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Step 2: Features carousel                                         */
/* ────────────────────────────────────────────────────────────────── */

const FeaturesStep = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => {
  const [active, setActive] = useState(0);
  const feat = FEATURES[active];
  const Icon = feat.icon;

  return (
    <motion.div key="features" variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="max-w-lg w-full flex flex-col gap-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white">لماذا أسواق؟</h2>
        <p className="text-zinc-500 text-sm">اكتشف ما يجعلنا المنصة الأولى</p>
      </div>

      {/* Feature card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          className={`bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl ${feat.glow}`}
        >
          <div className={`w-16 h-16 ${feat.bg} rounded-[1.2rem] flex items-center justify-center mb-6`}>
            <Icon className={`w-8 h-8 ${feat.text}`} />
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${feat.color} bg-opacity-10 mb-4`}>
            <span className="text-[9px] font-black text-white uppercase tracking-widest">ميزة مميزة</span>
          </div>
          <h3 className="text-xl font-black text-white mb-3">{feat.title}</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{feat.desc}</p>
        </motion.div>
      </AnimatePresence>

      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-2">
        {FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`rounded-full transition-all duration-300 ${
              i === active ? 'w-6 h-2 bg-emerald-500' : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-600'
            }`}
          />
        ))}
      </div>

      {/* Arrows navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex flex-1 gap-3">
          {active < FEATURES.length - 1 ? (
            <button
              onClick={() => setActive((a) => Math.min(a + 1, FEATURES.length - 1))}
              className="flex-1 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-sm hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
            >
              التالي <ArrowLeft className="w-4 h-4" />
            </button>
          ) : null}
          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/15 flex items-center justify-center gap-2 transition-all"
          >
            سجّل الآن <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Step 3: Auth (login + signup) unified                            */
/* ────────────────────────────────────────────────────────────────── */

const AuthStep = ({
  onBack,
  onLoginSuccess,
  onRegisterSuccess,
  onClose,
}: {
  onBack: () => void;
  onLoginSuccess: (user: any) => void;
  onRegisterSuccess: (user: any) => void;
  onClose: () => void;
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');

  /* email fields */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<string>('individual');
  const [countryCode, setCountryCode] = useState('+967');
  const [phone, setPhone] = useState('');

  /* phone / otp */
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [googleRedirectLoading, setGoogleRedirectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  /* countdown */
  useEffect(() => {
    if (otpCountdown > 0) {
      const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCountdown]);

  /* recaptcha init */
  const initRecaptcha = useCallback(() => {
    if (!recaptchaRef.current) {
      try {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'wf-recaptcha', { size: 'invisible' });
      } catch (e) {
        console.error('[WF] recaptcha init error', e);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup recaptcha on unmount
      try { recaptchaRef.current?.clear(); } catch (_) {}
      recaptchaRef.current = null;
    };
  }, []);

  const clearErr = () => { setError(null); setSuccessMsg(null); };
  const getFullPhoneNumber = () => `${countryCode}${phone.replace(/\D/g, '').replace(/^0+/, '')}`;

  const syncBackend = async (firebaseUser: any): Promise<any | null> => {
    try {
      const idToken = await firebaseUser.getIdToken(true);
      console.log('[WF] syncBackend: uid:', firebaseUser.uid, 'email:', firebaseUser.email);

      const r = await fetch('/api/v1/auth/firebase/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      console.log('[WF] syncBackend: /firebase/login status:', r.status);
      if (r.ok) {
        const d = await r.json();
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) { localStorage.setItem('aswaq_current_user', JSON.stringify(d.user)); return d.user; }
      } else {
        const errText = await r.text().catch(() => '');
        console.error('[WF] syncBackend: /firebase/login failed:', r.status, errText);
      }
    } catch (e: any) { console.error('[WF] syncBackend error', e); }
    return null;
  };

  const handleGoogle = async () => {
    clearErr();
    setLoading(true);
    if (Capacitor.isNativePlatform()) {
      try {
        await Browser.open({
          url: `${API_ORIGIN}/api/v1/auth/oauth2/google?state=mobile`,
          windowName: '_system'
        });
      } catch (e: any) {
        setError('تعذر فتح متصفح النظام لتسجيل الدخول.');
        setLoading(false);
      }
    } else {
      window.location.href = `${API_ORIGIN}/api/v1/auth/oauth2/google?state=web`;
    }
  };

  /* ── Email auth ── */
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    setLoading(true);
    try {
      if (mode === 'login') {
        const r = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) {
          localStorage.setItem('aswaq_current_user', JSON.stringify(d.user));
          onLoginSuccess(d.user);
          onClose();
        }
      } else {
        const generatedPwd = password || (Math.random().toString(36).slice(2, 10) + 'Aa1!');
        const r = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password: generatedPwd, role }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'فشل إنشاء الحساب');
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) {
          localStorage.setItem('aswaq_current_user', JSON.stringify(d.user));
          onRegisterSuccess(d.user);
          onClose();
        }
      }
    } catch (e: any) {
      setError(e.message || 'حدث خطأ. حاول مجدداً.');
    } finally { setLoading(false); }
  };

  /* ── Send OTP via Backend ── */
  const handleSendOtp = async () => {
    clearErr();
    if (!phone) { setError('يرجى إدخال رقم الهاتف'); return; }
    const fullPhone = getFullPhoneNumber();
    if (!/^\+[1-9]\d{6,14}$/.test(fullPhone)) { setError('صيغة رقم الهاتف غير صحيحة'); return; }
    setLoading(true);
    try {
      const result = await sendPhoneOtp(fullPhone);
      setOtpSent(true);
      setPhoneStep('otp');
      setOtpCountdown(60);
      if (result.devOtp) {
        setSuccessMsg(`[وضع التطوير] رمز التحقق: ${result.devOtp} ✅`);
      } else {
        setSuccessMsg('تم إرسال رمز التحقق عبر SMS بنجاح ✅');
      }
    } catch (e: any) {
      setError(e.message || 'فشل إرسال رمز التحقق');
    } finally { setLoading(false); }
  };

  /* ── Verify OTP via Backend ── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErr();
    if (!otp || otp.length < 6) { setError('يرجى إدخال رمز التحقق المكون من 6 أرقام'); return; }
    setLoading(true);
    try {
      const fullPhone = getFullPhoneNumber();
      const d = await verifyPhoneOtp(fullPhone, otp, { name: mode === 'signup' ? name : undefined });
      if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
      if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
      if (d.user) {
        localStorage.setItem('aswaq_current_user', JSON.stringify(d.user));
        if (mode === 'signup') onRegisterSuccess(d.user);
        else onLoginSuccess(d.user);
        onClose();
      }
    } catch (e: any) {
      setError(e.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
    } finally { setLoading(false); }
  };

  /* ─────────── render ─────────── */
  return (
    <motion.div key="auth" variants={scaleIn} initial="hidden" animate="visible" exit="exit" className="w-full max-w-md">
      <div id="wf-recaptcha" />

      {/* Card */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white">
            {mode === 'login' ? 'مرحباً بعودتك 👋' : 'انضم إلى أسواق 🚀'}
          </h2>
          <p className="text-sm text-zinc-500">
            {mode === 'login' ? 'سجّل دخولك لمتابعة أعمالك' : 'خطوة واحدة تفصلك عن عالم التجارة'}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-zinc-950/60 border border-zinc-800 rounded-2xl p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); clearErr(); setPhoneStep('input'); setOtp(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                mode === m
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </button>
          ))}
        </div>

        {/* Method tabs */}
        <div className="flex gap-2">
          {(['email', 'phone'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setAuthMethod(m); clearErr(); setPhoneStep('input'); setOtp(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                authMethod === m
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              {m === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
              {m === 'email' ? 'البريد' : 'الهاتف'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-3 hover:bg-zinc-100 active:scale-95 disabled:opacity-60 transition-all shadow-lg"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          )}
          المتابعة عبر Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            {authMethod === 'email' ? 'أو بالبريد الإلكتروني' : 'أو برقم الهاتف'}
          </span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* ── Email form ── */}
        <AnimatePresence mode="wait">
          {authMethod === 'email' && (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleEmailAuth}
              className="space-y-4"
            >
              {/* Role (signup only) */}
              {mode === 'signup' && (
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block px-1">نوع الحساب</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`py-3 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                          role === r.id
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                            : 'bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span>{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <InputField icon={User} placeholder="الاسم الكامل" value={name} onChange={setName} required />
              )}
              <InputField icon={Mail} type="email" placeholder="البريد الإلكتروني" value={email} onChange={setEmail} required dir="ltr" />
              <InputField
                icon={Lock}
                type={showPwd ? 'text' : 'password'}
                placeholder="كلمة المرور"
                value={password}
                onChange={setPassword}
                required
                rightEl={
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {error && <ErrorBanner msg={error} />}
              {successMsg && <SuccessBanner msg={successMsg} />}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
              </motion.button>
            </motion.form>
          )}

          {/* ── Phone form ── */}
          {authMethod === 'phone' && (
            <motion.div
              key="phone-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {mode === 'signup' && phoneStep === 'input' && (
                <InputField icon={User} placeholder="الاسم الكامل" value={name} onChange={setName} required />
              )}

              <AnimatePresence mode="wait">
                {phoneStep === 'input' ? (
                  <motion.div key="phone-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block px-1">رقم الهاتف</label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="bg-zinc-950/70 border border-zinc-800 rounded-2xl px-3 py-4 text-sm text-white outline-none focus:border-emerald-500/70 transition-all w-28 shrink-0"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.dial_code + c.nameAr} value={c.dial_code}>
                              {c.dial_code} {c.nameAr}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          placeholder="7xxxxxxxx"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          dir="ltr"
                          className="flex-1 bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500/70 rounded-2xl py-4 px-4 text-sm text-white outline-none transition-all font-mono"
                        />
                      </div>
                    </div>
                    {error && <ErrorBanner msg={error} />}
                    {successMsg && <SuccessBanner msg={successMsg} />}

                    {/* DEV MODE: show test phone hint on localhost only */}
                    {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-start gap-2">
                        <span className="shrink-0">🛠️</span>
                        <span>وضع التطوير — استخدم رقم الاختبار: <span dir="ltr" className="font-mono">+967712345678</span> ورمز: <span className="font-mono">123456</span></span>
                      </div>
                    )}
                    <motion.button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || phone.length < 7}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      إرسال رمز التحقق
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.form key="otp-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                      <p className="text-xs text-emerald-400 font-bold">تم إرسال رمز التحقق إلى</p>
                      <p className="text-sm font-black text-white mt-1 font-mono" dir="ltr">{countryCode}{phone}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block px-1">رمز التحقق (6 أرقام)</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="0 0 0 0 0 0"
                        className="w-full tracking-[0.6em] text-center bg-zinc-950/70 border border-zinc-800 focus:border-emerald-500/70 rounded-2xl py-4 text-2xl font-black text-emerald-400 outline-none transition-all font-mono"
                      />
                    </div>
                    {error && <ErrorBanner msg={error} />}
                    {successMsg && <SuccessBanner msg={successMsg} />}
                    <motion.button
                      type="submit"
                      disabled={loading || otp.length < 6}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      تأكيد الرمز
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => { setPhoneStep('input'); setOtp(''); clearErr(); setOtpCountdown(0); }}
                      className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {otpCountdown > 0 ? `إعادة الإرسال بعد ${otpCountdown}ث` : 'تغيير الرقم أو إعادة الإرسال'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle mode */}
        <div className="text-center text-xs text-zinc-500">
          {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); clearErr(); }}
            className="text-emerald-400 font-black hover:underline transition-colors"
          >
            {mode === 'login' ? 'سجّل الآن' : 'سجّل دخولك'}
          </button>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="mt-5 flex items-center gap-2 text-zinc-600 hover:text-zinc-400 mx-auto text-sm font-bold transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        العودة
      </button>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Tiny banners                                                      */
/* ────────────────────────────────────────────────────────────────── */

const ErrorBanner = ({ msg }: { msg: string }) => (
  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2">
    <span className="shrink-0">⚠️</span>
    <span>{msg}</span>
  </motion.div>
);

const SuccessBanner = ({ msg }: { msg: string }) => (
  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-start gap-2">
    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
    <span>{msg}</span>
  </motion.div>
);

/* ────────────────────────────────────────────────────────────────── */
/*  Main WelcomeFlow component                                        */
/* ────────────────────────────────────────────────────────────────── */

export default function WelcomeFlow({ onClose, onLogin, onRegister, currentMarket }: WelcomeFlowProps) {
  const [step, setStep] = useState<FlowStep>('splash');

  const handleLoginSuccess = (user: any) => {
    onLogin(user);
    onClose();
  };

  const handleRegisterSuccess = (user: any) => {
    onRegister(user);
    onClose();
  };

  const stepIndex = { splash: 0, features: 1, auth: 2 } as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden dir-rtl"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[400px] h-[400px] bg-teal-600/5 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[-10%] w-[300px] h-[300px] bg-blue-600/4 rounded-full blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <span className="text-slate-950 font-black text-lg" style={{ fontFamily: 'Georgia, serif' }}>أ</span>
          </div>
          <div>
            <span className="text-white font-black text-sm">أسواق</span>
            <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest leading-none">
              {currentMarket.labelEn}
            </div>
          </div>
        </div>

        {/* Progress */}
        {step !== 'splash' && <ProgressDots steps={3} current={stepIndex[step]} />}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'splash' && (
            <SplashStep
              market={currentMarket}
              onNext={() => setStep('features')}
              onClose={onClose}
            />
          )}
          {step === 'features' && (
            <FeaturesStep
              onNext={() => setStep('auth')}
              onBack={() => setStep('splash')}
            />
          )}
          {step === 'auth' && (
            <AuthStep
              onBack={() => setStep('features')}
              onLoginSuccess={handleLoginSuccess}
              onRegisterSuccess={handleRegisterSuccess}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <div className="relative z-10 py-4 text-center border-t border-zinc-900/50">
        <div className="flex items-center justify-center gap-2">
          <GlowDot color="bg-emerald-500" />
          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
            Aswaq Platform © {new Date().getFullYear()} — جميع الحقوق محفوظة
          </span>
        </div>
      </div>
    </motion.div>
  );
}
