import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, KeyRound, Smartphone } from 'lucide-react';
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/phoneAuth';

interface OtpVerificationProps {
  phoneNumber: string;
  onVerify: () => void;
}

export const OtpVerification: React.FC<OtpVerificationProps> = ({ phoneNumber: initialPhoneNumber, onVerify }) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [step, setStep] = useState<'phone' | 'otp'>(initialPhoneNumber ? 'otp' : 'phone');

  const sendOtpCode = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      setError('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setIsSending(true);
    setError('');
    setMessage('');
    try {
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+967${cleanPhone.replace(/^0+/, '')}`;

      const result = await sendPhoneOtp(formattedPhone);
      setCountdown(60);
      setStep('otp');
      if (result.devOtp) {
        setMessage(`[وضع التطوير] رمز التفعيل: ${result.devOtp} ✅`);
      } else {
        setMessage('تم إرسال رمز التفعيل بنجاح عبر الرسائل القصيرة (SMS) ✅');
      }
    } catch (err: any) {
      console.error('OTP sending error', err);
      setError(err.message || 'فشل إرسال كود التحقق. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSending(false);
    }
  };

  // Auto send code on mount IF phone is provided
  useEffect(() => {
    if (initialPhoneNumber && step === 'otp') {
      sendOtpCode();
    }
  }, [initialPhoneNumber]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const verifyOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) {
      setError('يرجى إدخال رمز تفعيل صحيح');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+967${cleanPhone.replace(/^0+/, '')}`;

      const res = await verifyPhoneOtp(formattedPhone, verificationCode);
      
      // Update local storage if tokens are returned
      if (res.accessToken) {
        localStorage.setItem('aswaq_access_token', res.accessToken);
      }
      if (res.refreshToken) {
        localStorage.setItem('aswaq_refresh_token', res.refreshToken);
      }
      if (res.user) {
        localStorage.setItem('aswaq_current_user', JSON.stringify(res.user));
      }

      setMessage('تم التفعيل بنجاح!');
      setTimeout(() => {
        onVerify();
      }, 1000);
    } catch (err: any) {
      console.error('OTP verification error', err);
      setError(err.message || 'رمز التفعيل غير صحيح أو منتهي الصلاحية');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      
      {step === 'phone' ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="bg-slate-950/60 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-white">إدخال رقم الهاتف 📱</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                يرجى إدخال رقم هاتفك لتلقي رمز التفعيل عبر رسالة نصية قصيرة SMS.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block px-1">رقم الهاتف الدولي</label>
            <div className="relative">
              <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+967..."
                className="w-full bg-slate-950/80 border border-zinc-800 rounded-2xl py-4 px-10 text-xl font-black text-white outline-none focus:border-emerald-500 transition-all tracking-wider font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-2"
            >
              <span>🚨</span>
              <span>{error}</span>
            </motion.div>
          )}

          <button 
             type="button"
             onClick={sendOtpCode}
             disabled={isSending || phoneNumber.length < 9}
             className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>إرسال رمز التحقق الآن</span>
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white">تأكيد رقم الهاتف 🛡️</h4>
                <button 
                  onClick={() => setStep('phone')}
                  className="text-[9px] font-black text-emerald-500 hover:underline"
                >
                  تغيير الرقم؟
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                لقد أرسلنا رمز تفعيل مكون من 6 أرقام إلى الرقم {phoneNumber}
              </p>
            </div>
          </div>
    
          <form onSubmit={verifyOtpCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block px-1">رمز التحقق (OTP)</label>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full tracking-[0.5em] text-center bg-slate-950/80 border border-zinc-800 rounded-2xl py-4 text-xl font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all font-mono"
                disabled={isLoading || isSending}
              />
            </div>
    
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-2"
              >
                <span>🚨</span>
                <span>{error}</span>
              </motion.div>
            )}
    
            {message && !error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{message}</span>
              </motion.div>
            )}
    
            <div className="space-y-2 pt-2">
              <button 
                type="submit"
                disabled={isLoading || isSending || verificationCode.length < 6}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>تحقق وتأكيد رقم الهاتف</span>
              </button>
    
              <button
                type="button"
                onClick={sendOtpCode}
                disabled={countdown > 0 || isSending || isLoading}
                className="w-full bg-transparent text-zinc-400 hover:text-white disabled:opacity-50 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
                {countdown > 0 ? (
                  <span>إعادة إرسال الرمز خلال ({countdown} ثانية)</span>
                ) : (
                  <span>إرسال رمز جديد الآن</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
