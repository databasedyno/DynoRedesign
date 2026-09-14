// QA helper: read any key's :json value from the app's Redis (uses REDIS_PUBLIC_URL as-is).
// Usage: node backend/scripts/read_redis_key.cjs "otp:foo@bar.com"  (":json" auto-appended)
const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");
function readRedisUrl() {
  if (process.env.REDIS_PUBLIC_URL) return process.env.REDIS_PUBLIC_URL.trim();
  const txt = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  const line = txt.split("\n").find((l) => l.startsWith("REDIS_PUBLIC_URL="));
  return line ? line.slice("REDIS_PUBLIC_URL=".length).trim() : "";
}
(async () => {
  const url = readRedisUrl();
  if (!url) { console.error("REDIS_PUBLIC_URL not found"); process.exit(1); }
  const c = createClient({ url });
  c.on("error", () => {});
  await c.connect();
  let key = process.argv[2] || "";
  if (!key.endsWith(":json")) key += ":json";
  const v = await c.get(key);
  process.stdout.write(v || "");
  await c.quit();
})();
