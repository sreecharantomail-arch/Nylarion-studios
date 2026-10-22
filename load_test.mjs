import http from 'node:http';
import { performance } from 'node:perf_hooks';

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 1000
});

async function runScenario(name, url, method, body, concurrency, totalRequests) {
  console.log(`\n======================================================`);
  console.log(`[TEST] ${name}`);
  console.log(`Target: ${url} | Concurrency: ${concurrency} | Total Requests: ${totalRequests}`);
  console.log(`======================================================`);

  const latencies = [];
  let completed = 0;
  let successful = 0;
  let failed = 0;
  let inFlight = 0;
  let requestIndex = 0;

  const startTime = performance.now();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) return;

      while (inFlight < concurrency && requestIndex < totalRequests) {
        requestIndex++;
        inFlight++;
        const t0 = performance.now();

        const req = http.request(url, {
          method,
          agent,
          headers: body
            ? { 'Content-Type': 'application/json', 'x-load-test': 'nylarion-bench-key' }
            : { 'x-load-test': 'nylarion-bench-key' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            const dt = performance.now() - t0;
            latencies.push(dt);
            inFlight--;
            completed++;

            if (res.statusCode >= 200 && res.statusCode < 400) {
              successful++;
            } else {
              failed++;
            }

            if (completed % Math.max(1, Math.floor(totalRequests / 5)) === 0 || completed === totalRequests) {
              const currentRPS = Math.round((completed / (performance.now() - startTime)) * 1000);
              console.log(`  Progress: ${completed}/${totalRequests} (${Math.round(completed/totalRequests*100)}%) — Current RPS: ${currentRPS}`);
            }

            if (completed >= totalRequests) {
              finish();
            } else {
              launchNext();
            }
          });
        });

        req.on('error', (err) => {
          const dt = performance.now() - t0;
          latencies.push(dt);
          inFlight--;
          completed++;
          failed++;

          if (completed >= totalRequests) {
            finish();
          } else {
            launchNext();
          }
        });

        if (body) req.write(body);
        req.end();
      }
    }

    function finish() {
      const totalTimeMs = performance.now() - startTime;
      const totalSec = totalTimeMs / 1000;
      const rps = Math.round(completed / totalSec);

      latencies.sort((a, b) => a - b);
      const min = latencies[0].toFixed(1);
      const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(1);
      const p90 = latencies[Math.floor(latencies.length * 0.90)].toFixed(1);
      const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(1);
      const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(1);
      const max = latencies[latencies.length - 1].toFixed(1);

      console.log(`\n--- RESULTS: ${name} ---`);
      console.log(`Duration:        ${totalSec.toFixed(2)} seconds`);
      console.log(`Completed:       ${completed} requests`);
      console.log(`Successful:      ${successful} (2xx/3xx)`);
      console.log(`Failed:          ${failed}`);
      console.log(`Throughput:      ${rps} requests/sec`);
      console.log(`Latency min:     ${min} ms`);
      console.log(`Latency p50:     ${p50} ms (Median)`);
      console.log(`Latency p90:     ${p90} ms`);
      console.log(`Latency p95:     ${p95} ms`);
      console.log(`Latency p99:     ${p99} ms`);
      console.log(`Latency max:     ${max} ms`);

      resolve({
        name,
        concurrency,
        totalRequests,
        durationSec: totalSec,
        rps,
        p50,
        p95,
        p99,
        failed,
        successRate: ((successful / completed) * 100).toFixed(2) + '%'
      });
    }

    launchNext();
  });
}

async function main() {
  console.log('=== NYLARION STUDIOS LOAD TEST SUITE ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const results = [];

  // Warm-up query
  await fetch('http://localhost:3000/api/health').then(r => r.json());

  // Test 1: Static WebP Asset Delivery (CDN origin baseline)
  results.push(await runScenario(
    'Static WebP Character Asset (/assets/images/legendary-horse-cutout.webp)',
    'http://localhost:3000/assets/images/legendary-horse-cutout.webp',
    'GET',
    null,
    50,
    1000
  ));

  // Test 2: System Health Endpoint (/api/health)
  results.push(await runScenario(
    'System Health Endpoint (/api/health) - Medium Load',
    'http://localhost:3000/api/health',
    'GET',
    null,
    100,
    3000
  ));

  // Test 3: High-Concurrency Health Stress (/api/health)
  results.push(await runScenario(
    'System Health Endpoint (/api/health) - High Concurrency Stress',
    'http://localhost:3000/api/health',
    'GET',
    null,
    250,
    5000
  ));

  // Test 4: AI Chatbot API - Cached Common Queries
  results.push(await runScenario(
    'AI Chatbot Endpoint (/api/chat) - Cached Studio Queries',
    'http://localhost:3000/api/chat',
    'POST',
    JSON.stringify({ message: 'What games is Nylarion Studios making?' }),
    50,
    1000
  ));

  console.log('\n\n======================================================');
  console.log('                 FINAL TEST SUMMARY');
  console.log('======================================================');
  console.table(results);
}

main();
