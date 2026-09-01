/**
 * Activation Drip Cron — MERCHANT-facing (distinct from the admin-facing
 * onboarding/first-payment monitors that email the DynoPay team).
 *
 * Daily run. For real external signups (owner QA/test accounts excluded) who
 * have verified their email but have NOT transacted, sends a localized,
 * segment-aware nudge on a day-1 / day-3 / day-7 cadence:
 *   - madeLink   : created a payment link but no payment yet  → add payout wallet
 *   - noLink     : never created a link                        → 2-min quick start
 *   - fundraiser : purpose_vertical = 'fundraisers'            → launch a donation link
 *
 * Guidance/how-to only — no monetary offer. Redis dedup (per user, per step)
 * guarantees at-most-once, and users who unsubscribed (tbl_signup_attribution
 * .marketing_opt_out) are skipped.
 */
import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "../dbInstance";
import { log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";
import { makeUnsubToken } from "../attributionSource";
import type { ActivationSegment, ActivationStep } from "../../services/email/activationEmails";

const STEPS: Array<{ step: ActivationStep; minDays: number; maxDays: number }> = [
  { step: "d1", minDays: 1, maxDays: 2 },
  { step: "d3", minDays: 3, maxDays: 4 },
  { step: "d7", minDays: 7, maxDays: 8 },
];

// Excludes the owner's QA/test accounts so we never email internal fixtures.
const REAL_USER_SQL = `
  u.email_verified = true
  AND u.email NOT ILIKE 'onarrival21+%'
  AND u.email NOT ILIKE '%@dynopaytest.com'
  AND u.email NOT ILIKE '%@dynopay-qa.com'
  AND u.email NOT ILIKE '%@example.com'
  AND u.email NOT ILIKE 'dyno-rbac%'`;

interface DripRow {
  user_id: number;
  name: string | null;
  email: string;
  company_name: string | null;
  language: string | null;
  purpose_vertical: string | null;
  has_link: boolean;
  opt_out: boolean;
}

const segmentFor = (r: DripRow): ActivationSegment =>
  r.purpose_vertical === "fundraisers" ? "fundraiser" : r.has_link ? "madeLink" : "noLink";

async function selectCohort(minDays: number, maxDays: number): Promise<DripRow[]> {
  return (await sequelize.query(
    `SELECT u.user_id, u.name, u.email,
            (SELECT c.company_name FROM tbl_company c WHERE c.user_id = u.user_id ORDER BY c.company_id LIMIT 1) AS company_name,
            u.language, u.purpose_vertical,
            EXISTS (SELECT 1 FROM tbl_payment_link pl WHERE pl.user_id = u.user_id) AS has_link,
            COALESCE((SELECT a.marketing_opt_out FROM tbl_signup_attribution a WHERE a.user_id = u.user_id), false) AS opt_out
     FROM tbl_user u
     WHERE u."createdAt" <  NOW() - (:minDays || ' days')::interval
       AND u."createdAt" >= NOW() - (:maxDays || ' days')::interval
       AND ${REAL_USER_SQL}
       AND COALESCE(u.cumulative_volume_usd, 0) = 0
       AND NOT EXISTS (
         SELECT 1 FROM tbl_user_transaction t
         WHERE t.user_id = u.user_id
           AND lower(t.status) IN ('paid','completed','confirmed','settled','success','done')
       )`,
    { replacements: { minDays: String(minDays), maxDays: String(maxDays) }, type: QueryTypes.SELECT },
  )) as DripRow[];
}

/**
 * Core engine. dryRun=true returns the exact cohort per step WITHOUT sending or
 * marking dedup — safe to run against production for a preview.
 */
export async function runActivationDrip(dryRun = true) {
  const { getRedisItem, setRedisItemWithTTL } = await import("../redisInstance");
  const { sendActivationEmail } = await import("../../services/email/activationEmails");

  const summary = {
    dry_run: dryRun,
    steps: {} as Record<string, { eligible: number; sent: number; skipped_already: number; skipped_opt_out: number; sample: Array<Record<string, unknown>> }>,
  };

  for (const { step, minDays, maxDays } of STEPS) {
    const rows = await selectCohort(minDays, maxDays);
    const bucket = { eligible: rows.length, sent: 0, skipped_already: 0, skipped_opt_out: 0, sample: [] as Array<Record<string, unknown>> };

    for (const r of rows) {
      const segment = segmentFor(r);
      if (r.opt_out) { bucket.skipped_opt_out++; continue; }

      const dedupKey = `activation-drip:${r.user_id}:${step}`;
      const seen = await getRedisItem(dedupKey);
      const already = Boolean(seen && Object.keys(seen).length > 0);

      if (bucket.sample.length < 8) {
        bucket.sample.push({ user_id: r.user_id, email: r.email, segment, already });
      }
      if (already) { bucket.skipped_already++; continue; }

      if (!dryRun) {
        const ok = await sendActivationEmail({
          userId: r.user_id,
          email: r.email,
          name: r.name,
          companyName: r.company_name,
          step,
          segment,
          unsubToken: makeUnsubToken(r.user_id),
          lang: r.language,
        });
        if (ok) {
          await setRedisItemWithTTL(dedupKey, { sent: true, at: Date.now() }, 30 * 86400);
          bucket.sent++;
        }
      }
    }
    summary.steps[step] = bucket;
  }

  return summary;
}

export function setupActivationDripCron() {
  // Daily at 08:45 UTC (after the payout digest / wallet reminders).
  cron.schedule("45 8 * * *", async () => {
    log("Activation Drip Cron starting...", "info");
    try {
      const result = await runActivationDrip(false);
      const totals = Object.entries(result.steps)
        .map(([s, b]) => `${s}:sent=${b.sent}/elig=${b.eligible}`)
        .join(" ");
      log(`Activation Drip Cron completed — ${totals}`, "info");
    } catch (e) {
      log(`Activation Drip Cron Error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "setupActivationDripCron" });
    }
  });
  log("Activation Drip Cron scheduled for daily at 08:45 UTC", "info");
}

/** Manual trigger for ops/testing. dryRun defaults to true (safe on prod). */
export const triggerActivationDrip = async (dryRun = true) => runActivationDrip(dryRun);
