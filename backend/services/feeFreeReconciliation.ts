/**
 * Fee-Free Trial Reconciliation
 * 
 * One-time startup reconciliation that corrects fee_free_remaining_usd
 * for existing users based on their ACTUAL transaction history.
 * 
 * Root cause: When fee_free_remaining_usd column was added with defaultValue: 500,
 * ALL existing users got $500 credit — even those who already processed $5,000+.
 * This script queries actual transaction volume and corrects the balance.
 * 
 * BUG FIX (2026-04-02): Changed SUM(base_amount) → SUM(COALESCE(NULLIF(usd_value,0), base_amount)).
 * base_amount stores CRYPTO amounts (e.g. 0.004 ETH) for crypto transactions, not USD.
 * usd_value stores the correct USD equivalent at time of receipt. For fiat/card transactions
 * where usd_value may be 0, base_amount is already in fiat and serves as a reasonable fallback.
 * 
 * Created: 2026-04-02
 */

import sequelize from "../utils/dbInstance";
import { log, cronLogger } from "../utils/loggers";
import { processedStatusSql } from "../utils/processedVolume";

const FREE_TRIAL_VOLUME_USD = parseFloat(process.env.FREE_TRIAL_VOLUME_USD || "500");

/**
 * Reconcile fee-free balances for all users based on actual transaction history.
 * Only runs corrections — never INCREASES a user's fee-free balance.
 * 
 * Logic:
 * - Sum all successful transaction USD values for each user from tbl_user_transaction
 *   Uses usd_value (USD at time of receipt) with base_amount fallback for fiat TXs
 * - If actual_volume >= $500, set fee_free_remaining_usd = 0, fee_tier = 'standard'
 * - If actual_volume < $500 but fee_free_remaining_usd > (500 - actual_volume),
 *   correct it to (500 - actual_volume)
 */
export async function reconcileFeeFreeBalances(): Promise<void> {
  try {
    cronLogger.info("[FeeFreeReconciliation] Starting fee-free balance reconciliation...");

    // Query actual cumulative volume per user from transaction history
    // Only count successful/completed transactions
    // FIX: Use usd_value (USD equivalent) instead of base_amount (which is in crypto for crypto TXs)
    //   - usd_value: populated during crypto verification with USD value at time of receipt
    //   - base_amount: for crypto TXs this is the crypto amount (e.g. 0.004 ETH), for fiat it's fiat amount
    //   - NULLIF(usd_value, 0): converts 0 to NULL so COALESCE falls through to base_amount
    const [results] = await sequelize.query(`
      UPDATE tbl_user u
      SET 
        cumulative_volume_usd = GREATEST(COALESCE(u.cumulative_volume_usd, 0), actual.total_volume),
        fee_free_remaining_usd = GREATEST(0, ${FREE_TRIAL_VOLUME_USD} - GREATEST(COALESCE(u.cumulative_volume_usd, 0), actual.total_volume)),
        -- Only graduate users still marked 'trial'. Previously this stamped
        -- 'standard' over EARNED volume tiers ('growth'/'scale'/'enterprise'),
        -- silently repricing high-volume merchants back up to the 1.5% rate.
        fee_tier = CASE 
          WHEN actual.total_volume >= ${FREE_TRIAL_VOLUME_USD} AND u.fee_tier = 'trial' THEN 'standard'
          ELSE u.fee_tier
        END
      FROM (
        SELECT 
          t.user_id,
          COALESCE(SUM(COALESCE(NULLIF(t.usd_value, 0), t.base_amount)), 0) AS total_volume
        FROM tbl_user_transaction t
        WHERE ${processedStatusSql("t")}
        GROUP BY t.user_id
      ) actual
      WHERE u.user_id = actual.user_id
        AND (
          -- Only update if current fee_free_remaining_usd is HIGHER than it should be
          u.fee_free_remaining_usd > GREATEST(0, ${FREE_TRIAL_VOLUME_USD} - GREATEST(COALESCE(u.cumulative_volume_usd, 0), actual.total_volume))
          -- Or if cumulative_volume_usd is out of sync
          OR COALESCE(u.cumulative_volume_usd, 0) < actual.total_volume
        )
      RETURNING u.user_id, actual.total_volume, u.fee_free_remaining_usd, u.fee_tier;
    `);

    const corrected = results as any[];
    if (corrected.length > 0) {
      cronLogger.info(`[FeeFreeReconciliation] ✅ Corrected ${corrected.length} user(s):`);
      for (const row of corrected) {
        cronLogger.info(`  - User ${row.user_id}: actual_volume=$${Number(row.total_volume).toFixed(2)}, remaining=$${Number(row.fee_free_remaining_usd).toFixed(2)}, tier=${row.fee_tier}`);
      }
    } else {
      cronLogger.info("[FeeFreeReconciliation] ✅ All fee-free balances are correct — no corrections needed.");
    }

  } catch (error: any) {
    cronLogger.error(`[FeeFreeReconciliation] Error during reconciliation: ${error.message}`);
    // Non-fatal — don't crash the server
  }
}

export default reconcileFeeFreeBalances;
