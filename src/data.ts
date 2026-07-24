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
  { id: 'cars', nameAr: 'سيارات ومركبات', nameEn: 'Vehicles', icon: 'Car' },
  { id: 'realestate', nameAr: 'عقارات وأراضي', nameEn: 'Real Estate', icon: 'Building2' },
  { id: 'resorts', nameAr: 'شاليهات ومنتجعات', nameEn: 'Resorts & Chalets', icon: 'Palmtree' },
  { id: 'phones', nameAr: 'هواتف وأجهزة', nameEn: 'Phones & Devices', icon: 'Smartphone' },
  { id: 'electronics', nameAr: 'أجهزة منزلية وإلكترونيات', nameEn: 'Home Appliances & Electronics', icon: 'Tv' },
  { id: 'furniture', nameAr: 'أثاث ومستلزمات منزلية', nameEn: 'Furniture & Home', icon: 'Armchair' },
  { id: 'fashion', nameAr: 'موضة وجمال', nameEn: 'Fashion & Beauty', icon: 'Shirt' },
  { id: 'livestock', nameAr: 'حيوانات ومواشي', nameEn: 'Animals & Livestock', icon: 'PawPrint' },
  { id: 'solar', nameAr: 'طاقة شمسية ومولدات', nameEn: 'Solar & Generators', icon: 'Sun' },
  { id: 'jobs', nameAr: 'وظائف وأعمال', nameEn: 'Jobs & Careers', icon: 'Briefcase' },
  { id: 'services', nameAr: 'خدمات وحرف', nameEn: 'Services & Crafts', icon: 'Wrench' },
  { id: 'car_rental', nameAr: 'تأجير سيارات', nameEn: 'Car Rental', icon: 'Key' },
  { id: 'other', nameAr: 'أقسام مخصصة ومتنوعة', nameEn: 'Other & Miscellaneous', icon: 'MoreHorizontal' },
];

export const SUB_CATEGORIES: Record<string, { id: string; nameAr: string; nameEn: string }[]> = {
  cars: [
    { id: 'sedan', nameAr: 'سيدان', nameEn: 'Sedan' },
    { id: 'suv', nameAr: 'دفع رباعي (SUV)', nameEn: 'SUV' },
    { id: 'pickup', nameAr: 'بيك آب / باص', nameEn: 'Pickup / Bus' },
    { id: 'truck', nameAr: 'شاحنات ومعدات ثقيلة', nameEn: 'Trucks & Heavy Duty' },
    { id: 'motorcycle', nameAr: 'دراجات نارية', nameEn: 'Motorcycles' },
    { id: 'car_parts', nameAr: 'قطع غيار واكسسوارات', nameEn: 'Spare Parts & Accessories' },
  ],
  realestate: [
    { id: 'apartment', nameAr: 'شقق للبيع والإيجار', nameEn: 'Apartments' },
    { id: 'villa', nameAr: 'فلل ومنازل', nameEn: 'Villas & Houses' },
    { id: 'land', nameAr: 'أراضي ومخططات', nameEn: 'Land & Plots' },
    { id: 'building', nameAr: 'عمائر ومباني', nameEn: 'Buildings' },
    { id: 'commercial', nameAr: 'محلات ومكاتب تجارية', nameEn: 'Commercial Shops & Offices' },
  ],
  resorts: [
    { id: 'chalet', nameAr: 'شاليه عائلي', nameEn: 'Family Chalet' },
    { id: 'resort', nameAr: 'منتجع سياحي', nameEn: 'Tourist Resort' },
    { id: 'farm', nameAr: 'مزرعة واستراحة', nameEn: 'Farm & Rest House' },
    { id: 'camp', nameAr: 'مخيم مخيمات', nameEn: 'Camp Site' }
  ],
  phones: [
    { id: 'smartphone', nameAr: 'هواتف ذكية', nameEn: 'Smartphones' },
    { id: 'tablet', nameAr: 'آيباد وتابلت', nameEn: 'Tablets' },
    { id: 'smartwatch', nameAr: 'ساعات ذكية', nameEn: 'Smart Watches' },
    { id: 'accessories', nameAr: 'إكسسوارات وشواحن', nameEn: 'Accessories & Chargers' },
  ],
  electronics: [
    { id: 'laptops', nameAr: 'كمبيوتر ولابتوب', nameEn: 'Computers & Laptops' },
    { id: 'tv', nameAr: 'شاشات وتلفزيونات', nameEn: 'TVs & Displays' },
    { id: 'home_appliances', nameAr: 'أجهزة منزلية ومطابخ', nameEn: 'Home Appliances' },
    { id: 'cameras', nameAr: 'كاميرات وتصوير', nameEn: 'Cameras & Photography' },
    { id: 'gaming', nameAr: 'بلايستيشن وألعاب فيديو', nameEn: 'Gaming Consoles & Games' },
  ],
  furniture: [
    { id: 'living_room', nameAr: 'مجالس وطقم كنبات', nameEn: 'Living Room & Sofas' },
    { id: 'bedroom', nameAr: 'غرف نوم وأسرة', nameEn: 'Bedrooms & Beds' },
    { id: 'kitchen', nameAr: 'مستلزمات مطبخ ومائدة', nameEn: 'Kitchen & Dining' },
    { id: 'decor', nameAr: 'تحف وديكورات وإضاءة', nameAr: 'Decor & Antiques' },
    { id: 'office', nameAr: 'أثاث مكتبي', nameEn: 'Office Furniture' },
  ],
  fashion: [
    { id: 'men', nameAr: 'ملابس رجالية', nameEn: 'Men\'s Wear' },
    { id: 'women', nameAr: 'ملابس نسائية وعبايات', nameEn: 'Women\'s Wear' },
    { id: 'children', nameAr: 'مستلزمات أطفال', nameEn: 'Children & Baby' },
    { id: 'perfumes', nameAr: 'عطور ومستحضرات تجميل', nameEn: 'Perfumes & Beauty' },
    { id: 'watches', nameAr: 'ساعات ومجوهرات', nameEn: 'Watches & Jewelry' },
  ],
  livestock: [
    { id: 'sheep', nameAr: 'أغنام ومواشي', nameEn: 'Sheep & Livestock' },
    { id: 'birds', nameAr: 'طيور ودواجن', nameEn: 'Birds & Poultry' },
    { id: 'horses', nameAr: 'خيول وأصائل', nameEn: 'Horses' },
    { id: 'cats_dogs', nameAr: 'قطط وحيوانات أليفة', nameEn: 'Pets' },
    { id: 'feed', nameAr: 'أعلاف ومستلزمات بيطرية', nameEn: 'Animal Feed & Veterinary' },
  ],
  solar: [
    { id: 'panels', nameAr: 'ألواح طاقة شمسية', nameEn: 'Solar Panels' },
    { id: 'batteries', nameAr: 'بطاريات طاقة', nameEn: 'Solar Batteries' },
    { id: 'inverters', nameAr: 'محولات وانفرترات', nameEn: 'Inverters' },
    { id: 'generators', nameAr: 'مولدات كهربائية', nameEn: 'Generators' },
    { id: 'pumps', nameAr: 'غواطس ومضخات شمسية', nameEn: 'Solar Pumps' },
  ],
  jobs: [
    { id: 'admin', nameAr: 'إدارة ومبيعات وتسويق', nameEn: 'Management & Sales' },
    { id: 'tech', nameAr: 'برمجة وتقنية ومعلومات', nameEn: 'IT & Software' },
    { id: 'medical', nameAr: 'طب وصيدلة وتمريض', nameEn: 'Medical & Healthcare' },
    { id: 'engineering', nameAr: 'هندسة وإنشاءات', nameEn: 'Engineering' },
    { id: 'driver_job', nameAr: 'سائقين وتوصيل', nameEn: 'Drivers & Delivery' },
    { id: 'freelance', nameAr: 'عمل حُر وعن بُعد', nameEn: 'Freelance & Remote' },
  ],
  services: [
    { id: 'maintenance', nameAr: 'صيانة منزلية وسباكة وكهرباء', nameEn: 'Home Maintenance' },
    { id: 'car_repair', nameAr: 'صيانة سيارات وميكانيك', nameEn: 'Car Repair' },
    { id: 'transport', nameAr: 'نقل عفش وشحن', nameEn: 'Movers & Shipping' },
    { id: 'design', nameAr: 'تصميم ومونتاج ودعاية', nameEn: 'Design & Media' },
    { id: 'events', nameAr: 'حفلات ومناسبات وتجهيزات', nameEn: 'Events & Catering' },
  ],
  car_rental: [
    { id: 'daily', nameAr: 'تأجير يومي', nameEn: 'Daily Rental' },
    { id: 'weekly', nameAr: 'تأجير أسبوعي', nameEn: 'Weekly Rental' },
    { id: 'monthly', nameAr: 'تأجير شهري', nameEn: 'Monthly Rental' },
    { id: 'with_driver', nameAr: 'تأجير مع سائق', nameEn: 'With Driver' }
  ],
  other: [
    { id: 'custom', nameAr: 'قسم آخر مخصص', nameEn: 'Custom Section' }
  ]
};

export const INITIAL_USERS: User[] = [];
export const INITIAL_REVIEWS: any[] = [];
export const INITIAL_ADS: Ad[] = [];
