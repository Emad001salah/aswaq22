/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  Check,
  ArrowRight,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  User as UserIcon,
  CheckCircle2,
  FileText,
  Camera,
  ShieldAlert,
  Send,
  Sliders,
  Bell,
  Briefcase,
  Video,
  RefreshCw,
  X,
  Scan,
  MoreVertical,
  Star,
  Home
} from "lucide-react";
import VideoRecorder from "./VideoRecorder.tsx";
import { API_BASE_URL } from "../lib/config";
import JobPortal from "./JobPortal.tsx";
import { uploadFileWithProgress } from "../lib/upload.ts";
import { Avatar } from "./Avatar.tsx";
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
  LineChart,
  Line,
} from "recharts";
import { motion } from "motion/react";
import {
  User,
  Ad,
  ChatMessage,
  Category,
  City,
  AppNotification,
} from "../types.ts";
import {
  CITIES,
  CATEGORIES,
  INITIAL_USERS,
  DISTRICTS,
  SUB_CATEGORIES,
} from "../data.ts";
import socket, { joinRoom } from "../lib/socket.ts";

import { Market, getCurrencyAr, getCurrencyNameAr } from "../markets.ts";

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
  const isRtl = i18n.language === 'ar';
  const categories = categoriesProp || CATEGORIES;
  // Navigation tabs: 'create-ad' | 'my-ads' | 'analytics' | 'messages' | 'settings'
  const activeTab = initialTab;

  // Message Hub states
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [activeChats, setActiveChats] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  // Message Hub Rating states
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [roomToRate, setRoomToRate] = useState<any | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratedConversationIds, setRatedConversationIds] = useState<string[]>([]);

  // Ad Deletion Confirmation states
  const [adToDeleteId, setAdToDeleteId] = useState<string | null>(null);
  const [adToDeleteTitle, setAdToDeleteTitle] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Reels / Live Clips states
  const [userReels, setUserReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);

  // Fetch user's own reels
  useEffect(() => {
    if (activeTab !== "live-clips") return;
    
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
  }, [activeTab, currentUser.id]);

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
          authorAvatar: currentUser.avatar || '',
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
        
        if (addToast) {
          addToast(
            isRtl ? "تم إرسال التقييم بنجاح! 🎉" : "Rating Submitted Successfully! 🎉",
            isRtl
              ? "شكراً لك على تقييم تجربتك للمساعدة في تعزيز جودة ومصداقية مجتمع أسواق."
              : "Thank you for rating your experience to help boost the quality and of Ashwaq community.",
            "success"
          );
        } else {
          if (addToast) {
            addToast("نجاح", isRtl ? "تم التقييم بنجاح! شكراً لك." : "Rated successfully! Thank you.", "success");
          }
        }
      } else {
        if (addToast) {
          addToast(
            isRtl ? "فشل إرسال التقييم" : "Rating Submission Failed",
            isRtl ? "حدث خطأ ما أثناء إرسال التقييم. الرجاء المحاولة لاحقاً." : "An error occurred while submitting rating.",
            "error"
          );
        }
      }
    } catch (e) {
      console.error("Error submitting rating:", e);
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Real-time socket effect
  useEffect(() => {
    if (currentUser?.id) {
      joinRoom(currentUser.id);

      const handleNewMessage = (msg: ChatMessage) => {
        // If we are looking at the messages tab or a specific chat, refresh the rooms or active chat
        fetchChatRooms();
        if (
          selectedRoom &&
          (msg.senderId === selectedRoom.partnerId ||
            msg.receiverId === selectedRoom.partnerId)
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

  // Synchronize city and currency when the market changes
  useEffect(() => {
    if (currentMarket) {
      if (currentMarket.cities && currentMarket.cities.length > 0) {
        setCity(currentMarket.cities[0].id);
      }
      setCurrency(currentMarket.currency || "USD");
      setDistrict("");
    }
  }, [currentMarket]);

  // New ad states
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [city, setCity] = useState(currentMarket?.cities?.[0]?.id || CITIES[0].id);
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
  const [subCategorySearch, setSubCategorySearch] = useState("");
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [contactNumber, setContactNumber] = useState(currentUser.phone);
  const [showPhone, setShowPhone] = useState(true);
  const [adImages, setAdImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUploadXhr, setVideoUploadXhr] = useState<any>(null);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [adStatus, setAdStatus] = useState<"active" | "sold">("active");
  const [enhancing, setEnhancing] = useState(false);
  const [suggestingPrice, setSuggestingPrice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [adStep, setAdStep] = useState(1);

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!title.trim()) {
        addToast(isRtl ? "تنبيه" : "Notice", isRtl ? "يرجى إدخال عنوان الإعلان أولاً!" : "Please enter an ad title first!", "error");
        return false;
      }
      if (!description.trim()) {
        addToast(isRtl ? "تنبيه" : "Notice", isRtl ? "يرجى إدخال وصف تفصيلي للإعلان!" : "Please enter an ad description first!", "error");
        return false;
      }
      if (!price || isNaN(Number(price)) || Number(price) <= 0) {
        addToast(isRtl ? "تنبيه" : "Notice", isRtl ? "يرجى إدخال سعر صحيح أكبر من الصفر!" : "Please enter a valid price greater than zero!", "error");
        return false;
      }
      if (!category) {
        addToast(isRtl ? "تنبيه" : "Notice", isRtl ? "يرجى اختيار القسم أو الفئة المناسبة!" : "Please select an ad category first!", "error");
        return false;
      }
    }
    return true;
  };

  // Synchronize jobType when category changes
  useEffect(() => {
    if (category === "jobs") {
      setJobType("hiring");
    }
  }, [category]);

  // KYC Verification States
  const [kycMode, setKycMode] = useState<'idle' | 'camera' | 'captured'>('idle');
  const [kycPhoto, setKycPhoto] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycStep, setKycStep] = useState<1 | 2>(1); // 1: ID Card, 2: Face
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startKycCamera = async () => {
    setKycMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setKycMode('idle');
    }
  };

  const stopKycCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setKycMode('idle');
  };

  const captureKycPhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setKycPhoto(dataUrl);
        setKycMode('captured');
        stopKycCamera();
      }
    }
  };

  const handleAiAnalyzeImage = async (url: string) => {
    if (!url) return;
    setAnalyzingImage(true);
    try {
      const response = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.category && categories.some(c => c.id === data.category)) {
          setCategory(data.category);
        }
        if (data.suggestedPrice) setPrice(data.suggestedPrice.toString());
        if (data.condition) setCondition(data.condition);
        if (data.specs) setDescription(prev => {
          const base = prev || "";
          return base + "\n\nالمواصفات المستخرجة:\n" + data.specs;
        });
      }
    } catch (e) {
      console.error("AI Analysis failed", e);
    } finally {
      setAnalyzingImage(false);
    }
  };

  // Real Estate Specific Create States
  const [rooms, setRooms] = useState<number>(0);
  const [propertyType, setPropertyType] = useState<string>("apartment");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [showOnMap, setShowOnMap] = useState<boolean>(true);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);

  // Vehicle Specific Create States
  const [make, setMake] = useState<string>("");
  const [modelYear, setModelYear] = useState<number | "">("");
  const [transmission, setTransmission] = useState<string>("automatic");
  const [fuelType, setFuelType] = useState<string>("gasoline");

  // Electronics Specific Create States
  const [condition, setCondition] = useState<string>("used_mint");
  const [brand, setBrand] = useState<string>("");

  // Jobs Specific Create States
  const [jobType, setJobType] = useState<"seeking" | "hiring">("hiring");

  // Minimap state and effect
  useEffect(() => {
    // Initialise the minimap using Leaflet (lazy-loaded if not yet available)
    const initMinimap = () => {
      const L = (window as any).L;
      if (!L || !showOnMap || activeTab !== "create-ad") return;

      // Determine initial center
      const cityCenter = currentMarket.cityCoordinates[city] || currentMarket.center;
      const initialLat = latitude || cityCenter.lat;
      const initialLng = longitude || cityCenter.lng;

      const minimapElement = document.getElementById("create-ad-minimap");
      if (!minimapElement) return;

      // Reset container HTML to avoid multiple map instances error in Leaflet
      minimapElement.innerHTML = '<div id="minimap-stage" style="width:100%; height:100%;"></div>';

      const stage = document.getElementById("minimap-stage");
      if (!stage) return;

      const map = L.map(stage, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 19
      }).addTo(map);

      // Draggable pin for exact ad placement
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLatitude(pos.lat);
        setLongitude(pos.lng);
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setLatitude(lat);
        setLongitude(lng);
      });

      // Auto-locate if no coordinates are set
      if (!latitude && !longitude && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 14, { animate: true });
            marker.setLatLng([lat, lng]);
            setLatitude(lat);
            setLongitude(lng);
          },
          () => {}, // Ignore errors silently to not disrupt UX
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }

      (window as any)._createAdMinimap = { map, marker };

      return () => {
        if ((window as any)._createAdMinimap) {
          delete (window as any)._createAdMinimap;
        }
        try {
          map.off();
          map.remove();
        } catch (err) {
          console.warn("Minimap cleanup error:", err);
        }
        minimapElement.innerHTML = '';
      };
    }; // end initMinimap

    // If Leaflet already loaded, init immediately; otherwise lazy-load it
    if ((window as any).L) {
      return initMinimap();
    } else if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMinimap();
      document.body.appendChild(script);
    }
  }, [showOnMap, activeTab, city]);

  const handleStartEditAd = (ad: Ad) => {
    setEditingAdId(ad.id);
    setTitle(ad.title);
    setDescription(ad.description);
    setPrice(String(ad.price));
    setCurrency(ad.currency);
    setCity(ad.city);
    setDistrict(ad.district || "");
    setCategory(ad.category);
    setSubCategory(ad.subCategory || "");
    setAdImages(ad.images || []);
    setVideoUrl(ad.videoUrl || "");
    setAdStatus(ad.status === "sold" ? "sold" : "active");
    setContactNumber(ad.contactNumber || "");
    setShowPhone(!!ad.contactNumber);
    setCustomCategoryName("");
    setLatitude(ad.latitude !== undefined ? ad.latitude : null);
    setLongitude(ad.longitude !== undefined ? ad.longitude : null);
    setShowOnMap(ad.showOnMap !== undefined ? ad.showOnMap : true);

    // Category Specific properties
    if (ad.category === "realestate") {
      setRooms(ad.rooms || 0);
      setPropertyType(ad.propertyType || "apartment");
      setAmenities(ad.amenities || []);
    } else if (ad.category === "cars") {
      setMake(ad.make || "");
      setModelYear(ad.modelYear || "");
      setTransmission(ad.transmission || "automatic");
      setFuelType(ad.fuelType || "gasoline");
    } else if (["electronics", "phones", "laptops"].includes(ad.category)) {
      setCondition(ad.condition || "used_mint");
      setBrand(ad.brand || "");
    } else if (ad.category === "jobs") {
      setJobType(ad.jobType || "hiring");
    }

    onTabChange("create-ad");
  };

  const handleLocalImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (adImages.length + files.length > 5) {
      if (addToast) addToast("خطأ", "الحد الأقصى للصور هو 5 صور", "error");
      return;
    }

    for (const file of files) {
      // Reject files larger than 15MB
      if (file.size > 15 * 1024 * 1024) {
        if (addToast) {
          addToast("الملف كبير جداً ⚠️", `الملف "${file.name}" يتجاوز الحد الأقصى المسموح به للصور (15 ميجابايت).`, "error");
        }
        continue;
      }

      // Simulate real cloud upload workflow (Cloudinary/S3 style)
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const res = reader.result;
          setAdImages(prev => {
            const next = [...prev, res];
            if (next.length === 1) {
              handleAiAnalyzeImage(res);
            }
            return next;
          });
        }
      };
      reader.readAsDataURL(file as File);
    }
  };

  // Settings states
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone);
  const [profileBio, setProfileBio] = useState(currentUser.bio || "");
  const [profileAvatar, setProfileAvatar] = useState(currentUser.avatar);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Notification Preferences States
  const [priceDropAlerts, setPriceDropAlerts] = useState((currentUser as any).priceDropAlerts !== false);
  const [newAdAlerts, setNewAdAlerts] = useState(!!(currentUser as any).newAdAlerts);
  const [alertCity, setAlertCity] = useState((currentUser as any).alertCity || currentMarket?.cities?.[0]?.id || (currentMarket?.id === 'YE' ? 'sanaa_city' : currentMarket?.cities?.[0]?.id));
  const [favoritedAds, setFavoritedAds] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "settings" && currentUser?.id) {
      const fetchFavs = async () => {
        try {
          const res = await fetch(`/api/users/${currentUser.id}/favorites`);
          if (res.ok) {
            const favIds = await res.json();
            const matchedAds = ads.filter(ad => favIds.includes(ad.id));
            setFavoritedAds(matchedAds);
          }
        } catch (err) {
          console.error("Failed to load favorites for preferences", err);
        }
      };
      fetchFavs();
    }
  }, [activeTab, currentUser?.id, ads]);

  // Review states
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
      // Mock review submission
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: reviewTarget,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
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
        setTimeout(() => {
          setReviewSuccess(false);
          setReviewTarget(null);
          setReviewScore(0);
          setReviewComment("");
        }, 2000);
      }
    } catch (e) {
      console.error("Review failed", e);
    } finally {
      setReviewing(false);
    }
  };

  // My filtered Ads
  const myAds = ads.filter((ad) => ad.userId === currentUser.id);

  // Load chat rooms for Messages and Reviews tab
  useEffect(() => {
    if (activeTab === "messages" || activeTab === "reviews") {
      fetchChatRooms();
    }
  }, [activeTab, ads]);

  // Load chats for selected room
  useEffect(() => {
    if (selectedRoom) {
      fetchActiveChats(selectedRoom.adId, selectedRoom.partnerId);
    }
  }, [selectedRoom]);

  const fetchChatRooms = async () => {
    try {
      // Fetch dynamic users to show real names/avatars in chat rooms
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

        // Group messages by (adId, and other user id) to form rooms
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

          // Sort messages by time
          msgs.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
          const lastMsg = msgs[msgs.length - 1];

          // Lookup in dynamic dynamicUsers first, then INITIAL_USERS
          const foundUser = dynamicUsers.find((u) => u.id === partnerId) || INITIAL_USERS.find((u) => u.id === partnerId);
          const mockUserObj = foundUser || {
            name:
              lastMsg.senderId === currentUser.id
                ? `تاجر في أسواق ${currentMarket.labelAr}`
                : "رقم مجهول",
            avatar:
              `https://ui-avatars.com/api/?name=${lastMsg.senderId === currentUser.id ? 'تاجر' : 'مجهول'}&background=random`,
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
                ? adObj.images[0]
                : "https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80",
            lastText: lastMsg.text,
            lastTime: lastMsg.timestamp,
            allMessages: msgs,
          });
        }

        // Sort rooms by latest message time
        groupedRooms.sort(
          (a, b) =>
            new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime(),
        );
        setChatRooms(groupedRooms);

        if (groupedRooms.length > 0 && !selectedRoom) {
          setSelectedRoom(groupedRooms[0]);
        }
      }
    } catch (e) {
      console.error("Error fetching chat rooms", e);
    }
  };

  const fetchActiveChats = async (adId: string, partnerId: string) => {
    try {
      const response = await fetch("/api/messages");
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data: ChatMessage[] = await response.json();
        // Filter messages between currentUser and partner for specific adId
        const filtered = data.filter((msg) => {
          const matchAd = msg.adId === adId;
          const matchUsers =
            (msg.senderId === currentUser.id && msg.receiverId === partnerId) ||
            (msg.senderId === partnerId && msg.receiverId === currentUser.id);
          return matchAd && matchUsers;
        });

        // Sort ascending
        filtered.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        setActiveChats(filtered);
      }
    } catch (err) {
      console.error("Error loading chats", err);
    }
  };

  // Enhance ad via Gemini API
  const handleEnhanceAdDescription = async () => {
    if (!title) {
      if (addToast) addToast("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليقوم النظام بصياغة وتحسين الوصف التسويقي تلقائياً.", "info");
      return;
    }

    setEnhancing(true);
    try {
      const response = await fetch("/api/ai/enhance-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          rawDescription: description,
          category,
          city,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.enhancedText) {
          setDescription(data.enhancedText);
        }
      } else {
        console.error("Failed to enhance - non-JSON or error", response.status);
      }
    } catch (e) {
      console.error("Error enhancing ad description", e);
    } finally {
      setEnhancing(false);
    }
  };

  // Suggest price via Gemini API
  const handleSuggestPrice = async () => {
    if (!title) {
      if (addToast) {
        addToast("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليتمكن الذكاء الاصطناعي من تقدير السعر واقتراحه.", "info");
      }
      return;
    }
    setSuggestingPrice(true);
    try {
      const response = await fetch("/api/ai/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          currency,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestedPrice !== undefined && data.suggestedPrice !== null) {
          setPrice(data.suggestedPrice.toString());
        }
      } else {
        console.error("Failed to suggest price", response.status);
      }
    } catch (e) {
      console.error("Error suggesting price", e);
    } finally {
      setSuggestingPrice(false);
    }
  };

  const handleAiSuggestCategory = async () => {
    if (!title) {
      if (addToast) addToast("تنبيه", "يرجى كتابة عنوان الإعلان أولاً ليتمكن الذكاء الاصطناعي من اقتراح القسم المناسب.", "info");
      return;
    }
    setClassifying(true);
    try {
      const response = await fetch("/api/ai/classify-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.categoryId && categories.some(c => c.id === data.categoryId)) {
          setCategory(data.categoryId);
        }
      }
    } catch (e) {
      console.error("Classification failed", e);
    } finally {
      setClassifying(false);
    }
  };

  // Submit ad
  const handleCreateAdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || price === "" || (showPhone && !contactNumber)) {
      if (addToast) {
        addToast("خطأ في الإدخال", "يرجى تعبئة جميع الحقول المطلوبة: العنوان، الوصف، السعر، ورقم التواصل.", "error");
      }
      return;
    }

    setCreating(true);
    const imageList = adImages.map(img => ({ url: img.trim() })).filter(img => img.url !== "");

    const finalCategory =
      category === "other" && customCategoryName.trim()
        ? customCategoryName.trim()
        : category;

    const body = {
      title,
      description,
      price: Number(price),
      currency,
      city,
      district,
      category: finalCategory,
      subCategory,
      images: imageList,
      contactNumber: showPhone ? contactNumber : null,
      status: adStatus,
      showOnMap,
      latitude: latitude !== null ? latitude : undefined,
      longitude: longitude !== null ? longitude : undefined,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userVerified: currentUser.verified,
      videoUrl: videoUrl.trim() || undefined,
      // Pass category specific details if applicable
      ...(finalCategory === "realestate"
        ? {
            rooms,
            propertyType: propertyType as any,
            amenities,
          }
        : {}),
      ...(finalCategory === "cars"
        ? {
            make,
            modelYear: Number(modelYear),
            transmission: transmission as any,
            fuelType: fuelType as any,
          }
        : {}),
      ...(["electronics", "phones", "laptops"].includes(finalCategory)
        ? {
            condition: condition as any,
            brand,
          }
        : {}),
      ...(finalCategory === "jobs"
        ? {
            jobType: jobType,
          }
        : {}),
    };

    try {
      const url = editingAdId ? `/api/ads/${editingAdId}` : "/api/ads";
      const method = editingAdId ? "PUT" : "POST";

      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const savedAdData = await response.json();
        const finalAd = savedAdData.ad || savedAdData;
        if (editingAdId) {
          if (onAdUpdated) {
            onAdUpdated(finalAd);
          }
        } else {
          onAdCreated(finalAd);
        }
        setCreationSuccess(true);
        // Clear forms
        setTitle("");
        setDescription("");
        setPrice("");
        setAdStatus("active");
        setAdImages([]);
        setVideoUrl("");
        setShowPhone(true);
        setCustomCategoryName("");
        setSubCategory("");
        setDistrict("");
        setLatitude(null);
        setLongitude(null);
        setEditingAdId(null);
        setTimeout(() => {
          setCreationSuccess(false);
          onTabChange("my-ads");
        }, 1500);
      } else {
        const responseText = await response.text();
        let errorMsg = "خطأ غير معروف";
        try {
          const err = JSON.parse(responseText);
          if (err.details && Array.isArray(err.details)) {
            errorMsg = err.details.join(" | ");
          } else {
            errorMsg = err.error || errorMsg;
          }
        } catch {
          errorMsg = `خطأ في الخادم (Status: ${response.status})`;
        }
        if (addToast) {
          addToast("خطأ", editingAdId ? `فشل تحديث الإعلان: ${errorMsg}` : `فشل نشر الإعلان: ${errorMsg}`, "error");
        }
      }
    } catch (e) {
      console.error("Error saving ad", e);
      if (addToast) {
        addToast("خطأ", "حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة لاحقاً", "error");
      }
    } finally {
      setCreating(false);
    }
  };

  // Replying in Messages hubs
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

  // Delete Reel
  const handleDeleteReel = async (reelId: string) => {
    if (!window.confirm(isRtl ? "هل أنت متأكد من حذف هذا المقطع الترويجي نهائياً؟" : "Are you sure you want to permanently delete this promo?")) return;
    try {
      const res = await fetch(`/api/promo/${reelId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setUserReels(prev => prev.filter(r => r.id !== reelId));
        if (addToast) {
          addToast(
            isRtl ? "نجاح" : "Success",
            isRtl ? "تم حذف المقطع الترويجي بنجاح." : "Promo clip deleted successfully.",
            "success"
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(isRtl ? `فشل الحذف: ${err.error || ''}` : `Failed to delete: ${err.error || ''}`);
      }
    } catch (e) {
      console.error(e);
      alert(isRtl ? "حدث خطأ أثناء الاتصال بالخادم" : "Server connection error occurred");
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    currentUser.name = profileName;
    currentUser.phone = profilePhone;
    currentUser.bio = profileBio;
    currentUser.avatar = profileAvatar;
    
    // Persist internally
    (currentUser as any).priceDropAlerts = priceDropAlerts;
    (currentUser as any).newAdAlerts = newAdAlerts;
    (currentUser as any).alertCity = alertCity;
    
    setSettingsSaved(true);

    try {
      const storedToken = localStorage.getItem('aswaq_access_token');
      // Sync on backend using the real PUT /api/v1/users/:id endpoint!
      const res = await fetch(`${API_BASE_URL}/v1/users/${currentUser.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${storedToken || ''}`
        },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone || null,
          bio: profileBio || null,
          avatar: profileAvatar || null,
        }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        const mergedUser = { ...currentUser, ...updatedUser };
        localStorage.setItem('aswaq_current_user', JSON.stringify(mergedUser));
        console.log('[Dashboard] Profile synced successfully:', mergedUser);
      } else {
        console.error('[Dashboard] Failed to sync profile. Status:', res.status);
      }
    } catch (err) {
      console.error("Failed to sync settings on backend", err);
    }

    setTimeout(() => {
      setSettingsSaved(false);
    }, 2000);
  };

  const formatPrice = (num?: number) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };


  const INITIAL_USERS = [
    {
      id: "user_1",
      name: "أبو أحمد الهمداني",
      avatar: "",
    },
    {
      id: "user_2",
      name: "مجموعة المريسي العقارية",
      avatar: "",
    },
    {
      id: "user_3",
      name: "سالم الحضرمي",
      avatar: "",
    },
    {
      id: "user_admin_mock",
      name: "المدير العام للمنصة",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
    },
  ];

  const isGuest = currentUser.id === 'guest_user';

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 md:pb-10 text-right dir-rtl transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Title block */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-4">
          <Avatar
            src={currentUser.avatar}
            name={currentUser.name}
            sizeClassName="w-14 h-14"
            className="ring-2 ring-emerald-500/30"
          />
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h2 className={`text-2xl font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isGuest ? (isRtl ? 'نشر إعلان كزائر' : 'Post as Guest') : t('dashboard.title')}
              {!isGuest && currentUser.verified && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
              )}
            </h2>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-500'} text-xs mt-1`}>
              {isGuest ? (isRtl ? 'يمكنك نشر إعلانك الآن والوصول لآلاف المشترين فوراً' : 'Publish your ad now and reach thousands of buyers instantly') : t('dashboard.subtitle')}
            </p>
          </div>
        </div>

        {/* Return to Home Button in Header */}
        <button
          onClick={() => onTabChange("home")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 shrink-0 ${
            isDark 
              ? 'bg-slate-800 hover:bg-slate-750 text-slate-100 border-slate-700 hover:text-emerald-400' 
              : 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-100'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>{isRtl ? "العودة للرئيسية" : "Return to Home"}</span>
        </button>
      </div>

      {/* Dashboard quick navigation handles - Optimized for horizontal scrolling on mobile viewports */}
        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border transition-all duration-300 overflow-x-auto max-w-full scrollbar-none whitespace-nowrap select-none ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/60 shadow-sm'}`}>
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
            {t('dashboard.createAd')}
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
                {t('dashboard.myAds')}
              </button>
              <button
                onClick={() => onTabChange("messages")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all relative shrink-0 cursor-pointer ${
                  activeTab === "messages"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                {t('dashboard.messages')}
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
                {t('dashboard.reviews')}
              </button>
              <button
                onClick={() => onTabChange("analytics")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                {t('dashboard.analytics')}
              </button>
              <button
                onClick={() => onTabChange("live-clips")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeTab === "live-clips"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                <Video className="w-3.5 h-3.5 ml-1 inline" />
                {isRtl ? 'مقاطع البث' : 'Live Clips'}
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
                {isRtl ? 'بوابة الوظائف والفرص' : 'Job Portal'}
              </button>
              <button
                onClick={() => onTabChange("settings")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                {t('dashboard.settings')}
              </button>
            </>
          )}

          {isGuest && (
            <div className="flex items-center gap-2 px-4 text-[10px] font-bold text-amber-500 bg-amber-500/5 rounded-xl border border-amber-500/20 py-2">
              ⚠️ {isRtl ? 'سجل دخولك لاحقاً لإدارة إعلاناتك' : 'Login later to manage your ads'}
            </div>
          )}
        </div>

      {/* Tab 1: Create Ad Section - Dynamic layout with AI Enhanced Generator */}
      {activeTab === "create-ad" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Fields Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`p-6 sm:p-8 rounded-[32px] border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 shadow-2xl shadow-black/10' : 'bg-white border-slate-200/80 shadow-xl shadow-slate-200/50'}`}>
              <h3 className={`text-xl font-black flex items-center justify-between gap-2 mb-8 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-2xl">
                    <FileText className="text-emerald-500 w-5 h-5" />
                  </div>
                  {editingAdId ? "تعديل تفاصيل الإعلان" : "تفاصيل الإعلان الجديد"}
                </span>
                {editingAdId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAdId(null);
                      setTitle("");
                      setDescription("");
                      setPrice("");
                      setAdStatus("active");
                      setAdImages([]);
                      setVideoUrl("");
                      setShowPhone(true);
                      setCustomCategoryName("");
                      setSubCategory("");
                      setDistrict("");
                      setLatitude(null);
                      setLongitude(null);
                      onTabChange("my-ads");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border group text-[10px] rounded-lg font-bold transition-all shrink-0 cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-emerald-500/10' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'}`}
                  >
                    إلغاء التعديل
                  </button>
                )}
              </h3>

              {/* Stepper progress indicator */}
                  <div className="flex items-center justify-between mb-8 px-2 select-none">
                    {[
                      { step: 1, label: isRtl ? "التفاصيل الأساسية" : "Basic Details" },
                      { step: 2, label: isRtl ? "الصور والوسائط" : "Media Files" },
                      { step: 3, label: isRtl ? "الموقع والاتصال" : "Location & Contact" }
                    ].map((s, idx) => (
                      <React.Fragment key={s.step}>
                        {idx > 0 && (
                          <div className={`flex-grow h-1 mx-2 rounded-full transition-all duration-300 ${adStep >= s.step ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                        )}
                        <div className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => {
                          // Allow user to go backward freely or go forward only if validated
                          if (s.step < adStep) {
                            setAdStep(s.step);
                          } else if (s.step > adStep) {
                            if (adStep === 1 && validateStep(1)) {
                              if (s.step === 3) {
                                // Skip to step 3 is only allowed if we also validate step 2 (optional validation)
                                setAdStep(3);
                              } else {
                                setAdStep(2);
                              }
                            } else if (adStep === 2) {
                              setAdStep(s.step);
                            }
                          }
                        }}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${adStep === s.step ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20' : adStep > s.step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-950 text-slate-500 border border-slate-850'}`}>
                            {s.step}
                          </div>
                          <span className={`text-[9px] font-black tracking-tighter transition-colors duration-300 ${adStep === s.step ? 'text-emerald-400' : 'text-slate-500'}`}>{s.label}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <form onSubmit={handleCreateAdSubmit} className="space-y-6">
                    {adStep === 1 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-300">
                        {/* Title */}
                        <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t('dashboard.adTitle')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={70}
                    placeholder={t('dashboard.adTitlePlaceholder')}
                    className={`w-full h-11 border rounded-xl px-4 outline-none focus:border-emerald-500 text-xs text-right font-bold transition-colors ${isDark ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    id="ad-input-title"
                  />
                </div>

                {/* Description Box with integrated Enhancer button */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {t('dashboard.description')}
                    </label>
                    <button
                      type="button"
                      onClick={handleEnhanceAdDescription}
                      disabled={enhancing || !title}
                      className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 hover:opacity-80 disabled:opacity-50 select-none cursor-pointer"
                    >
                      {enhancing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t('dashboard.enhancing')}
                        </>
                      ) : (
                        <>
                          <Edit className="w-3.5 h-3.5" />
                          💡 {t('dashboard.enhanceDescription')}
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    required
                    placeholder={t('dashboard.descriptionPlaceholder')}
                    className={`w-full border rounded-xl p-4 outline-none focus:border-emerald-500 text-xs text-right leading-relaxed transition-colors ${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    id="ad-input-desc"
                  />
                </div>

                {/* Price and currency Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400">
                        {t('dashboard.price')}
                      </label>
                      <button
                        type="button"
                        onClick={handleSuggestPrice}
                        disabled={suggestingPrice || !title}
                        className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50 select-none cursor-pointer"
                      >
                        {suggestingPrice ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            {t('dashboard.suggesting')}
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3 text-cyan-400" />
                            💡 {t('dashboard.suggestPrice')}
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder={t('dashboard.pricePlaceholder')}
                      className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 outline-none focus:border-emerald-500 text-xs font-bold text-right"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      id="ad-input-price"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">
                      العملة
                    </label>
                    <select
                      className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-emerald-500 text-xs text-right font-medium"
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value)
                      }
                      id="ad-input-currency"
                    >
                      <option value="USD">دولار أمريكي (USD)</option>
                      {currentMarket.currency !== "USD" && (
                        <option value={currentMarket.currency}>
                          {getCurrencyNameAr(currentMarket.currency)} ({currentMarket.currency})
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Category and Subcategory Selector Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400">
                        القسم / الفئة
                      </label>
                      <button
                        type="button"
                        onClick={handleAiSuggestCategory}
                        disabled={classifying || !title}
                        className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 select-none cursor-pointer"
                      >
                        {classifying ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                            جاري تحليل المحتوى...
                          </>
                        ) : (
                          <>
                            <Scan className="w-3 h-3 text-emerald-400" />
                            💡 اقترح الفئة الأنسب
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative" id="ad-input-category">
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className={`w-full h-11 bg-slate-950 border rounded-xl px-4 text-slate-300 outline-none transition-all text-xs text-right font-medium flex items-center justify-between ${isCategoryDropdownOpen ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-800'}`}
                      >
                        <Sliders className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                        <span>{categories.find(c => c.id === category)?.nameAr || "اختر القسم / الفئة..."}</span>
                      </button>

                      {isCategoryDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[1050]" 
                            onClick={() => setIsCategoryDropdownOpen(false)} 
                          />
                          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[1051] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                            <div className="p-2 border-b border-slate-800 bg-slate-950/50">
                              <input
                                type="text"
                                placeholder="بحث عن قسم..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-emerald-500 transition-colors"
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                              <button
                                type="button"
                                onClick={() => {
                                  setCategory("");
                                  setSubCategory("");
                                  setIsCategoryDropdownOpen(false);
                                  setCategorySearch("");
                                }}
                                className="w-full text-right px-3 py-2 text-[11px] text-slate-500 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                اختر القسم / الفئة...
                              </button>
                              {categories
                                .filter(c => c.nameAr.toLowerCase().includes(categorySearch.toLowerCase()))
                                .map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    setCategory(cat.id);
                                    setSubCategory("");
                                    setIsCategoryDropdownOpen(false);
                                    setCategorySearch("");
                                  }}
                                  className={`w-full text-right px-3 py-2 text-[11px] rounded-lg transition-all flex items-center justify-between group ${category === cat.id ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                  {category === cat.id && <Check className="w-3 h-3" />}
                                  <span>{cat.nameAr}</span>
                                </button>
                              ))}
                              {categories.filter(c => c.nameAr.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                                <div className="py-8 text-center">
                                  <div className="text-[10px] text-slate-600 font-medium">لا توجد نتائج بحث مطابقة</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Sub Category Selector from DB OR default fallback */}
                  {(() => {
                    const activeCatObj = categories.find((c) => c.id === category);
                    const currentSubCategories = (activeCatObj?.subCategories && activeCatObj.subCategories.length > 0)
                      ? activeCatObj.subCategories
                      : (SUB_CATEGORIES[category] || []);

                    if (currentSubCategories.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          التصنيف الفرعي
                        </label>
                        <div className="relative" id="ad-input-subcategory">
                          <button
                            type="button"
                            onClick={() => setIsSubCategoryDropdownOpen(!isSubCategoryDropdownOpen)}
                            className={`w-full h-11 bg-slate-950 border rounded-xl px-4 text-slate-300 outline-none transition-all text-xs text-right font-medium flex items-center justify-between ${isSubCategoryDropdownOpen ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-800'}`}
                          >
                            <Sliders className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isSubCategoryDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                            <span>{currentSubCategories.find((s: any) => s.id === subCategory)?.nameAr || "اختر تصنيفاً فرعياً"}</span>
                          </button>

                          {isSubCategoryDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-[1052]" 
                                onClick={() => setIsSubCategoryDropdownOpen(false)} 
                              />
                              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[1053] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                                <div className="p-2 border-b border-slate-800 bg-slate-950/50">
                                  <input
                                    type="text"
                                    placeholder="بحث عن تصنيف فرعي..."
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] text-right outline-none focus:border-emerald-500 transition-colors"
                                    value={subCategorySearch}
                                    onChange={(e) => setSubCategorySearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="max-h-[180px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubCategory("");
                                      setIsSubCategoryDropdownOpen(false);
                                      setSubCategorySearch("");
                                    }}
                                    className="w-full text-right px-3 py-2 text-[11px] text-slate-500 hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    إلغاء التحديد
                                  </button>
                                  {currentSubCategories
                                    .filter((s: any) => s.nameAr.toLowerCase().includes(subCategorySearch.toLowerCase()))
                                    .map((sub: any) => (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => {
                                        setSubCategory(sub.id);
                                        setIsSubCategoryDropdownOpen(false);
                                        setSubCategorySearch("");
                                      }}
                                      className={`w-full text-right px-3 py-2 text-[11px] rounded-lg transition-all flex items-center justify-between group ${subCategory === sub.id ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                                    >
                                      {subCategory === sub.id && <Check className="w-3 h-3" />}
                                      <span>{sub.nameAr}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {category === "other" && (
                  <div className="space-y-1.5 mt-2 bg-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>✏️ اكتب اسم القسم المخصص الجديد:</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: خناجر وعقيق يماني، مستلزمات طبية، أدوات طاقة شمسية..."
                      className="w-full h-11 bg-slate-950 border border-emerald-500/30 focus:border-emerald-400 rounded-xl px-4 text-slate-200 outline-none text-xs text-right font-medium"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-slate-500">
                      سيتم تصنيف إعلانك مباشرة تحت هذا القسم المخصص وعرضه
                      للزوار.
                    </p>
                  </div>
                )}

                {/* Real Estate Specific Advanced Form Fields */}
                {category === "realestate" && (
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl space-y-6">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black text-white">
                        تفاصيل العقار المتقدمة
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Real Estate Property Type */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          نوع العقار
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "villa", label: "فيلا" },
                            { id: "apartment", label: "شقة" },
                            { id: "land", label: "أرض / مقسم" },
                            { id: "building", label: "عمارة / بيت" },
                            { id: "commercial", label: "تجاري" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setPropertyType(item.id)}
                              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${propertyType === item.id ? "bg-emerald-500 text-slate-950 border-emerald-500" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rooms Counter */}
                      {propertyType !== "land" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400">
                            عدد الغرف
                          </label>
                          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-1.5 w-max">
                            <button
                              type="button"
                              onClick={() => setRooms(Math.max(0, rooms - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-850 flex items-center justify-center text-slate-300 hover:text-white"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-white">
                              {rooms}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRooms(rooms + 1)}
                              className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 hover:bg-emerald-400 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Amenities Checklist */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400">
                        الخدمات الأساسية المتوفرة
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {[
                          { id: "water", label: "مشروع مياه" },
                          { id: "electricity", label: "كهرباء" },
                          { id: "solar", label: "طاقة شمسية" },
                          { id: "well", label: "بئر / خزان" },
                          { id: "fiber", label: "إنترنت فايبر" },
                          { id: "parking", label: "موقف سيارات" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setAmenities((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((i) => i !== item.id)
                                  : [...prev, item.id],
                              );
                            }}
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${amenities.includes(item.id) ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-500"}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cars Specific Advanced Form Fields */}
                {category === "cars" && (
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl space-y-6">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-yellow-400" />
                      <h4 className="text-xs font-black text-white">
                        تفاصيل السيارة المتقدمة
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          ماركة السيارة
                        </label>
                        <select
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-yellow-500 text-xs text-right"
                          value={make}
                          onChange={(e) => setMake(e.target.value)}
                        >
                          <option value="">اختر الماركة...</option>
                          {[
                            "تويوتا",
                            "لكزس",
                            "نيسان",
                            "كيا",
                            "هيونداي",
                            "فورد",
                            "مرسيدس",
                            "هوندا",
                          ].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          سنة الصنع
                        </label>
                        <select
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-yellow-500 text-xs text-right"
                          value={modelYear}
                          onChange={(e) =>
                            setModelYear(
                              e.target.value ? parseInt(e.target.value) : "",
                            )
                          }
                        >
                          <option value="">اختر السنة...</option>
                          {Array.from({ length: 26 }, (_, i) => 2025 - i).map(
                            (year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          ناقل الحركة
                        </label>
                        <div className="flex gap-2">
                          {[
                            { id: "automatic", label: "تماتيك" },
                            { id: "manual", label: "عادي" },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setTransmission(t.id)}
                              className={`flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${transmission === t.id ? "bg-yellow-500 text-slate-950 border-yellow-500" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          نوع الوقود
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "gasoline", label: "بترول" },
                            { id: "diesel", label: "ديزل" },
                            { id: "hybrid", label: "هايبرد" },
                            { id: "solar", label: "طاقة شمسية" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFuelType(f.id)}
                              className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${fuelType === f.id ? "bg-yellow-500/10 border-yellow-500 text-yellow-400" : "bg-slate-900 border-slate-800 text-slate-500"}`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Electronics Specific Advanced Form Fields */}
                {["electronics", "phones", "laptops"].includes(category) && (
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl space-y-6">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-black text-white">
                        تفاصيل الجهاز المتقدمة
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          حالة الجهاز
                        </label>
                        <select
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-blue-500 text-xs text-right"
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                        >
                          {[
                            { id: "new", label: "جديد (كرت)" },
                            { id: "used_mint", label: "مستخدم (نظيف جداً)" },
                            { id: "used_good", label: "مستخدم (شبه جديد)" },
                            { id: "used_fair", label: "مستخدم (بحالة جيدة)" },
                          ].map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          الماركة / الشركة
                        </label>
                        <input
                          type="text"
                          placeholder="مثلاً: Apple, Samsung, Sony..."
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 outline-none focus:border-blue-500 text-xs text-right"
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Jobs Specific Advanced Form Fields */}
                {category === "jobs" && (
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl space-y-6">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-black text-white">
                        نوع الإعلان الوظيفي
                      </h4>
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setJobType("hiring")}
                        className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl text-xs font-bold transition-all border ${jobType === "hiring" ? "bg-purple-500/10 border-purple-500 text-purple-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                      >
                        <span className="text-xl">🏢</span>
                        <span>أصحاب العمل (مطلوب موظف/توظيف)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setJobType("seeking")}
                        className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl text-xs font-bold transition-all border ${jobType === "seeking" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                      >
                        <span className="text-xl">👨‍💻</span>
                        <span>سيرة ذاتية (أبحث عن عمل)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Selection (Active / Sold / Expired) */}
                <div className={`p-6 sm:p-8 rounded-3xl border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center gap-2 mb-6">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <h3 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      حالة الإعلان الحالية
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "active", label: "نشط", color: "emerald" },
                      { id: "sold", label: "مباع", color: "rose" },
                      { id: "expired", label: "منتهي", color: "slate" },
                    ].map((status) => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setAdStatus(status.id as any)}
                        className={`py-4 rounded-2xl text-xs font-black transition-all border flex flex-col items-center justify-center gap-2 cursor-pointer ${
                          adStatus === status.id
                            ? status.id === "active"
                              ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                              : status.id === "sold"
                                ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-500/20"
                                : "bg-slate-700 text-white border-slate-600 shadow-lg shadow-slate-900/40"
                            : isDark ? "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-500/50"
                        }`}
                      >
                        <span className="text-[12px]">{status.label}</span>
                        {adStatus === status.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 1 navigation buttons */}
                <div className="flex justify-end pt-6 border-t border-slate-800/40">
                        <button
                          type="button"
                          onClick={() => {
                            if (validateStep(1)) setAdStep(2);
                          }}
                          className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-550 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                        >
                          <span>الخطوة التالية (الصور والوسائط) ➡️</span>
                        </button>
                      </div>
                    </div>
                  )}

                    {adStep === 2 && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                        {/* Media Upload Section */}
                <div className={`p-6 sm:p-8 rounded-3xl border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className={`text-lg font-black flex items-center gap-2 mb-6 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Camera className="text-emerald-500 w-5 h-5" />
                    صور وفيديو العرض (بحد أقصى 5)
                  </h3>
                  
                  {/* Adaptive Multi-Image Upload */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {adImages.map((img, idx) => (
                      <div key={idx} className={`relative group rounded-2xl aspect-square overflow-hidden border-2 flex items-center justify-center transition-all ${isDark ? 'bg-slate-950 border-slate-800 shadow-xl shadow-black/20' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
                         <img src={img} alt={`Ad img ${idx}`} className="w-full h-full object-cover" />
                         {idx === 0 && (
                            <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wider">الرئيسية</div>
                         )}
                         <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[1px]">
                            <button
                               type="button"
                               onClick={() => setAdImages(prev => prev.filter((_, i) => i !== idx))}
                               className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-[10px] font-black shadow-lg transition-transform active:scale-95 border-none"
                            >
                                حذف ❌
                            </button>
                         </div>
                      </div>
                    ))}
                    
                    {adImages.length < 5 && (
                      <label className={`relative group rounded-2xl border-2 border-dashed p-4 transition-all flex flex-col items-center justify-center text-center aspect-square cursor-pointer min-h-[140px] ${isDark ? 'border-slate-800 bg-slate-950 hover:border-emerald-500/50' : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50/50'}`}>
                         <Camera className={`w-8 h-8 mb-2 transition-colors ${isDark ? 'text-slate-500 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                         <span className={`text-[11px] font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>أضف صورة</span>
                         <span className="text-[9px] text-slate-500 mt-1">({adImages.length}/5)</span>
                         <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleLocalImageUpload}
                            className="hidden"
                         />
                      </label>
                    )}
                  </div>
                </div>

                {/* Video Promo (Spotlight Video Upload & TikTok option) */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 mt-4 text-right">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Video className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-200">ترويج إعلانك بفيديو واقعي (Spotlight)</label>
                          <p className="text-[10px] text-slate-500 mt-0.5">صوّر بفيديو حيّ لزيادة مصداقية السلعة وسرعة البيع وضمان درع الأمان</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        disabled={uploadingVideo}
                        onClick={() => setShowVideoRecorder(true)}
                        className="bg-gradient-to-l from-red-650 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white text-[10px] font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer self-start sm:self-auto"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>{uploadingVideo ? "جاري الرفع والمعالجة..." : "تصوير فيديو حقيقي مباشر 🎥"}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="ضع هنا رابط الفيديو (يوتيوب/تيك توك) أو صوّر فيديو واقعياً..."
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:border-red-500 outline-none text-white transition-all pl-12"
                      />
                      {uploadingVideo && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-xl text-[9px] font-bold">
                          <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin shrink-0"></span>
                          <span>جاري الرفع: {videoProgress}%</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (videoUploadXhr) {
                                videoUploadXhr.abort();
                              }
                            }}
                            className="bg-red-500 hover:bg-red-650 text-white px-1.5 py-0.5 rounded text-[8px] font-black cursor-pointer transition-colors"
                          >
                            إلغاء ❌
                          </button>
                        </div>
                      )}
                      {!uploadingVideo && videoUrl && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold">
                          <Check className="w-2.5 h-2.5" />
                          جاهز وموثّق
                        </div>
                      )}
                    </div>
                  </div>

                  {showVideoRecorder && (
                    <VideoRecorder 
                      onCapture={async (blob) => {
                        // Reject files larger than 150MB
                        if (blob.size > 150 * 1024 * 1024) {
                          if (addToast) {
                            addToast("الملف كبير جداً ⚠️", "الحد الأقصى المسموح به للفيديوهات هو 150 ميجابايت.", "error");
                          }
                          return;
                        }

                        setUploadingVideo(true);
                        setVideoProgress(0);
                        setShowVideoRecorder(false);
                        
                        const formData = new FormData();
                        const file = new File([blob], `recorded-${Date.now()}.webm`, { type: "video/webm" });
                        formData.append("file", file);
                        
                        const uploadXhr = uploadFileWithProgress({
                          url: "/api/storage/upload",
                          formData,
                          onProgress: (percent) => {
                            setVideoProgress(percent);
                          },
                          onSuccess: (data) => {
                            if (data && (data.success || data.url)) {
                              setVideoUrl(data.url);
                              if (addToast) addToast("تم الرفع بنجاح ✅", "تم رفع ومعالجة الفيديو بنجاح.", "success");
                            } else {
                              const url = URL.createObjectURL(blob);
                              setVideoUrl(url);
                            }
                            setUploadingVideo(false);
                            setVideoUploadXhr(null);
                          },
                          onError: (err) => {
                            console.error("Video upload failed, falling back to local blob URL", err);
                            const url = URL.createObjectURL(blob);
                            setVideoUrl(url);
                            if (addToast) {
                              addToast("فشل الرفع ⚠️", "حدث خطأ أثناء رفع الفيديو للشبكة، تم الحفظ محلياً كمسودة.", "error");
                            }
                            setUploadingVideo(false);
                            setVideoUploadXhr(null);
                          },
                          onAbort: () => {
                            if (addToast) {
                              addToast("تم إلغاء الرفع ❌", "تم إلغاء رفع ملف الفيديو بطلب من المستخدم.", "info");
                            }
                            setUploadingVideo(false);
                            setVideoUploadXhr(null);
                          }
                        });

                        setVideoUploadXhr(uploadXhr);
                      }}
                      onClose={() => setShowVideoRecorder(false)}
                    />
                  )}


                  {/* Backup field to enter URL manual option */}
                  <div className="pt-2">
                    <p className="text-[10px] text-slate-400 font-bold mb-1.5">
                      أو قم بلصق روابط إنترنت مباشرة للصور إضافية:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="أو اكتب رابط الصورة يدوياً واضغط إضافة..."
                        className="flex-1 h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-slate-300 text-[10px] outline-none text-right placeholder-slate-650"
                        id="manual-image-url"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("manual-image-url") as HTMLInputElement;
                          if (input?.value?.trim()) {
                            if (adImages.length >= 5) {
                               if (addToast) addToast("خطأ", "الحد الأقصى للصور هو 5 صور", "error");
                               return;
                            }
                            setAdImages(prev => {
                               const next = [...prev, input.value.trim()];
                               if (next.length === 1) handleAiAnalyzeImage(input.value.trim());
                               return next;
                            });
                            input.value = "";
                          }
                        }}
                      >إضافة</button>
                    </div>
                  </div>

                  {/* Step 2 navigation buttons */}
                  <div className="flex justify-between items-center pt-6 border-t border-slate-800/40">
                          <button
                            type="button"
                            onClick={() => setAdStep(1)}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-slate-700"
                          >
                            <span>⬅️ السابق</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdStep(3)}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-550 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                          >
                            <span>الخطوة التالية (الموقع والاتصال) ➡️</span>
                          </button>
                        </div>
                      </div>
                    )}

                {adStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
                    {/* Geolocation selector: City & District Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          مدينة العرض
                        </label>
                        <select
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-emerald-500 text-xs text-right font-medium"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setDistrict("");
                          }}
                          id="ad-input-city"
                        >
                          {((currentMarket && currentMarket.cities) || CITIES).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">
                          المنطقة (المديرية)
                        </label>
                        <select
                          className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-300 outline-none focus:border-emerald-500 text-xs text-right font-medium"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          id="ad-input-district"
                        >
                          <option value="">كل المناطق</option>
                          {DISTRICTS.filter((d: any) => d.cityId === city).map(
                            (d: any) => (
                              <option key={d.id} value={d.id}>
                                {d.nameAr}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Toggle Phone Visibility */}
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl mt-6">
                  <span className="text-xs font-bold text-slate-300">
                    إظهار رقم الهاتف للتواصل المباشر (واتساب واتصال)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPhone(!showPhone)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 transition-all ${
                      showPhone ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </button>
                </div>

                {/* Contact phone number override */}
                {showPhone && (
                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs font-bold text-slate-400">
                      رقم التواصل المباشر للإعلان
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 outline-none focus:border-emerald-500 text-xs font-mono text-right"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      id="ad-input-phone"
                    />
                  </div>
                )}

                {/* Toggle Map Visibility */}
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl mt-6">
                  <span className="text-xs font-bold text-slate-300">
                    ظهور الإعلان على الخريطة
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOnMap(!showOnMap)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 transition-all ${
                      showOnMap ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  </button>
                </div>

                {showOnMap && (
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-xs font-bold text-slate-300">📍 تحديد موقعي الدقيق بالـ GPS</span>
                        <span className="text-[10px] text-slate-500">لإظهار موقع هذا المنتج أو الخدمة بدقة متناهية على الخريطة للمشترين</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.geolocation) {
                            setFetchingGps(true);
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                setLatitude(lat);
                                setLongitude(lng);
                                setFetchingGps(false);
                                if ((window as any)._createAdMinimap) {
                                  const { map, marker } = (window as any)._createAdMinimap;
                                  map.setView([lat, lng], 14, { animate: true });
                                  marker.setLatLng([lat, lng]);
                                }
                              },
                              (error) => {
                                console.error(error);
                                if (addToast) addToast("خطأ", "عذراً، فشل تحديد موقعك الجغرافي. تأكد من إعطاء إذن الوصول للمتصفح.", "error");
                                setFetchingGps(false);
                              },
                              { enableHighAccuracy: true, timeout: 6000 }
                            );
                          } else {
                            if (addToast) addToast("خطأ", "المتصفح لا يدعم تحديد الموقع الجغرافي.", "error");
                          }
                        }}
                        disabled={fetchingGps}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs rounded-lg font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {fetchingGps ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            جاري التحديد...
                          </>
                        ) : latitude !== null && longitude !== null ? (
                          "تحديث الموقع الحالي 🔄"
                        ) : (
                          "الحصول على موقعي 📍"
                        )}
                      </button>
                    </div>

                    {latitude !== null && longitude !== null ? (
                      <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2.5 border border-emerald-500/20">
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            تم التقاط موقعك الحالي بنجاح
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            خط العرض: {latitude.toFixed(6)} • خط الطول: {longitude.toFixed(6)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLatitude(null);
                            setLongitude(null);
                            if ((window as any)._createAdMinimap) {
                              const { map, marker } = (window as any)._createAdMinimap;
                              const cityCenter = currentMarket.cityCoordinates[city] || currentMarket.center;
                              map.setView([cityCenter.lat, cityCenter.lng], 13, { animate: true });
                              marker.setLatLng([cityCenter.lat, cityCenter.lng]);
                            }
                          }}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 font-medium text-right">
                        ⚠️ إذا لم تقم بتحديد موقعك بالـ GPS، فسيظهر إعلانك تلقائياً متمركزاً حول وسط المدينة المحددة في الإعلان.
                      </div>
                    )}

                    {/* Draggable Minimap Stage */}
                    <div className="relative mt-2">
                      <div id="create-ad-minimap" className="w-full h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner z-[50]"></div>
                      <div className="absolute top-2 right-2 p-1.5 bg-slate-950/90 rounded-lg text-[9px] font-black text-slate-400 z-[60] border border-slate-800">
                        🗺️ اسحب الدبوس لتحديد الموقع الفعلي الدقيق في {currentMarket.cityCoordinates[city]?.ar || "المدينة المختارة"}
                      </div>
                    </div>
                  </div>
                )}

                    </div>
                  )}

                  {/* Submit bar / Step 3 Actions */}
                  {adStep === 3 && (
                    <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800/40">
                      <button
                        type="button"
                        onClick={() => setAdStep(2)}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-slate-700 w-1/3"
                      >
                        ⬅️ السابق
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="flex-grow flex items-center justify-center gap-2 bg-gradient-to-l from-emerald-500 to-cyan-500 text-slate-950 font-black h-12 rounded-xl text-sm transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                        id="ad-create-submit"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {editingAdId
                              ? "جاري تحديث وحفظ الإعلان..."
                              : `جاري نشر وإدراج الإعلان في أسواق ${currentMarket.labelAr}...`}
                          </>
                        ) : (
                          <>
                            {editingAdId ? (
                              <>
                                <Check className="w-4 h-4" />
                                تحديث وحفظ الإعلان
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                انشر الإعلان الآن مجاناً
                              </>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {creationSuccess && (
                    <div className="p-3 text-center bg-emerald-950 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                      {editingAdId
                        ? "🎉 تم تحديث وحفظ إعلانك بنجاح وجارٍ إرجاعك!"
                        : "🎉 تم إدراج ونشر إعلانك وحفظه في ملفك الشخصي بنجاح!"}
                    </div>
                  )}
                </form>
              </div>
            </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-6">
            <div className={`p-6 rounded-3xl border transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/60 shadow-sm'}`}>
              <h4 className={`text-sm font-black mb-4 flex items-center gap-1.5 leading-none ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                <FileText className="text-emerald-400 w-4 h-4" />
                تحسين وتنسيق الأوصاف تلقائياً
              </h4>
              <p className={`text-xs leading-relaxed text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                لا داعي للقلق بشأن صياغة مواصفات معقدة أو تنسيق مميزات المنتج!
                اكتب عنواناً واضحاً ومختصراً مثل{" "}
                <span className={isDark ? 'text-white' : 'text-slate-900 font-bold'}>"أيفون 14 بحالة ممتازة"</span>{" "}
                وانقر على زر الصياغة والتنسيق الفاخر بالأعلى.
                <br />
                <br />
                سيقوم النظام الرقمي المدمج بدراسة المكتوب وإدارج نقاط المواصفات
                الجذابة والوسوم الملائمة تلقائياً لتهيئة إعلانك للبيع والوصول
                للمشترين باحترافية وسرعة بالغة!
              </p>
            </div>

            <div className={`p-6 rounded-3xl border text-right space-y-3 transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/60 shadow-sm'}`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                نصائح لإعلان جذاب
              </h4>
              <ul className={`text-[11px] space-y-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span>
                    ضع سعراً واقعياً وقابلاً للتفاوض البسيط لتلقي اتصالات مهتمة
                    بكثرة.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span>
                    ارفع صوراً حقيقية ونظيفة للمنتج في إضاءة جيدة لجذب المشترين.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span>
                    حدد المدينة الصحيحة لتسهيل التواصل والمعاينة المباشرة
                    والشحن.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: My Ads Section - Management list */}
      {activeTab === "my-ads" && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`${isDark ? 'text-slate-100' : 'text-slate-900'} text-lg font-bold`}>
              إعلاناتي التي نشرتها في أسواق {currentMarket.labelAr}
            </h3>
            <button
              onClick={() => onTabChange("create-ad")}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-200"
            >
              <Plus className="w-4 h-4" />
              إعلان جديد
            </button>
          </div>

          {myAds.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/30">
              <p className="text-sm text-slate-500">
                لم تقم بنشر أي إعلانات حتى الآن في المنصة.
              </p>
              <button
                onClick={() => onTabChange("create-ad")}
                className="mt-4 bg-emerald-500 hover:bg-emerald-450 font-bold text-slate-950 text-xs px-6 py-2.5 rounded-xl transition-all"
              >
                انشر أول إعلان لك مجاناً
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myAds.map((ad) => {
                const cityObj = CITIES.find((c) => c.id === ad.city);
                const cityName = cityObj ? cityObj.nameAr : ad.city;

                const relativeDateString = (dateStr: string) => {
                  const elapsed = Date.now() - new Date(dateStr).getTime();
                  const minutes = Math.floor(elapsed / 60000);
                  const hours = Math.floor(minutes / 60);
                  const days = Math.floor(hours / 24);

                  if (days > 0) {
                    if (days === 1) return 'منذ يوم';
                    if (days === 2) return 'منذ يومين';
                    if (days >= 3 && days <= 10) return `منذ ${days} أيام`;
                    return `منذ ${days} يوم`;
                  }
                  if (hours > 0) {
                    if (hours === 1) return 'منذ ساعة';
                    if (hours === 2) return 'منذ ساعتين';
                    if (hours >= 3 && hours <= 10) return `منذ ${hours} ساعات`;
                    return `منذ ${hours} ساعة`;
                  }
                  if (minutes > 0) {
                    if (minutes === 1) return 'منذ دقيقة';
                    if (minutes === 2) return 'منذ دقيقتين';
                    return `منذ ${minutes} دقيقة`;
                  }
                  return 'الآن';
                };

                const currentTrendData = ad.viewTrend || (() => {
                  const seed = ad.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  const data = [];
                  const daysShort = ['أحد', 'اثن', 'ثلا', 'أرب', 'خميس', 'جمعة', 'سبت'];
                  for (let i = 6; i >= 0; i--) {
                    const val = Math.floor(Math.abs(Math.sin(seed + i)) * 15) + (i * 2) + Math.floor(ad.views / 20);
                    data.push({ day: daysShort[i], views: val });
                  }
                  return data;
                })();

                return (
                  <div
                    key={ad.id}
                    className={`p-5 rounded-2xl flex flex-col justify-between transition-all text-right group relative border ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-slate-200/50'}`}
                    id={`my-ad-item-${ad.id}`}
                  >
                    <div>
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                        <img
                          src={
                            (ad.images?.[0] && typeof ad.images[0] === 'object'
                              ? (ad.images[0] as any).url
                              : (ad.images?.[0] as string)) ||
                            "https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=400&q=80"
                          }
                          alt={ad.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />

                        {/* Status Badge Overlay */}
                        {(ad.status === "sold" || ad.status === "expired") && (
                          <div className={`absolute top-2 right-2 z-10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg shadow-black/20 flex items-center gap-1.5
                            ${ad.status === "sold" ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${ad.status === "sold" ? "bg-rose-500" : "bg-amber-500"}`} />
                            {ad.status === "sold" ? "تـم الـبـيـع" : "مـنـتـهـي"}
                          </div>
                        )}

                        {/* Mini Views Overlay Chart */}
                        <div className="absolute top-2 left-2 w-20 h-10 bg-slate-950/60 backdrop-blur-md rounded-lg border border-white/10 p-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={currentTrendData}>
                                 <Line 
                                    type="monotone" 
                                    dataKey="views" 
                                    stroke="#10b981" 
                                    strokeWidth={2} 
                                    dot={false} 
                                    animationDuration={1500}
                                 />
                              </LineChart>
                           </ResponsiveContainer>
                           <div className="absolute -top-1 -right-1 bg-emerald-500 w-1.5 h-1.5 rounded-full animate-pulse" />
                        </div>
                      </div>

                      <div className="flex items-start justify-between mt-3 gap-3">
                        <h4 className={`text-sm font-bold line-clamp-2 flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {ad.title}
                        </h4>
                        <div className="shrink-0 w-16 h-8 opacity-60">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={currentTrendData}>
                                 <Area 
                                    type="step" 
                                    dataKey="views" 
                                    stroke="#334155" 
                                    fill="#334155" 
                                    fillOpacity={0.2} 
                                    strokeWidth={1}
                                 />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col text-[10px] text-slate-500">
                          <span>المدينة: {cityName}</span>
                          <span className="opacity-80 mt-0.5">{relativeDateString(ad.createdAt)}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full capitalize ${ad.status === "active" ? "bg-emerald-500/15 text-emerald-400" : ad.status === "sold" ? "bg-rose-500/15 text-rose-400" : "bg-slate-800 text-slate-400"}`}
                        >
                          {ad.status === "active"
                            ? "نشط ومستمر"
                            : ad.status === "sold"
                              ? "تمت البيعة"
                              : ad.status === "expired"
                                ? "منتهي"
                                : ad.status}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-850 pt-3 mt-4 flex items-center justify-between">
                      <p className="text-md font-extrabold text-emerald-400">
                        {formatPrice(ad.price)}{" "}
                        <span className="text-[10px]">{ad.currency}</span>
                      </p>

                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => onSelectAd(ad)}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                        >
                          معاينة
                        </button>
                        <button
                          onClick={() => handleStartEditAd(ad)}
                          className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => {
                            setAdToDeleteId(ad.id);
                            setAdToDeleteTitle(ad.title);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg cursor-pointer transition-all"
                          title="حذف الإعلان"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Message Hub - Interactive messaging */}
      {activeTab === "messages" && (
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
                              { hour: "2-digit", minute: "2-digit" },
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
                        // Image handling logic would go here
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
      )}

      {/* Tab 4: Analytics and statistics block */}
      {activeTab === "analytics" && (
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
      )}

      {/* Tab: Reviews Section */}
      {activeTab === "reviews" && (
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
                  لا توجد محادثات سابقة لتقييمها حالياً. تواصل مع البائعين
                  لظهورهم هنا.
                </div>
              ) : (
                <div className="space-y-3">
                  {chatRooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer"
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
                        <div>
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
                            ? "bg-slate-850 text-slate-500 border border-slate-800"
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
                      <label className="text-xs font-bold text-slate-400 block">
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
                      <p className="text-[10px] text-slate-500">
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
                      <label className="text-xs font-bold text-slate-400">
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
                      className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black h-11 rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                      {reviewing
                        ? "جاري حفظ التقييم..."
                        : "إرسال التقييم ونشره"}
                    </button>

                    {reviewSuccess && (
                      <div className="p-3 bg-emerald-950 border border-emerald-500/50 rounded-xl text-center text-emerald-400 text-[10px] font-bold">
                        🎉 شكراً لك! تم حفظ تقييمك للتاجر بنجاح وسيساهم في
                        موثوقية المنصة.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/20 h-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400">
                      بانتظار اختيار تاجر لتقييمه
                    </p>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                      اختر أحد البائعين من القائمة الجانبية لتتمكن من كتابة
                      تقييمك ورأيك في التعامل معه.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Tab: Live Clips Section */}
      {activeTab === "live-clips" && (
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
                          onClick={() => (window as any).setPlatformMode('reels')}
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
      )}

      {/* Tab 5: Settings and credentials update */}
      {activeTab === "settings" && (
        <div className="mt-8 max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800">
          <h3 className="text-lg font-black text-white mb-6">
            إعدادات وبيانات الحساب الشخصي
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">
                الاسم التجاري أو الشخصي
              </label>
              <input
                type="text"
                required
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 text-xs outline-none text-right"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                id="setting-name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">
                رقم الهاتف للتواصل (يفضل واتساب)
              </label>
              <input
                type="text"
                required
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-4 text-slate-200 text-xs outline-none text-right font-mono"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                id="setting-phone"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">
                نبذة تعريفية أو وصف مختصر للمتجر
              </label>
              <textarea
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-xs outline-none text-right placeholder:text-slate-600"
                placeholder="اكتب شيئاً عن مهنتك، مقتنياتك أو ساعات دوام متجرك وتواجدك..."
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                id="setting-bio"
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-400">
                صورة الملف الشخصي
              </label>
              <div className="flex items-center gap-4">
                <img
                  src={profileAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-700"
                />
                <label className="flex-1 cursor-pointer">
                  <div className="h-11 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-200 text-xs font-bold transition-all border border-slate-700">
                    <Camera className="w-4 h-4" />
                    تغيير الصورة
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === "string")
                          setProfileAvatar(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* نظام تفضيلات الإشعارات */}
            <div className="mt-8 pt-6 border-t border-slate-800/60 space-y-4" id="notification-preferences-sec">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-black text-slate-250 text-slate-200">
                  نظام تفضيلات الإشعارات والتنبيهات المخصصة
                </h4>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-4">
                {/* 1. Price drop alert toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1 text-right">
                    <label className="text-xs font-bold text-slate-300 block">
                      تنبيهات انخفاض الأسعار للسلع المتابعة
                    </label>
                    <span className="text-[10px] text-slate-500 block leading-relaxed">
                      الرصد الذكي التلقائي لأسعار السلع والأصول التي تبدي اهتماماً بها أو تضيفها للمفضلة، لتلقي تنبيه فوري فور قيام البائع بتخفيض السعر.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPriceDropAlerts(!priceDropAlerts)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      priceDropAlerts ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                    id="pref-price-toggle"
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-slate-950 shadow-md transform duration-200 ${
                        priceDropAlerts ? "-translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <hr className="border-slate-800/40" />

                {/* 2. New ad alert toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1 text-right">
                    <label className="text-xs font-bold text-slate-300 block">
                      تنبيهات نشر إعلانات جديدة في منطقتك
                    </label>
                    <span className="text-[10px] text-slate-500 block leading-relaxed">
                      متابعة لكافة الإعلانات المضافة حديثاً في المحافظة/المنطقة التي تختارها لتكون أول من يطّلع على الفرص والصفقات الحصرية.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewAdAlerts(!newAdAlerts)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${
                      newAdAlerts ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                    id="pref-area-toggle"
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-slate-950 shadow-md transform duration-200 ${
                        newAdAlerts ? "-translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 2b. Select alert city if active */}
                {newAdAlerts && (
                  <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-800/20 text-right">
                    <label className="text-[10px] font-black text-slate-400">
                      اختر المحافظة أو المنطقة المستهدفة للتنبيهات:
                    </label>
                    <select
                      value={alertCity}
                      onChange={(e) => setAlertCity(e.target.value)}
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 text-slate-300 text-xs outline-none text-right cursor-pointer focus:border-emerald-500/50"
                      id="pref-city-select"
                    >
                      {(currentMarket?.cities || CITIES).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 3. Followed Goods display with visual price labels */}
              <div className="space-y-2 mt-4 text-right">
                <h5 className="text-[11px] font-bold text-slate-400">
                  العقود والسلع التي تتابعها لتغيرات السعر ({favoritedAds.length})
                </h5>

                {favoritedAds.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="tracked-ads-list">
                    {favoritedAds.map((ad) => {
                      let imagesList = [];
                      try {
                        imagesList = typeof ad.images === 'string' ? JSON.parse(ad.images) : ad.images;
                      } catch (e) {
                        imagesList = [];
                      }
                      const adImg = (Array.isArray(imagesList) && imagesList.length > 0) 
                        ? imagesList[0] 
                        : "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=300&q=80";
                      
                      return (
                        <div 
                          key={ad.id} 
                          className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/20 border border-slate-800/40 hover:border-slate-800 transition-all dir-rtl"
                        >
                          <img 
                            src={adImg || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'} 
                            alt={ad.title} 
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-800"
                          />
                          <div className="flex-1 min-w-0 text-right">
                            <h6 className="text-[11px] font-bold text-slate-200 truncate">{ad.title}</h6>
                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                              <span className="text-[10px] font-mono text-emerald-405 text-emerald-400 font-bold">
                                {formatPrice(ad.price)} {ad.currency || 'YER'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                              رصد دائم
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-2xl bg-slate-950/10 border border-slate-800/20 text-slate-500 text-[10px] leading-relaxed">
                    لم تقم بإضافة أي سلعة للمفضلة بعد. عند إعجابك وتفضيلك لأي سلعة، ستظهر هنا تلقائياً لمتابعة السعر.
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-505 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black h-11 rounded-xl text-xs transition-transform active:scale-95 cursor-pointer mt-4"
              id="setting-save-btn"
            >
              حفظ وتثبيت إعدادات الحساب وتفضيلات التنبيهات
            </button>

            {settingsSaved && (
              <div className="p-3 text-center bg-emerald-950 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-bold select-none">
                ✅ تم حفظ تفاصيل وإعدادات حسابك بنجاح!
              </div>
            )}
          </form>

          {/* Golden Trust Verification Section */}
          <div className="mt-8 pt-8 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
              <h4 className="text-sm font-black text-slate-200">
                برنامج توثيق الحسابات والتاجر المضمون
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              توثيق الحساب يزيد من ثقة المشترين في إعلاناتك بمعدل{" "}
              <span className="text-emerald-400 font-bold">5 أضعاف</span> ويمنحك
              شارة التوثيق الملكية الخضراء على المنصة.
            </p>

            {currentUser.verified ? (
              <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-800/40 text-emerald-400 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto animate-bounce fill-emerald-950" />
                <p className="text-xs font-black">
                  تهانينا! حسابك موثق بالكامل وشارتك الخضراء مفعلة بنجاح.
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {isRtl ? `الاسم الموثق: ${currentUser.name}` : `Verified Name: ${currentUser.name}`}
                </p>
              </div>
            ) : (
              <div
                className="p-5 rounded-2xl bg-slate-950/45 border border-slate-850 space-y-4"
                id="kyc-verification-box"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h5 className="text-[11px] font-bold text-slate-200">الخطوة {kycStep}: {kycStep === 1 ? 'تصوير بطاقة الهوية' : 'التحقق من ملامح الوجه'}</h5>
                    <p className="text-[9px] text-slate-500">يرجى وضع {kycStep === 1 ? 'البطاقة الشخصية' : 'وجهك'} بوضوح في الإطار</p>
                  </div>
                  <div className="flex gap-1">
                    <div className={`w-6 h-1 rounded-full ${kycStep === 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                    <div className={`w-6 h-1 rounded-full ${kycStep === 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                  </div>
                </div>

                {kycMode === 'idle' && !kycPhoto && (
                  <div 
                    onClick={startKycCamera}
                    className="aspect-video relative group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900 flex flex-col items-center justify-center gap-3 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300">اضغط لفتح الكاميرا وبدء التحقق</span>
                  </div>
                )}

                {kycMode === 'camera' && (
                  <div className="relative aspect-video rounded-xl bg-black overflow-hidden border border-slate-800">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="w-[80%] h-[70%] border-2 border-emerald-500/30 rounded-xl border-dashed">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                       </div>
                    </div>
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-4">
                      <button
                        type="button"
                        onClick={stopKycCamera}
                        className="w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-rose-500 transition-colors pointer-events-auto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={captureKycPhoto}
                        className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-emerald-500/20 pointer-events-auto border-4 border-white/20"
                      >
                        <Scan className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}

                {kycMode === 'captured' && kycPhoto && (
                  <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
                    <img src={kycPhoto} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-emerald-500 text-white text-[8px] font-black uppercase tracking-tighter">
                      Captured Successfully
                    </div>
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setKycPhoto(null);
                          startKycCamera();
                        }}
                        className="h-9 px-4 rounded-full bg-slate-950/80 backdrop-blur-md flex items-center gap-2 text-slate-300 text-[10px] font-bold hover:text-white transition-colors border border-slate-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        إعادة المحاولة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (kycStep === 1) {
                            setKycStep(2);
                            setKycPhoto(null);
                            setKycMode('idle');
                          } else {
                            setKycLoading(true);
                            setTimeout(() => {
                              currentUser.verified = true;
                              setKycLoading(false);
                              setSettingsSaved(true);
                              setTimeout(() => setSettingsSaved(false), 3000);
                            }, 2000);
                          }
                        }}
                        className="h-9 px-6 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
                      >
                        {kycStep === 1 ? 'متابعة الخطوة التالية' : 'إنهاء وتوثيق الحساب'}
                      </button>
                    </div>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />

                {kycLoading && (
                  <div className="py-8 flex flex-col items-center justify-center gap-4">
                     <div className="relative">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                        <ShieldAlert className="w-4 h-4 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                     </div>
                     <div className="text-center">
                        <p className="text-[11px] font-bold text-slate-200">جاري معالجة البيانات ضوئياً وتأكيد الهوية...</p>
                        <p className="text-[9px] text-slate-500 mt-1">يتم استخدام تقنيات الذكاء الاصطناعي لمطابقة الصورة بالبيانات المسجلة</p>
                     </div>
                  </div>
                )}

                {!kycLoading && (
                   <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                     بمجرد الضغط على إرسال، فإنك توافق على شروط الاستخدام في <span className="text-slate-400 underline cursor-pointer">أسواق</span> للتحقق من هويتك الشخصية لغرض زيادة الموثوقية فقط.
                   </p>
                )}
              </div>
            )}
          </div>
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
               className="absolute top-5 left-5 p-2 rounded-full bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
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
                      className="text-slate-755 hover:scale-125 active:scale-90 transition-all cursor-pointer"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          active
                            ? "text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                            : "text-slate-700 hover:text-amber-350"
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
                          : "bg-slate-850 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Form */}
            <div className="mb-6 font-sans">
              <label className="block text-xs font-bold text-slate-400 mb-2">
                ملاحظاتك أو مقترحاتك (اختياري)
              </label>
              <textarea
                id="rating-comment-textarea"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="اكتب كلمة شكر أو أي ملاحظة لتعزيز ثقة المجتمع..."
                className="w-full min-h-[70px] bg-slate-950 border border-slate-800 rounded-2xl p-3 text-right text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500 resize-none transition-all"
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
                    <Loader2 className="w-4 h-4 animate-spin animate-spin-slow" />
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
              <p className="text-xs text-slate-400 mt-2 font-sans px-2">
                هل أنت متأكد من رغبتك في حذف الإعلان بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء لاحقاً.
              </p>
              
              {/* Highlight Target Title */}
              <div className="mt-4 px-3 py-2 bg-slate-955/50 border border-slate-800 rounded-xl">
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
                    if (addToast) {
                      addToast(
                        isRtl ? "تم حذف الإعلان" : "Ad Deleted",
                        isRtl ? "تمت إزالة هذا الإعلان بنجاح من المنصة." : "This ad was successfully removed from the platform.",
                        "success"
                      );
                    }
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
