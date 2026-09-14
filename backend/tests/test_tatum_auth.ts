/**
 * Unit tests for the shared Tatum auth/config module (utils/tatumAuth.ts).
 * Standalone ts-node script — no DB, no network.
 *
 * Run: node_modules/.bin/ts-node --transpile-only tests/test_tatum_auth.ts
 */
export {}; // treat as a module so top-level vars don't collide with jest globals
const orig = {
  TATUM_TESTNET: process.env.TATUM_TESTNET,
  TATUM_KEY: process.env.TATUM_KEY,
  TATUM_SECRET_KEY: process.env.TATUM_SECRET_KEY,
  TATUM_TESTNET_KEY: process.env.TATUM_TESTNET_KEY,
  TATUM_TESTNET_TYPE: process.env.TATUM_TESTNET_TYPE,
};

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

function reload() {
  delete require.cache[require.resolve("../utils/tatumAuth")];
  return require("../utils/tatumAuth");
}

// ── mainnet ──────────────────────────────────────────────────────────
process.env.TATUM_TESTNET = "false";
process.env.TATUM_KEY = "mainnet-key";
process.env.TATUM_SECRET_KEY = "secret-key";
process.env.TATUM_TESTNET_KEY = "testnet-key";
{
  const a = reload();
  console.log("\n[mainnet]");
  check("getTatumApiKey returns TATUM_KEY", a.getTatumApiKey() === "mainnet-key");
  check("headers has x-api-key = TATUM_KEY", a.getTatumHeaders()["x-api-key"] === "mainnet-key");
  check("headers has NO x-testnet-type in mainnet", a.getTatumHeaders()["x-testnet-type"] === undefined);
  check("headers merges extra", a.getTatumHeaders({ Accept: "application/json" }).Accept === "application/json");
  check("V3 url constant", a.TATUM_V3_URL === "https://api.tatum.io/v3");
  check("V4 url constant", a.TATUM_V4_URL === "https://api.tatum.io/v4");
  check("web3 url embeds key", a.getTatumWeb3Url("polygon") === "https://api.tatum.io/v3/polygon/web3/mainnet-key");
}

// ── TATUM_KEY unset → falls back to TATUM_SECRET_KEY (matches offenders) ──
process.env.TATUM_KEY = "";
{
  const a = reload();
  console.log("\n[fallback to TATUM_SECRET_KEY]");
  check("getTatumApiKey returns TATUM_SECRET_KEY", a.getTatumApiKey() === "secret-key");
}

// ── testnet ──────────────────────────────────────────────────────────
process.env.TATUM_TESTNET = "true";
process.env.TATUM_KEY = "mainnet-key";
process.env.TATUM_TESTNET_TYPE = "bitcoin-testnet";
{
  const a = reload();
  console.log("\n[testnet]");
  check("getTatumApiKey returns TESTNET key", a.getTatumApiKey() === "testnet-key");
  check("headers x-api-key = testnet key", a.getTatumHeaders()["x-api-key"] === "testnet-key");
  check("headers include x-testnet-type", a.getTatumHeaders()["x-testnet-type"] === "bitcoin-testnet");
}

// restore env
Object.entries(orig).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });

console.log(`\n──────────── RESULT: ${pass} passed, ${fail} failed ────────────\n`);
process.exit(fail === 0 ? 0 : 1);
