// Dev/QA helper: list Redis keys (db /1) matching a pattern with their values. Usage: node backend/scripts/redis_keys.cjs "<pattern>"
const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");

function readRedisUrl() {
  if (process.env.REDIS_PUBLIC_URL) return process.env.REDIS_PUBLIC_URL.trim();
  const txt = fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8");
  const line = txt.split("\n").find((l) => l.startsWith("REDIS_PUBLIC_URL="));
  return line ? line.slice("REDIS_PUBLIC_URL=".length).trim() : "";
}

(async () => {
  const url = readRedisUrl().replace(/\/?$/, "") + (process.env.REDIS_DB ? `/${process.env.REDIS_DB}` : "/1");
  const c = createClient({ url });
  c.on("error", () => {});
  await c.connect();
  const keys = await c.keys(process.argv[2] || "*otp*");
  for (const k of keys.slice(0, 50)) {
    const t = await c.type(k);
    const v = t === "string" ? await c.get(k) : `<${t}>`;
    console.log(k, "=>", String(v).slice(0, 200));
  }
  await c.quit();
})();
