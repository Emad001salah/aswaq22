import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users for 1 min
    { duration: '10s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = __ENV.E2E_BASE_URL || 'http://app:3000';

export default function () {
  // 1. Browse Homepage
  const resHome = http.get(`${BASE_URL}/`);
  check(resHome, {
    'home status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Fetch Listings
  const resAds = http.get(`${BASE_URL}/api/v1/ads`);
  check(resAds, {
    'ads status is 200': (r) => r.status === 200,
    'ads count is valid': (r) => r.json() && Array.isArray(r.json().ads),
  });
  sleep(1.5);

  // 3. Perform Fuzzy Search
  const resSearch = http.get(`${BASE_URL}/api/v1/ads/search?q=car`);
  check(resSearch, {
    'search status is 200': (r) => r.status === 200,
  });
  sleep(2);

  // 4. Health check
  const resHealth = http.get(`${BASE_URL}/api/v1/health`);
  check(resHealth, {
    'health status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });
  sleep(5);
}
