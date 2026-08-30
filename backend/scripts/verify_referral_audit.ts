/**
 * READ-ONLY referral audit probe (2026-06 fork). NO writes.
 * Grounds the scenario/edge-case audit against the live prod DB (SAFE MODE):
 *  - confirms Phase-1 columns exist
 *  - reports referral inventory + pool totals (accrued/paid/credited)
 *  - demonstrates the automation-SQL vs summary discrepancy (credited not subtracted)
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

(async () => {
  const out: Record<string, unknown> = {};
  try {
    // 1) Columns present?
    const cols = await sequelize.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE (table_name='tbl_referral' AND column_name IN
                 ('commission_accrued_usd','commission_paid_usd','commission_credited_usd',
                  'commission_window_ends_at','last_accrual_at','commission_rate'))
           OR (table_name='tbl_user_transaction' AND column_name='referral_credit_applied_usd')
           OR (table_name='tbl_user' AND column_name IN
                 ('referral_payout_mode','referral_payout_trc20_address','referral_payout_address_verified_at',
                  'referral_payout_auto','referral_payout_auto_min_usd','referral_payout_nudged_at'))
        ORDER BY table_name, column_name`,
      { type: QueryTypes.SELECT }
    );
    out.columns = cols.map((c) => `${c.table_name}.${c.column_name}`);

    // 2) Referral inventory by status + pool totals
    const inv = await sequelize.query(
      `SELECT status, COUNT(*)::int AS n,
              COALESCE(SUM(commission_accrued_usd),0)::float AS accrued,
              COALESCE(SUM(commission_paid_usd),0)::float AS paid,
              COALESCE(SUM(commission_credited_usd),0)::float AS credited
         FROM tbl_referral GROUP BY status ORDER BY status`,
      { type: QueryTypes.SELECT }
    );
    out.inventory = inv;

    // 3) Any referral where the shared-pool invariant is violated (paid+credited > accrued)?
    const bad = await sequelize.query(
      `SELECT referral_id, referrer_user_id, commission_accrued_usd AS accrued,
              commission_paid_usd AS paid, commission_credited_usd AS credited
         FROM tbl_referral
        WHERE COALESCE(commission_paid_usd,0)+COALESCE(commission_credited_usd,0)
              > COALESCE(commission_accrued_usd,0)+0.001`,
      { type: QueryTypes.SELECT }
    );
    out.invariant_violations = bad;

    // 4) Referrers with credited>0 who are in cash mode (the double-spend surface)
    const risk = await sequelize.query(
      `SELECT u.user_id, u.referral_payout_mode, u.referral_payout_auto,
              SUM(r.commission_accrued_usd - r.commission_paid_usd)::float AS automation_unpaid,
              SUM(r.commission_accrued_usd - r.commission_paid_usd - r.commission_credited_usd)::float AS true_unpaid
         FROM tbl_referral r JOIN tbl_user u ON u.user_id = r.referrer_user_id
        WHERE r.status IN ('active','rewarded') AND COALESCE(r.commission_credited_usd,0) > 0
        GROUP BY u.user_id, u.referral_payout_mode, u.referral_payout_auto`,
      { type: QueryTypes.SELECT }
    );
    out.credited_referrers = risk;

    // 5) user_id=1 payout state
    const u1 = await sequelize.query(
      `SELECT user_id, referral_payout_mode, referral_payout_auto, referral_payout_auto_min_usd,
              referral_payout_nudged_at, referral_payout_trc20_address IS NOT NULL AS has_addr,
              referral_payout_address_verified_at IS NOT NULL AS addr_verified
         FROM tbl_user WHERE user_id = 1`,
      { type: QueryTypes.SELECT }
    );
    out.user1 = u1;

    // 6) payout rows
    const payouts = await sequelize.query(
      `SELECT status, COUNT(*)::int AS n FROM tbl_referral_payout GROUP BY status`,
      { type: QueryTypes.SELECT }
    );
    out.payouts = payouts;

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("AUDIT PROBE FAILED:", e);
    await sequelize.close();
    process.exit(1);
  }
})();
