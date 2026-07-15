import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileText, 
  Camera, 
  ShieldCheck, 
  Upload, 
  CheckCircle2, 
  ArrowRight,
  AlertCircle,
  Clock,
  Briefcase,
  Truck,
  CreditCard
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (docs: string[]) => void;
  isDark?: boolean;
  targetRole: 'merchant' | 'driver' | 'subscriber';
}

export default function IdentityVerificationModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  isDark, 
  targetRole 
}: IdentityVerificationModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<{ id: string; name: string; url: string; type: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setIsUploading(true);
    // Simulate upload
    setTimeout(() => {
      const newFiles = Array.from(selectedFiles).map((file: any, idx: number) => ({
        id: `file_${Date.now()}_${idx}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type
      }));
      setFiles(prev => [...prev, ...newFiles]);
      setIsUploading(false);
    }, 1500);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleComplete = () => {
    onSuccess(files.map(f => f.url));
    setStep(3);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`w-full max-w-xl overflow-hidden rounded-[2.5rem] border shadow-2xl relative ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          } ${isRtl ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
            <motion.div 
               className="h-full bg-emerald-500"
               initial={{ width: '0%' }}
               animate={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <button
            onClick={onClose}
            className={`absolute top-6 ${isRtl ? 'left-6' : 'right-6'} p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10`}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>

          {step === 1 && (
            <div className="p-8 md:p-12">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 relative">
                   {targetRole === 'merchant' ? <Briefcase className="w-10 h-10" /> : 
                    targetRole === 'driver' ? <Truck className="w-10 h-10" /> : <CreditCard className="w-10 h-10" />}
                   <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center">
                     <ShieldCheck className="w-4 h-4 text-emerald-500" />
                   </div>
                </div>
                <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {targetRole === 'merchant' ? 'توثيق حساب التاجر' : 
                   targetRole === 'driver' ? 'توثيق حساب السائق' : 'توثيق العضوية المميزة'}
                </h2>
                <p className="text-sm text-slate-500 mt-3 font-bold max-w-sm">
                  لضمان سلامة التعاملات، يجب توثيق هويتك عبر رفع صورة واضحة من بطاقتك الشخصية أو جواز السفر.
                </p>
              </div>

              <div className="space-y-4">
                <div className={`p-5 rounded-2xl border flex items-center gap-4 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                     <FileText className="w-5 h-5" />
                   </div>
                   <div className="flex-1">
                     <p className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>البطاقة الشخصية (وجهين)</p>
                     <p className="text-[10px] text-slate-500 font-bold">يجب أن تكون البيانات واضحة وتاريخ الانتهاء ساري</p>
                   </div>
                </div>
                <div className={`p-5 rounded-2xl border flex items-center gap-4 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                     <Camera className="w-5 h-5" />
                   </div>
                   <div className="flex-1">
                     <p className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>صورة سيلفي مع الهوية</p>
                     <p className="text-[10px] text-slate-500 font-bold">للتأكد بأنك المالك الحقيقي للوثائق المرفوعة</p>
                   </div>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 mt-8 shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
              >
                <span>ابدأ عملية التوثيق</span>
                <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="p-8 md:p-12">
              <div className="mb-8">
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>رفع الوثائق والمستندات</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">يمكنك رفع صور بصيغة JPG, PNG أو ملفات PDF</p>
              </div>

              <div 
                className={`relative border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center text-center transition-all cursor-pointer ${
                  isDark ? 'border-slate-800 hover:border-emerald-500/50 bg-slate-950' : 'border-slate-200 hover:border-emerald-500/50 bg-slate-50'
                }`}
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                  {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                </div>
                <p className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>اسحب الملفات هنا أو انقر للإختيار</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2">الحجم الأقصى: 10 ميجابايت لكل ملف</p>
              </div>

              {files.length > 0 && (
                <div className="mt-8 space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">الملفات المرفوعة ({files.length})</p>
                  <div className="grid grid-cols-1 gap-2">
                    {files.map(file => (
                      <div key={file.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-white/5' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-10">
                <button 
                  onClick={() => setStep(1)}
                  className={`flex-1 h-16 rounded-2xl font-bold text-xs transition-colors ${
                    isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  تراجع
                </button>
                <button 
                  disabled={files.length === 0 || isUploading}
                  onClick={handleComplete}
                  className="flex-[2] h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <span>إرسال للتدقيق</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-8 md:p-12 text-center flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/30">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>تم تقديم الطلب بنجاح!</h3>
              <p className="text-sm text-slate-500 mt-4 font-bold max-w-sm leading-relaxed">
                شكراً لك. فريق التدقيق لدينا سيقوم بمراجعة مستنداتك خلال 24 ساعة كحد أقصى. سيصلك إشعار فور قبول الطلب.
              </p>
              
              <div className={`w-full mt-10 p-5 rounded-2xl border flex items-center gap-4 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-right flex-1">
                  <p className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>حالة الطلب الحالية</p>
                  <p className="text-[10px] text-amber-500 font-bold">قيد المراجعة الفنية والقانونية</p>
                </div>
              </div>

              <button 
                onClick={onClose}
                className={`w-full h-16 rounded-2xl font-black text-sm mt-10 transition-all active:scale-95 ${
                  isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                إغلاق والعودة للتصفح
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const Loader2 = ({ className }: { className: string }) => <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />;
