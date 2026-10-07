// Read a single Redis key value (QA helper for OTP-driven flow tests).
const { createClient } = require("/app/backend/node_modules/redis");
(async () => {
  const url = process.env.REDIS_PUBLIC_URL;
  const key = process.argv[2];
  const c = createClient({ url, socket: { connectTimeout: 5000 } });
  c.on("error", () => {});
  await c.connect();
  const v = await c.get(key);
  console.log(v || "");
  await c.quit();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
