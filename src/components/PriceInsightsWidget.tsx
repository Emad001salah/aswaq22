/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, BarChart3, Info, MapPin, Search, Tag, Smartphone, Car, 
  Home as HomeIcon, Laptop, X, CheckCircle, ChevronDown,
  Tv, Sofa, Shirt, Briefcase, Wrench, Beef, Bike, Truck, 
  BookOpen, Utensils, HeartPulse, Gem, Hammer, Palette, Hexagon,
  Building, Hotel, Palmtree, CarFront, Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Ad } from '../types';
import { CITIES, CATEGORIES } from '../data';
import { Market } from '../markets';

interface PriceInsightsWidgetProps {
  ads: Ad[];
  currentMarket?: Market;
}

const ICON_MAP: Record<string, any> = {
  Car, Home: HomeIcon, Tv, Smartphone, Laptop, Sofa, Shirt, Briefcase, Wrench, Beef, Bike, Truck, BookOpen, Utensils, HeartPulse, Gem, Hammer, Palette, Hexagon, Users,
  Building, Hotel, Palmtree, CarFront
};

export default function PriceInsightsWidget({ ads, currentMarket }: PriceInsightsWidgetProps) {
  const { t, i18n } = useTranslation();
  const [selectedCatId, setSelectedCatId] = useState(CATEGORIES[0].id);
  const [showReport, setShowReport] = useState(false);
  const [reportTab, setReportTab] = useState<'categories' | 'cities' | 'insights'>('categories');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const MAIN_CITIES = useMemo(() => {
    const cityCounts: Record<string, number> = {};
    ads.forEach(ad => {
      cityCounts[ad.city] = (cityCounts[ad.city] || 0) + 1;
    });
    return Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city]) => city);
  }, [ads]);

  const categoryOptions = useMemo(() => {
    return CATEGORIES;
  }, []);

  const dominantCurrency = useMemo(() => {
    const counts: Record<string, number> = {};
    ads.forEach(ad => {
      counts[ad.currency] = (counts[ad.currency] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'USD';
  }, [ads]);

  const stats = useMemo(() => {
    const cityData: Record<string, { total: number; count: number; currency: string }> = {};

    ads.forEach(ad => {
      if (ad.category === selectedCatId && MAIN_CITIES.includes(ad.city)) {
        if (!cityData[ad.city]) {
          cityData[ad.city] = { total: 0, count: 0, currency: ad.currency };
        }
        
        // Use dominant currency
        if (ad.currency === dominantCurrency) {
          cityData[ad.city].total += ad.price;
          cityData[ad.city].count += 1;
        }
      }
    });

    return Object.entries(cityData).map(([cityId, data]) => {
      const city = CITIES.find(c => c.id === cityId);
      return {
        id: cityId,
        name: city?.nameAr || cityId,
        average: data.count > 0 ? Math.round(data.total / data.count) : 0,
        count: data.count,
        currency: dominantCurrency
      };
    }).filter(s => s.average > 0).sort((a, b) => b.average - a.average);
  }, [ads, selectedCatId, MAIN_CITIES, dominantCurrency]);

  const categoryAveragesData = useMemo(() => {
    return CATEGORIES.map(catObj => {
      const catId = catObj.id;
      const matchingAds = ads.filter(ad => ad.category === catId && ad.currency === dominantCurrency);
      const total = matchingAds.reduce((sum, ad) => sum + ad.price, 0);
      const count = matchingAds.length;
      return {
        name: i18n.language === 'ar' ? catObj.nameAr : catObj.nameEn,
        averagePrice: count > 0 ? Math.round(total / count) : 0,
        adsCount: count,
        currency: dominantCurrency
      };
    }).filter(item => item.averagePrice > 0).sort((a, b) => b.averagePrice - a.averagePrice);
  }, [ads, dominantCurrency, i18n.language]);

  const cityActivityData = useMemo(() => {
    return MAIN_CITIES.map(cityId => {
      const cityObj = CITIES.find(c => c.id === cityId);
      const count = ads.filter(ad => ad.city === cityId).length;
      return {
        name: cityObj?.nameAr || cityId,
        "عدد الإعلانات": count
      };
    }).sort((a, b) => b["عدد الإعلانات"] - a["عدد الإعلانات"]);
  }, [ads]);

  const selectedCategory = categoryOptions.find(c => c.id === selectedCatId);

  const currencySymbol = dominantCurrency === 'JOD' ? 'د.أ' : dominantCurrency === 'SAR' ? 'ر.س' : '$';

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col dir-rtl text-right">
        <div className="p-4 bg-emerald-500/5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white">{t('spotlight.priceInsights.title')}</h3>
              <p className="text-[10px] text-slate-500 font-bold">{t('spotlight.priceInsights.subtitle')}</p>
            </div>
          </div>
          <Info className="w-4 h-4 text-slate-400 cursor-help" />
        </div>

        <div className="p-4 space-y-4">
          {/* Category Selector Chips */}
          <div className="relative z-20">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  {React.createElement(ICON_MAP[selectedCategory?.icon || 'Tag'] || Tag, { className: 'w-4 h-4 text-emerald-500' })}
                </div>
                <span className="text-[12px] font-black text-slate-900 dark:text-white">
                  {i18n.language === 'ar' ? selectedCategory?.nameAr : selectedCategory?.nameEn}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsDropdownOpen(false)} 
              />
            )}
            <div 
              className={`absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xl shadow-slate-900/5 overflow-hidden transition-all duration-300 origin-top z-30 ${isDropdownOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}
            >
              <div className="max-h-60 overflow-y-auto no-scrollbar scroll-smooth p-2 space-y-1">
                {categoryOptions.map(cat => {
                  const Icon = ICON_MAP[cat.icon] || Tag;
                  const isActive = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCatId(cat.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all group ${
                        isActive 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                      <span className="text-[11.5px] font-black">{i18n.language === 'ar' ? cat.nameAr : cat.nameEn}</span>
                      {isActive && <CheckCircle className="w-4 h-4 mr-auto text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Data List */}
          <div className="space-y-3">
            {stats.length > 0 ? (
              stats.map((item, idx) => (
                <div key={item.id} className="group cursor-default">
                  <div className="flex justify-between items-end mb-1.5 px-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-emerald-500">{currencySymbol}{item.average.toLocaleString()}</span>
                      <span className="text-[9px] text-slate-500 font-bold">{t('spotlight.priceInsights.activeAds', { count: item.count })}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000 group-hover:bg-emerald-400" 
                      style={{ width: `${(item.average / stats[0].average) * 100}%` }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold max-w-[150px]">{t('spotlight.priceInsights.noData')}</p>
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
             <div className="flex gap-2">
                <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  <strong className="text-blue-500">Tip:</strong> {t('spotlight.priceInsights.tip', { category: i18n.language === 'ar' ? selectedCategory?.nameAr : selectedCategory?.nameEn })}
                </p>
             </div>
          </div>
        </div>
        
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-center rounded-b-2xl">
          <button 
            onClick={() => setShowReport(true)}
            className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer"
          >
            <BarChart3 className="w-3 h-3" />
            {t('spotlight.priceInsights.seeFullReport')}
          </button>
        </div>
      </div>

      {/* Local Market Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[3500] overflow-y-auto flex items-start pt-20 pb-10 sm:pt-24 lg:items-center lg:pt-0 justify-center p-4 bg-slate-950/85 backdrop-blur-sm dir-rtl text-right">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{t('spotlight.priceInsights.reportTitle')}</h3>
                  <p className="text-[11px] text-slate-500 font-bold">{t('spotlight.priceInsights.reportSubtitle')}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReport(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 pt-4 pb-0 gap-6 overflow-x-auto no-scrollbar relative">
              {[
                { id: 'categories', label: t('spotlight.priceInsights.tabCategories'), icon: '💰' },
                { id: 'cities', label: t('spotlight.priceInsights.tabCities'), icon: '📍' },
                { id: 'insights', label: t('spotlight.priceInsights.tabInsights'), icon: '💡' },
              ].map(tab => {
                const isActive = reportTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setReportTab(tab.id as any)}
                    className={`relative pb-3.5 text-[12px] font-black transition-all duration-300 whitespace-nowrap flex items-center gap-2 group ${
                      isActive
                        ? 'text-emerald-500'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}`}>{tab.icon}</span>
                    {tab.label}
                    
                    {/* Active Indicator Line */}
                    <div className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-400 opacity-100 scale-x-100' : 'bg-transparent opacity-0 scale-x-50'}`} />
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {reportTab === 'categories' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                    <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400">متوسط الأسعار بالأقسام الرئيسية بالعملة الشائعة ({currencySymbol})</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                      تم احتساب البيانات التالية لمتوسط أسعار المعروض الفعلي لمطابقة الموديلات والمواصفات السائدة في أسواقنا المحلية.
                    </p>
                  </div>

                  {categoryAveragesData.length > 0 ? (
                    <div className="h-64 w-full bg-slate-950/20 rounded-2xl p-4 border border-slate-800/20">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryAveragesData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', textAlign: 'right' }} 
                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '11px' }}
                          />
                          <Bar dataKey="averagePrice" fill="#10b981" name={t('spotlight.priceInsights.avgPrice')} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-500 text-xs font-bold bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
                      عذراً، يرجى إضافة إعلانات مقيمة بالعملة الشائعة ({currencySymbol}) في الأقسام لرؤية الرسم البياني التفاعلي.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {categoryAveragesData.map(item => (
                      <div key={item.name} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 flex justify-between items-center">
                        <span className="text-[11px] font-black text-slate-400">{item.name}</span>
                        <div className="text-left">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white">{currencySymbol}{item.averagePrice.toLocaleString()}</p>
                          <p className="text-[9px] text-emerald-500 font-bold">{t('spotlight.priceInsights.activeAds', { count: item.adsCount })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportTab === 'cities' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-2">
                    <h4 className="text-xs font-black text-cyan-600 dark:text-cyan-400">كثافة ونسب الإعلانات المضافة حسب المنطقة والمحافظة</h4>
                    <p className="text-[11px] text-slate-550 leading-relaxed text-slate-400 font-bold">
                      تعبر الكثافة الإعلانية الحالية عن معدل الطلب وحركة الاستيراد والتبادل التجاري النشط في كل مدينة {currentMarket?.id === 'YE' ? 'يمنية' : `في ${currentMarket?.labelAr || 'الدولة'}`}.
                    </p>
                  </div>

                  <div className="h-64 w-full bg-slate-950/20 rounded-2xl p-4 border border-slate-800/20">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cityActivityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', textAlign: 'right' }} 
                        />
                        <Bar dataKey="عدد الإعلانات" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {cityActivityData.map(item => (
                      <div key={item.name} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 text-center space-y-1">
                        <p className="text-[10px] font-black text-slate-400">{item.name}</p>
                        <p className="text-base font-black text-slate-900 dark:text-white">{item["عدد الإعلانات"]}</p>
                        <p className="text-[8px] text-cyan-500 font-bold">إعلان معروض بالكامل</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportTab === 'insights' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {[
                      {
                        title: "✅ نظام الفحص والتوثيق المائي الذكي لاسم المشتري",
                        desc: "تتيح 'أسواق' ميزة حصرية غير مسبوقة تُمكّن البائعين والمشترين من تأكيد المصداقية الفورية لصور البضائع بإجراء مكالمة فيديو حية أو إرسال صور حصرية مسجل عليها اسم المشتري كتابياً لمنع التلاعب وتجنب الصور المفبركة."
                      },
                      {
                        title: "📉 ضبط إشعارات انخفاض الأسعار الرادارية",
                        desc: "بإمكانك إضافة الإعلانات المميزة لصفحتك المفضلة وسيعمل الذكاء الاصطناعي على تنبيهك فوراً عبر إشعار دفع حي فور قيام البائع بتسجيل خفض في السعر المطلوب."
                      },
                      {
                        title: "⚖️ توازن السعر العادل وسلامة الصفقة",
                        desc: "يُنصح بمقارنة أسعار اللابتوبات والسيارات المستعملة بالنسبة المئوية لمعدل الإعلانات في نفس مدينتك لضمان قيمة عادلة وحذراً من العروض الوهمية ذات التباين الشديد في الأسعار."
                      }
                    ].map((ins, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <h5 className="text-xs font-black text-slate-900 dark:text-white leading-relaxed">{ins.title}</h5>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed mr-6 font-bold">{ins.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-xs font-black text-emerald-500">منصة أسواق {currentMarket?.labelAr || 'العربية'} الموحدة • مصداقية مطلقة وتجارة شفافة</p>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button 
                onClick={() => setShowReport(false)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 font-black text-xs px-8 h-10 rounded-xl transition-all cursor-pointer"
              >
                {t('spotlight.priceInsights.confirm')}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
