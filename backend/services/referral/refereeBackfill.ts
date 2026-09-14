import { QueryTypes } from 'sequelize';
import sequelize from '../../utils/dbInstance';
import { apiLogger } from '../../utils/loggers';

let backfillRunning = false;

export interface BackfillResult {
  dry_run: boolean;
  scanned: number;
  eligible: number;
  sample?: string[];
  started?: boolean;
  queued?: number;
  reason?: string;
}

/**
 * One-time invite of HISTORICAL paying customers (no Dynopay account yet) to
 * become merchants with the standard 50%/30d referee offer. The regular cron
 * only covers recent payments — this puts every previously captured email to
 * work. Fully deduplicated: emails with an account, a code already sent, or an
 * unsubscribe on record are skipped (createRefereeCode re-checks too).
 * Synthetic API-payment placeholder emails are excluded at the SQL level.
 *
 * dryRun (default TRUE) only reports counts — nothing is created or sent.
 * A real run processes in the background (Brevo-friendly 250ms pacing) and
 * returns immediately; progress is visible in the API logs. Re-running is safe
 * and continues where the last run left off.
 */
export const backfillRefereeInvites = async (opts: {
  days?: number;
  limit?: number;
  dryRun?: boolean;
}): Promise<BackfillResult> => {
  const days = Math.min(Math.max(Number(opts.days) || 365, 1), 1825);
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 1000);
  const dryRun = opts.dryRun !== false;
  const { checkEmailHasAccount, checkRefereeCodeSent, createRefereeCode } = await import('../referralService');

  const rows = await sequelize.query<{ email: string; company_id: number; user_id: number }>(
    `SELECT DISTINCT ON (LOWER(cust.email))
            LOWER(cust.email) AS email,
            c.company_id,
            c.user_id
       FROM tbl_customer_transaction t
       JOIN tbl_company c ON c.company_id = t.company_id
       JOIN tbl_customer cust ON cust.customer_id = t.customer_id
      WHERE t.status = 'successful'
        AND t."createdAt" >= NOW() - (:days || ' days')::interval
        AND cust.email IS NOT NULL
        AND cust.email <> ''
        AND cust.email NOT ILIKE '%@dynopay.internal'
        AND cust.email NOT ILIKE '%@dynopay.local'
        AND cust.email NOT ILIKE 'legacy-api-%'
        AND cust.email NOT ILIKE 'pk-buyer-%'
        AND cust.email NOT ILIKE 'elements-buyer-%'
        AND cust.email NOT ILIKE 'recovered-%'
      ORDER BY LOWER(cust.email), t."createdAt" DESC`,
    { type: QueryTypes.SELECT, replacements: { days: String(days) } }
  );

  const candidates: typeof rows = [];
  for (const row of rows) {
    if (!row.email) continue;
    if (await checkEmailHasAccount(row.email)) continue;
    if (await checkRefereeCodeSent(row.email)) continue;
    candidates.push(row);
    if (candidates.length >= limit) break;
  }

  if (dryRun) {
    return {
      dry_run: true,
      scanned: rows.length,
      eligible: candidates.length,
      sample: candidates.slice(0, 20).map((c) => c.email),
    };
  }

  if (backfillRunning) {
    return { dry_run: false, scanned: rows.length, eligible: candidates.length, started: false, reason: 'A backfill is already running' };
  }

  backfillRunning = true;
  void (async () => {
    let sent = 0;
    let skipped = 0;
    try {
      const { sendRefereeInviteEmail } = await import('../emailService');
      for (const row of candidates) {
        try {
          const code = await createRefereeCode({
            customerEmail: row.email,
            referrerCompanyId: row.company_id,
            referrerUserId: row.user_id,
          });
          if (code) {
            await sendRefereeInviteEmail(row.email, code.code, code.discount, code.duration, code.unsubscribeToken);
            sent++;
          } else {
            skipped++;
          }
        } catch (e) {
          skipped++;
          apiLogger.error(`[RefereeBackfill] ${row.email}: ${e}`);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      backfillRunning = false;
      apiLogger.info(`[RefereeBackfill] DONE — ${sent} invited, ${skipped} skipped of ${candidates.length} candidate(s)`);
    }
  })();

  return { dry_run: false, scanned: rows.length, eligible: candidates.length, started: true, queued: candidates.length };
};
