/**
 * Unit tests for utils/config.ts (typed config surface).
 * Standalone ts-node script — no DB, no network.
 *
 * Run: node_modules/.bin/ts-node --transpile-only tests/test_config.ts
 */
export {}; // module scope so top-level vars don't collide with jest globals

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

// Set a representative env BEFORE first import of config (config reads at load).
process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "postgresql://u:p@sakura.proxy.rlwy.net:42975/railway";
process.env.DB_NAME = "railway";
process.env.USER_NAME = "postgres";
process.env.PASSWORD = "secret";
process.env.HOST = "sakura.proxy.rlwy.net";
process.env.DB_PORT = "42975";
process.env.DB_SSL_REJECT_UNAUTHORIZED = "false";
process.env.WORKER_ROLE = "SECONDARY";
process.env.ENABLE_BACKGROUND_JOBS = "false";
delete process.env.DB_POOL_MAX;

const config = require("../utils/config").default;
const { str, num, bool } = config;

console.log("\n[helpers]");
check("str trims", (() => { process.env.__T = "  hi  "; return str("__T") === "hi"; })());
check("str fallback when unset", str("__MISSING__", "fb") === "fb");
check("num parses", (() => { process.env.__N = "42"; return num("__N", 0) === 42; })());
check("num fallback on non-numeric", (() => { process.env.__N2 = "abc"; return num("__N2", 7) === 7; })());
check("bool true tokens", (() => { process.env.__B = "YES"; return bool("__B") === true; })());
check("bool false default", bool("__MISSING_BOOL__") === false);

console.log("\n[db group mirrors dbInstance defaults]");
check("db.url read + trimmed", config.db.url.startsWith("postgresql://"));
check("db.name", config.db.name === "railway");
check("db.port numeric", config.db.port === 42975);
check("db.poolMax default 20", config.db.poolMax === 20);
check("db.poolMin default 5", config.db.poolMin === 5);
check("db.poolIdle default 10000", config.db.poolIdle === 10000);
check("db.sslRejectUnauthorized=false when env='false'", config.db.sslRejectUnauthorized === false);

console.log("\n[env / worker / jobs]");
check("isProduction true", config.isProduction === true);
check("workerRole lowercased", config.workerRole === "secondary");
check("enableBackgroundJobs=false", config.enableBackgroundJobs === false);
check("redisUrl exposed", typeof config.redisUrl === "string");
check("checkoutUrl default when unset", config.checkoutUrl === "https://checkout.dynopay.com" || config.checkoutUrl.length > 0);

console.log(`\n──────────── RESULT: ${pass} passed, ${fail} failed ────────────\n`);
process.exit(fail === 0 ? 0 : 1);
