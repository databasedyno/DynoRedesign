require("dotenv").config({ path: "/app/backend/.env" });
(async () => {
  const { notifySuspiciousActivity } = await import("../../services/securityAlertService");
  const { redis } = await import("../../utils/redisInstance");
  await redis.connect().catch(() => {});
  await redis.del("sec-alert:otp_lockout:onarrival21@gmail.com").catch(() => {});
  await notifySuspiciousActivity({ email: "onarrival21@gmail.com", event: "otp_lockout", ip: "104.198.214.223", channel: "password_reset", attempts: 5 });
  console.log("second call (should dedup silently)");
  await notifySuspiciousActivity({ email: "onarrival21@gmail.com", event: "otp_lockout", ip: "104.198.214.223", channel: "password_reset", attempts: 5 });
  await notifySuspiciousActivity({ email: "nobody-here@example.com", event: "login_rate_limit", ip: "1.2.3.4", attempts: 20 });
  console.log("unknown email: no-op (no oracle)");
  console.log("dedup key ttl:", await redis.ttl("sec-alert:otp_lockout:onarrival21@gmail.com"));
  process.exit(0);
})();
