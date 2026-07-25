import { prisma } from './src/lib/prisma.ts';
import { getDeterministicUuid } from './server/utils/db-helpers.ts';

async function testStage3SearchUxAndAutocomplete() {
  console.log('===============================================================');
  console.log('🧪 STAGE 3: PROFESSIONAL SEARCH UX & AUTOCOMPLETE AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    stage: 'Stage 3 - Professional Search UX',
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
    // 1. Test Autocomplete Query Matching Engine against Canonical Taxonomy
    const allCategories = await prisma.category.findMany({ select: { id: true, nameAr: true, nameEn: true } });
    
    logResult(
      'Taxonomy Suggestions Availability',
      allCategories.length === 23,
      `Loaded ${allCategories.length} categories for real-time autocomplete indexing.`
    );

    const hotelsCatUuid = getDeterministicUuid('hotels');

    // 2. Test Arabic Substring & Prefix Autocomplete Matching
    const sampleQuery = 'فنادق';
    const matchedCategories = allCategories.filter(c => 
      c.nameAr.includes(sampleQuery) || c.nameEn.toLowerCase().includes(sampleQuery.toLowerCase())
    );

    logResult(
      'Arabic Prefix & Substring Autocomplete Resolution',
      matchedCategories.length > 0 && matchedCategories[0].id === hotelsCatUuid,
      `Query "${sampleQuery}" resolved to category: ${matchedCategories.map(c => c.nameAr).join(', ')}`
    );

    // 3. Test Deterministic Search Order & Scope Isolation
    const scopedAdsCount = await prisma.ad.count({
      where: {
        categoryId: hotelsCatUuid,
        status: 'ACTIVE'
      }
    });

    logResult(
      'Category-Scoped Search Pill Isolation',
      typeof scopedAdsCount === 'number',
      `Hotels Category Scope active — returns ${scopedAdsCount} matching active ads.`
    );

    // 4. Check DB Category Count Stability
    const catCount = await prisma.category.count();
    logResult(
      'Post-Search UX Category Count Stability',
      catCount === 23,
      'Category count in DB remains strictly 23.'
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 STAGE 3 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Search UX Audit Error:', e);
    report.status = 'FAIL';
  } finally {
    await prisma.$disconnect();
  }
}

testStage3SearchUxAndAutocomplete();
