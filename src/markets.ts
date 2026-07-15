import { City } from './types.ts';

export interface Market {
  id: string;
  countryCode: string;
  labelAr: string;
  labelEn: string;
  center: { lat: number, lng: number };
  cities: City[];
  cityCoordinates: Record<string, { lat: number; lng: number; ar: string }>;
  currency: string;
  usdRate?: number; // exchange rate: 1 USD = X Local Currency
  // Dynamic Localization
  deliveryTermAr?: string;
  deliveryTermEn?: string;
  shippingInfoAr?: string;
  shippingInfoEn?: string;
}

export const MARKETS: Record<string, Market> = {
  YE: {
    id: 'YE',
    countryCode: 'YE',
    labelAr: 'اليمن',
    labelEn: 'Yemen',
    center: { lat: 15.3694, lng: 44.1910 },
    currency: 'YER',
    usdRate: 535, // average Sana'a rate
    deliveryTermAr: 'خدمة التوصيل المحلية',
    deliveryTermEn: 'Local Delivery Service',
    shippingInfoAr: 'توصيل خلال 24-48 ساعة عبر شركاء التوصيل المعتمدين.',
    shippingInfoEn: 'Delivery within 24-48 hours via authorized delivery partners.',
    cities: [
      { id: 'sanaa_city', nameAr: 'صنعاء (الأمانة)', nameEn: 'Sana\'a', lat: 15.3694, lng: 44.1910 },
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
    ],
    cityCoordinates: {
      sanaa_city: { lat: 15.3694, lng: 44.1910, ar: 'صنعاء (الأمانة)' },
      aden: { lat: 12.7855, lng: 45.0186, ar: 'عدن' },
      taiz: { lat: 13.5795, lng: 44.0206, ar: 'تعز' },
      hadramout: { lat: 15.9333, lng: 48.7833, ar: 'حضرموت' },
      ibb: { lat: 13.9669, lng: 44.1822, ar: 'إب' },
      hodeidah: { lat: 14.7979, lng: 42.9530, ar: 'الحديدة' },
      marib: { lat: 15.4619, lng: 45.3253, ar: 'مأرب' },
      saada: { lat: 16.9402, lng: 43.7639, ar: 'صعدة' },
      hajjah: { lat: 15.6939, lng: 43.6019, ar: 'حجة' },
      amran: { lat: 15.6601, lng: 43.9439, ar: 'عمران' },
      al_jawf: { lat: 16.4750, lng: 45.4200, ar: 'الجوف' },
      al_mahra: { lat: 16.2167, lng: 52.1667, ar: 'المهرة' },
      socotra: { lat: 12.4634, lng: 53.8237, ar: 'سقطرى' },
      abyan: { lat: 13.5833, lng: 45.7500, ar: 'أبين' },
      lahj: { lat: 13.1667, lng: 44.8333, ar: 'لحج' },
      shabwa: { lat: 14.5333, lng: 46.8333, ar: 'شبوة' },
      al_bayda: { lat: 14.2122, lng: 45.4744, ar: 'البيضاء' },
      dhale: { lat: 13.6953, lng: 44.7314, ar: 'الضالع' },
      al_mawit: { lat: 15.4701, lng: 43.5448, ar: 'المحويت' },
      raymah: { lat: 14.6300, lng: 43.7100, ar: 'ريمة' }
    }
  },
  PS: {
    id: 'PS',
    countryCode: 'PS',
    labelAr: 'فلسطين',
    labelEn: 'Palestine',
    center: { lat: 31.95, lng: 35.25 },
    currency: 'USD',
    usdRate: 1,
    deliveryTermAr: 'خدمة التوصيل السريع',
    deliveryTermEn: 'Express Delivery Service',
    shippingInfoAr: 'توصيل خلال 12-24 ساعة في المناطق المتاحة.',
    shippingInfoEn: 'Delivery within 12-24 hours in available areas.',
    cities: [
      { id: 'alquds', nameAr: 'القدس الشريف', nameEn: 'Al-Quds Al-Shareef', lat: 31.7683, lng: 35.2137 },
      { id: 'gaza', nameAr: 'غزة الأبية', nameEn: 'Gaza', lat: 31.5015, lng: 34.4668 },
      { id: 'ramallah', nameAr: 'رام الله', nameEn: 'Ramallah', lat: 31.9029, lng: 35.2062 },
      { id: 'hebron', nameAr: 'الخليل', nameEn: 'Hebron', lat: 31.5293, lng: 35.0998 },
      { id: 'nablus', nameAr: 'نابلس', nameEn: 'Nablus', lat: 32.2211, lng: 35.2544 },
      { id: 'jenin', nameAr: 'جنين', nameEn: 'Jenin', lat: 32.4646, lng: 35.2938 },
      { id: 'bethlehem', nameAr: 'بيت لحم', nameEn: 'Bethlehem', lat: 31.7054, lng: 35.2024 },
      { id: 'jericho', nameAr: 'أريحا', nameEn: 'Jericho', lat: 31.8560, lng: 35.4444 },
      { id: 'jaffa', nameAr: 'يافا', nameEn: 'Jaffa', lat: 32.0518, lng: 34.7520 },
      { id: 'haifa', nameAr: 'حيفا', nameEn: 'Haifa', lat: 32.7940, lng: 34.9896 },
      { id: 'acre', nameAr: 'عكا', nameEn: 'Acre', lat: 32.9331, lng: 35.0827 },
      { id: 'nazareth', nameAr: 'الناصرة', nameEn: 'Nazareth', lat: 32.6996, lng: 35.3035 },
      { id: 'khan_younis', nameAr: 'خان يونس', nameEn: 'Khan Younis', lat: 31.3462, lng: 34.3028 },
      { id: 'rafah', nameAr: 'رفح', nameEn: 'Rafah', lat: 31.2847, lng: 34.2547 },
      { id: 'tulkarm', nameAr: 'طولكرم', nameEn: 'Tulkarm', lat: 32.3151, lng: 35.0278 },
      { id: 'qalqilya', nameAr: 'قلقيلية', nameEn: 'Qalqilya', lat: 32.1932, lng: 34.9811 },
      { id: 'salfit', nameAr: 'سلفيت', nameEn: 'Salfit', lat: 32.0844, lng: 35.1814 },
      { id: 'tubas', nameAr: 'طوباس', nameEn: 'Tubas', lat: 32.3214, lng: 35.3694 }
    ],
    cityCoordinates: {
      alquds: { lat: 31.7683, lng: 35.2137, ar: 'القدس الشريف' },
      gaza: { lat: 31.5015, lng: 34.4668, ar: 'غزة الأبية' },
      ramallah: { lat: 31.9029, lng: 35.2062, ar: 'رام الله' },
      hebron: { lat: 31.5293, lng: 35.0998, ar: 'الخليل' },
      nablus: { lat: 32.2211, lng: 35.2544, ar: 'نابلس' },
      jenin: { lat: 32.4646, lng: 35.2938, ar: 'جنين' },
      bethlehem: { lat: 31.7054, lng: 35.2024, ar: 'بيت لحم' },
      jericho: { lat: 31.8560, lng: 35.4444, ar: 'أريحا' },
      jaffa: { lat: 32.0518, lng: 34.7520, ar: 'يافا' },
      haifa: { lat: 32.7940, lng: 34.9896, ar: 'حيفا' },
      acre: { lat: 32.9331, lng: 35.0827, ar: 'عكا' },
      nazareth: { lat: 32.6996, lng: 35.3035, ar: 'الناصرة' },
      khan_younis: { lat: 31.3462, lng: 34.3028, ar: 'خان يونس' },
      rafah: { lat: 31.2847, lng: 34.2547, ar: 'رفح' },
      tulkarm: { lat: 32.3151, lng: 35.0278, ar: 'طولكرم' },
      qalqilya: { lat: 32.1932, lng: 34.9811, ar: 'قلقيلية' },
      salfit: { lat: 32.0844, lng: 35.1814, ar: 'سلفيت' },
      tubas: { lat: 32.3214, lng: 35.3694, ar: 'طوباس' }
    }
  },
  SA: {
    id: 'SA',
    countryCode: 'SA',
    labelAr: 'السعودية',
    labelEn: 'Saudi Arabia',
    center: { lat: 24.7136, lng: 46.6753 },
    currency: 'SAR',
    usdRate: 3.75,
    deliveryTermAr: 'التوصيل اللوجستي',
    deliveryTermEn: 'Logistics Delivery',
    shippingInfoAr: 'توصيل خلال 1-3 أيام عمل.',
    shippingInfoEn: 'Delivery within 1-3 business days.',
    cities: [
      { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', lat: 24.7136, lng: 46.6753 },
      { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', lat: 21.4858, lng: 39.1925 },
      { id: 'makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', lat: 21.3891, lng: 39.8579 },
      { id: 'madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', lat: 24.5247, lng: 39.5692 },
      { id: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', lat: 26.4207, lng: 50.0888 },
      { id: 'khobar', nameAr: 'الخبر', nameEn: 'Khobar', lat: 26.2166, lng: 50.1971 },
      { id: 'abha', nameAr: 'أبها', nameEn: 'Abha', lat: 18.2164, lng: 42.5053 },
      { id: 'tabuk', nameAr: 'تبوك', nameEn: 'Tabuk', lat: 28.3835, lng: 36.5662 },
      { id: 'buraidah', nameAr: 'بريدة', nameEn: 'Buraidah', lat: 26.3260, lng: 43.9750 },
      { id: 'hail', nameAr: 'حائل', nameEn: 'Hail', lat: 27.5219, lng: 41.6907 },
      { id: 'najran', nameAr: 'نجران', nameEn: 'Najran', lat: 17.4933, lng: 44.1322 },
      { id: 'jazan', nameAr: 'جازان', nameEn: 'Jazan', lat: 16.8892, lng: 42.5511 },
      { id: 'taif', nameAr: 'الطائف', nameEn: 'Taif', lat: 21.2631, lng: 40.4239 },
      { id: 'hofuf', nameAr: 'الهفوف (الأحساء)', nameEn: 'Hofuf', lat: 25.3622, lng: 49.5888 },
      { id: 'yanbu', nameAr: 'ينبع', nameEn: 'Yanbu', lat: 24.0891, lng: 38.0637 },
      { id: 'jubail', nameAr: 'الجبيل', nameEn: 'Jubail', lat: 26.9598, lng: 49.5687 },
      { id: 'qatif', nameAr: 'القطيف', nameEn: 'Qatif', lat: 26.5218, lng: 50.0244 },
      { id: 'baha', nameAr: 'الباحة', nameEn: 'Al Baha', lat: 20.0129, lng: 41.4653 },
      { id: 'arar', nameAr: 'عرعر', nameEn: 'Arar', lat: 30.9753, lng: 41.0381 },
      { id: 'jouf', nameAr: 'الجوف (سكاكا)', nameEn: 'Al Jouf', lat: 29.9697, lng: 40.2064 },
      { id: 'khamis_mushait', nameAr: 'خميس مشيط', nameEn: 'Khamis Mushait', lat: 18.3064, lng: 42.7308 }
    ],
    cityCoordinates: {
      riyadh: { lat: 24.7136, lng: 46.6753, ar: 'الرياض' },
      jeddah: { lat: 21.4858, lng: 39.1925, ar: 'جدة' },
      makkah: { lat: 21.3891, lng: 39.8579, ar: 'مكة المكرمة' },
      madinah: { lat: 24.5247, lng: 39.5692, ar: 'المدينة المنورة' },
      dammam: { lat: 26.4207, lng: 50.0888, ar: 'الدمام' },
      khobar: { lat: 26.2166, lng: 50.1971, ar: 'الخبر' },
      abha: { lat: 18.2164, lng: 42.5053, ar: 'أبها' },
      tabuk: { lat: 28.3835, lng: 36.5662, ar: 'تبوك' },
      buraidah: { lat: 26.3260, lng: 43.9750, ar: 'بريدة' },
      hail: { lat: 27.5219, lng: 41.6907, ar: 'حائل' },
      najran: { lat: 17.4933, lng: 44.1322, ar: 'نجران' },
      jazan: { lat: 16.8892, lng: 42.5511, ar: 'جازان' },
      taif: { lat: 21.2631, lng: 40.4239, ar: 'الطائف' },
      hofuf: { lat: 25.3622, lng: 49.5888, ar: 'الهفوف (الأحساء)' },
      yanbu: { lat: 24.0891, lng: 38.0637, ar: 'ينبع' },
      jubail: { lat: 26.9598, lng: 49.5687, ar: 'الجبيل' },
      qatif: { lat: 26.5218, lng: 50.0244, ar: 'القطيف' },
      baha: { lat: 20.0129, lng: 41.4653, ar: 'الباحة' },
      arar: { lat: 30.9753, lng: 41.0381, ar: 'عرعر' },
      jouf: { lat: 29.9697, lng: 40.2064, ar: 'الجوف (سكاكا)' },
      khamis_mushait: { lat: 18.3064, lng: 42.7308, ar: 'خميس مشيط' }
    }
  },
  JO: {
    id: 'JO',
    countryCode: 'JO',
    labelAr: 'الأردن',
    labelEn: 'Jordan',
    center: { lat: 31.2, lng: 36.5 },
    currency: 'JOD',
    usdRate: 0.71,
    cities: [
      { id: 'amman', nameAr: 'عمان', nameEn: 'Amman', lat: 31.9522, lng: 35.9100 },
      { id: 'zarqa', nameAr: 'الزرقاء', nameEn: 'Zarqa', lat: 32.0727, lng: 36.0879 },
      { id: 'irbid', nameAr: 'إربد', nameEn: 'Irbid', lat: 32.5555, lng: 35.8500 },
      { id: 'aqaba', nameAr: 'العقبة', nameEn: 'Aqaba', lat: 29.5319, lng: 35.0060 },
      { id: 'salt', nameAr: 'السلط (البلقاء)', nameEn: 'Salt', lat: 32.0391, lng: 35.7272 },
      { id: 'jerash', nameAr: 'جرش', nameEn: 'Jerash', lat: 32.2747, lng: 35.8961 },
      { id: 'mafraq', nameAr: 'المفرق', nameEn: 'Mafraq', lat: 32.3456, lng: 36.2106 },
      { id: 'karak', nameAr: 'الكرك', nameEn: 'Karak', lat: 31.1852, lng: 35.7048 },
      { id: 'ajloun', nameAr: 'عجلون', nameEn: 'Ajloun', lat: 32.3326, lng: 35.7517 },
      { id: 'madaba', nameAr: 'مادبا', nameEn: 'Madaba', lat: 31.7196, lng: 35.7940 },
      { id: 'tafilah', nameAr: 'الطفيلة', nameEn: 'Tafilah', lat: 30.8375, lng: 35.6042 },
      { id: 'maaan', nameAr: 'معان', nameEn: 'Ma\'an', lat: 30.1949, lng: 35.7342 }
    ],
    cityCoordinates: {
      amman: { lat: 31.9522, lng: 35.9100, ar: 'عمان' },
      zarqa: { lat: 32.0727, lng: 36.0879, ar: 'الزرقاء' },
      irbid: { lat: 32.5555, lng: 35.8500, ar: 'إربد' },
      aqaba: { lat: 29.5319, lng: 35.0060, ar: 'العقبة' },
      salt: { lat: 32.0391, lng: 35.7272, ar: 'السلط (البلقاء)' },
      jerash: { lat: 32.2747, lng: 35.8961, ar: 'جرش' },
      mafraq: { lat: 32.3456, lng: 36.2106, ar: 'المفرق' },
      karak: { lat: 31.1852, lng: 35.7048, ar: 'الكرك' },
      ajloun: { lat: 32.3326, lng: 35.7517, ar: 'عجلون' },
      madaba: { lat: 31.7196, lng: 35.7940, ar: 'مادبا' },
      tafilah: { lat: 30.8375, lng: 35.6042, ar: 'الطفيلة' },
      maaan: { lat: 30.1949, lng: 35.7342, ar: 'معان' }
    }
  },
  EG: {
    id: 'EG',
    countryCode: 'EG',
    labelAr: 'مصر',
    labelEn: 'Egypt',
    center: { lat: 26.8, lng: 30.0 },
    currency: 'EGP',
    usdRate: 47.50,
    cities: [
      { id: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo', lat: 30.0444, lng: 31.2357 },
      { id: 'alexandria', nameAr: 'الإسكندرية', nameEn: 'Alexandria', lat: 31.2001, lng: 29.9187 },
      { id: 'giza', nameAr: 'الجيزة', nameEn: 'Giza', lat: 30.0131, lng: 31.2089 },
      { id: 'mansoura', nameAr: 'المنصورة (الدقهلية)', nameEn: 'Mansoura', lat: 31.0409, lng: 31.3785 },
      { id: 'luxor', nameAr: 'الأقصر', nameEn: 'Luxor', lat: 25.6872, lng: 32.6396 },
      { id: 'aswan', nameAr: 'أسوان', nameEn: 'Aswan', lat: 24.0889, lng: 32.8998 },
      { id: 'port_said', nameAr: 'بورسعيد', nameEn: 'Port Said', lat: 31.2653, lng: 32.3019 },
      { id: 'qalyubia', nameAr: 'القليوبية (بنها)', nameEn: 'Qalyubia', lat: 30.4122, lng: 31.1822 },
      { id: 'gharbia', nameAr: 'الغربية (طنطا)', nameEn: 'Gharbia', lat: 30.7875, lng: 31.0012 },
      { id: 'monufia', nameAr: 'المنوفية (شبين الكوم)', nameEn: 'Monufia', lat: 30.5572, lng: 30.9975 },
      { id: 'sharqia', nameAr: 'الشرقية (الزقازيق)', nameEn: 'Sharqia', lat: 30.5875, lng: 31.5015 },
      { id: 'beheira', nameAr: 'البحيرة (دمنهور)', nameEn: 'Beheira', lat: 31.0405, lng: 30.4700 },
      { id: 'damietta', nameAr: 'دمياط', nameEn: 'Damietta', lat: 31.4175, lng: 31.8144 },
      { id: 'ismailia', nameAr: 'الإسماعيلية', nameEn: 'Ismailia', lat: 30.6044, lng: 32.2736 },
      { id: 'suez', nameAr: 'السويس', nameEn: 'Suez', lat: 29.9668, lng: 32.5498 },
      { id: 'kafr_el_sheikh', nameAr: 'كفر الشيخ', nameEn: 'Kafr El Sheikh', lat: 31.1049, lng: 30.9398 },
      { id: 'faiyum', nameAr: 'الفيوم', nameEn: 'Faiyum', lat: 29.3084, lng: 30.8428 },
      { id: 'beni_suef', nameAr: 'بني سويف', nameEn: 'Beni Suef', lat: 29.0749, lng: 31.0978 },
      { id: 'minya', nameAr: 'المنيا', nameEn: 'Minya', lat: 28.0991, lng: 30.7636 },
      { id: 'asyut', nameAr: 'أسيوط', nameEn: 'Asyut', lat: 27.1783, lng: 31.1859 },
      { id: 'sohag', nameAr: 'سوهاج', nameEn: 'Sohag', lat: 26.5590, lng: 31.6948 },
      { id: 'qena', nameAr: 'قنا', nameEn: 'Qena', lat: 26.1551, lng: 32.7160 },
      { id: 'red_sea', nameAr: 'البحر الأحمر (الغردقة)', nameEn: 'Red Sea', lat: 27.2574, lng: 33.8129 },
      { id: 'new_valley', nameAr: 'الوادي الجديد (الخارجة)', nameEn: 'New Valley', lat: 25.4514, lng: 30.5498 },
      { id: 'matrouh', nameAr: 'مطروح (مرسى مطروح)', nameEn: 'Matrouh', lat: 31.3525, lng: 27.2361 },
      { id: 'north_sinai', nameAr: 'شمال سيناء (العريش)', nameEn: 'North Sinai', lat: 31.1321, lng: 33.8032 },
      { id: 'south_sinai', nameAr: 'جنوب سيناء (الطور)', nameEn: 'South Sinai', lat: 28.2435, lng: 33.6214 }
    ],
    cityCoordinates: {
      cairo: { lat: 30.0444, lng: 31.2357, ar: 'القاهرة' },
      alexandria: { lat: 31.2001, lng: 29.9187, ar: 'الإسكندرية' },
      giza: { lat: 30.0131, lng: 31.2089, ar: 'الجيزة' },
      mansoura: { lat: 31.0409, lng: 31.3785, ar: 'المنصورة (الدقهلية)' },
      luxor: { lat: 25.6872, lng: 32.6396, ar: 'الأقصر' },
      aswan: { lat: 24.0889, lng: 32.8998, ar: 'أسوان' },
      port_said: { lat: 31.2653, lng: 32.3019, ar: 'بورسعيد' },
      qalyubia: { lat: 30.4122, lng: 31.1822, ar: 'القليوبية' },
      gharbia: { lat: 30.7875, lng: 31.0012, ar: 'الغربية' },
      monufia: { lat: 30.5572, lng: 30.9975, ar: 'المنوفية' },
      sharqia: { lat: 30.5875, lng: 31.5015, ar: 'الشرقية' },
      beheira: { lat: 31.0405, lng: 30.4700, ar: 'البحيرة' },
      damietta: { lat: 31.4175, lng: 31.8144, ar: 'دمياط' },
      ismailia: { lat: 30.6044, lng: 32.2736, ar: 'الإسماعيلية' },
      suez: { lat: 29.9668, lng: 32.5498, ar: 'السويس' },
      kafr_el_sheikh: { lat: 31.1049, lng: 30.9398, ar: 'كفر الشيخ' },
      faiyum: { lat: 29.3084, lng: 30.8428, ar: 'الفيوم' },
      beni_suef: { lat: 29.0749, lng: 31.0978, ar: 'بني سويف' },
      minya: { lat: 28.0991, lng: 30.7636, ar: 'المنيا' },
      asyut: { lat: 27.1783, lng: 31.1859, ar: 'أسيوط' },
      sohag: { lat: 26.5590, lng: 31.6948, ar: 'سوهاج' },
      qena: { lat: 26.1551, lng: 32.7160, ar: 'قنا' },
      red_sea: { lat: 27.2574, lng: 33.8129, ar: 'البحر الأحمر' },
      new_valley: { lat: 25.4514, lng: 30.5498, ar: 'الوادي الجديد' },
      matrouh: { lat: 31.3525, lng: 27.2361, ar: 'مطروح' },
      north_sinai: { lat: 31.1321, lng: 33.8032, ar: 'شمال سيناء' },
      south_sinai: { lat: 28.2435, lng: 33.6214, ar: 'جنوب سيناء' }
    }
  },
  AE: {
    id: 'AE',
    countryCode: 'AE',
    labelAr: 'الإمارات',
    labelEn: 'UAE',
    center: { lat: 24.4539, lng: 54.3773 },
    currency: 'AED',
    usdRate: 3.672,
    cities: [
      { id: 'abu_dhabi', nameAr: 'أبوظبي', nameEn: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 },
      { id: 'dubai', nameAr: 'دبي', nameEn: 'Dubai', lat: 25.2048, lng: 55.2708 },
      { id: 'sharjah', nameAr: 'الشارقة', nameEn: 'Sharjah', lat: 25.3463, lng: 55.4209 },
      { id: 'ajman', nameAr: 'عجمان', nameEn: 'Ajman', lat: 25.4111, lng: 55.4350 },
      { id: 'rak', nameAr: 'رأس الخيمة', nameEn: 'Ras Al Khaimah', lat: 25.7895, lng: 55.9432 },
      { id: 'fujairah', nameAr: 'الفجيرة', nameEn: 'Fujairah', lat: 25.1288, lng: 56.3265 },
      { id: 'uaq', nameAr: 'أم القيوين', nameEn: 'Umm Al Quwain', lat: 25.5647, lng: 55.5552 },
      { id: 'al_ain', nameAr: 'العين', nameEn: 'Al Ain', lat: 24.1302, lng: 55.8023 }
    ],
    cityCoordinates: {
      abu_dhabi: { lat: 24.4539, lng: 54.3773, ar: 'أبوظبي' },
      dubai: { lat: 25.2048, lng: 55.2708, ar: 'دبي' },
      sharjah: { lat: 25.3463, lng: 55.4209, ar: 'الشارقة' },
      ajman: { lat: 25.4111, lng: 55.4350, ar: 'عجمان' },
      rak: { lat: 25.7895, lng: 55.9432, ar: 'رأس الخيمة' },
      fujairah: { lat: 25.1288, lng: 56.3265, ar: 'الفجيرة' },
      uaq: { lat: 25.5647, lng: 55.5552, ar: 'أم القيوين' },
      al_ain: { lat: 24.1302, lng: 55.8023, ar: 'العين' }
    }
  },
  QA: {
    id: 'QA',
    countryCode: 'QA',
    labelAr: 'قطر',
    labelEn: 'Qatar',
    center: { lat: 25.2854, lng: 51.5310 },
    currency: 'QAR',
    usdRate: 3.64,
    cities: [
      { id: 'doha', nameAr: 'الدوحة', nameEn: 'Doha', lat: 25.2854, lng: 51.5310 },
      { id: 'wakrah', nameAr: 'الوكرة', nameEn: 'Al Wakrah', lat: 25.1768, lng: 51.6048 },
      { id: 'khor', nameAr: 'الخور والذخيرة', nameEn: 'Al Khor', lat: 25.6839, lng: 51.5058 },
      { id: 'rayyan', nameAr: 'الريان', nameEn: 'Al Rayyan', lat: 25.2974, lng: 51.4285 },
      { id: 'daayen', nameAr: 'الضعاين', nameEn: 'Al Daayen', lat: 25.4831, lng: 51.4744 },
      { id: 'sheehaniya', nameAr: 'الشيحانية', nameEn: 'Ash Shihaneyah', lat: 25.3686, lng: 51.2269 },
      { id: 'shamal', nameAr: 'الشمال', nameEn: 'Al Shamal', lat: 26.1132, lng: 51.2215 }
    ],
    cityCoordinates: {
      doha: { lat: 25.2854, lng: 51.5310, ar: 'الدوحة' },
      wakrah: { lat: 25.1768, lng: 51.6048, ar: 'الوكرة' },
      khor: { lat: 25.6839, lng: 51.5058, ar: 'الخور والذخيرة' },
      rayyan: { lat: 25.2974, lng: 51.4285, ar: 'الريان' },
      daayen: { lat: 25.4831, lng: 51.4744, ar: 'الضعاين' },
      sheehaniya: { lat: 25.3686, lng: 51.2269, ar: 'الشيحانية' },
      shamal: { lat: 26.1132, lng: 51.2215, ar: 'الشمال' }
    }
  },
  KW: {
    id: 'KW',
    countryCode: 'KW',
    labelAr: 'الكويت',
    labelEn: 'Kuwait',
    center: { lat: 29.3759, lng: 47.9774 },
    currency: 'KWD',
    usdRate: 0.307,
    cities: [
      { id: 'kuwait_city', nameAr: 'العاصمة (مدينة الكويت)', nameEn: 'Kuwait City', lat: 29.3759, lng: 47.9774 },
      { id: 'jahra', nameAr: 'الجهراء', nameEn: 'Al Jahra', lat: 29.3375, lng: 47.6581 },
      { id: 'salmiya', nameAr: 'حولي (السالمية)', nameEn: 'Salmiya', lat: 29.3323, lng: 48.0772 },
      { id: 'farwaniya', nameAr: 'الفروانية', nameEn: 'Farwaniya', lat: 29.2781, lng: 47.9531 },
      { id: 'ahmadi', nameAr: 'الأحمدي', nameEn: 'Ahmadi', lat: 29.0760, lng: 48.0830 },
      { id: 'mubarak', nameAr: 'مبارك الكبير', nameEn: 'Mubarak Al-Kabeer', lat: 29.2000, lng: 48.0667 }
    ],
    cityCoordinates: {
      kuwait_city: { lat: 29.3759, lng: 47.9774, ar: 'العاصمة (مدينة الكويت)' },
      jahra: { lat: 29.3375, lng: 47.6581, ar: 'الجهراء' },
      salmiya: { lat: 29.3323, lng: 48.0772, ar: 'حولي (السالمية)' },
      farwaniya: { lat: 29.2781, lng: 47.9531, ar: 'الفروانية' },
      ahmadi: { lat: 29.0760, lng: 48.0830, ar: 'الأحمدي' },
      mubarak: { lat: 29.2000, lng: 48.0667, ar: 'مبارك الكبير' }
    }
  },
  OM: {
    id: 'OM',
    countryCode: 'OM',
    labelAr: 'عُمان',
    labelEn: 'Oman',
    center: { lat: 21.0, lng: 57.0 },
    currency: 'OMR',
    usdRate: 0.384,
    cities: [
      { id: 'muscat', nameAr: 'مسقط', nameEn: 'Muscat', lat: 23.5859, lng: 58.4059 },
      { id: 'salalah', nameAr: 'ظفار (صلالة)', nameEn: 'Salalah', lat: 17.0151, lng: 54.0924 },
      { id: 'sohar', nameAr: 'شمال الباطنة (صحار)', nameEn: 'Sohar', lat: 24.3461, lng: 56.7075 },
      { id: 'nizwa', nameAr: 'الداخلية (نزوى)', nameEn: 'Nizwa', lat: 22.9333, lng: 57.5333 },
      { id: 'sur', nameAr: 'جنوب الشرقية (صور)', nameEn: 'Sur', lat: 22.5667, lng: 59.5289 },
      { id: 'buraimi', nameAr: 'البريمي', nameEn: 'Al Buraimi', lat: 24.2505, lng: 55.7931 },
      { id: 'khasab', nameAr: 'مسندم (خصب)', nameEn: 'Khasab', lat: 26.1794, lng: 56.2483 },
      { id: 'rustaq', nameAr: 'جنوب الباطنة (الرستاق)', nameEn: 'Rustaq', lat: 23.3908, lng: 57.4244 },
      { id: 'ibra', nameAr: 'شمال الشرقية (إبراء)', nameEn: 'Ibra', lat: 22.6903, lng: 58.5475 },
      { id: 'haima', nameAr: 'الوسطى (هيماء)', nameEn: 'Haima', lat: 19.9919, lng: 56.2750 },
      { id: 'ibri', nameAr: 'الظاهرة (عبري)', nameEn: 'Ibri', lat: 23.2274, lng: 56.5135 }
    ],
    cityCoordinates: {
      muscat: { lat: 23.5859, lng: 58.4059, ar: 'مسقط' },
      salalah: { lat: 17.0151, lng: 54.0924, ar: 'ظفار (صلالة)' },
      sohar: { lat: 24.3461, lng: 56.7075, ar: 'شمال الباطنة (صحار)' },
      nizwa: { lat: 22.9333, lng: 57.5333, ar: 'الداخلية (نزوى)' },
      sur: { lat: 22.5667, lng: 59.5289, ar: 'جنوب الشرقية (صور)' },
      buraimi: { lat: 24.2505, lng: 55.7931, ar: 'البريمي' },
      khasab: { lat: 26.1794, lng: 56.2483, ar: 'مسندم (خصب)' },
      rustaq: { lat: 23.3908, lng: 57.4244, ar: 'جنوب الباطنة (الرستاق)' },
      ibra: { lat: 22.6903, lng: 58.5475, ar: 'شمال الشرقية (إبراء)' },
      haima: { lat: 19.9919, lng: 56.2750, ar: 'الوسطى (هيماء)' },
      ibri: { lat: 23.2274, lng: 56.5135, ar: 'الظاهرة (عبري)' }
    }
  },
  BH: {
    id: 'BH',
    countryCode: 'BH',
    labelAr: 'البحرين',
    labelEn: 'Bahrain',
    center: { lat: 26.0, lng: 50.55 },
    currency: 'BHD',
    usdRate: 0.376,
    cities: [
      { id: 'manama', nameAr: 'العاصمة (المنامة)', nameEn: 'Manama', lat: 26.2285, lng: 50.5860 },
      { id: 'muharraq', nameAr: 'محافظة المحرق', nameEn: 'Muharraq', lat: 26.2500, lng: 50.6000 },
      { id: 'northern', nameAr: 'المحافظة الشمالية', nameEn: 'Northern Governorate', lat: 26.1956, lng: 50.4851 },
      { id: 'southern', nameAr: 'المحافظة الجنوبية', nameEn: 'Southern Governorate', lat: 25.9902, lng: 50.5489 }
    ],
    cityCoordinates: {
      manama: { lat: 26.2285, lng: 50.5860, ar: 'العاصمة (المنامة)' },
      muharraq: { lat: 26.2500, lng: 50.6000, ar: 'محافظة المحرق' },
      northern: { lat: 26.1956, lng: 50.4851, ar: 'المحافظة الشمالية' },
      southern: { lat: 25.9902, lng: 50.5489, ar: 'المحافظة الجنوبية' }
    }
  },
  IQ: {
    id: 'IQ',
    countryCode: 'IQ',
    labelAr: 'العراق',
    labelEn: 'Iraq',
    center: { lat: 33.3152, lng: 44.3661 },
    currency: 'IQD',
    usdRate: 1310.0,
    cities: [
      { id: 'baghdad', nameAr: 'بغداد', nameEn: 'Baghdad', lat: 33.3152, lng: 44.3661 },
      { id: 'basra', nameAr: 'البصرة', nameEn: 'Basra', lat: 30.5081, lng: 47.7835 },
      { id: 'mosul', nameAr: 'نينوى (الموصل)', nameEn: 'Mosul', lat: 36.3489, lng: 43.1577 },
      { id: 'erbil', nameAr: 'أربيل', nameEn: 'Erbil', lat: 36.1911, lng: 44.0094 },
      { id: 'karbala', nameAr: 'كربلاء المقدسة', nameEn: 'Karbala', lat: 32.6160, lng: 44.0249 },
      { id: 'najaf', nameAr: 'النجف الأشرف', nameEn: 'Najaf', lat: 31.9958, lng: 44.3312 },
      { id: 'sulaymaniyah', nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', lat: 35.5619, lng: 45.4331 },
      { id: 'kirkuk', nameAr: 'كركوك', nameEn: 'Kirkuk', lat: 35.4681, lng: 44.3922 },
      { id: 'anbar', nameAr: 'الأنبار (الرمادي)', nameEn: 'Anbar', lat: 33.4308, lng: 43.2778 },
      { id: 'babylon', nameAr: 'بابل (الحلة)', nameEn: 'Babylon', lat: 32.4812, lng: 44.4209 },
      { id: 'dhi_qar', nameAr: 'ذي قار (الناصرية)', nameEn: 'Dhi Qar', lat: 31.0500, lng: 46.2500 },
      { id: 'maysan', nameAr: 'ميسان (العمارة)', nameEn: 'Maysan', lat: 31.8444, lng: 47.1458 },
      { id: 'qadisiyah', nameAr: 'القادسية (الديوانية)', nameEn: 'Qadisiyah', lat: 31.9902, lng: 44.9250 },
      { id: 'wasit', nameAr: 'واسط (الكوت)', nameEn: 'Wasit', lat: 32.5036, lng: 45.8208 },
      { id: 'diyala', nameAr: 'ديالى (بعقوبة)', nameEn: 'Diyala', lat: 33.7431, lng: 44.6464 },
      { id: 'salah_al_din', nameAr: 'صلاح الدين (تكريت)', nameEn: 'Salah al-Din', lat: 34.6000, lng: 43.6833 },
      { id: 'muthanna', nameAr: 'المثنى (السماوة)', nameEn: 'Muthanna', lat: 31.3323, lng: 45.2809 },
      { id: 'dohuk', nameAr: 'دهوك', nameEn: 'Dohuk', lat: 36.8619, lng: 42.9922 }
    ],
    cityCoordinates: {
      baghdad: { lat: 33.3152, lng: 44.3661, ar: 'بغداد' },
      basra: { lat: 30.5081, lng: 47.7835, ar: 'البصرة' },
      mosul: { lat: 36.3489, lng: 43.1577, ar: 'نينوى (الموصل)' },
      erbil: { lat: 36.1911, lng: 44.0094, ar: 'أربيل' },
      karbala: { lat: 32.6160, lng: 44.0249, ar: 'كربلاء المقدسة' },
      najaf: { lat: 31.9958, lng: 44.3312, ar: 'النجف الأشرف' },
      sulaymaniyah: { lat: 35.5619, lng: 45.4331, ar: 'السليمانية' },
      kirkuk: { lat: 35.4681, lng: 44.3922, ar: 'كركوك' },
      anbar: { lat: 33.4308, lng: 43.2778, ar: 'الأنبار (الرمادي)' },
      babylon: { lat: 32.4812, lng: 44.4209, ar: 'بابل (الحلة)' },
      dhi_qar: { lat: 31.0500, lng: 46.2500, ar: 'ذي قار (الناصرية)' },
      maysan: { lat: 31.8444, lng: 47.1458, ar: 'ميسان (العمارة)' },
      qadisiyah: { lat: 31.9902, lng: 44.9250, ar: 'القادسية (الديوانية)' },
      wasit: { lat: 32.5036, lng: 45.8208, ar: 'واسط (الكوت)' },
      diyala: { lat: 33.7431, lng: 44.6464, ar: 'ديالى (بعقوبة)' },
      salah_al_din: { lat: 34.6000, lng: 43.6833, ar: 'صلاح الدين (تكريت)' },
      muthanna: { lat: 31.3323, lng: 45.2809, ar: 'المثنى (السماوة)' },
      dohuk: { lat: 36.8619, lng: 42.9922, ar: 'دهوك' }
    }
  },
  SY: {
    id: 'SY',
    countryCode: 'SY',
    labelAr: 'سوريا',
    labelEn: 'Syria',
    center: { lat: 34.8, lng: 39.0 },
    currency: 'SYP',
    usdRate: 13000.0,
    cities: [
      { id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', lat: 33.5138, lng: 36.2765 },
      { id: 'aleppo', nameAr: 'حلب', nameEn: 'Aleppo', lat: 36.2021, lng: 37.1343 },
      { id: 'homs', nameAr: 'حمص', nameEn: 'Homs', lat: 34.7324, lng: 36.7137 },
      { id: 'latakia', nameAr: 'اللاذقية', nameEn: 'Latakia', lat: 35.5312, lng: 35.7908 },
      { id: 'hama', nameAr: 'حماة', nameEn: 'Hama', lat: 35.1318, lng: 36.7578 },
      { id: 'tartus', nameAr: 'طرطوس', nameEn: 'Tartus', lat: 34.8872, lng: 35.8819 },
      { id: 'idlib', nameAr: 'إدلب', nameEn: 'Idlib', lat: 35.9328, lng: 36.6339 },
      { id: 'deir_ez_zor', nameAr: 'دير الزور', nameEn: 'Deir ez-Zor', lat: 35.3411, lng: 40.1414 },
      { id: 'raqqa', nameAr: 'الرقة', nameEn: 'Raqqa', lat: 35.9594, lng: 39.0089 },
      { id: 'hasakah', nameAr: 'الحسكة', nameEn: 'Hasakah', lat: 36.5058, lng: 40.7428 },
      { id: 'daraa', nameAr: 'درعا', nameEn: 'Daraa', lat: 32.6256, lng: 36.1053 },
      { id: 'suwayda', nameAr: 'السويداء', nameEn: 'Suwayda', lat: 32.7093, lng: 36.5663 },
      { id: 'rif_dimashq', nameAr: 'ريف دمشق', nameEn: 'Rif Dimashq', lat: 33.5138, lng: 36.4500 },
      { id: 'quneitra', nameAr: 'القنيطرة', nameEn: 'Quneitra', lat: 33.1250, lng: 35.8242 }
    ],
    cityCoordinates: {
      damascus: { lat: 33.5138, lng: 36.2765, ar: 'دمشق' },
      aleppo: { lat: 36.2021, lng: 37.1343, ar: 'حلب' },
      homs: { lat: 34.7324, lng: 36.7137, ar: 'حمص' },
      latakia: { lat: 35.5312, lng: 35.7908, ar: 'اللاذقية' },
      hama: { lat: 35.1318, lng: 36.7578, ar: 'حماة' },
      tartus: { lat: 34.8872, lng: 35.8819, ar: 'طرطوس' },
      idlib: { lat: 35.9328, lng: 36.6339, ar: 'إدلب' },
      deir_ez_zor: { lat: 35.3411, lng: 40.1414, ar: 'دير الزور' },
      raqqa: { lat: 35.9594, lng: 39.0089, ar: 'الرقة' },
      hasakah: { lat: 36.5058, lng: 40.7428, ar: 'الحسكة' },
      daraa: { lat: 32.6256, lng: 36.1053, ar: 'درعا' },
      suwayda: { lat: 32.7093, lng: 36.5663, ar: 'السويداء' },
      rif_dimashq: { lat: 33.5138, lng: 36.4500, ar: 'ريف دمشق' },
      quneitra: { lat: 33.1250, lng: 35.8242, ar: 'القنيطرة' }
    }
  },
  LB: {
    id: 'LB',
    countryCode: 'LB',
    labelAr: 'لبنان',
    labelEn: 'Lebanon',
    center: { lat: 33.8938, lng: 35.5018 },
    currency: 'LBP',
    usdRate: 89500.0,
    cities: [
      { id: 'beirut', nameAr: 'بيروت', nameEn: 'Beirut', lat: 33.8938, lng: 35.5018 },
      { id: 'tripoli', nameAr: 'الشمال (طرابلس)', nameEn: 'Tripoli', lat: 34.4367, lng: 35.8497 },
      { id: 'sidon', nameAr: 'الجنوب (صيدا)', nameEn: 'Sidon', lat: 33.5631, lng: 35.3725 },
      { id: 'tyre', nameAr: 'صور', nameEn: 'Tyre', lat: 33.2708, lng: 35.1964 },
      { id: 'baalbek', nameAr: 'بعلبك الهرمل', nameEn: 'Baalbek', lat: 34.0051, lng: 36.2181 },
      { id: 'zahle', nameAr: 'البقاع (زحلة)', nameEn: 'Zahle', lat: 33.8439, lng: 35.9072 },
      { id: 'nabatiyeh', nameAr: 'النبطية', nameEn: 'Nabatiyeh', lat: 33.3789, lng: 35.4839 },
      { id: 'mount_lebanon', nameAr: 'جبل لبنان', nameEn: 'Mount Lebanon', lat: 33.8333, lng: 35.5833 }
    ],
    cityCoordinates: {
      beirut: { lat: 33.8938, lng: 35.5018, ar: 'بيروت' },
      tripoli: { lat: 34.4367, lng: 35.8497, ar: 'الشمال (طرابلس)' },
      sidon: { lat: 33.5631, lng: 35.3725, ar: 'الجنوب (صيدا)' },
      tyre: { lat: 33.2708, lng: 35.1964, ar: 'صور' },
      baalbek: { lat: 34.0051, lng: 36.2181, ar: 'بعلبك الهرمل' },
      zahle: { lat: 33.8439, lng: 35.9072, ar: 'البقاع (زحلة)' },
      nabatiyeh: { lat: 33.3789, lng: 35.4839, ar: 'النبطية' },
      mount_lebanon: { lat: 33.8333, lng: 35.5833, ar: 'جبل لبنان' }
    }
  },
  MA: {
    id: 'MA',
    countryCode: 'MA',
    labelAr: 'المغرب',
    labelEn: 'Morocco',
    center: { lat: 31.7917, lng: -7.0926 },
    currency: 'MAD',
    usdRate: 10.0,
    cities: [
      { id: 'rabat', nameAr: 'الرباط', nameEn: 'Rabat', lat: 34.0209, lng: -6.8416 },
      { id: 'casablanca', nameAr: 'الدار البيضاء', nameEn: 'Casablanca', lat: 33.5731, lng: -7.5898 },
      { id: 'marrakech', nameAr: 'مراكش', nameEn: 'Marrakech', lat: 31.6295, lng: -7.9811 },
      { id: 'fes', nameAr: 'فاس', nameEn: 'Fes', lat: 34.0181, lng: -5.0078 },
      { id: 'tangier', nameAr: 'طنجة', nameEn: 'Tangier', lat: 35.7595, lng: -5.8340 },
      { id: 'agadir', nameAr: 'أكادير', nameEn: 'Agadir', lat: 30.4183, lng: -9.6026 },
      { id: 'meknes', nameAr: 'مكناس', nameEn: 'Meknes', lat: 33.8938, lng: -5.5547 },
      { id: 'oujda', nameAr: 'وجدة', nameEn: 'Oujda', lat: 34.6867, lng: -1.9114 },
      { id: 'kenitra', nameAr: 'القنيطرة', nameEn: 'Kenitra', lat: 34.2610, lng: -6.5802 },
      { id: 'tetouan', nameAr: 'تطوان', nameEn: 'Tetouan', lat: 35.5785, lng: -5.3684 },
      { id: 'safi', nameAr: 'آسفي', nameEn: 'Safi', lat: 32.2994, lng: -9.2372 },
      { id: 'nador', nameAr: 'الناظور', nameEn: 'Nador', lat: 35.1667, lng: -2.9333 }
    ],
    cityCoordinates: {
      rabat: { lat: 34.0209, lng: -6.8416, ar: 'الرباط' },
      casablanca: { lat: 33.5731, lng: -7.5898, ar: 'الدار البيضاء' },
      marrakech: { lat: 31.6295, lng: -7.9811, ar: 'مراكش' },
      fes: { lat: 34.0181, lng: -5.0078, ar: 'فاس' },
      tangier: { lat: 35.7595, lng: -5.8340, ar: 'طنجة' },
      agadir: { lat: 30.4183, lng: -9.6026, ar: 'أكادير' },
      meknes: { lat: 33.8938, lng: -5.5547, ar: 'مكناس' },
      oujda: { lat: 34.6867, lng: -1.9114, ar: 'وجدة' },
      kenitra: { lat: 34.2610, lng: -6.5802, ar: 'القنيطرة' },
      tetouan: { lat: 35.5785, lng: -5.3684, ar: 'تطوان' },
      safi: { lat: 32.2994, lng: -9.2372, ar: 'آسفي' },
      nador: { lat: 35.1667, lng: -2.9333, ar: 'الناظور' }
    }
  },
  DZ: {
    id: 'DZ',
    countryCode: 'DZ',
    labelAr: 'الجزائر',
    labelEn: 'Algeria',
    center: { lat: 28.0339, lng: 1.6596 },
    currency: 'DZD',
    usdRate: 134.0,
    cities: [
      { id: 'algiers', nameAr: 'الجزائر العاصمة', nameEn: 'Algiers', lat: 36.7538, lng: 3.0588 },
      { id: 'oran', nameAr: 'وهران', nameEn: 'Oran', lat: 35.6971, lng: -0.6308 },
      { id: 'constantine', nameAr: 'قسنطينة', nameEn: 'Constantine', lat: 36.3650, lng: 6.6147 },
      { id: 'annaba', nameAr: 'عنابة', nameEn: 'Annaba', lat: 36.9000, lng: 7.7667 },
      { id: 'setif', nameAr: 'سطيف', nameEn: 'Setif', lat: 36.1900, lng: 5.4137 },
      { id: 'blida', nameAr: 'البليدة', nameEn: 'Blida', lat: 36.4700, lng: 2.8300 },
      { id: 'batna', nameAr: 'باتنة', nameEn: 'Batna', lat: 35.5500, lng: 6.1667 },
      { id: 'djelfa', nameAr: 'الجلفة', nameEn: 'Djelfa', lat: 34.6667, lng: 3.2500 },
      { id: 'sidi_bel_abbes', nameAr: 'سيدي بلعباس', nameEn: 'Sidi Bel Abbes', lat: 35.2000, lng: -0.6333 },
      { id: 'biskra', nameAr: 'بسكرة', nameEn: 'Biskra', lat: 34.8500, lng: 5.7333 },
      { id: 'ghardaia', nameAr: 'غرداية', nameEn: 'Ghardaia', lat: 32.4833, lng: 3.6667 },
      { id: 'ouargla', nameAr: 'ورقلة', nameEn: 'Ouargla', lat: 31.9500, lng: 5.3333 }
    ],
    cityCoordinates: {
      algiers: { lat: 36.7538, lng: 3.0588, ar: 'الجزائر العاصمة' },
      oran: { lat: 35.6971, lng: -0.6308, ar: 'وهران' },
      constantine: { lat: 36.3650, lng: 6.6147, ar: 'قسنطينة' },
      annaba: { lat: 36.9000, lng: 7.7667, ar: 'عنابة' },
      setif: { lat: 36.1900, lng: 5.4137, ar: 'سطيف' },
      blida: { lat: 36.4700, lng: 2.8300, ar: 'البليدة' },
      batna: { lat: 35.5500, lng: 6.1667, ar: 'باتنة' },
      djelfa: { lat: 34.6667, lng: 3.2500, ar: 'الجلفة' },
      sidi_bel_abbes: { lat: 35.2000, lng: -0.6333, ar: 'سيدي بلعباس' },
      biskra: { lat: 34.8500, lng: 5.7333, ar: 'بسكرة' },
      ghardaia: { lat: 32.4833, lng: 3.6667, ar: 'غرداية' },
      ouargla: { lat: 31.9500, lng: 5.3333, ar: 'ورقلة' }
    }
  },
  TN: {
    id: 'TN',
    countryCode: 'TN',
    labelAr: 'تونس',
    labelEn: 'Tunisia',
    center: { lat: 33.8869, lng: 9.5375 },
    currency: 'TND',
    usdRate: 3.12,
    cities: [
      { id: 'tunis', nameAr: 'تونس العاصمة', nameEn: 'Tunis', lat: 36.8065, lng: 10.1815 },
      { id: 'sfax', nameAr: 'صفاقس', nameEn: 'Sfax', lat: 34.7400, lng: 10.7600 },
      { id: 'sousse', nameAr: 'سوسة', nameEn: 'Sousse', lat: 35.8256, lng: 10.6369 },
      { id: 'kairouan', nameAr: 'القيروان', nameEn: 'Kairouan', lat: 35.6781, lng: 10.0963 },
      { id: 'bizerte', nameAr: 'بنزرت', nameEn: 'Bizerte', lat: 37.2744, lng: 9.8739 },
      { id: 'gabes', nameAr: 'قابس', nameEn: 'Gabes', lat: 33.8814, lng: 10.0982 },
      { id: 'ariana', nameAr: 'أريانة', nameEn: 'Ariana', lat: 36.8625, lng: 10.1956 },
      { id: 'gafsa', nameAr: 'قفصة', nameEn: 'Gafsa', lat: 34.4250, lng: 8.7842 },
      { id: 'monastir', nameAr: 'المنستير', nameEn: 'Monastir', lat: 35.7833, lng: 10.8333 },
      { id: 'nabeul', nameAr: 'نابلس (نابل)', nameEn: 'Nabeul', lat: 36.4561, lng: 10.7376 }
    ],
    cityCoordinates: {
      tunis: { lat: 36.8065, lng: 10.1815, ar: 'تونس العاصمة' },
      sfax: { lat: 34.7400, lng: 10.7600, ar: 'صفاقس' },
      sousse: { lat: 35.8256, lng: 10.6369, ar: 'سوسة' },
      kairouan: { lat: 35.6781, lng: 10.0963, ar: 'القيروان' },
      bizerte: { lat: 37.2744, lng: 9.8739, ar: 'بنزرت' },
      gabes: { lat: 33.8814, lng: 10.0982, ar: 'قابس' },
      ariana: { lat: 36.8625, lng: 10.1956, ar: 'أريانة' },
      gafsa: { lat: 34.4250, lng: 8.7842, ar: 'قفصة' },
      monastir: { lat: 35.7833, lng: 10.8333, ar: 'المنستير' },
      nabeul: { lat: 36.4561, lng: 10.7376, ar: 'نابلس (نابل)' }
    }
  },
  LY: {
    id: 'LY',
    countryCode: 'LY',
    labelAr: 'ليبيا',
    labelEn: 'Libya',
    center: { lat: 26.3351, lng: 17.2283 },
    currency: 'LYD',
    usdRate: 4.88,
    cities: [
      { id: 'tripoli_ly', nameAr: 'طرابلس الغرب', nameEn: 'Tripoli', lat: 32.8872, lng: 13.1913 },
      { id: 'benghazi', nameAr: 'بنغازي', nameEn: 'Benghazi', lat: 32.1167, lng: 20.0667 },
      { id: 'misrata', nameAr: 'مصراتة', nameEn: 'Misrata', lat: 32.3754, lng: 15.0925 },
      { id: 'zawiya', nameAr: 'الزاوية', nameEn: 'Zawiya', lat: 32.7522, lng: 12.7278 },
      { id: 'sabha', nameAr: 'سبها', nameEn: 'Sabha', lat: 27.0377, lng: 14.4137 },
      { id: 'sirte', nameAr: 'سرت', nameEn: 'Sirte', lat: 31.2089, lng: 16.5888 },
      { id: 'tobruk', nameAr: 'طبرق', nameEn: 'Tobruk', lat: 32.0836, lng: 23.9764 },
      { id: 'bayda', nameAr: 'البيضاء (الجبل الأخضر)', nameEn: 'Al Bayda', lat: 32.7628, lng: 21.7550 },
      { id: 'derna', nameAr: 'درنة', nameEn: 'Derna', lat: 32.7608, lng: 22.6425 }
    ],
    cityCoordinates: {
      tripoli_ly: { lat: 32.8872, lng: 13.1913, ar: 'طرابلس الغرب' },
      benghazi: { lat: 32.1167, lng: 20.0667, ar: 'بنغازي' },
      misrata: { lat: 32.3754, lng: 15.0925, ar: 'مصراتة' },
      zawiya: { lat: 32.7522, lng: 12.7278, ar: 'الزاوية' },
      sabha: { lat: 27.0377, lng: 14.4137, ar: 'سبها' },
      sirte: { lat: 31.2089, lng: 16.5888, ar: 'سرت' },
      tobruk: { lat: 32.0836, lng: 23.9764, ar: 'طبرق' },
      bayda: { lat: 32.7628, lng: 21.7550, ar: 'البيضاء (الجبل الأخضر)' },
      derna: { lat: 32.7608, lng: 22.6425, ar: 'درنة' }
    }
  },
  SD: {
    id: 'SD',
    countryCode: 'SD',
    labelAr: 'السودان',
    labelEn: 'Sudan',
    center: { lat: 15.0, lng: 30.0 },
    currency: 'SDG',
    usdRate: 600.0,
    cities: [
      { id: 'khartoum', nameAr: 'الخرطوم', nameEn: 'Khartoum', lat: 15.5007, lng: 32.5599 },
      { id: 'omdurman', nameAr: 'أم درمان', nameEn: 'Omdurman', lat: 15.6500, lng: 32.4833 },
      { id: 'port_sudan', nameAr: 'بورتسودان (البحر الأحمر)', nameEn: 'Port Sudan', lat: 19.6167, lng: 37.2167 },
      { id: 'wad_madani', nameAr: 'الجزيرة (ود مدني)', nameEn: 'Wad Madani', lat: 14.4012, lng: 33.5186 },
      { id: 'el_obeid', nameAr: 'شمال كردفان (الأبيض)', nameEn: 'El Obeid', lat: 13.1843, lng: 30.2222 },
      { id: 'kassala', nameAr: 'كسلا', nameEn: 'Kassala', lat: 15.4507, lng: 36.4000 },
      { id: 'nyala', nameAr: 'جنوب دارفور (نيالا)', nameEn: 'Nyala', lat: 12.0500, lng: 24.8833 },
      { id: 'gedaref', nameAr: 'القضارف', nameEn: 'Gedaref', lat: 14.0333, lng: 35.3833 }
    ],
    cityCoordinates: {
      khartoum: { lat: 15.5007, lng: 32.5599, ar: 'الخرطوم' },
      omdurman: { lat: 15.6500, lng: 32.4833, ar: 'أم درمان' },
      port_sudan: { lat: 19.6167, lng: 37.2167, ar: 'بورتسودان' },
      wad_madani: { lat: 14.4012, lng: 33.5186, ar: 'الجزيرة (ود مدني)' },
      el_obeid: { lat: 13.1843, lng: 30.2222, ar: 'شمال كردفان (الأبيض)' },
      kassala: { lat: 15.4507, lng: 36.4000, ar: 'كسلا' },
      nyala: { lat: 12.0500, lng: 24.8833, ar: 'جنوب دارفور (نيالا)' },
      gedaref: { lat: 14.0333, lng: 35.3833, ar: 'القضارف' }
    }
  },
  SO: {
    id: 'SO',
    countryCode: 'SO',
    labelAr: 'الصومال',
    labelEn: 'Somalia',
    center: { lat: 5.1521, lng: 46.1996 },
    currency: 'SOS',
    usdRate: 570.0,
    cities: [
      { id: 'mogadishu', nameAr: 'مقديشو', nameEn: 'Mogadishu', lat: 2.0469, lng: 45.3182 },
      { id: 'hargeisa', nameAr: 'هرجيسا', nameEn: 'Hargeisa', lat: 9.5624, lng: 44.0770 },
      { id: 'bosaso', nameAr: 'بوساسو', nameEn: 'Bosaso', lat: 11.2842, lng: 49.1813 },
      { id: 'kismayo', nameAr: 'كيسمايو', nameEn: 'Kismayo', lat: -0.3582, lng: 42.5454 },
      { id: 'baidoa', nameAr: 'بيدوا', nameEn: 'Baidoa', lat: 3.1122, lng: 43.6472 }
    ],
    cityCoordinates: {
      mogadishu: { lat: 2.0469, lng: 45.3182, ar: 'مقديشو' },
      hargeisa: { lat: 9.5624, lng: 44.0770, ar: 'هرجيسا' },
      bosaso: { lat: 11.2842, lng: 49.1813, ar: 'بوساسو' },
      kismayo: { lat: -0.3582, lng: 42.5454, ar: 'كيسمايو' },
      baidoa: { lat: 3.1122, lng: 43.6472, ar: 'بيدوا' }
    }
  },
  MR: {
    id: 'MR',
    countryCode: 'MR',
    labelAr: 'موريتانيا',
    labelEn: 'Mauritania',
    center: { lat: 21.0079, lng: -10.9408 },
    currency: 'MRU',
    usdRate: 39.50,
    cities: [
      { id: 'nouakchott', nameAr: 'نواكشوط', nameEn: 'Nouakchott', lat: 18.0735, lng: -15.9582 },
      { id: 'nouadhibou', nameAr: 'نواذيبو', nameEn: 'Nouadhibou', lat: 20.9309, lng: -17.0379 },
      { id: 'rosso', nameAr: 'روصو', nameEn: 'Rosso', lat: 16.5125, lng: -15.8050 },
      { id: 'kiffa', nameAr: 'كيفه', nameEn: 'Kiffa', lat: 16.6167, lng: -11.4000 },
      { id: 'atar', nameAr: 'أطار', nameEn: 'Atar', lat: 20.5169, lng: -13.0499 }
    ],
    cityCoordinates: {
      nouakchott: { lat: 18.0735, lng: -15.9582, ar: 'نواكشوط' },
      nouadhibou: { lat: 20.9309, lng: -17.0379, ar: 'نواذيبو' },
      rosso: { lat: 16.5125, lng: -15.8050, ar: 'روصو' },
      kiffa: { lat: 16.6167, lng: -11.4000, ar: 'كيفه' },
      atar: { lat: 20.5169, lng: -13.0499, ar: 'أطار' }
    }
  },
  DJ: {
    id: 'DJ',
    countryCode: 'DJ',
    labelAr: 'جيبوتي',
    labelEn: 'Djibouti',
    center: { lat: 11.8251, lng: 42.5903 },
    currency: 'DJF',
    usdRate: 177.72,
    cities: [
      { id: 'djibouti_city', nameAr: 'جيبوتي العاصمة', nameEn: 'Djibouti City', lat: 11.5880, lng: 43.1450 },
      { id: 'ali_sabieh', nameAr: 'علي صبيح', nameEn: 'Ali Sabieh', lat: 11.1514, lng: 42.7125 },
      { id: 'tadjoura', nameAr: 'تاجورة', nameEn: 'Tadjoura', lat: 11.7853, lng: 42.8814 },
      { id: 'obock', nameAr: 'أوبوك', nameEn: 'Obock', lat: 11.9686, lng: 43.2907 },
      { id: 'dikhil', nameAr: 'دخيل', nameEn: 'Dikhil', lat: 11.1118, lng: 42.3738 }
    ],
    cityCoordinates: {
      djibouti_city: { lat: 11.5880, lng: 43.1450, ar: 'جيبوتي العاصمة' },
      ali_sabieh: { lat: 11.1514, lng: 42.7125, ar: 'علي صبيح' },
      tadjoura: { lat: 11.7853, lng: 42.8814, ar: 'تاجورة' },
      obock: { lat: 11.9686, lng: 43.2907, ar: 'أوبوك' },
      dikhil: { lat: 11.1118, lng: 42.3738, ar: 'دخيل' }
    }
  },
  KM: {
    id: 'KM',
    countryCode: 'KM',
    labelAr: 'جزر القمر',
    labelEn: 'Comoros',
    center: { lat: -12.1348, lng: 44.4319 },
    currency: 'KMF',
    usdRate: 450.0,
    cities: [
      { id: 'moroni', nameAr: 'موروني', nameEn: 'Moroni', lat: -11.7022, lng: 43.2551 },
      { id: 'mutsamudu', nameAr: 'موتسامودو', nameEn: 'Mutsamudu', lat: -12.1622, lng: 44.3956 },
      { id: 'fomboni', nameAr: 'فومبوني', nameEn: 'Fomboni', lat: -12.2800, lng: 43.7424 },
      { id: 'domoni', nameAr: 'دوموني', nameEn: 'Domoni', lat: -12.2569, lng: 44.5319 }
    ],
    cityCoordinates: {
      moroni: { lat: -11.7022, lng: 43.2551, ar: 'موروني' },
      mutsamudu: { lat: -12.1622, lng: 44.3956, ar: 'موتسامودو' },
      fomboni: { lat: -12.2800, lng: 43.7424, ar: 'فومبوني' },
      domoni: { lat: -12.2569, lng: 44.5319, ar: 'دوموني' }
    }
  }
};

/**
 * Clean helper function to translate currency code into Arabic abbreviated symbol.
 */
export function getCurrencyAr(currency: string): string {
  switch (currency) {
    case 'USD': return '$';
    case 'YER': return 'ي.ر';
    case 'SAR': return 'ر.س';
    case 'JOD': return 'د.أ';
    case 'EGP': return 'ج.م';
    case 'AED': return 'د.إ';
    case 'QAR': return 'ر.ق';
    case 'KWD': return 'د.ك';
    case 'OMR': return 'ر.ع';
    case 'BHD': return 'د.ب';
    case 'IQD': return 'د.ع';
    case 'SYP': return 'ل.س';
    case 'LBP': return 'ل.ل';
    case 'MAD': return 'د.م.';
    case 'DZD': return 'د.ج';
    case 'TND': return 'د.ت';
    case 'LYD': return 'د.ل';
    case 'SDG': return 'ج.س';
    case 'SOS': return 'ش.ص';
    case 'MRU': return 'أ.م';
    case 'DJF': return 'ف.ج';
    case 'KMF': return 'ف.ق';
    default: return currency;
  }
}

/**
 * Clean helper function to translate currency code to full Arabic name.
 */
export function getCurrencyNameAr(currency: string): string {
  switch (currency) {
    case 'USD': return 'دولار أمريكي';
    case 'YER': return 'ريال يمني';
    case 'SAR': return 'ريال سعودي';
    case 'JOD': return 'دينار أردني';
    case 'EGP': return 'جنيه مصري';
    case 'AED': return 'درهم إماراتي';
    case 'QAR': return 'ريال قطري';
    case 'KWD': return 'دينار كويتي';
    case 'OMR': return 'ريال عماني';
    case 'BHD': return 'دينار بحريني';
    case 'IQD': return 'دينار عراقي';
    case 'SYP': return 'ليرة سورية';
    case 'LBP': return 'ليرة لبنانية';
    case 'MAD': return 'درهم مغربي';
    case 'DZD': return 'دينار جزائري';
    case 'TND': return 'دينار تونسي';
    case 'LYD': return 'دينار ليبي';
    case 'SDG': return 'جنيه سوداني';
    case 'SOS': return 'شلن صومالي';
    case 'MRU': return 'أوقية موريتانية';
    case 'DJF': return 'فرنك جيبوتي';
    case 'KMF': return 'فرنك قمري';
    default: return currency;
  }
}
