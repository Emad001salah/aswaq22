import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  Info,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export interface ExchangeRates {
  sanaaUsd: number;
  sanaaSar: number;
  adenUsd: number;
  adenSar: number;
  jordanUsd: number;
  updatedAt?: string;
  source?: 'auto' | 'manual';
  autoSyncEnabled?: boolean;
}

export const DEFAULT_RATES: ExchangeRates = {
  sanaaUsd: 535,
  sanaaSar: 140,
  adenUsd: 1560,
  adenSar: 410,
  jordanUsd: 0.708,
  updatedAt: new Date().toISOString(),
  source: 'manual',
  autoSyncEnabled: true,
};

export default function ExchangeRatesWidget() {
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [usdInput, setUsdInput] = useState<string>("100");
  const [yerSanaa, setYerSanaa] = useState<number>(53500);
  const [yerAden, setYerAden] = useState<number>(156000);
  const [jodAmman, setJodAmman] = useState<number>(70.8);
  const [market, setMarket] = useState("yemen");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check admin status from local storage
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("aswaq_current_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && (u.role === 'admin' || u.role === 'super_admin' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')) {
          setIsAdmin(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Central Exchange Rates from server API
  const fetchRates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/exchange-rates');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          setRates(data.rates);
          localStorage.setItem("global_sovereign_rates", JSON.stringify(data.rates));
        }
      }
    } catch (e) {
      console.warn("Failed to fetch rates from server, using cached/default rates", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("global_sovereign_rates");
      const currentMarket = localStorage.getItem("market_selection") || "yemen";
      setMarket(currentMarket);
      if (saved) {
        setRates(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load local cached rates", e);
    }

    fetchRates();
    // Poll every 5 minutes for live background update
    const timer = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchRates]);

  useEffect(() => {
    const usd = parseFloat(usdInput) || 0;
    setYerSanaa(usd * rates.sanaaUsd);
    setYerAden(usd * rates.adenUsd);
    setJodAmman(usd * rates.jordanUsd);
  }, [usdInput, rates]);

  const handleRateChange = (key: keyof ExchangeRates, val: string) => {
    const num = parseFloat(val) || 0;
    setRates(prev => ({ ...prev, [key]: num }));
  };

  // Save modified rates centrally to the server for ALL users
  const handleSaveToAll = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem("token") || "";
      const res = await fetch('/api/admin/exchange-rates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sanaaUsd: rates.sanaaUsd,
          sanaaSar: rates.sanaaSar,
          adenUsd: rates.adenUsd,
          adenSar: rates.adenSar,
          jordanUsd: rates.jordanUsd
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rates) setRates(data.rates);
        setStatusMessage("✓ تم حفظ وتعميم الأسعار لجميع المستخدمين");
        setTimeout(() => setStatusMessage(null), 3500);
        setIsEditing(false);
      } else {
        setStatusMessage("⚠️ يرجى تسجيل الدخول كمسؤول لحفظ الأسعار للجميع");
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: any) {
      setStatusMessage("فشل الحفظ: " + (err?.message || "خطأ في الشبكة"));
      setTimeout(() => setStatusMessage(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // Force auto-sync from live market feed
  const handleLiveSync = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem("token") || "";
      const res = await fetch('/api/admin/exchange-rates/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rates) setRates(data.rates);
        setStatusMessage("✓ تم التحديث التلقائي الحي ومزامنة الأسعار");
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        // Fallback to client-side refresh
        await fetchRates();
        setStatusMessage("✓ تم تحديث الأسعار الحالية");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setStatusMessage("فشل التحديث: " + (err?.message || "خطأ"));
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (key: keyof ExchangeRates, value: number) =>
    isEditing ? (
      <input
        type="number"
        className="w-16 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-500 rounded text-emerald-700 dark:text-emerald-300 font-black px-1 py-0.5 text-center text-xs outline-none shadow-inner"
        value={value}
        onChange={(e) => handleRateChange(key, e.target.value)}
      />
    ) : (
      <span className="font-bold text-slate-800 dark:text-white text-[11px] min-w-[32px] text-center">
        {value.toLocaleString('en-US')}
      </span>
    );

  const formatLastUpdated = (isoStr?: string) => {
    if (!isoStr) return "تحديث مباشر";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "تحديث مباشر";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-3.5 shadow-sm dir-rtl text-right overflow-hidden transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Header & Controls */}
        <div className="flex items-center justify-between lg:justify-start gap-4">
          <div className="flex items-center gap-2 relative">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg relative">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {rates.source === 'auto' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  أسعار الصرف
                </h3>
                {rates.source === 'auto' ? (
                  <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.2 rounded border border-emerald-500/20">
                    آلي حي
                  </span>
                ) : (
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black px-1.5 py-0.2 rounded border border-blue-500/20">
                    معتمد
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400">
                آخر تحديث: {formatLastUpdated(rates.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Refresh Button */}
            <button
              onClick={handleLiveSync}
              disabled={isLoading || isSaving}
              title="تحديث الأسعار فورياً"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSaving ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            {/* Admin Edit / Save Buttons */}
            {isAdmin && (
              <>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 text-[10px] font-black transition-all flex items-center gap-1"
                  >
                    <span>تعديل</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveToAll}
                      disabled={isSaving}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black transition-all shadow-sm flex items-center gap-1"
                    >
                      {isSaving ? "جاري الحفظ..." : "حفظ للجميع"}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center animate-fade-in">
            {statusMessage}
          </div>
        )}

        {/* Rates Inline Grid */}
        <div className="flex flex-1 flex-row flex-wrap md:flex-nowrap gap-0 items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 border border-slate-100 dark:border-slate-800 rounded-xl">
          {market === "jordan" ? (
            <div className="flex-1 flex w-full items-center justify-between px-3">
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md whitespace-nowrap">
                الأردن (عمّان)
              </span>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[10px]">USD → JOD:</span>
                  {renderInput("jordanUsd", rates.jordanUsd)}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Sanaa */}
              <div className="flex-1 flex max-sm:w-full max-sm:mb-2 max-sm:pb-2 max-sm:justify-between items-center justify-center gap-3 px-3 border-l-0 sm:border-l border-slate-200 dark:border-slate-800 max-sm:border-b">
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md whitespace-nowrap">
                  صنعاء
                </span>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">دولار:</span>
                    {renderInput("sanaaUsd", rates.sanaaUsd)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">سعودي:</span>
                    {renderInput("sanaaSar", rates.sanaaSar)}
                  </div>
                </div>
              </div>
              {/* Aden */}
              <div className="flex-1 flex max-sm:w-full items-center max-sm:justify-between justify-center gap-3 px-3">
                <span className="text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-md whitespace-nowrap">
                  عدن
                </span>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">دولار:</span>
                    {renderInput("adenUsd", rates.adenUsd)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">سعودي:</span>
                    {renderInput("adenSar", rates.adenSar)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Converter Inline */}
        <div className="flex items-center justify-between max-sm:w-full gap-2 shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shrink-0">
            <input
              type="number"
              className="w-16 sm:w-20 bg-transparent text-slate-800 dark:text-white font-bold text-xs outline-none text-center py-1.5"
              value={usdInput}
              onChange={(e) => setUsdInput(e.target.value)}
            />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 border-r border-slate-200 dark:border-slate-800">
              USD
            </span>
          </div>

          <div className="flex items-center gap-2 h-full pr-1.5 w-full justify-evenly">
            {market === "jordan" ? (
              <div className="text-center px-1">
                <p className="text-[8px] text-slate-500">الأردن</p>
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                  {(jodAmman || 0).toLocaleString("en-US", { maximumFractionDigits: 3 })}{" "}
                  JOD
                </p>
              </div>
            ) : (
              <>
                <div className="text-center px-1">
                  <p className="text-[8px] text-slate-500">صنعاء</p>
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {(yerSanaa || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
                    YER
                  </p>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700/50 mx-1"></div>
                <div className="text-center px-1">
                  <p className="text-[8px] text-slate-500">عدن</p>
                  <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-400">
                    {(yerAden || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
                    YER
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
