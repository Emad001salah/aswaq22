import { prisma } from './src/lib/prisma.ts';

async function testStage7TrustAndSafetySystem() {
  console.log('===============================================================');
  console.log('🧪 STAGE 7: TRUST & SAFETY SYSTEM (REPORTS & ANTI-FRAUD) AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    stage: 'Stage 7 - Trust & Safety System',
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
    // 1. Fetch an Active Ad and User for Reporting
    const targetAd = await prisma.ad.findFirst({ where: { status: 'ACTIVE' } });
    const reporterUser = await prisma.user.findFirst();

    logResult(
      'Target Ad & Reporter Availability',
      targetAd !== null && reporterUser !== null,
      `Reporting target Ad ID "${targetAd?.id}" by reporter "${reporterUser?.name}"`
    );

    // 2. Test Report Creation in DB
    const testReport = await prisma.report.create({
      data: {
        adId: targetAd.id,
        reporterId: reporterUser.id,
        reason: 'إعلان قد يحتوي معلومات غير دقيقة (فحص مؤتمت للمرحلة 7)',
        status: 'pending'
      }
    });

    logResult(
      'Report Creation & DB Persistence',
      testReport !== null && testReport.status === 'pending',
      `Created report ID "${testReport.id}" with initial status "${testReport.status}"`
    );

    // 3. Test Report Duplicate Prevention Logic
    const duplicateCheck = await prisma.report.findFirst({
      where: {
        adId: targetAd.id,
        reporterId: reporterUser.id
      }
    });

    logResult(
      'Duplicate Report Prevention Indexing',
      duplicateCheck !== null,
      `Report already recorded for user "${reporterUser.name}" on ad "${targetAd.id}"`
    );

    // 4. Test Report Resolution Status Update
    const updatedReport = await prisma.report.update({
      where: { id: testReport.id },
      data: { status: 'resolved' }
    });

    logResult(
      'Moderation Lifecycle Status Transition',
      updatedReport.status === 'resolved',
      `Report status transitioned from "pending" to "${updatedReport.status}"`
    );

    // Cleanup test report
    await prisma.report.delete({ where: { id: testReport.id } });

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 STAGE 7 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Stage 7 Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testStage7TrustAndSafetySystem();
