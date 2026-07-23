
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client'

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  User as UserIcon, 
  MapPin, 
  ChevronDown,
  Volume2,
  VolumeX,
  ShieldCheck,
  Eye,
  Bookmark,
  ChevronLeft,
  Compass,
  Film,
  MessageCircle,
  Copy,
  Send,
  Facebook,
  Search,
  Filter,
  Video,
  Radio,
  X,
  VideoOff,
  CheckCircle2,
  Check,
  Palette,
  Sun,
  FlipHorizontal,
  StopCircle,
  Zap,
  ShoppingCart,
  Upload
} from 'lucide-react';
import { Ad, User } from '../types.ts';
import { INITIAL_USERS, CATEGORIES } from '../data.ts';
import { getCurrencyAr, getCurrencyNameAr, MARKETS } from '../markets.ts';
import socket from '../lib/socket.ts';
import { Avatar } from './Avatar.tsx';
import { apiFetch } from '../lib/api';

const FILTERS = [
  { id: 'none', label: 'طبيعي', labelEn: 'Normal', filter: '' },
  { id: 'beauty', label: 'تجميل 💄', labelEn: 'Beauty', filter: 'brightness(1.1) saturate(1.1) contrast(1.05) blur(0.4px)' },
  { id: 'warm', label: 'دافئ 🍊', labelEn: 'Warm', filter: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'noir', label: 'دراما 🎬', labelEn: 'Noir', filter: 'grayscale(1) contrast(1.2)' },
  { id: 'neon', label: 'نيون 🌈', labelEn: 'Neon', filter: 'saturate(2.2) contrast(1.1) brightness(1.1)' },
  { id: 'vintage', label: 'قديم 🎞️', labelEn: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1) hue-rotate(-10deg)' },
];

const getYoutubeEmbedUrlForBg = (url?: string, isMuted = true): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&playsinline=1&enablejsapi=1`;
  }
  return null;
};

export const parseVideoUrl = (rawUrl?: string) => {
  if (!rawUrl) return { videoUrl: '', audioUrl: '', description: '', city: '', category: '' };
  const parts = rawUrl.split('||');
  return {
    videoUrl: parts[0] || '',
    audioUrl: parts[1] && parts[1] !== 'none' ? parts[1] : '',
    description: parts[2] || '',
    city: parts[3] || '',
    category: parts[4] || ''
  };
};

export const getImageUrl = (rawImg: any, fallback = 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=1920&q=80'): string => {
  if (!rawImg) return fallback;
  if (typeof rawImg === 'string') {
    const s = rawImg.trim();
    if (s.startsWith('http') || s.startsWith('/') || s.startsWith('data:')) return s;
    return fallback;
  }
  if (typeof rawImg === 'object' && rawImg && typeof rawImg.url === 'string') {
    const s = rawImg.url.trim();
    if (s.startsWith('http') || s.startsWith('/') || s.startsWith('data:')) return s;
    return fallback;
  }
  return fallback;
};

const AUDIO_TRACKS = [
  { id: 'none', nameAr: 'بدون موسيقى (صوت الفيديو الأصلي)', nameEn: 'No music (Original video sound)' },
  { id: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', nameAr: '🎵 نغمة تجارية حماسية (Upbeat Commercial)', nameEn: '🎵 Upbeat Commercial' },
  { id: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', nameAr: '🎵 إيقاع هادئ ومريح (Calm Ambient)', nameEn: '🎵 Calm Ambient' },
  { id: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', nameAr: '🎵 نغمة عصرية سريعة (Modern Beats)', nameEn: '🎵 Modern Beats' },
  { id: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', nameAr: '🎵 إيقاع شرقي جاز (Eastern Jazz)', nameEn: '🎵 Eastern Jazz' }
];

function AudioPlayer({ src, isPlaying, isMuted }: { src: string; isPlaying: boolean; isMuted: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;
    audio.muted = isMuted;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.log("Audio play blocked by browser policies or interrupted:", err);
        });
      }
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [src, isPlaying, isMuted]);

  return null;
}

function WebcamStreamPlayer({
  isMuted,
  isRtl,
  ad,
  currentUser,
  onStreamEnded,
  pinnedProduct,
  onPinProductClick
}: {
  isMuted: boolean;
  isRtl: boolean;
  ad: Ad;
  currentUser: User | null;
  onStreamEnded?: (adId: string, archiveUrl: string) => void;
  pinnedProduct?: { id: string; title: string; price: number; image: string } | null;
  onPinProductClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [isBroadcaster, setIsBroadcaster] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showBrightness, setShowBrightness] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [brightness, setBrightness] = useState<number>(100);
  const [torch, setTorch] = useState<boolean>(false);
  const [realComments, setRealComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState<string>('');

  
  // Broadcaster Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Viewer Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    // Only actual logged-in seller who owns the live stream ad can be a broadcaster. Viewers & guests NEVER open camera!
    const isCreator = !!(ad && ad.isLive && currentUser && currentUser.id === ad.userId && ad.userId !== "guest_user");
    setIsBroadcaster(isCreator);
    setIsOffline(false);

    if (isCreator) {
      // --- BROADCASTER LOGIC ---
      setStatusText(isRtl ? 'جاري تجهيز الكاميرا والاتصال بالخادم...' : 'Preparing camera and connecting to stream server...');
      let active = true;

      async function startBroadcasting() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          if (!active) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          localStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;

            // Apply Torch if available
            const track = stream.getVideoTracks()[0];
            if (track && 'applyConstraints' in track && facingMode === 'environment') {
              try {
                // @ts-ignore
                const capabilities = track.getCapabilities();
                // @ts-ignore
                if (capabilities.torch) {
                  // @ts-ignore
                  await track.applyConstraints({ advanced: [{ torch }] });
                }
              } catch (e) {
                console.error("Torch constraint failure:", e);
              }
            }
          }

          setStatusText(isRtl ? 'أنت الآن على المباشر! 🔴' : 'You are now LIVE! 🔴');
          // Clear status text to show controls and video after 3 seconds
          setTimeout(() => {
            setStatusText('');
          }, 3500);

          // Register stream on socket and send notification info
          socket.emit('join-stream', { 
            streamId: ad.id, 
            role: 'broadcaster',
            sellerId: currentUser?.id,
            sellerName: currentUser?.name || '',
            adTitle: ad.title
          });

          // When a viewer joins, start a peer connection with them
          const handleViewerJoined = async ({ viewerId }: { viewerId: string }) => {
            console.log(`[Stream] Viewer ${viewerId} joined. Creating peer connection.`);
            try {
              const pc = new RTCPeerConnection({
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' }
                ]
              });

              pcsRef.current.set(viewerId, pc);
              setViewerCount(prev => prev + 1);

              // Add tracks to connection
              stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
              });

              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  socket.emit('signal', { to: viewerId, signal: { type: 'candidate', candidate: event.candidate } });
                }
              };

              pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                  pc.close();
                  pcsRef.current.delete(viewerId);
                  setViewerCount(prev => Math.max(0, prev - 1));
                }
              };

              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('signal', { to: viewerId, signal: { type: 'offer', sdp: offer.sdp } });
            } catch (err) {
              console.error("[Broadcaster] Failed to negotiate with viewer:", err);
            }
          };

          const handleViewerLeft = ({ viewerId }: { viewerId: string }) => {
            console.log(`[Stream] Viewer ${viewerId} left.`);
            const pc = pcsRef.current.get(viewerId);
            if (pc) {
              pc.close();
              pcsRef.current.delete(viewerId);
              setViewerCount(prev => Math.max(0, prev - 1));
            }
          };

          const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
            try {
              const pc = pcsRef.current.get(from);
              if (!pc) return;

              if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
              } else if (signal.type === 'candidate' && signal.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              }
            } catch (err) {
              console.error("[Broadcaster] Error handling signal from viewer:", err);
            }
          };

          const handleFilterChange = ({ filterId }: { filterId: string }) => {
            if (!isCreator) {
              setActiveFilter(filterId);
            }
          };

          const handleChatMessage = (msg: any) => {
            setRealComments(prev => [...prev, msg].slice(-15));
          };

          const handleViewerCountUpdate = ({ count }: { count: number }) => {
            setViewerCount(count);
          };

          const handleLiveHeart = ({ color, left, scale, id }: any) => {
            // This is handled by parent, but we can also handle it here if needed
            // Or just rely on parent's z-index if hearts are on top.
          };

          socket.on('viewer-joined', handleViewerJoined);
          socket.on('viewer-left', handleViewerLeft);
          socket.on('signal', handleSignal);
          socket.on('stream-filter-change', handleFilterChange);
          socket.on('chat-message', handleChatMessage);
          socket.on('viewer-count-update', handleViewerCountUpdate);
          socket.on('live-heart', (data) => {
             // Dispatch a custom event or just let parent handle it since parent is also listening
             // Actually, parent and child both listen, so both will update.
             // If parent's hearts are z-indexed properly, we don't need double hearts.
          });

          // Return clean up function to remove listeners
          return () => {
            socket.off('viewer-joined', handleViewerJoined);
            socket.off('viewer-left', handleViewerLeft);
            socket.off('signal', handleSignal);
            socket.off('stream-filter-change', handleFilterChange);
            socket.off('chat-message', handleChatMessage);
            socket.off('viewer-count-update', handleViewerCountUpdate);
            socket.off('live-heart');
          };

        } catch (err: any) {
          console.error("Broadcaster stream error:", err);
          const errorMsg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? (isRtl ? '🚫 لم تسمح للمتصفح باستخدام الكاميرا أو الميكروفون. يرجى تفعيل الأذونات من شريط العنوان ثم تحديث الصفحة.' : '🚫 Camera/Mic permissions denied. Please grant permissions in the address bar and refresh.')
            : (isRtl ? '❌ تعذر الوصول للكاميرا. يرجى التأكد من أنها تعمل وليست مستخدمة في تطبيق آخر.' : '❌ Local camera access failed. Please ensure your camera is working and not in use by another app.');
          setError(errorMsg);
          // Fallback constraints without audio to see if we can at least get video
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (!active) {
              fallbackStream.getTracks().forEach(t => t.stop());
              return;
            }
            localStreamRef.current = fallbackStream;
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
            setStatusText(isRtl ? 'تم تفعيل الكاميرا بنجاح! 🔴' : 'Camera active successfully! 🔴');
            setTimeout(() => setStatusText(''), 3000);
            socket.emit('join-stream', { 
              streamId: ad.id, 
              role: 'broadcaster',
              sellerId: currentUser?.id,
              sellerName: currentUser?.name || '',
              adTitle: ad.title
            });
          } catch (err2: any) {
            setError(err2.message || String(err2));
          }
        }
      }

      let cleanupBroadcaster: (() => void) | undefined;
      startBroadcasting().then(cb => {
        cleanupBroadcaster = cb;
      });

      return () => {
        active = false;
        if (cleanupBroadcaster) cleanupBroadcaster();
        socket.emit('leave-stream', { streamId: ad.id, role: 'broadcaster' });
        
        // Stop local streams
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        // Close viewer peer connections
        pcsRef.current.forEach(pc => pc.close());
        pcsRef.current.clear();
      };

    } else {
      // --- VIEWER LOGIC ---
      setStatusText(isRtl ? 'جاري الاتصال بالبث المباشر للعارض...' : 'Connecting to the broadcaster\'s stream...');
      
      const createPeerConnection = (broadcasterId: string) => {
        if (pcRef.current) {
          pcRef.current.close();
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        pcRef.current = pc;

        pc.ontrack = (event) => {
          console.log("[Viewer] Received broadcast tracks!", event.streams);
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(e => console.log("Autoplay handle:", e));
            setStatusText('');
            setIsOffline(false);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('signal', { to: broadcasterId, signal: { type: 'candidate', candidate: event.candidate } });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[Viewer] Connection state:", pc.connectionState);
          if (pc.connectionState === 'failed') {
            setStatusText(isRtl ? '⚠️ فشل الاتصال، جاري إعادة المحاولة...' : '⚠️ Connection failed, retrying...');
            createPeerConnection(broadcasterId);
          }
        };
      };

      const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
        try {
          if (signal.type === 'offer') {
            console.log("[Viewer] Received SDP offer. Negotiating as receiver.");
            createPeerConnection(from);
            const pc = pcRef.current;
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
          } else if (signal.type === 'candidate' && signal.candidate) {
            if (pcRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          }
        } catch (err) {
          console.error("[Viewer] Signal handle failed:", err);
        }
      };

      const handleBroadcasterOnline = ({ broadcasterId }: { broadcasterId: string }) => {
        setIsOffline(false);
        setStatusText(isRtl ? 'البث المباشر بدأ الآن!' : 'Live broadcast started!');
        // Trigger offer request by joining again
        socket.emit('join-stream', { streamId: ad.id, role: 'viewer' });
      };

      const handleStreamEnded = () => {
        console.log("[Viewer] Stream was ended by broadcaster.");
        setIsOffline(true);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setStatusText(isRtl ? '📴 البث غير متصل حالياً' : '📴 Broadcaster is offline');
      };

      const handleFilterUpdate = ({ filterId }: { filterId: string }) => {
        console.log("[Viewer] Received filter update:", filterId);
        setActiveFilter(filterId);
      };

      const handleChatMessage = (msg: any) => {
        setRealComments(prev => [...prev, msg].slice(-15));
      };

      const handleViewerCountUpdate = ({ count }: { count: number }) => {
        setViewerCount(count);
      };

      socket.on('signal', handleSignal);
      socket.on('stream-broadcaster-online', handleBroadcasterOnline);
      socket.on('stream-ended', handleStreamEnded);
      socket.on('stream-filter-change', handleFilterUpdate);
      socket.on('chat-message', handleChatMessage);
      socket.on('viewer-count-update', handleViewerCountUpdate);

      // Join the live stream
      socket.emit('join-stream', { streamId: ad.id, role: 'viewer' });

      // Automatically assume offline if no offer received after 4 seconds, to guide user friendly feedback
      const timeoutId = setTimeout(() => {
        if (videoRef.current && !videoRef.current.srcObject) {
          setIsOffline(true);
          setStatusText(isRtl ? '📴 البث غير متصل - بانتظار بدء البث من العارض' : '📴 Broadcast offline - waiting for author to stream content');
        }
      }, 4000);

      return () => {
        clearTimeout(timeoutId);
        socket.emit('leave-stream', { streamId: ad.id, role: 'viewer' });
        socket.off('signal', handleSignal);
        socket.off('stream-broadcaster-online', handleBroadcasterOnline);
        socket.off('stream-ended', handleStreamEnded);
        socket.off('stream-filter-change', handleFilterUpdate);
        socket.off('chat-message', handleChatMessage);
        socket.off('viewer-count-update', handleViewerCountUpdate);

        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
      };
    }
  }, [ad.id, currentUser?.id, isRtl, facingMode, torch]);

  const currentFilterCSS = FILTERS.find(f => f.id === activeFilter)?.filter || '';
  const brightnessFilter = `brightness(${brightness / 100})`;
  const finalFilter = `${currentFilterCSS} ${brightnessFilter}`;

  const handleFilterSelect = (filterId: string) => {
    setActiveFilter(filterId);
    if (isBroadcaster) {
      socket.emit('stream-filter-change', { streamId: ad.id, filterId });
    }
  };

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-4 text-center z-[10] gap-2">
        <VideoOff className="w-10 h-10 text-rose-500 animate-pulse" />
        <p className="text-[11px] font-black text-rose-400">
          {isRtl ? '⚠️ فشل الاتصال المباشر بالكاميرا' : '⚠️ Webcam hardware connection failed'}
        </p>
        <p className="text-[9.5px] text-slate-400 max-w-[200px] leading-relaxed mx-auto">
          {isRtl 
            ? 'يرجى تفعيل والموافقة على صلاحية استخدام الكاميرا والميكروفون من أعلى شريط المتصفح لتجربة البث الفوري الحقيقي.'
            : 'Please grant camera & microphone permissions in your browser to try actual live streaming.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full z-[1] bg-black flex items-center justify-center">
      {/* Fallback backdrops if offline / loading */}
      {statusText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center z-[5] gap-3 backdrop-blur-md">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Radio className="w-5 h-5 text-emerald-500 absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-xs font-black text-slate-100 max-w-[240px] leading-relaxed">
            {statusText}
          </p>
          {isOffline && (
            <span className="text-[10px] text-slate-400">
              {isRtl 
                ? 'عندما يبدأ عارض المنشور البث من جهازه، سيظهر البث أمامك فوراً وكاملاً.'
                : 'As soon as the item owner streams from their device camera, it will show up here.'
              }
            </span>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isBroadcaster || isMuted}
        style={{ filter: finalFilter }}
        className={`w-full h-full object-cover brightness-[1.1] transition-all duration-300 ${
          statusText ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
        } ${(isBroadcaster && facingMode === 'user') ? 'scale-x-[-1]' : ''}`}
      />

      {/* Real-time Comments Overlay */}
      <div className={`absolute bottom-32 z-[40] w-[260px] sm:w-80 pointer-events-none flex flex-col gap-1 sm:gap-1.5 p-2 sm:p-3 bg-transparent scrollbar-none transition-opacity duration-500 ${statusText ? 'opacity-0' : 'opacity-100'} ${isRtl ? 'left-4 items-start' : 'right-4 items-end'}`}>
        <div className="flex flex-col gap-2 w-full">
          {realComments.slice(-5).map((cmt) => (
            <motion.div 
              key={cmt.id} 
              initial={{ opacity: 0, x: isRtl ? -20 : 20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              className={`flex gap-2 p-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 max-w-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <img src={cmt.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80"} className="w-8 h-8 rounded-full border border-white/20 shadow-md shrink-0" alt="" />
              <div className={`flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
                <span className="text-[10px] font-black text-emerald-400 drop-shadow-sm">{cmt.user}</span>
                <span className="text-[11px] font-bold text-white leading-tight drop-shadow-md">{cmt.text}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Message Input for Viewer */}
      {!isBroadcaster && !statusText && (
        <div className="absolute bottom-5 left-4 right-4 z-[100] flex gap-2">
          <input 
            type="text"
            className={`flex-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${isRtl ? 'text-right' : 'text-left'}`}
            placeholder={isRtl ? 'اكتب تعليقاً حياً...' : 'Type a live comment...'}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && commentInput.trim()) {
                socket.emit('chat-message', { 
                  streamId: ad.id, 
                  userName: currentUser?.name || (isRtl ? 'زائر' : 'Guest'), 
                  text: commentInput,
                  avatar: currentUser?.avatar,
                  userId: currentUser?.id
                });
                setCommentInput('');
              }
            }}
          />
          <button 
             onClick={() => {
               if (commentInput.trim()) {
                 socket.emit('chat-message', { 
                   streamId: ad.id, 
                   userName: currentUser?.name || (isRtl ? 'زائر' : 'Guest'), 
                   text: commentInput,
                   avatar: currentUser?.avatar,
                   userId: currentUser?.id
                 });
                 setCommentInput('');
               }
             }}
             className="w-11 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90"
          >
            <Send className={`w-4.5 h-4.5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* Side-Rail Broadcaster Controls (Portal-like floating on top of everything within player) */}
      {isBroadcaster && !isOffline && (
        <div className={`absolute top-36 z-[9999] flex flex-col gap-4 ${isRtl ? 'right-6' : 'left-6'} items-center pointer-events-auto`}>
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[140px]"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFilterSelect(f.id)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-between gap-4 ${
                      activeFilter === f.id 
                        ? 'bg-emerald-500 text-slate-950 shadow-inner' 
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{isRtl ? f.label : f.labelEn}</span>
                    {activeFilter === f.id && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showBrightness && (
              <motion.div
                initial={{ opacity: 0, x: isRtl ? -10 : 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: isRtl ? -10 : 10, scale: 0.9 }}
                className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl w-48"
              >
                <div className="flex items-center justify-between">
                   <Sun className="w-4 h-4 text-amber-400" />
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{isRtl ? 'السطوع' : 'Brightness'}</span>
                   <span className="text-[10px] font-mono text-emerald-400">{brightness}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="200" 
                  value={brightness} 
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex flex-col gap-3.5 p-2 bg-black/40 backdrop-blur-3xl rounded-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => { setShowFilters(!showFilters); setShowBrightness(false); }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative group overflow-hidden ${
                showFilters ? 'bg-pink-600 text-white scale-110 shadow-lg shadow-pink-600/30' : 'bg-slate-900/40 text-white border border-white/5 hover:bg-slate-900/60'
              }`}
            >
              <Palette className={`w-6 h-6 transition-transform duration-500 ${showFilters ? 'rotate-12' : 'group-hover:rotate-12'}`} />
            </button>

            <button
              onClick={() => { setShowBrightness(!showBrightness); setShowFilters(false); }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all group overflow-hidden relative shadow-2xl ${
                showBrightness ? 'bg-amber-500 text-slate-950 scale-110 shadow-lg shadow-amber-500/30' : 'bg-slate-950/60 text-white backdrop-blur-xl border border-white/10 shadow-xl'
              }`}
            >
              <Sun className={`w-5.5 h-5.5 transition-transform duration-500 ${showBrightness ? 'scale-110' : 'group-hover:scale-90'}`} />
            </button>

            <button
              onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all bg-slate-950/60 text-white hover:bg-slate-800 backdrop-blur-xl border border-white/10 group active:scale-90"
            >
              <FlipHorizontal className="w-5.5 h-5.5 transition-transform duration-500 group-hover:rotate-180" />
            </button>

            {facingMode === 'environment' && (
              <button
                onClick={() => setTorch(!torch)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all border group active:scale-90 ${
                  torch ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-400/30' : 'bg-slate-950/60 text-white border-white/10 backdrop-blur-xl'
                }`}
              >
                <Zap className={`w-5.5 h-5.5 ${torch ? 'fill-current' : ''}`} />
              </button>
            )}

            <button
              onClick={() => onPinProductClick?.()}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all border group active:scale-90 ${
                pinnedProduct ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/30' : 'bg-slate-950/60 text-white border-white/10 backdrop-blur-xl'
              }`}
              title={isRtl ? 'تثبيت منتج مميز' : 'Pin a Product'}
            >
              <MapPin className={`w-5.5 h-5.5 ${pinnedProduct ? 'text-slate-950 animate-bounce' : 'text-emerald-400'}`} />
            </button>

            <button
              onClick={() => {
                // End broadcast immediately
                socket.emit('leave-stream', { streamId: ad.id, role: 'broadcaster' });
                
                // Capture real snapshot frame from camera feed
                let snapshotUrl: string | null = null;
                try {
                  if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                      snapshotUrl = canvas.toDataURL('image/jpeg', 0.85);
                    }
                  }
                } catch (e) {
                  console.error("Failed to capture webcam snapshot:", e);
                }

                const parsedVid = parseVideoUrl(ad.videoUrl).videoUrl;
                const isWebcam = parsedVid === 'webcam' || parsedVid === 'camera';
                
                const archiveVideoUrl = isWebcam 
                  ? "https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761"
                  : ad.videoUrl;

                const parsedUrl = `${archiveVideoUrl}||none||${ad.description || ''}||${ad.city || ''}||${ad.category || ''}`;

                // Update status in backend using authenticated apiFetch with real snapshot
                apiFetch(`/api/promo/${ad.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    title: ad.title || '',
                    videoUrl: parsedUrl,
                    thumbnailUrl: snapshotUrl || getImageUrl(ad.images?.[0]),
                    isLive: false
                  })
                })
                .then(async (res) => {
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.error("Failed to update status on server:", err);
                  }
                  
                  if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => track.stop());
                  }

                  setStatusText(isRtl ? '🛑 جاري إنهاء البث وحفظ النسخة...' : '🛑 Ending broadcast and saving...');
                  setIsOffline(true);
                  
                  setTimeout(() => {
                    if (onStreamEnded) {
                      onStreamEnded(ad.id, archiveVideoUrl, snapshotUrl || undefined);
                    }
                  }, 1000);
                })
                .catch(err => {
                  console.error('Failed to update promo status', err);
                  if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => track.stop());
                  }
                  if (onStreamEnded) {
                    onStreamEnded(ad.id, archiveVideoUrl, snapshotUrl || undefined);
                  }
                });
              }}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 group overflow-hidden relative border-4 z-[9999] active:scale-95 shadow-2xl bg-rose-600 text-white border-white scale-110 shadow-[0_0_50px_rgba(225,29,72,0.6)]"
            >
              <StopCircle className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* Stream Badges Overlay */}
      {!statusText && (
        <div className={`absolute top-28 z-20 flex flex-col gap-1.5 ${isRtl ? 'left-4 items-start' : 'right-4 items-end'}`}>
          <div className="flex items-center gap-1.5 bg-rose-600 text-white font-black px-4 py-1.5 rounded-full text-[10px] shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse border border-white/20 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>{isRtl ? 'بث مباشر حقيقي 🔴' : 'Real-time Live 🔴'}</span>
            <span className="w-px h-3 bg-white/30 mx-2" />
            <span className="flex items-center gap-1">
               <Eye className="w-3.5 h-3.5" />
               {viewerCount.toLocaleString()}
            </span>
          </div>

          {!isBroadcaster && (
            <div className="bg-slate-900/80 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-md text-[8.5px] shadow-md">
              📶 {isRtl ? 'مستقبل تواصل فوري حقيقي' : 'Real WebRTC Link'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SpotlightFeedProps {
  ads: Ad[];
  onSelectAd: (ad: Ad) => void;
  onSelectUser?: (user: User) => void;
  onClose: () => void;
  countryCode: string;
  currentUser: User | null;
  initialAdId?: string;
  onLoginRequest?: () => void;
  onAdUpdated?: (ad: Ad) => void;
  favorites?: string[];
  onLikeToggle?: (adId: string) => void;
}

export default function SpotlightFeed({ 
  ads, 
  onSelectAd, 
  onSelectUser, 
  onClose, 
  countryCode, 
  currentUser, 
  initialAdId,
  onLoginRequest,
  onAdUpdated,
  favorites = [],
  onLikeToggle
}: SpotlightFeedProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [isMuted, setIsMuted] = useState(true);
  const [likedAds, setLikedAds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (favorites) {
      favorites.forEach(id => {
        initial[id] = true;
      });
    }
    return initial;
  });

  const [savedAds, setSavedAds] = useState<Record<string, boolean>>({});
  const [adViews, setAdViews] = useState<Record<string, number>>({});
  const [adComments, setAdComments] = useState<Record<string, { id: string, author: string, text: string, time: string }[]>>({});
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const lastUpdatedByScrollRef = useRef(false);
  const viewedAdIdsRef = useRef<Set<string>>(new Set());

  const [showHeart, setShowHeart] = useState<{ x: number, y: number, id: number } | null>(null);

  const [customBgs, setCustomBgs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localAdOverrides, setLocalAdOverrides] = useState<Record<string, Partial<Ad>>>({});

  const [dbPromoVideos, setDbPromoVideos] = useState<any[]>([]);
  const [managerProfile, setManagerProfile] = useState<{ name: string; avatar: string } | null>(null);

  useEffect(() => {
    fetch('/api/users/manager')
      .then(res => res.json())
      .then(data => {
        if (data && data.name) {
          setManagerProfile({
            name: data.name,
            avatar: data.avatar || "/aswaq-admin-avatar.png"
          });
        }
      })
      .catch(() => {});
  }, []);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedContentType, setSelectedContentType] = useState<'all' | 'live' | 'reels' | 'regular'>('all');
  const [showOnlyPromo, setShowOnlyPromo] = useState(false);
  const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);

  // Collapsible sub-category toggle states or accordion selections
  const [isGeoFilterOpen, setIsGeoFilterOpen] = useState(false);
  const [isContentTypeFilterOpen, setIsContentTypeFilterOpen] = useState(false);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);

  // --- Live Stream Simulator & Upload States ---
  const [liveViewerCount, setLiveViewerCount] = useState<number>(0);
  const [liveComments, setLiveComments] = useState<{ id: string; user: string; text: string; avatar: string }[]>([]);
  const [showLiveUploadModal, setShowLiveUploadModal] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; left: number; color: string; scale: number }[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<{ id: string; title: string; price: number; image: string } | null>(null);
  const [showPinProductModal, setShowPinProductModal] = useState<boolean>(false);

  // --- Live Stream Custom Audio Upload States ---
  const [audioSourceType, setAudioSourceType] = useState<'none' | 'file' | 'link'>('none');
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string>('');
  const [audioUploading, setAudioUploading] = useState<boolean>(false);
  const [audioOriginalName, setAudioOriginalName] = useState<string>('');

  // Shoppable Instant Checkout drawer states
  const [showShoppablePanel, setShowShoppablePanel] = useState<boolean>(false);
  const [shoppableBuyerName, setShoppableBuyerName] = useState<string>('');
  const [shoppableBuyerPhone, setShoppableBuyerPhone] = useState<string>('');
  const [shoppableQuantity, setShoppableQuantity] = useState<number>(1);
  const [shoppableLoading, setShoppableLoading] = useState<boolean>(false);
  const [shoppableSuccess, setShoppableSuccess] = useState<boolean>(false);
  const [shoppableOrderId, setShoppableOrderId] = useState<string>('');

  // ─── شعار إدارة أسواق الرسمي ─────────────────────────────────────────────
  const ASWAQ_ADMIN_AVATAR = "/aswaq-admin-avatar.png";
  const ASWAQ_ADMIN_NAME_AR = "إدارة أسواق";
  const ASWAQ_ADMIN_NAME_EN = "Aswaq Management";

  const promoAds = React.useMemo(() => {
    const currency = MARKETS[countryCode]?.currency || 'YER';
    const adminAvatar = managerProfile?.avatar || ASWAQ_ADMIN_AVATAR;
    const adminName   = managerProfile?.name || (isRtl ? ASWAQ_ADMIN_NAME_AR : ASWAQ_ADMIN_NAME_EN);
    
    return [
    // ─── ريل 1: التسوق الذكي على أسواق ────────────────────────────────────
    {
      id: "promo_marketplace",
      isPromo: true,
      promoType: "concept",
      title: isRtl
        ? "🛍️ تسوّق بذكاء مع منصة أسواق"
        : "🛍️ Shop Smart with Aswaq",
      userName: adminName,
      userAvatar: adminAvatar,
      userId: "aswaq_admin",
      category: isRtl ? "ترويج المنصة" : "Platform Promo",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "منصة أسواق — السوق الرقمي الأول في اليمن والمنطقة العربية. أعلن عن منتجاتك، تفاوض مباشرةً، واشتروا بأمان. تجربة تسوق متكاملة بضغطة واحدة!"
        : "Aswaq — the #1 digital marketplace in Yemen & the Arab region. List your products, negotiate directly, and buy safely. A complete shopping experience in one tap!",
      createdAt: "2026-06-01T00:00:00.000Z",
      views: 24,
      likes: 3,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761",
      features: [
        isRtl ? "✅ ملايين المنتجات بأسعار منافسة" : "✅ Millions of products at competitive prices",
        isRtl ? "✅ تواصل مباشر مع البائعين" : "✅ Direct communication with sellers",
        isRtl ? "✅ دفع آمن وموثوق" : "✅ Safe & secure payments",
      ],
      ctaText: isRtl ? "تسوّق الآن 🛒" : "Shop Now 🛒",
    },
    // ─── ريل 2: خدمة التوصيل السريع ────────────────────────────────────────
    {
      id: "promo_delivery",
      isPromo: true,
      promoType: "delivery",
      title: isRtl
        ? "🚀 توصيل سريع لباب بيتك"
        : "🚀 Fast Delivery to Your Door",
      userName: adminName,
      userAvatar: adminAvatar,
      userId: "aswaq_admin",
      category: isRtl ? "خدمة التوصيل" : "Delivery Service",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "مع خدمة التوصيل في أسواق، استقبل مشترياتك في وقت قياسي! تتبع شحنتك لحظة بلحظة، وادفع عند الاستلام."
        : "With Aswaq delivery, receive your purchases in record time! Track your shipment in real time and pay on delivery.",
      createdAt: "2026-06-05T00:00:00.000Z",
      views: 18,
      likes: 2,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "https://player.vimeo.com/external/394301551.sd.mp4?s=ff7fedf4bb9bc3dc9391b1a43a758bdee1aa6ef8&profile_id=165&oauth2_token_id=57447761",
      features: [
        isRtl ? "🚚 توصيل خلال 24 ساعة" : "🚚 Delivery within 24 hours",
        isRtl ? "📍 تتبع مباشر للشحنة" : "📍 Live shipment tracking",
        isRtl ? "💰 الدفع عند الاستلام متاح" : "💰 Cash on delivery available",
      ],
      ctaText: isRtl ? "اطلب توصيلك الآن 📦" : "Order Delivery Now 📦",
    },
    // ─── ريل 3: ريلز المنتجات الاحترافية ────────────────────────────────────
    {
      id: "promo_reels",
      isPromo: true,
      promoType: "reels",
      title: isRtl
        ? "🎬 أعلن بريل احترافي وبع أكثر"
        : "🎬 Advertise with Pro Reels & Sell More",
      userName: adminName,
      userAvatar: adminAvatar,
      userId: "aswaq_admin",
      category: isRtl ? "ريلز المنتجات" : "Product Reels",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "الريلز التجارية في أسواق — الطريقة الأكثر تأثيراً لعرض منتجاتك! صوّر، أضف موسيقى، وانشر لملايين المستخدمين في ثوانٍ."
        : "Aswaq commercial reels — the most impactful way to showcase your products! Film, add music, and publish to millions of users in seconds.",
      createdAt: "2026-06-10T00:00:00.000Z",
      views: 35,
      likes: 5,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761",
      features: [
        isRtl ? "🎥 تصوير وتعديل مباشر من التطبيق" : "🎥 Film & edit directly from the app",
        isRtl ? "📊 إحصائيات وصول فورية" : "📊 Instant reach analytics",
        isRtl ? "🌍 وصول لملايين المشترين" : "🌍 Reach millions of buyers",
      ],
      ctaText: isRtl ? "ابدأ ريلك الآن 🎬" : "Start Your Reel Now 🎬",
    },
    // ─── ريل 4: الإعلانات المميزة ─────────────────────────────────────────
    {
      id: "promo_featured_ads",
      isPromo: true,
      promoType: "concept",
      title: isRtl
        ? "⭐ ميّز إعلانك وتصدّر النتائج"
        : "⭐ Boost Your Ad & Top the Results",
      userName: adminName,
      userAvatar: adminAvatar,
      userId: "aswaq_admin",
      category: isRtl ? "إعلانات مميزة" : "Featured Ads",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "أسواق تمنحك أدوات التميّز! رفّع إعلانك ليظهر أمام الآلاف من المشترين المهتمين، وحقق مبيعاتك بأسرع وقت ممكن."
        : "Aswaq gives you the tools to stand out! Boost your listing to appear in front of thousands of interested buyers and achieve your sales faster.",
      createdAt: "2026-06-15T00:00:00.000Z",
      views: 12,
      likes: 1,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "https://player.vimeo.com/external/370467553.sd.mp4?s=92b4f2c7e0f23e0c9c1d3b1a1e2f3d4b5c6e7f8a&profile_id=165&oauth2_token_id=57447761",
      features: [
        isRtl ? "⭐ ظهور في أعلى نتائج البحث" : "⭐ Top search result placement",
        isRtl ? "📣 انتشار واسع على الشبكة الاجتماعية" : "📣 Wide social network reach",
        isRtl ? "💹 مضاعفة المبيعات مع الإعلان المميز" : "💹 Multiply sales with featured ads",
      ],
      ctaText: isRtl ? "ميّز إعلانك الآن ⭐" : "Boost Your Ad Now ⭐",
    },
    // ─── ريل 5: الأمان والثقة ────────────────────────────────────────────────
    {
      id: "promo_trust",
      isPromo: true,
      promoType: "concept",
      title: isRtl
        ? "🔐 أسواق — تسوّق بثقة وأمان تام"
        : "🔐 Aswaq — Shop with Complete Safety",
      userName: adminName,
      userAvatar: adminAvatar,
      userId: "aswaq_admin",
      category: isRtl ? "الأمان والثقة" : "Safety & Trust",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "نظام التحقق والتقييمات في أسواق يضمن لك تجربة آمنة. البائعون الموثّقون، والدفع المحمي، وخدمة العملاء على مدار الساعة."
        : "Aswaq's verification & rating system ensures a safe experience. Verified sellers, protected payments, and 24/7 customer support.",
      createdAt: "2026-06-20T00:00:00.000Z",
      views: 9,
      likes: 0,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "https://player.vimeo.com/external/321919467.sd.mp4?s=c27eebe5f76c1a4d8d6e5f3b2a1c4e5d6f7a8b9c&profile_id=165&oauth2_token_id=57447761",
      features: [
        isRtl ? "✅ بائعون موثّقون بهوية حقيقية" : "✅ Identity-verified sellers",
        isRtl ? "🔒 حماية بيانات متقدمة" : "🔒 Advanced data protection",
        isRtl ? "⭐ نظام تقييمات شفاف وموثوق" : "⭐ Transparent rating system",
      ],
      ctaText: isRtl ? "تعرف على ضمانات أسواق 🔐" : "Learn About Aswaq Guarantees 🔐",
    },
  ]}, [t, countryCode, isRtl, managerProfile]);

  const displayAds = React.useMemo(() => {
    const sortedAds = [...ads].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    const combined = [...dbPromoVideos, ...promoAds, ...sortedAds].map(ad => {
      if (localAdOverrides[ad.id]) {
        return { ...ad, ...localAdOverrides[ad.id] };
      }
      return ad;
    });
    
    return combined.filter(ad => {
      // 1. Search Query filter (matches title, description, category or city)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = ad.title?.toLowerCase().includes(query);
        const matchesDesc = ad.description?.toLowerCase().includes(query);
        const matchesCat = ad.category?.toLowerCase().includes(query);
        const matchesCity = ad.city?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesCity) {
          return false;
        }
      }
      
      // 2. Category Filter (Topic)
      if (selectedCategory !== 'all') {
        const adCategory = (ad.category || '').toLowerCase();
        let isMatch = false;
        
        if (selectedCategory === 'reels') {
          isMatch = !!ad.isPromo;
        } else {
          // Find target category name in Arabic and English
          const foundCat = CATEGORIES.find(c => c.id === selectedCategory);
          const targetNameAr = foundCat ? foundCat.nameAr.toLowerCase() : '';
          const targetNameEn = foundCat ? foundCat.nameEn.toLowerCase() : '';
          
          if (
            adCategory.includes(selectedCategory.toLowerCase()) ||
            (targetNameAr && adCategory.includes(targetNameAr)) ||
            (targetNameEn && adCategory.includes(targetNameEn))
          ) {
            isMatch = true;
          }
          
          // Legacy overrides for safety
          if (selectedCategory === 'realestate' && (adCategory.includes('عقار') || adCategory.includes('real') || adCategory.includes('سكن') || adCategory.includes('accommodation') || adCategory.includes('أراضي'))) {
            isMatch = true;
          } else if (selectedCategory === 'cars' && (adCategory.includes('سيار') || adCategory.includes('مركّب') || adCategory.includes('car') || adCategory.includes('vehic'))) {
            isMatch = true;
          } else if (selectedCategory === 'electronics' && (adCategory.includes('إلكترو') || adCategory.includes('أجهز') || adCategory.includes('appliances') || adCategory.includes('electro'))) {
            isMatch = true;
          } else if (selectedCategory === 'phones' && (adCategory.includes('هواتف') || adCategory.includes('هاتف') || adCategory.includes('phone') || adCategory.includes('smart'))) {
            isMatch = true;
          }
        }
        
        if (!isMatch) return false;
      }
      
      // 3. City Filter (Region)
      if (selectedCity !== 'all') {
        if (ad.isPromo && (ad.city === "كافة المناطق" || ad.city === "All Regions" || ad.city === "كافة المدن" || ad.city === "All Cities" || ad.city === "")) {
          // Keep system-wide promos on all cities
        } else {
          const adCity = (ad.city || '').toLowerCase();
          const activeCities = MARKETS[countryCode]?.cities || [];
          const foundCity = activeCities.find(c => c.id === selectedCity);
          const targetCityNameAr = (foundCity?.nameAr || '').toLowerCase();
          const targetCityNameEn = (foundCity?.nameEn || '').toLowerCase();
          
          let isCityMatch = adCity === selectedCity.toLowerCase() || 
                           (targetCityNameAr && adCity === targetCityNameAr) || 
                           (targetCityNameEn && adCity === targetCityNameEn);
          
          if (!isCityMatch) return false;
        }
      }
      
      // 4. Show Only Promos vs Normal
      if (showOnlyPromo) {
        if (!ad.isPromo) return false;
      }

      // 5. Advanced Content Type Filter
      if (selectedContentType !== 'all') {
        if (selectedContentType === 'live') {
          if (!ad.isLive) return false;
        } else if (selectedContentType === 'reels') {
          if (!ad.isPromo || ad.isLive) return false;
        } else if (selectedContentType === 'regular') {
          if (ad.isPromo || ad.isLive) return false;
        }
      }
      
      return true;
    });
  }, [promoAds, dbPromoVideos, ads, searchQuery, selectedCategory, selectedCity, showOnlyPromo, selectedContentType, localAdOverrides]);

  // Set initial index if initialAdId is provided
  useEffect(() => {
    if (initialAdId) {
       const index = displayAds.findIndex(a => a.id === initialAdId);
       if (index !== -1) {
         setActiveIndex(index);
       }
    }
  }, [initialAdId, displayAds]);

  // Fetch administrator/employee uploaded promos
  useEffect(() => {
    fetch('/api/promo')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          const formatted = data.map(pv => {
            const parsed = parseVideoUrl(pv.videoUrl);
            return {
              id: pv.id || `promo_db_${Date.now()}`,
              isPromo: true,
              promoType: "db",
              title: pv.title,
              category: parsed.category || pv.category || (isRtl ? "فيديو ترويجي" : "Promo Video"),
              city: parsed.city || pv.city || (isRtl ? "كافة المناطق" : "All Regions"),
              price: pv.price || 0,
              currency: pv.currency || (MARKETS[countryCode]?.currency || 'YER'),
              description: parsed.description || pv.description || (isRtl ? "مطلب أو بث ترويجي مميز تم نشره من قبل المستخدم" : "Featured promo uploaded by user"),
              createdAt: pv.createdAt || new Date().toISOString(),
              views: pv.views || 0,
              likes: pv.likes || 0,
              userId: pv.userId,
              userName: pv.user?.name || (isRtl ? "زائر" : "Guest"),
              userAvatar: pv.user?.avatar || "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
              userVerified: pv.userVerified !== undefined ? pv.userVerified : true,
              images: [pv.thumbnailUrl || "https://picsum.photos/seed/promo/800/400"],
              videoUrl: parsed.videoUrl,
              audioUrl: parsed.audioUrl,
              isLive: parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera' || !!pv.isLive,
              features: pv.features || [
                isRtl ? "موثق وبث حي تفاعلي" : "Verified interactive live stream",
                isRtl ? "تواصل مباشر وبدون عمولات" : "Direct communication, zero commission"
              ],
              ctaText: pv.ctaText || (isRtl ? "استكشف العرض" : "Explore Offer")
            };
          });
          setDbPromoVideos(formatted);
        }
      })
      .catch(e => console.error('Failed to load db promos', e));
  }, [isRtl, countryCode]);

  const [likesCount, setLikesCount] = useState<Record<string, number>>({});

  useEffect(() => {
    // Sync initial likes and views directly from database ad properties
    const initialLikes: Record<string, number> = {};
    const initialViews: Record<string, number> = {};
    displayAds.forEach(ad => {
      initialLikes[ad.id] = ad.likes || 0;
      initialViews[ad.id] = ad.views || 0;
    });
    setLikesCount(initialLikes);
    setAdViews(initialViews);

    const handleLikeUpdate = ({ adId, likes }: { adId: string, likes: number }) => {
      setLikesCount(prev => ({ ...prev, [adId]: likes }));
    };
    const handleNewBroadcast = (newAd: any) => {
      setDbPromoVideos(prev => {
        if (prev.some(a => a.id === newAd.id)) return prev;
        return [newAd, ...prev];
      });
      showToast(isRtl ? `بدأ بث مباشر جديد: ${newAd.title}` : `New live stream started: ${newAd.title}`);
    };
    socket.on('ad-like-update', handleLikeUpdate);
    socket.on('new-broadcast', handleNewBroadcast);
    return () => {
      socket.off('ad-like-update', handleLikeUpdate);
      socket.off('new-broadcast', handleNewBroadcast);
    };
  }, [isRtl]);

  useEffect(() => {
    const activeAd = displayAds[activeIndex];

    if (activeAd && activeAd.isLive) {
      // 1. Join the stream room
      socket.emit('join-stream', { streamId: activeAd.id, role: 'viewer' });

      // 2. Setup listeners
      const handleViewerCountUpdate = ({ count }: { count: number }) => {
        setLiveViewerCount(count);
      };

      const handleChatMessage = (msg: any) => {
        setLiveComments(prev => [...prev.slice(-15), msg]);
        // Also sync to the sliding comments panel state
        setAdComments(prev => ({
          ...prev,
          [activeAd.id]: [...(prev[activeAd.id] || []), {
            id: msg.id || `c_${Date.now()}_${Math.random()}`,
            author: msg.userName || msg.user || (isRtl ? 'زائر' : 'Guest'),
            text: msg.text,
            time: t('spotlight.now')
          }]
        }));
      };

      const handleLiveHeart = ({ color, left, scale, id }: any) => {
        setFloatingHearts(prev => [...prev.slice(-40), { id, color, left, scale }]);
      };

      const handleProductPinned = (data: any) => {
        if (data.productId) {
          setPinnedProduct({
            id: data.productId,
            title: data.productTitle,
            price: data.productPrice,
            image: data.productImage
          });
        } else {
          setPinnedProduct(null);
        }
      };

      socket.on('viewer-count-update', handleViewerCountUpdate);
      socket.on('chat-message', handleChatMessage);
      socket.on('live-heart', handleLiveHeart);
      socket.on('product-pinned', handleProductPinned);

      return () => {
        socket.emit('leave-stream', { streamId: activeAd.id, role: 'viewer' });
        socket.off('viewer-count-update', handleViewerCountUpdate);
        socket.off('chat-message', handleChatMessage);
        socket.off('live-heart', handleLiveHeart);
        socket.off('product-pinned', handleProductPinned);
        setLiveComments([]);
        setFloatingHearts([]);
        setPinnedProduct(null);
      };
    } else {
      setLiveViewerCount(0);
      setLiveComments([]);
      setFloatingHearts([]);
      setPinnedProduct(null);
    }
  }, [activeIndex, displayAds]);

  const sendLiveHeart = () => {
    const activeAd = displayAds[activeIndex];
    const colors = ['#f43f5e', '#ec4899', '#bd00ff', '#10b981', '#3b82f6', '#f59e0b'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.floor(Math.random() * 60) + 20;
    const scale = Math.random() * 0.5 + 0.8;
    const id = Date.now() + Math.random();
    
    const newHeart = { id, left, color: randomColor, scale };
    setFloatingHearts(prev => [...prev.slice(-40), newHeart]);

    if (activeAd && activeAd.isLive) {
      socket.emit('live-heart', { streamId: activeAd.id, color: randomColor, left, scale });
    }
    
    showToast(isRtl ? "تم تفاعل بقلب طائر للبث المباشر! ❤️" : "Sent flying heart to live stream! ❤️");
  };

  useEffect(() => {
    if (activeIndex >= displayAds.length) {
      setActiveIndex(Math.max(0, displayAds.length - 1));
    }
  }, [displayAds.length, activeIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const height = el.clientHeight;
    if (height <= 0) return;
    
    isScrollingRef.current = true;
    
    // Only update index after scroll settles (snap complete)
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < displayAds.length) {
      lastUpdatedByScrollRef.current = true;
      setActiveIndex(newIndex);
    }
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      // Re-snap to exact position after scroll ends to fix partial scroll on iOS
      const finalIndex = Math.round(el.scrollTop / el.clientHeight);
      if (finalIndex !== activeIndex && finalIndex >= 0 && finalIndex < displayAds.length) {
        lastUpdatedByScrollRef.current = true;
        setActiveIndex(finalIndex);
      }
    }, 100);
  };

  // Ensure container scrolls to the correct ad when activeIndex is changed programmatically
  useEffect(() => {
    if (containerRef.current) {
      if (lastUpdatedByScrollRef.current) {
        lastUpdatedByScrollRef.current = false;
        return;
      }
      const height = containerRef.current.clientHeight;
      const targetScrollPos = activeIndex * height;
      if (!isScrollingRef.current && Math.abs(containerRef.current.scrollTop - targetScrollPos) > 5) {
        containerRef.current.scrollTo({
          top: targetScrollPos,
          behavior: 'smooth'
        });
      }
    }
    
    // Cleanup on unmount or activeIndex change
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [activeIndex]);

  useEffect(() => {
    const activeAd = displayAds[activeIndex];
    if (activeAd) {
      const currentId = activeAd.id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof currentId === 'string' && uuidRegex.test(currentId) && !viewedAdIdsRef.current.has(currentId)) {
        viewedAdIdsRef.current.add(currentId);
        apiFetch(`/api/ads/${currentId}/view`, { method: "POST" })
          .then(res => res.json())
          .then(data => {
            if (data && typeof data.views === 'number') {
              setAdViews(prev => ({ ...prev, [currentId]: data.views }));
            }
          })
          .catch(() => {});
      }
    }
  }, [activeIndex, displayAds]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent, adId: string) => {
    let x, y;
    if ('clientX' in e) {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    } else {
      const touch = (e as React.TouchEvent).touches[0];
      x = touch.clientX;
      y = touch.clientY;
    }

    setShowHeart({ x, y, id: Date.now() });
    if (!likedAds[adId]) {
      toggleLike(adId);
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const toggleLike = (adId: string) => {
    if (!currentUser) {
      if (onLoginRequest) onLoginRequest();
      return;
    }

    const isLiked = !!likedAds[adId];
    setLikedAds(prev => ({ ...prev, [adId]: !isLiked }));
    
    // Optimistically update likes count (+1 when liking, -1 when unliking)
    setLikesCount(prev => {
      const currentCount = prev[adId] !== undefined ? prev[adId] : Number(displayAds.find(a => a.id === adId)?.likes || 0);
      const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
      return { ...prev, [adId]: newCount };
    });
    
    // Notify parent state to sync likes globally
    const adObj = ads.find(a => a.id === adId);
    if (adObj && onAdUpdated) {
      const currentLikes = adObj.likes || 0;
      onAdUpdated({
        ...adObj,
        likes: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
      });
    }

    if (onLikeToggle) {
      onLikeToggle(adId);
    }

    // Fire real endpoint hit to persist to database and return real count
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(adId)) {
      apiFetch(`/api/ads/${adId}/like`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: !isLiked ? 'like' : 'unlike' })
      })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.likes === 'number') {
          setLikesCount(prev => ({ ...prev, [adId]: data.likes }));
        }
      })
      .catch(() => {});
    }

    // Emit socket event for real-time sync across all clients
    socket.emit('ad-like', { adId, userId: currentUser.id });

    const activeAd = displayAds[activeIndex];
    if (activeAd && activeAd.isLive && activeAd.id === adId) {
      // For live streams, send a heart reaction too
      sendLiveHeart();
    }

    if (!isLiked) {
      showToast(t('spotlight.likedToast'));
    } else {
      showToast(t('spotlight.unlikedToast'));
    }
  };

  const toggleSave = (adId: string) => {
    const isSaved = savedAds[adId];
    setSavedAds(prev => ({ ...prev, [adId]: !prev[adId] }));
    if (!isSaved) {
      showToast(t('spotlight.savedToast'));
    } else {
      showToast(t('spotlight.unsavedToast'));
    }
  };

  const handleShare = (ad: Ad) => {
    const textMsg = `${isRtl ? 'شاهد هذا العرض الرائع' : 'Check out this awesome deal'}: "${ad.title}" ${isRtl ? 'بسعر' : 'for'} ${(ad.price || 0).toLocaleString()} ${isRtl ? getCurrencyAr(ad.currency) : ad.currency}`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#ad-${ad.id}` : '';
    
    if (navigator.share) {
      navigator.share({
        title: ad.title,
        text: textMsg,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${textMsg}\n${shareUrl}`);
      showToast(t('spotlight.copiedToast'));
    }
  };

  return (
    <div className={`fixed inset-0 z-[3000] bg-black select-none ${isRtl ? 'dir-rtl' : 'dir-ltr'}`}>
      {/* Toast Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[800] bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400 text-sm"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Advanced Search, Topic Filtering, & Region Selectors */}
      <div className={`absolute top-0 left-0 right-0 z-[100] p-4 pt-safe pb-2 bg-gradient-to-b from-black/95 via-black/80 to-transparent flex flex-col gap-3`}>
        <div className={`flex items-center justify-between w-full ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
          <button 
            onClick={onClose}
            className="text-white hover:text-emerald-400 transition-colors p-1.5 sm:p-2 bg-slate-950/75 border border-white/10 rounded-full backdrop-blur-md cursor-pointer flex items-center justify-center shadow-lg"
          >
            <ChevronDown className={`w-5 h-5 sm:w-6 sm:h-6 ${isRtl ? 'rotate-90' : '-rotate-90'}`} />
          </button>
          
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live & Reels upload button */}
            <button
              onClick={() => {
                setShowLiveUploadModal(true);
                showToast(isRtl ? "شغل بثك المباشر أو انشر ريلز لصفقتك الآن! 🎥" : "Start your Live Broadcast or Post a Reels promo now! 🎥");
              }}
              className="text-white bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-pink-400/30 flex items-center gap-1 cursor-pointer transition-all duration-300 font-extrabold shadow shadow-pink-500/10 hover:border-pink-400"
            >
              <Video className="w-3 h-3 text-white animate-pulse" />
              <span>{isRtl ? 'بث وريلز +' : 'Live & Reels +'}</span>
            </button>

            <div className="flex items-center gap-2 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40 backdrop-blur-md shadow-md hidden xs:flex">
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'} shadow-[0_0_5px_rgba(16,185,129,0.5)]`} />
              <span className="text-white font-black tracking-widest text-[10px] sm:text-xs">
                {socketConnected ? t('spotlight.smartDiscovery') : (isRtl ? 'غير متصل' : 'OFFLINE')}
              </span>
            </div>
            
            {/* Advanced Filters Toggle Pill */}
            <button
              onClick={() => setShowFiltersExpanded(!showFiltersExpanded)}
              className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-full border flex items-center gap-1 backdrop-blur-md cursor-pointer transition-all duration-300 font-bold shadow-md ${
                showFiltersExpanded || searchQuery || selectedCity !== 'all' || showOnlyPromo
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                  : 'bg-slate-950/80 text-white border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{isRtl ? 'تصفية ذكية' : 'Smart Filter'}</span>
              {(searchQuery || selectedCity !== 'all' || showOnlyPromo) && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>

          <button 
            onClick={() => {
              setIsMuted(!isMuted);
              showToast(isMuted ? t('spotlight.audioOn') : t('spotlight.audioOff'));
            }}
            className="text-white p-1.5 sm:p-2 bg-slate-950/75 border border-white/10 rounded-full backdrop-blur-md hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors cursor-pointer flex items-center justify-center shadow-lg"
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-rose-450" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
          </button>
        </div>

        {/* Expandable Advanced Filters Overlay */}
        <AnimatePresence>
          {showFiltersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-slate-950/95 border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col gap-3 shadow-2xl backdrop-blur-xl z-50 text-right font-sans"
            >
              {/* Keyword text search field */}
              <div className="relative flex items-center">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? "ابحث عن موضوع معين أو إعلان محدد..." : "Search for a specific ad, description..."}
                  className="w-full bg-[#0b0f1a] border border-white/10 rounded-xl pr-10 pl-10 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-bold text-right"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Geological Region / Governorates Accordion */}
              <div className="flex flex-col gap-1 border-t border-white/5 pt-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setIsGeoFilterOpen(!isGeoFilterOpen);
                    setIsContentTypeFilterOpen(false);
                    setIsCategoryFilterOpen(false);
                  }}
                  className={`flex items-center justify-between w-full p-2.5 rounded-xl transition-all font-bold cursor-pointer flex-row-reverse text-right bg-slate-900/60 hover:bg-slate-900 border ${
                    isGeoFilterOpen ? 'border-emerald-500/40 shadow-md shadow-emerald-500/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] sm:text-xs text-slate-200 font-extrabold">
                      {isRtl ? 'المنطقة الجغرافية والمحافظات' : 'Geographical Region / Governorates'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="text-[9.5px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-400 font-black max-w-[130px] truncate">
                      {selectedCity === 'all' 
                        ? (isRtl ? 'كافة المحافظات 🌍' : 'All Governorates 🌍')
                        : (isRtl 
                            ? (MARKETS[countryCode]?.cities.find(c => c.id === selectedCity)?.nameAr || selectedCity)
                            : (MARKETS[countryCode]?.cities.find(c => c.id === selectedCity)?.nameEn || selectedCity)
                          )
                      }
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isGeoFilterOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isGeoFilterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1.5 scrollbar-none flex-wrap justify-end">
                        {[
                          { id: 'all', nameAr: 'كافة المحافظات والمناطق 🌍', nameEn: 'All Governorates 🌍' },
                          ...(MARKETS[countryCode]?.cities || [])
                        ].map(cityOpt => (
                          <button
                            key={cityOpt.id}
                            type="button"
                            onClick={() => {
                              setSelectedCity(cityOpt.id);
                              showToast(isRtl ? `تم التصفية جغرافياً: ${cityOpt.nameAr}` : `Geographical filter: ${cityOpt.nameEn}`);
                            }}
                            className={`text-[9.5px] sm:text-xs px-3 py-1.5 rounded-full border font-bold transition-all cursor-pointer ${
                              selectedCity === cityOpt.id
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                                : 'bg-[#0c101d] text-slate-300 border-white/5 hover:border-slate-700'
                            }`}
                          >
                            {isRtl ? cityOpt.nameAr : cityOpt.nameEn}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content Type Accordion */}
              <div className="flex flex-col gap-1 border-t border-white/5 pt-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setIsContentTypeFilterOpen(!isContentTypeFilterOpen);
                    setIsGeoFilterOpen(false);
                    setIsCategoryFilterOpen(false);
                  }}
                  className={`flex items-center justify-between w-full p-2.5 rounded-xl transition-all font-bold cursor-pointer flex-row-reverse text-right bg-slate-900/60 hover:bg-slate-900 border ${
                    isContentTypeFilterOpen ? 'border-pink-500/40 shadow-md shadow-pink-500/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <Video className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                    <span className="text-[11px] sm:text-xs text-slate-200 font-extrabold">
                      {isRtl ? 'نوع البث والمحتوى المعروض' : 'Content & Broadcast Type'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="text-[9.5px] bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 rounded-full text-pink-400 font-black">
                      {selectedContentType === 'all' && (isRtl ? 'كافة المحتويات 🔥' : 'All Media 🔥')}
                      {selectedContentType === 'live' && (isRtl ? 'البث المباشر 🔴' : 'Live Broadcasts 🔴')}
                      {selectedContentType === 'reels' && (isRtl ? 'ريلز وعروض 🎬' : 'Promo Reels 🎬')}
                      {selectedContentType === 'regular' && (isRtl ? 'مشاركات الأعضاء 💬' : 'Member Store Posts 💬')}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isContentTypeFilterOpen ? 'rotate-180 text-pink-400' : ''}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isContentTypeFilterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1.5 scrollbar-none flex-wrap justify-end">
                        {[
                          { id: 'all', nameAr: '🔥 كافة المحتويات والريلز', nameEn: '🔥 All Media' },
                          { id: 'live', nameAr: '🔴 البث المباشر الحي', nameEn: '🔴 Live Broadcasts' },
                          { id: 'reels', nameAr: '🎬 ريلز وعروض ترويجية', nameEn: '🎬 Promo Reels' },
                          { id: 'regular', nameAr: '💬 مشاركات وإعلانات الأعضاء', nameEn: '💬 Member Store Posts' },
                        ].map(type => {
                          const isSelected = selectedContentType === type.id;
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                setSelectedContentType(type.id as any);
                                showToast(isRtl ? `نوع المحتوى: ${type.nameAr}` : `Content Type: ${type.nameEn}`);
                              }}
                              className={`text-[9.5px] sm:text-xs px-3 py-1.5 rounded-full border font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-slate-950 border-pink-400 font-black shadow-lg shadow-pink-500/20'
                                  : 'bg-[#0c101d] text-slate-300 border-white/5 hover:border-slate-750'
                              }`}
                            >
                              {type.nameAr}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category & Section Accordion */}
              <div className="flex flex-col gap-1 border-t border-white/5 pt-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryFilterOpen(!isCategoryFilterOpen);
                    setIsGeoFilterOpen(false);
                    setIsContentTypeFilterOpen(false);
                  }}
                  className={`flex items-center justify-between w-full p-2.5 rounded-xl transition-all font-bold cursor-pointer flex-row-reverse text-right bg-slate-900/60 hover:bg-slate-900 border ${
                    isCategoryFilterOpen ? 'border-amber-500/40 shadow-md shadow-amber-500/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] sm:text-xs text-slate-200 font-extrabold">
                      {isRtl ? 'القسم والنوع (عقارات، سيارات، هواتف...)' : 'Category & Section (Real Estate, Cars, Phones...)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <span className="text-[9.5px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-amber-450 font-black max-w-[130px] truncate">
                      {selectedCategory === 'all' 
                        ? (isRtl ? 'كل الأقسام 🗂️' : 'All Categories 🗂️')
                        : (selectedCategory === 'reels'
                            ? (isRtl ? 'عروض برعاية المنصة 💎' : 'Platform Sponsored 💎')
                            : (isRtl 
                                ? (CATEGORIES.find(c => c.id === selectedCategory)?.nameAr || selectedCategory)
                                : (CATEGORIES.find(c => c.id === selectedCategory)?.nameEn || selectedCategory)
                              )
                          )
                      }
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isCategoryFilterOpen ? 'rotate-180 text-amber-400' : ''}`} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isCategoryFilterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-1.5 overflow-y-auto max-h-40 pb-2 pt-1.5 pr-1 pl-1 scrollbar-thin scrollbar-thumb-emerald-500/25 scrollbar-track-transparent flex-wrap justify-end">
                        {[
                          { id: 'all', nameAr: '🔥 كل الأقسام', nameEn: '🔥 All Categories' },
                          { id: 'reels', nameAr: '💎 عروض برعاية المنصة', nameEn: '💎 Sponsored Showcase' },
                          ...CATEGORIES
                        ].map(cat => {
                          const isSelected = selectedCategory === cat.id;
                          const displayName = isRtl ? cat.nameAr : cat.nameEn;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat.id);
                                if (cat.id !== 'all' && cat.id !== 'reels') {
                                  setShowOnlyPromo(false);
                                } else if (cat.id === 'reels') {
                                  setShowOnlyPromo(true);
                                }
                                showToast(isRtl ? `تصفية حسب قسم: ${displayName}` : `Filtered by: ${displayName}`);
                              }}
                              className={`text-[9.5px] sm:text-[10px] px-2.7 py-1.5 rounded-full border font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow shadow-emerald-500/25'
                                  : 'bg-[#0c101d] text-slate-300 border-white/5 hover:border-slate-800'
                              }`}
                            >
                              {displayName}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sponsor Switch */}
              <div className="flex items-center justify-between border-t border-white/5 pt-2 flex-wrap gap-2 text-right">
                <div className="flex items-center gap-1.5 flex-row-reverse">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] sm:text-xs text-slate-300 font-bold">
                    {isRtl ? 'عرض الريلز الإرشادية والترويجية برعاية المنصة فقط' : 'Show sponsored platform promos only'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnlyPromo(!showOnlyPromo);
                    showToast(showOnlyPromo ? (isRtl ? 'تعرض كافة الإعلانات والريلز' : 'Showing all reels') : (isRtl ? 'تعرض الريلز الممولة فقط' : 'Showing sponsored reels only'));
                  }}
                  className={`text-[9px] sm:text-xs px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                    showOnlyPromo
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {showOnlyPromo ? (isRtl ? 'نشط ⚡' : 'Active ⚡') : (isRtl ? 'إظهار الكل' : 'Show All')}
                </button>
              </div>

              {/* Reset Button */}
              {(searchQuery || selectedCity !== 'all' || selectedCategory !== 'all' || selectedContentType !== 'all' || showOnlyPromo) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('all');
                    setSelectedCategory('all');
                    setSelectedContentType('all');
                    setShowOnlyPromo(false);
                    showToast(isRtl ? 'تم تصفير خيارات الفلترة بنجاح' : 'Filters reset successfully');
                  }}
                  className="w-full text-center py-2.5 text-[10px] text-rose-400 hover:text-rose-300 font-black border border-rose-500/20 rounded-lg bg-rose-500/5 transition-all cursor-pointer"
                >
                  {isRtl ? '× إزالة كافة خيارات وإعدادات الفلترة' : '× Reset All Applied Filters'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feed Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none overscroll-y-contain"
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      >
        {displayAds.length === 0 ? (
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center mb-4">
              <Film className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">
              {isRtl ? "لم يتم العثور على مقاطع ريلز تطابق الفلترة" : "No matching reels found"}
            </h3>
            <p className="text-xs text-slate-400 font-bold max-w-sm mb-6 leading-relaxed text-center">
              {isRtl 
                ? "عذراً، لا توجد صفقات، إعلانات مصورة أو ريلز ترويجية تطابق التصفية الحالية. يرجى تعديل أو فرز خيارات الفلترة الخاصة بك."
                : "No video deals, showcase uploads or promo reels fit your current search query. Modify the filter or keyword selection."}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCity('all');
                setSelectedCategory('all');
                setShowOnlyPromo(false);
                showToast(isRtl ? 'تم إعادة تعيين الفلاتر' : 'Filters reset');
              }}
              className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-style shadow-lg cursor-pointer"
            >
              {isRtl ? "إعادة تعيين كافة الفلاتر 🔄" : "Reset All Filters 🔄"}
            </button>
          </div>
        ) : (
          displayAds.map((ad, i) => {
            const isLiked = likedAds[ad.id] || false;
            const isSaved = savedAds[ad.id] || false;
            const isCurrent = i === activeIndex;
            const isPreloading = Math.abs(i - activeIndex) <= 1;

            if (!isPreloading) {
              return (
                <div 
                  key={ad.id} 
                  className="h-full min-h-full w-full snap-start snap-always shrink-0 bg-neutral-950 flex items-center justify-center relative overflow-hidden"
                  style={{ touchAction: 'pan-y' }}
                >
                  <div className="w-8 h-8 rounded-full border-4 border-slate-900 border-t-emerald-500 animate-spin" />
                </div>
              );
            }

            const relativeDateString = (dateStr: string) => {
              const elapsed = Date.now() - new Date(dateStr).getTime();
              const minutes = Math.floor(elapsed / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) {
              if (days === 1) return t('spotlight.days.one');
              if (days === 2) return t('spotlight.days.two');
              if (days >= 3 && days <= 10) return t('spotlight.days.few', { count: days });
              return t('spotlight.days.many', { count: days });
            }
            if (hours > 0) {
              if (hours === 1) return t('spotlight.hours.one');
              if (hours === 2) return t('spotlight.hours.two');
              if (hours >= 3 && hours <= 10) return t('spotlight.hours.few', { count: hours });
              return t('spotlight.hours.many', { count: hours });
            }
            if (minutes > 0) {
              if (minutes === 1) return t('spotlight.minutes.one');
              if (minutes === 2) return t('spotlight.minutes.two');
              return t('spotlight.minutes.many', { count: minutes });
            }
            return t('spotlight.now');
          };

          return (
            <div 
              key={ad.id} 
              onDoubleClick={(e) => handleDoubleTap(e, ad.id)}
              className="h-full min-h-full w-full snap-start snap-always shrink-0 relative flex flex-col items-center justify-center overflow-hidden"
              style={{ touchAction: 'pan-y' }}
            >
              {/* Heart Pop Animation */}
              <AnimatePresence>
                {showHeart && (
                  <motion.div
                    key={showHeart.id}
                    initial={{ scale: 0, opacity: 0, rotate: -20 }}
                    animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0], rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    onAnimationComplete={() => setShowHeart(null)}
                    style={{ left: showHeart.x - 50, top: showHeart.y - 50 }}
                    className="fixed z-[1000] pointer-events-none text-rose-500 shadow-2xl"
                  >
                    <Heart className="w-24 h-24 fill-current drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Background Image / Video Simulation */}
              <div className="absolute inset-0 z-0 bg-neutral-950">
                {/* 1. Base Layer: Always render background image as a stable backdrop to avoid flashes of black */}
                <img 
                  src={(customBgs[ad.id] && currentUser?.id === ad.userId) ? customBgs[ad.id] : getImageUrl(ad.images?.[0])} 
                  alt={ad.title}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isCurrent ? 'brightness-100' : 'brightness-40 blur-[4px]'}`}
                  loading="lazy"
                />

        {/* 2. Interactive Video Overlay (Only active for the current slide if no custom image is set or visible) */}
                {(() => {
                  const parsedMedia = parseVideoUrl(ad.videoUrl);
                  const actualVid = parsedMedia.videoUrl || ad.videoUrl || '';
                  const isWebcamSource = actualVid === 'webcam' || actualVid === 'camera';
                  const isAdLive = localAdOverrides[ad.id]?.isLive !== undefined ? localAdOverrides[ad.id].isLive : ad.isLive;

                  return (
                    <>
                      {((isWebcamSource ? isCurrent : isPreloading)) && actualVid && (
                        isWebcamSource ? (
                          <div className="absolute inset-0 z-[60]">
                            <WebcamStreamPlayer 
                              isMuted={isMuted} 
                              isRtl={isRtl} 
                              ad={ad} 
                              currentUser={currentUser} 
                              pinnedProduct={pinnedProduct} 
                              onPinProductClick={() => setShowPinProductModal(true)} 
                              onStreamEnded={(adId, archiveUrl, archiveThumb) => {
                                const overrideUrl = `${archiveUrl}||none||${ad.description || ''}||${ad.city || ''}||${ad.category || ''}`;
                                setLocalAdOverrides(prev => ({
                                  ...prev,
                                  [adId]: {
                                    isLive: false,
                                    videoUrl: overrideUrl,
                                    images: archiveThumb ? [archiveThumb] : ad.images
                                  }
                                }));
                                if (archiveThumb) {
                                  setCustomBgs(prev => ({ ...prev, [adId]: archiveThumb }));
                                }
                                apiFetch(`/api/promo/${adId}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    isLive: false, 
                                    videoUrl: overrideUrl,
                                    thumbnailUrl: archiveThumb || getImageUrl(ad.images?.[0])
                                  })
                                }).catch(() => {});
                                showToast(isRtl ? "تم إنهاء البث بنجاح وتحويله إلى فيديو مسجل! 🎥" : "Live stream completed and converted to playback! 🎥");
                              }}
                            />
                          </div>
                        ) : getYoutubeEmbedUrlForBg(actualVid, isMuted) ? (
                          <div className="absolute inset-0 w-full h-full z-[1]">
                            <iframe
                              src={getYoutubeEmbedUrlForBg(actualVid, isMuted) || undefined}
                              className="w-full h-full object-cover scale-[1.3] pointer-events-none brightness-95 absolute inset-0 border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              title="Spotlight Background Video"
                            />
                          </div>
                        ) : (
                          <div className="absolute inset-0 w-full h-full z-[1]">
                            <video 
                              src={actualVid} 
                              autoPlay={isCurrent}
                              loop 
                              muted={ad.audioUrl ? true : isMuted}
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover brightness-100"
                            />
                            {ad.audioUrl && (
                              <AudioPlayer 
                                src={ad.audioUrl} 
                                isPlaying={isCurrent} 
                                isMuted={isMuted} 
                              />
                            )}
                          </div>
                        )
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/30 z-[2]" />
                      
                      {/* Live Stream Indicator & Badge - Only show when stream is live */}
                      {isAdLive && !isWebcamSource && (
                        <div className={`absolute top-28 z-[70] flex items-center gap-2 bg-rose-600 border border-rose-500/40 text-white font-black px-4 py-2 rounded-full shadow-[0_4px_25px_rgba(225,29,72,0.4)] ${isRtl ? 'left-6' : 'right-6'} backdrop-blur-xl`}>
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span className="text-[10px] sm:text-[11px] tracking-wider uppercase font-black">{isRtl ? 'بث مباشر 🔴' : 'LIVE 🔴'}</span>
                          <span className="w-px h-4 bg-white/20" />
                          <span className="text-[10px] sm:text-[11px] font-mono font-black">{(liveViewerCount || 0).toLocaleString()} 👁️</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Simulated Live Feed Floating Comments - REMOVED TO PREVENT OVERLAP WITH REAL CHAT */}

              {/* Floating hearts container for Live view */}
              {ad.isLive && floatingHearts.length > 0 && (
                <div className={`absolute bottom-24 z-30 pointer-events-none w-28 h-64 overflow-hidden flex flex-col items-center select-none ${isRtl ? 'right-20' : 'left-20'}`}>
                  <AnimatePresence>
                    {floatingHearts.map(heart => (
                      <motion.div
                        key={heart.id}
                        initial={{ y: 220, x: 0, opacity: 1, scale: heart.scale }}
                        animate={{ 
                          y: -50, 
                          x: Math.sin(heart.id) * 35, // sinusoidal wave path
                          opacity: 0,
                          scale: heart.scale * 1.4
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.8, ease: "easeOut" }}
                        className="absolute bottom-0 text-xl"
                        style={{ 
                          color: heart.color,
                          left: `${heart.left}%`,
                          textShadow: '0 0 4px rgba(0,0,0,0.4)'
                        }}
                      >
                        ❤️
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Side Actions (TikTok Style) - INCREASED Z-INDEX and Improved Styling */}
              {currentUser?.id === ad.userId && !ad.isPromo && (
                <div className={`absolute top-24 z-[110] ${isRtl ? 'left-6' : 'right-6'}`}>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-purple-600/20 hover:bg-purple-600/40 backdrop-blur-xl border border-purple-500/30 text-white text-[10px] sm:text-xs font-black px-4 py-2.5 rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    {isRtl ? 'خلفية مخصصة' : 'Custom BG'}
                  </button>
                </div>
              )}

              <div className={`absolute bottom-24 sm:bottom-28 z-[200] flex flex-col gap-4 sm:gap-5 items-center pointer-events-auto ${isRtl ? 'left-2 sm:left-3' : 'right-2 sm:right-3'}`}>
                
                {/* 1. Avatar Profile */}
                <div className="flex flex-col items-center gap-1 relative mb-2">
                  <div 
                     onClick={() => {
                       const isSystemAdminPromo = ad.promoType === 'system' || ad.userName === 'إدارة أسواق' || ad.userName === 'Aswaq Management';
                       if (isSystemAdminPromo) {
                         showToast(isRtl ? '🏢 إدارة أسواق — المنصة الرسمية' : '🏢 Aswaq Management — Official Platform');
                         return;
                       }
                       const usr = INITIAL_USERS.find(u => u.avatar === ad.userAvatar || u.id === ad.userId);
                       if (usr && onSelectUser) {
                         onSelectUser(usr);
                         onClose();
                       } else {
                         onSelectAd(ad);
                       }
                       showToast(t('spotlight.merchantToast'));
                     }}
                     className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-slate-900 shadow-xl cursor-pointer hover:scale-105 transition-transform ${
                       (ad.promoType === 'system' || ad.userName === 'إدارة أسواق')
                         ? 'border-[2px] border-amber-400 shadow-amber-400/40 shadow-lg ring-2 ring-amber-500/30'
                         : 'border-[1.5px] border-white p-0.5'
                     }`}
                  >
                    <Avatar 
                      src={(ad.promoType === 'system' || ad.userName === 'إدارة أسواق') ? '/aswaq-admin-avatar.png' : (ad.user?.avatar || ad.userAvatar)} 
                      name={(ad.promoType === 'system' || ad.userName === 'إدارة أسواق') ? (isRtl ? 'إدارة أسواق' : 'Aswaq Management') : (ad.user?.name || ad.userName || (isRtl ? 'بائع أسواق' : 'Aswaq Seller'))} 
                      sizeClassName="w-full h-full"
                      className="rounded-full"
                    />
                  </div>
                  {/* Badge: شعار ذهبي للإدارة / زر متابعة للعاديين */}
                  {(ad.promoType === 'system' || ad.userName === 'إدارة أسواق') ? (
                    <div className="absolute -bottom-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-amber-500/50 border border-white"
                         title={isRtl ? 'إدارة أسواق الرسمية' : 'Official Aswaq Management'}
                    >
                      <span className="text-slate-900 text-[9px] leading-none font-black">✓</span>
                    </div>
                  ) : (
                    <div className="absolute -bottom-2 bg-rose-500 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-rose-500/50 border border-white"
                         onClick={() => {
                            onSelectAd(ad);
                            showToast(t('spotlight.chatToast'));
                         }}
                    >
                      <span className="text-white text-xs leading-none font-bold">+</span>
                    </div>
                  )}
                </div>
                {/* اسم صاحب الريل */}
                <span className={`text-[9px] font-black drop-shadow-lg text-center leading-tight max-w-[48px] truncate ${
                  (ad.promoType === 'system' || ad.userName === 'إدارة أسواق') ? 'text-amber-300' : 'text-white/90'
                }`}>
                  {(ad.promoType === 'system' || ad.userName === 'إدارة أسواق')
                    ? (isRtl ? 'إدارة\nأسواق' : 'Aswaq\nMgmt')
                    : (ad.user?.name?.split(' ')[0] || ad.userName?.split(' ')[0] || (isRtl ? 'بائع' : 'Seller'))
                  }
                </span>

                {/* 2. Like */}
                <div className="flex flex-col items-center gap-1 group mt-1">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleLike(ad.id)}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all duration-300 shadow-lg relative overflow-hidden ${
                      isLiked 
                        ? 'text-rose-500' 
                        : 'bg-black/30 text-white hover:bg-black/50'
                    }`}
                  >
                    <Heart className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${isLiked ? 'fill-rose-500 text-rose-500' : 'group-hover:text-rose-400'}`} />
                    {isLiked && (
                       <motion.div 
                         initial={{ scale: 0 }} animate={{ scale: 2, opacity: 0 }} 
                         transition={{ duration: 0.5 }}
                         className="absolute inset-0 bg-rose-500/30 rounded-full"
                       />
                    )}
                  </motion.button>
                  <span className="text-white text-[10px] sm:text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-wide">
                    {(likesCount[ad.id] !== undefined ? likesCount[ad.id] : Number(ad.likes || 0)).toLocaleString()}
                  </span>
                </div>

                {/* 3. Comments */}
                <div className="flex flex-col items-center gap-1 group">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCommentsPanel(true)}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-all shadow-lg"
                  >
                    <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 group-hover:text-cyan-400 transition-colors" />
                  </motion.button>
                  <span className="text-white text-[10px] sm:text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-wide">
                    {(((ad as any).comments?.length || 0) + (adComments[ad.id]?.length || 0)).toLocaleString()}
                  </span>
                </div>

                {/* 4. Shoppable Deal Button */}
                <div className="flex flex-col items-center gap-1 group">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowShoppablePanel(true);
                      setShoppableSuccess(false);
                      setShoppableOrderId('');
                      setShoppableBuyerName(currentUser?.name || '');
                      setShoppableBuyerPhone(currentUser?.phone || '');
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse active:animate-none cursor-pointer"
                  >
                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.button>
                  <span className="text-emerald-400 text-[9px] sm:text-[10px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-wide">
                    {isRtl ? 'شراء' : 'Buy'}
                  </span>
                </div>

                {/* 5. Share */}
                <div className="flex flex-col items-center gap-1 group">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleShare(ad)}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-all shadow-lg"
                  >
                    <Share2 className="w-6 h-6 sm:w-7 sm:h-7 group-hover:text-amber-400 transition-colors" />
                  </motion.button>
                  <span className="text-white text-[10px] sm:text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-wide">
                    {t('spotlight.share')}
                  </span>
                </div>

                {/* Live Stream Heart Reaction */}
                {ad.isLive && (
                  <div className="flex flex-col items-center gap-1 mt-2">
                    <button 
                      onClick={sendLiveHeart}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white font-extrabold hover:scale-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer"
                      title="Send Heart"
                    >
                      <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                    </button>
                    <span className="text-[9px] sm:text-[10px] text-pink-400 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      {isRtl ? 'تفاعل' : 'React'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Info Overlay - INCREASED Z-INDEX for visibility over video and rails */}
              <div className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 pt-32 pb-8 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none flex flex-col justify-end z-[120] ${isRtl ? 'pr-14 sm:pr-24 pl-14 sm:pl-24 text-right' : 'pl-14 sm:pl-24 pr-14 sm:pr-24 text-left'}`}>
                <div className="w-full max-w-xl space-y-2.5 pointer-events-auto">
                  {/* Pinned Product Card for Live Stream Viewers */}
                  {ad.isLive && pinnedProduct && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-3 p-2.5 bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-xl max-w-xs sm:max-w-sm pointer-events-auto mb-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}
                    >
                      <img 
                        src={pinnedProduct.image || 'https://images.unsplash.com/photo-1540553016722-983e48a2cd10?auto=format&fit=crop&w=120&q=80'} 
                        className="w-12 h-12 rounded-xl object-cover border border-slate-850 shrink-0" 
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <span className="text-[8.5px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">📌 معروض الآن</span>
                        <h4 className="text-[10px] sm:text-[11px] font-black text-white truncate mt-1">{pinnedProduct.title}</h4>
                        <p className="text-[9.5px] text-emerald-400 font-black font-mono">
                          {(pinnedProduct.price || 0).toLocaleString()} {getCurrencyAr(ad.currency)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowShoppablePanel(true);
                          setShoppableSuccess(false);
                          setShoppableOrderId('');
                          setShoppableBuyerName(currentUser?.name || '');
                          setShoppableBuyerPhone(currentUser?.phone || '');
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[9.5px] transition-all cursor-pointer border-none shrink-0"
                      >
                        {isRtl ? 'شراء' : 'Buy'}
                      </button>
                    </motion.div>
                  )}
                  <div className={`flex items-center gap-1.5 flex-wrap ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                     <span className="px-3.5 py-1 rounded-full bg-slate-950/80 border border-emerald-500/40 text-emerald-400 text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                        {ad.category}
                     </span>
                     {ad.userVerified && (
                       <span className="flex items-center gap-1 text-sky-400 text-[9px] sm:text-[10px] font-black bg-slate-950/80 px-2.5 py-1 rounded-full border border-sky-500/30 backdrop-blur-md shadow-md">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                          {t('spotlight.verifiedSeller')}
                       </span>
                     )}
                  </div>

                  <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-sm font-sans line-clamp-1 sm:line-clamp-2">
                     {ad.title}
                  </h2>

                  {/* اسم صاحب الريل في المحتوى السفلي */}
                  <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                    {(ad.promoType === 'system' || ad.userName === 'إدارة أسواق') ? (
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 px-3 py-1 rounded-full backdrop-blur-md shadow-md">
                        <img src="/aswaq-admin-avatar.png" alt="Aswaq Admin" className="w-4 h-4 rounded-full border border-amber-400/60 object-cover" />
                        <span className="text-amber-300 text-[10px] sm:text-[11px] font-black tracking-wide">
                          {isRtl ? 'إدارة أسواق' : 'Aswaq Management'}
                        </span>
                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-slate-950/70 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
                        <Avatar
                          src={ad.user?.avatar || ad.userAvatar}
                          name={ad.user?.name || ad.userName || ''}
                          sizeClassName="w-4 h-4"
                          className="rounded-full"
                        />
                        <span className="text-white/80 text-[10px] font-bold">
                          {ad.user?.name || ad.userName || (isRtl ? 'بائع أسواق' : 'Aswaq Seller')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`flex items-center flex-wrap gap-1.5 sm:gap-3 text-white/90 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                     <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-md text-[10px] sm:text-xs">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-bold text-white">{ad.city}</span>
                     </div>
                     <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] font-bold text-slate-200 shadow-md">
                        <span>{t('spotlight.now')} {relativeDateString(ad.createdAt)} {` (${new Date(ad.createdAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US', {month: 'numeric', day: 'numeric'})} ${new Date(ad.createdAt).toLocaleTimeString(isRtl ? 'ar-YE' : 'en-US', {hour: '2-digit', minute: '2-digit', hour12: true})})`}</span>
                     </div>
                     <div className="flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-bold text-slate-200 shadow-md">
                        <Eye className="w-3.5 h-3.5 text-emerald-400 shadow-sm" />
                        <span>{adViews[ad.id] !== undefined ? adViews[ad.id] : (ad.views || 0)}</span>
                     </div>
                     {ad.isPromo ? (
                        <div className="text-[9px] sm:text-[11px] font-black text-rose-400 bg-rose-500/15 px-2 py-1 rounded-full border border-rose-500/35 flex items-center gap-1 animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                          <span>{t('spotlight.adSponsored')}</span>
                        </div>
                     ) : (
                        <div className="text-lg sm:text-2xl font-black text-amber-400 drop-shadow">
                           {(ad.price || 0).toLocaleString()} {isRtl ? getCurrencyAr(ad.currency) : ad.currency}
                        </div>
                     )}
                  </div>

                  <p className="text-white/70 text-xs sm:text-sm line-clamp-2 leading-relaxed max-w-lg mb-1 sm:mb-2">
                    {ad.description}
                  </p>

                  {/* Render Promo Features nicely on the video */}
                  {ad.isPromo && ad.features && (
                    <div className="space-y-1.5 my-2 max-w-lg">
                      {ad.features.map((feat: string, fIdx: number) => (
                        <div 
                          key={fIdx} 
                          className={`flex items-start gap-1.5 bg-black/45 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/5 text-[9px] sm:text-[11px] text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}
                        >
                          <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`pt-2 flex gap-2 sm:gap-3 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                     {ad.isPromo ? (
                       <button 
                        onClick={() => {
                          if (ad.promoType === 'delivery') {
                            (window as any).setPlatformMode?.('delivery');
                          } else if (ad.promoType === 'reels') {
                            (window as any).setPlatformMode?.('reels');
                          } else {
                            (window as any).setPlatformMode?.('marketplace');
                          }
                          onClose();
                          showToast(t('spotlight.redirectToast'));
                        }}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 h-11 sm:h-14 rounded-xl sm:rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-500/30 cursor-pointer text-[11px] sm:text-xs uppercase tracking-wider"
                       >
                         <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                         <span>{ad.ctaText || t('spotlight.viewDetails')}</span>
                       </button>
                     ) : (
                       <button 
                        onClick={() => {
                          onSelectAd(ad);
                          showToast(t('spotlight.detailsToast'));
                        }}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 h-11 sm:h-14 rounded-xl sm:rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer text-xs sm:text-sm"
                       >
                         <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                         {t('spotlight.viewDetails')}
                       </button>
                     )}
                     <button 
                        onClick={() => toggleSave(ad.id)}
                        className={`px-4 sm:px-6 h-11 sm:h-14 rounded-xl sm:rounded-2xl font-black transition-all flex items-center gap-1.5 border backdrop-blur-md cursor-pointer text-xs sm:text-sm ${
                         isSaved 
                           ?'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-lg' 
                           : 'bg-slate-950/75 hover:bg-slate-900/95 text-white border-white/15 shadow-md'
                        }`}
                     >
                       <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
                       <span>{isSaved ? t('spotlight.saved') : t('spotlight.save')}</span>
                     </button>
                  </div>
                </div>
              </div>
              
              {/* Visual Indicator of Scroll Progress — positioned safely on left/right edge to avoid button overlap */}
              <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 sm:gap-1.5 ${isRtl ? 'right-1 sm:right-1.5' : 'left-1 sm:left-1.5'} pointer-events-none z-[150]`}>
                 {displayAds.slice(0, 8).map((_, idx) => (
                   <div 
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-300 ${idx === activeIndex % 8 ? 'h-5 sm:h-6 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'h-1 sm:h-1.5 bg-white/20'}`}
                   />
                 ))}
              </div>
            </div>
          </div>
        );
      })
    )}
  </div>

      {/* Comments Panel */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-3xl pt-2 pb-28 px-5 z-[700] transition-transform duration-300 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[60%] pointer-events-auto ${showCommentsPanel ? "translate-y-0" : "translate-y-full"} ${isRtl ? 'text-right' : 'text-left'}`}
      >
        <div className="flex justify-center mb-3">
          <div className="w-12 h-1 bg-slate-700 rounded-full cursor-pointer" onClick={() => setShowCommentsPanel(false)}></div>
        </div>
        <div className={`flex items-center justify-between mb-4 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
          <h4 className="text-sm font-black text-white">
            {t('spotlight.socialComments')} ({displayAds[activeIndex] ? ((displayAds[activeIndex] as any).comments?.length || 0) + (adComments[displayAds[activeIndex]?.id]?.length || 0) : 0})
          </h4>
          <button onClick={() => setShowCommentsPanel(false)} className="text-slate-400 hover:text-white border-none bg-transparent text-xl cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hidden">
          {(() => {
             const ad = displayAds[activeIndex];
             if (!ad) return null;
             const serverComments = (ad as any).comments || [];
             const allComments = serverComments.map((c: any) => ({
                id: c.id,
                author: typeof c.author === 'string' ? c.author : (c.author?.name || (isRtl ? 'مستخدم متفاعل' : 'Active User')),
                text: c.text,
                time: new Date(c.createdAt).toLocaleDateString(isRtl ? 'ar-YE' : 'en-US')
             }));
             const localComments = adComments[ad.id] || [];
             const finalComments = [...allComments, ...localComments];

             if (finalComments.length === 0) {
                return <div className="text-center text-slate-500 text-xs py-10">{t('spotlight.beFirst')}</div>;
             }

             return finalComments.map(c => (
              <div key={c.id} className={`flex gap-3 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0 overflow-hidden text-[10px] flex items-center justify-center text-slate-400">
                  {c.author.charAt(0)}
                </div>
                <div className={`${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                    <span className="text-[10px] font-bold text-slate-300">{c.author}</span>
                    <span className="text-[9px] text-slate-600">{c.time}</span>
                  </div>
                  <p className="text-xs text-white break-words">{c.text}</p>
                </div>
              </div>
             ));
          })()}
        </div>

        <div className="pt-4 border-t border-slate-800 mt-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as any).commentInput;
              const text = input.value.trim();
              if(!text || !displayAds[activeIndex]) return;
              
              const activeAd = displayAds[activeIndex];
              const currentId = activeAd?.id;
              
              if (activeAd && activeAd.isLive) {
                socket.emit('chat-message', {
                  streamId: currentId,
                  userName: currentUser?.name || (isRtl ? 'مستخدم متفاعل' : 'Active User'),
                  text: text,
                  avatar: currentUser?.avatar,
                  userId: currentUser?.id
                });
              }

              // Post to API if it is a valid UUID ad
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (typeof currentId === 'string' && uuidRegex.test(currentId)) {
                apiFetch(`/api/ads/${currentId}/comments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text })
                }).catch(() => {});
              }

              setAdComments(prev => ({
                ...prev,
                [currentId]: [...(prev[currentId] || []), {
                  id: `c_${Date.now()}`,
                  author: currentUser?.name || (isRtl ? 'مستخدم متفاعل' : 'Active User'),
                  text: text,
                  time: t('spotlight.now')
                }]
              }));
              input.value = '';
              showToast(isRtl ? "أُضيف تعليقك المباشر 💬" : "Your comment added 💬");
            }}
            className={`flex gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}
          >
            <input 
              name="commentInput"
              type="text"
              placeholder={t('spotlight.opinionPlaceholder')}
              className={`flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-500 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
            />
            <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-extrabold px-4 py-3 rounded-xl text-xs cursor-pointer shadow-lg transition-colors border-none">
              {t('spotlight.send')}
            </button>
          </form>
        </div>
      </div>

      {/* Shoppable Instant Buy Panel for Reels */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-emerald-500/50 rounded-t-3xl pt-2 pb-24 px-5 z-[1200] transition-transform duration-300 flex flex-col shadow-[0_-15px_45px_rgba(16,185,129,0.15)] h-[65%] pointer-events-auto ${showShoppablePanel ? "translate-y-0" : "translate-y-full"} ${isRtl ? 'text-right' : 'text-left'}`}
      >
        <div className="flex justify-center mb-2">
          <div className="w-12 h-1 bg-slate-850 rounded-full cursor-pointer" onClick={() => setShowShoppablePanel(false)}></div>
        </div>

        <div className={`flex items-center justify-between border-b border-slate-900 pb-3 mb-3 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <div>
              <h4 className="text-xs font-black text-white">إتمام طلب فوري وسريع للسلعة</h4>
              <p className="text-[9px] text-emerald-400 font-bold">بموجب ضمان الشحن الآمن واللوجستيات لأسواق</p>
            </div>
          </div>
          <button 
            onClick={() => setShowShoppablePanel(false)} 
            className="text-slate-500 hover:text-white border-none bg-transparent font-black text-lg cursor-pointer p-1"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hidden pb-12">
          {(() => {
            const currentAd = displayAds[activeIndex];
            const ad = pinnedProduct ? {
              id: pinnedProduct.id,
              title: pinnedProduct.title,
              price: pinnedProduct.price,
              currency: currentAd?.currency || 'YER',
              images: [pinnedProduct.image],
              user: currentAd?.user,
              userName: currentAd?.userName,
              city: currentAd?.city || 'كافة المناطق'
            } : currentAd;

            if (!ad) return <p className="text-slate-400 text-center text-xs">لا توجد سلعة مرتبطة بهذا المقطع.</p>;
            const safeImages = Array.isArray(ad.images) ? ad.images : [];

            return (
              <div className="space-y-4">
                {/* Product mini header information */}
                <div className="flex gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-900">
                  <img 
                    src={getImageUrl(safeImages?.[0], 'https://images.unsplash.com/photo-1540553016722-983e48a2cd10?auto=format&fit=crop&w=120&q=80')} 
                    className="w-12 h-12 rounded-lg object-cover border border-slate-850 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-black text-slate-200 truncate">{ad.title}</h5>
                    <p className="text-[10px] text-emerald-400 font-black mt-0.5">
                      {(ad.price || 0).toLocaleString()} {getCurrencyNameAr(ad.currency)}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <span>👤 {ad.user?.name || ad.userName || (isRtl ? 'بائع أسواق' : 'Aswaq Seller')}</span>
                      <span>•</span>
                      <span>📍 {ad.city}</span>
                    </p>
                  </div>
                </div>

                {shoppableSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-2xl mx-auto">
                      ✓
                    </div>
                    <h5 className="text-xs font-black text-emerald-400">تهانينا! تم تأكيد طلبك الفوري بنجاح 🎉</h5>
                    <p className="text-[10px] text-slate-300 leading-normal max-w-[280px] mx-auto">
                      تم إصدار رقم الطلبية <span className="font-mono font-bold text-white bg-slate-950 px-1.5 py-0.5 rounded">ASW-{shoppableOrderId}</span>. تم إدراج الطلب مباشرة في نظام دليفري اللوجستي للتنفيذ الفوري!
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowShoppablePanel(false)}
                      className="text-[10px] font-black text-emerald-400 hover:underline border-none bg-transparent block mx-auto cursor-pointer"
                    >
                      متابعة تصفح مقاطع السلع الأخرى
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Buyer Information input fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">اسم المشتري الكريم الكامل:</label>
                        <input 
                          type="text" 
                          value={shoppableBuyerName}
                          onChange={(e) => setShoppableBuyerName(e.target.value)}
                          placeholder="مثال: صالح اليماني"
                          className="w-full bg-slate-900 border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">رقم هاتف الوجهة والتوصيل السريع:</label>
                        <input 
                          type="text" 
                          value={shoppableBuyerPhone}
                          onChange={(e) => setShoppableBuyerPhone(e.target.value)}
                          placeholder="مثال: 777000123"
                          className="w-full bg-slate-900 border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                    {/* Quantity counter */}
                    <div className="flex items-center justify-between border-t border-slate-900/60 pt-3">
                      <span className="text-[11px] font-bold text-slate-400">الكمية المطلوبة لشحنها:</span>
                      <div className="flex items-center gap-3">
                        <button 
                          type="button" 
                          onClick={() => setShoppableQuantity(prev => Math.max(1, prev - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-white font-extrabold cursor-pointer border-none"
                        >
                          -
                        </button>
                        <span className="text-[11.5px] font-black text-white font-mono w-4 text-center">{shoppableQuantity}</span>
                        <button 
                          type="button" 
                          onClick={() => setShoppableQuantity(prev => prev + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-white font-extrabold cursor-pointer border-none"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Cost summary */}
                    <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-900 space-y-1.5 font-mono text-right">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500 font-sans">قيمة السلع الصافية:</span>
                        <span className="text-slate-300">{((ad.price || 0) * shoppableQuantity).toLocaleString()} {ad.currency}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500 font-sans">رسوم التوصيل والخدمة والضمان اللوجستي:</span>
                        <span className="text-emerald-400 font-sans">توصيل مجاني ومؤمّن 🚚</span>
                      </div>
                      <div className="flex justify-between text-xs font-black border-t border-slate-950 pt-2">
                        <span className="text-slate-400 font-sans">الإجمالي الكلي النهائي:</span>
                        <span className="text-emerald-400 text-sm">{((ad.price || 0) * shoppableQuantity).toLocaleString()} {getCurrencyNameAr(ad.currency)}</span>
                      </div>
                    </div>

                    {/* Direct checkout call-to-action */}
                     <button
                      type="button"
                      disabled={shoppableLoading || !shoppableBuyerName.trim() || !shoppableBuyerPhone.trim()}
                      onClick={async () => {
                        const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
                        if (!currentUser || !token) {
                          if (onLoginRequest) onLoginRequest();
                          return;
                        }
                        setShoppableLoading(true);
                        try {
                          const response = await fetch('/api/v1/orders', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { "Authorization": `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({
                              adId: ad.id,
                              quantity: shoppableQuantity,
                              buyerName: shoppableBuyerName,
                              buyerPhone: shoppableBuyerPhone
                            })
                          });
                          const result = await response.json();
                          if (response.ok && result.success) {
                            const orderNum = result.order?.id 
                              ? String(result.order.id).slice(-6).toUpperCase()
                              : Math.floor(100000 + Math.random() * 900000).toString();
                            setShoppableOrderId(orderNum);
                            setShoppableSuccess(true);
                          } else {
                            alert(result.message || 'فشل إتمام عملية الشراء.');
                          }
                        } catch (e) {
                          console.error(e);
                          alert('حدث خطأ أثناء الاتصال بالخادم.');
                        } finally {
                          setShoppableLoading(false);
                        }
                      }}
                      className="w-full py-3 bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/5 mt-2"
                    >
                      {shoppableLoading ? (
                        <span>جاري تسجيل الطلب اللوجستي وتصميم بوليصة الاستباق...</span>
                      ) : (
                        <span>🛒 تسجيل وتأكيد الشراء بضمان التوصيل اللوجستي لأسواق</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Live & Reels Creation Portal Modal */}
      <AnimatePresence>
        {showLiveUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[4000] flex items-center justify-center p-4 overflow-y-auto pointer-events-auto text-right"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col gap-4 text-slate-100"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setShowLiveUploadModal(false);
                  setAudioSourceType('none');
                  setUploadedAudioUrl('');
                  setAudioUploading(false);
                  setAudioOriginalName('');
                }}
                className="absolute top-4 left-4 p-2 rounded-full bg-slate-950/60 border border-white/10 hover:border-pink-500/30 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {isRtl ? 'بوابة البث المباشر ونشر الريلز والترفيه 🎥' : 'Live Broadcast & Reels Showcase Portal 🎥'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                    {isRtl ? 'اجذب آلاف المتابعين وبث صفقاتك ومنتجاتك فوراً' : 'Engage users & start real-time sales simulation'}
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (audioUploading) {
                      showToast(isRtl ? 'يرجى الانتظار حتى يكتمل رفع الملف الصوتي!' : 'Please wait for the audio file to finish uploading!');
                      return;
                    }

                    const formData = new FormData(e.currentTarget);
                    
                    const title = (formData.get('liveTitle') || '').toString().trim();
                    const description = (formData.get('liveDesc') || '').toString().trim();
                    const rawVideoUrl = (formData.get('liveUrl') || '').toString().trim();
                    
                    let audioUrl = 'none';
                    if (audioSourceType === 'file') {
                      audioUrl = uploadedAudioUrl || 'none';
                    } else if (audioSourceType === 'link') {
                      audioUrl = (formData.get('audioUrlLink') || '').toString().trim() || 'none';
                    }

                    const city = (formData.get('liveCity') || 'all').toString();
                    const liveCategory = (formData.get('liveCat') || '').toString();
                    
                    const liveTypeVal = (formData.get('liveType') || 'live').toString();
                    const isLive = liveTypeVal === 'live';

                    if (!title) {
                      showToast(isRtl ? 'يرجى إدخال عنوان الإعلان أو البث!' : 'Please enter a stream/reel title!');
                      return;
                    }
                    if (!rawVideoUrl) {
                      showToast(isRtl ? 'يرجى إدخال رابط الفيديو أو اختيار أحد الروابط الجاهزة!' : 'Please enter a video URL or select a preset!');
                      return;
                    }

                    // Serialize videoUrl
                    const videoUrl = `${rawVideoUrl}||${audioUrl}||${description}||${city === 'all' ? (isRtl ? "كافة المناطق" : "All Regions") : city}||${liveCategory}`;

                    const response = await apiFetch('/api/promo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title,
                        description,
                        videoUrl,
                        city: city === 'all' ? (isRtl ? "كافة المناطق" : "All Regions") : city,
                        category: liveCategory,
                        isLive,
                        userVerified: true,
                        userId: currentUser?.id || "guest_user",
                        userName: currentUser?.name || (isRtl ? "زائر" : "Guest"),
                        userAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                      })
                    });

                    if (response.ok) {
                      const newPromo = await response.json();
                      const parsed = parseVideoUrl(newPromo.videoUrl);
                      const isWebcam = parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera';
                      const defaultImg = isWebcam 
                        ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
                        : "https://picsum.photos/seed/promo/800/400";

                      const formatted = {
                        ...newPromo,
                        id: newPromo.id || `promo_db_${Date.now()}`,
                        isPromo: true,
                        promoType: "db",
                        views: 0,
                        likes: 0,
                        title: newPromo.title,
                        category: parsed.category || (isRtl ? "فيديو ترويجي" : "Promo Video"),
                        city: parsed.city || (isRtl ? "كافة المناطق" : "All Regions"),
                        description: parsed.description || (isRtl ? "مطلب أو بث ترويجي مميز تم نشره من قبل المستخدم" : "Featured promo uploaded by user"),
                        userId: newPromo.userId || currentUser?.id || "guest_user",
                        userAvatar: newPromo.userAvatar || "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
                        userVerified: true,
                        videoUrl: parsed.videoUrl,
                        audioUrl: parsed.audioUrl,
                        isLive: parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera' || !!newPromo.isLive,
                        images: [newPromo.thumbnailUrl || defaultImg]
                      };
                      setDbPromoVideos(prev => [formatted, ...prev]);
                      showToast(isRtl ? 'تم إطلاق ونشر محتواك بنجاح! يتم الآن توجيهك للبث... 🚀' : 'Launched successfully! Redirecting you to your stream... 🚀');
                      
                      // Reset ALL filters and search to ensure the new ad is visible at index 0
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedCity('all');
                      setSelectedContentType('all');
                      setShowOnlyPromo(false);

                      setTimeout(() => {
                        setActiveIndex(0);
                        setShowLiveUploadModal(false);
                        // Reset audio states
                        setAudioSourceType('none');
                        setUploadedAudioUrl('');
                        setAudioUploading(false);
                        setAudioOriginalName('');
                        // Force container to top to show the new ad
                        if (containerRef.current) {
                          containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
                        }
                      }, 150);
                    } else {
                      const errData = await response.json().catch(() => ({}));
                      showToast(isRtl ? `فشل حفظ البث: ${errData.error || ''}` : `Failed to publish content on server: ${errData.error || ''}`);
                    }
                  } catch (err: any) {
                    console.error('[LaunchError]', err);
                    showToast(isRtl ? `حدث خطأ: ${err?.message || err}` : `Error: ${err?.message || err}`);
                  }
                }}
                className="flex flex-col gap-3 text-right"
              >
                {/* 1. Content Type Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    📢 {isRtl ? 'نوع البث والمحتوى الأنسب لك:' : 'Media Broadcast Type:'}
                  </label>
                  <select
                    name="liveType"
                    className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-pink-500/65 font-bold cursor-pointer"
                  >
                    <option value="live">{isRtl ? '🔴 بث مباشر تفاعلي بالتعليقات وحركة القلوب (أداة جذب الآن)' : '🔴 Interactive Live stream with chat comments & hearts (Engagement device)'}</option>
                    <option value="reel">{isRtl ? '🎥 ريلز ترويجي احترافي مميز (مقطع ترويجي ترفيهي)' : '🎥 Professional Promotional Showcase Reel'}</option>
                  </select>
                </div>

                {/* 1.5 Audio Selection Control */}
                <div className="flex flex-col gap-2 bg-slate-950/60 border border-white/5 p-3 rounded-2xl">
                  <label className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                    <span>🎵 {isRtl ? 'إضافة مقطع صوتي مخصص للمقطع:' : 'Add Custom Audio Track to Video:'}</span>
                  </label>
                  
                  {/* Mode Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('none')}
                      className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'none'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isRtl ? 'صوت أصلي' : 'Original Sound'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('file')}
                      className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'file'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isRtl ? 'رفع ملف صوت' : 'Upload File'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('link')}
                      className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'link'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {isRtl ? 'رابط خارجي' : 'External Link'}
                    </button>
                  </div>

                  {/* Mode Content: File Upload */}
                  {audioSourceType === 'file' && (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-xl p-2.5">
                        <label className="bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white font-extrabold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5 text-pink-400" />
                          <span>{isRtl ? 'اختر ملف الصوت' : 'Choose Audio'}</span>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              setAudioOriginalName(file.name);
                              setAudioUploading(true);
                              
                              try {
                                const uploadData = new FormData();
                                uploadData.append('file', file);
                                
                                const res = await fetch('/api/storage/upload', {
                                  method: 'POST',
                                  body: uploadData,
                                });
                                
                                if (res.ok) {
                                  const data = await res.json();
                                  setUploadedAudioUrl(data.url);
                                  showToast(isRtl ? 'تم رفع الملف الصوتي مبروك! 🎉' : 'Audio file uploaded successfully! 🎉');
                                } else {
                                  showToast(isRtl ? 'فشل رفع الملف الصوتي' : 'Failed to upload audio file');
                                }
                              } catch (err) {
                                console.error('Audio upload error:', err);
                                showToast(isRtl ? 'حدث خطأ أثناء الرفع' : 'Error uploading file');
                              } finally {
                                setAudioUploading(false);
                              }
                            }}
                          />
                        </label>

                        {/* Upload Status / Preview */}
                        <div className="flex-1 min-w-0 text-left">
                          {audioUploading ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-pink-400 font-extrabold justify-end">
                              <span className="w-3 h-3 rounded-full border border-pink-400 border-t-transparent animate-spin" />
                              <span>{isRtl ? 'يتم الرفع الآن...' : 'Uploading...'}</span>
                            </div>
                          ) : uploadedAudioUrl ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-extrabold justify-end">
                              <span className="text-emerald-500 font-black">✓</span>
                              <span className="truncate max-w-[150px]">{audioOriginalName || (isRtl ? 'ملف صوتي مرفوع' : 'Audio file')}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-extrabold block text-right">
                              {isRtl ? 'امتدادات مقبولة: MP3, WAV, M4A' : 'Supported formats: MP3, WAV, M4A'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode Content: External Link */}
                  {audioSourceType === 'link' && (
                    <div className="flex flex-col gap-1 mt-1">
                      <input
                        type="url"
                        name="audioUrlLink"
                        placeholder={isRtl ? 'أدخل رابط المقطع الصوتي المباشر (مثل: https://example.com/sound.mp3)' : 'Enter audio direct link (e.g., https://example.com/sound.mp3)'}
                        className="bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-white placeholder-slate-600 outline-none focus:border-pink-500/65 font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Title */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    ✍️ {isRtl ? 'عنوان البث أو المقطع الترويجي:' : 'Stream or Reel Title:'}
                  </label>
                  <input
                    type="text"
                    name="liveTitle"
                    placeholder={isRtl ? 'مثال: أسعار الهواتف مباشرة من سوق عمان بمناسبة الصيف!' : 'e.g. Live Smartphone Sales in Amman marketplace'}
                    className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/65 font-extrabold"
                  />
                </div>

                {/* 3. Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    📝 {isRtl ? 'تفاصيل العرض وجذب المتابعين والترفية:' : 'Description and details to attract visitors:'}
                  </label>
                  <textarea
                    name="liveDesc"
                    rows={2}
                    placeholder={isRtl ? 'اكتب تفاصيل المحل، الخصومات المتوفرة أو الفعاليات الترفيهية التي تقدمها...' : 'List discounts, location or entertaining details...'}
                    className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/65 resize-none font-bold"
                  />
                </div>

                {/* 4. Target Market and Target Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 text-right">
                    <label className="text-[10px] font-black text-slate-400">
                      📍 {isRtl ? 'المدينة والولاية:' : 'City / Region:'}
                    </label>
                    <select
                      name="liveCity"
                      className="bg-slate-950 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                    >
                      <option value="all">{isRtl ? 'كل المناطق 🌍' : 'All Regions 🌍'}</option>
                      {(MARKETS[countryCode]?.cities || []).map(cityOpt => (
                        <option key={cityOpt.id} value={cityOpt.nameAr}>
                          {isRtl ? cityOpt.nameAr : cityOpt.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 text-right font-bold">
                    <label className="text-[10px] font-black text-slate-400">
                      🗂️ {isRtl ? 'القسم والنوع:' : 'Category:'}
                    </label>
                    <select
                      name="liveCat"
                      className="bg-slate-950 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={isRtl ? cat.nameAr : cat.nameEn}>
                          {isRtl ? cat.nameAr : cat.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. URL Path and Presets */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    🔗 {isRtl ? 'رابط خيار البث أو مصدر الفيديو (الكاميرا مفعلة تلقائياً):' : 'Video/Stream Source (Camera enabled by default):'}
                  </label>
                  <input
                    type="text"
                    id="liveUrlInput"
                    name="liveUrl"
                    placeholder="webcam"
                    defaultValue="webcam"
                    className="bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/65 font-mono text-center font-bold"
                  />

                  {/* Preset Choices for rapid testing and visual variety */}
                  <div className="mt-1 flex flex-col gap-1 bg-slate-950/40 p-2.5 border border-white/5 rounded-xl text-right">
                    <span className="text-[9px] text-pink-400 font-extrabold mb-1">
                      💡 {isRtl ? 'قنوات ومصادر محتوى للبث (اختر الكاميرا لفتح كاميرتك وتصوير بث حقيقي):' : 'Stream Sources (Select Camera to stream with your webcam, or select premium presets):'}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-right">
                      {[
                        {
                          labelAr: "📸 كاميرا كواجهة البث (تصوير بث حي حقيقي) 🔥",
                          labelEn: "📸 Live Camera (Actual device webcam filming) 🔥",
                          url: "webcam",
                          isCamera: true
                        },
                        {
                          labelAr: "🎁 بث ترفيهي وتوزيع هدايا",
                          labelEn: "Live Game Show Promo",
                          url: "https://player.vimeo.com/external/459341492.sd.mp4?s=9dc49d79a8385a7cc3c4fbfa2e5c8e768390b395&profile_id=165&oauth2_token_id=57447761"
                        },
                        {
                          labelAr: "🏢 ريلز عقاري فخم بدابوق",
                          labelEn: "Luxury Real Estate",
                          url: "https://player.vimeo.com/external/394301551.sd.mp4?s=ff7fedf4bb9bc3dc9391b1a43a758bdee1aa6ef8&profile_id=165&oauth2_token_id=57447761"
                        },
                        {
                          labelAr: "📱 بث صفقات إلكترونيات عمان",
                          labelEn: "Commercial Tech",
                          url: "https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761"
                        },
                        {
                          labelAr: "🚗 ريلز سيارات عمان الجديدة",
                          labelEn: "Automobiles Show",
                          url: "https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c35c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761"
                        }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('liveUrlInput') as HTMLInputElement;
                            if (input) {
                              input.value = preset.url;
                              showToast(isRtl ? `تم تحديد: ${preset.labelAr}` : `Selected preset: ${preset.labelEn}`);
                            }
                          }}
                          className={`text-[8.5px] sm:text-[9.5px] p-2 rounded-lg border text-right font-bold transition-all cursor-pointer block ${
                            preset.isCamera 
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 col-span-2'
                              : 'bg-slate-950 hover:bg-slate-900 border-white/5 text-slate-300'
                          }`}
                        >
                          {isRtl ? preset.labelAr : preset.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submitting Buttons */}
                <div className="flex gap-2.5 mt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-400 hover:to-rose-400 text-slate-950 text-xs py-2.5 rounded-xl font-black transition-all active:scale-95 cursor-pointer shadow-lg shadow-pink-500/20 text-center border-none"
                  >
                    🚀 {isRtl ? 'إطلاق البث ونشر المحتوى للجميع' : 'Launch Live Stream / Post Reel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLiveUploadModal(false)}
                    className="px-4 bg-slate-950 hover:bg-slate-800 text-xs text-slate-400 rounded-xl font-bold cursor-pointer transition-colors border border-white/5"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin Product Modal for Broadcaster */}
      <AnimatePresence>
        {showPinProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[5000] flex items-center justify-center p-4 pointer-events-auto text-right"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto shadow-2xl relative flex flex-col gap-4 text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-black text-white">📌 تثبيت منتج مميز للبث</h3>
                <button
                  type="button"
                  onClick={() => setShowPinProductModal(false)}
                  className="text-slate-500 hover:text-white border-none bg-transparent font-black text-lg cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                {pinnedProduct && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">📌</span>
                      <div>
                        <p className="text-[11px] font-black text-emerald-400">المنتج المثبت حالياً:</p>
                        <p className="text-[10px] text-white truncate max-w-[200px]">{pinnedProduct.title}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const activeAd = displayAds[activeIndex];
                        if (activeAd) {
                          socket.emit('pin-product', { streamId: activeAd.id, productId: null });
                          setPinnedProduct(null);
                        }
                        setShowPinProductModal(false);
                      }}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg text-[10px] font-black transition-colors cursor-pointer border-none"
                    >
                      إلغاء التثبيت
                    </button>
                  </div>
                )}

                {(() => {
                  const broadcasterAds = ads.filter(a => a.userId === currentUser?.id || (a.userName === currentUser?.name && currentUser));
                  if (broadcasterAds.length === 0) {
                    return <p className="text-slate-400 text-center text-xs py-6">ليس لديك أي إعلانات أو سلع معلنة حالياً لتثبيتها.</p>;
                  }
                  return broadcasterAds.map(item => {
                    const itemImages = Array.isArray(item.images) ? item.images : [];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={itemImages?.[0] || 'https://images.unsplash.com/photo-1540553016722-983e48a2cd10?auto=format&fit=crop&w=80&q=80'}
                            className="w-10 h-10 rounded-lg object-cover border border-white/5 shrink-0"
                          />
                          <div className="min-w-0 text-right">
                            <h5 className="text-[11px] font-bold text-slate-200 truncate">{item.title}</h5>
                            <p className="text-[9.5px] text-emerald-400 font-bold font-mono">
                              {(item.price || 0).toLocaleString()} {getCurrencyAr(item.currency)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const activeAd = displayAds[activeIndex];
                            if (activeAd) {
                              socket.emit('pin-product', {
                                streamId: activeAd.id,
                                productId: item.id,
                                productTitle: item.title,
                                productPrice: item.price,
                                productImage: itemImages?.[0] || ''
                              });
                              setPinnedProduct({
                                id: item.id,
                                title: item.title,
                                price: item.price,
                                image: itemImages?.[0] || ''
                              });
                              showToast(isRtl ? 'تم تثبيت السلعة بنجاح! 📌' : 'Product pinned successfully! 📌');
                            }
                            setShowPinProductModal(false);
                          }}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-[10px] font-black transition-all cursor-pointer border-none"
                        >
                          تثبيت البث
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Input for Custom Background Images */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const activeAd = displayAds[activeIndex];
            if (activeAd) {
              const reader = new FileReader();
              reader.onload = (event) => {
                if (event.target?.result) {
                  const base64Url = event.target.result as string;
                  setCustomBgs(prev => ({ ...prev, [activeAd.id]: base64Url }));
                }
              };
              reader.readAsDataURL(file);
            }
          }
          // Reset file input value to allow uploading the same file again
          e.target.value = '';
        }}
      />
    </div>
  );
}
