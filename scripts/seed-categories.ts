import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma.ts';
import { getDeterministicUuid } from '../server/utils/db-helpers.ts';

const DB_FILE = path.join(process.cwd(), 'db.json');

async function main() {
  console.log('[Seed] Seeding Categories and Sub-Categories from db.json...');
  if (!fs.existsSync(DB_FILE)) {
    console.error(`[Seed] Error: db.json not found at ${DB_FILE}`);
    return;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const dbData = JSON.parse(raw) as any;

  // 1. General default category
  const generalUuid = getDeterministicUuid('general');
  await prisma.category.upsert({
    where: { id: generalUuid },
    update: {},
    create: {
      id: generalUuid,
      nameAr: 'عام',
      nameEn: 'General',
      icon: 'Hexagon',
    },
  });

  // 2. Load and upsert categories
  if (dbData.categories) {
    console.log(`[Seed] Found ${dbData.categories.length} categories to seed.`);
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

  console.log('[Seed] Categories and Sub-categories seeded successfully! ✅');
}

main()
  .catch(err => {
    console.error('[Seed] Fatal error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
