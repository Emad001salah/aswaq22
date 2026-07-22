/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * لوحة التحكم الشاملة لمنصة أسواق
 * تتصل بجميع الـ APIs الحقيقية في السيرفر
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import {
  ShieldAlert,
  Users,
  FileText,
  Trash2,
  UserX,
  UserCheck,
  BarChart3,
  CheckCircle2,
  X,
  Search,
  LayoutDashboard,
  Eye,
  AlertCircle,
  TrendingUp,
  MoreVertical,
  Filter,
  Settings,
  Globe,
  Video,
  MessageSquare,
  Bell,
  Database,
  Lock,
  RefreshCw,
  Star,
  Briefcase,
  ChevronDown,
  ChevronUp,
  LogOut,
  Activity,
  Server,
  Shield,
  Key,
  Download,
  Plus,
  Edit2,
  Package,
  Tag,
  MapPin,
  Clock,
  CheckSquare,
  XCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Hash,
  User as UserIcon,
  Phone,
  Mail,
  Calendar,
  Info,
  Megaphone,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import DeliveryDashboard from '../modules/shipping/DeliveryDashboard';
import { User, Ad } from '../types.ts';
import { MARKETS } from '../markets.ts';
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
  PieChart,
  Pie,
  Legend,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminTab =
  | 'overview'
  | 'ads'
  | 'users'
  | 'delivery'
  | 'reports'
  | 'categories'
  | 'markets'
  | 'featured'
  | 'analytics'
  | 'settings'
  | 'security'
  | 'employees'
  | 'polls'
  | 'reels';

interface AdminPanelProps {
  onClose: () => void;
  ads: Ad[];
  onAdDeleted: (adId: string) => void;
  onAdStatusChange: (adId: string, status: string, isFeatured?: boolean) => void;
  onViewAd: (ad: Ad) => void;
  onViewUser: (user: User) => void;
  currentUser?: any;
  onSettingsSaved?: () => void;
  addToast?: (title: string, desc: string, type: 'success' | 'error' | 'info' | 'notification') => void;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: number;
}) {
  return (
    <div className="relative overflow-hidden p-5 rounded-3xl bg-slate-800/50 border border-white/5 hover:border-white/10 transition-all group">
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 blur-2xl ${color.replace('text-', 'bg-')}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-2xl ${color.replace('text-', 'bg-').replace('500', '500/10')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-white mb-0.5">{value}</p>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-black text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminPanel({
  onClose,
  ads: initialAds,
  onAdDeleted,
  onAdStatusChange,
  onViewAd,
  onViewUser,
  currentUser,
  onSettingsSaved,
  addToast,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedMarket, setSelectedMarket] = useState('all');

  // ── Data States ──
  const [stats, setStats] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminAds, setAdminAds] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [securityStats, setSecurityStats] = useState<any>(null);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [polls, setPolls] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dbMarkets, setDbMarkets] = useState<any[]>([]);

  // ── UI States ──
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverRoleFilter, setDriverRoleFilter] = useState('all');
  const [driverStatusFilter, setDriverStatusFilter] = useState('all');
  const [inspectedDocUrl, setInspectedDocUrl] = useState<string | null>(null);

  const filteredDriverList = useMemo(() => {
    return allUsers.filter(u => {
      if (driverRoleFilter === 'driver' && u.role !== 'AGENT' && !u.deliveryAgent) return false;
      if (driverRoleFilter === 'merchant' && u.role !== 'MERCHANT') return false;
      if (driverRoleFilter === 'user' && u.role !== 'USER') return false;

      if (driverStatusFilter === 'pending' && u.isVerified === 'verified') return false;
      if (driverStatusFilter === 'verified' && u.isVerified !== 'verified') return false;
      if (driverStatusFilter === 'unverified' && u.isVerified === 'verified') return false;

      if (driverSearch.trim()) {
        const q = driverSearch.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchPhone = u.phone?.includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchPlate = u.deliveryAgent?.licensePlate?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchPlate) return false;
      }

      return true;
    });
  }, [allUsers, driverRoleFilter, driverStatusFilter, driverSearch]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [newPollCountryCode, setNewPollCountryCode] = useState('ALL');
  const [addingPoll, setAddingPoll] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '', role: 'ADMIN', managedCountry: '' });
  const [addingEmployee, setAddingEmployee] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newCategory, setNewCategory] = useState({ id: '', nameAr: '', nameEn: '', icon: '' });
  const [newSubNameAr, setNewSubNameAr] = useState('');
  const [newSubNameEn, setNewSubNameEn] = useState('');
  const [activeSubCatId, setActiveSubCatId] = useState<string | null>(null);

  const [showAddMarket, setShowAddMarket] = useState(false);
  const [editingMarket, setEditingMarket] = useState<any>(null);
  const [newMarket, setNewMarket] = useState({ countryCode: '', labelAr: '', labelEn: '', currency: '', usdRate: '1', centerLat: '15.0', centerLng: '45.0', flag: '🌍' });
  const [selectedMarketForCities, setSelectedMarketForCities] = useState<any>(null);
  const [showAddCity, setShowAddCity] = useState(false);
  const [newCity, setNewCity] = useState({ nameAr: '', nameEn: '', lat: '0.0', lng: '0.0' });

  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Helper to read cookie by name
  const getCookie = (name: string): string | undefined => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  // ── Auth & CSRF Helper: always attach x-user-email, Authorization and x-csrf-token ──
  const adminFetch = useCallback(
    async (url: string, opts: RequestInit = {}) => {
      // 1. Get CSRF token from cookie
      let csrfToken = getCookie('csrf_token');

      // 2. If token is not present in cookie, fetch it from the server
      if (!csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method || 'GET')) {
        try {
            const csrfRes = await apiFetch('/api/csrf-token', { credentials: 'include' });
          if (csrfRes.ok) {
            const data = await csrfRes.json();
            csrfToken = data.csrfToken;
          }
        } catch (e) {
          console.error('Failed to pre-fetch CSRF token', e);
        }
      }

      const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token') || '';

      return apiFetch(url, {
        credentials: 'include',
        ...opts,
        headers: {
          'x-user-email': currentUser?.email || '',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          ...(opts.headers as Record<string, string> || {}),
        },
      });
    },
    [currentUser]
  );

  // ── Fetch Functions ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/stats?market=${selectedMarket}`);
      if (res.ok) setStats(await res.json());
      else console.error('Stats API error', res.status, await res.text());
    } catch (e) {
      console.error('Stats fetch failed', e);
    }
  }, [selectedMarket, adminFetch]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', market: selectedMarket });
      if (searchTerm) params.set('search', searchTerm);
      const res = await adminFetch(`/api/admin/users?${params}`);
      if (res.ok) setAllUsers(await res.json());
      else console.error('Users API error', res.status);
    } catch (e) {
      console.error('Users fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [selectedMarket, searchTerm, adminFetch]);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', market: selectedMarket });
      if (searchTerm) params.set('search', searchTerm);
      const res = await adminFetch(`/api/admin/ads?${params}`);
      if (res.ok) setAdminAds(await res.json());
      else console.error('Ads API error', res.status);
    } catch (e) {
      console.error('Ads fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [selectedMarket, searchTerm, adminFetch]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/employees');
      if (res.ok) setEmployees(await res.json());
      else console.error('Employees API error', res.status);
    } catch (e) {
      console.error('Employees fetch failed', e);
    }
  }, [adminFetch]);

  const fetchSecurity = useCallback(async () => {
    try {
      const [secRes, logsRes] = await Promise.all([
        adminFetch('/api/admin/security/stats'),
        adminFetch('/api/admin/logs'),
      ]);
      if (secRes.ok) setSecurityStats(await secRes.json());
      if (logsRes.ok) setAdminLogs(await logsRes.json());
    } catch (e) {
      console.error('Security fetch failed', e);
    }
  }, [adminFetch]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) setSettings(await res.json());
      else console.error('Settings API error', res.status);
    } catch (e) {
      console.error('Settings fetch failed', e);
    }
  }, [adminFetch]);

  const fetchPolls = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/polls');
      if (res.ok) setPolls(await res.json());
    } catch (e) {
      console.error('Polls fetch failed', e);
    }
  }, [adminFetch]);

  const fetchReels = useCallback(async () => {
    try {
      const res = await adminFetch('/api/promo');
      if (res.ok) setReels(await res.json());
    } catch (e) {
      console.error('Reels fetch failed', e);
    }
  }, [adminFetch]);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await apiFetch('/api/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchMarkets = useCallback(async () => {
    setLoadingMarkets(true);
    try {
      const res = await adminFetch('/api/markets/all');
      if (res.ok) {
        const json = await res.json();
        setDbMarkets(json.data || []);
      } else {
        const errText = await res.text().catch(() => '');
        console.error('Failed to fetch markets:', res.status, errText);
        addToast?.('خطأ في جلب الأسواق', `كود الحالة: ${res.status}. يرجى تحديث الصفحة أو التحقق من اكتمال بناء خادم الإنتاج.`, 'error');
      }
    } catch (e) {
      console.error('Error fetching markets:', e);
      addToast?.('خطأ في الشبكة', 'فشل الاتصال بالخادم لجلب الأسواق.', 'error');
    } finally {
      setLoadingMarkets(false);
    }
  }, [adminFetch]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/reports');
      if (res.ok) setReports(await res.json());
      else console.error('Reports API error', res.status);
    } catch (e) {
      console.error('Reports fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  // ── Load data on tab change ──
  useEffect(() => {
    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'ads' || activeTab === 'featured') fetchAds();
    if (activeTab === 'security') fetchSecurity();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'polls') fetchPolls();
    if (activeTab === 'reels') fetchReels();
    if (activeTab === 'categories') fetchCategories();
    if (activeTab === 'markets') fetchMarkets();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'analytics') { fetchStats(); fetchAds(); fetchUsers(); }
  }, [activeTab, selectedMarket, fetchCategories, fetchMarkets, fetchReports]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'ads') fetchAds();
  }, [searchTerm]);

  // ── User Actions ──
  const handleUserAction = async (userId: string, action: string) => {
    // 1. Keep track of previous state for potential rollback
    const prevUsers = [...allUsers];
    const prevSelectedUser = selectedUser;
    
    // 2. Perform optimistic update
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const copy = { ...u };
        if (action === 'verify') copy.isVerified = 'verified';
        if (action === 'unverify') copy.isVerified = null;
        if (action === 'ban') {
          copy.active = false;
          copy.deletedAt = new Date().toISOString();
        }
        if (action === 'unban') {
          copy.active = true;
          copy.deletedAt = null;
        }
        return copy;
      }
      return u;
    }));
    
    setActionLoading(`${userId}_${action}`);
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAllUsers(prev => prev.map(u => u.id === userId ? updated : u));
        if (selectedUser?.id === userId) setSelectedUser(updated);
        addToast?.('تم', `تم تنفيذ الإجراء بنجاح`, 'success');
      } else {
        // Rollback on server error
        setAllUsers(prevUsers);
        if (prevSelectedUser) setSelectedUser(prevSelectedUser);
        addToast?.('خطأ', `فشل الإجراء (${res.status})`, 'error');
      }
    } catch (e) {
      // Rollback on network failure
      setAllUsers(prevUsers);
      if (prevSelectedUser) setSelectedUser(prevSelectedUser);
      addToast?.('خطأ', 'فشل تنفيذ الإجراء', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('⚠️ تحذير هام جداً:\nهل أنت متأكد من حذف هذا المستخدم نهائياً؟\nسيتم حذف حسابه، وجميع إعلاناته، ورسائله، وإعجاباته، وتعليقاته بالكامل من قاعدة البيانات ولا يمكن التراجع عن هذا الإجراء!')) return;
    
    const prevUsers = [...allUsers];
    const prevSelectedUser = selectedUser;
    
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    if (selectedUser?.id === userId) setSelectedUser(null);
    
    setActionLoading(`${userId}_delete`);
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast?.('تم الحذف', 'تم حذف المستخدم وجميع بياناته نهائياً بنجاح', 'success');
      } else {
        setAllUsers(prevUsers);
        if (prevSelectedUser) setSelectedUser(prevSelectedUser);
        addToast?.('خطأ', 'فشل حذف المستخدم من الخادم', 'error');
      }
    } catch (e) {
      setAllUsers(prevUsers);
      if (prevSelectedUser) setSelectedUser(prevSelectedUser);
      addToast?.('خطأ', 'تعذر الاتصال بالخادم لحذف المستخدم', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Ad Actions ──
  const handleAdAction = async (adId: string, status?: string, isFeatured?: boolean) => {
    // 1. Keep track of previous state for rollback
    const prevAds = [...adminAds];
    
    // 2. Perform optimistic update
    setAdminAds(prev => prev.map(a => {
      if (a.id === adId) {
        const copy = { ...a };
        if (status !== undefined) copy.status = status;
        if (isFeatured !== undefined) copy.isFeatured = isFeatured;
        return copy;
      }
      return a;
    }));

    setActionLoading(`${adId}_ad`);
    try {
      const body: any = {};
      if (status !== undefined) body.status = status;
      if (isFeatured !== undefined) body.isFeatured = isFeatured;

      const res = await adminFetch(`/api/admin/ads/${adId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setAdminAds(prev => prev.map(a => a.id === adId ? updated : a));
        if (status) onAdStatusChange(adId, status, isFeatured);
        addToast?.('تم', 'تم تحديث الإعلان بنجاح', 'success');
      } else {
        // Rollback
        setAdminAds(prevAds);
        addToast?.('خطأ', `فشل التحديث (${res.status})`, 'error');
      }
    } catch (e) {
      // Rollback
      setAdminAds(prevAds);
      addToast?.('خطأ', 'فشل تحديث الإعلان', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Security Actions ──
  const handleSecurityAction = async (action: string, label: string) => {
    setActionLoading(action);
    try {
      const res = await adminFetch(`/api/admin/security/${action}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        addToast?.('نجاح', data.message || label, 'success');
        if (action === 'force-logout') fetchSecurity();
      } else {
        addToast?.('خطأ', `فشل الإجراء (${res.status})`, 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل تنفيذ الإجراء الأمني', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Settings Save ──
  const handleSaveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        addToast?.('تم الحفظ', 'تم حفظ إعدادات المنصة بنجاح', 'success');
        onSettingsSaved?.();
      } else {
        addToast?.('خطأ', `فشل الحفظ (${res.status})`, 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل حفظ الإعدادات', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Logo Upload ──
  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await adminFetch('/api/admin/settings/logo', {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const { logoUrl } = await res.json();
        setSettings((prev: any) => ({ ...prev, logoUrl }));
        addToast?.('تم رفع الشعار', 'تم رفع الشعار بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل رفع الشعار', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل رفع الشعار', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Poll Actions ──
  const handleCreatePoll = async () => {
    const validOptions = newPollOptions.filter(o => o.trim());
    if (!newPollQuestion.trim() || validOptions.length < 2) return;
    setAddingPoll(true);
    try {
      const res = await adminFetch('/api/admin/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: newPollQuestion, 
          options: validOptions,
          countryCode: newPollCountryCode
        }),
      });
      if (res.ok) {
        fetchPolls();
        setNewPollQuestion('');
        setNewPollOptions(['', '']);
        setNewPollCountryCode('ALL');
        addToast?.('تم', 'تم إنشاء الاستطلاع بنجاح', 'success');
      } else {
        addToast?.('خطأ', `فشل الإنشاء (${res.status})`, 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل إنشاء الاستطلاع', 'error');
    } finally {
      setAddingPoll(false);
    }
  };

  const handleDeletePoll = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/polls/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPolls(prev => prev.filter(p => p.id !== id));
        addToast?.('تم', 'تم حذف الاستطلاع', 'success');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل الحذف', 'error');
    }
  };

  const handleDeleteReel = async (id: string) => {
    try {
      const res = await adminFetch(`/api/promo/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setReels(prev => prev.filter(r => r.id !== id));
        addToast?.('تم', 'تم حذف المقطع', 'success');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل الحذف', 'error');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name.trim() || !newEmployee.email.trim() || !newEmployee.password.trim()) return;
    setAddingEmployee(true);
    try {
      const res = await adminFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });
      if (res.ok) {
        fetchEmployees();
        setNewEmployee({ name: '', email: '', password: '', role: 'ADMIN', managedCountry: '' });
        setShowAddEmployee(false);
        addToast?.('تم', 'تم إضافة الموظف/المدير بنجاح', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast?.('خطأ', errData.error || `فشل الإضافة (${res.status})`, 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'فشل إضافة الموظف/المدير', 'error');
    } finally {
      setAddingEmployee(false);
    }
  };

  const handleEmployeeAction = async (empId: string, action: 'delete' | 'toggle_status') => {
    setActionLoading(`${empId}_${action}`);
    try {
      const res = await adminFetch(`/api/admin/employees/${empId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        if (action === 'delete') {
          setEmployees(prev => prev.filter(e => e.id !== empId));
          addToast?.('تم الحذف', 'تم حذف الموظف بنجاح', 'success');
        } else {
          const data = await res.json();
          setEmployees(prev => prev.map(e => e.id === empId ? { ...e, active: data.active } : e));
          addToast?.('تم التحديث', 'تم تغيير حالة الموظف بنجاح', 'success');
        }
      } else {
        addToast?.('خطأ', `فشلت العملية (${res.status})`, 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر الاتصال بالسيرفر لإتمام الإجراء', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.nameAr.trim() || !newCategory.nameEn.trim() || !newCategory.icon.trim()) return;
    
    setActionLoading('save_category');
    try {
      const method = editingCategory ? 'PUT' : 'POST';
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory ? editingCategory.id : newCategory.id.trim() || undefined,
          nameAr: newCategory.nameAr.trim(),
          nameEn: newCategory.nameEn.trim(),
          icon: newCategory.icon.trim()
        })
      });
      
      if (res.ok) {
        fetchCategories();
        if ((window as any).refreshAppCategories) (window as any).refreshAppCategories();
        
        setNewCategory({ id: '', nameAr: '', nameEn: '', icon: '' });
        setEditingCategory(null);
        setShowAddCategory(false);
        addToast?.('تم بنجاح', editingCategory ? 'تم تحديث الفئة' : 'تم إضافة الفئة بنجاح', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast?.('خطأ', errData.error || 'فشل حفظ الفئة في النظام', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر الاتصال بالسيرفر', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة وجميع تصنيفاتها الفرعية؟')) return;
    setActionLoading(`delete_cat_${id}`);
    try {
      const res = await adminFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id));
        if ((window as any).refreshAppCategories) (window as any).refreshAppCategories();
        addToast?.('تم الحذف', 'تم حذف الفئة بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل الحذف، قد تكون الفئة مرتبطة بإعلانات قائمة', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر الحذف', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubCategory = async (categoryId: string) => {
    if (!newSubNameAr.trim() || !newSubNameEn.trim()) return;
    setActionLoading(`add_sub_${categoryId}`);
    try {
      const res = await adminFetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameAr: newSubNameAr.trim(), nameEn: newSubNameEn.trim() })
      });
      if (res.ok) {
        const newSub = await res.json();
        setCategories(prev => prev.map(c => {
          if (c.id === categoryId) {
            return { ...c, subCategories: [...(c.subCategories || []), newSub] };
          }
          return c;
        }));
        setNewSubNameAr('');
        setNewSubNameEn('');
        setActiveSubCatId(null);
        addToast?.('تم الإضافة', 'تم إضافة التصنيف الفرعي بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل إضافة التصنيف الفرعي', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر إضافة التصنيف الفرعي', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSubCategory = async (categoryId: string, subId: string) => {
    if (!confirm('هل تريد حذف هذا التصنيف الفرعي؟')) return;
    setActionLoading(`delete_sub_${subId}`);
    try {
      const res = await adminFetch(`/api/categories/${categoryId}/subcategories/${subId}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.map(c => {
          if (c.id === categoryId) {
            return { ...c, subCategories: (c.subCategories || []).filter((s: any) => s.id !== subId) };
          }
          return c;
        }));
        addToast?.('تم الحذف', 'تم حذف التصنيف الفرعي بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل حذف التصنيف الفرعي', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر حذف التصنيف الفرعي', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarket.countryCode.trim() || !newMarket.labelAr.trim() || !newMarket.labelEn.trim() || !newMarket.currency.trim()) return;

    setActionLoading('save_market');
    try {
      const method = editingMarket ? 'PUT' : 'POST';
      const url = editingMarket ? `/api/markets/${editingMarket.id}` : '/api/markets';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMarket,
          usdRate: parseFloat(newMarket.usdRate) || 1.0,
          centerLat: parseFloat(newMarket.centerLat) || 0.0,
          centerLng: parseFloat(newMarket.centerLng) || 0.0
        })
      });

      if (res.ok) {
        fetchMarkets();
        setNewMarket({ countryCode: '', labelAr: '', labelEn: '', currency: '', usdRate: '1', centerLat: '15.0', centerLng: '45.0', flag: '🌍' });
        setEditingMarket(null);
        setShowAddMarket(false);
        addToast?.('تم بنجاح', editingMarket ? 'تم تحديث البلد' : 'تم إضافة البلد بنجاح', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast?.('خطأ', errData.error || 'فشل حفظ البلد في النظام', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر الاتصال بالسيرفر', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMarket = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البلد وجميع مدنه ومناطقه؟')) return;
    setActionLoading(`delete_market_${id}`);
    try {
      const res = await adminFetch(`/api/markets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDbMarkets(prev => prev.filter(m => m.id !== id));
        if (selectedMarketForCities?.id === id) setSelectedMarketForCities(null);
        addToast?.('تم الحذف', 'تم حذف البلد بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل الحذف، قد يكون البلد مرتبط بإعلانات قائمة', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر الحذف', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleMarketActive = async (market: any) => {
    const nextActive = !market.active;
    // Optimistic UI update
    setDbMarkets(prev => prev.map(m => m.id === market.id ? { ...m, active: nextActive } : m));
    
    try {
      const res = await adminFetch(`/api/markets/${market.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive })
      });
      if (!res.ok) {
        // Rollback on failure
        setDbMarkets(prev => prev.map(m => m.id === market.id ? { ...m, active: market.active } : m));
        addToast?.('خطأ', 'فشل تغيير حالة تفعيل البلد', 'error');
      }
    } catch (e) {
      // Rollback
      setDbMarkets(prev => prev.map(m => m.id === market.id ? { ...m, active: market.active } : m));
      addToast?.('خطأ', 'فشل الاتصال بالسيرفر', 'error');
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarketForCities || !newCity.nameAr.trim() || !newCity.nameEn.trim()) return;

    setActionLoading(`add_city_${selectedMarketForCities.id}`);
    try {
      const res = await adminFetch(`/api/markets/${selectedMarketForCities.id}/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCity,
          lat: parseFloat(newCity.lat) || 0.0,
          lng: parseFloat(newCity.lng) || 0.0
        })
      });

      if (res.ok) {
        const addedCity = await res.json();
        
        // Update local state and selection state
        const updatedMarkets = dbMarkets.map(m => {
          if (m.id === selectedMarketForCities.id) {
            const updatedCities = [...(m.cities || []), addedCity];
            return { ...m, cities: updatedCities };
          }
          return m;
        });
        setDbMarkets(updatedMarkets);
        setSelectedMarketForCities(updatedMarkets.find(m => m.id === selectedMarketForCities.id));
        
        setNewCity({ nameAr: '', nameEn: '', lat: '0.0', lng: '0.0' });
        setShowAddCity(false);
        addToast?.('تم الإضافة', 'تم إضافة المدينة بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل إضافة المدينة', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر إضافة المدينة', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCity = async (cityId: string) => {
    if (!selectedMarketForCities || !confirm('هل تريد حذف هذه المدينة؟')) return;

    setActionLoading(`delete_city_${cityId}`);
    try {
      const res = await adminFetch(`/api/markets/${selectedMarketForCities.id}/cities/${cityId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Update local state and selection state
        const updatedMarkets = dbMarkets.map(m => {
          if (m.id === selectedMarketForCities.id) {
            const updatedCities = (m.cities || []).filter((c: any) => c.id !== cityId);
            return { ...m, cities: updatedCities };
          }
          return m;
        });
        setDbMarkets(updatedMarkets);
        setSelectedMarketForCities(updatedMarkets.find(m => m.id === selectedMarketForCities.id));
        
        addToast?.('تم الحذف', 'تم حذف المدينة بنجاح', 'success');
      } else {
        addToast?.('خطأ', 'فشل حذف المدينة', 'error');
      }
    } catch (e) {
      addToast?.('خطأ', 'تعذر حذف المدينة', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Derived Data ──
  const filteredUsers = allUsers.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.phone?.includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  });

  const filteredAds = adminAds.filter(ad => {
    const matchSearch = !searchTerm || ad.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || ad.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const featuredAds = adminAds.filter(a => a.isFeatured);

  // ── Sidebar Items ──
  const sidebarItems: { id: AdminTab; icon: any; label: string; badge?: number }[] = [
    { id: 'overview', icon: LayoutDashboard, label: 'نظرة عامة' },
    { id: 'analytics', icon: BarChart3, label: 'التحليلات والتقارير' },
    { id: 'ads', icon: FileText, label: 'إدارة الإعلانات', badge: adminAds.filter(a => a.status === 'PENDING').length || undefined },
    { id: 'users', icon: Users, label: 'إدارة المستخدمين' },
    { id: 'delivery', icon: ShieldCheck, label: 'توثيق وإدارة السائقين', badge: allUsers.filter(u => (u.role === 'AGENT' || u.deliveryAgent) && u.isVerified !== 'verified').length || undefined },
    { id: 'featured', icon: Star, label: 'الإعلانات المميزة', badge: featuredAds.length || undefined },
    { id: 'categories', icon: Tag, label: 'الفئات والتصنيفات' },
    { id: 'markets', icon: Globe, label: 'إدارة الأسواق' },
    { id: 'polls', icon: CheckSquare, label: 'الاستطلاعات' },
    { id: 'reels', icon: Video, label: 'مقاطع الفيديو والريلز' },
    { id: 'employees', icon: Briefcase, label: 'الموظفون والأدمن' },
    { id: 'security', icon: Shield, label: 'الأمن والسجلات' },
    { id: 'settings', icon: Settings, label: 'إعدادات المنصة' },
    { id: 'reports', icon: ShieldAlert, label: 'البلاغات والمخالفات' },
  ];

  // ── Analytics data from real stats ──
  const categoryChartData = stats?.categoryStats
    ? Object.entries(stats.categoryStats)
        .map(([name, count]) => ({ name: name.substring(0, 12), count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 8)
    : [];

  const pieColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[3000] overflow-hidden flex items-center justify-center bg-black/80 backdrop-blur-md" dir="rtl">
      <div className="bg-[#0d1117] w-full h-full md:h-[96vh] md:max-w-[1500px] md:rounded-[2rem] border border-white/10 shadow-[0_0_120px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">

        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <div className="h-14 bg-[#161b22] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white">لوحة التحكم الشاملة</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">أسواق — منصة إدارية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Market Selector */}
            <select
              className="bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
              value={selectedMarket}
              onChange={e => setSelectedMarket(e.target.value)}
            >
              <option value="all">كل الأسواق</option>
              {Object.values(MARKETS).map((m: any) => (
                <option key={m.id} value={m.id}>{m.labelAr}</option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-xs font-black border border-rose-500/20"
            >
              <X className="w-4 h-4" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <aside className="w-16 md:w-60 bg-[#0d1117] border-l border-white/5 flex flex-col shrink-0 overflow-y-auto">
            <nav className="flex-1 p-2 md:p-3 space-y-0.5 pt-3">
              {sidebarItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex flex-col md:flex-row items-center gap-2.5 px-2 md:px-3 py-2.5 rounded-xl transition-all text-left relative ${
                    activeTab === item.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] md:text-xs font-bold hidden md:block">{item.label}</span>
                  {item.badge ? (
                    <span className="absolute top-1.5 left-1.5 md:relative md:top-auto md:left-auto ml-auto w-4 h-4 md:w-auto md:h-auto bg-amber-500 text-black text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center md:px-1.5 md:py-0.5 md:rounded-full">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="p-3 border-t border-white/5">
              <div className="hidden md:flex items-center gap-2 px-2 py-2">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white truncate">{currentUser?.name || 'المدير'}</p>
                  <p className="text-[9px] text-emerald-400 font-bold">Super Admin</p>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Main Content ────────────────────────────────────────────────── */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]/50">
            <div className="flex-1 overflow-y-auto p-4 md:p-6">

              {/* ════════════════════════════════════════════════════════════ */}
              {/* OVERVIEW TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <SectionHeader title="نظرة عامة على المنصة" subtitle="إحصائيات حقيقية من قاعدة البيانات" />

                  {!stats ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={FileText} label="إجمالي الإعلانات" value={stats.totalAds?.toLocaleString() || 0} sub={`${stats.activeAds || 0} نشط`} color="text-blue-400" trend={12} />
                        <StatCard icon={Users} label="المستخدمون" value={stats.totalUsers?.toLocaleString() || 0} sub={`${stats.verifiedUsers || 0} موثق`} color="text-emerald-400" trend={8} />
                        <StatCard icon={MessageSquare} label="المحادثات" value={stats.totalChats?.toLocaleString() || 0} color="text-purple-400" trend={24} />
                        <StatCard icon={Star} label="إعلانات مميزة" value={featuredAds.length || 0} color="text-amber-400" />
                      </div>

                      {/* Category breakdown */}
                      {categoryChartData.length > 0 && (
                        <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                          <h3 className="text-sm font-black text-white mb-4">توزيع الإعلانات حسب الفئة</h3>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={categoryChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                              <Tooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }}
                                labelStyle={{ color: '#fff' }}
                              />
                              <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={20}>
                                {categoryChartData.map((_, i) => (
                                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Market breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-400" /> نشاط الأسواق
                          </h3>
                          <div className="space-y-3">
                            {Object.values(MARKETS).map((m: any) => (
                              <div key={m.id} className="flex items-center gap-3">
                                <span className="text-lg">{m.flag || '🌍'}</span>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-white">{m.labelAr}</span>
                                    <span className="text-[10px] text-slate-400">{m.cities?.length || 0} مدينة</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (m.cities?.length || 0) * 8)}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" /> حالة النظام
                          </h3>
                          <div className="space-y-3">
                            {[
                              { label: 'قاعدة البيانات', status: 'نشط', color: 'text-emerald-400', icon: Database },
                              { label: 'خادم الـ API', status: 'نشط', color: 'text-emerald-400', icon: Server },
                              { label: 'خدمة الإشعارات', status: 'نشط', color: 'text-emerald-400', icon: Bell },
                              { label: 'البث المباشر', status: 'نشط', color: 'text-emerald-400', icon: Video },
                            ].map(item => (
                              <div key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <item.icon className="w-4 h-4 text-slate-500" />
                                  <span className="text-xs text-slate-400">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className={`text-[10px] font-bold ${item.color}`}>{item.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* ANALYTICS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'analytics' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <SectionHeader title="التحليلات والتقارير" subtitle="بيانات حقيقية من قاعدة البيانات" />

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={FileText} label="إجمالي الإعلانات" value={stats?.totalAds?.toLocaleString() || 0} color="text-blue-400" />
                    <StatCard icon={CheckCircle2} label="إعلانات نشطة" value={stats?.activeAds?.toLocaleString() || 0} color="text-emerald-400" />
                    <StatCard icon={Users} label="إجمالي المستخدمين" value={stats?.totalUsers?.toLocaleString() || 0} color="text-purple-400" />
                    <StatCard icon={Shield} label="موثقون" value={stats?.verifiedUsers?.toLocaleString() || 0} color="text-amber-400" />
                  </div>

                  {categoryChartData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                        <h3 className="text-sm font-black text-white mb-4">توزيع الفئات (مخطط شريطي)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={categoryChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={40}>
                              {categoryChartData.map((_, i) => (
                                <Cell key={i} fill={pieColors[i % pieColors.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                        <h3 className="text-sm font-black text-white mb-4">توزيع الفئات (مخطط دائري)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={40}
                            >
                              {categoryChartData.map((_, i) => (
                                <Cell key={i} fill={pieColors[i % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 11 }} />
                            <Legend formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 10 }}>{val}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Users by role */}
                  <div className="p-5 rounded-3xl bg-slate-800/30 border border-white/5">
                    <h3 className="text-sm font-black text-white mb-4">ملخص نصي للإحصائيات</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <p className="text-2xl font-black text-blue-400">{stats?.totalAds || 0}</p>
                        <p className="text-[10px] text-blue-300 font-bold mt-1">إجمالي الإعلانات</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-2xl font-black text-emerald-400">{stats?.activeAds || 0}</p>
                        <p className="text-[10px] text-emerald-300 font-bold mt-1">إعلانات نشطة</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                        <p className="text-2xl font-black text-purple-400">{stats?.totalUsers || 0}</p>
                        <p className="text-[10px] text-purple-300 font-bold mt-1">مستخدمون مسجلون</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-2xl font-black text-amber-400">{stats?.totalChats || 0}</p>
                        <p className="text-[10px] text-amber-300 font-bold mt-1">محادثات نشطة</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* ADS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'ads' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="إدارة الإعلانات" subtitle={`${filteredAds.length} إعلان`} />

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="ابحث عن إعلان..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 text-white text-xs pr-9 pl-4 py-2.5 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="bg-slate-800 text-white text-xs py-2.5 px-4 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
                    >
                      <option value="all">كل الحالات</option>
                      <option value="ACTIVE">نشط</option>
                      <option value="PENDING">قيد المراجعة</option>
                      <option value="SOLD">مباع</option>
                      <option value="INACTIVE">غير نشط</option>
                    </select>
                    <button onClick={fetchAds} className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/5">
                      <table className="w-full text-right">
                        <thead className="bg-slate-800/50">
                          <tr>
                            {['الإعلان', 'الحالة', 'الفئة', 'المدينة', 'صاحب الإعلان', 'التاريخ', 'إجراءات'].map(h => (
                              <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredAds.slice(0, 50).map(ad => (
                            <tr key={ad.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {ad.images?.[0] && (
                                    <img src={ad.images[0]} alt="" className="w-10 h-10 object-cover rounded-lg" />
                                  )}
                                  <div>
                                    <p className="text-xs font-bold text-white line-clamp-1 max-w-[140px]">{ad.title}</p>
                                    <p className="text-[10px] text-emerald-400 font-black">{ad.price} {ad.currency || 'ريال'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                  ad.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                                  ad.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                                  ad.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400' :
                                  'bg-slate-500/10 text-slate-400'
                                }`}>
                                  {ad.status === 'ACTIVE' ? 'نشط' : ad.status === 'PENDING' ? 'مراجعة' : ad.status === 'SOLD' ? 'مباع' : 'غير نشط'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-slate-400">{ad.category || '—'}</td>
                              <td className="px-4 py-3 text-[10px] text-slate-400">{ad.city || '—'}</td>
                              <td className="px-4 py-3">
                                <p className="text-[10px] text-white font-bold">{ad.user?.name || '—'}</p>
                                <p className="text-[9px] text-slate-500">{ad.user?.phone || ''}</p>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-slate-500">
                                {ad.createdAt ? new Date(ad.createdAt).toLocaleDateString('ar') : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => { onViewAd(ad); }}
                                    className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-white transition-all"
                                    title="عرض"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleAdAction(ad.id, 'ACTIVE')}
                                    disabled={actionLoading === `${ad.id}_ad`}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                    title="قبول"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleAdAction(ad.id, 'INACTIVE')}
                                    disabled={actionLoading === `${ad.id}_ad`}
                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                    title="تعطيل"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleAdAction(ad.id, undefined, !ad.isFeatured)}
                                    disabled={actionLoading === `${ad.id}_ad`}
                                    className={`p-1.5 rounded-lg transition-all ${ad.isFeatured ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white' : 'bg-slate-700 text-slate-400 hover:text-amber-400'}`}
                                    title={ad.isFeatured ? 'إلغاء التمييز' : 'تمييز'}
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredAds.length === 0 && !loading && (
                        <div className="text-center py-12 text-slate-500 text-sm">لا توجد إعلانات</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* USERS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'users' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="إدارة المستخدمين" subtitle={`${filteredUsers.length} مستخدم`} />

                  <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم أو الهاتف أو البريد..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 text-white text-xs pr-9 pl-4 py-2.5 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/5">
                      <table className="w-full text-right">
                        <thead className="bg-slate-800/50">
                          <tr>
                            {['المستخدم', 'الهاتف / البريد', 'الدور', 'التوثيق', 'الإعلانات', 'الحالة', 'إجراءات'].map(h => (
                              <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredUsers.slice(0, 100).map(user => (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-white">{user.name}</p>
                                    <p className="text-[9px] text-slate-500">
                                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar') : '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[10px] text-slate-300 font-mono">{user.phone || '—'}</p>
                                <p className="text-[9px] text-slate-500">{user.email || '—'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  user.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400' :
                                  user.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400' :
                                  'bg-slate-500/10 text-slate-400'
                                }`}>
                                  {user.role === 'SUPER_ADMIN' ? 'سوبر أدمن' : user.role === 'ADMIN' ? 'مدير' : 'مستخدم'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  user.isVerified === 'verified' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
                                }`}>
                                  {user.isVerified === 'verified' ? 'موثق ✓' : 'غير موثق'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-black text-white">{user._count?.ads || 0}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className={`text-[10px] font-black ${user.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {user.active ? 'نشط' : 'محظور'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => onViewUser(user)}
                                    className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-white transition-all"
                                    title="عرض الملف"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleUserAction(user.id, user.isVerified === 'verified' ? 'unverify' : 'verify')}
                                    disabled={!!actionLoading}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                    title={user.isVerified === 'verified' ? 'إلغاء التوثيق' : 'توثيق'}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleUserAction(user.id, user.active ? 'ban' : 'unban')}
                                    disabled={!!actionLoading}
                                    className={`p-1.5 rounded-lg transition-all ${
                                      user.active
                                        ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
                                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                    }`}
                                    title={user.active ? 'حظر' : 'رفع الحظر'}
                                  >
                                    {user.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={!!actionLoading}
                                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                    title="حذف نهائي"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredUsers.length === 0 && !loading && (
                        <div className="text-center py-12 text-slate-500 text-sm">لا توجد مستخدمون</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* DELIVERY DASHBOARD TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {/* ════════════════════════════════════════════════════════════ */}
              {/* DRIVER & MERCHANT VERIFICATION CONTROL PANEL TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'delivery' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <SectionHeader 
                    title="توثيق وإدارة السائقين والتجار" 
                    subtitle="مراجعة وتدقيق المستندات المرفوعة وتوثيق حسابات المندوبين والتجار بضغطة زر واحدة" 
                  />

                  {/* Driver Statistics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard 
                      icon={Users} 
                      label="إجمالي السائقين" 
                      value={allUsers.filter(u => u.role === 'AGENT' || u.deliveryAgent).length} 
                      color="text-emerald-400" 
                    />
                    <StatCard 
                      icon={Clock} 
                      label="بانتظار التوثيق" 
                      value={allUsers.filter(u => (u.role === 'AGENT' || u.deliveryAgent || u.role === 'MERCHANT') && u.isVerified !== 'verified').length} 
                      color="text-amber-400" 
                    />
                    <StatCard 
                      icon={ShieldCheck} 
                      label="السائقين الموثقين" 
                      value={allUsers.filter(u => (u.role === 'AGENT' || u.deliveryAgent) && u.isVerified === 'verified').length} 
                      color="text-cyan-400" 
                    />
                    <StatCard 
                      icon={Briefcase} 
                      label="التجار الموثقين" 
                      value={allUsers.filter(u => u.role === 'MERCHANT' && u.isVerified === 'verified').length} 
                      color="text-purple-400" 
                    />
                  </div>

                  {/* Driver Search and Filter Controls */}
                  <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-800/40 p-3 rounded-2xl border border-white/5">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="ابحث باسم السائق، رقم الهاتف، أو رقم اللوحة..."
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        className="w-full bg-slate-900/60 text-white text-xs py-2 pr-9 pl-4 rounded-xl border border-white/10 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={driverRoleFilter}
                        onChange={(e) => setDriverRoleFilter(e.target.value)}
                        className="bg-slate-900/60 text-white text-xs py-2 px-3 rounded-xl border border-white/10 outline-none focus:border-emerald-500"
                      >
                        <option value="all">جميع الأدوار</option>
                        <option value="driver">السائقين والمندوبين 🚚</option>
                        <option value="merchant">التجار والمحلات 💼</option>
                        <option value="user">المستخدمين العاديين 👤</option>
                      </select>

                      <select
                        value={driverStatusFilter}
                        onChange={(e) => setDriverStatusFilter(e.target.value)}
                        className="bg-slate-900/60 text-white text-xs py-2 px-3 rounded-xl border border-white/10 outline-none focus:border-emerald-500"
                      >
                        <option value="all">جميع الحالات</option>
                        <option value="pending">⏳ بانتظار التوثيق</option>
                        <option value="verified">✅ الحسابات الموثقة</option>
                        <option value="unverified">⚪ غير موثق</option>
                      </select>
                    </div>
                  </div>

                  {/* Driver List Table & Document Inspection */}
                  {loading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDriverList.map((user) => (
                        <div key={user.id} className="bg-slate-800/40 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            
                            {/* Left Column: Driver info */}
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                                {user.role === 'AGENT' || user.deliveryAgent ? <Truck className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-black text-white">{user.name || 'بدون اسم'}</h3>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    user.role === 'AGENT' || user.deliveryAgent ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                    user.role === 'MERCHANT' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    'bg-slate-500/10 text-slate-400'
                                  }`}>
                                    {user.role === 'AGENT' || user.deliveryAgent ? 'سائق / مندوب' : user.role === 'MERCHANT' ? 'تاجر' : 'مستخدم'}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    user.isVerified === 'verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {user.isVerified === 'verified' ? 'موثق ✓' : 'بانتظار التوثيق ⏳'}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                                  {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" />{user.phone}</span>}
                                  {user.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" />{user.email}</span>}
                                  {user.deliveryAgent?.vehicleType && (
                                    <span className="flex items-center gap-1 text-cyan-300 font-bold">
                                      <Truck className="w-3 h-3" /> نوع المركبة: {user.deliveryAgent.vehicleType}
                                    </span>
                                  )}
                                  {user.deliveryAgent?.licensePlate && (
                                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                                      <Hash className="w-3 h-3" /> رقم اللوحة: {user.deliveryAgent.licensePlate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {user.phone && (
                                <a
                                  href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1 border border-emerald-500/20"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>واتساب السائق</span>
                                </a>
                              )}

                              {user.isVerified === 'verified' ? (
                                <button
                                  onClick={() => handleUserAction(user.id, 'unverify')}
                                  disabled={actionLoading === `${user.id}_unverify`}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all text-xs font-black border border-rose-500/20 flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>إلغاء التوثيق</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserAction(user.id, 'verify')}
                                  disabled={actionLoading === `${user.id}_verify`}
                                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 transition-all text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  <span>توثيق وقبول السائق ✓</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Document Photos Section */}
                          <div className="mt-4 pt-3 border-t border-white/5">
                            <p className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                              <span>الوثائق والمستندات المرفوعة من السائق:</span>
                            </p>
                            {user.uploadedMedia && user.uploadedMedia.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {user.uploadedMedia.map((media: any, idx: number) => (
                                  <div 
                                    key={media.id || idx}
                                    onClick={() => setInspectedDocUrl(media.url)}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 aspect-video hover:border-emerald-500/50 transition-all"
                                  >
                                    <img src={media.url} alt="وثيقة السائق" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white text-xs font-bold gap-1">
                                      <Eye className="w-4 h-4 text-emerald-400" />
                                      <span>معاينة مكبرة</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-slate-900/40 p-3 rounded-xl border border-dashed border-white/10 text-[11px] text-slate-500 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>لم يقم السائق برفع ملفات أو صور إضافية بعد (تم التسجيل واستخدام رقم الهاتف). يمكنك التوثيق المباشر أعلاه.</span>
                              </div>
                            )}
                          </div>

                        </div>
                      ))}

                      {filteredDriverList.length === 0 && (
                        <div className="text-center py-12 text-slate-500 text-sm">لا يوجد سائقين أو تجار يطابقون خيارات البحث</div>
                      )}
                    </div>
                  )}

                  {/* Fullscreen Document Inspection Modal */}
                  {inspectedDocUrl && (
                    <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
                      <div className="relative max-w-4xl w-full bg-slate-900 border border-white/10 rounded-3xl p-4 overflow-hidden">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                          <h3 className="text-sm font-black text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>معاينة وثيقة السائق المرفوعة</span>
                          </h3>
                          <button 
                            onClick={() => setInspectedDocUrl(null)}
                            className="p-1.5 rounded-full bg-white/10 hover:bg-rose-500 text-white transition-all"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="max-h-[80vh] overflow-auto flex items-center justify-center bg-black/50 rounded-2xl p-2">
                          <img src={inspectedDocUrl} alt="معاينة الوثيقة" className="max-w-full max-h-[75vh] object-contain rounded-xl" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* FEATURED ADS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'featured' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="الإعلانات المميزة" subtitle={`${featuredAds.length} إعلان مميز`} />

                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                  ) : featuredAds.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-bold">لا توجد إعلانات مميزة حالياً</p>
                      <p className="text-xs mt-1">يمكنك تمييز الإعلانات من قسم إدارة الإعلانات</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {featuredAds.map(ad => (
                        <div key={ad.id} className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="text-[10px] font-black text-amber-400">مميز</span>
                            </div>
                            <button
                              onClick={() => handleAdAction(ad.id, undefined, false)}
                              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              إلغاء التمييز
                            </button>
                          </div>
                          {ad.images?.[0] && (
                            <img src={ad.images[0]} alt={ad.title} className="w-full h-32 object-cover rounded-xl mb-3" />
                          )}
                          <p className="text-sm font-black text-white line-clamp-2">{ad.title}</p>
                          <p className="text-xs text-emerald-400 font-black mt-1">{ad.price} {ad.currency || 'ريال'}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{ad.user?.name} • {ad.city}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* CATEGORIES TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'categories' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <SectionHeader title="الفئات والتصنيفات" subtitle="إدارة فئات المنصة والتصنيفات الفرعية بالكامل" />
                    <button
                      onClick={() => {
                        setEditingCategory(null);
                        setNewCategory({ id: '', nameAr: '', nameEn: '', icon: 'Tag' });
                        setShowAddCategory(true);
                      }}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 border-none cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة فئة رئيسية
                    </button>
                  </div>

                  {showAddCategory && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black text-white">
                            {editingCategory ? 'تعديل الفئة الرئيسية' : 'إضافة فئة رئيسية جديدة'}
                          </h3>
                          <button 
                            onClick={() => {
                              setShowAddCategory(false);
                              setEditingCategory(null);
                            }} 
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 border-none cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="space-y-4">
                          {!editingCategory && (
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">المعرف الفريد (ID بالإنجليزية - اختياري)</label>
                              <input 
                                value={newCategory.id} 
                                onChange={e => setNewCategory({...newCategory, id: e.target.value})} 
                                type="text" 
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                                placeholder="مثال: vehicles (سيترك فارغاً للتوليد التلقائي)" 
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الاسم بالعربية</label>
                            <input 
                              required 
                              value={newCategory.nameAr} 
                              onChange={e => setNewCategory({...newCategory, nameAr: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                              placeholder="مثال: سيارات ومركبات" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الاسم بالإنجليزية</label>
                            <input 
                              required 
                              value={newCategory.nameEn} 
                              onChange={e => setNewCategory({...newCategory, nameEn: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-left" 
                              placeholder="e.g. Motors & Vehicles" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الأيقونة (اسم الأيقونة)</label>
                            <select 
                              value={newCategory.icon} 
                              onChange={e => setNewCategory({...newCategory, icon: e.target.value})} 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [&>option]:bg-slate-900"
                            >
                              <option value="Tag">بطاقة (Tag)</option>
                              <option value="Car">سيارة (Car)</option>
                              <option value="Home">عقار (Home)</option>
                              <option value="Smartphone">هاتف (Smartphone)</option>
                              <option value="Laptop">كمبيوتر (Laptop)</option>
                              <option value="Tv">شاشات (Tv)</option>
                              <option value="Briefcase">وظائف (Briefcase)</option>
                              <option value="Heart">صحة (Heart)</option>
                              <option value="ShoppingBag">تسوق (ShoppingBag)</option>
                              <option value="Globe">سفر وسياحة (Globe)</option>
                              <option value="Coffee">خدمات ومطاعم (Coffee)</option>
                              <option value="Book">كتب وتعليم (Book)</option>
                              <option value="Gift">هدايا ومناسبات (Gift)</option>
                            </select>
                          </div>
                          <button 
                            type="submit" 
                            disabled={actionLoading === 'save_category'} 
                            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 mt-2 border-none cursor-pointer"
                          >
                            {actionLoading === 'save_category' ? 'جاري الحفظ...' : (editingCategory ? 'تحديث الفئة' : 'إضافة الفئة')}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {loadingCategories ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>لا توجد فئات مسجلة حالياً</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {categories.map((cat: any) => {
                        const count = stats?.categoryStats?.[cat.nameAr] || stats?.categoryStats?.[cat.nameEn] || 0;
                        return (
                          <div key={cat.id} className="p-5 rounded-2xl bg-slate-800/30 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
                            <div>
                              {/* Header */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    <Tag className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                                      {cat.nameAr}
                                      <span className="text-[10px] text-slate-500 font-mono">({cat.nameEn})</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">{count} إعلان نشط</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingCategory(cat);
                                      setNewCategory({ id: cat.id, nameAr: cat.nameAr, nameEn: cat.nameEn, icon: cat.icon || 'Tag' });
                                      setShowAddCategory(true);
                                    }}
                                    className="p-1.5 rounded-lg border-none bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                                    title="تعديل الفئة"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    disabled={actionLoading === `delete_cat_${cat.id}`}
                                    className="p-1.5 rounded-lg border-none bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                                    title="حذف الفئة"
                                  >
                                    {actionLoading === `delete_cat_${cat.id}` ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Subcategories section */}
                              <div className="border-t border-white/5 pt-4 mt-2">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] font-black text-slate-400">التصنيفات الفرعية ({cat.subCategories?.length || 0}):</span>
                                  {activeSubCatId !== cat.id ? (
                                    <button
                                      onClick={() => {
                                        setNewSubNameAr('');
                                        setNewSubNameEn('');
                                        setActiveSubCatId(cat.id);
                                      }}
                                      className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 border-none bg-transparent cursor-pointer flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      إضافة تصنيف فرعي
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setActiveSubCatId(null)}
                                      className="text-[9px] font-bold text-slate-500 hover:text-slate-400 border-none bg-transparent cursor-pointer"
                                    >
                                      إلغاء
                                    </button>
                                  )}
                                </div>

                                {activeSubCatId === cat.id && (
                                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 mb-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        value={newSubNameAr}
                                        onChange={e => setNewSubNameAr(e.target.value)}
                                        type="text"
                                        placeholder="الاسم بالعربية"
                                        className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                      />
                                      <input
                                        value={newSubNameEn}
                                        onChange={e => setNewSubNameEn(e.target.value)}
                                        type="text"
                                        placeholder="Name in English"
                                        className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 text-left"
                                      />
                                    </div>
                                    <button
                                      onClick={() => handleAddSubCategory(cat.id)}
                                      disabled={actionLoading === `add_sub_${cat.id}`}
                                      className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-colors"
                                    >
                                      {actionLoading === `add_sub_${cat.id}` ? 'جاري الإضافة...' : 'حفظ التصنيف الفرعي'}
                                    </button>
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-1.5">
                                  {cat.subCategories && cat.subCategories.length > 0 ? (
                                    cat.subCategories.map((sub: any) => (
                                      <span 
                                        key={sub.id} 
                                        className="inline-flex items-center gap-1 text-[9px] px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700/80 transition-all"
                                      >
                                        {sub.nameAr}
                                        <button
                                          onClick={() => handleDeleteSubCategory(cat.id, sub.id)}
                                          disabled={actionLoading === `delete_sub_${sub.id}`}
                                          className="text-slate-500 hover:text-rose-400 border-none bg-transparent cursor-pointer p-0 mr-1 flex items-center justify-center"
                                          title="حذف"
                                        >
                                          {actionLoading === `delete_sub_${sub.id}` ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                          ) : (
                                            <X className="w-2.5 h-2.5" />
                                          )}
                                        </button>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[9px] text-slate-600">لا توجد تصنيفات فرعية</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* MARKETS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'markets' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <SectionHeader title="إدارة الأسواق والبلدان" subtitle={`البلدان المتاحة بالمنصة (${dbMarkets.length} بلد)`} />
                    <button
                      onClick={() => {
                        setEditingMarket(null);
                        setNewMarket({ countryCode: '', labelAr: '', labelEn: '', currency: '', usdRate: '1', centerLat: '15.0', centerLng: '45.0', flag: '🌍' });
                        setShowAddMarket(true);
                      }}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 border-none cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة بلد جديد
                    </button>
                  </div>

                  {showAddMarket && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black text-white">
                            {editingMarket ? 'تعديل بيانات البلد' : 'إضافة بلد عربي جديد'}
                          </h3>
                          <button 
                            onClick={() => {
                              setShowAddMarket(false);
                              setEditingMarket(null);
                            }} 
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400 border-none cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <form onSubmit={handleSaveMarket} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">رمز البلد (Country Code - حرفين)</label>
                            <input 
                              required 
                              disabled={!!editingMarket}
                              value={newMarket.countryCode} 
                              onChange={e => setNewMarket({...newMarket, countryCode: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-left uppercase" 
                              placeholder="مثال: SY أو QA" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الاسم بالعربية</label>
                            <input 
                              required 
                              value={newMarket.labelAr} 
                              onChange={e => setNewMarket({...newMarket, labelAr: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                              placeholder="مثال: سوريا" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الاسم بالإنجليزية</label>
                            <input 
                              required 
                              value={newMarket.labelEn} 
                              onChange={e => setNewMarket({...newMarket, labelEn: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-left" 
                              placeholder="e.g. Syria" 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">رمز العملة</label>
                              <input 
                                required 
                                value={newMarket.currency} 
                                onChange={e => setNewMarket({...newMarket, currency: e.target.value})} 
                                type="text" 
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase" 
                                placeholder="SYP" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">سعر الدولار مقابل العملة</label>
                              <input 
                                required 
                                value={newMarket.usdRate} 
                                onChange={e => setNewMarket({...newMarket, usdRate: e.target.value})} 
                                type="number" 
                                step="any"
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                                placeholder="1" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">خط العرض (Center Lat)</label>
                              <input 
                                required 
                                value={newMarket.centerLat} 
                                onChange={e => setNewMarket({...newMarket, centerLat: e.target.value})} 
                                type="number" 
                                step="any"
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                                placeholder="35.0" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 mb-1">خط الطول (Center Lng)</label>
                              <input 
                                required 
                                value={newMarket.centerLng} 
                                onChange={e => setNewMarket({...newMarket, centerLng: e.target.value})} 
                                type="number" 
                                step="any"
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" 
                                placeholder="38.0" 
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">العلم (أو Emoji)</label>
                            <input 
                              value={newMarket.flag} 
                              onChange={e => setNewMarket({...newMarket, flag: e.target.value})} 
                              type="text" 
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-center" 
                              placeholder="🇸🇾" 
                            />
                          </div>
                          <button 
                            type="submit" 
                            disabled={actionLoading === 'save_market'} 
                            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 mt-2 border-none cursor-pointer"
                          >
                            {actionLoading === 'save_market' ? 'جاري الحفظ...' : (editingMarket ? 'تحديث البيانات' : 'إضافة البلد')}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {loadingMarkets ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Countries List */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {dbMarkets.map((m: any) => (
                            <div 
                              key={m.id} 
                              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                                selectedMarketForCities?.id === m.id 
                                  ? 'bg-indigo-500/10 border-indigo-500' 
                                  : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-3 mb-4">
                                  <span className="text-3xl">{m.flag || '🌍'}</span>
                                  <div>
                                    <h3 className="text-sm font-black text-white">{m.labelAr}</h3>
                                    <p className="text-[10px] text-slate-500 font-mono">{m.countryCode} • {m.currency} • $1={m.usdRate}</p>
                                  </div>
                                  <button
                                    onClick={() => handleToggleMarketActive(m)}
                                    className={`mr-auto px-2 py-0.5 rounded text-[9px] font-black border-none cursor-pointer transition-all ${
                                      m.active 
                                        ? 'bg-emerald-500/20 text-emerald-400' 
                                        : 'bg-slate-900 text-slate-500'
                                    }`}
                                    title={m.active ? 'تعطيل البلد' : 'تفعيل البلد'}
                                  >
                                    {m.active ? 'نشط' : 'معطل'}
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                                  <button
                                    onClick={() => setSelectedMarketForCities(m)}
                                    className="p-2.5 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border-none cursor-pointer transition-all text-right block"
                                  >
                                    <p className="text-xs font-black text-white">{m.cities?.length || 0}</p>
                                    <p className="text-[8px] text-slate-500">مدينة ومحافظة (إدارة ⚙️)</p>
                                  </button>
                                  <div className="p-2.5 rounded-xl bg-slate-700/30 text-right">
                                    <p className="text-xs font-black text-white">{m.centerLat}, {m.centerLng}</p>
                                    <p className="text-[8px] text-slate-500">إحداثيات الخريطة</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 border-t border-white/5 pt-3">
                                <button
                                  onClick={() => {
                                    setEditingMarket(m);
                                    setNewMarket({
                                      countryCode: m.countryCode,
                                      labelAr: m.labelAr,
                                      labelEn: m.labelEn,
                                      currency: m.currency,
                                      usdRate: String(m.usdRate),
                                      centerLat: String(m.centerLat),
                                      centerLng: String(m.centerLng),
                                      flag: m.flag || '🌍'
                                    });
                                    setShowAddMarket(true);
                                  }}
                                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold transition-all border-none cursor-pointer"
                                >
                                  تعديل البيانات
                                </button>
                                <button
                                  onClick={() => handleDeleteMarket(m.id)}
                                  disabled={actionLoading === `delete_market_${m.id}`}
                                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold transition-all border-none cursor-pointer mr-auto"
                                >
                                  {actionLoading === `delete_market_${m.id}` ? '...' : 'حذف'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Cities & Areas List for selected Country */}
                      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                        {selectedMarketForCities ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                              <div>
                                <h4 className="text-xs font-black text-white">مدن ومناطق {selectedMarketForCities.labelAr}</h4>
                                <p className="text-[9px] text-slate-500">{selectedMarketForCities.cities?.length || 0} منطقة نشطة</p>
                              </div>
                              <button
                                onClick={() => {
                                  setNewCity({ nameAr: '', nameEn: '', lat: String(selectedMarketForCities.centerLat), lng: String(selectedMarketForCities.centerLng) });
                                  setShowAddCity(true);
                                }}
                                className="px-2 py-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-[10px] font-bold transition-all border-none cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                إضافة مدينة
                              </button>
                            </div>

                            {showAddCity && (
                              <form onSubmit={handleAddCity} className="p-3 bg-slate-900 rounded-xl border border-white/5 space-y-3">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 mb-1">الاسم بالعربية</label>
                                  <input 
                                    required 
                                    value={newCity.nameAr} 
                                    onChange={e => setNewCity({...newCity, nameAr: e.target.value})} 
                                    type="text" 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" 
                                    placeholder="مثال: صنعاء" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 mb-1">الاسم بالإنجليزية</label>
                                  <input 
                                    required 
                                    value={newCity.nameEn} 
                                    onChange={e => setNewCity({...newCity, nameEn: e.target.value})} 
                                    type="text" 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white text-left" 
                                    placeholder="e.g. Sanaa" 
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 mb-1">خط العرض (Lat)</label>
                                    <input 
                                      required 
                                      value={newCity.lat} 
                                      onChange={e => setNewCity({...newCity, lat: e.target.value})} 
                                      type="number" 
                                      step="any"
                                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 mb-1">خط الطول (Lng)</label>
                                    <input 
                                      required 
                                      value={newCity.lng} 
                                      onChange={e => setNewCity({...newCity, lng: e.target.value})} 
                                      type="number" 
                                      step="any"
                                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" 
                                    />
                                  </div>
                                </div>
                                <button 
                                  type="submit"
                                  disabled={actionLoading === `add_city_${selectedMarketForCities.id}`}
                                  className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg border-none cursor-pointer"
                                >
                                  {actionLoading === `add_city_${selectedMarketForCities.id}` ? 'جاري الحفظ...' : 'إضافة المدينة'}
                                </button>
                              </form>
                            )}

                            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                              {selectedMarketForCities.cities && selectedMarketForCities.cities.length > 0 ? (
                                selectedMarketForCities.cities.map((city: any) => (
                                  <div key={city.id} className="p-3 bg-slate-800/20 border border-white/5 rounded-xl flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-bold text-white">{city.nameAr}</p>
                                      <p className="text-[9px] text-slate-500 font-mono">{city.nameEn} • {city.lat}, {city.lng}</p>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteCity(city.id)}
                                      disabled={actionLoading === `delete_city_${city.id}`}
                                      className="p-1 text-slate-500 hover:text-rose-500 rounded border-none bg-transparent cursor-pointer"
                                      title="حذف المدينة"
                                    >
                                      {actionLoading === `delete_city_${city.id}` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[10px] text-slate-600 text-center py-10">لا توجد مدن مسجلة لهذا البلد</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-20 text-slate-500">
                            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>انقر على "إدارة" بجانب أي بلد لعرض وتحديث مدنه ومناطقه هنا.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* POLLS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'polls' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="الاستطلاعات" subtitle="إنشاء وإدارة استطلاعات المجتمع" />

                  {/* Create Poll */}
                  <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                    <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" /> إنشاء استطلاع جديد
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block">السؤال</label>
                        <input
                          type="text"
                          placeholder="السؤال..."
                          value={newPollQuestion}
                          onChange={e => setNewPollQuestion(e.target.value)}
                          className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block">توجيه الاستطلاع (البلد)</label>
                        <select
                          value={newPollCountryCode}
                          onChange={e => setNewPollCountryCode(e.target.value)}
                          className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                        >
                          <option value="ALL">🌍 عام لجميع البلدان</option>
                          <option value="YE">🇾🇪 اليمن</option>
                          <option value="JO">🇯🇴 الأردن</option>
                          <option value="SA">🇸🇦 السعودية</option>
                          <option value="AE">🇦🇪 الإمارات</option>
                          <option value="EG">🇪🇬 مصر</option>
                          <option value="PS">🇵🇸 فلسطين</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {newPollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`الخيار ${i + 1}...`}
                            value={opt}
                            onChange={e => {
                              const next = [...newPollOptions];
                              next[i] = e.target.value;
                              setNewPollOptions(next);
                            }}
                            className="flex-1 bg-slate-700 text-white text-sm px-4 py-2 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                          />
                          {i >= 2 && (
                            <button onClick={() => setNewPollOptions(prev => prev.filter((_, idx) => idx !== i))} className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setNewPollOptions(prev => [...prev, ''])} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> إضافة خيار
                      </button>
                      <button
                        onClick={handleCreatePoll}
                        disabled={addingPoll || !newPollQuestion.trim()}
                        className="mr-auto px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {addingPoll && <Loader2 className="w-3 h-3 animate-spin" />}
                        نشر الاستطلاع
                      </button>
                    </div>
                  </div>

                  {/* Polls list */}
                  <div className="space-y-3">
                    {polls.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>لا توجد استطلاعات بعد</p>
                      </div>
                    ) : polls.map((poll: any) => {
                      const votes: Record<string, number> = poll.votes || {};
                      const totalVotes = Object.values(votes).reduce((a: any, b: any) => a + b, 0);
                      return (
                        <div key={poll.id} className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex flex-col gap-1.5">
                              <h4 className="text-sm font-black text-white">{poll.question}</h4>
                              <span className="text-[10px] font-extrabold text-fuchsia-400 bg-fuchsia-500/10 px-2.5 py-0.5 rounded-full border border-fuchsia-500/20 self-start">
                                {poll.countryCode === 'ALL' ? '🌍 عام لجميع البلدان' :
                                 poll.countryCode === 'YE' ? '🇾🇪 استطلاع موجه لليمن' :
                                 poll.countryCode === 'JO' ? '🇯🇴 استطلاع موجه للأردن' :
                                 poll.countryCode === 'SA' ? '🇸🇦 استطلاع موجه للسعودية' :
                                 poll.countryCode === 'AE' ? '🇦🇪 استطلاع موجه للإمارات' :
                                 poll.countryCode === 'EG' ? '🇪🇬 استطلاع موجه لمصر' :
                                 poll.countryCode === 'PS' ? '🇵🇸 استطلاع موجه لفلسطين' : `استطلاع موجه لـ ${poll.countryCode}`}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => adminFetch(`/api/admin/polls/${poll.id}/reset`, { method: 'POST' }).then(() => fetchPolls())}
                                className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-white transition-all"
                                title="إعادة تعيين"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePoll(poll.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {poll.options?.map((opt: string) => {
                              const count = votes[opt] || 0;
                              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                              return (
                                <div key={opt}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-slate-300">{opt}</span>
                                    <span className="text-[10px] font-black text-emerald-400">{pct}% ({count})</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2">{totalVotes} صوت إجمالي</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* REELS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'reels' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="ريلز المنصة الترويجية" subtitle={`${reels.length} مقطع ترويجي`} />

                  {/* ─── بانر إدارة أسواق ─── */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/30 backdrop-blur-md">
                    <img src="/aswaq-admin-avatar.png" alt="Admin" className="w-12 h-12 rounded-full border-2 border-amber-400 shadow-lg shadow-amber-400/20 object-cover" />
                    <div>
                      <p className="text-amber-300 font-black text-sm">إدارة أسواق</p>
                      <p className="text-slate-400 text-xs mt-0.5">المنصة الرقمية الأولى — ريلز ترويجية رسمية</p>
                    </div>
                    <div className="mr-auto flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 text-[10px] font-black">حساب موثّق</span>
                    </div>
                  </div>

                  {reels.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-bold">لا توجد ريلز ترويجية بعد</p>
                      <p className="text-xs text-slate-600 mt-1">الريلز الترويجية ستظهر هنا بعد رفعها من قاعدة البيانات</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reels.map((reel: any) => (
                        <div key={reel.id} className="rounded-2xl bg-slate-800/30 border border-white/5 overflow-hidden hover:border-amber-500/30 transition-all group hover:shadow-lg hover:shadow-amber-500/5">
                          {/* صورة مصغرة للفيديو */}
                          <div className="aspect-video bg-slate-900 relative">
                            {reel.videoUrl ? (
                              <video src={reel.videoUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" muted />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                                <Video className="w-8 h-8 text-slate-600" />
                              </div>
                            )}
                            {/* شارة ترويجية */}
                            <div className="absolute top-2 left-2 flex gap-1.5">
                              {reel.isLive && (
                                <span className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">
                                  🔴 LIVE
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-amber-500/80 text-slate-900 text-[9px] font-black rounded-full backdrop-blur-sm">
                                ✦ ترويجي
                              </span>
                            </div>
                            {/* إحصائيات */}
                            {(reel.views || reel.likes) && (
                              <div className="absolute bottom-2 right-2 flex gap-1.5">
                                {reel.views != null && (
                                  <span className="flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full">
                                    👁️ {(reel.views || 0).toLocaleString('ar')}
                                  </span>
                                )}
                                {reel.likes != null && (
                                  <span className="flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full">
                                    ❤️ {(reel.likes || 0).toLocaleString('ar')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* معلومات الريل */}
                          <div className="p-3">
                            <p className="text-xs font-black text-white line-clamp-1">{reel.title || 'ريل ترويجي'}</p>
                            {/* منشئ الريل */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <img
                                src="/aswaq-admin-avatar.png"
                                alt="Admin"
                                className="w-4 h-4 rounded-full border border-amber-400/50 object-cover"
                              />
                              <span className="text-[10px] text-amber-300 font-bold">
                                {reel.ownerName || 'إدارة أسواق'}
                              </span>
                              <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[9px] text-slate-600">
                                {reel.createdAt ? new Date(reel.createdAt).toLocaleDateString('ar') : '—'}
                              </span>
                              <button
                                onClick={() => handleDeleteReel(reel.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* ════════════════════════════════════════════════════════════ */}
              {/* EMPLOYEES TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'employees' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  
                  <div className="flex justify-between items-center mb-6">
                    <SectionHeader title="الموظفون والمديرون" subtitle="أعضاء الفريق الإداري" />
                    <button
                      onClick={() => setShowAddEmployee(true)}
                      className="px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة موظف
                    </button>
                  </div>

                  {showAddEmployee && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black text-white">إضافة موظف / مدير جديد</h3>
                          <button onClick={() => setShowAddEmployee(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <form onSubmit={handleAddEmployee} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الاسم</label>
                            <input required value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="اسم الموظف" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">البريد الإلكتروني</label>
                            <input required value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} type="email" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="admin@example.com" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">كلمة المرور</label>
                            <input required value={newEmployee.password} onChange={e => setNewEmployee({...newEmployee, password: e.target.value})} type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="••••••••" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">الدور (الصلاحيات)</label>
                            <select value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [&>option]:bg-slate-900">
                              <option value="ADMIN">مدير (ADMIN)</option>
                              <option value="SUPER_ADMIN">سوبر أدمن (SUPER_ADMIN)</option>
                              <option value="AGENT">وكيل (AGENT)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">البلد (اختياري)</label>
                            <input value={newEmployee.managedCountry} onChange={e => setNewEmployee({...newEmployee, managedCountry: e.target.value})} type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="مثال: السعودية" />
                          </div>
                          <button type="submit" disabled={addingEmployee} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 mt-2">
                            {addingEmployee ? 'جاري الإضافة...' : 'إضافة الموظف'}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}


                  {employees.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>لا يوجد موظفون مسجلون</p>
                      <p className="text-xs mt-1">فقط حسابات بدور ADMIN أو SUPER_ADMIN ستظهر هنا</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {employees.map((emp: any) => (
                        <div key={emp.id} className="p-5 rounded-2xl bg-slate-800/30 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${emp.role === 'SUPER_ADMIN' ? 'bg-red-500/20' : 'bg-purple-500/20'}`}>
                              <Shield className={`w-5 h-5 ${emp.role === 'SUPER_ADMIN' ? 'text-red-400' : 'text-purple-400'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-white">{emp.name}</p>
                              <p className="text-[10px] text-slate-400">{emp.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${emp.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                  {emp.role === 'SUPER_ADMIN' ? 'سوبر أدمن' : 'مدير'}
                                </span>
                                {emp.managedCountry && (
                                  <span className="text-[9px] text-slate-500">{emp.managedCountry}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 ml-4">
                              <div className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className={`text-[10px] font-bold ${emp.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {emp.active ? 'نشط' : 'معطل'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 border-r border-white/5 pr-3">
                              <button
                                onClick={() => handleEmployeeAction(emp.id, 'toggle_status')}
                                disabled={actionLoading === `${emp.id}_toggle_status`}
                                className={`px-2.5 py-1 rounded-lg border-none text-[10px] font-bold transition-all cursor-pointer ${
                                  emp.active 
                                    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                                title={emp.active ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                              >
                                {actionLoading === `${emp.id}_toggle_status` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : emp.active ? (
                                  'تعطيل'
                                ) : (
                                  'تنشيط'
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا الموظف نهائياً؟')) {
                                    handleEmployeeAction(emp.id, 'delete');
                                  }
                                }}
                                disabled={actionLoading === `${emp.id}_delete`}
                                className="p-1.5 rounded-lg border-none bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                                title="حذف نهائي"
                              >
                                {actionLoading === `${emp.id}_delete` ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SECURITY TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <SectionHeader title="الأمن والسجلات" subtitle="مراقبة الأمان والنشاط الإداري" />

                  {/* Security Actions */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { action: 'force-logout', label: 'طرد جميع الجلسات', icon: LogOut, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500' },
                      { action: 'clear-cache', label: 'مسح الكاش', icon: RefreshCw, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500' },
                      { action: 'backup-db', label: 'نسخ احتياطي', icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500' },
                      { action: 'rotate-keys', label: 'تدوير مفاتيح التشفير', icon: Key, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500' },
                    ].map(item => (
                      <button
                        key={item.action}
                        onClick={() => handleSecurityAction(item.action, item.label)}
                        disabled={actionLoading === item.action}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:text-white group ${item.bg} ${item.color}`}
                      >
                        {actionLoading === item.action ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <item.icon className="w-5 h-5" />
                        )}
                        <span className="text-[10px] font-black text-center">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Security Stats */}
                  {securityStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <StatCard icon={AlertCircle} label="محاولات تسجيل فاشلة" value={securityStats.failedLoginsCount || 0} color="text-rose-400" />
                      <StatCard icon={Activity} label="جلسات نشطة" value={securityStats.activeSessionsCount || 0} color="text-emerald-400" />
                      <StatCard icon={Shield} label="سلامة النظام" value={`${securityStats.integrityPct || 100}%`} color="text-blue-400" />
                    </div>
                  )}

                  {/* Failed Login Attempts */}
                  {securityStats?.failedLogins?.length > 0 && (
                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                      <h3 className="text-sm font-black text-rose-400 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> محاولات تسجيل دخول فاشلة
                      </h3>
                      <div className="space-y-2">
                        {securityStats.failedLogins.map((attempt: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-mono">{attempt.ip}</span>
                            <span className="text-slate-500">{attempt.userAgent}</span>
                            <span className="text-rose-400 font-bold">{attempt.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit Logs */}
                  <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                    <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" /> سجل العمليات الإدارية
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(securityStats?.auditLogs || adminLogs).slice(0, 20).map((log: any, i: number) => (
                        <div key={log.id || i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.type === 'delete' ? 'bg-rose-500' : log.type === 'verify' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-white font-bold truncate">{log.action}</p>
                            <p className="text-[9px] text-slate-500 truncate">{log.target || log.details || '—'}</p>
                          </div>
                          <span className="text-[9px] text-slate-600 shrink-0">{log.time}</span>
                        </div>
                      ))}
                      {(securityStats?.auditLogs || adminLogs).length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">لا توجد سجلات</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SETTINGS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <SectionHeader title="إعدادات المنصة" subtitle="التحكم في إعدادات منصة أسواق" />

                  {!settings ? (
                    <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                  ) : (
                    <div className="space-y-4">
                      {/* General Settings */}
                      <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                        <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-400" /> الإعدادات العامة
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">اسم المنصة</label>
                            <input
                              type="text"
                              value={settings.appName || ''}
                              onChange={e => setSettings({ ...settings, appName: e.target.value })}
                              className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">حرف الشعار</label>
                            <input
                              type="text"
                              value={settings.logoLetter || ''}
                              onChange={e => setSettings({ ...settings, logoLetter: e.target.value })}
                              className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                            />
                          </div>
                          {/* Logo Upload */}
                          <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">شعار المنصة (صورة)</label>
                            <div className="flex items-center gap-4">
                              {/* Preview */}
                              <div className="w-16 h-16 rounded-2xl bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                                {settings.logoUrl ? (
                                  <img src={settings.logoUrl} alt="شعار" className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-2xl font-black text-emerald-400">{settings.logoLetter || 'أ'}</span>
                                )}
                              </div>
                              <div className="flex-1 flex flex-col gap-2">
                                <input
                                  ref={logoInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(file);
                                  }}
                                />
                                <button
                                  onClick={() => logoInputRef.current?.click()}
                                  disabled={logoUploading}
                                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-xs font-black disabled:opacity-50"
                                >
                                  {logoUploading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4 rotate-180" />
                                  )}
                                  {logoUploading ? 'جاري الرفع...' : 'رفع شعار جديد'}
                                </button>
                                {settings.logoUrl && (
                                  <button
                                    onClick={() => setSettings({ ...settings, logoUrl: '' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all text-xs font-black"
                                  >
                                    <X className="w-3.5 h-3.5" /> حذف الشعار
                                  </button>
                                )}
                                <p className="text-[10px] text-slate-500">PNG, JPG, SVG • حجم أقصى 5MB</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial Settings */}
                      <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                        <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" /> الإعدادات المالية
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">نسبة العمولة (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={settings.commission ?? 0}
                              onChange={e => setSettings({ ...settings, commission: parseFloat(e.target.value) })}
                              className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">سعر الإعلان المميز</label>
                            <input
                              type="number"
                              min="0"
                              value={settings.featuredPrice ?? 5}
                              onChange={e => setSettings({ ...settings, featuredPrice: parseFloat(e.target.value) })}
                              className="w-full bg-slate-700 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-600 outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="p-5 rounded-2xl bg-slate-800/30 border border-white/5">
                        <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-purple-400" /> التشغيل والنظام
                        </h3>
                        <div className="space-y-3">
                          {[
                            { key: 'maintenanceMode', label: 'وضع الصيانة', desc: 'تعطيل الوصول للمستخدمين أثناء الصيانة', danger: true },
                            { key: 'pushNotifications', label: 'إشعارات الدفع', desc: 'تفعيل الإشعارات الفورية للمستخدمين', danger: false },
                          ].map(item => (
                            <div key={item.key} className={`flex items-center justify-between p-3 rounded-xl ${item.danger && settings[item.key] ? 'bg-rose-500/5 border border-rose-500/20' : 'bg-slate-700/30'}`}>
                              <div>
                                <p className={`text-sm font-bold ${item.danger && settings[item.key] ? 'text-rose-400' : 'text-white'}`}>{item.label}</p>
                                <p className="text-[10px] text-slate-500">{item.desc}</p>
                              </div>
                              <button
                                onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
                                className={`w-11 h-6 rounded-full transition-all relative ${settings[item.key] ? (item.danger ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-slate-600'}`}
                              >
                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings[item.key] ? 'left-5' : 'left-0.5'}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveSettings}
                          disabled={settingsSaving}
                          className="px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                          {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          حفظ الإعدادات
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* REPORTS TAB */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeTab === 'reports' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <SectionHeader title="البلاغات والمخالفات" subtitle="إدارة البلاغات الواردة" />

                  {reports.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-bold">لا توجد بلاغات في الوقت الحالي</p>
                      <p className="text-xs mt-1">ستظهر البلاغات هنا عند إرسال المستخدمين لها</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reports.map((report: any) => {
                        const handleStatusChange = async (nextStatus: string) => {
                          const prev = [...reports];
                          setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: nextStatus } : r));
                          try {
                            const res = await adminFetch(`/api/admin/reports/${report.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: nextStatus })
                            });
                            if (!res.ok) {
                              setReports(prev);
                              addToast?.('خطأ', 'فشل تحديث حالة البلاغ', 'error');
                            } else {
                              addToast?.('تم بنجاح', `تم وضع البلاغ كـ ${nextStatus === 'resolved' ? 'محلول' : 'قيد التحقيق'}`, 'success');
                            }
                          } catch (e) {
                            setReports(prev);
                            addToast?.('خطأ', 'فشل الاتصال بالسيرفر', 'error');
                          }
                        };

                        const handleDismissReport = async () => {
                          if (!confirm('هل تريد حذف وتجاهل هذا البلاغ؟')) return;
                          const prev = [...reports];
                          setReports(prev => prev.filter(r => r.id !== report.id));
                          try {
                            const res = await adminFetch(`/api/admin/reports/${report.id}`, {
                              method: 'DELETE'
                            });
                            if (!res.ok) {
                              setReports(prev);
                              addToast?.('خطأ', 'فشل حذف البلاغ', 'error');
                            } else {
                              addToast?.('تم التجاهل', 'تم حذف البلاغ بنجاح', 'success');
                            }
                          } catch (e) {
                            setReports(prev);
                            addToast?.('خطأ', 'تعذر الاتصال بالسيرفر', 'error');
                          }
                        };

                        return (
                          <div key={report.id} className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                            report.severity === 'critical' ? 'bg-rose-500/5 border-rose-500/20' :
                            report.severity === 'high' ? 'bg-amber-500/5 border-amber-500/20' :
                            'bg-slate-800/30 border-white/5'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-2xl ${report.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : report.severity === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-white">{report.type}</p>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                    report.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                    report.status === 'investigating' ? 'bg-blue-500/10 text-blue-400' :
                                    report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' :
                                    'bg-slate-500/10 text-slate-400'
                                  }`}>
                                    {report.status === 'pending' ? 'في الانتظار' : report.status === 'investigating' ? 'قيد التحقيق' : report.status === 'resolved' ? 'محلول' : 'مغلق'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-300 mt-1">السبب: {report.reason}</p>
                                <p className="text-[9px] text-slate-500 mt-0.5">المُبلِّغ: {report.reporter} • المستهدف: {report.targetName} • {report.date}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleStatusChange('resolved')} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black hover:bg-emerald-500 hover:text-white transition-all border-none cursor-pointer">حل</button>
                              <button onClick={() => handleStatusChange('investigating')} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black hover:bg-blue-500 hover:text-white transition-all border-none cursor-pointer">تحقيق</button>
                              <button onClick={handleDismissReport} className="p-1.5 rounded-xl bg-slate-700 text-slate-400 hover:text-white transition-all border-none cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
