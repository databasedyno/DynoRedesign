/**
 * One-off maintenance: REGENERATE this week's "Your Weekly Summary" notifications
 * with the corrected USD total_volume (the old rows summed raw base_amount /
 * native crypto units, e.g. "$21.63" for 34 txns).
 *
 * It replicates the SCHEDULED weekly cron logic EXACTLY (company-scoped, same
 * message + notificationData) but with the fixed processedUsdExpr("") volume,
 * so the regenerated row matches what the merchant saw (same counts) with the
 * right dollar amount.
 *
 * Safety:
 *   - DRY RUN by default (no writes). Pass --apply to write.
 *   - Only deletes WEEKLY_SUMMARY notifications created SINCE 00:00 UTC today
 *     (i.e. this morning's buggy run + any it re-creates) — never historical.
 *
 * Usage:
 *   Dry run:  npx ts-node --transpile-only scripts/regen_weekly_summaries.ts
 *   Apply:    npx ts-node --transpile-only scripts/regen_weekly_summaries.ts --apply
 */
import dotenv from "dotenv";
dotenv.config();
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { processedStatusSql, processedUsdExpr } from "../utils/processedVolume";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { toFixedStr } from "../utils/money";

const APPLY = process.argv.includes("--apply");

interface WeeklyStats {
  transaction_count: string | number;
  total_volume: string | number;
  completed_count: string | number;
  pending_count: string | number;
  failed_count: string | number;
  top_currency?: string;
}

async function main() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const startOfTodayUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const users = (await sequelize.query(
    `SELECT DISTINCT np.user_id, np.company_id, u.name, u.email
     FROM tbl_notification_preferences np
     JOIN tbl_user u ON u.user_id = np.user_id
     WHERE np.weekly_summary = true`,
    { type: QueryTypes.SELECT }
  )) as Array<Record<string, unknown>>;

  console.log(`Eligible (user,company) pairs with weekly_summary=on: ${users.length}`);
  console.log(`Window: ${startDate.toISOString()} .. ${endDate.toISOString()}`);
  console.log(`Will delete WEEKLY_SUMMARY notifications created >= ${startOfTodayUtc.toISOString()} before recreating.`);
  console.log(APPLY ? ">>> APPLY MODE (writing)\n" : ">>> DRY RUN (no writes) — pass --apply to write\n");

  let recreated = 0;
  let deleted = 0;

  for (const user of users) {
    const summary = (await sequelize.query(
      `SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN ${processedStatusSql("")} THEN ${processedUsdExpr("")} ELSE 0 END), 0) as total_volume,
        COALESCE(SUM(CASE WHEN ${processedStatusSql("")} THEN 1 ELSE 0 END), 0) as completed_count,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
        COALESCE(SUM(CASE WHEN status IN ('failed', 'expired') THEN 1 ELSE 0 END), 0) as failed_count,
        (SELECT crypto_currency FROM tbl_user_transaction
          WHERE company_id = :companyId AND ${processedStatusSql("")}
          AND crypto_currency IS NOT NULL AND crypto_currency <> ''
          AND "createdAt" >= :startDate AND "createdAt" <= :endDate
          GROUP BY crypto_currency ORDER BY COUNT(*) DESC LIMIT 1) as top_currency
       FROM tbl_user_transaction
       WHERE company_id = :companyId
       AND "createdAt" >= :startDate
       AND "createdAt" <= :endDate`,
      {
        replacements: {
          companyId: user.company_id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    )) as Array<Record<string, unknown>>;

    const stats = (summary[0] || {}) as unknown as WeeklyStats;
    const transactionCount = parseInt(String(stats.transaction_count || 0));
    const totalVolume = parseFloat(String(stats.total_volume || 0));
    const completedCount = parseInt(String(stats.completed_count || 0));
    const pendingCount = parseInt(String(stats.pending_count || 0));
    const failedCount = parseInt(String(stats.failed_count || 0));

    const message = `This week you had ${transactionCount} transactions with a total volume of $${toFixedStr(totalVolume, 2)}. ${completedCount} completed, ${pendingCount} pending.`;

    const notificationData = {
      period_start: startDate.toISOString().split("T")[0],
      period_end: endDate.toISOString().split("T")[0],
      transaction_count: transactionCount,
      total_volume: totalVolume,
      completed_count: completedCount,
      pending_count: pendingCount,
      failed_count: failedCount,
      top_currency: String(stats.top_currency || "None"),
    };

    console.log(`user ${user.user_id} / company ${user.company_id}: ${message}`);

    if (!APPLY) continue;

    // Remove this morning's (buggy) weekly-summary row(s) for THIS (user, company) pair
    // before recreating. Scope by company too — a user with multiple companies gets one
    // row per company, and a user-level delete would wipe a sibling company's fresh row.
    const companyId =
      user.company_id === null || user.company_id === undefined ? null : Number(user.company_id);
    const del = (await sequelize.query(
      `DELETE FROM tbl_notification
       WHERE user_id = :userId AND type = :type AND created_at >= :since
       AND ((:companyId::int IS NULL AND company_id IS NULL) OR company_id = :companyId)
       RETURNING notification_id`,
      {
        replacements: {
          userId: Number(user.user_id),
          type: NOTIFICATION_TYPES.WEEKLY_SUMMARY,
          since: startOfTodayUtc.toISOString(),
          companyId,
        },
        type: QueryTypes.SELECT,
      }
    )) as Array<Record<string, unknown>>;
    deleted += del.length;

    const created = await createNotification(
      Number(user.user_id),
      NOTIFICATION_TYPES.WEEKLY_SUMMARY,
      "Your Weekly Summary",
      message,
      notificationData,
      Number(user.company_id)
    );
    if (created) recreated += 1;
  }

  console.log(`\nDone. Deleted ${deleted} stale row(s), recreated ${recreated} corrected notification(s).`);
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("regen_weekly_summaries failed:", e);
  process.exit(1);
});
