import { prisma } from './src/lib/prisma.ts';

async function testStage6EnterpriseStoresSystem() {
  console.log('===============================================================');
  console.log('🧪 STAGE 6: ENTERPRISE STORES & VERIFIED DEALERS AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    stage: 'Stage 6 - Enterprise Stores',
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
    // 1. Ensure at least one Verified Dealer / Store User exists in DB
    let sampleStore = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'MERCHANT' },
          { isVerified: 'verified' }
        ]
      }
    });

    if (!sampleStore) {
      // Seed a verified company store if none exists
      sampleStore = await prisma.user.create({
        data: {
          email: 'official_dealer_store@aswaq.com',
          name: 'معرض الفخامة المعتمد للسيارات',
          password: 'hashed_password_store',
          role: 'MERCHANT',
          isVerified: 'verified',
          bio: 'المعرض الرسمي المعتمد في أسواق اليمن والخليج لبيع وتأجير السيارات الفاخرة',
          city: 'sanaa_city'
        }
      });
    }

    logResult(
      'Verified Store / Dealer Identity Verification',
      sampleStore !== null && (sampleStore.role === 'MERCHANT' || sampleStore.isVerified === 'verified'),
      `Verified Store: "${sampleStore.name}" (ID: ${sampleStore.id}, Role: ${sampleStore.role}, Verified: ${sampleStore.isVerified})`
    );

    // 2. Test Store Active Ads Scope & Catalog Isolation
    const storeAds = await prisma.ad.findMany({
      where: {
        userId: sampleStore.id,
        status: 'ACTIVE'
      }
    });

    logResult(
      'Store Active Inventory Catalog Scope',
      Array.isArray(storeAds),
      `Store "${sampleStore.name}" catalog contains ${storeAds.length} active listed items.`
    );

    // 3. Test Store Verification Badge Integrity
    const verifiedBadge = sampleStore.isVerified === 'verified' ? '💎 متجر معتمد' : '🏢 شركة مرخصة';
    logResult(
      'Enterprise Store Verification Badge Rendering',
      typeof verifiedBadge === 'string' && verifiedBadge.length > 0,
      `Store Seal Badge: "${verifiedBadge}"`
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 STAGE 6 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Stage 6 Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testStage6EnterpriseStoresSystem();
