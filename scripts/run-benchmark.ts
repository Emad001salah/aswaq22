/**
 * scripts/run-benchmark.ts
 *
 * Empirical Performance & Concurrency Benchmark Runner for Aswaq 22
 *
 * Executes real in-process HTTP load tests using Autocannon to measure:
 *  - Requests per Second (RPS)
 *  - Latency (Average, P50, P95, P99)
 *  - Error Rates & Throughput
 *  - Heap Memory Consumption under load
 */

import { App } from '../server/app.ts';
import autocannon from 'autocannon';
import { logger } from '../server/lib/logger.ts';

process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.JWT_SECRET = 'benchmark_jwt_secret_key_32_characters_minimum_len_12345';
process.env.JWT_REFRESH_SECRET = 'benchmark_refresh_secret_key_32_characters_minimum_len_67890';
process.env.PEPPER_SECRET = 'benchmark_pepper_secret_key_32_characters_minimum_len_abcde';

async function runBenchmark() {
  console.log('\n================================================================');
  console.log('🚀 Starting Aswaq 22 Empirical Load & Concurrency Benchmark...');
  console.log('================================================================\n');

  // Boot server on isolated port 3099
  const appInstance = new App();
  await appInstance.start();

  const baseUrl = 'http://127.0.0.1:3099';

  const stages = [
    { title: 'Stage 1: Low Concurrency (50 Concurrent Connections)', connections: 50, duration: 10 },
    { title: 'Stage 2: Medium Concurrency (200 Concurrent Connections)', connections: 200, duration: 10 },
    { title: 'Stage 3: High Concurrency (500 Concurrent Connections)', connections: 500, duration: 10 },
  ];

  const results: any[] = [];

  for (const stage of stages) {
    console.log(`\n⏳ Running ${stage.title}...`);

    const result = await autocannon({
      url: `${baseUrl}/api/v1/ads?limit=20`,
      connections: stage.connections,
      duration: stage.duration,
      headers: {
        'Accept': 'application/json',
      },
    });

    const mem = process.memoryUsage();
    const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const rssMb = (mem.rss / 1024 / 1024).toFixed(2);

    console.log(`✅ ${stage.title} Completed:`);
    console.log(`   - Requests/Sec (RPS): ${result.requests.average}`);
    console.log(`   - Avg Latency:        ${result.latency.average} ms`);
    console.log(`   - P95 Latency:        ${(result.latency as any).p95 || result.latency.p99} ms`);
    console.log(`   - P99 Latency:        ${result.latency.p99} ms`);
    console.log(`   - Total Requests:     ${result.requests.total}`);
    console.log(`   - Error Count:        ${result.errors}`);
    console.log(`   - 2xx Responses:      ${result['2xx']}`);
    console.log(`   - Non-2xx Responses:  ${result.non2xx}`);
    console.log(`   - Memory Usage:       Heap ${heapUsedMb} MB | RSS ${rssMb} MB\n`);

    results.push({
      stage: stage.title,
      connections: stage.connections,
      rps: result.requests.average,
      avgLatency: result.latency.average,
      p95Latency: (result.latency as any).p95 || result.latency.p99,
      p99Latency: result.latency.p99,
      totalRequests: result.requests.total,
      errors: result.errors,
      non2xx: result.non2xx,
      heapUsedMb,
      rssMb,
    });

  }

  console.log('\n================================================================');
  console.log('📊 EMPIRICAL BENCHMARK RESULTS SUMMARY');
  console.log('================================================================\n');

  console.table(
    results.map((r) => ({
      'Connections (VUs)': r.connections,
      'Req/Sec (RPS)': r.rps,
      'Avg Latency (ms)': r.avgLatency,
      'P95 Latency (ms)': r.p95Latency,
      'P99 Latency (ms)': r.p99Latency,
      'Total Reqs': r.totalRequests,
      'Errors': r.errors,
      'Heap (MB)': r.heapUsedMb,
    }))
  );

  console.log('\n shutting down benchmark server...');
  await appInstance.close();
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Fatal Benchmark Error:', err);
  process.exit(1);
});
