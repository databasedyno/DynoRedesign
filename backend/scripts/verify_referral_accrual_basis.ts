/**
 * READ-ONLY probe (no writes). Validates the referral commission ACCRUAL
 * fee-basis formula used by referralCommissionService.accrueReferralCommission:
 *
 *   fee_usd = (transaction_fee + fixed_fee) * (usd_value / NULLIF(base_amount,0))
 *
 * For a correct row this should equal the platform fee (~1.5% of usd_value).
 * Hypothesis: AUTO-CONVERT settlements store transaction_fee = fee+merchant and
 * DO NOT rewrite base_amount to crypto (stays fiat), so the ratio breaks and the
 * effective fee% is nonsensical. Compares auto-convert vs normal merchants.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

(async () => {
  const out: Record<string, unknown> = {};
  try {
    // 1) auto-convert company inventory
    const companies = await sequelize.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE auto_convert_enabled)::int AS auto_on
         FROM tbl_company`,
      { type: QueryTypes.SELECT }
    );
    out.companies = companies[0];

    // 2) effective platform fee % by auto-convert flag over SETTLED rows
    const byFlag = await sequelize.query(
      `SELECT COALESCE(c.auto_convert_enabled,false) AS auto_convert,
              COUNT(*)::int AS n_settled,
              ROUND(AVG(
                ((COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))
                 * (COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0)))
                / NULLIF(ut.usd_value,0) * 100
              )::numeric, 2)::float AS avg_effective_fee_pct,
              ROUND(MIN(
                ((COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))
                 * (COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0)))
                / NULLIF(ut.usd_value,0) * 100
              )::numeric, 2)::float AS min_effective_fee_pct,
              ROUND(MAX(
                ((COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))
                 * (COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0)))
                / NULLIF(ut.usd_value,0) * 100
              )::numeric, 2)::float AS max_effective_fee_pct
         FROM tbl_user_transaction ut
         JOIN tbl_company c ON c.company_id = ut.company_id
        WHERE ut.status IN ('successful','done','completed')
          AND ut.base_amount > 0
          AND COALESCE(ut.usd_value,0) > 0
        GROUP BY COALESCE(c.auto_convert_enabled,false)`,
      { type: QueryTypes.SELECT }
    );
    out.effective_fee_pct_by_auto_convert = byFlag;

    // 3) sample rows from auto-convert merchants (the suspect path)
    const acSamples = await sequelize.query(
      `SELECT ut.id, ut.base_currency, ut.crypto_currency,
              ut.base_amount::float AS base_amount, ut.usd_value::float AS usd_value,
              ut.transaction_fee::float AS transaction_fee, ut.fixed_fee::float AS fixed_fee,
              ut.crypto_amount::float AS crypto_amount,
              ROUND((
                (COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))
                * (COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0))
              )::numeric, 4)::float AS accrual_fee_usd
         FROM tbl_user_transaction ut
         JOIN tbl_company c ON c.company_id = ut.company_id
        WHERE c.auto_convert_enabled = true
          AND ut.status IN ('successful','done','completed')
          AND ut.base_amount > 0 AND COALESCE(ut.usd_value,0) > 0
        ORDER BY ut."createdAt" DESC
        LIMIT 8`,
      { type: QueryTypes.SELECT }
    );
    out.auto_convert_samples = acSamples;

    // 4) sample rows from NORMAL merchants (the known-good path) for contrast
    const normSamples = await sequelize.query(
      `SELECT ut.id, ut.base_currency, ut.crypto_currency,
              ut.base_amount::float AS base_amount, ut.usd_value::float AS usd_value,
              ut.transaction_fee::float AS transaction_fee, ut.fixed_fee::float AS fixed_fee,
              ut.crypto_amount::float AS crypto_amount,
              ROUND((
                (COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))
                * (COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0))
              )::numeric, 4)::float AS accrual_fee_usd
         FROM tbl_user_transaction ut
         JOIN tbl_company c ON c.company_id = ut.company_id
        WHERE COALESCE(c.auto_convert_enabled,false) = false
          AND ut.status IN ('successful','done','completed')
          AND ut.base_amount > 0 AND COALESCE(ut.usd_value,0) > 0
        ORDER BY ut."createdAt" DESC
        LIMIT 8`,
      { type: QueryTypes.SELECT }
    );
    out.normal_samples = normSamples;

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("PROBE FAILED:", e);
    await sequelize.close();
    process.exit(1);
  }
})();
