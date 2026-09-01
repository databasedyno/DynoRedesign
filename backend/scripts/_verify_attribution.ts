/* Reversible E2E harness for the signup-attribution + activation-drip feature.
 * Usage:
 *   ts-node scripts/_verify_attribution.ts inspect   -> print row for user_id=1 + unsub token
 *   ts-node scripts/_verify_attribution.ts finish     -> verify opt-out, drip dry-run, DELETE test row
 * Read-mostly; the only write is deleting the QA test row it created (cleanup).
 */
import dotenv from "dotenv";
dotenv.config();
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import signupAttributionModel from "../models/signupAttributionModel";
import { makeUnsubToken } from "../utils/attributionSource";
import { triggerActivationDrip } from "../utils/crons/activationDrip";
import { connectRedis } from "../utils/redisInstance";
import { t } from "../utils/emailI18n";

const USER_ID = 1;

async function renderCheck() {
  const langs = ["en", "es", "de", "pt", "fr", "nl"];
  const steps = ["d1", "d3", "d7"];
  const segments = ["madeLink", "noLink", "fundraiser"];
  const keys: string[] = [];
  for (const s of steps) {
    keys.push(`activation.step.${s}.subject`, `activation.step.${s}.heading`, `activation.step.${s}.intro`);
  }
  for (const seg of segments) {
    keys.push(`activation.seg.${seg}.line`, `activation.seg.${seg}.cta`);
  }
  keys.push("activation.common.videoCta", "activation.common.unsubscribe", "activation.common.unsubscribeAction");

  let missing = 0;
  const monetary = /(\$\d|free fee|fee[- ]free|\bcashback\b|\bbonus\b|\bdiscount\b|\bpromo\b|\breward\$)/i;
  let monetaryHits = 0;
  for (const L of langs) {
    for (const k of keys) {
      const v = t(k, L, { name: "Sam", companyName: "Acme" });
      if (!v || v === k) { console.log(`MISSING [${L}] ${k}`); missing++; }
      if (monetary.test(String(v))) { console.log(`MONETARY? [${L}] ${k} -> ${v}`); monetaryHits++; }
    }
  }
  console.log(`\nEN subject samples:`);
  for (const s of steps) console.log(`  ${s}: ${t(`activation.step.${s}.subject`, "en")}`);
  console.log(`\nES d1 subject: ${t("activation.step.d1.subject", "es")}`);
  console.log(`\nRESULT: langs=${langs.length} keys/lang=${keys.length} missing=${missing} monetaryHits=${monetaryHits}`);
}

async function main() {
  const mode = process.argv[2] || "inspect";
  await sequelize.authenticate();

  if (mode === "inspect") {
    const row = await signupAttributionModel.findOne({ where: { user_id: USER_ID } });
    console.log("ROW:", row ? JSON.stringify((row as any).toJSON(), null, 2) : "NONE");
    console.log("UNSUB_TOKEN:", makeUnsubToken(USER_ID));
  } else if (mode === "render") {
    await renderCheck();
  } else if (mode === "admin") {
    // Reversible funnel validation: seed 2 temp rows for real cohort users,
    // run the EXACT admin queries, then delete the temp rows.
    const seed = [
      { user_id: 43, source: "google", utm_source: "google", utm_campaign: "probe_seo" },
      { user_id: 49, source: "chatgpt", utm_source: "chatgpt", utm_campaign: "probe_ai" },
    ];
    for (const r of seed) {
      await signupAttributionModel.destroy({ where: { user_id: r.user_id } });
      await signupAttributionModel.create(r as any);
    }
    const bySource = await sequelize.query(
      `SELECT COALESCE(NULLIF(a.source,''),'unknown') AS source,
              COUNT(*)::int AS signups,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM tbl_payment_link pl WHERE pl.user_id = a.user_id))::int AS created_link,
              COUNT(*) FILTER (WHERE COALESCE(u.cumulative_volume_usd,0) > 0)::int AS transacted
       FROM tbl_signup_attribution a JOIN tbl_user u ON u.user_id = a.user_id
       WHERE a.created_at >= NOW() - (:days || ' days')::interval
       GROUP BY 1 ORDER BY signups DESC`,
      { replacements: { days: "365" }, type: QueryTypes.SELECT },
    );
    const topCampaigns = await sequelize.query(
      `SELECT COALESCE(NULLIF(a.utm_campaign,''),'(none)') AS campaign,
              COALESCE(NULLIF(a.utm_source,''),'(none)') AS utm_source, COUNT(*)::int AS signups
       FROM tbl_signup_attribution a
       WHERE a.created_at >= NOW() - (:days || ' days')::interval
         AND (a.utm_campaign IS NOT NULL OR a.utm_source IS NOT NULL)
       GROUP BY 1,2 ORDER BY signups DESC LIMIT 20`,
      { replacements: { days: "365" }, type: QueryTypes.SELECT },
    );
    console.log("BY_SOURCE:", JSON.stringify(bySource, null, 2));
    console.log("TOP_CAMPAIGNS:", JSON.stringify(topCampaigns, null, 2));
    for (const r of seed) await signupAttributionModel.destroy({ where: { user_id: r.user_id } });
    const remaining = await signupAttributionModel.count();
    console.log(`CLEANUP done. total rows now = ${remaining}`);
  } else if (mode === "finish") {
    const row = await signupAttributionModel.findOne({ where: { user_id: USER_ID } });
    console.log("opt_out_before_delete:", row ? (row as any).marketing_opt_out : "NO ROW");

    // Cleanup FIRST so the QA test row never lingers in prod, even if the
    // dry-run below hiccups.
    const deleted = await signupAttributionModel.destroy({ where: { user_id: USER_ID } });
    const after = await signupAttributionModel.count({ where: { user_id: USER_ID } });
    console.log(`CLEANUP: deleted=${deleted}, remaining_rows_for_user=${after}`);

    console.log("\n=== DRIP DRY-RUN (safe: no send, no dedup write) ===");
    await connectRedis();
    const summary = await triggerActivationDrip(true);
    console.log(JSON.stringify(summary, null, 2));
  }

  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(1);
});
