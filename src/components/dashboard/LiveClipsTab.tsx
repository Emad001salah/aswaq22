/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Video, Camera, Eye, Trash2, Loader2 } from "lucide-react";
import { User } from "../../types.ts";

interface LiveClipsTabProps {
  currentUser: User;
  isDark: boolean;
  onTabChange: (tab: string) => void;
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
}

export default function LiveClipsTab({
  currentUser,
  isDark,
  onTabChange,
  addToast,
}: LiveClipsTabProps) {
  const isRtl = true;
  const [userReels, setUserReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);

  // Fetch user's own reels
  const fetchUserReels = () => {
    let active = true;
    setLoadingReels(true);

    fetch("/api/promo")
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (Array.isArray(data)) {
          const filtered = data
            .filter(r => r.userId === currentUser.id || (currentUser.id === "guest_user" && r.userId === "guest_user"))
            .map(r => {
              const isWebcam = r.videoUrl === 'webcam' || r.videoUrl === 'camera';
              return {
                ...r,
                isLive: isWebcam,
                isPromo: true,
                views: r.views || 0,
                thumbnailUrl: r.thumbnailUrl || (isWebcam 
                  ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80"
                  : "https://picsum.photos/seed/promo/800/400")
              };
            });
          setUserReels(filtered);
        }
        setLoadingReels(false);
      })
      .catch(err => {
        console.error("Failed to load user reels:", err);
        if (active) setLoadingReels(false);
      });

    return () => {
      active = false;
    };
  };

  useEffect(() => {
    fetchUserReels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleDeleteReel = async (reelId: string) => {
    if (!window.confirm(isRtl ? "هل أنت متأكد من حذف هذا المقطع الترويجي نهائياً؟" : "Are you sure you want to permanently delete this promo?")) return;
    try {
      const res = await fetch(`/api/promo/${reelId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setUserReels(prev => prev.filter(r => r.id !== reelId));
        addToast?.(
          isRtl ? "نجاح" : "Success",
          isRtl ? "تم حذف المقطع الترويجي بنجاح." : "Promo clip deleted successfully.",
          "success"
        );
      } else {
        const err = await res.json().catch(() => ({}));
        alert(isRtl ? `فشل الحذف: ${err.error || ''}` : `Failed to delete: ${err.error || ''}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-rose-500" />
            مقاطع البث المباشر والترويج
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            هنا يمكنك استعراض مقاطع البث المباشر السابقة وإدارة القصص الترويجية الخاصة بك.
          </p>
        </div>
        <button
           onClick={() => onTabChange("create-ad")}
           className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer"
        >
           <Camera className="w-4 h-4" />
           تسجيل مقطع ترويجي جديد
        </button>
      </div>

      {loadingReels ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-bold">{isRtl ? 'جاري تحميل مقاطع البث والريلز...' : 'Loading live clips & reels...'}</p>
        </div>
      ) : userReels.length === 0 ? (
        <div className="py-16 text-center rounded-[2rem] border border-dashed border-slate-800 bg-slate-900/40 text-slate-500">
          <div className="w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center mx-auto mb-4 border border-slate-800">
            <Video className="w-8 h-8 text-slate-800" />
          </div>
          <p className="text-sm font-bold">لا توجد سجلات بث أو مقاطع محفوظة حالياً</p>
          <p className="text-[10px] mt-1">عند قيامك ببدء بث مباشر، أو نشر ريلز، ستظهر النسخة هنا تلقائياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {userReels.map(promo => (
            <div key={promo.id} className="group relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-rose-500/50 transition-all aspect-[9/16]">
              {promo.thumbnailUrl ? (
                <img src={promo.thumbnailUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                  <Video className="w-12 h-12 text-slate-800 group-hover:text-rose-500/20 transition-colors" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                <h4 className="text-sm font-black text-white line-clamp-2">{promo.title}</h4>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <Eye className="w-3.5 h-3.5" />
                    {promo.views || 0} مشاهدة
                  </div>
                  <div className="flex gap-2 z-10">
                    <button
                      onClick={() => handleDeleteReel(promo.id)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer"
                      title={isRtl ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (typeof (window as any).setPlatformMode === 'function') {
                          (window as any).setPlatformMode('reels');
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center transition-all cursor-pointer"
                      title={isRtl ? "عرض في ريلز" : "View in Reels"}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              {promo.isLive && (
                <div className="absolute top-4 right-4 bg-rose-600 text-white px-2 py-0.5 rounded text-[8px] font-black animate-pulse shadow-lg z-10">
                  LIVE 🔴
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
