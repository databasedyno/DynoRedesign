// TEST-ONLY: seed or clear a wallet-sudo session for a user (so the editor UI renders
// without the emailed OTP, which is suppressed in SAFE MODE). Usage:
//   node seed_sudo_session.cjs <user_id> seed|clear
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { createClient } = require("redis");
(async () => {
  const uid = process.argv[2] || "1";
  const mode = process.argv[3] || "seed";
  const client = createClient({ url: process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL });
  client.on("error", () => {});
  await client.connect();
  const key = `wallet_sudo_session_${uid}:json`;
  if (mode === "clear") {
    await client.del(key);
    console.log("cleared", key);
  } else {
    const ttl = 1800;
    const val = JSON.stringify({ issued_at: Date.now(), expires_at: Date.now() + ttl * 1000 });
    await client.set(key, val, { EX: ttl });
    console.log("seeded", key, "ttl", ttl);
  }
  await client.quit();
})();
