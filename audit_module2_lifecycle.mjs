import { PrismaClient } from '@prisma/client';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';

const prisma = new PrismaClient();

async function testModule2AdLifecycle() {
  console.log('===============================================================');
  console.log('🧪 STAGE 0 - MODULE 2: AD LIFECYCLE AUDIT & TEST SUITE');
  console.log('===============================================================');

  const report = {
    module: 'Ad Lifecycle',
    timestamp: new Date().toISOString(),
    tests: [],
    status: 'PENDING'
  };

  function logResult(name, passed, details) {
    console.log(`${passed ? '  ✅ PASS' : '  ❌ FAIL'}: ${name}`);
    if (details) console.log(`     ↳ ${details}`);
    report.tests.push({ name, passed, details });
  }

  try {
    // Find or create test user
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          id: getDeterministicUuid('audit_test_user_001'),
          name: 'Audit Test User',
          phone: '+967770000000',
          role: 'USER'
        }
      });
    }

    const hotelsCatUuid = getDeterministicUuid('hotels');

    // 1. Create a dummy ad directly via Prisma representing the POST /api/ads flow
    const testAdId = getDeterministicUuid('audit_lifecycle_ad_001');

    // Cleanup prior run if exists
    await prisma.ad.deleteMany({ where: { id: testAdId } });

    const createdAd = await prisma.ad.create({
      data: {
        id: testAdId,
        title: 'إعلان تجريبي لفحص دورة الحياة',
        description: 'وصف الإعلان التجريبي للتحقق من النشر والتعديل والحذف',
        price: 50000,
        currency: 'YER',
        categoryId: hotelsCatUuid,
        city: 'sanaa_city',
        userId: testUser.id,
        status: 'ACTIVE'
      }
    });

    logResult(
      'Ad Creation Flow & DB Insertion',
      createdAd.id === testAdId && createdAd.status === 'ACTIVE',
      `Ad created with ID: ${testAdId.substring(0, 8)}... status: ${createdAd.status}`
    );

    // 2. Test Fetching Ad detail
    const fetchedAd = await prisma.ad.findUnique({
      where: { id: testAdId },
      include: { category: true, user: { select: { name: true, phone: true } } }
    });

    logResult(
      'Ad Detail Fetching & Relation Hydration',
      fetchedAd !== null && fetchedAd.category?.nameAr === 'فنادق',
      `Fetched ad title: "${fetchedAd?.title}", Category: "${fetchedAd?.category?.nameAr}"`
    );

    // 3. Test Updating Ad (Title & Price modification)
    const updatedAd = await prisma.ad.update({
      where: { id: testAdId },
      data: {
        title: 'إعلان تجريبي معدّل بنجاح',
        price: 55000
      }
    });

    logResult(
      'Ad Update Flow (Title & Price Persistence)',
      updatedAd.title === 'إعلان تجريبي معدّل بنجاح' && updatedAd.price === 55000,
      `Updated Title: "${updatedAd.title}", New Price: ${updatedAd.price}`
    );

    // 4. Test Deleting Ad (Cleanup)
    await prisma.ad.delete({ where: { id: testAdId } });
    const deletedCheck = await prisma.ad.findUnique({ where: { id: testAdId } });

    logResult(
      'Ad Deletion & Persistence Cleanup',
      deletedCheck === null,
      'Ad removed clean from database.'
    );

    // 5. Verify database categories count was never affected by ad creation/deletion
    const categoryCountAfterAdLifecycle = await prisma.category.count();
    logResult(
      'Category Count Stability After Full Ad Lifecycle',
      categoryCountAfterAdLifecycle === 23,
      `Category count remains 23.`
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 MODULE 2 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Lifecycle Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testModule2AdLifecycle();
