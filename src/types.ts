/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  USER = 'user',
  MERCHANT = 'merchant',
  STORE = 'store',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export interface PromoVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
  bio?: string;
  rating: number;
  reviewCount?: number;
  adCountType?: string;
  verified: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  identityDocuments?: string[];
  hasPostedAd?: boolean;
  joinDate: string;
  active: boolean;
  whatsappNumber?: string;
  instagramUsername?: string;
  facebookUrl?: string;
  coverPhoto?: string;
  createdAt: string;
  managedCountry?: string | null;
  permissions?: string[];
}

export interface Review {
  id: string;
  targetUserId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ViewTrendPoint {
  day: string;
  views: number;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  price: number; // in local currency or USD
  currency: string;
  city: string;
  district?: string;
  category: string;
  subCategory?: string;
  images: string[];
  contactNumber: string;
  hideContactNumber?: boolean;
  status: 'active' | 'pending' | 'sold' | 'rejected' | 'expired';
  views: number;
  likes: number;
  isFeatured: boolean;
  createdAt: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  userVerified?: boolean;
  user?: {
    id: string;
    name: string;
    avatar: string | null;
    phone?: string | null;
    isVerified?: string | null;
  };
  jobType?: 'seeking' | 'hiring';
  latitude?: number;
  longitude?: number;
  destinationLat?: number;
  destinationLng?: number;
  viewTrend?: ViewTrendPoint[];
  // Real Estate Specific Fields
  rooms?: number;
  propertyType?: 'villa' | 'apartment' | 'land' | 'building' | 'commercial';
  amenities?: string[]; // water, electricity, fiber, parking, etc.

  // Vehicle Specific Fields
  make?: string;
  modelYear?: number;
  transmission?: 'manual' | 'automatic';
  fuelType?: 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'solar';
  kilometers?: number;

  // Electronics & General
  condition?: 'new' | 'used_mint' | 'used_good' | 'used_fair';
  warranty?: boolean;
  brand?: string;
  videoUrl?: string;
  isPromo?: boolean;
  isLive?: boolean;
  marketId?: string;
  whatsappLink?: string;
  instagramLink?: string;
  showOnMap?: boolean;
  thumbnailUrl?: string;
  customFieldValues?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  adId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ChatSession {
  id: string;
  adId: string;
  adTitle: string;
  adImage: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: 'ad_update' | 'chat' | 'system' | 'like';
  timestamp: string;
  read: boolean;
}

export interface CustomFieldOption {
  id: string;
  labelAr: string;
  labelEn: string;
}

export interface CustomFieldDefinition {
  id: string;
  labelAr: string;
  labelEn: string;
  type: 'select' | 'text' | 'number' | 'multiselect' | 'button_group';
  options?: CustomFieldOption[];
  required?: boolean;
  placeholderAr?: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  subCategories?: {
    id: string;
    nameAr: string;
    nameEn: string;
  }[];
  customFields?: CustomFieldDefinition[];
}

export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
}

export interface District {
  id: string;
  cityId: string;
  nameAr: string;
  nameEn: string;
}
