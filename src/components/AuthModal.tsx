/**
 * AuthModal – Premium unified login/signup modal for Aswaq platform
 * Replaces the old modal with a polished, accessible, animated design.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Smartphone,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Phone,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { COUNTRIES } from '../constants/countries.ts';
import { useTranslation } from 'react-i18next';
import { OtpVerification } from './OtpVerification.tsx';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { API_BASE_URL, API_ORIGIN } from '../lib/config';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/phoneAuth';

/* ────────────────────────────────────────────────────────────────── */
/*  Types                                                             */
/* ────────────────────────────────────────────────────────────────── */

type Mode = 'login' | 'signup';
type Method = 'email' | 'phone';
type PhoneStep = 'input' | 'otp';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  isDark?: boolean;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                           */
/* ────────────────────────────────────────────────────────────────── */

const ErrorBanner = ({ msg }: { msg: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2"
  >
    <span className="shrink-0">⚠️</span>
    <span>{msg}</span>
  </motion.div>
);

const SuccessBanner = ({ msg }: { msg: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-start gap-2"
  >
    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
    <span>{msg}</span>
  </motion.div>
);

const Field = ({
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  dir,
  suffix,
}: {
  icon: any;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  dir?: 'ltr' | 'rtl';
  suffix?: React.ReactNode;
}) => (
  <div className="relative group">
    <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors z-10 pointer-events-none" />
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full bg-slate-950/80 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500/70 rounded-2xl py-3.5 pr-11 pl-11 text-sm text-white outline-none transition-all font-medium placeholder:text-zinc-600"
    />
    {suffix && <div className="absolute left-3 top-1/2 -translate-y-1/2">{suffix}</div>}
  </div>
);

/* ────────────────────────────────────────────────────────────────── */
/*  Main AuthModal                                                    */
/* ────────────────────────────────────────────────────────────────── */

export default function AuthModal({ isOpen, onClose, onSuccess, isDark }: AuthModalProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<Method>('email');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');

  /* email */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  /* phone */
  const [countryCode, setCountryCode] = useState('+962');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [googleRedirectLoading, setGoogleRedirectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  const clearState = () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(false);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setOtp('');
    setDevOtp(null);
    setPhoneStep('input');
    setOtpSent(false);
    try { recaptchaRef.current?.clear(); } catch (_) {}
    recaptchaRef.current = null;
    confirmationRef.current = null;
  };

  const getFullPhoneNumber = () => `${countryCode}${phone.replace(/\D/g, '').replace(/^0+/, '')}`;

  /* countdown */
  useEffect(() => {
    if (otpCountdown > 0) {
      const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCountdown]);

  /* lock body scroll */
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* recaptcha init */
  const initRecaptcha = useCallback(() => {
    if (!recaptchaRef.current) {
      try {
        const verifier = new RecaptchaVerifier(auth, 'auth-modal-recaptcha', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => { recaptchaRef.current = null; }
        });
        recaptchaRef.current = verifier;
        // Pre-render to avoid hanging later
        verifier.render().catch(() => { recaptchaRef.current = null; });
      } catch (e) {
        console.error('[AuthModal] recaptcha init error', e);
      }
    }
  }, []);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear(); } catch (_) {}
      recaptchaRef.current = null;
    };
  }, []);

  /* ── sync backend ── */
  const syncBackend = async (fbUser: any): Promise<any | null> => {
    try {
      const idToken = await fbUser.getIdToken(true);

      const r = await fetch('/api/v1/auth/firebase/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      console.log('[AuthModal] syncBackend: /firebase/login status:', r.status);
      if (r.ok) {
        const d = await r.json();
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) { localStorage.setItem('aswaq_current_user', JSON.stringify(d.user)); return d.user; }
      } else {
        const errText = await r.text().catch(() => '');
        console.error('[AuthModal] syncBackend: /firebase/login failed:', r.status, errText);
      }
    } catch (e) { console.error('[AuthModal] syncBackend error', e); }
    return null;
  };

  const handleGoogle = async () => {
    setError(null);
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
        // Use absolute URL based on API_ORIGIN (or fallback to current origin) for production redirects
        const redirectBase = API_ORIGIN || window.location.origin;
        window.location.href = `${redirectBase}/api/v1/auth/oauth2/google?state=web`;
    }
  };

  /* ── Email auth ── */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (mode === 'login') {
        const r = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'البريد أو كلمة المرور غير صحيحة');
        if (d.accessToken) {
          localStorage.setItem('aswaq_access_token', d.accessToken);
          localStorage.setItem('auth_token', d.accessToken);
        }
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) { localStorage.setItem('aswaq_current_user', JSON.stringify(d.user)); onSuccess(d.user); onClose(); }
      } else {
        const r = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'فشل إنشاء الحساب');
        if (d.accessToken) {
          localStorage.setItem('aswaq_access_token', d.accessToken);
          localStorage.setItem('auth_token', d.accessToken);
        }
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) { localStorage.setItem('aswaq_current_user', JSON.stringify(d.user)); onSuccess(d.user); onClose(); }
      }
    } catch (e: any) {
      setError(e.message || 'حدث خطأ. حاول مجدداً.');
    } finally { setLoading(false); }
  };

  /* ── Send OTP: Firebase first, fallback to backend ── */
  const handleSendOtp = async () => {
    setError(null);
    if (!phone) { setError('يرجى إدخال رقم الهاتف'); return; }
    const fullPhone = getFullPhoneNumber();
    if (!/^\+[1-9]\d{6,14}$/.test(fullPhone)) { setError('صيغة رقم الهاتف غير صحيحة'); return; }
    setLoading(true);

    // ── Try Firebase Phone Auth (sends real SMS) ──────────────────────
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'auth-modal-recaptcha', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => { recaptchaRef.current = null; }
        });
      }
      await recaptchaRef.current.render().catch(() => {});

      const firebasePromise = signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('firebase_timeout')), 30000)
      );
      const confirmation = await Promise.race([firebasePromise, timeoutPromise]);
      confirmationRef.current = confirmation as ConfirmationResult;
      setDevOtp(null);
      setOtpSent(true);
      setPhoneStep('otp');
      setOtpCountdown(120);
      setSuccessMsg('تم إرسال رمز التحقق عبر SMS ✅');
      setLoading(false);
      return; // Firebase SMS sent successfully
    } catch (firebaseErr: any) {
      console.warn('[Phone Auth] Firebase error:', firebaseErr?.code || firebaseErr?.message);
      try { recaptchaRef.current?.clear(); } catch (_) {}
      recaptchaRef.current = null;
      confirmationRef.current = null;

      let msg = 'فشل إرسال رمز التحقق عبر SMS. حاول مجدداً.';
      if (firebaseErr?.code === 'auth/invalid-phone-number') {
        msg = 'رقم الهاتف غير صالح. تأكد من اختيار رمز الدولة الصحيح.';
      } else if (firebaseErr?.code === 'auth/too-many-requests') {
        msg = 'تم تجاوز عدد المحاولات. حاول مجدداً بعد قليل.';
      } else if (firebaseErr?.code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بمركز التحقق. يرجى التأكد من اتصال الإنترنت وحالة المتصفح.';
      } else if (firebaseErr?.code === 'auth/captcha-check-failed') {
        msg = 'فشل التحقق الأمني. يرجى إعادة المحاولة.';
      } else if (firebaseErr?.message === 'firebase_timeout') {
        msg = 'استغرق إرسال الرمز وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.';
      } else if (firebaseErr?.message) {
        msg = firebaseErr.message;
      }
      setError(msg);
      setLoading(false);
    }
  };

  /* ── Verify OTP: Firebase if available, else backend ── */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length < 6) { setError('يرجى إدخال رمز التحقق المكون من 6 أرقام'); return; }
    setLoading(true);
    try {
      if (confirmationRef.current) {
        // Firebase OTP verify path
        const result = await confirmationRef.current.confirm(otp);
        const fbUser = result.user;
        const userData = await syncBackend(fbUser);
        if (userData) { onSuccess(userData); onClose(); return; }
        throw new Error('فشل مزامنة الحساب. حاول مجدداً.');
      } else {
        // Backend OTP verify path (fallback)
        const fullPhone = getFullPhoneNumber();
        const d = await verifyPhoneOtp(fullPhone, otp, { name: mode === 'signup' ? name : undefined });
        if (d.accessToken) localStorage.setItem('aswaq_access_token', d.accessToken);
        if (d.refreshToken) localStorage.setItem('aswaq_refresh_token', d.refreshToken);
        if (d.user) { localStorage.setItem('aswaq_current_user', JSON.stringify(d.user)); onSuccess(d.user); onClose(); }
      }
    } catch (e: any) {
      console.error('[Phone Auth] verify error:', e.code, e.message);
      if (e.code === 'auth/invalid-verification-code') {
        setError('رمز التحقق غير صحيح. تأكد من الرمز المرسل عبر SMS.');
      } else if (e.code === 'auth/code-expired') {
        setError('انتهت صلاحية الرمز. اضغط على “تغيير الرقم” وأعد الإرسال.');
      } else {
        setError(e.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } finally { setLoading(false); }
  };

  /* ─────────── render ─────────── */
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`relative w-full sm:max-w-md max-h-[95dvh] overflow-y-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border dir-rtl ${
            isDark
              ? 'bg-slate-900 border-zinc-800/60'
              : 'bg-slate-900 border-zinc-800/60'
          }`}
        >
          <div id="auth-modal-recaptcha" />

          {/* Drag handle (mobile) */}
          <div className="sm:hidden w-12 h-1 rounded-full bg-zinc-700 mx-auto mt-3 mb-1" />

          {/* Redirect loading overlay */}
          {googleRedirectLoading && (
            <div className="absolute inset-0 rounded-[2.5rem] bg-slate-900/95 flex flex-col items-center justify-center gap-4 z-20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/25">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-7 h-7" alt="Google" />
              </div>
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-400 font-bold">جاري التحقق من حساب Google...</p>
            </div>
          )}

          {/* Close btn */}
          <button
            onClick={onClose}
            className="absolute top-5 left-5 w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-7 pt-6 space-y-6">
            {/* Header */}
            <div className="text-center space-y-1 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-slate-950" />
              </div>
              <h2 className="text-2xl font-black text-white">
                {mode === 'login' ? 'مرحباً بعودتك 👋' : 'انضم إلينا 🚀'}
              </h2>
              <p className="text-sm text-zinc-500">
                {mode === 'login' ? 'سجّل دخولك لمتابعة حسابك' : 'خطوة واحدة تفصلك عن عالم التجارة'}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-2xl p-1">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setSuccessMsg(null); setPhoneStep('input'); setOtp(''); }}
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

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-3 hover:bg-zinc-100 active:scale-95 disabled:opacity-60 transition-all shadow-lg shadow-black/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              )}
              المتابعة عبر Google
            </button>



            {/* Method toggle */}
            <div className="flex gap-2">
              {(['email', 'phone'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMethod(m); setError(null); setSuccessMsg(null); setPhoneStep('input'); setOtp(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                    method === m
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  {m === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                  {m === 'email' ? 'البريد الإلكتروني' : 'رقم الهاتف'}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 -my-1">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                {method === 'email' ? 'أو بالبريد الإلكتروني' : 'أو برقم الهاتف'}
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* ── Email form ── */}
            <AnimatePresence mode="wait">
              {method === 'email' && (
                <motion.form
                  key="email"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleEmailSubmit}
                  className="space-y-3"
                >
                  {mode === 'signup' && (
                    <Field icon={User} placeholder="الاسم الكامل" value={name} onChange={setName} required />
                  )}
                  <Field icon={Mail} type="email" placeholder="البريد الإلكتروني" value={email} onChange={setEmail} required dir="ltr" />
                  <Field
                    icon={Lock}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="كلمة المرور"
                    value={password}
                    onChange={setPassword}
                    required
                    suffix={
                      <button type="button" onClick={() => setShowPwd((s) => !s)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {error && <ErrorBanner msg={error} />}

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all mt-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                  </motion.button>
                </motion.form>
              )}

              {/* ── Phone form ── */}
              {method === 'phone' && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {mode === 'signup' && phoneStep === 'input' && (
                    <Field icon={User} placeholder="الاسم الكامل" value={name} onChange={setName} required />
                  )}

                  <AnimatePresence mode="wait">
                    {phoneStep === 'input' ? (
                      <motion.div key="ph-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block px-1">رقم الهاتف</label>
                          <div className="flex gap-2">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="bg-slate-950/80 border border-zinc-800 rounded-2xl px-3 py-3.5 text-sm text-white outline-none focus:border-emerald-500/70 w-28 shrink-0 transition-all"
                            >
                              {COUNTRIES.map((c, i) => (
                                <option key={`${c.dial_code}-${i}`} value={c.dial_code}>
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
                              className="flex-1 bg-slate-950/80 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500/70 rounded-2xl py-3.5 px-4 text-sm text-white outline-none transition-all font-mono"
                            />
                          </div>
                        </div>

                        {error && <ErrorBanner msg={error} />}
                        {successMsg && <SuccessBanner msg={successMsg} />}



                        <motion.button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || phone.length < 7}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                          إرسال رمز التحقق
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.form key="ph-otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                          <p className="text-xs text-emerald-400 font-bold">تم إرسال رمز التحقق إلى</p>
                          <p className="text-sm font-black text-white mt-1 font-mono" dir="ltr">{countryCode}{phone}</p>
                        </div>

                        {/* Dev OTP display box - auto-filled and shown clearly */}
                        {devOtp && (
                          <div
                            className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center cursor-pointer hover:bg-amber-500/20 transition-all"
                            onClick={() => setOtp(devOtp)}
                            title="انقر لملء الرمز تلقائياً"
                          >
                            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-1">🛠️ وضع التطوير — رمز التحقق</p>
                            <p className="text-3xl font-black text-amber-400 font-mono tracking-[0.4em]">{devOtp}</p>
                            <p className="text-[10px] text-amber-500/60 mt-1">انقر لملء الرمز تلقائياً</p>
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block px-1">رمز التحقق (6 أرقام)</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="0 0 0 0 0 0"
                            autoFocus
                            className="w-full tracking-[0.6em] text-center bg-slate-950/80 border border-zinc-800 focus:border-emerald-500/70 rounded-2xl py-4 text-2xl font-black text-emerald-400 outline-none transition-all font-mono"
                          />
                        </div>

                        {error && <ErrorBanner msg={error} />}
                        {!devOtp && successMsg && <SuccessBanner msg={successMsg} />}

                        <motion.button
                          type="submit"
                          disabled={loading || otp.length < 6}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                          تأكيد الرمز
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => { setPhoneStep('input'); setOtp(''); setDevOtp(null); setError(null); setSuccessMsg(null); }}
                          className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" />
                          {otpCountdown > 0 ? `إعادة الإرسال بعد ${otpCountdown}ث` : 'تغيير الرقم'}
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle */}
            <div className="text-center text-xs text-zinc-500 pb-1">
              {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب؟ '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccessMsg(null); }}
                className="text-emerald-400 font-black hover:underline"
              >
                {mode === 'login' ? 'سجّل الآن' : 'سجّل دخولك'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
