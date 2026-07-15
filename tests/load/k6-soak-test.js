/**
 * k6-soak-test.js — Soak / Longevity Test
 *
 * Purpose:
 *   Runs a constant medium load for an extended period to detect
 *   memory leaks, resource exhaustion, or database connection pool leaks.
 *
 * Target:
 *   - Continuous 40 VUs for 30 minutes
 */

import { browserJourney, posterJourney, powerBuyerJourney } from './k6-user-journey.js';

export const options = {
  scenarios: {
    soak_browser: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30m',
      exec: 'browserJourney',
    },
    soak_poster: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
      exec: 'posterJourney',
    },
    soak_power: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
      exec: 'powerBuyerJourney',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'], // Latency must stay low throughout the run
    'http_req_failed':   ['rate<0.001'], // Ultra-reliable under sustained load (99.9% success)
  },
};

// Re-export the executors from user journey file
export { browserJourney, posterJourney, powerBuyerJourney };
export { handleSummary } from './k6-user-journey.js';
