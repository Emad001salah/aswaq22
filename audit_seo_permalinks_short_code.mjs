import { getAdReferenceCode, buildAdSeoUrl } from './src/data.ts';

async function testShortReferenceCodeAndSeoPermalinks() {
  console.log('===============================================================');
  console.log('🧪 SHORT REFERENCE CODE & CLEAN SEO PERMALINKS AUDIT SUITE');
  console.log('===============================================================');

  const report = {
    test: 'Short Reference Code & OpenSooq-style SEO Permalinks',
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
    const sampleAd = {
      id: 'fff2f7b3-273b-4a76-8d62-da2e57f7b00c',
      title: 'شقق مفروشة للايجار بالمعادن والحديقة',
      category: 'hotels'
    };

    // 1. Test Short Reference Code Generation (9 digits like 284422648)
    const refCode = getAdReferenceCode(sampleAd);
    const is9DigitNumber = /^[0-9]{9}$/.test(refCode);

    logResult(
      'Short 9-Digit Ad Reference Code Generation',
      is9DigitNumber,
      `UUID "${sampleAd.id}" converted to short reference code: #${refCode} (Length: ${refCode.length})`
    );

    // 2. Test OpenSooq-style SEO Permalink URL Construction
    const seoUrl = buildAdSeoUrl(sampleAd, 'jo');
    const isCleanSeoUrl = seoUrl.startsWith('/jo/ad/') && seoUrl.includes(refCode) && !seoUrl.includes('fff2f7b3');

    logResult(
      'OpenSooq-Style Clean SEO Permalink URL Construction',
      isCleanSeoUrl,
      `Clean SEO URL generated: "${seoUrl}"`
    );

    // 3. Verify Absence of Long 36-char UUID in URL
    logResult(
      'Absence of Long 36-char UUID in URL',
      !seoUrl.includes(sampleAd.id),
      'No long UUIDs present in clean SEO permalink URL.'
    );

    const allPassed = report.tests.every(t => t.passed);
    report.status = allPassed ? 'PASS' : 'FAIL';

    console.log('\n---------------------------------------------------------------');
    console.log(`📌 SEO PERMALINK AUDIT RESULT: ${report.status}`);
    console.log('---------------------------------------------------------------\n');

  } catch (e) {
    console.error('SEO Audit Error:', e);
    report.status = 'FAIL';
  }
}

testShortReferenceCodeAndSeoPermalinks();
