
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
  Square, 
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
  Upload,
  ExternalLink,
  Play,
  Pause
} from 'lucide-react';
import { Ad, User } from '../types.ts';
import { INITIAL_USERS, CATEGORIES } from '../data.ts';
import { getCurrencyAr, getCurrencyNameAr, MARKETS } from '../markets.ts';
import socket from '../lib/socket.ts';
import { Avatar, sanitizeName } from './Avatar.tsx';
import { apiFetch } from '../lib/api';
import { getAdCtaConfig } from '../lib/ctaConfig.ts';
import { resolveMediaUrl } from '../lib/config.ts';

// ── WebRTC ICE Server Configuration ──────────────────────────────────────────
// Includes free public TURN servers so WebRTC works on restrictive mobile
// networks (symmetric NAT, carrier-grade NAT, 4G/5G with port blocking).
//
// Free TURN providers used:
//  • openrelay.metered.ca  — provided by Metered.ca (free tier)
//  • relay.metered.ca      — Metered.ca global TURN relay
//  • openrelay.metered.ca  — secondary
//
// When you set up your own Coturn ($10/month), replace these with your own.
const ICE_SERVERS: RTCIceServer[] = [
  // STUN (NAT traversal, no relay — works for ~85% of connections)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // Free TURN relay — Metered.ca (works for remaining ~15% on restricted networks)
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp', // TCP fallback for firewalls
      'turns:openrelay.metered.ca:443',              // TLS TURN for HTTPS-only proxies
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

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
  // Support direct ad object with thumbnail field (fast path for feed cards)
  if (typeof rawImg === 'object' && rawImg !== null && typeof rawImg.thumbnail === 'string' && rawImg.thumbnail.trim()) {
    return rawImg.thumbnail;
  }
  const rawUrl = typeof rawImg === 'object' && rawImg !== null ? rawImg.url : rawImg;
  if (typeof rawUrl === 'string' && rawUrl.trim()) {
    const resolved = resolveMediaUrl(rawUrl);
    if (resolved) return resolved;
  }
  return fallback;
};

export const getCountryFromCity = (cityIdOrName?: string): string | null => {
  if (!cityIdOrName) return null;
  const raw = String(cityIdOrName).toLowerCase().trim();
  if (raw === 'كافة المناطق' || raw === 'all regions' || raw === 'كافة المدن' || raw === 'all cities' || raw === '') {
    return null;
  }
  for (const [code, market] of Object.entries(MARKETS)) {
    if (market.cities.some(c => 
      c.id.toLowerCase() === raw || 
      c.nameAr.toLowerCase() === raw || 
      c.nameEn.toLowerCase() === raw ||
      raw.includes(c.nameAr.toLowerCase()) ||
      raw.includes(c.nameEn.toLowerCase())
    )) {
      return code;
    }
  }
  return null;
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
  onPinProductClick,
  myBroadcastingIds = []
}: {
  isMuted: boolean;
  isRtl: boolean;
  ad: Ad;
  currentUser: User | null;
  onStreamEnded?: (adId: string, archiveUrl: string, archiveThumb?: string) => void;
  pinnedProduct?: { id: string; title: string; price: number; image: string } | null;
  onPinProductClick?: () => void;
  myBroadcastingIds?: string[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isGenericName = (name?: string | null) => {
    if (!name) return true;
    const n = name.trim().toLowerCase();
    return n === 'user' || n === 'guest' || n === 'زائر' || n === 'تاجر' || n === 'تاجر أسواق' || n === 'مستخدم جديد' || n === 'مستخدم';
  };

  const isCreator = !!(
    ad &&
    (ad.isLive || (ad.videoUrl && (ad.videoUrl.includes('webcam') || ad.videoUrl.includes('camera')))) &&
    (
      myBroadcastingIds.includes(ad.id) ||
      (currentUser?.id && ad.userId && currentUser.id === ad.userId && ad.userId !== "guest_user" && ad.userId !== "guest") ||
      (currentUser?.name && !isGenericName(currentUser.name) && (currentUser.name === ad.userName || currentUser.name === ad.user?.name))
    )
  );


  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [isBroadcaster, setIsBroadcaster] = useState<boolean>(isCreator);
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

  // Broadcaster Refs & Local Session Tracking
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Viewer Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isBroadcaster || isCreator) {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      } else {
        videoRef.current.muted = isMuted;
        videoRef.current.volume = isMuted ? 0 : 1;
      }
    }
  }, [isMuted, isBroadcaster, isCreator]);

  useEffect(() => {
    setIsBroadcaster(isCreator);
    setIsOffline(false);

    if (isCreator) {
      // --- BROADCASTER LOGIC ---
      setStatusText(isRtl ? 'جاري تجهيز الكاميرا والاتصال بالخادم...' : 'Preparing camera and connecting to stream server...');
      let active = true;

      async function startBroadcasting() {
        try {
          let stream: MediaStream | null = null;

          const advancedAudioConstraints = {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
            channelCount: 1,
            sampleRate: 48000,
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googAudioMirroring: false
          };


          // Acquire base stream
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
              audio: advancedAudioConstraints
            });
          } catch (e1) {
            console.warn("First camera constraint failed, trying basic video+audio", e1);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: advancedAudioConstraints
              });
            } catch (e2) {
              console.warn("Audio+Video failed, trying video only", e2);
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
          }
          
          if (!active || !stream) {
            if (stream) stream.getTracks().forEach(t => t.stop());
            return;
          }

          localStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.volume = 0;
            videoRef.current.play().catch(err => console.error("Video play error:", err));
          }

          setStatusText(isRtl ? 'أنت الآن على المباشر! 🔴' : 'You are now LIVE! 🔴');
          setTimeout(() => {
            setStatusText('');
          }, 1500);

          const broadcasterName = currentUser?.name || ad.userName || ad.user?.name || (isRtl ? 'تاجر أسواق' : 'Aswaq Seller');

          // Register stream on socket and send notification info
          socket.emit('join-stream', { 
            streamId: ad.id, 
            role: 'broadcaster',
            sellerId: currentUser?.id,
            sellerName: broadcasterName,
            adTitle: ad.title
          });


          // When a viewer joins, start a peer connection with them
          const handleViewerJoined = async ({ viewerId }: { viewerId: string }) => {
            console.log(`[Stream] Viewer ${viewerId} joined. Creating peer connection.`);
            try {
              const pc = new RTCPeerConnection({
                iceServers: ICE_SERVERS,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
              });

              pcsRef.current.set(viewerId, pc);
              setViewerCount(prev => prev + 1);

              // Add local stream tracks to peer connection
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

              // 🎛️ Set video sender bitrate for HD quality
              pc.onnegotiationneeded = async () => {
                // Triggered when tracks change — renegotiate with viewer
              };

              const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
              });

              await pc.setLocalDescription(offer);
              socket.emit('signal', { to: viewerId, signal: { type: 'offer', sdp: offer.sdp } });

              // After connection established, apply max bitrate on video sender
              pc.onconnectionstatechange = () => {
                console.log(`[Broadcaster→${viewerId}] state: ${pc.connectionState}`);
                if (pc.connectionState === 'connected') {
                  // Set max bitrate 2.5Mbps video, 128kbps audio
                  pc.getSenders().forEach(sender => {
                    if (!sender.track) return;
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    if (sender.track.kind === 'video') {
                      params.encodings[0].maxBitrate = 2_500_000;  // 2.5 Mbps
                      params.encodings[0].maxFramerate = 30;
                    } else if (sender.track.kind === 'audio') {
                      params.encodings[0].maxBitrate = 128_000;    // 128 kbps
                    }
                    sender.setParameters(params).catch(() => null);
                  });
                }
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                  // ICE Restart — re-offer to reconnect automatically
                  setTimeout(async () => {
                    if (!pcsRef.current.has(viewerId)) return;
                    try {
                      const restartOffer = await pc.createOffer({ iceRestart: true });
                      await pc.setLocalDescription(restartOffer);
                      socket.emit('signal', { to: viewerId, signal: { type: 'offer', sdp: restartOffer.sdp } });
                      console.log(`[Broadcaster] ICE Restart sent to ${viewerId}`);
                    } catch { /* viewer likely left */ }
                  }, 1500);
                  if (pc.connectionState === 'failed') {
                    pc.close();
                    pcsRef.current.delete(viewerId);
                    setViewerCount(prev => Math.max(0, prev - 1));
                  }
                }
              };
            } catch (err) {
              console.error("[Broadcaster] Failed to negotiate with viewer:", err);
            }
          }; // end handleViewerJoined

          const handleViewerLeft = ({ viewerId }: { viewerId: string }) => {
            console.log(`[Stream] Viewer ${viewerId} left.`);
            const pc = pcsRef.current.get(viewerId);
            if (pc) {
              pc.close();
              pcsRef.current.delete(viewerId);
              setViewerCount(prev => Math.max(0, prev - 1));
            }
          };

          const pendingCandidatesMap = new Map<string, any[]>();

          const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
            try {
              const pc = pcsRef.current.get(from);
              if (!pc) return;

              if (signal.type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                const pending = pendingCandidatesMap.get(from) || [];
                for (const cand of pending) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {
                    console.warn("[Broadcaster] Candidate add warning:", e);
                  }
                }
                pendingCandidatesMap.delete(from);
              } else if (signal.type === 'candidate' && signal.candidate) {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } else {
                  const existing = pendingCandidatesMap.get(from) || [];
                  existing.push(signal.candidate);
                  pendingCandidatesMap.set(from, existing);
                }
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

        // 📸 Capture real thumbnail from last video frame before stopping
        const captureAndUploadThumbnail = async () => {
          try {
            const video = videoRef.current;
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
              const canvas = document.createElement('canvas');
              canvas.width  = Math.min(video.videoWidth, 1280);
              canvas.height = Math.min(video.videoHeight, 720);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Mirror if front camera
                if (facingMode === 'user') {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(async (blob) => {
                  if (!blob) return;
                  const formData = new FormData();
                  formData.append('file', blob, `thumbnail_${ad.id}_${Date.now()}.jpg`);
                  formData.append('adId', ad.id);
                  try {
                    const resp = await fetch('/api/v1/storage/upload', {
                      method: 'POST',
                      body: formData,
                      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      console.log('[Stream] Thumbnail captured and uploaded:', data.url);
                      // Save thumbnail URL to the reel/stream record
                      if (data.url && ad.id) {
                        await fetch(`/api/v1/promo/reel/${ad.id}/thumbnail`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token') || ''}`
                          },
                          body: JSON.stringify({ thumbnailUrl: data.url })
                        }).catch(() => null);
                      }
                    }
                  } catch (e) {
                    console.warn('[Stream] Thumbnail upload failed (non-critical):', e);
                  }
                }, 'image/jpeg', 0.85); // 85% quality JPEG
              }
            }
          } catch (e) {
            console.warn('[Stream] Thumbnail capture failed (non-critical):', e);
          }
        };

        captureAndUploadThumbnail().then(() => {
          socket.emit('leave-stream', { streamId: ad.id, role: 'broadcaster' });

          // Stop local streams
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
          }
          // Close viewer peer connections
          pcsRef.current.forEach(pc => pc.close());
          pcsRef.current.clear();
        });
      };

    } else {
      // --- VIEWER LOGIC ---
      setStatusText(isRtl ? 'جاري الاتصال بالبث المباشر للعارض...' : 'Connecting to the broadcaster\'s stream...');
      
      const createPeerConnection = (broadcasterId: string) => {
        if (pcRef.current) {
          pcRef.current.close();
        }

        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        });

        pcRef.current = pc;



        pc.ontrack = (event) => {
          console.log("[Viewer] Received broadcast track!", event.track.kind, event.streams);
          let mediaStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
          if (!mediaStream) {
            mediaStream = new MediaStream();
            mediaStream.addTrack(event.track);
          }

          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.muted = isMuted;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((e) => {
                console.warn("[Viewer] Unmuted play failed due to browser policy, playing muted:", e);
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play().catch(() => null);
                }
              });
            }
          }
          setStatusText('');
          setIsOffline(false);
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
            // Try ICE restart first before full reconnect
            pc.restartIce();
            setTimeout(() => {
              if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                createPeerConnection(broadcasterId);
                socket.emit('join-stream', { streamId: ad.id, role: 'viewer' });
              }
            }, 2000);
          }
          if (pc.connectionState === 'connected') {
            setStatusText('');
            setIsOffline(false);
          }
          if (pc.connectionState === 'disconnected') {
            setStatusText(isRtl ? '⏳ جاري إعادة الاتصال...' : '⏳ Reconnecting...');
          }
        };
      };

      const viewerPendingCandidates: any[] = [];

      const handleSignal = async ({ from, signal }: { from: string; signal: any }) => {
        try {
          if (signal.type === 'offer') {
            console.log("[Viewer] Received SDP offer. Negotiating as receiver.");
            createPeerConnection(from);
            const pc = pcRef.current;
            if (!pc) return;

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));

            // Process any early candidates received prior to setRemoteDescription
            for (const cand of viewerPendingCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn("[Viewer] Candidate add warning:", e);
              }
            }
            viewerPendingCandidates.length = 0;

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer.sdp } });
          } else if (signal.type === 'candidate' && signal.candidate) {
            const pc = pcRef.current;
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              viewerPendingCandidates.push(signal.candidate);
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
  }, [ad.id, currentUser?.id, isRtl]);

  // Dynamic camera switch (facingMode) and flash (torch) controller for Broadcaster
  useEffect(() => {
    if (!isBroadcaster || !localStreamRef.current) return;

    let active = true;
    async function updateCameraTrack() {
      try {
        console.log(`[Broadcaster] Dynamically switching camera to: ${facingMode}...`);
        
        // Stop current video tracks
        const currentVideoTracks = localStreamRef.current!.getVideoTracks();
        currentVideoTracks.forEach(t => t.stop());

        // Get new video track with target facingMode
        let newStream: MediaStream | null = null;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: facingMode ? { facingMode } : true
          });
        } catch (e) {
          console.warn("Failed to get camera with facingMode, falling back to simple video", e);
          newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        if (!active || !newStream) {
          if (newStream) newStream.getTracks().forEach(t => t.stop());
          return;
        }

        const newVideoTrack = newStream.getVideoTracks()[0];

        // Replace track in existing local stream reference
        localStreamRef.current!.removeTrack(currentVideoTracks[0]);
        localStreamRef.current!.addTrack(newVideoTrack);

        // Update local video element srcObject to refresh broadcaster's view
        if (videoRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }

        // Apply torch settings to new track if environment camera
        if (newVideoTrack && 'applyConstraints' in newVideoTrack && facingMode === 'environment') {
          try {
            // @ts-ignore
            const capabilities = newVideoTrack.getCapabilities();
            // @ts-ignore
            if (capabilities.torch) {
              // @ts-ignore
              await newVideoTrack.applyConstraints({ advanced: [{ torch }] });
            }
          } catch (e) {
            console.error("Torch constraint failure:", e);
          }
        }

        // Replace track on all existing WebRTC peer connections
        pcsRef.current.forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack).catch(err => {
              console.error("[Broadcaster] Failed to replace video track for viewer:", err);
            });
          }
        });
      } catch (err) {
        console.error("[Broadcaster] Failed to switch camera track:", err);
      }
    }

    updateCameraTrack();

    return () => {
      active = false;
    };
  }, [facingMode, torch, isBroadcaster]);

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
        ref={(el) => {
          videoRef.current = el;
          if (el && (localStreamRef.current || isCreator || isBroadcaster)) {
            el.muted = true;
            el.volume = 0;
          }
        }}
        autoPlay
        playsInline
        muted={!!localStreamRef.current || isCreator || isBroadcaster || isMuted}
        style={{ filter: finalFilter }}
        className={`w-full h-full object-cover brightness-[1.1] transition-all duration-300 ${
          (isOffline && statusText) ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
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

      {/* Sleek Top-Center Horizontal Broadcaster Toolbar (Zero overlap with side action buttons or metadata) */}
      {isBroadcaster && !isOffline && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-3 py-2 bg-slate-950/90 backdrop-blur-2xl rounded-full border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto">
          {/* 🔴 Prominent Red Stop Stream Button */}
          <button
            type="button"
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

              apiFetch(`/api/promo/${ad.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: ad.title || '',
                  videoUrl: parsedUrl,
                  isLive: false,
                  thumbnailUrl: snapshotUrl
                })
              }).catch(() => null);

              setIsOffline(true);
              setIsBroadcaster(false);
              if (onStreamEnded) {
                onStreamEnded(ad.id, archiveVideoUrl, snapshotUrl || '');
              }

              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
              }
            }}
            className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white border border-rose-300 flex items-center justify-center shadow-lg shadow-rose-600/50 animate-pulse transition-all active:scale-90 cursor-pointer shrink-0"
            title={isRtl ? 'إيقاف البث ⏹️' : 'End Live ⏹️'}
          >
            <Square className="w-4 h-4 fill-current text-white" />
          </button>

          <div className="w-px h-5 bg-white/20 shrink-0" />

          {/* Filter button */}
          <button
            onClick={() => { setShowFilters(!showFilters); setShowBrightness(false); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
              showFilters ? 'bg-pink-600 text-white scale-105 shadow-md shadow-pink-600/40' : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-white/10'
            }`}
            title={isRtl ? 'الفلاتر 🎨' : 'Filters 🎨'}
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Brightness button */}
          <button
            onClick={() => { setShowBrightness(!showBrightness); setShowFilters(false); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
              showBrightness ? 'bg-amber-500 text-slate-950 scale-105 shadow-md shadow-amber-500/40' : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-white/10'
            }`}
            title={isRtl ? 'السطوع ☀️' : 'Brightness ☀️'}
          >
            <Sun className="w-4 h-4" />
          </button>

          {/* Flip Camera button */}
          <button
            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-white/10 active:scale-90"
            title={isRtl ? 'قلب الكاميرا 🔄' : 'Flip Camera 🔄'}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Stream Badges Overlay */}
      {!statusText && (
        <div className={`absolute top-16 z-20 flex flex-col gap-1.5 ${isRtl ? 'left-4 items-start' : 'right-4 items-end'}`}>

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


interface FeedVideoPlayerProps {
  src: string;
  isCurrent: boolean;
  isMuted: boolean;
  audioUrl?: string;
}

const FeedVideoPlayer: React.FC<FeedVideoPlayerProps> = ({
  src,
  isCurrent,
  isMuted,
  audioUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Validate src
  const isValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 4 && !src.startsWith('blob:null') && src !== 'none');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isValidSrc) return;

    video.muted = !!audioUrl || isMuted;

    if (isCurrent) {
      if (video.readyState >= 2) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            if (video) {
              video.muted = true;
              video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
      try {
        video.currentTime = 0;
      } catch {}
    }
  }, [isCurrent, isMuted, audioUrl, isValidSrc]);

  if (!isValidSrc) return null;

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full z-[1] cursor-pointer select-none" onClick={togglePlayPause}>
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        crossOrigin="anonymous"
        muted={!!audioUrl || isMuted}
        preload={isCurrent ? "auto" : "metadata"}
        onCanPlay={() => {
          if (isCurrent && videoRef.current && videoRef.current.paused) {
            videoRef.current.play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
                }
              });
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
        className="absolute inset-0 w-full h-full object-cover brightness-100"
      />
      {!isPlaying && isCurrent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/20">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl animate-pulse">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </div>
      )}
      {audioUrl && (
        <AudioPlayer
          src={audioUrl}
          isPlaying={isCurrent && isPlaying}
          isMuted={isMuted}
        />
      )}
    </div>
  );
};

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
    try {
      const stored = localStorage.getItem('aswaq_liked_reels');
      if (stored) {
        Object.assign(initial, JSON.parse(stored));
      }
    } catch {}
    if (favorites) {
      favorites.forEach(id => {
        initial[id] = true;
      });
    }
    return initial;
  });

  useEffect(() => {
    if (favorites && favorites.length > 0) {
      setLikedAds(prev => {
        const next = { ...prev };
        favorites.forEach(id => {
          next[id] = true;
        });
        return next;
      });
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('aswaq_liked_reels', JSON.stringify(likedAds));
    } catch {}
  }, [likedAds]);

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
  const [managerProfile, setManagerProfile] = useState<{ id?: string; name: string; avatar: string } | null>({
    name: 'Emad Salah',
    avatar: 'https://lh3.googleusercontent.com/a/ACg8ocILZLj44t6xsNGSs0XS0LWGNknuYW-7HX_HLmWQ0duGl8STxw=s96-c'
  });

  useEffect(() => {
    fetch('/api/users/manager')
      .then(res => res.json())
      .then(data => {
        if (data && data.name) {
          setManagerProfile({
            id: data.id,
            name: data.name,
            avatar: data.avatar || "https://lh3.googleusercontent.com/a/ACg8ocILZLj44t6xsNGSs0XS0LWGNknuYW-7HX_HLmWQ0duGl8STxw=s96-c"
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

  // --- Video Reels Upload States ---
  const [videoSourceType, setVideoSourceType] = useState<'upload' | 'camera' | 'link'>('upload');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>('');
  const [videoUploading, setVideoUploading] = useState<boolean>(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [videoOriginalName, setVideoOriginalName] = useState<string>('');
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string>('');

  // --- Live Stream Custom Audio Upload States ---
  const [audioSourceType, setAudioSourceType] = useState<'none' | 'file' | 'link'>('none');
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string>('');
  const [audioUploading, setAudioUploading] = useState<boolean>(false);
  const [audioOriginalName, setAudioOriginalName] = useState<string>('');
  const [liveIntentMode, setLiveIntentMode] = useState<'offer' | 'request'>('offer');
  const [myBroadcastingIds, setMyBroadcastingIds] = useState<string[]>([]);

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
    const countryName = MARKETS[countryCode]?.labelAr || (isRtl ? 'المنطقة العربية' : 'the Arab region');
    const countryNameEn = MARKETS[countryCode]?.labelEn || 'the Arab region';
    const creatorAvatar = managerProfile?.avatar || currentUser?.avatar || "https://lh3.googleusercontent.com/a/ACg8ocILZLj44t6xsNGSs0XS0LWGNknuYW-7HX_HLmWQ0duGl8STxw=s96-c";
    const creatorName   = managerProfile?.name || currentUser?.name || "Emad Salah";
    const creatorId     = managerProfile?.id || currentUser?.id || "admin";
    
    return [
    // ─── ريل 1: التسوق الذكي على أسواق ────────────────────────────────────
    {
      id: "promo_marketplace",
      isPromo: true,
      promoType: "concept",
      title: isRtl
        ? "🛍️ تسوّق بذكاء مع منصة أسواق"
        : "🛍️ Shop Smart with Aswaq",
      userName: creatorName,
      userAvatar: creatorAvatar,
      userId: creatorId,
      category: isRtl ? "ترويج المنصة" : "Platform Promo",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "منصة أسواق — السوق الرقمي الأول في ${countryName} والمنطقة العربية. أعلن عن منتجاتك، تفاوض مباشرةً، واشتروا بأمان. تجربة تسوق متكاملة بضغطة واحدة!"
        : "Aswaq — the #1 digital marketplace in ${countryNameEn} & the Arab region. List your products, negotiate directly, and buy safely. A complete shopping experience in one tap!",
      createdAt: "2026-06-01T00:00:00.000Z",
      views: 1840,
      likes: 142,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "",
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
      userName: creatorName,
      userAvatar: creatorAvatar,
      userId: creatorId,
      category: isRtl ? "خدمة التوصيل" : "Delivery Service",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "مع خدمة التوصيل في أسواق، استقبل مشترياتك في وقت قياسي! تتبع شحنتك لحظة بلحظة، وادفع عند الاستلام."
        : "With Aswaq delivery, receive your purchases in record time! Track your shipment in real time and pay on delivery.",
      createdAt: "2026-06-05T00:00:00.000Z",
      views: 1215,
      likes: 98,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "",
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
      userName: creatorName,
      userAvatar: creatorAvatar,
      userId: creatorId,
      category: isRtl ? "ريلز المنتجات" : "Product Reels",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "الريلز التجارية في أسواق — الطريقة الأكثر تأثيراً لعرض منتجاتك! صوّر، أضف موسيقى، وانشر لملايين المستخدمين في ثوانٍ."
        : "Aswaq commercial reels — the most impactful way to showcase your products! Film, add music, and publish to millions of users in seconds.",
      createdAt: "2026-06-10T00:00:00.000Z",
      views: 2420,
      likes: 215,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "",
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
      userName: creatorName,
      userAvatar: creatorAvatar,
      userId: creatorId,
      category: isRtl ? "إعلانات مميزة" : "Featured Ads",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "أسواق تمنحك أدوات التميّز! رفّع إعلانك ليظهر أمام الآلاف من المشترين المهتمين، وحقق مبيعاتك بأسرع وقت ممكن."
        : "Aswaq gives you the tools to stand out! Boost your listing to appear in front of thousands of interested buyers and achieve your sales faster.",
      createdAt: "2026-06-15T00:00:00.000Z",
      views: 980,
      likes: 86,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "",
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
      userName: creatorName,
      userAvatar: creatorAvatar,
      userId: creatorId,
      category: isRtl ? "الأمان والثقة" : "Safety & Trust",
      city: isRtl ? "جميع المدن" : "All Cities",
      price: 0,
      currency: currency,
      description: isRtl
        ? "نظام التحقق والتقييمات في أسواق يضمن لك تجربة آمنة. البائعون الموثّقون، والدفع المحمي، وخدمة العملاء على مدار الساعة."
        : "Aswaq's verification & rating system ensures a safe experience. Verified sellers, protected payments, and 24/7 customer support.",
      createdAt: "2026-06-20T00:00:00.000Z",
      views: 1610,
      likes: 164,
      userVerified: true,
      images: ["https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1920&q=80"],
      videoUrl: "",
      features: [
        isRtl ? "✅ بائعون موثّقون بهوية حقيقية" : "✅ Identity-verified sellers",
        isRtl ? "🔒 حماية بيانات متقدمة" : "🔒 Advanced data protection",
        isRtl ? "⭐ نظام تقييمات شفاف وموثوق" : "⭐ Transparent rating system",
      ],
      ctaText: isRtl ? "تعرف على ضمانات أسواق 🔐" : "Learn About Aswaq Guarantees 🔐",
    },
  ]}, [t, countryCode, isRtl]);

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
    fetch('/api/promo' + (countryCode ? `?countryCode=${countryCode}` : ''))
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
              isLive: parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera' || parsed.videoUrl === 'live' || parsed.videoUrl === 'stream' || !!pv.isLive,
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
  const activeAdForViewer = displayAds[activeIndex];
  const activeAdId = activeAdForViewer?.id;
  const activeAdIsLive = activeAdForViewer?.isLive;

  // Fetch real-time persisted interactions from server
  useEffect(() => {
    const userId = currentUser?.id;
    fetch(`/api/promo/interactions${userId ? `?userId=${userId}` : ''}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.interactions) {
          const newLikes: Record<string, number> = {};
          const newViews: Record<string, number> = {};
          const serverLiked: Record<string, boolean> = {};

          Object.entries(data.interactions as Record<string, any>).forEach(([id, item]) => {
            if (typeof item.likes === 'number') newLikes[id] = item.likes;
            if (typeof item.views === 'number') newViews[id] = item.views;
            if (userId && Array.isArray(item.likedBy) && item.likedBy.includes(userId)) {
              serverLiked[id] = true;
            }
          });

          setLikesCount(prev => ({ ...newLikes, ...prev }));
          setAdViews(prev => ({ ...newViews, ...prev }));
          if (Object.keys(serverLiked).length > 0) {
            setLikedAds(prev => ({ ...prev, ...serverLiked }));
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    // Merge initial likes and views without destroying existing counts
    setLikesCount(prev => {
      const next = { ...prev };
      displayAds.forEach(ad => {
        if (next[ad.id] === undefined && typeof ad.likes === 'number') {
          next[ad.id] = ad.likes;
        }
      });
      return next;
    });

    setAdViews(prev => {
      const next = { ...prev };
      displayAds.forEach(ad => {
        if (next[ad.id] === undefined && typeof ad.views === 'number') {
          next[ad.id] = ad.views;
        }
      });
      return next;
    });

    const handleLikeUpdate = ({ adId, likes }: { adId: string, likes: number }) => {
      setLikesCount(prev => ({ ...prev, [adId]: likes }));
    };
    const handleNewBroadcast = (newAd: any) => {
      setDbPromoVideos(prev => {
        const existingIndex = prev.findIndex(a => a.id === newAd.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...newAd, isLive: true };
          return updated;
        }
        return [{ ...newAd, isLive: true }, ...prev];
      });
      showToast(isRtl ? `🔴 بدأ بث مباشر جديد: ${newAd.title}` : `🔴 New live stream started: ${newAd.title}`);
    };

    socket.on('ad-like-update', handleLikeUpdate);
    socket.on('new-broadcast', handleNewBroadcast);
    return () => {
      socket.off('ad-like-update', handleLikeUpdate);
      socket.off('new-broadcast', handleNewBroadcast);
    };
  }, [displayAds, isRtl]);

  useEffect(() => {
    if (activeAdForViewer && activeAdForViewer.isLive) {
      // 1. Join the stream room
      socket.emit('join-stream', { streamId: activeAdForViewer.id, role: 'viewer' });

      // 2. Setup listeners
      const handleViewerCountUpdate = ({ count }: { count: number }) => {
        setLiveViewerCount(count);
      };

      const handleChatMessage = (msg: any) => {
        setLiveComments(prev => [...prev.slice(-15), msg]);
        // Also sync to the sliding comments panel state
        setAdComments(prev => ({
          ...prev,
          [activeAdForViewer.id]: [...(prev[activeAdForViewer.id] || []), {
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
        socket.emit('leave-stream', { streamId: activeAdForViewer.id, role: 'viewer' });
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
  }, [activeIndex, activeAdId, activeAdIsLive]);

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
      if (typeof currentId === 'string' && currentId.trim().length > 0 && !viewedAdIdsRef.current.has(currentId)) {
        viewedAdIdsRef.current.add(currentId);
        const endpoint = activeAd.isPromo ? `/api/promo/${currentId}/view` : `/api/ads/${currentId}/view`;
        apiFetch(endpoint, { method: "POST" })
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
    const nextLiked = !isLiked;
    setLikedAds(prev => {
      const next = { ...prev, [adId]: nextLiked };
      try {
        localStorage.setItem('aswaq_liked_reels', JSON.stringify(next));
      } catch {}
      return next;
    });
    
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
    if (typeof adId === 'string' && adId.trim().length > 0) {
      const targetAd = displayAds.find(a => a.id === adId);
      const endpoint = targetAd?.isPromo ? `/api/promo/${adId}/like` : `/api/ads/${adId}/like`;
      apiFetch(endpoint, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextLiked ? 'like' : 'unlike', userId: currentUser?.id })
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
            {/* Reels upload button */}
            <button
              onClick={() => {
                if (!currentUser) {
                  showToast(isRtl ? "يرجى تسجيل الدخول أو إنشاء حساب لنشر مقاطع الريلز" : "Please log in to post reels");
                  onLoginRequest?.();
                  return;
                }
                setShowLiveUploadModal(true);
                showToast(isRtl ? "انشر فيديو ريلز جديد لصفقتك وسلعتك الآن! 🎥" : "Post a new Reels video promo now! 🎥");
              }}
              className="text-white bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-pink-400/30 flex items-center gap-1 cursor-pointer transition-all duration-300 font-extrabold shadow shadow-pink-500/10 hover:border-pink-400"
            >
              <Video className="w-3 h-3 text-white" />
              <span>{isRtl ? 'نشر ريلز فيديو 🎥' : 'Post Reel 🎥'}</span>
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
            const ctaConfig = getAdCtaConfig(ad, isRtl);
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
                  const actualVid = resolveMediaUrl(parsedMedia.videoUrl || ad.videoUrl || '');
                  const isAdLive = localAdOverrides[ad.id]?.isLive !== undefined ? localAdOverrides[ad.id].isLive : ad.isLive;
                  const isWebcamSource = (actualVid === 'webcam' || actualVid === 'camera') && myBroadcastingIds.includes(ad.id);

                  return (
                    <>
                      {isWebcamSource ? (
                        <div className="absolute inset-0 z-[60]">
                          <WebcamStreamPlayer 
                            isMuted={isMuted} 
                            isRtl={isRtl} 
                            ad={ad} 
                            currentUser={currentUser} 
                            pinnedProduct={pinnedProduct} 
                            onPinProductClick={() => setShowPinProductModal(true)} 
                            myBroadcastingIds={myBroadcastingIds}
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
                      ) : ((isCurrent || isPreloading) && actualVid && !actualVid.startsWith('webcam') && !actualVid.startsWith('camera')) ? (
                        getYoutubeEmbedUrlForBg(actualVid, isMuted) ? (
                          <div className="absolute inset-0 w-full h-full z-[1]">
                            <iframe
                              src={getYoutubeEmbedUrlForBg(actualVid, isMuted) || undefined}
                              className="w-full h-full object-cover scale-[1.3] pointer-events-none brightness-95 absolute inset-0 border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              title="Spotlight Background Video"
                            />
                          </div>
                        ) : (
                          <FeedVideoPlayer
                            src={actualVid}
                            isCurrent={isCurrent}
                            isMuted={isMuted}
                            audioUrl={ad.audioUrl}
                          />
                        )
                      ) : null}
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

              <div className={`absolute bottom-[170px] sm:bottom-28 z-[200] flex flex-col gap-3 sm:gap-4 items-center pointer-events-auto ${isRtl ? 'left-2 sm:left-4' : 'right-2 sm:right-4'}`}>
                {/* 1. Avatar Profile */}
                <div className="flex flex-col items-center gap-1 relative mb-2">
                  <div 
                     onClick={() => {
                       const usr = INITIAL_USERS.find(u => u.avatar === (ad.user?.avatar || ad.userAvatar) || u.id === ad.userId);
                       if (usr && onSelectUser) {
                         onSelectUser(usr);
                         onClose();
                       } else {
                         onSelectAd(ad);
                       }
                       showToast(t('spotlight.merchantToast'));
                     }}
                     className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-slate-900 shadow-xl cursor-pointer hover:scale-105 transition-transform border-[2px] border-emerald-400/90 shadow-emerald-500/30 p-0.5"
                  >
                    <Avatar 
                      src={ad.user?.avatar || ad.userAvatar || managerProfile?.avatar || currentUser?.avatar} 
                      name={ad.user?.name || ad.userName || managerProfile?.name || currentUser?.name || (isRtl ? 'بائع أسواق' : 'Aswaq Seller')} 
                      sizeClassName="w-full h-full"
                      className="rounded-full object-cover"
                    />
                  </div>
                  {/* Verified Badge */}
                  <div className="absolute -bottom-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-emerald-500/50 border border-white"
                       title={t('spotlight.verifiedSeller')}
                  >
                    <span className="text-slate-900 text-[9px] leading-none font-black">✓</span>
                  </div>
                </div>
                {/* اسم صاحب الريل */}
                <span className="text-[10px] font-black drop-shadow-lg text-center leading-tight max-w-[56px] truncate text-white/95">
                  {sanitizeName(ad.user?.name || ad.userName || managerProfile?.name || currentUser?.name || (isRtl ? 'بائع' : 'Seller')).split(' ')[0]}
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
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr ${ctaConfig.fabColor} flex items-center justify-center text-white transition-all ${ctaConfig.fabShadow} animate-pulse active:animate-none cursor-pointer`}
                  >
                    <ctaConfig.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.button>
                  <span className="text-emerald-400 text-[9px] sm:text-[10px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tracking-wide">
                    {ctaConfig.fabLabel}
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
                        {ctaConfig.fabLabel || (isRtl ? 'شراء' : 'Buy')}
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
                    <div className="flex items-center gap-1.5 bg-slate-950/80 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-md shadow-md">
                      <Avatar
                        src={ad.user?.avatar || ad.userAvatar || managerProfile?.avatar || currentUser?.avatar}
                        name={ad.user?.name || ad.userName || managerProfile?.name || currentUser?.name || ''}
                        sizeClassName="w-4 h-4"
                        className="rounded-full"
                      />
                      <span className="text-white text-[10px] sm:text-[11px] font-black tracking-wide">
                        {ad.user?.name || ad.userName || managerProfile?.name || currentUser?.name || (isRtl ? 'بائع أسواق' : 'Aswaq Seller')}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
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
                        className={`flex-1 ${ctaConfig.color} hover:opacity-90 text-white h-11 sm:h-14 rounded-xl sm:rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer text-[11px] sm:text-xs uppercase tracking-wider`}
                       >
                         <ctaConfig.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                         <span>{ctaConfig.mainLabel}</span>
                       </button>
                     ) : (
                       <button 
                        onClick={() => {
                          onSelectAd(ad);
                          showToast(t('spotlight.detailsToast'));
                        }}
                        className={`flex-1 ${ctaConfig.color} hover:opacity-90 text-white h-11 sm:h-14 rounded-xl sm:rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer text-xs sm:text-sm`}
                       >
                         <ctaConfig.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                         <span>{ctaConfig.mainLabel}</span>
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

      {/* Shoppable / Booking / Inspection Panel for Reels */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-emerald-500/50 rounded-t-3xl pt-2 pb-24 px-5 z-[1200] transition-transform duration-300 flex flex-col shadow-[0_-15px_45px_rgba(16,185,129,0.15)] h-[70%] max-h-[85vh] pointer-events-auto ${showShoppablePanel ? "translate-y-0" : "translate-y-full"} ${isRtl ? 'text-right' : 'text-left'}`}
      >
        <div className="flex justify-center mb-2">
          <div className="w-12 h-1 bg-slate-850 rounded-full cursor-pointer" onClick={() => setShowShoppablePanel(false)}></div>
        </div>

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
            city: currentAd?.city || 'كافة المناطق',
            category: currentAd?.category,
            categoryId: currentAd?.categoryId
          } : currentAd;

          if (!ad) return (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-center text-xs">لا يوجد إعلان مرتبط بهذا المقطع.</p>
            </div>
          );

          const ctaConfig = getAdCtaConfig(ad, isRtl);
          const panel = ctaConfig.panel;
          const safeImages = Array.isArray(ad.images) ? ad.images : [];

          return (
            <>
              {/* Dynamic Header based on category */}
              <div className={`flex items-center justify-between border-b border-slate-900 pb-3 mb-3 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{panel.icon}</span>
                  <div>
                    <h4 className="text-xs font-black text-white">{panel.headerTitle}</h4>
                    <p className="text-[9.5px] text-emerald-400 font-bold">{panel.headerSubtitle}</p>
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
                {/* Item / Hotel mini header information */}
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
                      <span>👤 {ad.user?.name || ad.userName || (isRtl ? 'المعلن' : 'Advertiser')}</span>
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
                    <h5 className="text-xs font-black text-emerald-400">{panel.successTitle}</h5>
                    <p className="text-[10px] text-slate-300 leading-normal max-w-[300px] mx-auto">
                      رقم الطلب المرجعي: <span className="font-mono font-bold text-white bg-slate-950 px-1.5 py-0.5 rounded">ASW-{shoppableOrderId}</span>. {panel.successDesc}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowShoppablePanel(false)}
                      className="text-[10px] font-black text-emerald-400 hover:underline border-none bg-transparent block mx-auto cursor-pointer pt-2"
                    >
                      {panel.successContinueText}
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Dynamic Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">{panel.nameLabel}</label>
                        <input 
                          type="text" 
                          value={shoppableBuyerName}
                          onChange={(e) => setShoppableBuyerName(e.target.value)}
                          placeholder={panel.namePlaceholder}
                          className="w-full bg-slate-900 border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">{panel.phoneLabel}</label>
                        <input 
                          type="text" 
                          value={shoppableBuyerPhone}
                          onChange={(e) => setShoppableBuyerPhone(e.target.value)}
                          placeholder={panel.phonePlaceholder}
                          className="w-full bg-slate-900 border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                    {/* Quantity or Duration Counter */}
                    {panel.hasQuantity ? (
                      <div className="flex items-center justify-between border-t border-slate-900/60 pt-3">
                        <span className="text-[11px] font-bold text-slate-400">{panel.quantityLabel}</span>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button" 
                            onClick={() => setShoppableQuantity(prev => Math.max(1, prev - 1))}
                            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-white font-extrabold cursor-pointer border-none"
                          >
                            -
                          </button>
                          <span className="text-[11.5px] font-black text-white font-mono px-1">
                            {shoppableQuantity} {panel.quantityUnit}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setShoppableQuantity(prev => prev + 1)}
                            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-white font-extrabold cursor-pointer border-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Cost summary tailored to category */}
                    <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-900 space-y-1.5 font-mono text-right">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500 font-sans">{panel.costRow1Label}</span>
                        <span className="text-slate-300">
                          {((ad.price || 0) * (panel.hasQuantity ? shoppableQuantity : 1)).toLocaleString()} {ad.currency}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500 font-sans">{panel.costRow2Label}</span>
                        <span className="text-emerald-400 font-sans">{panel.costRow2Value}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black border-t border-slate-950 pt-2">
                        <span className="text-slate-400 font-sans">{panel.costTotalLabel}</span>
                        <span className="text-emerald-400 text-sm">
                          {((ad.price || 0) * (panel.hasQuantity ? shoppableQuantity : 1)).toLocaleString()} {getCurrencyNameAr(ad.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Direct Action Button */}
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
                              quantity: panel.hasQuantity ? shoppableQuantity : 1,
                              buyerName: shoppableBuyerName,
                              buyerPhone: shoppableBuyerPhone,
                              categoryType: panel.type
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
                            alert(result.message || 'فشلت معالجة الطلب.');
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
                        <span>جاري تسجيل وتأكيد الطلب المباشر...</span>
                      ) : (
                        <span>{panel.submitButtonText}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          );
        })()}
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
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col gap-4 text-slate-100 font-sans"
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
                  setUploadedVideoUrl('');
                  setVideoUploading(false);
                  setVideoOriginalName('');
                  setVideoThumbnailUrl('');
                }}
                className="absolute top-4 left-4 p-2 rounded-full bg-slate-950/60 border border-white/10 hover:border-pink-500/30 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {isRtl ? '🎬 نشر مقطع ريلز فيديو احترافي' : '🎬 Post Professional Reels Video'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                    {isRtl ? 'ارفع فيديو لمنتجك أو صفقتك ليظهر لآلاف المشترين فوراً' : 'Upload a video to showcase your product to thousands of buyers'}
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (videoUploading) {
                      showToast(isRtl ? 'يرجى الانتظار حتى يكتمل رفع ملف الفيديو!' : 'Please wait for the video upload to finish!');
                      return;
                    }
                    if (audioUploading) {
                      showToast(isRtl ? 'يرجى الانتظار حتى يكتمل رفع الملف الصوتي!' : 'Please wait for the audio file to finish uploading!');
                      return;
                    }

                    const formData = new FormData(e.currentTarget);
                    
                    const title = (formData.get('liveTitle') || '').toString().trim();
                    const description = (formData.get('liveDesc') || '').toString().trim();
                    
                    let rawVideoUrl = '';
                    if (videoSourceType === 'upload') {
                      rawVideoUrl = uploadedVideoUrl;
                    } else if (videoSourceType === 'camera') {
                      rawVideoUrl = 'webcam';
                    } else if (videoSourceType === 'link') {
                      rawVideoUrl = (formData.get('videoUrlLink') || '').toString().trim();
                    }

                    if (!rawVideoUrl) {
                      showToast(isRtl ? 'يرجى رفع ملف فيديو أو إدخال رابط الفيديو أولاً!' : 'Please upload a video file or provide a video link!');
                      return;
                    }

                    let audioUrl = 'none';
                    if (audioSourceType === 'file') {
                      audioUrl = uploadedAudioUrl || 'none';
                    } else if (audioSourceType === 'link') {
                      audioUrl = (formData.get('audioUrlLink') || '').toString().trim() || 'none';
                    }

                    const city = (formData.get('liveCity') || 'all').toString();
                    const liveCategory = (formData.get('liveCat') || '').toString();
                    const isLive = videoSourceType === 'camera';

                    if (!title) {
                      showToast(isRtl ? 'يرجى إدخال عنوان لمقطع الريلز!' : 'Please enter a title for the reel!');
                      return;
                    }

                    // Serialize videoUrl
                    const videoUrl = `${rawVideoUrl}||${audioUrl}||${description}||${city === 'all' ? (isRtl ? "كافة المناطق" : "All Regions") : city}||${liveCategory}`;

                    const creatorAvatar = managerProfile?.avatar || currentUser?.avatar || "https://lh3.googleusercontent.com/a/ACg8ocILZLj44t6xsNGSs0XS0LWGNknuYW-7HX_HLmWQ0duGl8STxw=s96-c";
                    const creatorName = managerProfile?.name || currentUser?.name || "Emad Salah";
                    const creatorId = managerProfile?.id || currentUser?.id || "admin";

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
                        userId: creatorId,
                        userName: creatorName,
                        userAvatar: creatorAvatar,
                        thumbnailUrl: videoThumbnailUrl || undefined
                      })
                    });

                    let createdItem: any = null;
                    if (response.ok) {
                      createdItem = await response.json();
                    } else {
                      // Fallback creation for offline/instant mode
                      createdItem = {
                        id: `promo_local_${Date.now()}`,
                        title: title || (isRtl ? "ريلز جديد" : "New Reel"),
                        videoUrl: videoUrl,
                        userId: creatorId,
                        userName: creatorName,
                        userAvatar: creatorAvatar,
                        thumbnailUrl: videoThumbnailUrl || undefined,
                        isLive: isLive || rawVideoUrl === 'webcam' || rawVideoUrl === 'camera'
                      };
                    }

                    const parsed = parseVideoUrl(createdItem.videoUrl || videoUrl);
                    const isWebcam = parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera';
                    const defaultImg = videoThumbnailUrl || (isWebcam 
                      ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
                      : "https://picsum.photos/seed/promo/800/400");

                    const formatted = {
                      ...createdItem,
                      id: createdItem.id || `promo_db_${Date.now()}`,
                      isPromo: true,
                      promoType: "db",
                      views: 0,
                      likes: 0,
                      title: createdItem.title || title,
                      category: parsed.category || (isRtl ? "فيديو ترويجي" : "Promo Video"),
                      city: parsed.city || (isRtl ? "كافة المناطق" : "All Regions"),
                      description: parsed.description || description || (isRtl ? "مقطع ريلز مميز تم نشره من قبل المستخدم" : "Featured reel uploaded by user"),
                      userId: createdItem.userId || creatorId,
                      userName: createdItem.userName || creatorName,
                      userAvatar: createdItem.userAvatar || creatorAvatar,
                      userVerified: true,
                      videoUrl: parsed.videoUrl,
                      audioUrl: parsed.audioUrl,
                      isLive: parsed.videoUrl === 'webcam' || parsed.videoUrl === 'camera' || !!createdItem.isLive || isLive,
                      images: [createdItem.thumbnailUrl || defaultImg]
                    };

                    setMyBroadcastingIds(prev => [formatted.id, ...prev]);
                    setDbPromoVideos(prev => [formatted, ...prev]);
                    showToast(isRtl ? 'تم نشر مقطع الريلز بنجاح! 🚀' : 'Reel posted successfully! 🚀');
                    
                    // Reset ALL filters and search to ensure the new ad is visible at index 0
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedCity('all');
                    setSelectedContentType('all');
                    setShowOnlyPromo(false);

                    setTimeout(() => {
                      setActiveIndex(0);
                      setShowLiveUploadModal(false);
                      // Reset upload states
                      setAudioSourceType('none');
                      setUploadedAudioUrl('');
                      setAudioUploading(false);
                      setAudioOriginalName('');
                      setUploadedVideoUrl('');
                      setVideoUploading(false);
                      setVideoOriginalName('');
                      setVideoThumbnailUrl('');
                      // Force container to top to show the new ad
                      if (containerRef.current) {
                        containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
                      }
                    }, 150);
                  } catch (err: any) {
                    console.error('[LaunchError]', err);
                    showToast(isRtl ? `حدث خطأ: ${err?.message || err}` : `Error: ${err?.message || err}`);
                  }
                }}
                className="flex flex-col gap-3.5 text-right"
              >
                {/* 1. Video Source Selection (MAIN FEATURE) */}
                <div className="flex flex-col gap-2 bg-slate-950/80 border border-pink-500/20 p-3.5 rounded-2xl">
                  <label className="text-[11px] font-black text-pink-400 flex items-center justify-between">
                    <span>📹 {isRtl ? 'مصدر مقطع الفيديو (مطلوب):' : 'Video Source (Required):'}</span>
                    {uploadedVideoUrl && (
                      <span className="text-emerald-400 text-[10px] font-bold">✓ {isRtl ? 'جاهز للنشر' : 'Ready'}</span>
                    )}
                  </label>

                  {/* Mode Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setVideoSourceType('upload')}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        videoSourceType === 'upload'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'رفع ملف فيديو' : 'Upload File'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSourceType('camera')}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        videoSourceType === 'camera'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'تصوير بالكاميرا' : 'Live Camera'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSourceType('link')}
                      className={`py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        videoSourceType === 'link'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'رابط مباشر' : 'Video URL'}</span>
                    </button>
                  </div>

                  {/* Mode 1: File Upload */}
                  {videoSourceType === 'upload' && (
                    <div className="flex flex-col gap-2 mt-1">
                      {!uploadedVideoUrl ? (
                        <label className="border-2 border-dashed border-pink-500/40 hover:border-pink-400 bg-pink-500/5 hover:bg-pink-500/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                          <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">
                            {videoUploading ? (
                              <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload className="w-6 h-6 animate-bounce" />
                            )}
                          </div>
                          
                          <div className="text-center">
                            <span className="text-xs font-black text-white block">
                              {videoUploading 
                                ? (isRtl ? `جاري رفع الفيديو... ${videoUploadProgress}%` : `Uploading video... ${videoUploadProgress}%`)
                                : (isRtl ? 'اضغط لاختيار ملف الفيديو من جهازك أو هاتفك' : 'Click to select video from your device')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-extrabold mt-0.5 block">
                              {isRtl ? 'الصيغ المدعومة: MP4, MOV, WEBM (حتى 60 ميجابايت)' : 'Supported formats: MP4, MOV, WEBM (up to 60MB)'}
                            </span>
                          </div>

                          {videoUploading && (
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/10 mt-1">
                              <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${videoUploadProgress}%` }}
                              />
                            </div>
                          )}

                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/mov,video/*"
                            disabled={videoUploading}
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > 65 * 1024 * 1024) {
                                showToast(isRtl ? 'حجم الفيديو كبير جداً (الحد الأقصى 60 ميجابايت)' : 'Video too large (max 60MB)');
                                return;
                              }

                              setVideoOriginalName(file.name);
                              setVideoUploading(true);
                              setVideoUploadProgress(0);

                              try {
                                const uploadData = new FormData();
                                uploadData.append('file', file);

                                const xhr = new XMLHttpRequest();
                                xhr.open('POST', '/api/storage/upload', true);

                                // Include Authorization header if available
                                const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token') || localStorage.getItem('aswaq_token');
                                if (currentUser?.email) { xhr.setRequestHeader('X-User-Email', currentUser.email); }
                                if (currentUser?.id) { xhr.setRequestHeader('X-User-Id', currentUser.id); }
                                if (token) {
                                  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                                }

                                xhr.upload.onprogress = (event) => {
                                  if (event.lengthComputable) {
                                    const percent = Math.round((event.loaded / event.total) * 100);
                                    setVideoUploadProgress(percent);
                                  }
                                };

                                xhr.onload = () => {
                                  if (xhr.status >= 200 && xhr.status < 300) {
                                    try {
                                      const data = JSON.parse(xhr.responseText);
                                      if (data.url) {
                                        setUploadedVideoUrl(data.url);
                                        showToast(isRtl ? 'تم رفع مقطع الفيديو بنجاح! 🎉' : 'Video uploaded successfully! 🎉');
                                      } else {
                                        showToast(isRtl ? 'حدث خطأ في استجابة السيرفر' : 'Server error');
                                      }
                                    } catch {
                                      showToast(isRtl ? 'فشل معالجة الفيديو' : 'Failed to parse response');
                                    }
                                  } else {
                                    showToast(isRtl ? 'فشل رفع الفيديو، يرجى المحاولة مرة أخرى' : 'Video upload failed');
                                  }
                                  setVideoUploading(false);
                                };

                                xhr.onerror = () => {
                                  showToast(isRtl ? 'حدث خطأ في الاتصال أثناء الرفع' : 'Network error during upload');
                                  setVideoUploading(false);
                                };

                                xhr.send(uploadData);
                              } catch (err: any) {
                                console.error('Video upload error:', err);
                                showToast(isRtl ? 'حدث خطأ أثناء الرفع' : 'Upload error');
                                setVideoUploading(false);
                              }
                            }}
                          />
                        </label>
                      ) : (
                        /* Video Live Preview Box */
                        <div className="relative rounded-2xl overflow-hidden bg-black border border-emerald-500/40 p-2 flex flex-col gap-2">
                          <video
                            src={uploadedVideoUrl}
                            controls
                            playsInline
                            className="w-full h-44 rounded-xl object-contain bg-slate-950"
                          />
                          <div className="flex items-center justify-between px-2 text-xs">
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <span>✓</span>
                              <span className="truncate max-w-[200px]">{videoOriginalName || (isRtl ? 'فيديو جاهز' : 'Video Ready')}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedVideoUrl('');
                                setVideoOriginalName('');
                                setVideoUploadProgress(0);
                              }}
                              className="text-rose-400 hover:text-rose-300 text-[10px] font-bold cursor-pointer"
                            >
                              {isRtl ? 'تغيير الفيديو 🔄' : 'Change Video 🔄'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: Camera Broadcast */}
                  {videoSourceType === 'camera' && (
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-center flex flex-col items-center gap-1.5 mt-1">
                      <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-black text-emerald-300">
                        {isRtl ? 'كاميرا البث الحي مفعلة' : 'Live Camera Enabled'}
                      </span>
                      <p className="text-[10px] text-slate-300 font-bold">
                        {isRtl ? 'سيتم فتح كاميرا هاتفك/جهازك مباشرة عند بدء المقطع' : 'Your device camera will activate when stream starts'}
                      </p>
                    </div>
                  )}

                  {/* Mode 3: Direct Link */}
                  {videoSourceType === 'link' && (
                    <div className="flex flex-col gap-2 mt-1">
                      <input
                        type="url"
                        name="videoUrlLink"
                        placeholder={isRtl ? 'أدخل رابط فيديو مباشر (MP4, Vimeo, CDN...)' : 'Enter direct video URL (e.g. https://.../video.mp4)'}
                        className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/65 font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Title */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    ✍️ {isRtl ? 'عنوان مقطع الريلز (مطلوب):' : 'Reel Title (Required):'}
                  </label>
                  <input
                    type="text"
                    name="liveTitle"
                    required
                    placeholder={isRtl ? 'مثال: تخفيضات كبرى على الهواتف والأجهزة الذكية!' : 'e.g. Huge Sale on Smartphones & Tech!'}
                    className="bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-pink-500/65 font-extrabold"
                  />
                </div>

                {/* 3. Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400">
                    📝 {isRtl ? 'تفاصيل ووصف المقطع:' : 'Description & Details:'}
                  </label>
                  <textarea
                    name="liveDesc"
                    rows={2}
                    placeholder={isRtl ? 'اكتب تفاصيل العرض، السعر، رقم التواصل، أو ميزات المنتج...' : 'Write product details, price, contact or features...'}
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
                      className="bg-slate-950 border border-white/5 rounded-xl px-2 py-2 text-xs text-white font-bold outline-none cursor-pointer"
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
                      className="bg-slate-950 border border-white/5 rounded-xl px-2 py-2 text-xs text-white font-bold outline-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={isRtl ? cat.nameAr : cat.nameEn}>
                          {isRtl ? cat.nameAr : cat.nameEn}
                        </option>
                      ))}
                      <option value="عام">{isRtl ? 'عام / متنوع 📦' : 'General'}</option>
                    </select>
                  </div>
                </div>

                {/* 5. Audio Selection Control */}
                <div className="flex flex-col gap-2 bg-slate-950/60 border border-white/5 p-3 rounded-2xl">
                  <label className="text-[10px] font-black text-slate-400 flex items-center justify-between">
                    <span>🎵 {isRtl ? 'موسيقى أو مقطع صوتي خلفي (اختياري):' : 'Background Audio (Optional):'}</span>
                    <span className="text-[9px] text-slate-500 font-bold">{audioSourceType === 'none' ? (isRtl ? 'صوت الفيديو الأصلي' : 'Original Video Audio') : (isRtl ? 'صوت مخصص' : 'Custom Audio')}</span>
                  </label>
                  
                  {/* Audio Mode Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('none')}
                      className={`py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'none'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isRtl ? 'صوت أصلي' : 'Original'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('file')}
                      className={`py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'file'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isRtl ? 'رفع ملف صوت' : 'Upload Audio'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('link')}
                      className={`py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                        audioSourceType === 'link'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isRtl ? 'رابط صوت' : 'Audio Link'}
                    </button>
                  </div>

                  {audioSourceType === 'file' && (
                    <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-white/5">
                      <label className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3 text-pink-400" />
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
                                headers: localStorage.getItem('aswaq_token') ? { 'Authorization': `Bearer ${localStorage.getItem('aswaq_token')}` } : {},
                                body: uploadData,
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setUploadedAudioUrl(data.url);
                                showToast(isRtl ? 'تم رفع الصوت بنجاح!' : 'Audio uploaded!');
                              }
                            } catch {
                              showToast(isRtl ? 'فشل رفع الصوت' : 'Audio upload failed');
                            } finally {
                              setAudioUploading(false);
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-slate-400 truncate flex-1">{audioOriginalName || (isRtl ? 'MP3, WAV, M4A' : 'Audio file')}</span>
                    </div>
                  )}

                  {audioSourceType === 'link' && (
                    <input
                      type="url"
                      name="audioUrlLink"
                      placeholder="https://example.com/sound.mp3"
                      className="bg-slate-900 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white outline-none focus:border-purple-500 font-bold"
                    />
                  )}
                </div>

                {/* Submitting Buttons */}
                <div className="flex gap-2.5 mt-2">
                  <button
                    type="submit"
                    disabled={videoUploading || audioUploading}
                    className={`flex-1 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs py-3 rounded-xl font-black transition-all active:scale-95 cursor-pointer shadow-lg shadow-pink-500/20 text-center border-none flex items-center justify-center gap-2 ${
                      videoUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>{videoUploading ? (isRtl ? 'جاري رفع الفيديو...' : 'Uploading...') : (isRtl ? '🚀 نشر مقطع الريلز الآن' : '🚀 Post Reel Now')}</span>
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
