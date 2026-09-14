// TEST-ONLY: recover the plaintext wallet-sudo OTP for a user by HMAC brute force
// (the code is emailed + stored hashed; email is suppressed in SAFE MODE). Read-only
// on Redis. Usage: node recover_sudo_otp.cjs <user_id>
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const crypto = require("crypto");
const { createClient } = require("redis");

(async () => {
  const uid = process.argv[2] || "1";
  const url = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
  const secret = process.env.API_SECRET || "dynopay";
  const client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  const raw = await client.get(`wallet_sudo_otp_${uid}:json`);
  if (!raw) {
    console.log("NO_OTP");
    await client.quit();
    return;
  }
  const { hash } = JSON.parse(raw);
  let found = null;
  for (let n = 100000; n <= 999999; n++) {
    const h = crypto.createHmac("sha256", String(secret)).update(String(n)).digest("hex");
    if (h === hash) { found = String(n); break; }
  }
  console.log(found ? `OTP=${found}` : "NOT_FOUND");
  await client.quit();
})();
