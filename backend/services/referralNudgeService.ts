/**
 * Referral SHARE NUDGE (2026-09).
 *
 * Emails active merchants who HAVE a referral code but have never referred anyone
 * (0 referrals, $0 earned) a gentle "your link is ready — here's why it pays"
 * push, so dormant referrers actually start sharing. The monthly digest only
 * ever reaches people who ALREADY earned; this reaches the ones who haven't.
 *
 * Eligibility is READ-ONLY. Idempotent: one Redis key per referrer (30-day TTL)
 * guarantees at most one share-nudge per referrer per month even if the daily
 * cron re-fires or the leader is re-elected. Registered as a daily leader/prod
 * cron (never in SAFE-MODE preview); also exposed via an admin route for manual
 * dry-runs. Outbound email is additionally gated by DISABLE_OUTBOUND_EMAIL.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { sendReferralShareNudgeEmail } from "./email/referralEmails";

interface NudgeRow {
  user_id: number;
  name: string | null;
  email: string | null;
  referral_code: string | null;
}

// At most one share-nudge per referrer per 30 days.
const NUDGE_TTL_SECONDS = 30 * 24 * 60 * 60;
const nudgeKey = (userId: number) => `referral:sharenudge:${userId}`;

export interface ShareNudgeResult {
  dry_run: boolean;
  scanned: number;
  eligible: number;
  sent: number;
  skipped: number;
  sample?: string[];
}

export const sendReferralShareNudges = async (opts?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<ShareNudgeResult> => {
  const limit = Math.min(Math.max(Number(opts?.limit) || 200, 1), 1000);
  const dryRun = opts?.dryRun !== false;

  // Active merchants with a code, no referrals, $0 earned, account older than a
  // week (skip brand-new signups still onboarding).
  const rows = await sequelize.query<NudgeRow>(
    `SELECT u.user_id, u.name, u.email, u.referral_code
       FROM tbl_user u
      WHERE u.status = 'active'
        AND u.referral_code IS NOT NULL AND u.referral_code <> ''
        AND u.email IS NOT NULL AND u.email <> ''
        AND u.email NOT ILIKE '%@dynopay.internal'
        AND u.email NOT ILIKE '%@dynopay.local'
        AND COALESCE(u.referral_count, 0) = 0
        AND COALESCE(u.referral_bonus_earned, 0) = 0
        AND u."createdAt" <= NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM tbl_referral r WHERE r.referrer_user_id = u.user_id
        )
      ORDER BY u."createdAt" DESC
      LIMIT :limit`,
    { type: QueryTypes.SELECT, replacements: { limit } }
  );

  // Drop anyone already nudged in the last 30 days. NOTE: getRedisItem returns
  // {} (not null) for a missing key, so we must check for real content.
  const eligible: NudgeRow[] = [];
  for (const row of rows) {
    if (!row.email || !row.referral_code) continue;
    const already = await getRedisItem(nudgeKey(row.user_id));
    if (already && Object.keys(already).length > 0) continue;
    eligible.push(row);
  }

  if (dryRun) {
    return {
      dry_run: true,
      scanned: rows.length,
      eligible: eligible.length,
      sent: 0,
      skipped: rows.length - eligible.length,
      sample: eligible.slice(0, 20).map((r) => r.email as string),
    };
  }

  let sent = 0;
  let skipped = rows.length - eligible.length;
  for (const row of eligible) {
    try {
      // Reserve the idempotency slot BEFORE sending so a retry/crash can't double-send.
      await setRedisItemWithTTL(
        nudgeKey(row.user_id),
        { at: new Date().toISOString() },
        NUDGE_TTL_SECONDS
      );
      await sendReferralShareNudgeEmail(
        row.email as string,
        row.name || "there",
        row.referral_code as string
      );
      sent++;
      await new Promise((r) => setTimeout(r, 200)); // Brevo-friendly pacing
    } catch (e) {
      skipped++;
      apiLogger.error(`[ReferralShareNudge] ${row.email}: ${e}`);
    }
  }

  apiLogger.info(
    `[ReferralShareNudge] DONE — ${sent} sent, ${skipped} skipped of ${rows.length} scanned`
  );
  return { dry_run: false, scanned: rows.length, eligible: eligible.length, sent, skipped };
};
