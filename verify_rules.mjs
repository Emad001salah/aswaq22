import { PrismaClient } from '@prisma/client';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';
import { AppError } from './server/middleware/error.ts';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('🧪 Starting Security & Verification Test Suite for Aswaq22 Ads & Categories');
  console.log('==========================================================================');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  // Test 1: Category Count must be exactly 23 canonical categories
  const initialCats = await prisma.category.findMany();
  assert(initialCats.length === 23, `Initial category count in DB is 23 (actual: ${initialCats.length})`);

  // Test 2: Verify deterministic UUID lookup for existing canonical categories
  const hotelsUuid = getDeterministicUuid('hotels');
  const hotelsCat = await prisma.category.findUnique({ where: { id: hotelsUuid } });
  assert(hotelsCat !== null && hotelsCat.nameAr === 'فنادق', 'Canonical lookup for "hotels" returns correct DB category "فنادق"');

  // Test 3: Subcategory hierarchy verification
  const carsUuid = getDeterministicUuid('cars');
  const sedanUuid = getDeterministicUuid('sedan');
  const validSub = await prisma.subCategory.findFirst({
    where: { id: sedanUuid, categoryId: carsUuid }
  });
  assert(validSub !== null, 'Subcategory "sedan" correctly linked to parent category "cars"');

  const mismatchedSub = await prisma.subCategory.findFirst({
    where: { id: sedanUuid, categoryId: hotelsUuid }
  });
  assert(mismatchedSub === null, 'Subcategory "sedan" correctly rejected when associated with wrong parent category "hotels"');

  // Test 4: Verify non-existent category lookup fails to find any DB record (must trigger AppError in controller)
  const fakeCatUuid = getDeterministicUuid('non_existent_fake_category_123');
  const fakeCat = await prisma.category.findFirst({
    where: {
      OR: [
        { id: fakeCatUuid },
        { nameEn: { equals: 'non_existent_fake_category_123', mode: 'insensitive' } },
        { nameAr: { equals: 'non_existent_fake_category_123', mode: 'insensitive' } }
      ]
    }
  });
  assert(fakeCat === null, 'Lookup for invalid category "non_existent_fake_category_123" returns null (triggers 400 AppError)');

  // Test 5: Verify Category Count in DB remains strictly 23 after checking
  const finalCats = await prisma.category.findMany();
  assert(finalCats.length === 23, `Final category count in DB remains 23 (actual: ${finalCats.length})`);

  console.log('\n==========================================================================');
  console.log(`📊 Summary: ${passedTests} passed, ${failedTests} failed.`);

  await prisma.$disconnect();
  if (failedTests > 0) process.exit(1);
}

runVerification().catch((e) => {
  console.error('Test Suite Error:', e);
  process.exit(1);
});
