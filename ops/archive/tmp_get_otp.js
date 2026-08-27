const IORedis = require('/app/node_modules/ioredis');
(async () => {
  const c = new IORedis('redis://default:REDACTED_REDIS_PASSWORD@nozomi.proxy.rlwy.net:15794', { lazyConnect: true });
  await c.connect();
  const keys = await c.keys('login_otp:*');
  for (const k of keys) {
    const v = await c.get(k);
    console.log(k, '=', v);
  }
  await c.disconnect();
})();
