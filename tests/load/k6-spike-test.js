/**
 * k6-spike-test.js — Spike Load Test
 *
 * Purpose:
 *   Tests the platform's ability to survive sudden bursts of traffic
 *   (e.g., promotional alerts or push notifications).
 *
 * Targets:
 *   - Normal load (20 VUs) -> Instant spike (150 VUs) -> Recovery -> Cool down
 */

import { browserJourney } from './k6-user-journey.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Normal baseline
    { duration: '20s', target: 150 }, // Sudden spike to 150 users
    { duration: '1m',  target: 150 }, // Maintain peak
    { duration: '20s', target: 20 },  // Scale back down
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // Allow higher latency during sudden spike
    'http_req_failed':   ['rate<0.02'],  // Under 2% failure rate allowed
  },
};

export default browserJourney;
export { handleSummary } from './k6-user-journey.js';
