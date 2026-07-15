/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
  // Sana'a Districts
  { id: 'sanaa_hadda', cityId: 'sanaa_city', nameAr: 'حدة', nameEn: 'Hadda' },
  { id: 'sanaa_shumaila', cityId: 'sanaa_city', nameAr: 'شميلة', nameEn: 'Shumaila' },
  { id: 'sanaa_hasaba', cityId: 'sanaa_city', nameAr: 'الحصبة', nameEn: 'Hasaba' },
  { id: 'sanaa_sawan', cityId: 'sanaa_city', nameAr: 'سعوان', nameEn: 'Sawan' },
  { id: 'sanaa_mathbah', cityId: 'sanaa_city', nameAr: 'مذبح', nameEn: 'Mathbah' },
  { id: 'sanaa_aseer', cityId: 'sanaa_city', nameAr: 'عصر', nameEn: 'Aseer' },
  { id: 'sanaa_safia', cityId: 'sanaa_city', nameAr: 'الصافية', nameEn: 'Al Safia' },
  // Aden Districts
  { id: 'aden_crater', cityId: 'aden', nameAr: 'كريتر', nameEn: 'Crater' },
  { id: 'aden_mansoura', cityId: 'aden', nameAr: 'المنصورة', nameEn: 'Mansoura' },
  { id: 'aden_sheikh_othman', cityId: 'aden', nameAr: 'الشيخ عثمان', nameEn: 'Sheikh Othman' },
  { id: 'aden_khormaksar', cityId: 'aden', nameAr: 'خور مكسر', nameEn: 'Khormaksar' },
  { id: 'aden_mualla', cityId: 'aden', nameAr: 'المعلا', nameEn: 'Al Mualla' },
  { id: 'aden_tawahi', cityId: 'aden', nameAr: 'التواهي', nameEn: 'Al Tawahi' },
  // Taiz Districts
  { id: 'taiz_qahira', cityId: 'taiz', nameAr: 'القاهرة', nameEn: 'Al Qahira' },
  { id: 'taiz_mudhaffar', cityId: 'taiz', nameAr: 'المظفر', nameEn: 'Al Mudhaffar' },
  { id: 'taiz_sala', cityId: 'taiz', nameAr: 'صالة', nameEn: 'Sala' },
  { id: 'taiz_taiziya', cityId: 'taiz', nameAr: 'التعزية', nameEn: 'Al Taiziya' },
  // Hadramout Districts
  { id: 'had_mukalla', cityId: 'hadramout', nameAr: 'المكلا', nameEn: 'Mukalla' },
  { id: 'had_seyoun', cityId: 'hadramout', nameAr: 'سيئون', nameEn: 'Seyoun' },
  { id: 'had_tarim', cityId: 'hadramout', nameAr: 'تريم', nameEn: 'Tarim' },
  { id: 'had_shihr', cityId: 'hadramout', nameAr: 'الشحر', nameEn: 'Ash Shihr' },
  // Ibb Districts
  { id: 'ibb_mashannah', cityId: 'ibb', nameAr: 'المشنة', nameEn: 'Al Mashannah' },
  { id: 'ibb_dhi_sufal', cityId: 'ibb', nameAr: 'ذي السفال', nameEn: 'Dhi Sufal' },
  { id: 'ibb_yarim', cityId: 'ibb', nameAr: 'يريم', nameEn: 'Yarim' },
  // Hodeidah Districts
  { id: 'hod_mina', cityId: 'hodeidah', nameAr: 'الميناء', nameEn: 'Al Mina' },
  { id: 'hod_hali', cityId: 'hodeidah', nameAr: 'الحالي', nameEn: 'Al Hali' },
  { id: 'hod_hawk', cityId: 'hodeidah', nameAr: 'الحوك', nameEn: 'Al Hawk' },
  { id: 'hod_bajil', cityId: 'hodeidah', nameAr: 'باجل', nameEn: 'Bajil' },
  // Marib
  { id: 'marib_city', cityId: 'marib', nameAr: 'مدينة مأرب', nameEn: 'Marib City' },
  { id: 'marib_harib', cityId: 'marib', nameAr: 'حريب', nameEn: 'Harib' },
  { id: 'marib_wadi', cityId: 'marib', nameAr: 'الوادي', nameEn: 'Al Wadi' },
  // Abyan
  { id: 'abyan_zinjibar', cityId: 'abyan', nameAr: 'زنجبار', nameEn: 'Zinjibar' },
  { id: 'abyan_khanfar', cityId: 'abyan', nameAr: 'خنفر', nameEn: 'Khanfar' },
  { id: 'abyan_lawdar', cityId: 'abyan', nameAr: 'لودر', nameEn: 'Lawdar' },

  // Jordan (Amman) Districts
  { id: 'jo_amman_abdali', cityId: 'amman', nameAr: 'العبدلي', nameEn: 'Al-Abdali' },
  { id: 'jo_amman_tla', cityId: 'amman', nameAr: 'تلاع العلي', nameEn: 'Tla\' Al-Ali' },
  { id: 'jo_amman_sweifieh', cityId: 'amman', nameAr: 'الصويفية', nameEn: 'Sweifieh' },
  { id: 'jo_amman_jubeiha', cityId: 'amman', nameAr: 'الجبيهة', nameEn: 'Al-Jubeiha' },
  { id: 'jo_amman_jabal_amman', cityId: 'amman', nameAr: 'جبل عمان', nameEn: 'Jabal Amman' },
  { id: 'jo_amman_weibdeh', cityId: 'amman', nameAr: 'جبل اللويبدة', nameEn: 'Jabal Al-Weibdeh' },
  { id: 'jo_amman_shfa', cityId: 'amman', nameAr: 'شفا بدران', nameEn: 'Shfa Badran' },
  { id: 'jo_amman_khalda', cityId: 'amman', nameAr: 'خلدا', nameEn: 'Khalda' },

  // Jordan (Zarqa) Districts
  { id: 'jo_zarqa_ghuwairiyah', cityId: 'zarqa', nameAr: 'الغويرية', nameEn: 'Al-Ghuwairiyah' },
  { id: 'jo_zarqa_new', cityId: 'zarqa', nameAr: 'الزرقاء الجديدة', nameEn: 'New Zarqa' },
  { id: 'jo_zarqa_downtown', cityId: 'zarqa', nameAr: 'الوسط التجاري', nameEn: 'Downtown' },
  { id: 'jo_zarqa_masoom', cityId: 'zarqa', nameAr: 'حي معصوم', nameEn: 'Hayy Masoom' },

  // Jordan (Irbid) Districts
  { id: 'jo_irbid_uni', cityId: 'irbid', nameAr: 'شارع الجامعة', nameEn: 'University Street' },
  { id: 'jo_irbid_husn', cityId: 'irbid', nameAr: 'الحصن', nameEn: 'Al-Husan' },
  { id: 'jo_irbid_sareeh', cityId: 'irbid', nameAr: 'الصريح', nameEn: 'Al-Sareeh' },
  { id: 'jo_irbid_aidoun', cityId: 'irbid', nameAr: 'إيدون', nameEn: 'Aidoun' },

  // Saudi Arabia (Riyadh) Districts
  { id: 'sa_riyadh_yasmin', cityId: 'riyadh', nameAr: 'حي الياسمين', nameEn: 'Al-Yasmin' },
  { id: 'sa_riyadh_sahafa', cityId: 'riyadh', nameAr: 'حي الصحافة', nameEn: 'Al-Sahafa' },
  { id: 'sa_riyadh_malqa', cityId: 'riyadh', nameAr: 'حي الملقا', nameEn: 'Al-Malqa' },
  { id: 'sa_riyadh_olaya', cityId: 'riyadh', nameAr: 'حي العليا', nameEn: 'Al-Olaya' },
  { id: 'sa_riyadh_rawdah', cityId: 'riyadh', nameAr: 'حي الروضة', nameEn: 'Al-Rawdah' },
  { id: 'sa_riyadh_sulaimaniyah', cityId: 'riyadh', nameAr: 'حي السليمانية', nameEn: 'Al-Sulaimaniyah' },

  // Saudi Arabia (Jeddah) Districts
  { id: 'sa_jeddah_rawdah', cityId: 'jeddah', nameAr: 'حي الروضة', nameEn: 'Al-Rawdah' },
  { id: 'sa_jeddah_hamra', cityId: 'jeddah', nameAr: 'حي الحمراء', nameEn: 'Al-Hamra' },
  { id: 'sa_jeddah_safa', cityId: 'jeddah', nameAr: 'حي الصفا', nameEn: 'Al-Safa' },
  { id: 'sa_jeddah_shati', cityId: 'jeddah', nameAr: 'حي الشاطئ', nameEn: 'Al-Shati' }
];

export const CATEGORIES: Category[] = [
  { id: 'jobs', nameAr: 'بوابة الوظائف والفرص', nameEn: 'Jobs & Opportunities Portal', icon: 'Briefcase' },
  { id: 'cars', nameAr: 'سيارات ومركبات', nameEn: 'Cars & Vehicles', icon: 'Car' },
  { id: 'realestate', nameAr: 'عقارات وأراضي', nameEn: 'Real Estate & Land', icon: 'Home' },
  { id: 'rentals', nameAr: 'سكن للإيجار', nameEn: 'Accommodation for Rent', icon: 'Building' },
  { id: 'hotels', nameAr: 'فنادق', nameEn: 'Hotels', icon: 'Hotel' },
  { id: 'resorts', nameAr: 'منتجعات وأماكن ترفيهية', nameEn: 'Resorts & Entertainment', icon: 'Palmtree' },
  { id: 'car_rental', nameAr: 'تأجير سيارات', nameEn: 'Car Rentals', icon: 'CarFront' },
  { id: 'electronics', nameAr: 'إلكترونيات وأجهزة منزلية', nameEn: 'Electronics & Appliances', icon: 'Tv' },
  { id: 'phones', nameAr: 'هواتف ذكية واكسسوارات', nameEn: 'Smartphones & Accessories', icon: 'Smartphone' },
  { id: 'laptops', nameAr: 'كمبيوتر وبلايستيشن وألعاب', nameEn: 'Laptops, PC & Gaming', icon: 'Laptop' },
  { id: 'furniture', nameAr: 'أثاث ومستلزمات منزلية', nameEn: 'Furniture & Home Decor', icon: 'Sofa' },
  { id: 'clothing', nameAr: 'ملابس وموضة وأزياء', nameEn: 'Clothing & Fashion', icon: 'Shirt' },
  { id: 'services', nameAr: 'خدمات صيانة ومقاولات وشحن', nameEn: 'Services & Logistics', icon: 'Wrench' },
  { id: 'livestock', nameAr: 'مواشي وحيوانات ونباتات', nameEn: 'Livestock & Plants', icon: 'Beef' },
  { id: 'bicycles', nameAr: 'دراجات هوائية ونارية ومعسكرات', nameEn: 'Bikes & Motorcycles', icon: 'Bike' },
  { id: 'trucks', nameAr: 'شاحنات ومعدات ثقيلة وآلات', nameEn: 'Trucks & Heavy Equipment', icon: 'Truck' },
  { id: 'educational', nameAr: 'كتب وتدريب ودراسة وكورسات', nameEn: 'Books & Education', icon: 'BookOpen' },
  { id: 'food', nameAr: 'أغذية ومأكولات عائلية ومطابخ', nameEn: 'Food, Beverages & Catering', icon: 'Utensils' },
  { id: 'medical', nameAr: 'مستلزمات طبية وصحة وجمال', nameEn: 'Medical Supplies & Wellness', icon: 'HeartPulse' },
  { id: 'perfumes', nameAr: 'عطور ومستحضرات تجميل وساعات', nameEn: 'Perfumes, Cosmetics & Watches', icon: 'Gem' },
  { id: 'construction', nameAr: 'مواد بناء ومقاولات وديكور', nameEn: 'Building Materials', icon: 'Hammer' },
  { id: 'custom_work', nameAr: 'أشغال يدوية وحرف شعبية', nameEn: 'Handicrafts & Heritage', icon: 'Palette' },
  { id: 'other', nameAr: 'أخرى (اكتب قسماً آخر ✏️)', nameEn: 'Other Categories', icon: 'Hexagon' }
];

export const SUB_CATEGORIES: Record<string, { id: string; nameAr: string; nameEn: string }[]> = {
  rentals: [
    { id: 'apartment', nameAr: 'شقة مفروشة', nameEn: 'Furnished Apartment' },
    { id: 'villa', nameAr: 'فيلا', nameEn: 'Villa' },
    { id: 'room', nameAr: 'غرفة', nameEn: 'Room' },
    { id: 'studio', nameAr: 'استوديو', nameEn: 'Studio' }
  ],
  hotels: [
    { id: '5star', nameAr: '5 نجوم', nameEn: '5 Stars' },
    { id: '4star', nameAr: '4 نجوم', nameEn: '4 Stars' },
    { id: '3star', nameAr: '3 نجوم', nameEn: '3 Stars' },
    { id: 'motel', nameAr: 'موتيل', nameEn: 'Motel' }
  ],
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

export const INITIAL_USERS: User[] = [
  {
    id: 'user_1',
    name: 'أبو أحمد الهمداني',
    email: 'ahmed@souqye.com',
    phone: '777123456',
    role: UserRole.MERCHANT,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=1000&q=80',
    bio: 'معرض الهمداني للسيارات الفاخرة - صنعاء',
    rating: 4.9,
    reviewCount: 42,
    verified: true,
    joinDate: '2024-01-15',
    active: true,
    whatsappNumber: '777123456',
    instagramUsername: 'alhamdani_cars',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'user_2',
    name: 'مجموعة المريسي العقارية',
    email: 'moraissi@souqye.com',
    phone: '733987654',
    role: UserRole.STORE,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80',
    bio: 'خدمات عقارية متميزة في عدن وصنعاء',
    rating: 4.7,
    reviewCount: 156,
    verified: true,
    joinDate: '2023-11-20',
    active: true,
    whatsappNumber: '733987654',
    instagramUsername: 'moraissi_realestate',
    createdAt: '2023-11-20T00:00:00Z'
  },
  {
    id: 'user_3',
    name: 'سالم الحضرمي',
    email: 'salem@souqye.com',
    phone: '700112233',
    role: UserRole.USER,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?auto=format&fit=crop&w=1000&q=80',
    bio: 'مهتم ببيع وشراء الإلكترونيات والهواتف الحديثة بأسعار مناسبة',
    rating: 4.5,
    reviewCount: 3,
    verified: false,
    joinDate: '2025-02-10',
    active: true,
    createdAt: '2025-02-10T00:00:00Z'
  },
  {
    id: 'user_admin',
    name: 'عماد صلاح (مدير التطبيق)',
    email: 'admin@souqye.com',
    phone: '770000000',
    role: UserRole.ADMIN,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1554147090-e11d13544e48?auto=format&fit=crop&w=1000&q=80',
    bio: 'إدارة منصة أسواق اليمن وتلقي الاقتراحات والشكاوى',
    rating: 5.0,
    reviewCount: 1,
    verified: true,
    joinDate: '2023-01-01',
    active: true,
    createdAt: '2023-01-01T00:00:00Z'
  },
  // Jordan Specific Users
  {
    id: 'jo_user_1',
    name: 'عمر المجالي',
    email: 'omar@souqjo.com',
    phone: '0791234567',
    role: UserRole.MERCHANT,
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80',
    bio: 'عمر المجالي لتجارة السيارات الكهربائية والهجينة - عمان، العبدلي. نوفر أفضل السيارات بأفضل الأسعار.',
    rating: 4.8,
    reviewCount: 85,
    verified: true,
    joinDate: '2024-05-01',
    active: true,
    whatsappNumber: '0791234567',
    instagramUsername: 'omar_cars',
    createdAt: '2024-05-01T00:00:00Z'
  },
  {
    id: 'jo_user_2',
    name: 'رانيا سويدان',
    email: 'rania@souqjo.com',
    phone: '0781112223',
    role: UserRole.MERCHANT,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    coverPhoto: 'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1000&q=80',
    bio: 'رانيا سويدان للتصميم الداخلي والديكور. نحول منزلك إلى قطعة فنية راقية. عمان، شارع مكة.',
    rating: 4.9,
    reviewCount: 64,
    verified: true,
    joinDate: '2025-01-10',
    active: true,
    whatsappNumber: '0781112223',
    instagramUsername: 'rania_decor',
    createdAt: '2025-01-10T00:00:00Z'
  },
  {
    id: 'jo_user_3',
    name: 'التميز للإلكترونيات',
    email: 'tamayuz@souqjo.com',
    phone: '0770001112',
    role: UserRole.STORE,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80', // Using a placeholder for store
    coverPhoto: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1000&q=80',
    bio: 'التميز للإلكترونيات - هدايا، هواتف، وأجهزة بلايستيشن. إربد، شارع الجامعة.',
    rating: 4.6,
    reviewCount: 120,
    verified: true,
    joinDate: '2023-12-05',
    active: true,
    whatsappNumber: '0770001112',
    instagramUsername: 'tamayuz_jo',
    createdAt: '2022-09-15T00:00:00Z'
  }
];

export const INITIAL_REVIEWS: any[] = [
  {
    id: 'rev_1',
    targetUserId: 'user_1',
    authorId: 'user_3',
    authorName: 'سالم الحضرمي',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    comment: 'تعامل راقي جداً والسيارة كرت كما في الإعلان تماماً. أنصح بالتعامل معه.',
    createdAt: '2026-05-20T10:00:00Z'
  },
  {
    id: 'rev_2',
    targetUserId: 'user_1',
    authorId: 'user_2',
    authorName: 'مجموعة المريسي العقارية',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    rating: 4,
    comment: 'تاجر أمين ومصداقية عالية في المواعيد.',
    createdAt: '2026-05-15T14:30:00Z'
  }
];

export const INITIAL_ADS: Ad[] = [
  {
    id: 'ad_1',
    title: 'تويوتا هيلوكس 2023 دبل خليجي كرت',
    description: 'تويوتا هيلوكس موديل 2023 دبل، مواصفات عالية جداً، جير عادي، بنزين، قطعت مسافة 15,000 كم فقط. السيارة نظيفة خالية من الحوادث والرش، مجمركة ومرقمة جاهزة في صنعاء. تكييف ممتاز، شاشة ذكية، كاميرا خلفية، حساسات.',
    price: 32500,
    currency: 'USD',
    city: 'sanaa_city',
    category: 'cars',
    videoUrl: 'https://player.vimeo.com/external/384761655.sd.mp4?s=34bf080447fa2c03fb2a92db43ae7cdc4cbdccf8&profile_id=165&oauth2_token_id=57447761',
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '777123456',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: true,
    isLive: true,
    createdAt: '2026-05-24T18:30:00Z',
    userId: 'user_1',
    whatsappLink: 'https://wa.me/967777123456',
    instagramLink: 'alhamdani_cars'
  },
  {
    id: 'ad_2',
    title: 'شقة فاخرة للبيع في حي حدة الراقي',
    description: 'شقة سكنية واسعة ومصممة بأحدث الديكورات تقع في قلب حي حدة بصنعاء. تتكون من 4 غرف واسعة، صالة استقبال ضيوف كبيرة، مطبخ مجهز متكامل، 3 حمامات ممتازة، بلكونة مطلة على الشارع الرئيسي مع حراسة ومصعد شغال 24 ساعة ومولد كهرباء طوارئ.',
    price: 110000,
    currency: 'USD',
    city: 'sanaa_city',
    category: 'realestate',
    rooms: 4,
    propertyType: 'apartment',
    amenities: ['water', 'electricity', 'fiber'],
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '733987654',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: true,
    videoUrl: 'https://player.vimeo.com/external/435674703.sd.mp4?s=6f41da5a9094709f19ca01a2f16ef062e080f4f0&profile_id=165&oauth2_token_id=57447761',
    createdAt: '2026-05-23T10:15:00Z',
    userId: 'user_2',
    whatsappLink: 'https://wa.me/967733987654',
    instagramLink: 'moraissi_re'
  },
  {
    id: 'ad_3',
    title: 'فيلا مستقلة راقية مطلة على ساحل أبين',
    description: 'فيلا ملكية للبيع في كورنيش ساحل أبين بعدن، طابقين وملحق، حديقة منسقة وموقف سيارات فسيح يتسع لثلاث سيارات. تشطيب سوبر ديلوكس، تكييف مركزي لجميع الغرف، حمام سباحة صغير خاص بمساحة ممتازة، بالقرب من الخدمات والمنتجعات الفاخرة.',
    price: 340000,
    currency: 'USD',
    city: 'aden',
    category: 'realestate',
    rooms: 6,
    propertyType: 'villa',
    amenities: ['water', 'electricity', 'fiber', 'parking'],
    images: [
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '732233445',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: true,
    videoUrl: 'https://player.vimeo.com/external/517602124.sd.mp4?s=d0092c695fe90575d5079a4de57deecd45ec82f5&profile_id=165&oauth2_token_id=57447761',
    createdAt: '2026-05-25T12:00:00Z',
    userId: 'user_2',
    whatsappLink: 'https://wa.me/967732233445',
    instagramLink: 'moraissi_villa'
  },
  {
    id: 'ad_10',
    title: 'أرض سكنية للبيع في حي الروضة - تعز',
    description: 'أرض مستوية تماماً تقع في منطقة هادئة وراقية بحي الروضة في مدينة تعز. المساحة 10 لبن، على شارع رئيسي بعرض 12 متر. الأرض مسورة وجاهزة للبناء فوراً مع توفر كافة الخدمات بجانبها (مدرسة، جامع، سوبر ماركت). السعر مغري جداً للجادين.',
    price: 45000,
    currency: 'USD',
    city: 'taiz',
    category: 'realestate',
    propertyType: 'land',
    amenities: ['water', 'electricity'],
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '774433221',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-25T15:00:00Z',
    userId: 'user_3'
  },
  {
    id: 'ad_4',
    title: 'آيفون 15 بروماكس تيتانيوم طبيعي 256 جيجا',
    description: 'آيفون 15 بروماكس اللون تيتانيوم طبيعي (Natural Titanium)، سعة 256 جيجابايت. التلفون نظيف جداً كرت بكرتونه وبكامل ملحقاته الأصلية، نسبة البطارية 98%، يدعم شريحتين (شريحة فعلية eSIM + Nano SIM)، غير مفتوح ولا مصلح وخالٍ من الخدوش تماماً.',
    price: 950,
    currency: 'USD',
    city: 'aden',
    category: 'phones',
    images: [
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '700112233',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-25T08:30:00Z',
    userId: 'user_3'
  },
  {
    id: 'ad_5',
    title: 'بلايستيشن 5 سليم مع يدين تحكم و3 ألعاب',
    description: 'للبيع جهاز PlayStation 5 Slim نسخة الأقراص، سعة التخزين 1 تيرابايت. الجهاز استخدام نظيف جداً لمدة شهرين فقط، مع يدتين تحكم أصلية (بينك وأبيض) و3 ألعاب حصرية: FC24 وجتا 5 وسبايدرمان 2. الجهاز مضمون وخالي من أي مشاكل مع الكرتون.',
    price: 480,
    currency: 'USD',
    city: 'taiz',
    category: 'laptops',
    images: [
      'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '773445566',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-24T14:45:00Z',
    userId: 'user_3'
  },
  {
    id: 'ad_6',
    title: 'طقم كنب تركي ملكي 9 مقاعد فاخر',
    description: 'طقم كنب تركي مستورد غاية في الفخامة والجمال، يتسع لـ 9 أشخاص. اللون كحلي مطعم بإطارات ذهبية خشب زان أصلي جودة عالية ومريح جداً. الطقم مكوّن من كرسين فرديين، وكنبتين ثلاثيتين مع طاولات ضيافة خشبية ناعمة ومنسجمة مع الطقم.',
    price: 1800000,
    currency: 'YER',
    city: 'sanaa_city',
    category: 'furniture',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '771223344',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-22T09:00:00Z',
    userId: 'user_1'
  },
  {
    id: 'ad_7',
    title: 'مطلوب مبرمج تطبيقات ومطور ويب لشركة تسويقية',
    description: 'تعلن مبيعات ميديا عن توفر وظيفة مبرمج تطبيقات فل ستاك Full-Stack للعمل بالدوام الكامل أو عن بعد في مقر الشركة بمأرب. يشترط الخبرة في React / React Native وبيئة Node.js والمطابقة الكاملة لتصميمات UI/UX المعاصرة مع القدرة على العمل الجماعي.',
    price: 800,
    currency: 'USD',
    city: 'marib',
    category: 'jobs',
    images: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '775551122',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-25T11:00:00Z',
    userId: 'user_admin',
    jobType: 'hiring'
  },
  {
    id: 'ad_9',
    title: 'طالب عمل: مهندس ديكور ومصمم داخلي ثلاثي الأبعاد خبرة 5 سنوات',
    description: 'ابحث عن فرصة عمل كمهندس ديكور داخلي ومصمم 3D في شركة مقاولات أو مكتب تصميم هندسي في صنعاء أو عدن. لدي خبرة ممتازة في برامج 3ds Max, AutoCAD, Revit, Photoshop ولدي سابقة أعمال غنية بتصميم وتنفيذ الفلل السكنية والمحلات التجارية والمطاعم الفاخرة.',
    price: 600,
    currency: 'USD',
    city: 'sanaa_city',
    category: 'jobs',
    images: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '700112233',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-25T14:10:00Z',
    userId: 'user_3',
    jobType: 'seeking'
  },
  {
    id: 'ad_8',
    title: 'مواشي وطيور بلدي أصلية لموسم الأعياد',
    description: 'نوفر لكم أفضل السلالات من الأثوار والخراف البلدية المرباة بطرق طبيعية ونظيفة جداً. الأسعار منافسة ولدينا خدمة التوصيل والذبح مع مراعاة كافة الشروط الصحية في المكلا وحضرموت الوادي.',
    price: 250000,
    currency: 'YER',
    city: 'hadramout',
    category: 'livestock',
    images: [
      'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '711223344',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-23T16:20:00Z',
    userId: 'user_3'
  },
  {
    id: 'ad_sudan_1',
    title: 'آيفون 15 برو ماكس 256 جيجا شبه جديد',
    description: 'للبيع هونق كونق بشريحتين فيزيائيتين، نسبة البطارية 96%، نظيف جداً خالي من الخدوش مع كامل ملحقاته والعلبة الأصلية بالخرطوم العاصمة الشقيقة.',
    price: 1100,
    currency: 'USD',
    city: 'khartoum',
    category: 'phones',
    videoUrl: 'https://player.vimeo.com/external/462118355.sd.mp4?s=ca62f44adfc4178a9c2be9fb0745582f3c7eaad0&profile_id=165&oauth2_token_id=57447761',
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '912345678',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: true,
    createdAt: '2026-05-24T18:30:00Z',
    userId: 'user_1'
  },
  {
    id: 'ad_somalia_1',
    title: 'منزل مستقل للبيع في حي المطار مقديشو',
    description: 'بيت ممتاز طابقين مع حديقة صغيرة وحراسة أمنية، 4 غرف نوم وصالتين، تشطيب حديث وقريب من جميع الخدمات الحيوية بمقديشو العريقة.',
    price: 135000,
    currency: 'USD',
    city: 'mogadishu',
    category: 'realestate',
    videoUrl: 'https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761',
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '615123456',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: true,
    createdAt: '2026-05-25T11:20:00Z',
    userId: 'user_2'
  },
  {
    id: 'ad_mauritania_1',
    title: 'مرسيدس 190 ديزل اقتصادية ونظيفة جداً',
    description: 'سيارة مرسيدس 190 الأسطورية، محرك ديزل ممتاز واقتصادي جداً، لون فضي، جير عادي، مكيف وكراسي مريحة بنواكشوط عاصمة الثقافة والأدب.',
    price: 2600,
    currency: 'USD',
    city: 'nouakchott',
    category: 'cars',
    images: [
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '46452312',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-26T09:40:00Z',
    userId: 'user_3'
  },
  {
    id: 'ad_djibouti_1',
    title: 'شاشة عرض ذكية سامسونج 55 بوصة 4K سوبر',
    description: 'شاشة سامسونج ذكية تدعم نتفلكس ويوتيوب بدقة Ultra HD، حالة ممتازة مع الضمان والرموت الأصلي. صوت محيطي رائع وسرعة سلاسة عالية بجيبوتي الحبيبة.',
    price: 85000,
    currency: 'DJF',
    city: 'djibouti_city',
    category: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '77884422',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-26T15:10:00Z',
    userId: 'user_2'
  },
  {
    id: 'ad_comoros_1',
    title: 'أرض سكنية ممتازة قريبة من البحر في موروني',
    description: 'قطعة أرض مستوية ومهيأة للبناء المباشر في منطقة هادئة وراقية بموروني جزر القمر الساحرة، تطل على الساحل بمسافة قريبة جداً وبسند ملكية معتمد.',
    price: 42000000,
    currency: 'KMF',
    city: 'moroni',
    category: 'realestate',
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '3201412',
    status: 'active',
    views: 0,
    likes: 0,
    isFeatured: false,
    createdAt: '2026-05-27T12:00:00Z',
    userId: 'user_1'
  }
];
