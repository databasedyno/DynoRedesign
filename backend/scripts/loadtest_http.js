/**
 * scripts/loadtest_http.js — RAW CAPACITY driver (dependency-free).
 *
 * Maintains a fixed number of concurrent in-flight requests ("virtual users")
 * against the STAGING backend (http://localhost:3400 by default), cycling
 * through checkout-path endpoints by weight, for a sustained duration. Reports
 * throughput, latency percentiles, status histogram and error counts — overall
 * and per endpoint.
 *
 * SAFE: only hits read/compute endpoints (no funds move). Point it at the
 * staging instance (port 3400), NOT the prod-connected preview backend.
 *
 * Usage:
 *   node scripts/loadtest_http.js --base http://localhost:3400 \
 *        --concurrency 1000 --duration 180
 */
const http = require("http");
const { URL } = require("url");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", "http://localhost:3400");
const CONCURRENCY = parseInt(arg("concurrency", "1000"), 10);
const DURATION = parseInt(arg("duration", "180"), 10); // seconds
const WARMUP = parseInt(arg("warmup", "5"), 10);

// Weighted checkout-path endpoints (all read/compute — safe, no fund movement).
const ENDPOINTS = [
  { w: 3, method: "GET",  path: "/api/" },
  { w: 3, method: "GET",  path: "/api/public/tickers" },
  { w: 3, method: "POST", path: "/api/pay/calculateFees", body: { amount: 100, cryptocurrency: "BTC" } },
  { w: 1, method: "GET",  path: "/api/pay/network-fees" },
];
const WEIGHTED = [];
ENDPOINTS.forEach((e, idx) => { for (let i = 0; i < e.w; i++) WEIGHTED.push(idx); });

const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY + 50, maxFreeSockets: CONCURRENCY });

const stats = {
  total: 0, errors: 0, statuses: {},
  lat: [], // all latencies (ms)
  perEndpoint: ENDPOINTS.map(() => ({ n: 0, lat: [], errors: 0, statuses: {} })),
};
let counting = false; // becomes true after warmup

function doRequest(epIdx) {
  return new Promise((resolve) => {
    const ep = ENDPOINTS[epIdx];
    const u = new URL(BASE + ep.path);
    const payload = ep.body ? JSON.stringify(ep.body) : null;
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: ep.method, agent,
      headers: { "Content-Type": "application/json", "Connection": "keep-alive" },
    };
    if (payload) opts.headers["Content-Length"] = Buffer.byteLength(payload);
    const start = process.hrtime.bigint();
    const req = http.request(opts, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        if (counting) {
          stats.total++;
          stats.lat.push(ms);
          stats.statuses[res.statusCode] = (stats.statuses[res.statusCode] || 0) + 1;
          const pe = stats.perEndpoint[epIdx];
          pe.n++; pe.lat.push(ms);
          pe.statuses[res.statusCode] = (pe.statuses[res.statusCode] || 0) + 1;
        }
        resolve();
      });
    });
    req.on("error", () => {
      if (counting) { stats.total++; stats.errors++; stats.perEndpoint[epIdx].errors++; }
      resolve();
    });
    req.setTimeout(30000, () => { req.destroy(); });
    if (payload) req.write(payload);
    req.end();
  });
}

let running = true;
async function worker() {
  while (running) {
    const epIdx = WEIGHTED[(Math.random() * WEIGHTED.length) | 0];
    await doRequest(epIdx);
  }
}

const pctl = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const amax = (arr) => arr.reduce((m, v) => (v > m ? v : m), 0);

(async () => {
  console.log(`\n================ HTTP RAW-CAPACITY LOAD TEST ================`);
  console.log(`base=${BASE}  concurrency=${CONCURRENCY}  duration=${DURATION}s  warmup=${WARMUP}s`);
  console.log(`endpoints: ${ENDPOINTS.map(e => `${e.method} ${e.path} (w${e.w})`).join(", ")}`);

  const workers = Array.from({ length: CONCURRENCY }).map(() => worker());

  // Warmup (not counted)
  await new Promise(r => setTimeout(r, WARMUP * 1000));
  counting = true;
  const measureStart = Date.now();
  console.log(`\n--- measuring for ${DURATION}s ---`);

  // periodic progress
  const iv = setInterval(() => {
    const el = (Date.now() - measureStart) / 1000;
    console.log(`   t=${el.toFixed(0)}s  reqs=${stats.total}  rps=${(stats.total/el).toFixed(0)}  errors=${stats.errors}  p95=${pctl(stats.lat,95).toFixed(0)}ms`);
  }, 15000);

  await new Promise(r => setTimeout(r, DURATION * 1000));
  running = false;
  clearInterval(iv);
  const elapsed = (Date.now() - measureStart) / 1000;
  await Promise.allSettled(workers);

  console.log(`\n================ RESULT ================`);
  console.log(`duration:      ${elapsed.toFixed(1)}s`);
  console.log(`total reqs:    ${stats.total}`);
  console.log(`throughput:    ${(stats.total / elapsed).toFixed(0)} req/s`);
  console.log(`errors:        ${stats.errors} (${((stats.errors/Math.max(1,stats.total))*100).toFixed(2)}%)`);
  console.log(`status codes:  ${JSON.stringify(stats.statuses)}`);
  console.log(`latency ms:    p50=${pctl(stats.lat,50).toFixed(0)}  p90=${pctl(stats.lat,90).toFixed(0)}  p95=${pctl(stats.lat,95).toFixed(0)}  p99=${pctl(stats.lat,99).toFixed(0)}  max=${amax(stats.lat).toFixed(0)}`);
  console.log(`\nper-endpoint:`);
  ENDPOINTS.forEach((e, i) => {
    const pe = stats.perEndpoint[i];
    console.log(`   ${e.method} ${e.path}`);
    console.log(`      reqs=${pe.n}  rps=${(pe.n/elapsed).toFixed(0)}  errors=${pe.errors}  statuses=${JSON.stringify(pe.statuses)}`);
    console.log(`      latency ms: p50=${pctl(pe.lat,50).toFixed(0)}  p95=${pctl(pe.lat,95).toFixed(0)}  p99=${pctl(pe.lat,99).toFixed(0)}  max=${amax(pe.lat).toFixed(0)}`);
  });

  const errPct = (stats.errors / Math.max(1, stats.total)) * 100;
  const non2xx = Object.entries(stats.statuses).filter(([c]) => Number(c) >= 500).reduce((a, [,v]) => a + v, 0);
  console.log(`\n${errPct < 1 && non2xx === 0 ? "✅" : "⚠️"} error rate ${errPct.toFixed(2)}%, 5xx count ${non2xx}`);
  process.exit(0);
})();
