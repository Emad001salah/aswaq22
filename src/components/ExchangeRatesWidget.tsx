import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  Info,
} from "lucide-react";

export interface ExchangeRates {
  sanaaUsd: number;
  sanaaSar: number;
  adenUsd: number;
  adenSar: number;
  jordanUsd: number; // USD to JOD
}

export const DEFAULT_RATES: ExchangeRates = {
  sanaaUsd: 535,
  sanaaSar: 140,
  adenUsd: 1780,
  adenSar: 468,
  jordanUsd: 0.708,
};

export default function ExchangeRatesWidget() {
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [usdInput, setUsdInput] = useState<string>("100");
  const [yerSanaa, setYerSanaa] = useState<number>(53500);
  const [yerAden, setYerAden] = useState<number>(178000);
  const [jodAmman, setJodAmman] = useState<number>(70.8);
  const [market, setMarket] = useState("yemen");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("global_sovereign_rates");
      const currentMarket = localStorage.getItem("market_selection") || "yemen";
      setMarket(currentMarket);
      if (saved) {
        setRates(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load rates", e);
    }
  }, []);

  useEffect(() => {
    const usd = parseFloat(usdInput) || 0;
    setYerSanaa(usd * rates.sanaaUsd);
    setYerAden(usd * rates.adenUsd);
    setJodAmman(usd * rates.jordanUsd);
  }, [usdInput, rates]);

  const handleRateChange = (key: keyof ExchangeRates, val: string) => {
    const num = parseFloat(val) || 0;
    const next = { ...rates, [key]: num };
    setRates(next);
    localStorage.setItem("global_sovereign_rates", JSON.stringify(next));
  };

  const resetRates = () => {
    setRates(DEFAULT_RATES);
    localStorage.setItem(
      "yemen_sovereign_rates",
      JSON.stringify(DEFAULT_RATES),
    );
    setIsEditing(false);
  };

  const renderInput = (key: keyof ExchangeRates, value: number) =>
    isEditing ? (
      <input
        type="number"
        className="w-14 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/30 rounded text-emerald-600 dark:text-emerald-400 font-bold px-1 py-0.5 text-center text-[10px] outline-none"
        value={value}
        onChange={(e) => handleRateChange(key, e.target.value)}
      />
    ) : (
      <span className="font-bold text-slate-800 dark:text-white text-[11px] min-w-[32px] text-center">
        {value}
      </span>
    );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-3.5 shadow-sm dir-rtl text-right overflow-hidden transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Header & Controls */}
        <div className="flex items-center justify-between lg:justify-start gap-4">
          <div className="flex items-center gap-2 relative">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                أسعار الصرف
              </h3>
              <p className="text-[9px] text-slate-500 dark:text-slate-400">
                تحديث مباشر
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600 text-[10px] font-bold transition-all"
            >
              {isEditing ? "حفظ" : "تعديل"}
            </button>
            {isEditing && (
              <button
                onClick={resetRates}
                className="px-2 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-[10px] font-bold transition-all"
              >
                إستعادة
              </button>
            )}
          </div>
        </div>

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
