import { prisma } from './src/lib/prisma.ts';

async function testStage5SingleAdViewAndSpecsMatrix() {
  console.log('===============================================================');
  console.log('🧪 STAGE 5: SINGLE AD VIEW & SPECS MATRIX TABLE AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    stage: 'Stage 5 - Single Ad View & Specs Matrix',
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
    // 1. Fetch an Active Ad with Relations
    const sampleAd = await prisma.ad.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        category: true,
        user: true
      }
    });

    logResult(
      'Active Ad Data Retrieval for Single Detail View',
      sampleAd !== null,
      `Retrieved ad ID "${sampleAd?.id}" titled "${sampleAd?.title}".`
    );

    // 2. Validate Specifications Matrix Data Completeness
    const hasCategory = sampleAd?.category !== null;
    const hasPrice = typeof sampleAd?.price === 'number';
    const hasUser = sampleAd?.user !== null;

    logResult(
      'Specifications Matrix Table Data Completeness',
      hasCategory && hasPrice && hasUser,
      `Ad ID: ${sampleAd?.id} | Category: ${sampleAd?.category?.nameAr} | Price: ${sampleAd?.price} ${sampleAd?.currency}`
    );

    // 3. Verify Seller Profile Trust Card Status
    const sellerVerifiedStatus = sampleAd?.user?.isVerified;
    logResult(
      'Seller Profile Trust Card Status',
      sellerVerifiedStatus !== undefined && sellerVerifiedStatus !== null,
      `Seller ID "${sampleAd?.userId}" verification status: ${sellerVerifiedStatus ? 'Verified 🛡️' : 'Standard Account'}`
    );

    // 4. Verify View Count Increment Endpoint Consistency
    const beforeViews = sampleAd?.views || 0;
    await prisma.ad.update({
      where: { id: sampleAd.id },
      data: { views: { increment: 1 } }
    });
    const afterAd = await prisma.ad.findUnique({ where: { id: sampleAd.id } });

    logResult(
      'Atomic Single View Increment Integrity',
      afterAd.views === beforeViews + 1,
      `View counter incremented from ${beforeViews} to ${afterAd.views}.`
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 STAGE 5 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Stage 5 Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testStage5SingleAdViewAndSpecsMatrix();
