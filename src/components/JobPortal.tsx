/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  Briefcase,
  Users,
  Search,
  MapPin,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Send,
  MessageSquare,
  Building,
  User,
  PlusCircle,
  Filter,
  Trash2,
  Check,
  ChevronRight,
  Eye,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Ad, User as UserType } from "../types";
import { CITIES } from "../data";
import { useMarket } from "../context/MarketContext";
import { Avatar } from "./Avatar.tsx";

interface JobPortalProps {
  currentUser: UserType;
  isDark: boolean;
  ads: Ad[];
  onSelectAd: (ad: Ad) => void;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
}

interface Application {
  id: string;
  adId: string;
  adTitle: string;
  adCategory: string; // 'jobs'
  applicantId: string;
  applicantName: string;
  applicantAvatar?: string;
  applicantPhone: string;
  email?: string;
  coverLetter: string;
  experience?: string;
  status: "pending" | "shortlisted" | "accepted" | "rejected";
  appliedAt: string;
}

export default function JobPortal({
  currentUser,
  isDark,
  ads,
  onSelectAd,
  addToast,
}: JobPortalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { market: currentMarket } = useMarket();

  const [activeTab, setActiveTab] = useState<"vacancies" | "craftsmen" | "seekers" | "management">("vacancies");
  
  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  // Applications Local Storage State
  const [applications, setApplications] = useState<Application[]>([]);
  
  // Detail popup or Apply form modal
  const [applyingAd, setApplyingAd] = useState<Ad | null>(null);
  const [coverLetterInput, setCoverLetterInput] = useState("");
  const [phoneInput, setPhoneInput] = useState(currentUser?.phone || "");
  const [emailInput, setEmailInput] = useState(currentUser?.email || "");
  const [experienceInput, setExperienceInput] = useState("Junior");
  const [nameInput, setNameInput] = useState(currentUser?.name || "");

  // Load applications from localStorage on mount and pre-seed on first load
  useEffect(() => {
    try {
      const stored = localStorage.getItem("aswaq_job_applications");
      if (stored) {
        setApplications(JSON.parse(stored));
      } else {
        // Pre-seed some default job applications for demonstration if user has any active jobs
        const myJobs = ads.filter(ad => ad.userId === (currentUser?.id || 'guest_user') && ad.category === "jobs");
        const sampleApps: Application[] = [];
        setApplications(sampleApps);
        localStorage.setItem("aswaq_job_applications", JSON.stringify(sampleApps));
      }
    } catch (e) {
      console.error("Failed to read/write local applications store", e);
    }
  }, [ads, currentUser]);

  const saveApplications = (newApps: Application[]) => {
    setApplications(newApps);
    localStorage.setItem("aswaq_job_applications", JSON.stringify(newApps));
  };

  const defaultSampleJobs: Ad[] = [];
  const defaultSampleSeekers: Ad[] = [];
  const defaultSampleCraftsmen: Ad[] = [];


  const isJobAd = (ad: Ad) => {
    if (!ad) return false;
    const cat = (ad.category || '').toLowerCase();
    const sub = (ad.subCategory || '').toLowerCase();
    const title = (ad.title || '').toLowerCase();
    return (
      cat === "jobs" ||
      cat === "27a06a9e-3d5e-7f67-eb60-4a39536208c9" ||
      cat.includes("وظائف") ||
      cat.includes("فرص") ||
      cat.includes("job") ||
      sub.includes("وظائف") ||
      title.includes("مطلوب") ||
      title.includes("وظيفة") ||
      title.includes("سيرة ذاتية")
    );
  };

  
  const rawVacancies = ads.filter(ad => isJobAd(ad) && ad.jobType !== "seeking" && ad.jobType !== "craftsman");
  const rawCraftsmen = ads.filter(ad => isJobAd(ad) && (ad.jobType === "craftsman" || (ad.subCategory || '').includes("سباكة") || (ad.subCategory || '').includes("كهرباء") || (ad.subCategory || '').includes("نجارة") || (ad.subCategory || '').includes("يومية")));
  const rawSeekers = ads.filter(ad => isJobAd(ad) && ad.jobType === "seeking");

  // Fallback to rich sample jobs, craftsmen and seekers if database/state has no matching ads
  const jobVacancies = rawVacancies.length > 0 ? rawVacancies : defaultSampleJobs;
  const jobCraftsmen = rawCraftsmen.length > 0 ? rawCraftsmen : defaultSampleCraftsmen;
  const jobSeekers = rawSeekers.length > 0 ? rawSeekers : defaultSampleSeekers;

  const filteredCraftsmen = jobCraftsmen.filter(ad => {
    if (!ad) return false;
    const title = ad.title || '';
    const desc = ad.description || '';
    const matchesSearch = !searchTerm || 
                          title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !selectedCity || ad.city === selectedCity;
    const matchesSpecialty = !selectedSpecialty || ad.subCategory === selectedSpecialty;
    return matchesSearch && matchesCity && matchesSpecialty;
  });


  // Filter logic
  const filteredVacancies = jobVacancies.filter(ad => {
    if (!ad) return false;
    const title = ad.title || '';
    const desc = ad.description || '';
    const matchesSearch = !searchTerm || 
                          title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !selectedCity || ad.city === selectedCity;
    const matchesSpecialty = !selectedSpecialty || ad.subCategory === selectedSpecialty;
    return matchesSearch && matchesCity && matchesSpecialty;
  });

  const filteredSeekers = jobSeekers.filter(ad => {
    if (!ad) return false;
    const title = ad.title || '';
    const desc = ad.description || '';
    const matchesSearch = !searchTerm || 
                          title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !selectedCity || ad.city === selectedCity;
    const matchesSpecialty = !selectedSpecialty || ad.subCategory === selectedSpecialty;
    return matchesSearch && matchesCity && matchesSpecialty;
  });

  // Extract unique specialties/subcategories from ads
  const uniqueSpecialties = Array.from(new Set(ads
    .filter(ad => ad.category === "jobs")
    .map(ad => ad.subCategory)
    .filter(Boolean)
  )) as string[];

  // Handling submission of job application / job offer
  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingAd) return;

    const isSeeking = applyingAd.jobType === "seeking";

    if (!coverLetterInput.trim()) {
      if (addToast) {
        addToast(
          isRtl ? "تنبيه" : "Warning", 
          isSeeking 
            ? (isRtl ? "الرجاء كتابة تفاصيل ومزايا عرض العمل" : "Please describe job offer details")
            : (isRtl ? "الرجاء كتابة رسالة التغطية أو نبذة تعريفية قبل التقديم" : "Please write a cover letter before applying"),
          "error"
        );
      }
      return;
    }

    const newApp: Application = {
      id: `app_${Math.random().toString(36).substring(2, 9)}`,
      adId: applyingAd.id,
      adTitle: applyingAd.title,
      adCategory: applyingAd.category,
      applicantId: (currentUser?.id || 'guest_user'),
      applicantName: nameInput,
      applicantAvatar: (currentUser?.avatar || ''),
      applicantPhone: phoneInput,
      email: emailInput,
      coverLetter: coverLetterInput,
      experience: experienceInput,
      status: "pending",
      appliedAt: new Date().toISOString()
    };

    const updatedApps = [newApp, ...applications];
    saveApplications(updatedApps);

    // Dynamic in-app notification trigger simulated
    if (addToast) {
      addToast(
        isSeeking
          ? (isRtl ? "تم إرسال عرض العمل! ✉️" : "Job Offer Sent! ✉️")
          : (isRtl ? "تم التقديم بنجاح! 🚀" : "Applied Successfully! 🚀"),
        isSeeking
          ? (isRtl
            ? `تم إرسال عرض عملك للمرشح: "${applyingAd.title}". سيتم إشعاره لتسريع التواصل معك.`
            : `Your job offer to "${applyingAd.title}" has been sent. The candidate will be notified.`)
          : (isRtl 
            ? `تم إرسال طلبك لصاحب الإعلان: "${applyingAd.title}". يمكنك تتبع حالة الطلب من التبويب الخاص بإدارة الطلبات والتوظيف.`
            : `Your application to "${applyingAd.title}" has been sent. You can track its status in your job board panel.`),
        "success"
      );
    }

    // Reset fields
    setApplyingAd(null);
    setCoverLetterInput("");
  };

  // Change status of an application
  const handleUpdateAppStatus = (appId: string, nextStatus: "pending" | "shortlisted" | "accepted" | "rejected") => {
    const updated = applications.map(app => {
      if (app.id === appId) {
        return { ...app, status: nextStatus };
      }
      return app;
    });
    saveApplications(updated);
    
    let statusAr = "قيد المراجعة";
    if (nextStatus === "shortlisted") statusAr = "تم الترشيح المبدئي";
    if (nextStatus === "accepted") statusAr = "مقبول نهائياً";
    if (nextStatus === "rejected") statusAr = "مرفوض";

    if (addToast) {
      addToast(
        isRtl ? "تم تحديث حالة الطلب" : "Application Status Updated",
        isRtl ? `تم تغيير حالة طلب المتقدم إلى "${statusAr}" بنجاح.` : `Application status shifted to "${nextStatus}".`,
        "success"
      );
    }
  };

  // Delete/withdraw application
  const handleWithdrawApp = (appId: string) => {
    const filtered = applications.filter(app => app.id !== appId);
    saveApplications(filtered);
    if (addToast) {
      addToast("تم السحب", isRtl ? "تم سحب طلب التوظيف بنجاح." : "Application withdrawn successfully.", "info");
    }
  };

  // Applications received (where current user owns the Ad)
  const myJobAdsIds = ads.filter(ad => ad.userId === (currentUser?.id || 'guest_user') && ad.category === "jobs").map(ad => ad.id);
  const receivedApplications = applications.filter(app => myJobAdsIds.includes(app.adId) && app.applicantId !== (currentUser?.id || 'guest_user'));

  // Applications sent (where current user was the applicant)
  const sentApplications = applications.filter(app => app.applicantId === (currentUser?.id || 'guest_user'));

  return (
    <div id="job-portal-main" className="space-y-6">
      {/* Modern High Contrast Glassmorphism Header */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200/65 shadow-sm"}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <Briefcase className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                {isRtl ? "بوابة أسواق المهنية" : "Aswaq Pro Portal"}
              </span>
              <Zap className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
            </div>
            <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              {isRtl ? "بوابة الوظائف والفرص" : "Jobs & Opportunities Portal"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
              {isRtl 
                ? "بوابة متكاملة تربط أصحاب الشركات والمحلات الكبرى بالكوادر المؤهلة والباحثين عن عمل بشكل فوري في منطقتك."
                : "An integrated portal connecting trade stores & corporates with qualified talents & job seekers directly in your region."}
            </p>
          </div>
        </div>

        {/* Rapid Overview Stats Grid */}
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className={`p-4 rounded-2xl border text-center flex-1 md:flex-initial min-w-[110px] transition-colors ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200/80 shadow-xs"}`}>
            <span className="block text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wide mb-1">
              {isRtl ? "الوظائف النشطة" : "Active Jobs"}
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{jobVacancies.length}</span>
          </div>
          <div className={`p-4 rounded-2xl border text-center flex-1 md:flex-initial min-w-[110px] transition-colors ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200/80 shadow-xs"}`}>
            <span className="block text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wide mb-1">
              {isRtl ? "الباحثون عن عمل" : "Job Seekers"}
            </span>
            <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{jobSeekers.length}</span>
          </div>
          <div className={`p-4 rounded-2xl border text-center flex-1 md:flex-initial min-w-[110px] transition-colors ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200/80 shadow-xs"}`}>
            <span className="block text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wide mb-1">
              {isRtl ? "طلباتي والترشيحات" : "My Applications"}
            </span>
            <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
              {receivedApplications.length + sentApplications.length}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Switch & Filter bar */}
      <div className="space-y-4">
        {/* Toggle Sections Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-inner overflow-x-auto select-none no-scrollbar">
          <button
            onClick={() => setActiveTab("vacancies")}
            className={`flex-1 py-3 px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "vacancies"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg"
                : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-350"
            }`}
          >
            <Briefcase className={`w-4 h-4 ${activeTab === "vacancies" ? "text-emerald-500" : ""}`} />
            {isRtl ? "💼 بوابة الوظائف والفرص المتاحة" : "Vacancies & Opportunities"}
          </button>

          <button
            onClick={() => setActiveTab("craftsmen")}
            className={`flex-1 py-3 px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "craftsmen"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg"
                : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-350"
            }`}
          >
            <Building className={`w-4 h-4 ${activeTab === "craftsmen" ? "text-amber-500" : ""}`} />
            {isRtl ? "🔨 المهنيين وعمال اليومية" : "Craftsmen & Daily Workers"}
          </button>
          
          <button
            onClick={() => setActiveTab("seekers")}
            className={`flex-1 py-3 px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "seekers"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg"
                : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-350"
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === "seekers" ? "text-purple-500" : ""}`} />
            {isRtl ? "👨‍💼 طلبات الباحثين عن عمل" : "Job Seekers"}
          </button>

          <button
            onClick={() => setActiveTab("management")}
            className={`flex-1 py-3 px-6 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer relative ${
              activeTab === "management"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg"
                : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-350"
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === "management" ? "text-amber-500" : ""}`} />
            {isRtl ? "🛡️ لوحة إدارة الترشيحات والطلبات" : "Recruitment Board"}
            {receivedApplications.filter(a => a.status === "pending").length > 0 && (
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping absolute top-2 right-2"></span>
            )}
          </button>
        </div>

        {/* Filter Toolbar (Visible only in vacancy and seeker listings) */}
        {activeTab !== "management" && (
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={isRtl ? "البحث بالكلمة المفتاحية (مثال: مندوب، مبرمج، طبيب، محاسب)..." : "Search keywords (e.g. sales, driver, accountant)..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold outline-none ring-offset-slate-900 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="flex-1 md:flex-initial bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
              >
                <option value="">{isRtl ? "كل المدن" : "All Cities"}</option>
                {(currentMarket?.cities || CITIES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRtl ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>

              {uniqueSpecialties.length > 0 && (
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="flex-1 md:flex-initial bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                >
                  <option value="">{isRtl ? "كل التخصصات" : "All Specialties"}</option>
                  {uniqueSpecialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              )}

              {(searchTerm || selectedCity || selectedSpecialty) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCity("");
                    setSelectedSpecialty("");
                  }}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-black px-4 py-2.5 rounded-xl cursor-copy transition-all"
                >
                  {isRtl ? "إلغاء الفلترة" : "Clear"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Sections Output */}
      <AnimatePresence mode="wait">
        {/* Tab 1: Vacancies List */}
        {activeTab === "vacancies" && (
          <motion.div
            key="vacancies"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {filteredVacancies.length === 0 ? (
              <div className={`p-12 rounded-3xl border text-center ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className={`text-sm font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {isRtl ? "لا توجد شواغر معلنة تطابق خيارات البحث حالياً" : "No job vacancies match your search options."}
                </h3>
                <p className="text-xs text-slate-500/80 mt-1">
                  {isRtl ? "حاول تعديل الفلتر أو الاستكشاف من مدن وقرى جغرافية أخرى." : "Try expanding your selected city or filters."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVacancies.map((ad) => {
                  const hasApplied = applications.some((app) => app.adId === ad.id && app.applicantId === (currentUser?.id || 'guest_user'));
                  const belongsToCurrentUser = ad.userId === (currentUser?.id || 'guest_user');
                  
                  return (
                    <div
                      key={ad.id}
                      className={`p-5 rounded-3xl border hover:shadow-lg transition-all relative flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800/80 hover:border-emerald-500/40" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}
                    >
                      <div>
                        {/* Title & Badge */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ad.subCategory || (isRtl ? "فرصة شاغرة" : "Vacancy")}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                            {(currentMarket?.cities || CITIES).find(c => c.id === ad.city)?.nameAr || ad.city}
                          </span>
                        </div>

                        {/* Heading */}
                        <h3 className={`text-sm font-black transition-colors hover:text-emerald-500 cursor-pointer ${isDark ? "text-white" : "text-slate-900"}`} onClick={() => onSelectAd(ad)}>
                          {ad.title}
                        </h3>

                        {/* Description */}
                        <p className={`text-xs mt-2 line-clamp-3 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {ad.description}
                        </p>

                        {/* Payment indicator */}
                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-slate-350 dark:text-slate-500 text-[10px]">{isRtl ? 'الراتب المقدر:' : 'Est. Salary:'}</span>
                          <span className="text-xs font-black text-rose-500">
                            {ad.price > 0 ? `${ad.price.toLocaleString()} ${ad.currency}` : (isRtl ? 'يحدد بالمقابلة' : 'Competitive')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
                        {/* Poster profile summary */}
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={ad.userAvatar}
                            name={ad.userName || (isRtl ? "صاحب عمل" : "Employer")}
                            sizeClassName="w-6 h-6"
                            className="rounded-full"
                          />
                          <span className="text-[10px] font-bold text-slate-400 max-w-[100px] truncate">
                            {ad.userName || (isRtl ? "صاحب عمل" : "Employer")}
                          </span>
                        </div>

                        {/* Action CTA */}
                        <div className="flex items-center gap-2">
                          {belongsToCurrentUser ? (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">
                              {isRtl ? "فرصتك المنشورة" : "Your Post"}
                            </span>
                          ) : hasApplied ? (
                            <span className="text-xs font-black text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                              <CheckCircle2 className="w-4 h-4" />
                              {isRtl ? "تم التقديم" : "Applied"}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setApplyingAd(ad);
                                setPhoneInput(currentUser?.phone || "");
                                setEmailInput(currentUser?.email || "");
                                setNameInput(currentUser?.name || "");
                                setExperienceInput("Junior");
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {isRtl ? "تقدم للوظيفة فوراً" : "Apply Now"}
                            </button>
                          )}

                          <button
                            onClick={() => onSelectAd(ad)}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition-all"
                            title={isRtl ? "تفاصيل الفرصة" : "Details"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        
        {/* Tab 1.5: Craftsmen & Daily Wage Workers */}
        {activeTab === "craftsmen" && (
          <motion.div
            key="craftsmen"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Quick Craft Specialties Filter Badges */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {[
                { name: "الكل", value: "" },
                { name: "🚰 سباكة وتمديدات", value: "سباكة وتمديدات" },
                { name: "⚡ كهرباء وتمديدات", value: "كهرباء وتمديدات" },
                { name: "❄️ تكييف وتبريد", value: "تكييف وتبريد" },
                { name: "🔨 عمالة يومية ونقل", value: "عمالة يومية ونقل" },
                { name: "🪚 نجارة وديكور", value: "نجارة وديكور" },
                { name: "🚗 ميكانيك سيارات", value: "ميكانيك سيارات" },
              ].map(badge => (
                <button
                  key={badge.value}
                  onClick={() => setSelectedSpecialty(selectedSpecialty === badge.value ? "" : badge.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                    selectedSpecialty === badge.value
                      ? "bg-amber-500 text-white border-amber-500 shadow-md"
                      : isDark
                        ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/50"
                        : "bg-white border-slate-200 text-slate-700 hover:border-amber-400"
                  }`}
                >
                  {badge.name}
                </button>
              ))}
            </div>

            {filteredCraftsmen.length === 0 ? (
              <div className={`p-12 rounded-3xl border text-center ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className={`text-sm font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {isRtl ? "لا يوجد حرفيين أو عمال يومية يطابقون خيارات البحث حالياً" : "No craftsmen match your search filters."}
                </h3>
                <p className="text-xs text-slate-500/80 mt-1">
                  {isRtl ? "حاول تغيير المدينة المختارة أو استكشاف التخصصات المهنية الأخرى." : "Try expanding city or craft filters."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCraftsmen.map((ad) => {
                  return (
                    <div
                      key={ad.id}
                      className={`p-5 rounded-3xl border hover:shadow-lg transition-all relative flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800/80 hover:border-amber-500/40" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}
                    >
                      <div>
                        {/* Title & Badge */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {ad.subCategory || (isRtl ? "فني / حرفي" : "Craftsman")}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                            {(currentMarket?.cities || CITIES).find(c => c.id === ad.city)?.nameAr || ad.city}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className={`text-sm font-black transition-colors hover:text-amber-500 cursor-pointer ${isDark ? "text-white" : "text-slate-900"}`} onClick={() => onSelectAd(ad)}>
                          {ad.title}
                        </h3>

                        {/* Description */}
                        <p className={`text-xs mt-2 line-clamp-3 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {ad.description}
                        </p>

                        {/* Fee indicator */}
                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-slate-400 text-[10px]">{isRtl ? 'أجر الزيارة / اليومية:' : 'Rate:'}</span>
                          <span className="text-xs font-black text-amber-500">
                            {ad.price > 0 ? `${ad.price.toLocaleString()} ${ad.currency}` : (isRtl ? 'حسب الاتفاق' : 'Negotiable')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
                        {/* Craftsman summary */}
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={ad.userAvatar}
                            name={ad.userName || (isRtl ? "فني مهني" : "Tradesperson")}
                            sizeClassName="w-6 h-6"
                            className="rounded-full"
                          />
                          <span className="text-[10px] font-bold text-slate-400 max-w-[120px] truncate">
                            {ad.userName || (isRtl ? "فني مهني" : "Tradesperson")}
                          </span>
                        </div>

                        {/* Instant Contact CTAs */}
                        <div className="flex items-center gap-2">
                          {ad.contactNumber && (
                            <a
                              href={`tel:${ad.contactNumber}`}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Phone className="w-3 h-3" />
                              {isRtl ? "اتصال فوري" : "Call Now"}
                            </a>
                          )}

                          {ad.whatsappLink && (
                            <a
                              href={ad.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {isRtl ? "واتساب" : "WhatsApp"}
                            </a>
                          )}

                          <button
                            onClick={() => onSelectAd(ad)}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition-all"
                            title={isRtl ? "التفاصيل" : "Details"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}


        {/* Tab 2: Job Seekers CV / Resume Listings */}
        {activeTab === "seekers" && (
          <motion.div
            key="seekers"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {filteredSeekers.length === 0 ? (
              <div className={`p-12 rounded-3xl border text-center ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className={`text-sm font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {isRtl ? "لا توجد سير ذاتية أو طلبات عمل معلنة حالياً" : "No job seeker professional profiles match search."}
                </h3>
                <p className="text-xs text-slate-500/80 mt-1">
                  {isRtl ? "حاول استعراض التخصصات أو التعديل للحصول على نتائج مناسبة." : "Try adjusting categories or keywords."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSeekers.map((ad) => {
                  const hasApplied = applications.some((app) => app.adId === ad.id && app.applicantId === (currentUser?.id || 'guest_user'));
                  const belongsToCurrentUser = ad.userId === (currentUser?.id || 'guest_user');
                  
                  return (
                    <div
                      key={ad.id}
                      className={`p-5 rounded-3xl border hover:shadow-lg transition-all relative flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800/80 hover:border-purple-500/40" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}
                    >
                      <div>
                        {/* Title & Badge */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ad.subCategory || (isRtl ? "طلب عمل" : "Candidate Resume")}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                            {(currentMarket?.cities || CITIES).find(c => c.id === ad.city)?.nameAr || ad.city}
                          </span>
                        </div>

                        {/* Resume / Profile Title */}
                        <h3 className={`text-sm font-black transition-colors hover:text-purple-500 cursor-pointer ${isDark ? "text-white" : "text-slate-900"}`} onClick={() => onSelectAd(ad)}>
                          {ad.title}
                        </h3>

                        {/* Mini Cover Letter/Resume Brief */}
                        <p className={`text-xs mt-2 line-clamp-3 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {ad.description}
                        </p>

                        {/* Preferred Remuneration */}
                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-slate-350 dark:text-slate-500 text-[10px]">{isRtl ? 'الراتب المطلوب المتوقع:' : 'Expected Salary:'}</span>
                          <span className="text-xs font-black text-rose-500">
                            {ad.price > 0 ? `${ad.price.toLocaleString()} ${ad.currency}` : (isRtl ? 'تفاوضي' : 'Negotiable')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
                        {/* Candidate Identity */}
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={ad.userAvatar}
                            name={ad.userName || (isRtl ? "متقدم مؤهل" : "Candidate")}
                            sizeClassName="w-6 h-6"
                            className="rounded-full"
                          />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 max-w-[100px] truncate">
                              {ad.userName || (isRtl ? "متقدم مؤهل" : "Candidate")}
                            </span>
                          </div>
                        </div>

                        {/* CTA Options */}
                        <div className="flex items-center gap-2">
                          {belongsToCurrentUser ? (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">
                              {isRtl ? "ملفك الشخصي المنشور" : "Your Resume"}
                            </span>
                          ) : hasApplied ? (
                            <span className="text-xs font-black text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                              <CheckCircle2 className="w-4 h-4" />
                              {isRtl ? "مرشح بالفعل" : "Offered"}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setApplyingAd(ad);
                                setPhoneInput(currentUser?.phone || "");
                                setEmailInput(currentUser?.email || "");
                                setNameInput(currentUser?.name || "");
                                setExperienceInput("FullTime");
                              }}
                              className="bg-purple-600 hover:bg-purple-750 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              {isRtl ? "عرض توظيف" : "Send Job Offer"}
                            </button>
                          )}

                          <button
                            onClick={() => onSelectAd(ad)}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 p-2 rounded-xl transition-all"
                            title={isRtl ? "تفاصيل السيرة الذاتية" : "View CV"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 3: Management of Opportunities and Received Applications */}
        {activeTab === "management" && (
          <motion.div
            key="management"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Subsection A: Received Applications (Candidate Profiles Submitted on MY Ads) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-5 bg-emerald-500 rounded-full"></div>
                  <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                    {isRtl ? "طلبات التوظيف والترشيحات المستلمة" : "Incoming Applications Received"}
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-3 py-1 rounded-full">
                  {receivedApplications.length} {isRtl ? "مرشحين" : "Applications"}
                </span>
              </div>

              {receivedApplications.length === 0 ? (
                <div className={`p-8 rounded-3xl border text-center ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                  <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500">
                    {isRtl 
                      ? "لم تتلقَ أي طروحات أو طلبات توظيف حتى الآن على إعلاناتك." 
                      : "You have not received any candidate applications yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedApplications.map((app) => (
                    <div
                      key={app.id}
                      className={`p-5 rounded-3xl border transition-all ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200/80 shadow-sm"}`}
                    >
                      <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4">
                        {/* Left Info Column */}
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={app.applicantAvatar}
                              name={app.applicantName}
                              sizeClassName="w-10 h-10"
                              className="rounded-full"
                            />
                            <div>
                              <h4 className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                                {app.applicantName}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {app.applicantPhone}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(app.appliedAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Applied Position Info banner */}
                          <div className={`p-2.5 rounded-xl text-[11px] font-bold inline-block ${isDark ? "bg-slate-950/80 text-emerald-400" : "bg-emerald-500/5 text-emerald-700"}`}>
                            {isRtl ? `التقدم لوظيفة: ${app.adTitle}` : `Applied for: ${app.adTitle}`}
                          </div>

                          {/* Cover letter body */}
                          <p className={`text-xs pl-2 border-l-2 border-emerald-500/30 py-1 leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {app.coverLetter}
                          </p>
                        </div>

                        {/* Status badge & Administration actions */}
                        <div className="flex flex-col sm:flex-row lg:flex-col justify-between items-end gap-3 min-w-[200px]">
                          {/* Current Status display badge */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto uppercase tracking-wide text-[9px] font-extrabold">
                            {app.status === "pending" && (
                              <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full flex items-center gap-1 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                {isRtl ? "قيد المراجعة والتدقيق" : "Under Review"}
                              </span>
                            )}
                            {app.status === "shortlisted" && (
                              <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full flex items-center gap-1 border border-indigo-500/20">
                                <Zap className="w-3 h-3" />
                                {isRtl ? "مرشح مبدئياً" : "Shortlisted"}
                              </span>
                            )}
                            {app.status === "accepted" && (
                              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                {isRtl ? "تم التوظيف / مقبول" : "Accepted"}
                              </span>
                            )}
                            {app.status === "rejected" && (
                              <span className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full flex items-center gap-1 border border-rose-500/20">
                                <XCircle className="w-3 h-3" />
                                {isRtl ? "مستبعد / ملغى" : "Rejected"}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 w-full sm:w-auto mt-2">
                            {app.status === "pending" && (
                              <button
                                onClick={() => handleUpdateAppStatus(app.id, "shortlisted")}
                                className="bg-indigo-600 hover:bg-indigo-750 text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex-1 sm:flex-none cursor-pointer"
                              >
                                {isRtl ? "ترشيح مبدئي" : "Shortlist"}
                              </button>
                            )}
                            
                            {app.status !== "accepted" && (
                              <button
                                onClick={() => handleUpdateAppStatus(app.id, "accepted")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex-1 sm:flex-none flex items-center gap-1 justify-center cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isRtl ? "قبول وتعيين" : "Approve & Hire"}
                              </button>
                            )}

                            {app.status !== "rejected" && (
                              <button
                                onClick={() => handleUpdateAppStatus(app.id, "rejected")}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex-1 sm:flex-none flex items-center gap-1 justify-center cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                {isRtl ? "رفض" : "Reject"}
                              </button>
                            )}

                            {/* Direct Call or WhatsApp button */}
                            <a
                              href={`tel:${app.applicantPhone}`}
                              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 p-2 rounded-xl text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center cursor-pointer"
                              title={isRtl ? "اتصال فوري" : "Call Phone"}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subsection B: My Submitted Applications (Job Applications Sent by Current User) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-5 bg-indigo-505 bg-purple-500 rounded-full"></div>
                  <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                    {isRtl ? "طلبات التوظيف التي تقدمت لها" : "My Sent Applications"}
                  </h3>
                </div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-3 py-1 rounded-full">
                  {sentApplications.length} {isRtl ? "طلبات" : "Sent"}
                </span>
              </div>

              {sentApplications.length === 0 ? (
                <div className={`p-8 rounded-3xl border text-center ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                  <Send className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500">
                    {isRtl 
                      ? "لم تتقدم لأي وظائف أو ترسل عروض عمل حتى الآن." 
                      : "You have not submitted any applications or offers yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentApplications.map((app) => (
                    <div
                      key={app.id}
                      className={`p-5 rounded-3xl border transition-all ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200/80 shadow-sm"}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                          <h4 className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                            {app.adTitle}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {isRtl ? "تاريخ التقديم:" : "Date Sent:"} {new Date(app.appliedAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US')}
                          </p>
                          <p className={`text-xs mt-2 line-clamp-1 italic ${isDark ? "text-slate-550 text-slate-400" : "text-slate-500"}`}>
                            {app.coverLetter}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-xs font-black">
                            {app.status === "pending" && (
                              <span className="text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                                {isRtl ? "قيد الانتظار" : "Pending"}
                              </span>
                            )}
                            {app.status === "shortlisted" && (
                              <span className="text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
                                {isRtl ? "مرشح مبدئي" : "Shortlisted"}
                              </span>
                            )}
                            {app.status === "accepted" && (
                              <span className="text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                                {isRtl ? "مقبول وموظف" : "Accepted"}
                              </span>
                            )}
                            {app.status === "rejected" && (
                              <span className="text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full">
                                {isRtl ? "تم الاعتذار" : "Declined"}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleWithdrawApp(app.id)}
                            className="text-rose-500 hover:bg-rose-500/15 p-2 rounded-xl transition-all cursor-cross"
                            title={isRtl ? "سحب الطلبات والترشيح" : "Withdraw Application"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop-up Interactive Quick Application Modal */}
      <AnimatePresence>
        {applyingAd && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg rounded-3xl p-6 relative shadow-2xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            >
              <button
                onClick={() => setApplyingAd(null)}
                className="absolute top-4 left-4 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <h4 className={`text-base font-black mb-1 p-2 border-b leading-relaxed ${isDark ? "text-white border-slate-800" : "text-slate-900 border-slate-100"}`}>
                {applyingAd.jobType === "seeking"
                  ? (isRtl ? `تقديم عرض عمل لـ: ${applyingAd.title}` : `Offer Job to: ${applyingAd.title}`)
                  : (isRtl ? `التقدم للفرصة: ${applyingAd.title}` : `Apply for Opportunity: ${applyingAd.title}`)
                }
              </h4>

              <form onSubmit={handleApplySubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    {applyingAd.jobType === "seeking"
                      ? (isRtl ? "اسم جهة العمل / الشركة" : "Employer / Company Name")
                      : (isRtl ? "الاسم الرباعي الكامل للمتقدم" : "Full Name")
                    }
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      {isRtl ? "رقم الهاتف والاتصال السريع" : "Quick Contact Phone"}
                    </label>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      required
                      placeholder="+967 77xxxxxxx"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-805 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      {isRtl ? "الإيميل الإلكتروني (اختياري)" : "E-mail (Optional)"}
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-805 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    {applyingAd.jobType === "seeking"
                      ? (isRtl ? "نوع العمل المعروض" : "Offered Job Type")
                      : (isRtl ? "المستوى المهني / سنوات الخبرة" : "Professional Level / Experience")
                    }
                  </label>
                  <select
                    value={experienceInput}
                    onChange={(e) => setExperienceInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                  >
                    {applyingAd.jobType === "seeking" ? (
                      <>
                        <option value="FullTime">{isRtl ? "دوام كامل" : "Full Time"}</option>
                        <option value="PartTime">{isRtl ? "دوام جزئي" : "Part Time"}</option>
                        <option value="Contract">{isRtl ? "عقد / عمل مؤقت" : "Contract / Project-based"}</option>
                        <option value="Remote">{isRtl ? "عمل عن بعد" : "Remote Work"}</option>
                      </>
                    ) : (
                      <>
                        <option value="Junior">{isRtl ? "مبتدئ / حديث التخرج (أقل من سنة)" : "Junior (Fresh / < 1 year)"}</option>
                        <option value="Intermediate">{isRtl ? "متوسط الخبرة (1-4 سنوات)" : "Intermediate (1-4 years)"}</option>
                        <option value="Senior">{isRtl ? "خبير (أكثر من 5 سنوات أو رائد)" : "Senior (5+ years)"}</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    {applyingAd.jobType === "seeking"
                      ? (isRtl ? "تفاصيل ومميزات عرض العمل المعروض" : "Job Offer Details & Benefits")
                      : (isRtl ? "رسالة التغطية والخبرات المهنية" : "Cover Letter & Key Skills")
                    }
                  </label>
                  <textarea
                    rows={4}
                    value={coverLetterInput}
                    onChange={(e) => setCoverLetterInput(e.target.value)}
                    placeholder={applyingAd.jobType === "seeking"
                      ? (isRtl 
                        ? "اكتب تفاصيل الوظيفة المعروضة للمرشح، الراتب المتوقع، مكان العمل، والمزايا والمهام المطلوبة..." 
                        : "Describe the offered position details, work location, salary package, duties, and benefits...")
                      : (isRtl 
                        ? "اكتب نبذة ممتازة عن مؤهلاتك، المشاريع التي أنجزتها، مهاراتك الفريدة، ولماذا تعتبر الشخص الأمثل لشغل هذه الفرصة..." 
                        : "Introduce yourself, mention key experiences, certifications, your professional skills, and why you are the best candidate...")
                    }
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingAd(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-350 text-xs font-black py-3 rounded-2xl transition-all cursor-pointer"
                  >
                    {isRtl ? "تراجع" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    <Send className="w-4 h-4" />
                    {applyingAd.jobType === "seeking"
                      ? (isRtl ? "إرسال عرض العمل" : "Send Job Offer")
                      : (isRtl ? "إرسال طلب التوظيف سريعاً" : "Submit Application")
                    }
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
