import { CATEGORIES, SUB_CATEGORIES, BRANDS_AND_MODELS, buildTaxonomyBreadcrumbs } from './src/data.ts';

async function testStage4MultiLevelTaxonomy() {
  console.log('===============================================================');
  console.log('🧪 STAGE 4: MULTI-LEVEL TAXONOMY & SEO BREADCRUMBS AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    stage: 'Stage 4 - Multi-Level Taxonomy',
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
    // 1. Verify Level 1 Categories Count
    logResult(
      'Level 1 Taxonomy Integrity',
      CATEGORIES.length === 23,
      `Level 1 contains exactly ${CATEGORIES.length} canonical categories.`
    );

    // 2. Verify Level 2 Subcategory Mapping
    const carsSubCategories = SUB_CATEGORIES['cars'] || [];
    logResult(
      'Level 2 Subcategory Mapping Integrity',
      carsSubCategories.length > 0,
      `Category "cars" maps to ${carsSubCategories.length} subcategories (${carsSubCategories.map(s => s.nameAr).join(', ')}).`
    );

    // 3. Verify Level 3 & 4 Brand and Model Mapping
    const carBrands = BRANDS_AND_MODELS['cars'] || [];
    const toyotaBrand = carBrands.find(b => b.brandEn === 'Toyota');
    logResult(
      'Level 3 & 4 Brand/Model Hierarchy Integrity',
      carBrands.length > 0 && toyotaBrand !== undefined && toyotaBrand.models.length > 0,
      `Found brand "${toyotaBrand?.brandAr}" with ${toyotaBrand?.models.length} models (${toyotaBrand?.models.map(m => m.nameAr).slice(0, 3).join(', ')}...).`
    );

    // 4. Test SEO Breadcrumbs Generator
    const breadcrumbs = buildTaxonomyBreadcrumbs('cars', 'sedan', 'تويوتا', 'كامري', true);
    logResult(
      'SEO Breadcrumb Path Resolution',
      breadcrumbs.length === 5 && breadcrumbs[4].label === 'كامري',
      `Hierarchy path resolved: ${breadcrumbs.map(b => b.label).join(' > ')}`
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 STAGE 4 FINAL RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('Taxonomy Audit Error:', e);
    report.status = 'FAIL';
  }
}

testStage4MultiLevelTaxonomy();
