/**
 * Shared Type Definitions for Aswaq Admin Dashboard
 */

export type UserRole = 'user' | 'merchant' | 'store' | 'moderator' | 'admin' | 'super_admin';

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
  verified: boolean;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  identityDocuments?: string[];
  hasPostedAd?: boolean;
  joinDate: string;
  active: boolean;
  createdAt: string;
  managedCountry?: string | null;
  permissions?: string[];
}

export interface ViewTrendPoint {
  day: string;
  views: number;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  price: number;
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
  latitude?: number;
  longitude?: number;
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
}

export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
}
