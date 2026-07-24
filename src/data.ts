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
  { id: 'jobs', nameAr: 'بوابة الوظائف والفرص', nameEn: 'Jobs & Opportunities', icon: 'Briefcase' },
  { id: 'cars', nameAr: 'سيارات ومركبات', nameEn: 'Vehicles', icon: 'Car' },
  { id: 'realestate', nameAr: 'عقارات وأراضي', nameEn: 'Real Estate', icon: 'Building2' },
  { id: 'rent_housing', nameAr: 'سكن للإيجار', nameEn: 'Rental Housing', icon: 'Home' },
  { id: 'hotels', nameAr: 'فنادق', nameEn: 'Hotels', icon: 'Building' },
  { id: 'resorts', nameAr: 'منتجعات وأماكن ترفيهية', nameEn: 'Resorts & Recreation', icon: 'Palmtree' },
  { id: 'car_rental', nameAr: 'تأجير سيارات', nameEn: 'Car Rental', icon: 'Key' },
  { id: 'electronics', nameAr: 'إلكترونيات وأجهزة منزلية', nameEn: 'Electronics & Appliances', icon: 'Tv' },
  { id: 'furniture', nameAr: 'أثاث ومستلزمات منزلية', nameEn: 'Furniture & Home', icon: 'Armchair' },
  { id: 'other', nameAr: 'أخرى (اكتب قسماً آخر ✏️)', nameEn: 'Other Custom', icon: 'Edit' },
  { id: 'handicrafts', nameAr: 'أشغال يدوية وحرفية', nameEn: 'Handicrafts & Arts', icon: 'Palette' },
  { id: 'food', nameAr: 'أغذية ومأكولات منزلية', nameEn: 'Food & Groceries', icon: 'Utensils' },
  { id: 'services', nameAr: 'خدمات صيانة ومعاملات وشحن', nameEn: 'Maintenance & Services', icon: 'Wrench' },
  { id: 'bicycles', nameAr: 'دراجات هوائية ونارية', nameEn: 'Bicycles & Bikes', icon: 'Bike' },
  { id: 'heavy_equipment', nameAr: 'شاحنات ومعدات ثقيلة وآلات', nameEn: 'Heavy Duty & Trucks', icon: 'Truck' },
  { id: 'perfumes', nameAr: 'عطور ومستحضرات تجميل', nameEn: 'Perfumes & Beauty', icon: 'Sparkles' },
  { id: 'books', nameAr: 'كتب وتدريب ومستلزمات', nameEn: 'Books & Training', icon: 'BookOpen' },
  { id: 'laptops', nameAr: 'كمبيوتر ومستلزمات شبكات', nameEn: 'Computers & IT', icon: 'Laptop' },
  { id: 'medical', nameAr: 'مستلزمات طبية وصحة وجمال', nameEn: 'Medical & Health', icon: 'Stethoscope' },
  { id: 'fashion', nameAr: 'ملابس وموضة وأزياء', nameEn: 'Fashion & Clothes', icon: 'Shirt' },
  { id: 'building_materials', nameAr: 'مواد بناء ومقاولات وديكور', nameEn: 'Building Materials', icon: 'Hammer' },
  { id: 'livestock', nameAr: 'مواشي وحيوانات وعلاجات', nameEn: 'Animals & Livestock', icon: 'PawPrint' },
  { id: 'phones', nameAr: 'هواتف ذكية واكسسوارات', nameEn: 'Smartphones & Accessories', icon: 'Smartphone' },
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
    { id: 'tv', nameAr: 'شاشات وتلفزيونات', nameEn: 'TVs & Displays' },
    { id: 'home_appliances', nameAr: 'أجهزة منزلية ومطابخ', nameEn: 'Home Appliances' },
    { id: 'audio', nameAr: 'سماعات وصوتيات', nameEn: 'Audio & Speakers' },
    { id: 'cameras', nameAr: 'كاميرات وتصوير', nameEn: 'Cameras & Photography' },
  ],
  laptops: [
    { id: 'laptop', nameAr: 'أجهزة لابتوب محمولة', nameEn: 'Laptops' },
    { id: 'desktop', nameAr: 'كمبيوتر مكتبي (PC)', nameEn: 'Desktop PCs' },
    { id: 'monitors', nameAr: 'شاشات ومستلزمات كمبيوتر', nameEn: 'Monitors & Parts' },
    { id: 'printers', nameAr: 'طابعات وماكينات تصوير', nameEn: 'Printers & Scanners' },
  ],
  furniture: [
    { id: 'living_room', nameAr: 'مجالس وطقم كنبات', nameEn: 'Living Room & Sofas' },
    { id: 'bedroom', nameAr: 'غرف نوم وأسرة', nameEn: 'Bedrooms & Beds' },
    { id: 'kitchen', nameAr: 'مستلزمات مطبخ ومائدة', nameEn: 'Kitchen & Dining' },
    { id: 'decor', nameAr: 'تحف وديكورات وإضاءة', nameEn: 'Decor & Antiques' },
    { id: 'office', nameAr: 'أثاث مكتبي', nameEn: 'Office Furniture' },
  ],
  fashion: [
    { id: 'men', nameAr: 'ملابس رجالية', nameEn: 'Men\'s Wear' },
    { id: 'women', nameAr: 'ملابس نسائية وعبايات', nameEn: 'Women\'s Wear' },
    { id: 'children', nameAr: 'مستلزمات أطفال', nameEn: 'Children & Baby' },
    { id: 'shoes', nameAr: 'أحذية وحقائب', nameEn: 'Shoes & Bags' },
  ],
  watches: [
    { id: 'men_watches', nameAr: 'ساعات رجالية', nameEn: 'Men\'s Watches' },
    { id: 'women_watches', nameAr: 'ساعات نسائية', nameEn: 'Women\'s Watches' },
    { id: 'jewelry', nameAr: 'مجوهرات وذهب وفضة', nameEn: 'Jewelry & Gold' },
  ],
  livestock: [
    { id: 'sheep', nameAr: 'أغنام ومواشي', nameEn: 'Sheep & Livestock' },
    { id: 'birds', nameAr: 'طيور ودواجن', nameEn: 'Birds & Poultry' },
    { id: 'horses', nameAr: 'خيول وأصائل', nameEn: 'Horses' },
    { id: 'cats_dogs', nameAr: 'قطط وحيوانات أليفة', nameEn: 'Pets' },
  ],
  solar: [
    { id: 'panels', nameAr: 'ألواح طاقة شمسية', nameEn: 'Solar Panels' },
    { id: 'batteries', nameAr: 'بطاريات طاقة', nameEn: 'Solar Batteries' },
    { id: 'inverters', nameAr: 'محولات وانفرترات', nameEn: 'Inverters' },
    { id: 'generators', nameAr: 'مولدات كهربائية', nameEn: 'Generators' },
  ],
  jobs: [
    { id: 'admin', nameAr: 'إدارة ومبيعات وتسويق', nameEn: 'Management & Sales' },
    { id: 'tech', nameAr: 'برمجة وتقنية ومعلومات', nameEn: 'IT & Software' },
    { id: 'medical', nameAr: 'طب وصيدلة وتمريض', nameEn: 'Medical & Healthcare' },
    { id: 'driver_job', nameAr: 'سائقين وتوصيل', nameEn: 'Drivers & Delivery' },
  ],
  services: [
    { id: 'maintenance', nameAr: 'صيانة منزلية وسباكة وكهرباء', nameEn: 'Home Maintenance' },
    { id: 'car_repair', nameAr: 'صيانة سيارات وميكانيك', nameEn: 'Car Repair' },
    { id: 'transport', nameAr: 'نقل عفش وشحن', nameEn: 'Movers & Shipping' },
  ],
  car_rental: [
    { id: 'daily', nameAr: 'تأجير يومي', nameEn: 'Daily Rental' },
    { id: 'monthly', nameAr: 'تأجير شهري', nameEn: 'Monthly Rental' },
    { id: 'with_driver', nameAr: 'تأجير مع سائق', nameEn: 'With Driver' }
  ],
  food: [
    { id: 'honey', nameAr: 'عسل يمني طبيعي', nameEn: 'Yemeni Honey' },
    { id: 'coffee', nameAr: 'بُن يمني ومكسرات', nameEn: 'Yemeni Coffee & Nuts' },
    { id: 'dates', nameAr: 'تمور وفواكه', nameEn: 'Dates & Fruits' },
  ],
  sports: [
    { id: 'fitness', nameAr: 'أجهزة ومعدات رياضية', nameEn: 'Fitness Equipment' },
    { id: 'camping', nameAr: 'خيام ومستلزمات رحلات', nameEn: 'Camping & Tents' },
  ],
  medical: [
    { id: 'medical_equip', nameAr: 'أجهزة ومستلزمات طبية', nameEn: 'Medical Devices' },
    { id: 'health_care', nameAr: 'رعاية صحية ومكملات', nameEn: 'Health & Care' },
  ],
  kids: [
    { id: 'toys', nameAr: 'ألعاب أطفال', nameEn: 'Toys' },
    { id: 'strollers', nameAr: 'عربات ومستلزمات مواليد', nameEn: 'Strollers & Baby Care' },
  ],
  books: [
    { id: 'books_list', nameAr: 'كتب وروايات', nameEn: 'Books & Novels' },
    { id: 'stationery', nameAr: 'أدوات مكتبية ومدرسية', nameEn: 'Stationery' },
  ],
  heavy_equipment: [
    { id: 'excavators', nameAr: 'بوكلينات وحفارات', nameEn: 'Excavators' },
    { id: 'loaders', nameAr: 'شيولات ورافعات', nameEn: 'Loaders & Cranes' },
  ],
  building_materials: [
    { id: 'iron_cement', nameAr: 'حديد وإسمنت', nameEn: 'Steel & Cement' },
    { id: 'tiles_marble', nameAr: 'بلاط وباركيه ورخام', nameEn: 'Tiles & Marble' },
  ],
  agriculture: [
    { id: 'seedling', nameAr: 'شتلات وأشجار', nameEn: 'Seedlings & Trees' },
    { id: 'pumps_agri', nameAr: 'مضخات وشبكات ري', nameEn: 'Irrigation Pumps' },
  ],
  antiques: [
    { id: 'janbiya', nameAr: 'جنابي وخناجر قديمة', nameEn: 'Janbiya & Daggers' },
    { id: 'agate', nameAr: 'عقيق يمني وأحجار كريمة', nameEn: 'Yemeni Agate & Gems' },
    { id: 'heritage', nameAr: 'تحف ومقتنيات تراثية', nameEn: 'Heritage Antiques' },
  ],
  other: [
    { id: 'custom', nameAr: 'قسم آخر مخصص', nameEn: 'Custom Section' }
  ]
};

export const INITIAL_USERS: User[] = [];
export const INITIAL_REVIEWS: any[] = [];
export const INITIAL_ADS: Ad[] = [];
