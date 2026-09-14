// One-off production Redis hygiene (approved 2026-06 audit follow-up).
//   DELETE legacy `ratelimit:*:json` strings (old GET/SET limiter; new limiter uses ZSET keys without :json)
//   EXPIRE `pending-notif-*` dedup markers that have no TTL (30 days)
// Everything else (customer-*/crypto-* payment-link store, bull:*, price/fee caches, wallet_freeze_*) is untouched.
// Usage: node scripts/audit/redis_cleanup.cjs            (dry run)
//        node scripts/audit/redis_cleanup.cjs --apply    (execute)
const { createClient } = require("redis");
const url = require("dotenv").config({ path: "/app/backend/.env" }).parsed.REDIS_PUBLIC_URL;
const APPLY = process.argv.includes("--apply");
const PENDING_TTL = 30 * 24 * 60 * 60;

(async () => {
  const c = createClient({ url: url.replace(/\/\d+$/, "") + "/0", socket: { connectTimeout: 8000 } });
  await c.connect();
  // Remote Redis (~180ms RTT): collect keys first, then pipeline the per-key checks.
  const collect = async (match) => { const keys = []; for await (const k of c.scanIterator({ MATCH: match, COUNT: 1000 })) keys.push(k); return keys; };
  const rlKeys = (await collect("ratelimit:*")).filter((k) => k.endsWith(":json"));
  const pnKeys = await collect("pending-notif-*");
  const types = rlKeys.length ? await Promise.all(rlKeys.map((k) => c.type(k))) : [];
  const ttls = pnKeys.length ? await Promise.all(pnKeys.map((k) => c.ttl(k))) : [];
  const toDelete = rlKeys.filter((_, i) => types[i] === "string");
  const toExpire = pnKeys.filter((_, i) => ttls[i] === -1);
  console.log(`legacy ratelimit keys to delete: ${toDelete.length}`);
  console.log(`pending-notif keys to expire (30d): ${toExpire.length}`);
  if (!APPLY) { console.log("dry run — re-run with --apply"); await c.quit(); return; }
  let deleted = 0, expired = 0;
  for (let i = 0; i < toDelete.length; i += 200) deleted += await c.del(toDelete.slice(i, i + 200));
  for (let i = 0; i < toExpire.length; i += 200) {
    const res = await Promise.all(toExpire.slice(i, i + 200).map((k) => c.expire(k, PENDING_TTL)));
    expired += res.filter(Boolean).length;
  }
  const after = await c.dbSize();
  console.log(`deleted=${deleted} expired=${expired} dbsize_now=${after}`);
  await c.quit();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
