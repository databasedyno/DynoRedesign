// READ-ONLY: inspect prod Redis (db 0) leader/lock/durable keys + key TTL stats. No writes.
const fs = require("fs");
const { createClient } = require("/app/backend/node_modules/redis");
const env = Object.fromEntries(fs.readFileSync("/app/backend/.env", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
(async () => {
  const c = createClient({ url: env.REDIS_PUBLIC_URL.replace(/\/1$/, "/0") });
  await c.connect();
  const show = async (pattern) => {
    for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 1000 })) {
      const t = await c.type(key); const ttl = await c.ttl(key);
      let v = t === "string" ? await c.get(key) : t === "hash" ? JSON.stringify(await c.hGetAll(key)) : `<${t}>`;
      v = String(v).replace(/[A-Za-z0-9+/]{24,}/g, "<tok>").slice(0, 160);
      console.log(`${key.padEnd(55)} ttl=${String(ttl).padStart(6)} ${v}`);
    }
  };
  for (const p of ["*leader*", "lock:*", "cron:*", "dynopay:durable:rpc*", "dynopay:durable:*instance*", "tatum:balance:LTC:*", "tatum:balance:DOGE:*", "*recently*zero*LTC*", "orphan*", "fee_wallet_alert_state", "pool*zero*"]) {
    console.log(`\n## ${p}`); await show(p);
  }
  // count tatum:balance cache keys by currency
  const bal = {};
  for await (const key of c.scanIterator({ MATCH: "tatum:balance:*", COUNT: 1000 })) { const cur = key.split(":")[2]; bal[cur] = (bal[cur] || 0) + 1; }
  console.log("\n## tatum:balance cache keys by currency", bal);
  await c.quit();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
