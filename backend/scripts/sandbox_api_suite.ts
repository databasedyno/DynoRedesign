/**
 * Sandbox API suite for The Dev Store (company_id=1).
 *
 * Exercises the merchant API with the company's SANDBOX (dpk_test_) secret key.
 * SAFE: the only write is a Redis /1 checkout session (deleted at the end) — no
 * prod DB rows, no on-chain funds. The plaintext key is NEVER logged.
 *
 * Run: cd /app/backend && npx ts-node scripts/sandbox_api_suite.ts
 */
import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { apiModel } from "../models";
import { decrypt } from "../helper/encryption";
import { raw as envRaw } from "../utils/config";
import { deleteRedisItem, redis, connectRedis } from "../utils/redisInstance";

const BASE = process.env.SANDBOX_TEST_BASE || "http://localhost:8001";
const RETURN = "https://example.com/return";

(async () => {
  let failures = 0;
  const check = (name: string, pass: boolean, detail: string) => {
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}: ${detail}`);
    if (!pass) failures += 1;
  };

  const row = await apiModel.findOne({
    where: { company_id: 1, environment: "development", status: "active" },
  });
  if (!row) {
    console.error("No active sandbox key for company_id=1");
    process.exit(1);
  }
  const encKey = String(row.dataValues.apiKey); // the actual secret merchants send (encrypted-at-rest blob)
  const rawKey = decrypt(encKey, envRaw("API_SECRET") || "");
  check(
    "sandbox key decrypts to dpk_test_ family",
    rawKey.startsWith("dpk_test_"),
    `prefix=${rawKey.slice(0, 9)}… env=${row.dataValues.environment} restrictions=${row.dataValues.test_mode_restrictions}`
  );

  const H: Record<string, string> = { "Content-Type": "application/json", "x-api-key": encKey };
  await connectRedis();
  const sessions: string[] = [];
  const grab = (url: string) => {
    const m = String(url).match(/[?&]d=([a-f0-9]+)/);
    if (m) sessions.push("customer-" + m[1]);
  };

  // 1) $5 hosted checkout — should succeed
  {
    const r = await fetch(`${BASE}/api/user/createPayment`, {
      method: "POST", headers: H,
      body: JSON.stringify({ amount: 5, redirect_uri: RETURN }),
    });
    const j: any = await r.json().catch(() => ({}));
    const ok = r.status === 200 && !!j?.data?.redirect_url;
    check("$5 sandbox checkout (createPayment) succeeds", ok, `status=${r.status} msg="${j?.message}" url=${j?.data?.redirect_url ? "present" : "MISSING"}`);
    grab(j?.data?.redirect_url || "");
  }

  // 2) $150 over sandbox max_amount ($100) — should be rejected in auth middleware (no DB write)
  {
    const r = await fetch(`${BASE}/api/user/createPayment`, {
      method: "POST", headers: H,
      body: JSON.stringify({ amount: 150, redirect_uri: RETURN }),
    });
    const j: any = await r.json().catch(() => ({}));
    const ok = r.status === 400 && (j?.code === "sandbox_restriction" || /max_amount/i.test(j?.message || ""));
    check("$150 over sandbox max_amount is rejected", ok, `status=${r.status} code=${j?.code} msg="${j?.message}"`);
  }

  // 3) disallowed currency (DOGE not in sandbox allow-list) — rejected in middleware
  {
    const r = await fetch(`${BASE}/api/user/createPayment`, {
      method: "POST", headers: H,
      body: JSON.stringify({ amount: 5, redirect_uri: RETURN, accepted_currencies: ["DOGE"] }),
    });
    const j: any = await r.json().catch(() => ({}));
    const ok = r.status === 400 && (j?.code === "sandbox_restriction" || /allowed list|disallowed/i.test(j?.message || ""));
    check("disallowed sandbox currency (DOGE) is rejected", ok, `status=${r.status} code=${j?.code} msg="${j?.message}"`);
  }

  // 4) allowed currencies (BTC/ETH) pass the sandbox currency gate
  {
    const r = await fetch(`${BASE}/api/user/createPayment`, {
      method: "POST", headers: H,
      body: JSON.stringify({ amount: 5, redirect_uri: RETURN, accepted_currencies: ["BTC", "ETH"] }),
    });
    const j: any = await r.json().catch(() => ({}));
    const ok = r.status === 200 && !!j?.data?.redirect_url;
    check("allowed sandbox currencies (BTC/ETH) pass", ok, `status=${r.status} msg="${j?.message}"`);
    grab(j?.data?.redirect_url || "");
  }

  // 5) getSupportedCurrency — read-only, should list configured currencies
  {
    const r = await fetch(`${BASE}/api/user/getSupportedCurrency`, { headers: H });
    const j: any = await r.json().catch(() => ({}));
    const ok = r.status === 200 && Array.isArray(j?.data?.currencies);
    check("getSupportedCurrency returns configured currencies", ok, `status=${r.status} n=${j?.data?.currencies?.length ?? "?"}`);
  }

  // 6) missing x-api-key — rejected 401
  {
    const r = await fetch(`${BASE}/api/user/getSupportedCurrency`);
    check("missing x-api-key is rejected 401", r.status === 401, `status=${r.status}`);
  }

  // CLEANUP: delete the Redis /1 checkout sessions we created
  let cleaned = 0;
  for (const k of sessions) {
    try { await deleteRedisItem(k); cleaned += 1; } catch { /* ignore */ }
  }
  check("cleanup removed test Redis /1 sessions", cleaned === sessions.length, `deleted ${cleaned}/${sessions.length}`);

  console.log(`\n${failures === 0 ? "ALL SANDBOX CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  await sequelize.close();
  try { await redis.quit(); } catch { /* ignore */ }
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("SANDBOX SUITE ERROR:", e?.message || e);
  process.exit(1);
});
