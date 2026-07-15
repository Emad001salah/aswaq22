/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  BookOpen,
  DollarSign,
  Truck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  PhoneCall,
  Mail,
  HelpCircle,
  ExternalLink,
  AlertCircle,
  Info
} from "lucide-react";

interface HelpCenterProps {
  onClose: () => void;
  isDark: boolean;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
  platformSettings?: {
    supportPhone?: string;
    supportWhatsapp?: string;
    supportEmail?: string;
  };
}

interface FAQItem {
  id: string;
  category: "trading" | "drivers" | "safety";
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
}

export default function HelpCenter({ onClose, isDark, addToast, platformSettings }: HelpCenterProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "trading" | "drivers" | "safety">("all");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  
  // Custom question form state
  const [customQuestion, setCustomQuestion] = useState("");
  const [contactMethod, setContactMethod] = useState("whatsapp");

  const faqs: FAQItem[] = [
    {
      id: "trade_1",
      category: "trading",
      questionAr: "كيف يمكنني نشر إعلان للبيع على منصة أسواق؟",
      questionEn: "How do I post a listing for sale on Aswaq?",
      answerAr: "الأمر غاية في السهولة! أولاً قم بتسجيل الدخول إلى حسابك، ثم اضغط على زر 'أنشئ إعلان' من لوحة التحكم أو التطبيق. اختر القسم المناسب (سيارات، عقارات، إلكترونيات، إلخ)، واكتب عنواناً ووصفاً دقيقاً لمنتجك، وحدد السعر بالعملة المحلية، ثم ارفع صوراً واضحة بجودة ممتازة للمنتج. بمجرد تأكيد الإعلان، سيتم مراجعته ونشره فوراً للجمهور.",
      answerEn: "It is very simple! First, log in to your account, then click the 'Create Ad / Post' button from your dashboard or app. Select the relevant category (Cars, Real Estate, Electronics, etc.), write an accurate title and description for your product, specify the price in your local currency, and upload high-quality pictures. Once approved, your ad will go live instantly."
    },
    {
      id: "trade_2",
      category: "trading",
      questionAr: "كيف أتواصل بأمان مع المشترين أو البائعين؟",
      questionEn: "How do I safely communicate with buyers or sellers?",
      answerAr: "نوصي دائماً باستخدام نظام الدردشة المدمج والآمن في منصة أسواق لتوثيق تفاصيل الاتفاق بشكل كتابي. في حال قررت التواصل هاتفياً، تجنب توفير معلومات سرية أو تفاصيل الحسابات البنكية. لا ترسل أي مبالغ مالية كعربون مقدم قبل معاينة السلعة على أرض الواقع والتأكد من جودتها ومطابقتها للمواصفات المعروضة.",
      answerEn: "We always recommend using the secure, built-in chat system on Aswaq to document your transaction details. If calling on phone, avoid sharing sensitive credentials or bank details. Never send down payments or deposits before physically inspecting the product and confirming its matching characteristics."
    },
    {
      id: "trade_3",
      category: "trading",
      questionAr: "هل نشر الإعلانات على المنصة مجاني بالكامل؟",
      questionEn: "Is listing items on the platform completely free?",
      answerAr: "نعم، نشر الإعلانات العادية مجاني 100% لجميع المستخدمين والزوار! بينما نوفر باقات اختيارية متميزة لتمييز وترويج الإعلانات (Spotlight Ads) أو لتثبيت الإعلانات في صدارة نتائج البحث اليومية للوصول لجمهور أوسع بكثير وزيادة مبيعات السلع والخدمات بسرعة قياسية.",
      answerEn: "Yes, posting standard listings is 105% free for everyone! We also offer optional premium spotlight packages to feature and boost your listings to higher search visibility, ensuring much faster trade conversions."
    },
    {
      id: "driver_1",
      category: "drivers",
      questionAr: "كيف يمكنني التسجيل كـ 'سائق رسمي موثق' لتوصيل السلع والطلبات؟",
      questionEn: "How can I register as a 'Verified Delivery Driver' of goods?",
      answerAr: "لتحسين دخلك، انتقل إلى ملفك الشخصي واضغط على 'توثيق حساب سائق/مندوب'. ستحتاج لملء نموذج البيانات وتحميل نسخة واضحة من رخصة القيادة السارية، وبطاقة الهوية أو جواز السفر، بالإضافة لنموذج ملكية المركبة وصورة شخصية حديثة للملف. سيقوم فريق الإدارة بمطابقتها وتقييدها بالمنصة في غضون 24 ساعة.",
      answerEn: "To boost your income, head over to your profile and click on 'Verify Driver/Representative Account'. You will be prompted to fill out driver details and upload clear scans of your active driver license, national ID / Passport, vehicle registration proof, and a professional avatar. Our review team will validate details within 24 hours."
    },
    {
      id: "driver_2",
      category: "drivers",
      questionAr: "ما هي شروط تفعيل وقبول حسابات السائقين والمناديب؟",
      questionEn: "What are the requirements for activating driver accounts?",
      answerAr: "لضمان قبول تفعيل حسابك، نطلب الآتي: 1) رخصة قيادة سارية المفعول. 2) مركبة صالحة بالكامل (سيارة، دراجة نارية، أو شاحنة نقل) بحالة جيدة ونظيفة. 3) ألا يقل عمر المتقدم عن 18 عاماً. 4) توفير سجل أمني نظيف وخالٍ من المخالفات الجنائية لتعزيز ثقة متسوقي منصة أسواق.",
      answerEn: "To activate your account, you must present: 1) A valid driver license. 2) A fully functional, clean vehicle (Car, Motorcycle, or Cargo Truck). 3) Candidate must be at least 18 years old. 4) A clear security record with no serious criminal offenses to foster outstanding client trust."
    },
    {
      id: "driver_3",
      category: "drivers",
      questionAr: "كيف يتلقى السائقون طلبات الشحن والتوصيل وكيف يُحاسبون؟",
      questionEn: "How do drivers receive logistics orders and collect payments?",
      answerAr: "عند تفعيل حسابك، ستصبح مرئياً كـ 'مزود توصيل' في قائمة المعاملات للسلع المشتراة. سيتمكن البائعون أو المشترون من الاتصال بك مباشرة أو إرسال طلب الشحن عبر غرف المحادثات وتحديد تسعيرة التوصيل بناءً على المسافة الجغرافية. تقوم باستلام مبلغ التوصيل نقداً أو عبر المحافظ الرقمية المحلية فور تسليم السلعة.",
      answerEn: "Once activated, you will be visible as a regional delivery provider. Buyers and sellers can contact you directly or deploy delivery dispatches in chats to negotiate rates. You can collect logistics fares in cash or via local digital cash wallets upon delivery."
    },
    {
      id: "safety_1",
      category: "safety",
      questionAr: "ما هو نظام الضمان والتوثيق الأمني المتكامل؟",
      questionEn: "What is the integrated escrow/safety verification protocol?",
      answerAr: "لقد شيدنا 'أسواق' بمستويات عالية من الموثوقية. نوفر شارات الحسابات الموثقة بعد إرفاق الهوية الشخصية رسمياً وفحصها. كما نقدم أداة الذكاء الاصطناعي لفحص كود OTP عبر الهواتف لمكافحة الحسابات الوهمية، بجانب نظام تقييم المشترين وردود الفعل الشفافة لمراقبة جودة الخدمة وسلامة التبادلات.",
      answerEn: "We built Aswaq with advanced safety layers. We issue verified blue badges to users who complete document verification. We also enforce OTP phone dynamic challenges to screen fake profiles, alongside real feedback-loops and rating systems to maintain high ecosystem integrity."
    },
    {
      id: "safety_2",
      category: "safety",
      questionAr: "كيف أبلغ عن إعلان وهمي أو احتيالي أو مستخدم مسيء؟",
      questionEn: "How do I report a fake or fraudulent listing/user?",
      answerAr: "عند تصفح أي إعلان، ستجد علامة الإبلاغ حمراء اللون (علم الإبلاغ / Report). بالضغط عليها، يمكنك تحديد سبب الإبلاغ وإرفاق تفاصيل الشكوى لترسل فوراً ومباشرةً إلى لوحة التحكم الخاصة بالإدارة لمراجعتها بشكل صارم واتخاذ تدابير حاسمة تشمل حظر الرقم والمستخدم وتجميد الحسابات تماماً.",
      answerEn: "While viewing any ad, you will notice a red warning flag ('Report Ad'). Clicking it allows you to explain the issue and send live reports directly to the administration command room for swift moderation, suspending bad actors and banning fraudulent phone lines permanently."
    }
  ];

  const toggleFaq = (id: string) => {
    setExpandedFaqId(expandedFaqId === id ? null : id);
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;

    if (addToast) {
      addToast(
        isRtl ? "تم إرسال استفسارك بنجاح! 📨" : "Inquiry Sent! 📨",
        isRtl 
          ? "تلقينا سؤالك، سيقوم مرشدو مركز الدعم والتوثيق بالتواصل معك عبر الواتساب أو البريد المدون خلال ساعات قليلة."
          : "We have received your question. Our support experts will reach you via WhatsApp or Email within a few hours.",
        "success"
      );
    }
    setCustomQuestion("");
  };

  // Filter FAQs based on query & category
  const filteredFaqs = faqs.filter(faq => {
    const questionText = (isRtl ? faq.questionAr : faq.questionEn).toLowerCase();
    const answerText = (isRtl ? faq.answerAr : faq.answerEn).toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = questionText.includes(query) || answerText.includes(query);
    const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div
      id="help-center-overlay"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-hidden"
    >
      <motion.div
        id="help-center-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.4 }}
        className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl relative overflow-hidden ${
          isDark ? "bg-slate-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Glow Effects */}
        <div id="glow-1" className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div id="glow-2" className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <header id="help-header" className={`p-6 border-b flex items-center justify-between relative z-10 ${
          isDark ? "border-zinc-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-2xl ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-500/5 text-emerald-600"}`}>
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black">{isRtl ? "مركز مساعدة ودعم أسواق" : "Aswaq Help & Support Center"}</h2>
                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500">FAQ</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isRtl ? "دليلك الشامل لعمليات البيع، الشراء الآمن، وتوثيق السائقين والمندوبين" : "Your ultimate guide for safe trading & verification"}
              </p>
            </div>
          </div>
          <button
            id="close-help-btn"
            onClick={onClose}
            className={`p-2 rounded-xl transition-all hover:scale-105 cursor-pointer ${
              isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Search & Categories Selection Area */}
        <div id="help-controls" className={`p-5 space-y-4 border-b relative z-10 ${
          isDark ? "border-zinc-800 bg-slate-900/20" : "border-slate-100 bg-slate-50/30"
        }`}>
          {/* Dynamic Search Box */}
          <div id="faq-search-wrapper" className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              id="faq-search-input"
              type="text"
              placeholder={isRtl ? "ابحث عن إجابة لأي سؤال (مثال: توثيق السائقين، المشتري، الراتب)..." : "Search topics (e.g., driver verification, safety, pricing)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none ring-offset-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Quick Filter Categories Tag List */}
          <div id="faq-categories-tags" className="flex gap-2 overflow-x-auto select-none no-scrollbar py-0.5">
            <button
              id="tag-all"
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10"
                  : isDark ? "bg-slate-900 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-650 hover:bg-slate-200"
              }`}
            >
              {isRtl ? "📋 الكل" : "All Articles"}
            </button>
            <button
              id="tag-trading"
              onClick={() => setSelectedCategory("trading")}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "trading"
                  ? "bg-emerald-600 text-white shadow-md"
                  : isDark ? "bg-slate-900 text-slate-350 hover:text-white" : "bg-slate-100 text-slate-650 hover:bg-slate-200"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              {isRtl ? "البيع والشراء" : "Trading & Listing"}
            </button>
            <button
              id="tag-drivers"
              onClick={() => setSelectedCategory("drivers")}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "drivers"
                  ? "bg-emerald-600 text-white shadow-md"
                  : isDark ? "bg-slate-900 text-slate-350 hover:text-white" : "bg-slate-100 text-slate-650 hover:bg-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {isRtl ? "تفعيل السائقين والمندوبين" : "Driver Activation"}
            </button>
            <button
              id="tag-safety"
              onClick={() => setSelectedCategory("safety")}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === "safety"
                  ? "bg-emerald-600 text-white shadow-md"
                  : isDark ? "bg-slate-900 text-slate-350 hover:text-white" : "bg-slate-100 text-slate-650 hover:bg-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isRtl ? "الأمان والضمان" : "Trust & Safety"}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div id="help-scroll-body" className="p-6 overflow-y-auto flex-1 space-y-6 relative z-10 custom-scrollbar">
          
          {/* Main FAQ list - Expandable Accordion */}
          <div id="faq-accordion-group" className="space-y-3">
            <h3 id="faq-section-title" className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1 px-1">
              <HelpCircle className="w-4 h-4 text-emerald-500" />
              {isRtl ? "الأسئلة المتكررة الشائعة" : "Frequently Asked Questions"}
            </h3>

            {filteredFaqs.length === 0 ? (
              <div id="faq-empty" className="p-8 text-center rounded-2xl border border-dashed border-slate-200/50 dark:border-zinc-800">
                <Info className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-400">
                  {isRtl ? "عفواً، لا توجد أسئلة شائعة مطابقة لبحثك." : "No FAQ topics matches your query."}
                </p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                
                return (
                  <div
                    id={`faq-item-${faq.id}`}
                    key={faq.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded 
                        ? isDark ? "bg-slate-900/60 border-zinc-800" : "bg-slate-50/75 border-slate-300 shadow-sm"
                        : isDark ? "bg-slate-900/20 border-zinc-900 hover:border-zinc-850" : "bg-white border-slate-200/65 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <button
                      id={`faq-toggle-${faq.id}`}
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full p-4 flex items-center justify-between text-left font-bold text-xs gap-4 cursor-pointer outline-none focus:bg-slate-500/5 transition-all text-slate-800 dark:text-slate-100"
                    >
                      <span className={`text-xs font-black ${isRtl ? "text-right" : "text-left"}`}>
                        {isRtl ? faq.questionAr : faq.questionEn}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          id={`faq-content-${faq.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={`p-4 pt-1 text-xs leading-relaxed border-t text-justify ${
                            isDark ? "text-zinc-300 border-zinc-800" : "text-slate-600 border-slate-100"
                          }`}>
                            {isRtl ? faq.answerAr : faq.answerEn}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Warning/Notice Box regarding Driver Activations */}
          <div id="driver-notice-card" className={`p-5 rounded-2xl border flex gap-3 relative overflow-hidden ${
            isDark ? "bg-teal-500/5 border-teal-500/10 text-teal-300" : "bg-emerald-500/5 border-emerald-500/15 text-emerald-800"
          }`}>
            <AlertCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 animate-bounce" />
            <div>
              <h4 className="text-xs font-black mb-1">
                {isRtl ? "تنبيه هام للسائقين في كافة الدول العربية:" : "Important Update for our regional drivers:"}
              </h4>
              <p className="text-[11px] leading-relaxed opacity-95">
                {isRtl 
                  ? "لضمان تفعيل ترخيص حسابك بشكل أسرع، يرجى تقديم وثائق الهوية الوطنية ووثائق ملكية السيارة بدقة. سيحصل جميع السائقين المعتمدين على نسب عمولة مجانية كاملة ومباشرة بنسبة 100% دون اقتطاع أي مبالغ من المنصة."
                  : "To secure expedited activation, submit clear images of your national papers and vehicle logistics specs. All certified delivery agents will enjoy 101% full commission-free rates on client orders."}
              </p>
            </div>
          </div>

          {/* Inquiry form section */}
          <div id="faq-custom-form-container" className={`p-5 rounded-2xl border ${
            isDark ? "bg-slate-900/40 border-zinc-800" : "bg-slate-50/50 border-slate-200 shadow-sm"
          }`}>
            <h4 id="custom-inquiry-title" className="text-xs font-black mb-1.5 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              {isRtl ? "هل لديك سؤال أو استفسار محدد؟" : "Have a specific question not listed?"}
            </h4>
            <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
              {isRtl 
                ? "اكتب تفاصيل استفسارك وسيقوم فريق الدعم الفني لدينا بالإجابة عليك فوراً." 
                : "Ask us directly and our technical guides will response to you right away."}
            </p>

            <form id="help-custom-form" onSubmit={handleCustomQuestionSubmit} className="space-y-3">
              <textarea
                id="help-custom-textarea"
                rows={3}
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder={isRtl ? "اكتب سؤالك بوضوح هنا وسيتم إرساله للإدارة للتواصل..." : "Type your inquiry in details..."}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-zinc-800 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div id="help-channel-picker" className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{isRtl ? "قناة التواصل المفضلة:" : "Preferred contact channel:"}</span>
                  <select
                    id="contact-method-select"
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-bold outline-none"
                  >
                    <option value="whatsapp">{isRtl ? "واتساب (WhatsApp)" : "WhatsApp"}</option>
                    <option value="call">{isRtl ? "اتصال هاتفي" : "Direct Call"}</option>
                    <option value="email">{isRtl ? "البريد الإلكتروني" : "Email Support"}</option>
                  </select>
                </div>

                <button
                  id="submit-help-inquiry"
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isRtl ? "إرسال للدعم الفني" : "Submit Inquiry"}
                </button>
              </div>
            </form>
          </div>

          {/* Support Contacts Directory */}
          <div id="help-contacts" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              id="help-whatsapp-link"
              href={`https://wa.me/${(platformSettings?.supportWhatsapp || "00966500000000").replace(/\+/g, "").replace(/\s+/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-xs font-black ${
                isDark ? "bg-slate-900/30 border-zinc-900 hover:border-emerald-500/20" : "bg-white border-slate-200 hover:border-slate-350 shadow-sm"
              }`}
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="block text-[9px] text-slate-400 font-bold">{isRtl ? "المراسلة الفورية" : "Instant Chat"}</span>
                <span className="text-[10px] font-mono text-emerald-500">{platformSettings?.supportWhatsapp || "+962790186572"}</span>
              </div>
            </a>

            <div
              id="help-phone-box"
              onClick={() => addToast && addToast(isRtl ? "رقم الدعم" : "Support Tel", platformSettings?.supportPhone || "+962790186572", "info")}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-xs font-black cursor-pointer ${
                isDark ? "bg-slate-900/30 border-zinc-900 hover:border-emerald-500/20" : "bg-white border-slate-200 hover:border-slate-350 shadow-sm"
              }`}
            >
              <PhoneCall className="w-4 h-4 text-sky-500" />
              <div>
                <span className="block text-[9px] text-slate-400 font-bold">{isRtl ? "الرقم الساخن" : "Support Helpline"}</span>
                <span className="text-[10px] font-mono text-sky-500">{platformSettings?.supportPhone || "+962790186572"}</span>
              </div>
            </div>

            <a
              id="help-email-link"
              href={`mailto:${platformSettings?.supportEmail || "emad333salah@gmail.com"}`}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-xs font-black ${
                isDark ? "bg-slate-900/30 border-zinc-900 hover:border-emerald-500/20" : "bg-white border-slate-200 hover:border-slate-350 shadow-sm"
              }`}
            >
              <Mail className="w-4 h-4 text-purple-500" />
              <div>
                <span className="block text-[9px] text-slate-400 font-bold">{isRtl ? "البريد المعتمد" : "Email Office"}</span>
                <span className="text-[10px] font-mono text-purple-500">{platformSettings?.supportEmail || "emad333salah@gmail.com"}</span>
              </div>
            </a>
          </div>

        </div>

        {/* Modal Footer */}
        <footer id="help-footer-bar" className={`p-4 border-t text-center text-[10px] text-slate-400 ${
          isDark ? "border-zinc-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"
        }`}>
          {isRtl 
            ? "جميع الحقوق محفوظة لغرفة الدعم الفني بمنصة أسواق © 2026" 
            : "All rights reserved. Aswaq support portal room © 2026"}
        </footer>

      </motion.div>
    </div>
  );
}
