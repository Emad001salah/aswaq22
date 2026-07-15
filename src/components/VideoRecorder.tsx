import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, StopCircle, RefreshCcw, Check, X, Video, Mic, MicOff, Filter } from 'lucide-react';

interface VideoRecorderProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onCapture, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [activeFilter, setActiveFilter] = useState('none');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [beautyMode, setBeautyMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filters = [
    { id: 'none', label: 'طبيعي', class: '' },
    { id: 'vibrant', label: 'زاهي', class: 'saturate-[1.4] contrast-[1.1] brightness-[1.1]' },
    { id: 'warm', label: 'دافئ', class: 'sepia-[0.2] saturate-[1.2] hue-rotate-[-10deg]' },
    { id: 'noir', label: 'أبيض وأسود', class: 'grayscale brightness-[1.1] contrast-[1.2]' },
    { id: 'cyber', label: 'سايبر', class: 'hue-rotate-[180deg] saturate-[1.5]' },
  ];

  const getFilterClass = () => {
    const f = filters.find(x => x.id === activeFilter)?.class || '';
    return `${f} ${beautyMode ? 'blur-[0.4px] brightness-[1.05]' : ''}`;
  };

  const [recordingTime, setRecordingTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async (mode: 'user' | 'environment') => {
    setCameraError(null);
    
    // 1. Ensure complete cleanup of previous stream
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setStream(null);
      // Increased delay for hardware to release resources
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Multi-stage camera initialization attempts
    const tryCapture = async (constraints: MediaStreamConstraints) => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        return true;
      } catch (e) {
        console.warn("Attempt failed with constraints:", constraints, e);
        return false;
      }
    };

    const isPortrait = window.innerHeight > window.innerWidth;

    // Stage 1: Ideal Quality
    const success1 = await tryCapture({
      video: { 
        facingMode: { ideal: mode }, 
        width: { ideal: isPortrait ? 720 : 1280 }, 
        height: { ideal: isPortrait ? 1280 : 720 } 
      },
      audio: true
    });

    if (success1) return;

    // Stage 2: Simpler constraints (String mode)
    const success2 = await tryCapture({
      video: { facingMode: mode },
      audio: true
    });

    if (success2) return;

    // Stage 3: Video only (No audio)
    const success3 = await tryCapture({
      video: { facingMode: mode }
    });

    if (success3) return;

    // Stage 4: Absolute basic
    const success4 = await tryCapture({ video: true });

    if (!success4) {
      setCameraError("فشل تشغيل الكاميرا. يرجى التأكد من عدم استخدامها في تطبيق آخر ومنح صلاحية الوصول.");
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stream?.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [facingMode]);

  const toggleCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    startCamera(facingMode);
  };

  const handleDone = () => {
    if (recordedBlob) {
      onCapture(recordedBlob);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-sans">
      <div className="relative w-full max-w-md h-full md:max-h-[80vh] bg-slate-900 overflow-hidden md:rounded-3xl shadow-2xl flex flex-col">
        
        {/* Top Header */}
        <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-30">
           <button onClick={onClose} className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10">
              <X className="w-6 h-6" />
           </button>
           
           {isRecording && (
             <div className="flex items-center gap-2 bg-red-500/80 backdrop-blur-md px-3 py-1 rounded-full border border-red-400/30">
               <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
               <span className="text-[11px] font-black tracking-widest text-white uppercase tabular-nums">
                 {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
               </span>
             </div>
           )}
           <button 
             onClick={() => setIsMuted(!isMuted)} 
             className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10"
           >
             {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           </button>
        </div>

        {/* Video Canvas */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          <div className={`w-full h-full transition-all duration-500 transition-filters ${getFilterClass()}`}>
            {!previewUrl ? (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                style={{ transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoomLevel})` }}
              />
            ) : (
              <video 
                src={previewUrl} 
                autoPlay 
                loop 
                playsInline 
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Side Controls */}
          {!previewUrl && !isRecording && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-5 z-40">
               <button 
                onClick={() => setBeautyMode(!beautyMode)}
                className={`p-3 rounded-full backdrop-blur-xl border transition-all ${beautyMode ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/40 border-white/10 text-white/60'}`}
               >
                 <span className="text-xs font-black">B</span>
               </button>
               <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-full backdrop-blur-xl border transition-all ${showFilters ? 'bg-red-500 border-red-400 text-white' : 'bg-black/40 border-white/10 text-white/60'}`}
               >
                 <Filter className="w-5 h-5" />
               </button>
               <button 
                onClick={() => setZoomLevel(prev => prev === 1 ? 2 : prev === 2 ? 4 : 1)}
                className="p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white"
               >
                 <span className="text-[10px] font-black">{zoomLevel}x</span>
               </button>
            </div>
          )}

          {/* Filter Tray Overlay */}
          <AnimatePresence>
            {showFilters && !isRecording && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="absolute bottom-32 inset-x-4 z-40 bg-black/60 backdrop-blur-2xl p-4 rounded-2xl border border-white/10"
              >
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${activeFilter === f.id ? 'bg-white text-black' : 'bg-white/5 text-white'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guidelines & Error Overlay */}
          {!isRecording && !previewUrl && (
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex flex-col items-center justify-center text-center p-12">
               {cameraError ? (
                 <div className="bg-red-500/20 backdrop-blur-md p-6 rounded-2xl border border-red-500/30 flex flex-col items-center gap-4 max-w-xs pointer-events-auto">
                    <X className="w-10 h-10 text-red-400" />
                    <p className="text-red-200 text-xs font-bold leading-relaxed">{cameraError}</p>
                    <button 
                      onClick={() => startCamera(facingMode)}
                      className="text-[10px] bg-red-500 text-white px-4 py-2 rounded-lg font-black uppercase"
                    >
                      إعادة المحاولة
                    </button>
                 </div>
               ) : (
                 <div className="w-full h-full border-2 border-white/20 rounded-2xl flex flex-col items-center justify-center gap-4">
                    <Video className="w-12 h-12 text-white/30" />
                    <p className="text-white/40 text-[10px] font-bold leading-relaxed">
                      {facingMode === 'environment' ? 'صور منتجك بوضوح' : 'سجل رسالة ترويجية'}
                      <br/>(TikTok Style)
                    </p>
                 </div>
               )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent absolute bottom-0 inset-x-0 z-30">
          {!previewUrl ? (
            <div className="flex items-center justify-center gap-12">
               {!isRecording && (
                 <button 
                   type="button"
                   onClick={toggleCamera} 
                   className="p-4 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                 >
                   <RefreshCcw className="w-6 h-6" />
                 </button>
               )}
               
               <button 
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-white' : 'bg-red-600 shadow-xl shadow-red-900/40'}`}
               >
                 {isRecording ? (
                   <StopCircle className="w-10 h-10 text-red-600" />
                 ) : (
                   <div className="w-16 h-16 rounded-full border-4 border-white" />
                 )}
               </button>

               {!isRecording ? (
                 <button 
                  type="button"
                  onClick={onClose} 
                  className="p-4 rounded-full bg-white/5 border border-white/10 text-white/40"
                 >
                   <X className="w-6 h-6" />
                 </button>
               ) : (
                 <div className="w-14" />
               )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl border border-slate-700 transition-all"
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span>إعادة التصوير</span>
                </button>
                <button 
                  onClick={handleDone}
                  className="flex-[2] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all animate-pulse"
                >
                  <Check className="w-6 h-6" />
                  <span>استخدام هذا الفيديو</span>
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400 font-medium">سيتم إضافة الفيديو لإعلانك تلقائياً ورفعه لقسم Spotlight</p>
            </div>
          )}
        </div>
        
        {/* Brand Accent */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-40">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
           <span className="text-[8px] font-black text-white/50 tracking-tighter uppercase">Spotlight Creator Mode</span>
        </div>
      </div>
    </div>
  );
};

export default VideoRecorder;
