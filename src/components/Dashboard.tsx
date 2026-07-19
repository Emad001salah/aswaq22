/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Plus,
  Trash2,
  Star,
  Home,
  Video,
  Briefcase,
  CheckCircle2,
  X
} from "lucide-react";
import { Avatar } from "./Avatar.tsx";
import JobPortal from "./JobPortal.tsx";
import { User, Ad, ChatMessage, AppNotification } from "../types.ts";
import { CATEGORIES, INITIAL_USERS } from "../data.ts";
import socket, { joinRoom } from "../lib/socket.ts";
import { Market } from "../markets.ts";
import { ErrorBoundary, lazyRetry } from "./ErrorBoundary.tsx";

// Lazy-loaded Tab Subcomponents with Chunk Load Failure handling
const CreateAdTab = lazyRetry(() => import("./dashboard/CreateAdTab.tsx"));
const MyAdsTab = lazyRetry(() => import("./dashboard/MyAdsTab.tsx"));
const MessagesTab = lazyRetry(() => import("./dashboard/MessagesTab.tsx"));
const ReviewsTab = lazyRetry(() => import("./dashboard/ReviewsTab.tsx"));
const LiveClipsTab = lazyRetry(() => import("./dashboard/LiveClipsTab.tsx"));
const AnalyticsTab = lazyRetry(() => import("./dashboard/AnalyticsTab.tsx"));
const SettingsTab = lazyRetry(() => import("./dashboard/SettingsTab.tsx"));

interface DashboardProps {
  currentUser: User;
  currentMarket: Market;
  ads: Ad[];
  onAdCreated: (newAd: Ad) => void;
  onAdDeleted: (adId: string) => void;
  onAdStatusChange: (adId: string, status: "active" | "sold") => void;
  onAdUpdated?: (updatedAd: Ad) => void;
  initialTab: string;
  onTabChange: (tab: string) => void;
  onSelectAd: (ad: Ad) => void;
  isDark: boolean;
  unreadMessagesCount?: number;
  categories?: any[];
  addToast?: (title: string, desc: string, type: "success" | "error" | "info" | "notification") => void;
}

export default function Dashboard({
  currentUser,
  currentMarket,
  ads,
  onAdCreated,
  onAdDeleted,
  onAdStatusChange,
  onAdUpdated,
  initialTab,
  onTabChange,
  onSelectAd,
  isDark,
  unreadMessagesCount = 0,
  categories: categoriesProp,
  addToast,
}: DashboardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const categories = categoriesProp || CATEGORIES;
  const activeTab = initialTab;

  const isGuest = currentUser.id === "guest_user";

  // Shared state for editing ads
  const [editingAd, setEditingAd] = useState<Ad | null>(null);

  // Message Hub / Chat Room states
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [activeChats, setActiveChats] = useState<ChatMessage[]>([]);

  // Rating Modal states
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [roomToRate, setRoomToRate] = useState<any | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratedConversationIds, setRatedConversationIds] = useState<string[]>([]);

  // Delete confirmation dialog states
  const [adToDeleteId, setAdToDeleteId] = useState<string | null>(null);
  const [adToDeleteTitle, setAdToDeleteTitle] = useState<string>("");

  // Load rated conversations on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ashwaq_completed_ratings");
      if (stored) {
        setRatedConversationIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading rated conversations:", e);
    }
  }, []);

  // Fetch chat rooms from backend
  const fetchChatRooms = async () => {
    try {
      let dynamicUsers: any[] = [];
      try {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          dynamicUsers = await usersRes.json();
        }
      } catch (err) {
        console.error("Error fetching dynamic users", err);
      }

      const chatRes = await fetch("/api/messages");
      const contentType = chatRes.headers.get("content-type");
      if (chatRes.ok && contentType && contentType.includes("application/json")) {
        const allMessages: ChatMessage[] = await chatRes.json();

        // Group messages by (adId, partnerId)
        const roomsMap = new Map<string, ChatMessage[]>();

        allMessages.forEach((msg) => {
          const isMySent = msg.senderId === currentUser.id;
          const isMyReceived = msg.receiverId === currentUser.id;

          if (isMySent || isMyReceived) {
            const partnerId = isMySent ? msg.receiverId : msg.senderId;
            const key = `${msg.adId}::${partnerId}`;

            if (!roomsMap.has(key)) {
              roomsMap.set(key, []);
            }
            roomsMap.get(key)!.push(msg);
          }
        });

        const groupedRooms: any[] = [];

        for (const [key, msgs] of roomsMap.entries()) {
          const [adId, partnerId] = key.split("::");
          const adObj = ads.find((a) => a.id === adId);

          msgs.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          const lastMsg = msgs[msgs.length - 1];

          const foundUser =
            dynamicUsers.find((u) => u.id === partnerId) ||
            INITIAL_USERS.find((u) => u.id === partnerId);
          const mockUserObj = foundUser || {
            name:
              lastMsg.senderId === currentUser.id
                ? `تاجر في أسواق ${currentMarket.labelAr}`
                : "رقم مجهول",
            avatar: `https://ui-avatars.com/api/?name=${
              lastMsg.senderId === currentUser.id ? "تاجر" : "مجهول"
            }&background=random`,
          };

          groupedRooms.push({
            id: key,
            adId,
            partnerId,
            partnerName: mockUserObj.name,
            partnerAvatar: mockUserObj.avatar,
            adTitle: adObj ? adObj.title : "إعلان مؤرشف",
            adImage:
              adObj && adObj.images
                ? (typeof adObj.images[0] === 'object' ? (adObj.images[0] as any).url : adObj.images[0])
                : "https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80",
            lastText: lastMsg.text,
            lastTime: lastMsg.timestamp,
            allMessages: msgs,
          });
        }

        groupedRooms.sort(
          (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
        );
        setChatRooms(groupedRooms);

        if (groupedRooms.length > 0 && !selectedRoom) {
          setSelectedRoom(groupedRooms[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch chat rooms", err);
    }
  };

  // Fetch active chats for selected room
  const fetchActiveChats = async (adId: string, partnerId: string) => {
    try {
      const response = await fetch("/api/messages");
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data: ChatMessage[] = await response.json();
        const filtered = data.filter((msg) => {
          const matchAd = msg.adId === adId;
          const matchUsers =
            (msg.senderId === currentUser.id && msg.receiverId === partnerId) ||
            (msg.senderId === partnerId && msg.receiverId === currentUser.id);
          return matchAd && matchUsers;
        });

        filtered.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setActiveChats(filtered);
      }
    } catch (err) {
      console.error("Error loading chats", err);
    }
  };

  // Load chat rooms when tab changes
  useEffect(() => {
    if (activeTab === "messages" || activeTab === "reviews") {
      fetchChatRooms();
    }
  }, [activeTab, ads]);

  // Load active chats when selectedRoom changes
  useEffect(() => {
    if (selectedRoom) {
      fetchActiveChats(selectedRoom.adId, selectedRoom.partnerId);
    }
  }, [selectedRoom]);

  // Real-time socket listeners
  useEffect(() => {
    if (currentUser?.id) {
      joinRoom(currentUser.id);

      const handleNewMessage = (msg: ChatMessage) => {
        fetchChatRooms();
        if (
          selectedRoom &&
          (msg.senderId === selectedRoom.partnerId || msg.receiverId === selectedRoom.partnerId)
        ) {
          setActiveChats((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      };

      const handleNewNotification = (notif: AppNotification) => {
        console.log("Real-time notification arrived:", notif);
      };

      socket.on("new-message", handleNewMessage);
      socket.on("new-notification", handleNewNotification);

      return () => {
        socket.off("new-message", handleNewMessage);
        socket.off("new-notification", handleNewNotification);
      };
    }
  }, [currentUser?.id, selectedRoom?.id]);

  // Prevent background scrolling when Rating Modal is open
  useEffect(() => {
    if (isRatingModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [isRatingModalOpen]);

  const handleOpenRatingModal = (roomToAssess?: any) => {
    setRoomToRate(roomToAssess || selectedRoom);
    setRatingValue(5);
    setRatingComment("");
    setRatingTags([]);
    setIsRatingModalOpen(true);
  };

  const handleToggleRatingTag = (tag: string) => {
    setRatingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const submitRating = async () => {
    const targetRoom = roomToRate || selectedRoom;
    if (!targetRoom) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: targetRoom.partnerId,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar || "",
          rating: ratingValue,
          comment: ratingComment,
          tags: ratingTags,
          adId: targetRoom.adId,
        }),
      });

      if (res.ok) {
        const newRated = [...ratedConversationIds, targetRoom.id];
        setRatedConversationIds(newRated);
        localStorage.setItem("ashwaq_completed_ratings", JSON.stringify(newRated));
        setIsRatingModalOpen(false);

        addToast?.(
          isRtl ? "تم إرسال التقييم بنجاح! 🎉" : "Rating Submitted Successfully! 🎉",
          isRtl
            ? "شكراً لك على تقييم تجربتك للمساعدة في تعزيز جودة ومصداقية مجتمع أسواق."
            : "Thank you for rating your experience to help boost the quality of Ashwaq community.",
          "success"
        );
      } else {
        addToast?.(
          isRtl ? "فشل إرسال التقييم" : "Rating Submission Failed",
          isRtl
            ? "حدث خطأ ما أثناء إرسال التقييم. الرجاء المحاولة لاحقاً."
            : "An error occurred while submitting rating.",
          "error"
        );
      }
    } catch (e) {
      console.error("Error submitting rating:", e);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const myAds = ads.filter((ad) => ad.userId === currentUser.id);

  // Render spinner when lazy loading tab components
  const renderLoading = () => (
    <div className="py-24 text-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
      <p className="text-xs text-slate-400 font-bold">
        {isRtl ? "جاري تحميل القسم..." : "Loading tab view..."}
      </p>
    </div>
  );

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 md:pb-10 text-right dir-rtl transition-colors duration-305 ${isDark ? "text-white" : "text-slate-900"}`}>
      {/* Title block */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b transition-colors ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <div className="flex items-center gap-4">
          <Avatar
            src={currentUser.avatar}
            name={currentUser.name}
            sizeClassName="w-14 h-14"
            className="ring-2 ring-emerald-500/30"
          />
          <div className={isRtl ? "text-right" : "text-left"}>
            <h2 className={`text-2xl font-black flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              {isGuest ? (isRtl ? "نشر إعلان كزائر" : "Post as Guest") : t("dashboard.title")}
              {!isGuest && currentUser.verified && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
              )}
            </h2>
            <p className={`${isDark ? "text-slate-300" : "text-slate-500"} text-xs mt-1`}>
              {isGuest ? (isRtl ? "يمكنك نشر إعلانك الآن والوصول لآلاف المشترين فوراً" : "Publish your ad now and reach thousands of buyers instantly") : t("dashboard.subtitle")}
            </p>
          </div>
        </div>

        {/* Return to Home Button in Header */}
        <button
          onClick={() => onTabChange("home")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 shrink-0 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-750 text-slate-100 border-slate-700 hover:text-emerald-400"
              : "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-100"
          }`}
        >
          <Home className="w-4 h-4" />
          <span>{isRtl ? "العودة للرئيسية" : "Return to Home"}</span>
        </button>
      </div>

      {/* Dashboard quick navigation handles */}
      <div className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all duration-300 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap select-none mt-6 ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200/60 shadow-sm"}`}>
        <button
          onClick={() => onTabChange("home")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "home"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          {isRtl ? "الرئيسية" : "Home"}
        </button>

        <button
          onClick={() => onTabChange("create-ad")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "create-ad"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          {t("dashboard.createAd")}
        </button>

        {!isGuest && (
          <>
            <button
              onClick={() => onTabChange("my-ads")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "my-ads"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              {t("dashboard.myAds")}
            </button>
            <button
              onClick={() => onTabChange("messages")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all relative shrink-0 cursor-pointer ${
                activeTab === "messages"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              {t("dashboard.messages")}
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-lg ring-2 ring-white dark:ring-slate-900">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange("reviews")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "reviews"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              {t("dashboard.reviews")}
            </button>
            <button
              onClick={() => onTabChange("analytics")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              {t("dashboard.analytics")}
            </button>
            <button
              onClick={() => onTabChange("live-clips")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "live-clips"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              <Video className="w-3.5 h-3.5 ml-1 inline text-white" />
              {isRtl ? "مقاطع البث" : "Live Clips"}
            </button>
            <button
              onClick={() => onTabChange("jobs")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "jobs"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 ml-1 inline" />
              {isRtl ? "بوابة الوظائف والفرص" : "Job Portal"}
            </button>
            <button
              onClick={() => onTabChange("settings")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
              }`}
            >
              {t("dashboard.settings")}
            </button>
          </>
        )}

        {isGuest && (
          <div className="flex items-center gap-2 px-4 text-[10px] font-bold text-amber-500 bg-amber-500/5 rounded-xl border border-amber-500/20 py-2">
            ⚠️ {isRtl ? "سجل دخولك لاحقاً لإدارة إعلاناتك" : "Login later to manage your ads"}
          </div>
        )}
      </div>

      {/* Tab Render Switcher */}
      <Suspense fallback={renderLoading()}>
        {activeTab === "create-ad" && (
          <ErrorBoundary tabName={isRtl ? "إنشاء إعلان" : "Create Ad"}>
            <CreateAdTab
              currentUser={currentUser}
              currentMarket={currentMarket}
              categories={categories}
              editingAd={editingAd}
              onCancelEdit={() => {
                setEditingAd(null);
                onTabChange("my-ads");
              }}
              onAdCreated={(newAd) => {
                onAdCreated(newAd);
                setEditingAd(null);
              }}
              onAdUpdated={(updatedAd) => {
                onAdUpdated?.(updatedAd);
                setEditingAd(null);
              }}
              onTabChange={onTabChange}
              isDark={isDark}
              addToast={addToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === "my-ads" && (
          <ErrorBoundary tabName={isRtl ? "إعلاناتي" : "My Ads"}>
            <MyAdsTab
              myAds={myAds}
              currentMarket={currentMarket}
              isDark={isDark}
              onTabChange={onTabChange}
              onSelectAd={onSelectAd}
              handleStartEditAd={(ad) => {
                setEditingAd(ad);
                onTabChange("create-ad");
              }}
              onDeleteAdRequest={(adId, adTitle) => {
                setAdToDeleteId(adId);
                setAdToDeleteTitle(adTitle);
              }}
            />
          </ErrorBoundary>
        )}

        {activeTab === "messages" && (
          <ErrorBoundary tabName={isRtl ? "الرسائل" : "Messages"}>
            <MessagesTab
              currentUser={currentUser}
              chatRooms={chatRooms}
              selectedRoom={selectedRoom}
              setSelectedRoom={setSelectedRoom}
              activeChats={activeChats}
              setActiveChats={setActiveChats}
              ratedConversationIds={ratedConversationIds}
              handleOpenRatingModal={handleOpenRatingModal}
              fetchChatRooms={fetchChatRooms}
              fetchActiveChats={fetchActiveChats}
            />
          </ErrorBoundary>
        )}

        {activeTab === "reviews" && (
          <ErrorBoundary tabName={isRtl ? "التقييمات" : "Reviews"}>
            <ReviewsTab
              currentUser={currentUser}
              chatRooms={chatRooms}
              ratedConversationIds={ratedConversationIds}
              setRatedConversationIds={setRatedConversationIds}
              addToast={addToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === "analytics" && (
          <ErrorBoundary tabName={isRtl ? "التحليلات" : "Analytics"}>
            <AnalyticsTab
              myAds={myAds}
              currentUser={currentUser}
              currentMarket={currentMarket}
              categories={categories}
              t={t}
            />
          </ErrorBoundary>
        )}

        {activeTab === "live-clips" && (
          <ErrorBoundary tabName={isRtl ? "مقاطع البث" : "Live Clips"}>
            <LiveClipsTab
              currentUser={currentUser}
              isDark={isDark}
              onTabChange={onTabChange}
              addToast={addToast}
            />
          </ErrorBoundary>
        )}

        {activeTab === "settings" && (
          <ErrorBoundary tabName={isRtl ? "الإعدادات" : "Settings"}>
            <SettingsTab
              currentUser={currentUser}
              currentMarket={currentMarket}
              ads={ads}
              isDark={isDark}
              addToast={addToast}
            />
          </ErrorBoundary>
        )}
      </Suspense>

      {/* Tab: Jobs and Opportunities Portal */}
      {activeTab === "jobs" && (
        <div id="dashboard-jobs-portal" className="mt-8">
          <JobPortal
            currentUser={currentUser}
            isDark={isDark}
            ads={ads}
            onSelectAd={onSelectAd}
            addToast={addToast}
          />
        </div>
      )}

      {/* Interactive Quick Rating Modal */}
      {isRatingModalOpen && roomToRate && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md dir-rtl animate-fade-in" id="quick-rating-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-none shadow-2xl flex flex-col text-right p-6 relative" id="quick-rating-modal-card">
            
            {/* Close button */}
            <button
               id="close-quick-rating-btn"
               onClick={() => setIsRatingModalOpen(false)}
               className="absolute top-5 left-5 p-2 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border-none bg-transparent"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="text-center pb-4 border-b border-slate-800 mt-2">
              <div className="inline-flex relative mb-3">
                <img
                  src={roomToRate.partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                  alt={roomToRate.partnerName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500 bg-slate-800"
                />
                <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-slate-900 text-slate-950">
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>

              <h3 className="text-base font-black text-slate-100">
                تقييم تجربتك مع {roomToRate.partnerName}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                بخصوص إعلانك: <span className="text-emerald-400 font-bold">{roomToRate.adTitle}</span>
              </p>
            </div>

            {/* Star Rating Selector */}
            <div className="py-6 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">حدّد عدد النجوم</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= ratingValue;
                  return (
                    <button
                      key={star}
                      id={`star-btn-${star}`}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className="text-slate-700 hover:scale-125 active:scale-90 transition-all cursor-pointer border-none bg-transparent"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          active
                            ? "text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                            : "text-slate-700 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-bold text-amber-400 mt-3 h-5">
                {ratingValue === 5 && "ممتاز جداً وموثوق للغاية! ✅"}
                {ratingValue === 4 && "جيد جداً، تعامل ممتاز 👍"}
                {ratingValue === 3 && "مقبول، سارت الأمور بشكل عادي 🤝"}
                {ratingValue === 2 && "ضعيف، واجهت بعض الصعوبات 👎"}
                {ratingValue === 1 && "سيء جداً، لا أنصح بالتعامل معه ⚠️"}
              </span>
            </div>

            {/* Quick Tag Pills */}
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-400 mb-2 font-sans text-right">ما المميز في هذا المستخدم؟ (اختر متعدد)</div>
              <div className="flex flex-wrap gap-2 justify-start font-sans">
                {[
                  "سريع في الرد ⚡",
                  "تعامل محترم وأنيق 🤝",
                  "مصداقية عالية ووضوح 🥇",
                  "سعر مناسب وعادل 💰",
                  "تنسيق ممتاز وسهولة ✅",
                ].map((tag, index) => {
                  const isSelected = ratingTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      id={`tag-btn-${index}`}
                      type="button"
                      onClick={() => handleToggleRatingTag(tag)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/5"
                          : "bg-slate-800 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Form */}
            <div className="mb-6 font-sans text-right">
              <label className="block text-xs font-bold text-slate-400 mb-2">
                ملاحظاتك أو مقترحاتك (اختياري)
              </label>
              <textarea
                id="rating-comment-textarea"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="اكتب كلمة شكر أو أي ملاحظة لتعزيز ثقة المجتمع..."
                className="w-full min-h-[70px] bg-slate-950 border border-slate-800 rounded-2xl p-3 text-right text-xs text-white placeholder-slate-800 outline-none focus:border-emerald-500 resize-none transition-all"
              />
            </div>

            {/* Submit Action */}
            <div className="flex gap-3 font-sans">
              <button
                id="cancel-rating-modal-btn"
                type="button"
                onClick={() => setIsRatingModalOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                id="submit-rating-modal-btn"
                type="button"
                onClick={submitRating}
                disabled={ratingSubmitting}
                className="flex-[2] h-11 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {ratingSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-current" />
                    <span>إرسال التقييم والإنهاء</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[9px] text-slate-500 text-center mt-4">
              التقييم يثبت جديتك ويساهم في الحفاظ على أمان ونزاهة مجتمعنا.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Ad Deletion Confirmation Dialog */}
      {adToDeleteId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md dir-rtl animate-fade-in" id="delete-confirmation-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-right p-6 relative" id="delete-confirmation-modal-card">
            
            {/* Close button */}
            <button
              id="close-delete-dialog-btn"
              onClick={() => {
                setAdToDeleteId(null);
                setAdToDeleteTitle("");
              }}
              className="absolute top-5 left-5 p-2 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Content */}
            <div className="text-center pb-4 mt-2">
              <div className="inline-flex items-center justify-center bg-red-500/10 text-red-500 rounded-full p-4 mb-4">
                <Trash2 className="w-8 h-8 font-black" />
              </div>

              <h3 className="text-base font-black text-slate-100">
                تأكيد حذف الإعلان
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-sans px-2 text-center">
                هل أنت متأكد من رغبتك في حذف الإعلان بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء لاحقاً.
              </p>
              
              {/* Highlight Target Title */}
              <div className="mt-4 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-red-400 truncate">
                  {adToDeleteTitle}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 font-sans mt-2">
              <button
                id="cancel-delete-dialog-btn"
                type="button"
                onClick={() => {
                  setAdToDeleteId(null);
                  setAdToDeleteTitle("");
                }}
                className="flex-1 h-11 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                id="confirm-delete-dialog-btn"
                type="button"
                onClick={() => {
                  if (adToDeleteId) {
                    onAdDeleted(adToDeleteId);
                    setAdToDeleteId(null);
                    setAdToDeleteTitle("");
                    addToast?.(
                      isRtl ? "تم حذف الإعلان" : "Ad Deleted",
                      isRtl ? "تمت إزالة هذا الإعلان بنجاح من المنصة." : "This ad was successfully removed from the platform.",
                      "success"
                    );
                  }
                }}
                className="flex-[2] h-11 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-450 hover:to-red-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/15 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 fill-current" />
                <span>تأكيد حذف الإعلان</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
