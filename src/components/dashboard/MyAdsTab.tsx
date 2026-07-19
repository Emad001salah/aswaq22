/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Ad } from "../../types.ts";
import { Market } from "../../markets.ts";
import { CITIES } from "../../data.ts";

interface MyAdsTabProps {
  myAds: Ad[];
  currentMarket: Market;
  isDark: boolean;
  onTabChange: (tab: string) => void;
  onSelectAd: (ad: Ad) => void;
  handleStartEditAd: (ad: Ad) => void;
  onDeleteAdRequest: (adId: string, adTitle: string) => void;
}

export default function MyAdsTab({
  myAds,
  currentMarket,
  isDark,
  onTabChange,
  onSelectAd,
  handleStartEditAd,
  onDeleteAdRequest,
}: MyAdsTabProps) {
  const formatPrice = (num?: number) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const relativeDateString = (dateStr: string) => {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      if (days === 1) return 'منذ يوم';
      if (days === 2) return 'منذ يومين';
      if (days >= 3 && days <= 10) return `منذ ${days} أيام`;
      return `منذ ${days} يوم`;
    }
    if (hours > 0) {
      if (hours === 1) return 'منذ ساعة';
      if (hours === 2) return 'منذ ساعتين';
      if (hours >= 3 && hours <= 10) return `منذ ${hours} ساعات`;
      return `منذ ${hours} ساعة`;
    }
    if (minutes > 0) {
      if (minutes === 1) return 'منذ دقيقة';
      if (minutes === 2) return 'منذ دقيقتين';
      return `منذ ${minutes} دقيقة`;
    }
    return 'الآن';
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`${isDark ? 'text-slate-100' : 'text-slate-900'} text-lg font-bold`}>
          إعلاناتي التي نشرتها في أسواق {currentMarket.labelAr}
        </h3>
        <button
          onClick={() => onTabChange("create-ad")}
          className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إعلان جديد
        </button>
      </div>

      {myAds.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/30">
          <p className="text-sm text-slate-500">
            لم تقم بنشر أي إعلانات حتى الآن في المنصة.
          </p>
          <button
            onClick={() => onTabChange("create-ad")}
            className="mt-4 bg-emerald-500 hover:bg-emerald-450 font-bold text-slate-950 text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            انشر أول إعلان لك مجاناً
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myAds.map((ad) => {
            const cityObj = CITIES.find((c) => c.id === ad.city);
            const cityName = cityObj ? cityObj.nameAr : ad.city;

            const currentTrendData = ad.viewTrend || (() => {
              const seed = ad.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const data = [];
              const daysShort = ['أحد', 'اثن', 'ثلا', 'أرب', 'خميس', 'جمعة', 'سبت'];
              for (let i = 6; i >= 0; i--) {
                const val = Math.floor(Math.abs(Math.sin(seed + i)) * 15) + (i * 2) + Math.floor(ad.views / 20);
                data.push({ day: daysShort[i], views: val });
              }
              return data;
            })();

            return (
              <div
                key={ad.id}
                className={`p-5 rounded-2xl flex flex-col justify-between transition-all text-right group relative border ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-slate-200/50'}`}
                id={`my-ad-item-${ad.id}`}
              >
                <div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                    <img
                      src={
                        (ad.images?.[0] && typeof ad.images[0] === 'object'
                          ? (ad.images[0] as any).url
                          : (ad.images?.[0] as string)) ||
                        "https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=400&q=80"
                      }
                      alt={ad.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {/* Status Badge Overlay */}
                    {(ad.status === "sold" || ad.status === "expired") && (
                      <div className={`absolute top-2 right-2 z-10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg shadow-black/20 flex items-center gap-1.5
                        ${ad.status === "sold" ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${ad.status === "sold" ? "bg-rose-500" : "bg-amber-500"}`} />
                        {ad.status === "sold" ? "تـم الـبـيـع" : "مـنـتـهـي"}
                      </div>
                    )}

                    {/* Mini Views Overlay Chart */}
                    <div className="absolute top-2 left-2 w-20 h-10 bg-slate-950/60 backdrop-blur-md rounded-lg border border-white/10 p-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={currentTrendData}>
                             <Line 
                                type="monotone" 
                                dataKey="views" 
                                stroke="#10b981" 
                                strokeWidth={2} 
                                dot={false} 
                                animationDuration={1500}
                             />
                          </LineChart>
                       </ResponsiveContainer>
                       <div className="absolute -top-1 -right-1 bg-emerald-500 w-1.5 h-1.5 rounded-full animate-pulse" />
                    </div>
                  </div>

                  <div className="flex items-start justify-between mt-3 gap-3">
                    <h4 className={`text-sm font-bold line-clamp-2 flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {ad.title}
                    </h4>
                    <div className="shrink-0 w-16 h-8 opacity-60">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={currentTrendData}>
                             <Area 
                                type="step" 
                                dataKey="views" 
                                stroke="#334155" 
                                fill="#334155" 
                                fillOpacity={0.2} 
                                strokeWidth={1}
                             />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col text-[10px] text-slate-500">
                      <span>المدينة: {cityName}</span>
                      <span className="opacity-80 mt-0.5">{relativeDateString(ad.createdAt)}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full capitalize ${ad.status === "active" ? "bg-emerald-500/15 text-emerald-400" : ad.status === "sold" ? "bg-rose-500/15 text-rose-400" : "bg-slate-800 text-slate-400"}`}
                    >
                      {ad.status === "active"
                        ? "نشط ومستمر"
                        : ad.status === "sold"
                          ? "تمت البيعة"
                          : ad.status === "expired"
                            ? "منتهي"
                            : ad.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between">
                  <p className="text-md font-extrabold text-emerald-400">
                    {formatPrice(ad.price)}{" "}
                    <span className="text-[10px]">{ad.currency}</span>
                  </p>

                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => onSelectAd(ad)}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      معاينة
                    </button>
                    <button
                      onClick={() => handleStartEditAd(ad)}
                      className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => onDeleteAdRequest(ad.id, ad.title)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg cursor-pointer transition-all"
                      title="حذف الإعلان"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
