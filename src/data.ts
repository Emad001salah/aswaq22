/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production Data Definitions & Blank State Arrays for Aswaq 22
 */

import { Category, City, District, Ad, User, UserRole } from './types.ts';

export const CITIES: City[] = [
  { id: 'sanaa_city', nameAr: 'صنعاء', nameEn: 'Sana\'a', lat: 15.3694, lng: 44.1910 },
  { id: 'aden', nameAr: 'عدن', nameEn: 'Aden', lat: 12.7855, lng: 45.0186 },
  { id: 'taiz', nameAr: 'تعز', nameEn: 'Taiz', lat: 13.5795, lng: 44.0206 },
  { id: 'hadramout', nameAr: 'حضرموت', nameEn: 'Hadramout', lat: 15.9333, lng: 48.7833 },
  { id: 'ibb', nameAr: 'إب', nameEn: 'Ibb', lat: 13.9669, lng: 44.1822 },
  { id: 'hodeidah', nameAr: 'الحديدة', nameEn: 'Hodeidah', lat: 14.7979, lng: 42.9530 },
  { id: 'marib', nameAr: 'مأرب', nameEn: 'Marib', lat: 15.4619, lng: 45.3253 },
  { id: 'shabwa', nameAr: 'شبوة', nameEn: 'Shabwa', lat: 14.5333, lng: 46.8333 },
  { id: 'saada', nameAr: 'صعدة', nameEn: 'Saada', lat: 16.9402, lng: 43.7639 },
  { id: 'dhale', nameAr: 'الضالع', nameEn: 'Al Dhale', lat: 13.6953, lng: 44.7314 },
  { id: 'lahj', nameAr: 'لحج', nameEn: 'Lahj', lat: 13.1667, lng: 44.8333 },
  { id: 'al_jawf', nameAr: 'الجوف', nameEn: 'Al Jawf', lat: 16.4750, lng: 45.4200 },
  { id: 'hajjah', nameAr: 'حجة', nameEn: 'Hajjah', lat: 15.6939, lng: 43.6019 },
  { id: 'al_bayda', nameAr: 'البيضاء', nameEn: 'Al Bayda', lat: 14.2122, lng: 45.4744 },
  { id: 'al_mahra', nameAr: 'المهرة', nameEn: 'Al Mahrah', lat: 16.2167, lng: 52.1667 },
  { id: 'socotra', nameAr: 'سقطرى', nameEn: 'Socotra', lat: 12.4634, lng: 53.8237 },
  { id: 'amran', nameAr: 'عمران', nameEn: 'Amran', lat: 15.6601, lng: 43.9439 },
  { id: 'abyan', nameAr: 'أبين', nameEn: 'Abyan', lat: 13.5833, lng: 45.7500 },
  { id: 'al_mawit', nameAr: 'المحويت', nameEn: 'Al Mahwit', lat: 15.4701, lng: 43.5448 },
  { id: 'raymah', nameAr: 'ريمة', nameEn: 'Raymah', lat: 14.6300, lng: 43.7100 }
];

export const DISTRICTS: District[] = [
  { id: 'sanaa_hadda', cityId: 'sanaa_city', nameAr: 'حدة', nameEn: 'Hadda' },
  { id: 'sanaa_shumaila', cityId: 'sanaa_city', nameAr: 'شميلة', nameEn: 'Shumaila' },
  { id: 'sanaa_hasaba', cityId: 'sanaa_city', nameAr: 'الحصبة', nameEn: 'Hasaba' },
  { id: 'sanaa_sawan', cityId: 'sanaa_city', nameAr: 'سعوان', nameEn: 'Sawan' },
  { id: 'sanaa_mathbah', cityId: 'sanaa_city', nameAr: 'مذبح', nameEn: 'Mathbah' },
  { id: 'sanaa_aseer', cityId: 'sanaa_city', nameAr: 'عصر', nameEn: 'Aseer' },
  { id: 'sanaa_safia', cityId: 'sanaa_city', nameAr: 'الصافية', nameEn: 'Al Safia' },
  { id: 'aden_crater', cityId: 'aden', nameAr: 'كريتر', nameEn: 'Crater' },
  { id: 'aden_mansoura', cityId: 'aden', nameAr: 'المنصورة', nameEn: 'Mansoura' },
  { id: 'aden_sheikh_othman', cityId: 'aden', nameAr: 'الشيخ عثمان', nameEn: 'Sheikh Othman' },
  { id: 'aden_khormaksar', cityId: 'aden', nameAr: 'خور مكسر', nameEn: 'Khormaksar' },
  { id: 'aden_mualla', cityId: 'aden', nameAr: 'المعلا', nameEn: 'Al Mualla' },
  { id: 'aden_tawahi', cityId: 'aden', nameAr: 'التواهي', nameEn: 'Al Tawahi' },
  { id: 'taiz_qahira', cityId: 'taiz', nameAr: 'القاهرة', nameEn: 'Al Qahira' },
  { id: 'taiz_mudhaffar', cityId: 'taiz', nameAr: 'المظفر', nameEn: 'Al Mudhaffar' },
  { id: 'taiz_sala', cityId: 'taiz', nameAr: 'صالة', nameEn: 'Sala' },
  { id: 'taiz_taiziya', cityId: 'taiz', nameAr: 'التعزية', nameEn: 'Al Taiziya' },
  { id: 'had_mukalla', cityId: 'hadramout', nameAr: 'المكلا', nameEn: 'Mukalla' },
  { id: 'had_seyoun', cityId: 'hadramout', nameAr: 'سيئون', nameEn: 'Seyoun' },
  { id: 'had_tarim', cityId: 'hadramout', nameAr: 'تريم', nameEn: 'Tarim' },
  { id: 'had_shihr', cityId: 'hadramout', nameAr: 'الشحر', nameEn: 'Ash Shihr' },
  { id: 'ibb_mashannah', cityId: 'ibb', nameAr: 'المشنة', nameEn: 'Al Mashannah' },
  { id: 'ibb_dhi_sufal', cityId: 'ibb', nameAr: 'ذي السفال', nameEn: 'Dhi Sufal' },
  { id: 'ibb_yarim', cityId: 'ibb', nameAr: 'يريم', nameEn: 'Yarim' },
];

export const CATEGORIES: Category[] = [
  { id: 'cars', nameAr: 'سيارات ومركبات', nameEn: 'Vehicles', icon: 'Car', count: 0 },
  { id: 'realestate', nameAr: 'عقارات وأراضي', nameEn: 'Real Estate', icon: 'Building2', count: 0 },
  { id: 'phones', nameAr: 'هواتف وأجهزة', nameEn: 'Electronics', icon: 'Smartphone', count: 0 },
  { id: 'jobs', nameAr: 'وظائف وأعمال', nameEn: 'Jobs', icon: 'Briefcase', count: 0 },
  { id: 'services', nameAr: 'خدمات وحرف', nameEn: 'Services', icon: 'Wrench', count: 0 },
  { id: 'livestock', nameAr: 'حيوانات ومواشي', nameEn: 'Animals', icon: 'PawPrint', count: 0 },
  { id: 'furniture', nameAr: 'أثاث ومستلزمات', nameEn: 'Furniture', icon: 'Armchair', count: 0 },
  { id: 'fashion', nameAr: 'موضة وجمال', nameEn: 'Fashion', icon: 'Shirt', count: 0 },
];

export const SUB_CATEGORIES: Record<string, { id: string; nameAr: string; nameEn: string }[]> = {
  resorts: [
    { id: 'chalet', nameAr: 'شاليه', nameEn: 'Chalet' },
    { id: 'farm', nameAr: 'مزرعة', nameEn: 'Farm' },
    { id: 'camp', nameAr: 'مخيم', nameEn: 'Camp' },
    { id: 'resort', nameAr: 'منتجع', nameEn: 'Resort' }
  ],
  car_rental: [
    { id: 'daily', nameAr: 'يومي', nameEn: 'Daily' },
    { id: 'weekly', nameAr: 'أسبوعي', nameEn: 'Weekly' },
    { id: 'monthly', nameAr: 'شهري', nameEn: 'Monthly' },
    { id: 'with_driver', nameAr: 'مع سائق', nameEn: 'With Driver' }
  ],
  cars: [
    { id: 'sedan', nameAr: 'سيدان', nameEn: 'Sedan' },
    { id: 'suv', nameAr: 'دفع رباعي', nameEn: 'SUV' },
    { id: 'truck', nameAr: 'نقل', nameEn: 'Truck' },
    { id: 'other', nameAr: 'أخرى', nameEn: 'Other' },
  ],
  realestate: [
    { id: 'villa', nameAr: 'فيلا', nameEn: 'Villa' },
    { id: 'apartment', nameAr: 'شقة', nameEn: 'Apartment' },
    { id: 'land', nameAr: 'أرض', nameEn: 'Land' },
    { id: 'building', nameAr: 'عمارة', nameEn: 'Building' },
    { id: 'commercial', nameAr: 'تجاري', nameEn: 'Commercial' },
  ],
  phones: [
    { id: 'smartphone', nameAr: 'هواتف ذكية', nameEn: 'Smartphones' },
    { id: 'accessories', nameAr: 'اكسسوارات', nameEn: 'Accessories' },
  ],
  electronics: [
    { id: 'tv', nameAr: 'تلفزيونات', nameEn: 'TVs' },
    { id: 'home_appliances', nameAr: 'أجهزة منزلية', nameEn: 'Home Appliances' },
  ],
};

export const INITIAL_USERS: User[] = [];
export const INITIAL_REVIEWS: any[] = [];
export const INITIAL_ADS: Ad[] = [];
