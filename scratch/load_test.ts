import autocannon from 'autocannon';

const targetUrl = process.env.TARGET_URL || 'http://localhost:3000';

async function runScenario(connections: number, duration: number, title: string) {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Scenario: ${title}`);
  console.log(`📊 Target: ${targetUrl}`);
  console.log(`👥 Concurrent Connections: ${connections}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`======================================================`);

  const instance = autocannon({
    url: targetUrl,
    connections: connections,
    duration: duration,
    workers: 4, // use cluster workers to utilize CPU cores for generating traffic
    headers: {
      'accept': 'application/json',
      'user-agent': 'Aswaq-LoadTest-Agent/1.0',
    },
    requests: [
      {
        method: 'GET',
        path: '/api/v1/health'
      },
      {
        method: 'GET',
        path: '/api/v1/ads?limit=10'
      },
      {
        method: 'GET',
        path: '/api/v1/polls?countryCode=YE'
      },
      {
        method: 'GET',
        path: '/api/v1/categories'
      }
    ]
  }, (err, result) => {
    if (err) {
      console.error(`❌ Scenario ${title} failed:`, err);
    }
  });

  autocannon.track(instance, { renderProgressBar: true });

  return new Promise<void>((resolve) => {
    instance.on('done', (result) => {
      console.log(`\n📊 Results for ${title}:`);
      console.log(`------------------------------------------------------`);
      console.log(`✔️  Total Requests:   ${result.requests.sent}`);
      console.log(`✔️  Avg RPS:           ${result.requests.average}`);
      console.log(`✔️  Max RPS:           ${result.requests.max}`);
      console.log(`✔️  Avg Latency:       ${result.latency.average} ms`);
      console.log(`✔️  P99 Latency:       ${result.latency.p99} ms`);
      console.log(`❌ Total Errors:      ${result.errors}`);
      console.log(`❌ 4xx/5xx Responses: ${result.non2xx}`);
      console.log(`======================================================\n`);
      resolve();
    });
  });
}

async function main() {
  console.log('🏁 Starting Aswaq Enterprise Load Testing Suite...');
  
  // Scenario 1: 1,000 connections
  await runScenario(1000, 10, '1,000 Concurrent Users');

  // Scenario 2: 5,000 connections
  await runScenario(5000, 10, '5,000 Concurrent Users');

  // Scenario 3: 10,000 connections
  await runScenario(10000, 10, '10,000 Concurrent Users');

  console.log('✅ Load Testing Suite completed successfully!');
}

main().catch(err => {
  console.error('Fatal load testing error:', err);
});
