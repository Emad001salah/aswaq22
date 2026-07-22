/**
 * src/constants/sample-posts.ts
 *
 * Sample social feed posts for marketplace fallback displays.
 */

export const DEFAULT_SOCIAL_POSTS = [
  {
    id: "jo_post_1",
    authorId: "jo_user_1",
    authorName: "عمر المجالي",
    authorHandle: "omar_cars",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80",
    content: "عشاق التميز في عمان، وصلت حديثاً تشكيلة واسعة من السيارات الهجينة والكهربائية (تويوتا، بي واي دي، تسلا) بخصومات حصرية لعملاء تطبيق أسواق الأردن! تفضلوا بزيارة فرعنا الجديد في العبدلي أو تواصلوا لمعاينة الفحص كرت 🚗🔋🔌",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
    createdAt: "2026-06-01T09:00:00.000Z",
    likes: 42,
    likedBy: [] as string[],
    comments: [
      { id: "jc1", author: "أنس القضاه", comment: "كم سعر الهيلوكس أو الكامري كاش بالله عليك؟" }
    ]
  },
  {
    id: "jo_post_2",
    authorId: "jo_user_2",
    authorName: "رانيا سويدان",
    authorHandle: "rania_decor",
    authorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
    content: "لكل الباحثين عن تشطيبات سوبر ديلوكس وديكورات تضفي الفخامة على بيوتهم في دابوق والجبيهة والعبدلي، يسعدنا تقديم استشارة مجانية وخصم 15% على التصاميم الداخلية هذا الشهر. يسعدني سماع آرائكم بالعمل الأخير المرفق! 🏡🎨🌟",
    image: "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=800&q=80",
    createdAt: "2026-06-01T15:10:00.000Z",
    likes: 19,
    likedBy: [] as string[],
    comments: []
  }
];
