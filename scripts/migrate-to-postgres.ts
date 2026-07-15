import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const DB_FILE = path.join(process.cwd(), 'db.json');
const BATCH_SIZE = 500;

function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

function getDeterministicUuid(str: string): string {
  // If it's already a valid UUID, return it
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  // Hash the string and format it as a valid deterministic UUID
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '4' + hash.substring(13, 16);
  const part4 = 'a' + hash.substring(17, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

async function main() {
  console.log('[Migration] Starting batched data migration to PostgreSQL...');
  if (!fs.existsSync(DB_FILE)) {
    console.warn(`[Migration] Warning: db.json not found at ${DB_FILE}. Skipping migration.`);
    return;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const dbData = JSON.parse(raw) as any;

  // 1. Ensure GENERAL category exists in database
  const generalUuid = getDeterministicUuid('general');
  const defaultCategory = await prisma.category.upsert({
    where: { id: generalUuid },
    update: {},
    create: {
      id: generalUuid,
      nameAr: 'عام',
      nameEn: 'General',
      icon: 'Hexagon',
    },
  });

  // Seed standard categories from DB categories to match schema
  if (dbData.categories) {
    console.log(`[Migration] Seeding ${dbData.categories.length} categories...`);
    for (const c of dbData.categories) {
      const catUuid = getDeterministicUuid(c.id);
      await prisma.category.upsert({
        where: { id: catUuid },
        update: {
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          icon: c.icon || 'Hexagon',
        },
        create: {
          id: catUuid,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          icon: c.icon || 'Hexagon',
        },
      });

      if (c.subCategories) {
        for (const sub of c.subCategories) {
          const subUuid = getDeterministicUuid(sub.id);
          await prisma.subCategory.upsert({
            where: { id: subUuid },
            update: {
              nameAr: sub.nameAr,
              nameEn: sub.nameEn,
            },
            create: {
              id: subUuid,
              categoryId: catUuid,
              nameAr: sub.nameAr,
              nameEn: sub.nameEn,
            },
          });
        }
      }
    }
  }

  // 2. Migrate Users
  const usersList = dbData.users || [];
  console.log(`[Migration] Migrating ${usersList.length} users in batches...`);
  const userBatches = chunkArray(usersList, BATCH_SIZE);

  interface LegacyUser {
    id: string;
    email: string;
    name: string;
    phone?: string;
    password?: string;
    avatar?: string;
    role?: string;
    verified?: boolean;
  }

  for (let i = 0; i < userBatches.length; i++) {
    const batch = userBatches[i] as LegacyUser[];
    console.log(`[Migration] Processing user batch ${i + 1}/${userBatches.length}...`);
    await prisma.$transaction(async (tx) => {
      for (const u of batch) {
        const userUuid = getDeterministicUuid(u.id);
        await tx.user.upsert({
          where: { id: userUuid },
          update: {
            name: u.name,
            phone: u.phone || null,
            avatar: u.avatar || null,
            role: u.role === 'admin' || u.role === 'ADMIN' ? 'ADMIN' : 'USER',
            isVerified: u.verified ? 'verified' : 'none',
          },
          create: {
            id: userUuid,
            email: u.email || `${u.id}@example.com`,
            name: u.name,
            phone: u.phone || null,
            password: u.password || '$2b$10$PlaceholderPasswordHashForLegacyUsers...',
            avatar: u.avatar || null,
            role: u.role === 'admin' || u.role === 'ADMIN' ? 'ADMIN' : 'USER',
            isVerified: u.verified ? 'verified' : 'none',
          },
        });
      }
    });
  }

  interface LegacyAd {
    id: string;
    userId: string;
    title: string;
    description: string;
    price: string | number;
    currency?: string;
    category: string;
    subCategory?: string;
    city: string;
    district?: string;
    status: string;
    latitude?: number;
    longitude?: number;
    views: string | number;
    images?: string | string[];
    jobType?: string;
  }

  // 3. Migrate Ads & Images
  const adsList = dbData.ads || [];
  console.log(`[Migration] Migrating ${adsList.length} ads in batches...`);
  const adBatches = chunkArray(adsList, BATCH_SIZE);

  for (let i = 0; i < adBatches.length; i++) {
    const batch = adBatches[i] as LegacyAd[];
    console.log(`[Migration] Processing ad batch ${i + 1}/${adBatches.length}...`);
    await prisma.$transaction(async (tx) => {
      for (const ad of batch) {
        // Confirm user exists
        const userUuid = getDeterministicUuid(ad.userId);
        const userExists = await tx.user.findUnique({ where: { id: userUuid } });
        if (!userExists) continue;

        // Verify category
        const catUuid = getDeterministicUuid(ad.category);
        const catExists = await tx.category.findUnique({ where: { id: catUuid } });
        const finalCategoryId = catExists ? catExists.id : defaultCategory.id;

        // Verify subcategory
        let finalSubCategoryId: string | null = null;
        if (ad.subCategory) {
          const subUuid = getDeterministicUuid(ad.subCategory);
          const subExists = await tx.subCategory.findUnique({ where: { id: subUuid } });
          if (subExists) {
            finalSubCategoryId = subExists.id;
          }
        }

        const adUuid = getDeterministicUuid(ad.id);
        const createdAd = await tx.ad.upsert({
          where: { id: adUuid },
          update: {
            title: ad.title,
            description: ad.description,
            price: typeof ad.price === 'string' ? parseFloat(ad.price) : (ad.price || 0),
            currency: ad.currency || 'YER',
            categoryId: finalCategoryId,
            subCategoryId: finalSubCategoryId,
            jobType: ad.jobType === 'seeking' || ad.jobType === 'hiring' ? ad.jobType : null,
            city: ad.city,
            district: ad.district || null,
            status: ad.status === 'active' || ad.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
            latitude: ad.latitude || null,
            longitude: ad.longitude || null,
          },
          create: {
            id: adUuid,
            title: ad.title,
            description: ad.description,
            price: typeof ad.price === 'string' ? parseFloat(ad.price) : (ad.price || 0),
            currency: ad.currency || 'YER',
            categoryId: finalCategoryId,
            subCategoryId: finalSubCategoryId,
            jobType: ad.jobType === 'seeking' || ad.jobType === 'hiring' ? ad.jobType : null,
            city: ad.city,
            district: ad.district || null,
            status: ad.status === 'active' || ad.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
            userId: userUuid,
            latitude: ad.latitude || null,
            longitude: ad.longitude || null,
            views: typeof ad.views === 'string' ? parseInt(ad.views) : (ad.views || 0),
          },
        });

        // Split and insert images to relationship table
        const rawImages: string[] = typeof ad.images === 'string' ? JSON.parse(ad.images) : (ad.images || []);
        if (rawImages.length > 0) {
          // Clear old images first to prevent duplicates on rerunning migration
          await tx.adImage.deleteMany({ where: { adId: createdAd.id } });
          
          await tx.adImage.createMany({
            data: rawImages.map((url, idx) => ({
              adId: createdAd.id,
              url,
              sortOrder: idx,
              width: 800,
              height: 600,
              blurHash: 'LEHV6nWB2yk8pyo0adRgCQcDx[y?', // Placeholder hash
            })),
          });
        }
      }
    });
  }

  // 4. Seed default Feature Flags
  console.log('[Migration] Seeding default feature flags...');
  const defaultFlags = [
    { key: 'beta_access', name: 'Beta Access', description: 'Master gate: users must have an active beta invitation', enabled: true, rolloutPct: 0 },
    { key: 'beta_chat', name: 'Beta Chat', description: 'Real-time messaging between buyers and sellers', enabled: false, rolloutPct: 0 },
    { key: 'ai_recommendations', name: 'AI Recommendations', description: 'ML-based ad recommendations on homepage', enabled: false, rolloutPct: 0 },
    { key: 'premium_ads', name: 'Premium Ads', description: 'Paid featured/promoted ad placements', enabled: false, rolloutPct: 0 },
    { key: 'map_view', name: 'Map View', description: 'Show ads on an interactive map', enabled: false, rolloutPct: 10 },
    { key: 'seller_analytics', name: 'Seller Analytics', description: 'Per-seller dashboard showing views, favorites, and contact rate', enabled: false, rolloutPct: 20 },
    { key: 'advanced_search', name: 'Advanced Search', description: 'Price range, condition, date filters', enabled: true, rolloutPct: 100 },
    { key: 'video_ads', name: 'Video Ads', description: 'Allow video upload in ad creation', enabled: false, rolloutPct: 0 },
    { key: 'logistics_service', name: 'Logistics & Delivery Service', description: 'Enable last-mile delivery, driver dispatching, and logistics ledger', enabled: false, rolloutPct: 0 }
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        rolloutPct: flag.rolloutPct,
      }
    });
  }

  console.log('\x1b[32m[Migration] Batched migration completed successfully!\x1b[0m');
}

main()
  .catch((e) => {
    console.error('[Migration] Error running database migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
