/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, FormEvent } from "react";
import { MessageSquare, Star, CheckCircle2, Camera, Send, Loader2, Truck, Calendar, Home, Car, Briefcase, Wrench } from "lucide-react";
import { User, ChatMessage } from "../../types.ts";
import DeliveryRequestModal from "../shipping/DeliveryRequestModal";

interface MessagesTabProps {
  currentUser: User;
  chatRooms: any[];
  selectedRoom: any | null;
  setSelectedRoom: (room: any | null) => void;
  activeChats: ChatMessage[];
  setActiveChats: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  ratedConversationIds: string[];
  handleOpenRatingModal: (room: any) => void;
  fetchChatRooms: () => Promise<void>;
  fetchActiveChats: (adId: string, partnerId: string) => Promise<void>;
  isDark?: boolean;
}

export default function MessagesTab({
  currentUser,
  chatRooms,
  selectedRoom,
  setSelectedRoom,
  activeChats,
  setActiveChats,
  ratedConversationIds,
  handleOpenRatingModal,
  fetchChatRooms,
  fetchActiveChats,
  isDark = true,
}: MessagesTabProps) {
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatPrice = (num?: number) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleReplySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedRoom) return;

    setReplying(true);
    const body = {
      adId: selectedRoom.adId,
      senderId: currentUser.id,
      receiverId: selectedRoom.partnerId,
      text: replyText,
    };

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const newMsg = await response.json();
           setActiveChats((prev) => {
             if (prev.some(m => m.id === newMsg.id)) return prev;
             return [...prev, newMsg];
           });
           setReplyText("");
   
           // Reload Rooms briefly to fetch potential mock answers
           setTimeout(() => {
             fetchChatRooms();
             fetchActiveChats(selectedRoom.adId, selectedRoom.partnerId);
           }, 2200);
        } else {
           console.warn("Reply API failed - non-JSON response");
        }
      }
    } catch (e) {
      console.error("Reply failed", e);
    } finally {
      setReplying(false);
    }
  };

  // Helper: determine context based on ad category and title
  const getAdContext = (room: any) => {
    const text = `${room?.adCategory || ''} ${room?.adTitle || ''}`.toLowerCase();
    
    // 1. Hotels & Tourism
    if (text.match(/فندق|فنادق|سياح|شاليه|منتجع|اقام|إقام|شقق مفروشة|حجز|hotel|resort|tourism|stay|booking|suite/i)) {
      return {
        type: 'hotel',
        ratingLabel: 'تقييم الفندق',
        actionLabel: 'طلب حجز إقامة',
        actionIcon: Calendar,
        actionColor: 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20',
        isDeliverable: false,
        bookingTemplate: 'مرحباً، أود الاستفسار عن إمكانية حجز وتوفر الإقامة للفترة القادمة والتفاصيل المتاحة.'
      };
    }
    
    // 2. Real Estate / Property
    if (text.match(/عقار|شقة|فيلا|أرض|ارض|ايجار|إيجار|مكتب|عمارة|real estate|property|villa|apartment/i)) {
      return {
        type: 'real_estate',
        ratingLabel: 'تقييم المعلن العقاري',
        actionLabel: 'حجز موعد معاينة',
        actionIcon: Home,
        actionColor: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20',
        isDeliverable: false,
        bookingTemplate: 'مرحباً، أود التنسيق لتحديد موعد مناسب لمعاينة هذا العقار على أرض الواقع.'
      };
    }
    
    // 3. Vehicles & Cars
    if (text.match(/سيار|مركب|شاحن|دراج|موتور|car|vehicle|auto|motor/i)) {
      return {
        type: 'vehicle',
        ratingLabel: 'تقييم المعرض / البائع',
        actionLabel: 'طلب فحص ومعاينة',
        actionIcon: Car,
        actionColor: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
        isDeliverable: false,
        bookingTemplate: 'مرحباً، أود الاستفسار عن حالة المركبة وتحديد موعد للفحص والمعاينة.'
      };
    }
    
    // 4. Jobs & Careers
    if (text.match(/وظائف|وظيفة|توظيف|عمل|job|career|hiring|recruitment/i)) {
      return {
        type: 'job',
        ratingLabel: 'تقييم جهة العمل',
        actionLabel: 'تقديم للوظيفة',
        actionIcon: Briefcase,
        actionColor: 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20',
        isDeliverable: false,
        bookingTemplate: 'مرحباً، أود التقدم لهذه الفرصة الوظيفية ومشاركة سيرتي الذاتية وخبراتي.'
      };
    }
    
    // 5. Services & Crafts
    if (text.match(/خدمات|خدمة|صيانة|مقاولات|برمجة|تصميم|تنظيف|تصليح|service|repair/i)) {
      return {
        type: 'service',
        ratingLabel: 'تقييم مقدم الخدمة',
        actionLabel: 'طلب تنفيذ الخدمة',
        actionIcon: Wrench,
        actionColor: 'bg-teal-500 hover:bg-teal-600 shadow-teal-500/20',
        isDeliverable: false,
        bookingTemplate: 'مرحباً، أود طلب هذه الخدمة والاستفسار عن الأسعار وموعد البدء.'
      };
    }

    // Default: Deliverable Goods / Products (Electronics, Fashion, Food, etc.)
    return {
      type: 'goods',
      ratingLabel: 'تقييم البائع',
      actionLabel: 'اطلب توصيل',
      actionIcon: Truck,
      actionColor: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
      isDeliverable: true,
      bookingTemplate: ''
    };
  };

  const adContext = selectedRoom ? getAdContext(selectedRoom) : null;
  const ActionIcon = adContext?.actionIcon || Truck;

  return (
    <div className={`mt-8 grid grid-cols-1 lg:grid-cols-3 rounded-3xl overflow-hidden border h-[500px] transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
      {/* Active room lists */}
      <div className={`lg:col-span-1 border-l overflow-y-auto ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className={`p-4 border-b font-bold text-xs ${isDark ? 'border-slate-800 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
          المحادثات الواردة والصادرة
        </div>

        <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
          {chatRooms.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-medium">
              لا توجد محادثات نشطة حالياً.
            </div>
          ) : (
            chatRooms.map((room) => {
              const isActiveRoom = selectedRoom?.id === room.id;

              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                    isActiveRoom
                      ? isDark ? "bg-emerald-900/10 border-r-2 border-emerald-500" : "bg-emerald-50 border-r-2 border-emerald-500"
                      : isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                  }`}
                >
                  <img
                    src={room.partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                    alt={room.partnerName}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold truncate flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {room.partnerName}
                        {ratedConversationIds.includes(room.id) && (
                          <Star className="w-3 3 text-amber-400 fill-current" />
                        )}
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono">
                        {new Date(room.lastTime).toLocaleTimeString(
                          "ar-YE",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-500 truncate mt-0.5 font-bold">
                      {room.adTitle}
                    </p>
                    <p className={`text-[10px] truncate mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {room.lastText}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Chat message pane */}
      <div className={`lg:col-span-2 flex flex-col h-full min-h-0 ${isDark ? 'bg-slate-950/45' : 'bg-slate-50/50'}`}>
        {selectedRoom ? (
          <>
            {/* Header info */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <img
                  src={selectedRoom.partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div className="text-right">
                  <h4 className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {selectedRoom.partnerName}
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </h4>
                  <p className="text-[9px] text-slate-500">
                    بخصوص: {selectedRoom.adTitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Rating Button with context-aware label */}
                {ratedConversationIds.includes(selectedRoom.id) ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>تم التقييم</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenRatingModal(selectedRoom);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-450 hover:shadow-lg hover:shadow-amber-500/10 text-slate-950 text-[10px] font-black transition-all cursor-pointer active:scale-95"
                  >
                    <Star className="w-3.5 h-3.5 fill-current animate-pulse" />
                    <span>{adContext?.ratingLabel || 'تقييم البائع'}</span>
                  </button>
                )}

                {/* Context-aware Action Button (Delivery for goods / Booking for hotels / Inspection for cars / etc.) */}
                {adContext && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (adContext.isDeliverable) {
                        setDeliveryModalOpen(true);
                      } else if (adContext.bookingTemplate) {
                        setReplyText(adContext.bookingTemplate);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[10px] font-bold transition-all cursor-pointer active:scale-95 hover:shadow-lg ${adContext.actionColor}`}
                  >
                    <ActionIcon className="w-3.5 h-3.5" />
                    <span>{adContext.actionLabel}</span>
                  </button>
                )}

                <img
                  src={selectedRoom.adImage || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'}
                  className="w-10 h-8 rounded object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Messages Body */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 h-full overscroll-y-contain ${isDark ? 'bg-slate-950/45' : 'bg-slate-100/50'}`}>
              {activeChats.map((msg) => {
                const mine = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`p-3 rounded-xl text-xs leading-relaxed max-w-[80%] ${
                        mine
                          ? "bg-emerald-500 text-slate-950 font-bold rounded-tr-none shadow-md shadow-emerald-500/5"
                          : isDark
                            ? "bg-slate-800 text-slate-100 rounded-tl-none"
                            : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString("ar-YE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Reply Form Footer */}
            <form
              onSubmit={handleReplySubmit}
              className={`p-4 border-t flex gap-2 items-center shrink-0 ${isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white'}`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    // Image handling logic
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-emerald-500 transition-colors shrink-0"
              >
                <Camera className="w-5 h-5" />
              </button>
              <input
                type="text"
                required
                placeholder="اكتب ردك ومقترح السعر..."
                className={`flex-1 h-10 border rounded-xl px-4 text-xs outline-none focus:border-emerald-500 text-right ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={replying}
                id="dashboard-reply-input"
              />
              <button
                type="submit"
                disabled={replying}
                className="w-12 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black flex items-center justify-center shrink-0 active:scale-95"
                id="dashboard-reply-send"
              >
                {replying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs">
              الرجاء اختيار محادثة من القائمة للتواصل والتفاوض.
            </p>
          </div>
        )}
      </div>

      {selectedRoom && (
        <DeliveryRequestModal
          isOpen={deliveryModalOpen}
          onClose={() => setDeliveryModalOpen(false)}
          adId={selectedRoom.adId}
          adTitle={selectedRoom.adTitle}
          adImage={selectedRoom.adImage}
          partnerId={selectedRoom.partnerId}
          partnerName={selectedRoom.partnerName}
          price={selectedRoom.price}
        />
      )}
    </div>
  );
}
