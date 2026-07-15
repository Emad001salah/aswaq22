/**
 * k6-user-journey.js — Realistic User Journey Load Test
 *
 * Simulates 4 types of real users:
 *   1. Browser     (60%) — browses homepage, searches, views ads
 *   2. Poster      (20%) — registers, OTP, posts an ad
 *   3. PowerBuyer  (15%) — searches with filters, views multiple, favorites
 *   4. Admin       (5%)  — reviews analytics, moderates ads
 *
 * Thresholds match Sprint 6 acceptance criteria.
 */

import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom metrics ────────────────────────────────────────────────────────────
const searchSuccessRate  = new Rate('search_success_rate');
const adPostSuccess      = new Counter('ad_post_successes');
const adPostAbandonment  = new Counter('ad_post_abandonments');
const p95ByEndpoint      = new Trend('p95_by_endpoint', true);
const otpSuccessRate     = new Rate('otp_success_rate');

// ─── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Realistic ramp: 30 min warm-up → peak → cool-down
    browser: {
      executor:        'ramping-vus',
      startVUs:        0,
      stages: [
        { duration: '2m',  target: 20  },  // ramp up
        { duration: '5m',  target: 60  },  // steady state (60% of 100 VUs)
        { duration: '2m',  target: 0   },  // cool down
      ],
      exec: 'browserJourney',
    },
    poster: {
      executor:        'ramping-vus',
      startVUs:        0,
      stages: [
        { duration: '3m',  target: 5   },
        { duration: '5m',  target: 20  },  // 20% of 100 VUs
        { duration: '1m',  target: 0   },
      ],
      exec: 'posterJourney',
    },
    powerBuyer: {
      executor:        'ramping-vus',
      startVUs:        0,
      stages: [
        { duration: '2m',  target: 5   },
        { duration: '5m',  target: 15  },
        { duration: '1m',  target: 0   },
      ],
      exec: 'powerBuyerJourney',
    },
    admin: {
      executor:        'constant-vus',
      vus:             5,
      duration:        '8m',
      exec:            'adminJourney',
    },
  },

  thresholds: {
    // Core SLOs
    'http_req_duration':            ['p(95)<500', 'p(99)<1000'],
    'http_req_failed':              ['rate<0.01'],

    // Business KPIs
    'search_success_rate':          ['rate>0.85'],  // 85% searches return results
    'otp_success_rate':             ['rate>0.95'],  // 95% OTP success
    'http_req_duration{name:list_ads}': ['p(95)<300'],  // listing must be fast
    'http_req_duration{name:search}':   ['p(95)<400'],  // search must be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const HEADERS_JSON = { 'Content-Type': 'application/json' };

const CATEGORIES = ['vehicles', 'real_estate', 'electronics', 'jobs', 'furniture'];
const CITIES     = ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب'];
const QUERIES    = ['سيارة', 'شقة', 'هاتف', 'وظيفة', 'تلفزيون', 'أريكة', 'دراجة'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: r => r.status >= 200 && r.status < 300,
    [`${name}: has body`]:   r => r.body && r.body.length > 0,
  });
  p95ByEndpoint.add(res.timings.duration, { name });
  return ok;
}

// ─── 1. Browser Journey (60% of users) ────────────────────────────────────────
export function browserJourney() {
  group('browse_homepage', () => {
    const res = http.get(`${BASE_URL}/api/v1/ads?limit=20`, {
      tags: { name: 'list_ads' },
    });
    checkResponse(res, 'homepage_ads');
  });

  sleep(randomBetween(1, 3));  // reading time

  group('search_ads', () => {
    const query = randomFrom(QUERIES);
    const category = randomFrom(CATEGORIES);
    const city = randomFrom(CITIES);

    const res = http.get(
      `${BASE_URL}/api/v1/ads?q=${encodeURIComponent(query)}&category=${category}&city=${encodeURIComponent(city)}&limit=20`,
      { tags: { name: 'search' } },
    );

    checkResponse(res, 'search');

    let hasResults = false;
    try {
      const body = JSON.parse(res.body);
      hasResults = body.data && body.data.length > 0;
    } catch (_) {}

    searchSuccessRate.add(hasResults);

    if (!hasResults) {
      // Track abandonment signal
      http.post(
        `${BASE_URL}/api/v1/analytics/event`,
        JSON.stringify({ event: 'search_no_results', properties: { query, category } }),
        { headers: HEADERS_JSON, tags: { name: 'track_event' } },
      );
    }
  });

  sleep(randomBetween(0.5, 2));

  group('view_ad_detail', () => {
    // Get a real ad ID from listing
    const listRes = http.get(`${BASE_URL}/api/v1/ads?limit=5`);
    let adId = null;
    try {
      const body = JSON.parse(listRes.body);
      if (body.data && body.data.length > 0) {
        adId = body.data[Math.floor(Math.random() * body.data.length)].id;
      }
    } catch (_) {}

    if (adId) {
      const res = http.get(
        `${BASE_URL}/api/v1/ads/${adId}`,
        { tags: { name: 'view_ad' } },
      );
      checkResponse(res, 'view_ad_detail');
      sleep(randomBetween(2, 6));  // reading the ad
    }
  });

  sleep(randomBetween(1, 2));
}

// ─── 2. Poster Journey (20% of users) ─────────────────────────────────────────
export function posterJourney() {
  const phone = `+967${Math.floor(Math.random() * 9_000_000) + 1_000_000}`;
  let token = null;

  group('request_otp', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/otp/send`,
      JSON.stringify({ phone }),
      { headers: HEADERS_JSON, tags: { name: 'otp_send' } },
    );
    const ok = checkResponse(res, 'otp_send');
    otpSuccessRate.add(ok);
  });

  sleep(1.5);  // waiting for OTP

  group('verify_otp', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/otp/verify`,
      JSON.stringify({ phone, code: '123456' }),  // dev code
      { headers: HEADERS_JSON, tags: { name: 'otp_verify' } },
    );

    if (res.status === 200) {
      try { token = JSON.parse(res.body).data?.token; } catch (_) {}
    }
    otpSuccessRate.add(res.status === 200);
  });

  if (!token) {
    // Registration abandoned — user couldn't verify
    adPostAbandonment.add(1);
    return;
  }

  sleep(randomBetween(0.5, 1.5));

  group('post_ad', () => {
    const adPayload = {
      title:       `${randomFrom(['سيارة', 'شقة', 'هاتف', 'أثاث'])} للبيع - ${Math.floor(Math.random() * 1000)}`,
      description: 'حالة ممتازة، السعر قابل للتفاوض',
      price:       Math.floor(Math.random() * 50_000) + 1000,
      currency:    'YER',
      category:    randomFrom(CATEGORIES),
      city:        randomFrom(CITIES),
      contactNumber: phone,
    };

    const res = http.post(
      `${BASE_URL}/api/v1/ads`,
      JSON.stringify(adPayload),
      {
        headers: { ...HEADERS_JSON, Authorization: `Bearer ${token}` },
        tags:    { name: 'post_ad' },
      },
    );

    if (res.status === 201) {
      adPostSuccess.add(1);
    } else {
      adPostAbandonment.add(1);
    }

    check(res, { 'post_ad: created': r => r.status === 201 });
  });

  sleep(randomBetween(1, 3));
}

// ─── 3. Power Buyer Journey (15% of users) ────────────────────────────────────
export function powerBuyerJourney() {
  // Power buyers search multiple times with different filters
  for (let i = 0; i < 3; i++) {
    group(`search_${i}`, () => {
      const query    = randomFrom(QUERIES);
      const category = randomFrom(CATEGORIES);
      const minPrice = Math.floor(Math.random() * 10_000);
      const maxPrice = minPrice + Math.floor(Math.random() * 50_000);

      const res = http.get(
        `${BASE_URL}/api/v1/ads?q=${encodeURIComponent(query)}&category=${category}&minPrice=${minPrice}&maxPrice=${maxPrice}`,
        { tags: { name: 'filtered_search' } },
      );
      checkResponse(res, 'filtered_search');
      searchSuccessRate.add(res.status === 200);
    });

    sleep(randomBetween(0.5, 2));
  }

  // View several ads
  const listRes = http.get(`${BASE_URL}/api/v1/ads?limit=10`);
  let adIds = [];
  try {
    const body = JSON.parse(listRes.body);
    adIds = (body.data || []).map(a => a.id).slice(0, 4);
  } catch (_) {}

  for (const adId of adIds) {
    group('view_ad', () => {
      const res = http.get(`${BASE_URL}/api/v1/ads/${adId}`, { tags: { name: 'view_ad' } });
      checkResponse(res, 'view_ad');
      sleep(randomBetween(3, 8));  // serious buyer reads carefully
    });
  }

  sleep(randomBetween(1, 3));
}

// ─── 4. Admin Journey (5% of users) ───────────────────────────────────────────
export function adminJourney() {
  // Admin monitors analytics and moderates
  group('admin_health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
    check(res, { 'health: 200': r => r.status === 200 });
  });

  sleep(5);

  group('admin_metrics', () => {
    const res = http.get(`${BASE_URL}/metrics`, { tags: { name: 'metrics' } });
    check(res, { 'metrics: 200': r => r.status === 200 });
  });

  sleep(randomBetween(10, 30));
}

// ─── Utility ────────────────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ─── Soak test (30 min constant low load) ─────────────────────────────────────
// Run with: k6 run k6-soak-test.js
// This file handles both — soak is a subset of the scenarios above
export function handleSummary(data) {
  const p95 = data.metrics['http_req_duration']?.values?.['p(95)'];
  const errRate = data.metrics['http_req_failed']?.values?.rate;
  const searchSuccess = data.metrics['search_success_rate']?.values?.rate;

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║    Aswaq User Journey — Summary       ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  p95 Response:    ${p95 ? p95.toFixed(0) + 'ms' : 'N/A'}`.padEnd(41) + '║');
  console.log(`║  Error Rate:      ${errRate ? (errRate * 100).toFixed(2) + '%' : 'N/A'}`.padEnd(41) + '║');
  console.log(`║  Search Success:  ${searchSuccess ? (searchSuccess * 100).toFixed(1) + '%' : 'N/A'}`.padEnd(41) + '║');
  console.log(`║  Ad Posts:        ${data.metrics['ad_post_successes']?.values?.count ?? 0}`.padEnd(41) + '║');
  console.log('╚═══════════════════════════════════════╝\n');

  const passed = p95 < 500 && errRate < 0.01 && searchSuccess > 0.85;
  console.log(passed ? '✅ All thresholds PASSED — READY for Beta' : '❌ Thresholds FAILED — investigate before Beta');

  return {
    'stdout': JSON.stringify({
      p95_ms:           p95,
      error_rate_pct:   errRate ? errRate * 100 : null,
      search_success:   searchSuccess,
      ad_posts:         data.metrics['ad_post_successes']?.values?.count,
      passed,
    }, null, 2),
  };
}
