/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { User } from "../../types.ts";

interface ReviewsTabProps {
  currentUser: User;
  chatRooms: any[];
  ratedConversationIds: string[];
  setRatedConversationIds: React.Dispatch<React.SetStateAction<string[]>>;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
}

export default function ReviewsTab({
  currentUser,
  chatRooms,
  ratedConversationIds,
  setRatedConversationIds,
  addToast,
}: ReviewsTabProps) {
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [reviewPartnerName, setReviewPartnerName] = useState("");
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const handleSubmitReview = async () => {
    if (!reviewTarget || reviewScore === 0) return;
    setReviewing(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: reviewTarget,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar || '',
          rating: reviewScore,
          comment: reviewComment,
        }),
      });

      if (response.ok) {
        setReviewSuccess(true);
        const matchedRoom = chatRooms.find((r: any) => r.partnerId === reviewTarget);
        if (matchedRoom) {
          const newRated = [...ratedConversationIds, matchedRoom.id];
          setRatedConversationIds(newRated);
          localStorage.setItem("ashwaq_completed_ratings", JSON.stringify(newRated));
        }
        addToast?.("تم التقييم بنجاح", "تم حفظ تعليقك وتقييمك للتاجر بنجاح.", "success");
        setTimeout(() => {
          setReviewSuccess(false);
          setReviewTarget(null);
          setReviewScore(0);
          setReviewComment("");
        }, 2000);
      } else {
        addToast?.("فشل التقييم", "حدث خطأ أثناء إرسال تقييمك.", "error");
      }
    } catch (e) {
      console.error("Review failed", e);
      addToast?.("خطأ اتصال", "تعذر الاتصال بالخادم لحفظ التقييم.", "error");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">
            تقييم التجار والمحلات
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            ساهم في بناء مجتمع موثوق من خلال تقييم تجربتك مع البائعين بعد
            التواصل معهم.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* List of sellers to review (based on recent chats/interactions) */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-200">
            تجار تواصلت معهم مؤخراً
          </h4>
          {chatRooms.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
              لا توجد محادثات سابقة لتقييمها حالياً. تواصل مع البائعين لظهورهم هنا.
            </div>
          ) : (
            <div className="space-y-3">
              {chatRooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer text-right"
                  onClick={() => {
                    if (ratedConversationIds.includes(room.id)) return;
                    setReviewTarget(room.partnerId);
                    setReviewPartnerName(room.partnerName);
                    setReviewScore(0);
                    setReviewComment("");
                    setReviewSuccess(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={room.partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                      alt={room.partnerName}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-100">
                        {room.partnerName}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        بخصوص: {room.adTitle}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (ratedConversationIds.includes(room.id)) return;
                      setReviewTarget(room.partnerId);
                      setReviewPartnerName(room.partnerName);
                      setReviewScore(0);
                      setReviewComment("");
                      setReviewSuccess(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all shadow-lg cursor-pointer ${
                      ratedConversationIds.includes(room.id)
                        ? "bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed"
                        : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    }`}
                  >
                    {ratedConversationIds.includes(room.id)
                      ? "تم التقييم"
                      : "إضافة تقييم ★"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Input Form (Conditional) */}
        <div>
          {reviewTarget ? (
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-emerald-500/30 shadow-xl shadow-emerald-500/5 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  تقييم التاجر: {reviewPartnerName}
                </h4>
                <button
                  onClick={() => setReviewTarget(null)}
                  className="text-slate-500 hover:text-white"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 block text-right">
                    اختر عدد النجوم (مدى الرضا عن التعامل)
                  </label>
                  <div className="flex flex-row-reverse justify-end gap-2">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewScore(star)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer ${
                          reviewScore >= star
                            ? "bg-amber-500 text-slate-950 border-amber-400 scale-110 shadow-lg shadow-amber-500/10"
                            : "bg-slate-950 text-slate-600 border border-slate-800"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 text-right">
                    {reviewScore === 5
                      ? "ممتاز واحترافي جداً"
                      : reviewScore === 4
                        ? "جيد جداً وتعامل مريح"
                        : reviewScore === 3
                          ? "مقبول، يحتاج لبعض التحسين"
                          : reviewScore === 2
                            ? "غير مرضي تماماً"
                            : reviewScore === 1
                              ? "سيء جداً، لا أنصح به"
                              : "يرجى تحديد تقييم"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 block text-right">
                    تعليقك على التعامل (اختياري)
                  </label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 outline-none focus:border-emerald-500 text-xs leading-relaxed text-right"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="شاركنا رأيك بتجربة الشراء أو التواصل لتعم الفائدة..."
                  />
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={reviewScore === 0 || reviewing}
                  className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black h-11 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reviewing ? "جاري حفظ التقييم..." : "إرسال التقييم ونشره"}
                </button>

                {reviewSuccess && (
                  <div className="p-3 bg-emerald-950 border border-emerald-500/50 rounded-xl text-center text-emerald-400 text-[10px] font-bold">
                    🎉 شكراً لك! تم حفظ تقييمك للتاجر بنجاح وسيساهم في موثوقية المنصة.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/20 h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Star className="w-8 h-8 text-slate-700" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-bold text-slate-400">
                  بانتظار اختيار تاجر لتقييمه
                </p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                  اختر أحد البائعين من القائمة الجانبية لتتمكن من كتابة تقييمك ورأيك في التعامل معه.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
