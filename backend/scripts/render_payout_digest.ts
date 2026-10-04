/**
 * Read-only: build + render the weekly payout digest for a user WITHOUT sending
 * anything or creating notifications (SELECT-only against the DB).
 *   cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/render_payout_digest.ts <userId> [/tmp/out.html]
 */
import dotenv from "dotenv";
dotenv.config();
import { writeFileSync } from "fs";

(async () => {
  const userId = Number(process.argv[2] || 1);
  const out = process.argv[3] || `/tmp/payout_digest_${userId}.html`;
  const { connectRedis } = await import("../utils/redisInstance");
  await connectRedis();
  const { buildPayoutDigest, renderPayoutDigestEmail, buildPayoutDigestNotificationText } = await import("../services/payoutDigestService");
  const d = await buildPayoutDigest(userId);
  if (!d) { console.log("no digest (user not found / no email)"); process.exit(1); }
  const { subject, html, lang } = await renderPayoutDigestEmail(d);
  writeFileSync(out, html);
  const notif = buildPayoutDigestNotificationText(d, lang);
  console.log(JSON.stringify({
    subject, lang, out,
    settledVolume: d.settledVolume, settledCount: d.settledCount, totalBrands: d.totalBrands,
    brands: d.brands.map((b) => `${b.name}: ${b.volumeDisplay.toFixed(2)} (${b.txCount})`),
    notification: notif,
    htmlHasAllBrandsNote: html.includes("covers all"),
    htmlHasPerBrand: html.includes("Settled per brand"),
  }, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
