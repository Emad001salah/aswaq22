/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, FormEvent } from "react";
import { MessageSquare, Star, CheckCircle2, Camera, Send, Loader2 } from "lucide-react";
import { User, ChatMessage } from "../../types.ts";

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
}: MessagesTabProps) {
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
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

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 h-[500px]">
      {/* Active room lists */}
      <div className="lg:col-span-1 border-l border-slate-800 overflow-y-auto">
        <div className="p-4 border-b border-slate-800 bg-slate-950 font-bold text-xs text-slate-300">
          المحادثات الواردة والصادرة
        </div>

        <div className="divide-y divide-slate-800/50">
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
                      ? "bg-emerald-900/10 border-r-2 border-emerald-500"
                      : "hover:bg-slate-800/30"
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
                      <h4 className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                        {room.partnerName}
                        {ratedConversationIds.includes(room.id) && (
                          <Star className="w-3 h-3 text-amber-400 fill-current" />
                        )}
                      </h4>
                      <span className="text-[8px] text-slate-500 font-mono">
                        {new Date(room.lastTime).toLocaleTimeString(
                          "ar-YE",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-400 truncate mt-0.5">
                      {room.adTitle}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-1">
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
      <div className="lg:col-span-2 flex flex-col h-full bg-slate-950/45 min-h-0">
        {selectedRoom ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src={selectedRoom.partnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div className="text-right">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    {selectedRoom.partnerName}
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </h4>
                  <p className="text-[9px] text-slate-500">
                    بخصوص: {selectedRoom.adTitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
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
                    <span>إنهاء وتقييم</span>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/45 h-full overscroll-y-contain">
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
                          : "bg-slate-800 text-slate-100 rounded-tl-none"
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
              className="p-4 border-t border-slate-800 bg-slate-950/80 flex gap-2 items-center shrink-0"
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
                className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-slate-200 outline-none focus:border-emerald-500 text-right"
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
            <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs">
              الرجاء اختيار محادثة من القائمة للتواصل والتفاوض.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
