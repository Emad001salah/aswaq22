export const INITIAL_USERS = [
  {
    id: 'user_1',
    name: 'أبو أحمد الهمداني',
    email: 'ahmed@souqye.com',
    phone: '777123456',
    role: 'merchant',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    bio: 'معرض الهمداني للسيارات الفاخرة - صنعاء',
    rating: 4.9,
    verified: true,
    joinDate: '2024-01-15',
    active: true
  },
  {
    id: 'user_2',
    name: 'سالم المحاسب',
    email: 'salem@mail.com',
    phone: '777111222',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    bio: 'محاسب مالي وخبير في الأنظمة المحاسبية',
    rating: 4.8,
    verified: false,
    joinDate: '2024-02-20',
    active: true
  },
  {
    id: 'user_admin',
    name: 'المدير العام للمنصة',
    email: 'admin@souqye.com',
    phone: '770000000',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
    bio: 'إدارة سوق اليمن والأردن وتلقي الاقتراحات والشكاوى',
    rating: 5.0,
    verified: true,
    joinDate: '2023-01-01',
    active: true
  },
  // Jordanian Users
  {
    id: 'jo_user_1',
    name: 'عمر المجالي',
    email: 'omar@souqjo.com',
    phone: '0795554321',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80',
    bio: 'تجارة وتسويق السيارات الحديثة والهجينة في عمان والزرقاء 🚗🔋',
    rating: 4.9,
    verified: true,
    joinDate: '2025-05-10',
    active: true
  },
  {
    id: 'jo_user_2',
    name: 'رانيا سويدان',
    email: 'rania@souqjo.com',
    phone: '0781112223',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    bio: 'مهندسة ديكور داخلي ووسيطة عقارية مرخصة - عمان العبدلي 🏡✨',
    rating: 4.8,
    verified: true,
    joinDate: '2025-08-15',
    active: true
  },
  {
    id: 'jo_user_3',
    name: 'أنس القضاه',
    email: 'anas@souqjo.com',
    phone: '0770001112',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=150&q=80',
    bio: 'أخصائي إلكترونيات وأجهزة برمجية ذكية - إربد 💻🎮',
    rating: 4.7,
    verified: false,
    joinDate: '2025-09-01',
    active: true
  }
];

export const INITIAL_ADS = [
  // --- YEMEN ADS ---
  {
    id: 'ad_1',
    title: 'تويوتا هيلوكس 2023 دبل خليجي كرت',
    description: 'تويوتا هيلوكس موديل 2023 دبل، مواصفات عالية جداً، جير عادي، بنزين، قطعت مسافة 15,000 كم فقط. السيارة نظيفة خالية من الحوادث والرش، مجمركة ومرقمة جاهزة في صنعاء. تكييف ممتاز، شاشة ذكية، كاميرا خلفية، حساسات.',
    price: 32500,
    currency: 'USD',
    city: 'sanaa',
    category: 'cars',
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '777123456',
    status: 'active',
    views: 128,
    likes: 12,
    isFeatured: true,
    createdAt: '2026-05-24T18:30:00Z',
    userId: 'user_1'
  },
  {
    id: 'ad_2',
    title: 'شقة فاخرة للبيع في حي حدة الراقي',
    description: 'شقة سكنية واسعة ومصممة بأحدث الديكورات تقع في قلب حي حدة بصنعاء. تتكون من 4 غرف واسعة، صالة استقبال ضيوف كبيرة، مطبخ مجهز متكامل، 3 حمامات ممتازة، بلكونة مطلة على الشارع الرئيسي مع حراسة ومصعد شغال 24 ساعة ومولد كهرباء طوارئ.',
    price: 110000,
    currency: 'USD',
    city: 'sanaa',
    category: 'realestate',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '733987654',
    status: 'active',
    views: 95,
    likes: 8,
    isFeatured: true,
    createdAt: '2026-05-23T10:15:00Z',
    userId: 'user_2'
  },
  {
    id: 'ad_3',
    title: 'مطلوب مهندس تقنية معلومات لشركة صرافة',
    description: 'تعلن شركة صرافة كبرى عن حاجتها لمهندس تقنية معلومات خبرة لا تقل عن 3 سنوات في إدارة الشبكات والسيرفرات وحماية البيانات. الدوام كامل في المقر الرئيسي لمدينة عدن.',
    price: 1200,
    currency: 'USD',
    city: 'aden',
    category: 'jobs',
    jobType: 'hiring',
    images: ['https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80'],
    contactNumber: '777000001',
    status: 'active',
    views: 42,
    likes: 3,
    isFeatured: false,
    createdAt: '2026-05-25T09:00:00Z',
    userId: 'user_1'
  },

  // --- JORDAN ADS ---
  {
    id: 'ad_jo_1',
    title: 'تويوتا كامري هايبرد 2023 فحص 4 جيد كرت ملاءة 🚗🔋',
    description: 'تويوتا كامري موديل 2023 هايبرد ممتازة جداً واقتصادية للغاية. لون فضي ميتاليك، فحص كامل 7 جيد بدون ملاحظات (كرت أبيض)، فتحة سقف، كراسي جلد كهرباء، رادار تحديد مسار، مانع تصادم، شاشة ترفيه داعمة لـ Apple CarPlay و Android Auto. السيارة ممشاها قليل وجاهزة للتنازل الفوري في عمان حرة الزرقاء.',
    price: 24500,
    currency: 'JOD',
    city: 'amman',
    category: 'cars',
    images: [
      'https://images.unsplash.com/photo-1617469767053-d3b508a0d822?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0795554321',
    status: 'active',
    views: 340,
    likes: 28,
    isFeatured: true,
    latitude: 31.9522,
    longitude: 35.9106,
    videoUrl: 'https://player.vimeo.com/external/394301551.sd.mp4?s=ff7fedf4bb9bc3dc9391b1a43a758bdee1aa6ef8&profile_id=165&oauth2_token_id=57447761', // High Quality video
    createdAt: '2026-06-01T08:30:00Z',
    userId: 'jo_user_1'
  },
  {
    id: 'ad_jo_2',
    title: 'شقة فاخرة مفروشة للبيع في عبدلي بوليفارد 🏢✨',
    description: 'لهواة الرقي والاستثمار، شقة سوبر ديلوكس مفروشة بالكامل مساحة 145 متر مربع تقع في الطابق السادس بموقع استراتيجي مطل على بوليفارد العبدلي عمان. تتكون من غرفتين نوم (واحدة ماستر)، صالون معيشة واسع، مطبخ أمريكي مجهز بكافة الأجهزة الكهربائية، بلكونة زجاجية جميلة، مكيفات مركزي بالكامل، حراسة وموقف سيارة تحت الأرض ومصعد بأرقام سرية للملاك.',
    price: 135000,
    currency: 'JOD',
    city: 'amman',
    category: 'realestate',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0781112223',
    status: 'active',
    views: 215,
    likes: 19,
    isFeatured: true,
    latitude: 31.9612,
    longitude: 35.9015,
    videoUrl: 'https://player.vimeo.com/external/554807491.sd.mp4?s=3a411be07fac8aa9e8d7bb54c30c8ad9ef83cd3d&profile_id=165&oauth2_token_id=57447761',
    createdAt: '2026-06-01T10:00:00Z',
    userId: 'jo_user_2'
  },
  {
    id: 'ad_jo_3',
    title: 'جهاز بلايستيشن 5 مع يدتين أصليتين وألعاب مميزة 🎮🔥',
    description: 'جهاز PS5 Slim نسخة الأقراص بحالة الوكالة غير مستخدم ومفتوح لتجربة التشغيل فقط. يأتي معه يدتان تحكم أصليتين DualSense ومجموعة من 4 ألعاب قوية جداً (FC 25, God of War Ragnarok, GTA V, Spider-Man 2). كفالة سارية لمدة سنة كاملة من الوكيل الرسمي في الأردن، التوصيل متاح لكافة مناطق إربد وعمان.',
    price: 360,
    currency: 'JOD',
    city: 'irbid',
    category: 'laptops',
    images: [
      'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0770001112',
    status: 'active',
    views: 110,
    likes: 15,
    isFeatured: false,
    latitude: 32.5514,
    longitude: 35.8514,
    createdAt: '2026-06-01T11:45:00Z',
    userId: 'jo_user_3'
  },
  {
    id: 'ad_jo_4',
    title: 'هاتف ايفون 15 برو ماكس 256 جيجا تيتانيوم طبيعي 📱✨',
    description: 'ايفون 15 برو ماكس، سعة 256 جيجا بايت، لون تيتانيوم طبيعي (Natural Titanium)، نسبة البطارية 98% فما فوق، الجهاز بحالة لا تفرق عن الجديد إطلاقاً بدون أي خدش أو علامات استخدام. يدعم تشغيل شريحتين (eSIM + Physical)، غير مفتوح ولم يتم عمل أي صيانة له. البيع يشمل الصندوق الأصلي وكبل الشحن وكفر هداية مميز.',
    price: 690,
    currency: 'JOD',
    city: 'amman',
    category: 'phones',
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0770001112',
    status: 'active',
    views: 180,
    likes: 22,
    isFeatured: true,
    latitude: 31.9443,
    longitude: 35.8821,
    createdAt: '2026-05-31T15:20:00Z',
    userId: 'jo_user_3'
  },
  {
    id: 'ad_jo_5',
    title: 'مطلوب مبرمج ويب ومطور React ذو خبرة لدى شركة برمجية 💻🚀',
    description: 'تعلن إحدى أكبر كبرى شركات التكنولوجيا البرمجية في عمان العبدلي عن حاجتها لمطور ويب محترف ذي خبرة واسعة في استخدام React, Next.js, و TypeScript وتصميم الواجهات الأنيقة. بيئة عمل رائعة، رواتب وحوافز مجزية حسب الخبرات، دوام مرن بشكل هجين (حضوري وعن بعد). يرجى التقديم وإرفاق السيرة الذاتية عبر زر الاتصال أو الواتساب المباشر.',
    price: 900,
    currency: 'JOD',
    city: 'amman',
    category: 'jobs',
    jobType: 'hiring',
    images: [
      'https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0781112223',
    status: 'active',
    views: 75,
    likes: 4,
    isFeatured: false,
    createdAt: '2026-06-01T12:00:00Z',
    userId: 'jo_user_2'
  },
  {
    id: 'ad_jo_6',
    title: 'طلب توظيف: مهندس كهرباء وأنظمة طاقة شمسية في الشمال ⚡🔋',
    description: 'أنا مهندس كهرباء أردني مقيم في إربد، لدي خبرة 5 سنوات في مجالات تصميم وتركيب وصيانة أنظمة الطاقة الشمسية الكهروضوئية المتكاملة للمباني السكنية والمصانع والآبار. حاصل على رخص ممارسة المهنة وأجيد استخدام برامج التصميم الهندسية ومستعد للعمل والبدء الفوري لدى أي شركة في عمان أو الشمال.',
    price: 0,
    currency: 'JOD',
    city: 'irbid',
    category: 'jobs',
    jobType: 'seeking',
    images: [
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80'
    ],
    contactNumber: '0770001112',
    status: 'active',
    views: 31,
    likes: 1,
    isFeatured: false,
    createdAt: '2026-06-01T13:00:00Z',
    userId: 'jo_user_3'
  }
];

export const INITIAL_CHATS = [];
export const INITIAL_NOTIFICATIONS = [];
