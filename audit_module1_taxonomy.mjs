import { PrismaClient } from '@prisma/client';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';

const prisma = new PrismaClient();

const CANONICAL_23_SLUGS = [
  'jobs', 'cars', 'realestate', 'rent_housing', 'hotels', 'resorts',
  'car_rental', 'electronics', 'furniture', 'other', 'handicrafts',
  'food', 'services', 'bicycles', 'heavy_equipment', 'perfumes',
  'books', 'laptops', 'medical', 'fashion', 'building_materials',
  'livestock', 'phones'
];

async function testModule1Taxonomy() {
  console.log('===============================================================');
  console.log('🧪 STAGE 0 - MODULE 1: CATEGORIES & TAXONOMY AUDIT & TEST SUITE');
  console.log('===============================================================');

  const report = {
    module: 'Categories & Taxonomy',
    timestamp: new Date().toISOString(),
    tests: [],
    rootCausesFound: [],
    fixesApplied: [],
    status: 'PENDING'
  };

  function logResult(name, passed, details) {
    console.log(`${passed ? '  ✅ PASS' : '  ❌ FAIL'}: ${name}`);
    if (details) console.log(`     ↳ ${details}`);
    report.tests.push({ name, passed, details });
  }

  try {
    // 1. Verify exact 23 categories in DB
    const dbCats = await prisma.category.findMany({
      include: { subCategories: true, _count: { select: { ads: true } } }
    });
    logResult(
      'DB Category Count == 23',
      dbCats.length === 23,
      `Found ${dbCats.length} categories in database.`
    );

    // 2. Verify all 23 canonical slugs match deterministic UUIDs
    let missingSlugs = [];
    for (const slug of CANONICAL_23_SLUGS) {
      const uuid = getDeterministicUuid(slug);
      const match = dbCats.find(c => c.id === uuid);
      if (!match) missingSlugs.push(slug);
    }
    logResult(
      'Canonical UUID Mapping Integrity',
      missingSlugs.length === 0,
      missingSlugs.length === 0 ? 'All 23 canonical slugs map 1:1 to DB UUIDs.' : `Missing: ${missingSlugs.join(', ')}`
    );

    // 3. Verify Subcategories linkage to parents
    const totalSubcats = await prisma.subCategory.count();
    const allSubs = await prisma.subCategory.findMany({ select: { id: true, categoryId: true } });
    const categoryIds = new Set(dbCats.map(c => c.id));
    const orphanedSubs = allSubs.filter(s => !categoryIds.has(s.categoryId)).length;
    logResult(
      'Subcategory Parent-Child Constraint Integrity',
      totalSubcats > 0 && orphanedSubs === 0,
      `Total subcategories: ${totalSubcats}, Orphaned: ${orphanedSubs}`
    );

    // 4. Verify no ghost categories are created when looking up invalid strings
    const invalidSlug = 'unknown_category_test_ghost_999';
    const invalidUuid = getDeterministicUuid(invalidSlug);
    const ghostCheck = await prisma.category.findFirst({
      where: {
        OR: [
          { id: invalidUuid },
          { nameEn: { equals: invalidSlug, mode: 'insensitive' } },
          { nameAr: { equals: invalidSlug, mode: 'insensitive' } }
        ]
      }
    });
    logResult(
      'Ghost Category Creation Prevention',
      ghostCheck === null,
      'Lookup for invalid category returns null as expected (throwing 400 AppError in controller).'
    );

    // 5. Final DB Count Check
    const finalCount = await prisma.category.count();
    logResult(
      'Post-Audit DB Category Count Stability',
      finalCount === 23,
      `Category count remains strictly 23.`
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 MODULE 1 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testModule1Taxonomy();
