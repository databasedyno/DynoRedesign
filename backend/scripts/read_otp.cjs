// Dev/QA helper: read the current OTP for an email from the app's Redis (db /1).
// Usage: node backend/scripts/read_otp.cjs <email>
// Outbound email is disabled in preview, so the OTP is only in Redis.
const fs = require("fs");
const path = require("path");
const { createClient } = require("redis");

function readRedisUrl() {
  if (process.env.REDIS_PUBLIC_URL) return process.env.REDIS_PUBLIC_URL.trim();
  const envPath = path.join(__dirname, "..", "..", ".env");
  const txt = fs.readFileSync(envPath, "utf8");
  const line = txt.split("\n").find((l) => l.startsWith("REDIS_PUBLIC_URL="));
  return line ? line.slice("REDIS_PUBLIC_URL=".length).trim() : "";
}

(async () => {
  const base = readRedisUrl();
  if (!base) { console.error("REDIS_PUBLIC_URL not found"); process.exit(1); }
  const url = base.replace(/\/?$/, "") + "/1";
  const c = createClient({ url });
  c.on("error", () => {});
  await c.connect();
  const email = process.argv[2];
  const v = await c.get(`otp:${email}:json`);
  process.stdout.write(v ? JSON.parse(v).otp : "");
  await c.quit();
})();
