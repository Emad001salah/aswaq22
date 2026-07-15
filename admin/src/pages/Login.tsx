import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Mail, Lock, Eye, EyeOff, Globe } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';


export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRtl, setIsRtl] = useState(true); // Default to Arabic for Aswaq

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || (isRtl ? 'فشل تسجيل الدخول. يرجى التحقق من البيانات.' : 'Login failed. Please check credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    window.location.href = `${API_BASE_URL}/api/v1/auth/oauth2/google?state=admin`;
  };

  const translations = {
    title: isRtl ? 'لوحة التحكم الإدارية' : 'Admin Control Panel',
    subtitle: isRtl ? 'أهلاً بك مجدداً! يرجى تسجيل الدخول للمتابعة.' : 'Welcome back! Please login to continue.',
    emailLabel: isRtl ? 'البريد الإلكتروني' : 'Email Address',
    emailPlaceholder: isRtl ? 'name@example.com' : 'name@example.com',
    passwordLabel: isRtl ? 'كلمة المرور' : 'Password',
    passwordPlaceholder: isRtl ? '••••••••' : '••••••••',
    loginBtn: isRtl ? 'تسجيل الدخول' : 'Sign In',
    loggingIn: isRtl ? 'جاري التحقق...' : 'Verifying...',
    googleBtn: isRtl ? 'الدخول باستخدام Google' : 'Sign in with Google',
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 transition-colors duration-300"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Background Gradient Orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-900/30 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-fuchsia-300 dark:bg-fuchsia-900/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      {/* Language Toggle and Branding */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button 
          onClick={() => setIsRtl(!isRtl)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-sm"
        >
          <Globe size={16} />
          <span>{isRtl ? 'English' : 'العربية'}</span>
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white/70 dark:bg-gray-900/70 border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden p-8 transition-all duration-300 transform hover:scale-[1.01]">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/10 mb-4 animate-bounce">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{translations.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">{translations.subtitle}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <div className="shrink-0 mt-0.5">⚠️</div>
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {translations.emailLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={translations.emailPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-gray-950/50 border border-gray-300 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {translations.passwordLabel}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={translations.passwordPlaceholder}
                className="w-full pl-10 pr-12 py-2.5 bg-white/50 dark:bg-gray-950/50 border border-gray-300 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
          >
            {isLoading ? translations.loggingIn : translations.loginBtn}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-gray-900 px-2 text-gray-400 dark:text-gray-500">
              {isRtl ? 'أو' : 'OR'}
            </span>
          </div>
        </div>

        {/* Google OAuth Option */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 px-4 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer mb-3"
        >
          {/* Google Icon */}
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>{translations.googleBtn}</span>
        </button>

        {/* Developer Local Bypass */}
        {window.location.hostname === 'localhost' && (
          <button
            type="button"
            onClick={async () => {
              setIsLoading(true);
              setError(null);
              try {
                const success = await login('eee3327@gmail.com', '12345678');
                if (success) {
                  window.location.href = '/';
                }
              } catch (err: any) {
                setError(err.message || 'فشل تسجيل الدخول السريع');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            ⚡ دخول سريع كمسؤول (التطوير المحلي)
          </button>
        )}
      </div>
    </div>
  );
};
