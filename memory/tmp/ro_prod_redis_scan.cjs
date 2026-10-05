// READ-ONLY scan of the production Redis (db 0) — tallies checkout keys by currency/status. No writes.
const fs = require("fs");
const { createClient } = require("/app/backend/node_modules/redis");
const env = Object.fromEntries(fs.readFileSync("/app/backend/.env", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const url = env.REDIS_PUBLIC_URL.replace(/\/1$/, "/0");
(async () => {
  const c = createClient({ url });
  await c.connect();
  const tally = {}, byCur = {}, samples = [];
  let n = 0, total = 0;
  const prefixes = {};
  for await (const key of c.scanIterator({ MATCH: "*", COUNT: 1000 })) {
    total++;
    const p = key.split(/[-:]/)[0];
    prefixes[p] = (prefixes[p] || 0) + 1;
    if (!/^crypto-/.test(key)) continue;
    n++;
    const t = await c.type(key);
    let v = null;
    try { v = t === "hash" ? await c.hGetAll(key) : t === "string" ? JSON.parse(await c.get(key)) : null; } catch { /* skip */ }
    if (!v) continue;
    const cur = v.currency || "?", st = v.status || "?";
    const k = `${cur} | ${st} | txId=${v.txId ? "y" : "n"} | pool=${v.is_merchant_pool || "?"}`;
    tally[k] = (tally[k] || 0) + 1;
    byCur[cur] = (byCur[cur] || 0) + 1;
    if ((cur === "LTC" || cur === "DOGE") && samples.length < 12) {
      const ttl = await c.ttl(key);
      samples.push({ cur, st, txId: !!v.txId, ttl, exp: v.crypto_invoice_expires_at, lastAttempt: v.lastAttempt, incomplete: v.incomplete });
    }
  }
  console.log("total keys", total, "| crypto-* keys", n);
  console.log("top prefixes:", Object.entries(prefixes).sort((a, b) => b[1] - a[1]).slice(0, 15));
  console.log("by currency:", Object.entries(byCur).sort((a, b) => b[1] - a[1]));
  console.log("by cur|status|txId|pool:");
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log("  ", String(v).padStart(5), k);
  console.log("LTC/DOGE samples:", samples);
  await c.quit();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
