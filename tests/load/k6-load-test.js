import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Aswaq 22 — Production Load Benchmark via k6
 *
 * Simulates progressive traffic ramps:
 *   - Ramp 1: 50 VUs over 30s (Smoke Test)
 *   - Ramp 2: 200 VUs over 1m (Typical Peak)
 *   - Ramp 3: 500 VUs over 2m (Stress Load)
 *   - Ramp 4: Cool down to 0
 */
export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m',  target: 200 },
    { duration: '2m',  target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete within 300ms
    http_req_failed:   ['rate<0.01'], // < 1% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3002';

export default function () {
  // Scenario 1: Fetch Homepage Ads List
  const adsRes = http.get(`${BASE_URL}/api/v1/ads?limit=20`);
  check(adsRes, {
    'ads list status is 200': (r) => r.status === 200,
    'ads list response time < 250ms': (r) => r.timings.duration < 250,
  });

  sleep(1);

  // Scenario 2: Fetch Categories Metadata
  const catRes = http.get(`${BASE_URL}/api/v1/categories`);
  check(catRes, {
    'categories status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Scenario 3: Health Check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  sleep(2);
}
