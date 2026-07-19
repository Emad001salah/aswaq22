/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Eye, TrendingUp, Heart, CheckCircle2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { User, Ad } from "../../types.ts";
import { Market } from "../../markets.ts";

interface AnalyticsTabProps {
  myAds: Ad[];
  currentUser: User;
  currentMarket: Market;
  categories: any[];
  t: (key: string, options?: any) => string;
}

export default function AnalyticsTab({
  myAds,
  currentUser,
  currentMarket,
  categories,
  t,
}: AnalyticsTabProps) {
  const isRtl = true; // Dashboard is layout-level RTL

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-right">
          <Eye className="w-8 h-8 text-emerald-400 mb-2" />
          <p className="text-[11px] text-slate-500">
            إجمالي مشاهدات إعلاناتك
          </p>
          <p className="text-2xl font-black text-slate-200 mt-1">
            {myAds.reduce((acc, ad) => acc + (ad.views || 0), 0)}
          </p>
          <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12.4% زيادة هذا الشهر</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-right">
          <Heart className="w-8 h-8 text-cyan-400 mb-2 fill-current" />
          <p className="text-[11px] text-slate-500">
            التفضيلات والنقرات المهتمة
          </p>
          <p className="text-2xl font-black text-slate-200 mt-1">
            {myAds.reduce((acc, ad) => acc + (ad.likes || 0), 0)}
          </p>
          <div className="mt-2 text-[10px] text-cyan-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+8.1% تفاعل جيد</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-right">
          <CheckCircle2 className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-[11px] text-slate-500">رتبة ونمو الحساب</p>
          <p className="text-2xl font-black text-slate-200 mt-1">
            {currentUser.role === "merchant"
              ? "تاجر موثوق"
              : currentUser.role === "store"
                ? "صاحب متجر ذهبي"
                : "مستشار نشط"}
          </p>
          <div className="mt-2 text-[10px] text-amber-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>الحساب موثق بالكامل</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-8 rounded-[32px] bg-slate-900 border border-slate-800 space-y-6">
          <div className="text-right">
            <h4 className="text-sm font-black text-white">
              إحصائيات المشاهدات (7 أيام)
            </h4>
            <p className="text-[10px] text-slate-500 mt-1">
              رسم بياني يوضح نمو الاهتمام بإعلاناتك خلال الأسبوع الماضي
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { name: "السبت", views: 45 },
                  { name: "الأحد", views: 52 },
                  { name: "الاثنين", views: 48 },
                  { name: "الثلاثاء", views: 70 },
                  { name: "الأربعاء", views: 61 },
                  { name: "الخميس", views: 85 },
                  { name: "الجمعة", views: 98 },
                ]}
              >
                <defs>
                  <linearGradient
                    id="colorViews"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#10b981"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  reversed
                />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                  }}
                  itemStyle={{ color: "#10b981", fontSize: "10px" }}
                  labelStyle={{
                    color: "#94a3b8",
                    fontSize: "11px",
                    marginBottom: "4px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorViews)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 rounded-[32px] bg-slate-900 border border-slate-800 space-y-6">
          <div className="text-right">
            <h4 className="text-sm font-black text-white">
              توزيع الإعلانات حسب التصنيف
            </h4>
            <p className="text-[10px] text-slate-500 mt-1">
              توزيع استثماراتك ونشاطك عبر الأقسام المختلفة في أسواق {currentMarket.labelAr}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categories.map((cat) => ({
                  name: cat.nameAr,
                  count: myAds.filter((a) => a.category === cat.id).length,
                })).filter((c) => c.count > 0)}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#475569"
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                  }}
                  cursor={{ fill: "#1e293b" }}
                  itemStyle={{ color: "#38bdf8", fontSize: "10px" }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]}>
                  {categories.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index % 2 === 0 ? "#10b981" : "#38bdf8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
