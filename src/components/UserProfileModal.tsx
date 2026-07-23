/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, MapPin, Calendar, Star, ShieldCheck, Mail, Phone, MessageSquare, ExternalLink, Camera, Upload, Trash2, Award, Loader2 } from 'lucide-react';
import { User, Ad, UserRole } from '../types.ts';
import { CITIES } from '../data.ts';
import { Avatar } from './Avatar.tsx';
import { apiFetch } from '../lib/api';

interface UserProfileModalProps {
  user: User;
  ads: Ad[];
  promoVideos?: any[];
  onClose: () => void;
  onViewAd: (ad: Ad) => void;
  currentUser?: User | null;
  onUpdateProfile?: (updatedData: Partial<User>) => Promise<void>;
  onViewStore?: (userId: string) => void;
  onVerifyIdentity?: (role: 'merchant' | 'driver' | 'subscriber') => void;
  addToast?: (title: string, desc: string, type: 'success' | 'error' | 'info' | 'notification') => void;
}

export default function UserProfileModal({ 
  user, 
  ads, 
  promoVideos = [],
  onClose, 
  onViewAd, 
  currentUser, 
  onUpdateProfile, 
  onViewStore,
  onVerifyIdentity,
  addToast,
}: UserProfileModalProps) {
  const displayEmail = (user.email && !user.email.includes('@phone.aswaq.com')) ? user.email : '';
  const cleanInitialName = (!user.name || /^[A-Za-z0-9_-]{20,}$/.test(user.name.trim()) || user.name.includes('@phone.aswaq.com')) ? 'مستخدم جديد' : user.name;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    name: cleanInitialName,
    phone: user.phone || '',
    email: displayEmail,
    bio: user.bio || '',
    avatar: user.avatar || '',
    coverPhoto: user.coverPhoto || ''
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.id === user.id;
  const userAds = ads.filter(ad => ad.userId === user.id);
  const userPromos = Array.isArray(promoVideos) ? promoVideos.filter(p => p.userId === user.id) : [];
  
  // Use the city from the user's first ad, or show a generic platform status
  const city = userAds.length > 0 && userAds[0].city ? (CITIES.find(c => c.id === userAds[0].city)?.nameAr || userAds[0].city) : 'عضو في المنصة';

   const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
   const [uploadingCover, setUploadingCover] = React.useState(false);

  React.useEffect(() => {
    const cleanEmail = (user.email && !user.email.includes('@phone.aswaq.com')) ? user.email : '';
    setEditForm({
      name: user.name,
      phone: user.phone || '',
      email: cleanEmail,
      bio: user.bio || '',
      avatar: user.avatar || '',
      coverPhoto: user.coverPhoto || ''
    });
  }, [user]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    setIsSaving(true);
    try {
      await onUpdateProfile(editForm);
      setIsEditing(false);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    if (type === 'avatar') setUploadingAvatar(true);
    else setUploadingCover(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/storage/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.url) throw new Error('لم يُرجع الخادم رابط الصورة');
        const fieldKey = type === 'avatar' ? 'avatar' : 'coverPhoto';
        setEditForm(prev => ({
          ...prev,
          [fieldKey]: data.url
        }));
        if (onUpdateProfile) {
          await onUpdateProfile({ [fieldKey]: data.url });
        }
        addToast?.(
          type === 'avatar' ? 'تم رفع الصورة الشخصية' : 'تم رفع صورة الحائط',
          'تم الرفع والحفظ بنجاح.',
          'success'
        );
      } else {
        let errMsg = 'فشل رفع الصورة';
        try {
          const errData = await res.json();
          errMsg = errData.message || errData.error || errMsg;
        } catch {}
        console.error('[UserProfileModal] Upload failed:', res.status, errMsg);
        addToast?.('فشل رفع الصورة', `${errMsg} (${res.status})`, 'error');
      }
    } catch (err: any) {
      console.error('[UserProfileModal] Error uploading profile media:', err);
      addToast?.('خطأ في الرفع', `تعذّر رفع الصورة: ${err.message || err}`, 'error');
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] overflow-y-auto flex items-start pt-12 pb-10 sm:pt-24 lg:items-center lg:pt-0 justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md dir-rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-right">
        
        {/* Scrollable Container for Header + Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          
          {/* Header with Cover image/gradient */}
          <div className="h-44 sm:h-52 relative shrink-0 overflow-hidden">
            {editForm.coverPhoto || user.coverPhoto ? (
              <img 
                src={isEditing ? (editForm.coverPhoto || user.coverPhoto) : user.coverPhoto} 
                className="w-full h-full object-cover"
                alt="Cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-l from-emerald-600 to-cyan-700" />
            )}
            
            {/* Decoration overlay if no cover photo */}
            {!(editForm.coverPhoto || user.coverPhoto) && (
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-emerald-400 blur-3xl rounded-full translate-x-1/2 translate-y-1/2" />
              </div>
            )}

            {/* Cover Edit Button */}
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all z-10">
                {uploadingCover ? (
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-[10px] font-black">جاري رفع صورة الحائط...</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => coverInputRef.current?.click()}
                    className="bg-white/20 backdrop-blur-xl border border-white/20 px-5 py-2.5 rounded-2xl flex items-center gap-3 text-white text-xs font-black hover:bg-white/30 transition-all shadow-2xl"
                  >
                    <Camera className="w-4 h-4" />
                    تغيير صورة الحائط
                  </button>
                )}
                <input 
                  type="file"
                  ref={coverInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cover')}
                />
              </div>
            )}

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all z-20 backdrop-blur-sm border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Info Area */}
          <div className="px-5 sm:px-8 pb-8 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6 -mt-16 sm:-mt-20 mb-6 sm:mb-8 text-center sm:text-right">
              <div className="relative shrink-0 group">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] border-8 border-slate-900 overflow-hidden shadow-2xl bg-slate-800 relative">
                  <Avatar 
                    src={isEditing ? editForm.avatar : user.avatar} 
                    name={user.name}
                    sizeClassName="w-full h-full"
                    className=""
                  />
                  
                  {/* Avatar Edit Overlay */}
                  {isEditing && (
                    <button 
                      onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-[10px] font-black gap-2 transition-opacity opacity-0 group-hover:opacity-100"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6" />
                          تغيير الصورة
                        </>
                      )}
                    </button>
                  )}
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'avatar')}
                  />
                </div>
                
                {user.verified && !isEditing && (
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-2 border-4 border-slate-900 shadow-xl z-20">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 pb-2 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-3">
                    {user.name}
                      {user.role === 'store' && (
                        <div className="bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/20" title="متجر ذهبي">
                          <Award className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      )}
                  </h2>
                  <div className="flex flex-wrap justify-center sm:justify-end gap-2">
                    {isOwnProfile && !isEditing && (
                      <>
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full bg-emerald-500/5 transition-all whitespace-nowrap"
                        >
                          تعديل الملف الشخصي
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-slate-400 text-[10px] sm:text-xs font-bold">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-500" /> {city}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> 
                    عضو منذ {user.joinDate || (user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' }) : '')}
                  </span>
                  {typeof user.rating === 'number' && user.rating > 0 && (
                    <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400" /> {user.rating} / 5</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sidebar Stats */}
              <div className="md:col-span-1 space-y-4">
                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    مركز التوثيق والأمان
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                       <span className="text-[11px] font-bold text-slate-400">تحقق الهاتف</span>
                       {(user.phone || user.phoneVerified) ? (
                         <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                           <span>تم التحقق ✓</span>
                         </span>
                       ) : (
                         <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">مطلوب 🕒</span>
                       )}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                       <span className="text-[11px] font-bold text-slate-400">توثيق الهوية</span>
                       {user.identityVerified ? (
                         <span className="text-[10px] font-black text-emerald-400">تم التوثيق ⭐</span>
                       ) : (
                         <button 
                           onClick={() => onVerifyIdentity?.('merchant')}
                           className="text-[10px] font-black text-blue-400 hover:underline"
                         >
                           توثيق الآن 🛡️
                         </button>
                       )}
                    </div>
                  </div>
                  {!user.identityVerified && isOwnProfile && (
                    <div className="pt-2 grid grid-cols-2 gap-2">
                      <button 
                         onClick={() => onVerifyIdentity?.('merchant')}
                         className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[9px] font-black border border-emerald-500/20 hover:bg-emerald-500/20"
                      >
                        ترقية لـ تاجر 💼
                      </button>
                      <button 
                         onClick={() => onVerifyIdentity?.('driver')}
                         className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-[9px] font-black border border-cyan-500/20 hover:bg-cyan-500/20"
                      >
                        ترقية لـ سائق 🛵
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">إجمالي الإعلانات</span>
                    <span className="text-white">{userAds.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold pt-3 border-t border-white/5">
                    <span className="text-slate-500">نوع الحساب</span>
                    <span className="text-emerald-400 capitalize bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                      {user.role === UserRole.STORE ? 'متجر ذهبي 🏆' : 
                       user.role === UserRole.MERCHANT ? 'تاجر معتمد 💼' : 
                       user.role === ('agent' as any) ? 'سائق شحن 🛵' : 'مستخدم عادي'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span dir="ltr">{user.phone || 'لم يُضاف الهاتف'}</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-slate-300 text-xs font-bold">
                    <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate font-sans">
                      {user.email && !user.email.includes('@phone.aswaq.com') ? user.email : 'البريد غير مضاف (انقر لتعديل ملفك وإضافته)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content: Bio & Recent Ads */}
              <div className="md:col-span-2 space-y-6 text-right">
                {isEditing ? (
                  <div className="space-y-5 bg-white/[0.02] p-6 rounded-[2.5rem] border border-white/5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">الاسم الكامل</label>
                      <input 
                        type="text" 
                        value={editForm.name}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all text-right shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">رقم الهاتف</label>
                      <input 
                        type="text" 
                        value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all text-right shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">البريد الإلكتروني الشخصي (اختياري)</label>
                      <input 
                        type="email" 
                        value={editForm.email}
                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                        placeholder="أدخل بريدك الإلكتروني الشخصي (مثال: name@gmail.com)"
                        dir="ltr"
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all text-left shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">نبذة عنك</label>
                      <textarea 
                        rows={4}
                        value={editForm.bio}
                        onChange={e => setEditForm({...editForm, bio: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all text-right resize-none shadow-inner"
                        placeholder="اكتب نبذة مختصرة عنك أو لعملك..."
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={handleSave}
                        disabled={isSaving || uploadingAvatar || uploadingCover}
                        className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-emerald-600/20"
                      >
                        {isSaving ? 'جاري الحفظ...' : (uploadingAvatar || uploadingCover) ? 'جاري رفع الملفات...' : 'حفظ التغييرات'}
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setEditForm({
                            name: user.name,
                            phone: user.phone || '',
                            bio: user.bio || '',
                            avatar: user.avatar || '',
                            coverPhoto: user.coverPhoto || ''
                          });
                        }}
                        className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-400 text-[11px] font-black hover:bg-slate-700 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white/[0.02] p-6 rounded-[2.5rem] border border-white/5">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">نبذة تعريفية</h3>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        {user.bio || 'لا يوجد نبذة تعريفية متوفرة لهذا المستخدم حالياً.'}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center text-right">
                        إعلانات نشطة ({userAds.length})
                        <button 
                          onClick={() => onViewStore?.(user.id)}
                          className="text-[10px] text-emerald-500 hover:underline font-black"
                        >
                          عرض الكل
                        </button>
                      </h3>
                      <div className="grid grid-cols-1 gap-3 text-right">
                        {userAds.slice(0, 3).map(ad => (
                          <button 
                            key={ad.id}
                            onClick={() => onViewAd(ad)}
                            className="w-full p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all flex items-center gap-4 group text-right shadow-sm"
                          >
                            <img src={ad.images?.[0] || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'} className="w-16 h-14 rounded-xl object-cover shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-white truncate group-hover:text-emerald-400 transition-colors">{ad.title}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-emerald-500 font-black">{ad.price.toLocaleString()} {ad.currency}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[9px] text-slate-500 font-bold">{ad.category}</span>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-700 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        ))}
                        {userAds.length === 0 && (
                          <div className="text-center py-10 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl text-[10px] text-slate-600 font-black tracking-widest uppercase">
                            لا يوجد إعلانات نشطة حالياً لهذا المستخدم
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NEW: Promo Clips & Streams Section */}
                    {userPromos.length > 0 && (
                      <div className="pt-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 text-right">
                          مقاطع الفيديو والبثوث المحفوظة ({userPromos.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {userPromos.map(promo => (
                            <button 
                              key={promo.id}
                              onClick={() => onViewAd(promo as Ad)}
                              className="relative aspect-[9/16] rounded-2xl overflow-hidden group border border-white/5 hover:border-emerald-500/30 transition-all"
                            >
                              <img src={promo.thumbnailUrl || 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=300&q=80'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute bottom-3 left-3 right-3 text-right">
                                <p className="text-[10px] font-black text-white truncate">{promo.title}</p>
                                <div className="flex items-center justify-end gap-1.5 mt-1">
                                  {promo.isLive ? (
                                    <span className="flex items-center gap-1 text-[8px] bg-rose-600 px-1.5 py-0.5 rounded text-white font-black animate-pulse">
                                      بث مباشر
                                    </span>
                                  ) : (
                                    <span className="text-[8px] text-slate-400 font-bold">بث محفوظ</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-950/80 border-t border-slate-800 flex items-center justify-center gap-4 shrink-0">
           <button 
              className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all active:scale-95"
           >
             <MessageSquare className="w-4 h-4" />
             بدء محادثة فورية
           </button>
           <button 
              onClick={onClose}
              className="px-10 py-4 rounded-2xl bg-slate-800 text-slate-300 text-xs font-black hover:bg-slate-700 transition-all"
           >
             إغلاق
           </button>
        </div>
      </div>
    </div>
  );
}
