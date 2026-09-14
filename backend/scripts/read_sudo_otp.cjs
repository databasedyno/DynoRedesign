// Dev/QA helper: recover the wallet-sudo OTP for a user from its HMAC in Redis (preview only; email is off).
// Usage: node backend/scripts/read_sudo_otp.cjs <user_id>
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("redis");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function readRedisUrl() {
  if (process.env.REDIS_PUBLIC_URL) return process.env.REDIS_PUBLIC_URL.trim();
  const txt = fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8");
  const line = txt.split("\n").find((l) => l.startsWith("REDIS_PUBLIC_URL="));
  return line ? line.slice("REDIS_PUBLIC_URL=".length).trim() : "";
}

(async () => {
  const c = createClient({ url: readRedisUrl().replace(/\/\d*$/, "") + "/1" });
  c.on("error", () => {});
  await c.connect();
  const raw = await c.get(`wallet_sudo_otp_${process.argv[2]}:json`);
  await c.quit();
  if (!raw) { console.error("no sudo otp"); process.exit(1); }
  const { hash } = JSON.parse(raw);
  const secret = String(process.env.API_SECRET || "dynopay");
  for (let i = 0; i < 1000000; i++) {
    const code = String(i).padStart(6, "0");
    if (crypto.createHmac("sha256", secret).update(code).digest("hex") === hash) { process.stdout.write(code); return; }
  }
  console.error("not found");
  process.exit(1);
})();
