import {
  FORWARDED,
  IN_RANGE,
  NET_USD,
  OverviewScope,
  companyScopeSql,
  fromClause,
  many,
  one,
} from "../dashboard/overviewQueries";
import { PROCESSED_STATUS_SQL } from "../../utils/processedVolume";

/** A payment counts as forwarded when the pool swept it to the merchant wallet OR an auto-convert withdrawal completed. */
const CONV_DONE = `EXISTS (SELECT 1 FROM tbl_stablecoin_conversion sc
  WHERE sc.transaction_id = ut.transaction_id AND UPPER(sc.status::text) = 'COMPLETED')`;
const CONV_ANY = `EXISTS (SELECT 1 FROM tbl_stablecoin_conversion sc WHERE sc.transaction_id = ut.transaction_id)`;
export const FORWARDED_ANY = `(${FORWARDED} OR ${CONV_DONE})`;
const FORWARDED_AT = `COALESCE((SELECT MAX(COALESCE(sc.completed_at, sc.withdrawn_at, sc."updatedAt"))
  FROM tbl_stablecoin_conversion sc
  WHERE sc.transaction_id = ut.transaction_id AND UPPER(sc.status::text) = 'COMPLETED'), ut."updatedAt")`;
const STUCK_AFTER = `INTERVAL '2 hours'`;

/** Range totals: forwarded count/amount, last forward, and processed-but-not-yet-forwarded money. */
export const payoutTotals = (s: OverviewScope) =>
  one(
    `SELECT
      COUNT(*) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED_ANY}) AS fwd_count,
      COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED_ANY}), 0) AS fwd_amount,
      MAX(${FORWARDED_AT}) FILTER (WHERE ${FORWARDED_ANY}) AS last_forward_at,
      COUNT(*) FILTER (WHERE NOT ${FORWARDED_ANY}) AS awaiting_count,
      COALESCE(SUM(${NET_USD}) FILTER (WHERE NOT ${FORWARDED_ANY}), 0) AS awaiting_amount
     ${fromClause(s)}
     AND ${PROCESSED_STATUS_SQL}`,
    s,
  );

/** Forwarded-in-range totals per asset (source coin). */
export const payoutByAsset = (s: OverviewScope) =>
  many(
    `SELECT UPPER(COALESCE(NULLIF(ut.crypto_currency, ''), ut.base_currency)) AS asset,
            COUNT(*) AS count,
            COALESCE(SUM(${NET_USD}), 0) AS amount,
            COALESCE(SUM(ut.crypto_amount - COALESCE(ut.transaction_fee, 0)), 0) AS crypto_amount
     ${fromClause(s)}
     AND ${PROCESSED_STATUS_SQL} AND ${FORWARDED_ANY} AND ${IN_RANGE}
     GROUP BY 1 ORDER BY amount DESC`,
    s,
  );

/** Every payout wallet for the scope with its forwarding activity (range + last ever). */
export const payoutWallets = (s: OverviewScope) =>
  many(
    `SELECT uw.wallet_id, uw.wallet_type, uw.wallet_address, uw.wallet_name,
            COUNT(ut.transaction_id) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED_ANY}) AS fwd_count,
            COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED_ANY}), 0) AS fwd_amount,
            MAX(${FORWARDED_AT}) FILTER (WHERE ${FORWARDED_ANY}) AS last_forward_at,
            (SELECT NULLIF(x.outgoing_tx_hash, '') FROM tbl_user_transaction x
              WHERE x.wallet_id = uw.wallet_id AND NULLIF(x.outgoing_tx_hash, '') IS NOT NULL
              ORDER BY x."updatedAt" DESC LIMIT 1) AS last_tx_hash
     FROM tbl_user_wallet uw
     LEFT JOIN tbl_user_transaction ut
       ON ut.wallet_id = uw.wallet_id AND ${PROCESSED_STATUS_SQL}
     WHERE ${companyScopeSql(s, "uw.company_id")}
       AND uw.wallet_address IS NOT NULL AND uw.wallet_address <> ''
     GROUP BY uw.wallet_id, uw.wallet_type, uw.wallet_address, uw.wallet_name
     ORDER BY last_forward_at DESC NULLS LAST, uw.wallet_type`,
    s,
  );

/** Latest forwards (timeline) — swept payouts and completed auto-convert withdrawals. */
export const recentForwards = (s: OverviewScope) =>
  many(
    `SELECT ut.id, ut.transaction_id,
            UPPER(COALESCE(NULLIF(ut.crypto_currency, ''), ut.base_currency)) AS asset,
            (ut.crypto_amount - COALESCE(ut.transaction_fee, 0)) AS crypto_amount,
            ${NET_USD} AS amount,
            ${FORWARDED_AT} AS forwarded_at,
            COALESCE(sc.withdrawal_tx_hash, NULLIF(ut.outgoing_tx_hash, '')) AS tx_hash,
            COALESCE(sc.settlement_wallet_address, uw.wallet_address) AS wallet_address,
            COALESCE(sc.target_currency, uw.wallet_type) AS wallet_type,
            (sc.conversion_id IS NOT NULL) AS converted,
            sc.target_amount, sc.target_currency
     FROM tbl_user_transaction ut
     ${s.companyId ? "LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id" : ""}
     LEFT JOIN LATERAL (
       SELECT * FROM tbl_stablecoin_conversion x
       WHERE x.transaction_id = ut.transaction_id AND UPPER(x.status::text) = 'COMPLETED'
       ORDER BY x."updatedAt" DESC LIMIT 1
     ) sc ON TRUE
     LEFT JOIN tbl_user_wallet uw ON uw.wallet_id = ut.wallet_id
     WHERE ut.user_id = :userId
     ${s.companyId ? "AND (ut.company_id = :companyId OR c.company_id = :companyId)" : ""}
     AND ${PROCESSED_STATUS_SQL} AND ${FORWARDED_ANY}
     ORDER BY forwarded_at DESC
     LIMIT 12`,
    s,
  );

/** Money that reached the merchant but has not been forwarded for a while and is not in a conversion pipeline. */
export const stuckForwards = (s: OverviewScope) =>
  many(
    `SELECT ut.id, ut.transaction_id,
            UPPER(COALESCE(NULLIF(ut.crypto_currency, ''), ut.base_currency)) AS asset,
            (ut.crypto_amount - COALESCE(ut.transaction_fee, 0)) AS crypto_amount,
            ${NET_USD} AS amount,
            ut."updatedAt" AS settled_at
     ${fromClause(s)}
     AND ${PROCESSED_STATUS_SQL} AND NOT ${FORWARDED_ANY} AND NOT ${CONV_ANY}
     AND ut."updatedAt" < NOW() - ${STUCK_AFTER}
     ORDER BY ut."updatedAt" DESC
     LIMIT 10`,
    s,
  );

/**
 * Auto-convert pipeline rows the MERCHANT should see: only conversions still in
 * progress. FAILED conversions are deliberately excluded — policy is that a failed
 * conversion alerts admin/ops only (they settle by hand, see
 * conversionService.notifyConversionFailed); the merchant is not shown a technical
 * "could not be converted · retry" alert here. Excluding FAILED also clears stale
 * historical failures from the merchant "Needs attention" feed.
 */
export const conversionsNeedingAttention = (s: OverviewScope) =>
  many(
    `SELECT sc.conversion_id, sc.transaction_id, sc.status, sc.source_currency, sc.source_amount,
            sc.source_amount_usd, sc.target_currency, sc.settlement_chain, sc.error_message,
            sc.retry_count, sc."updatedAt", sc."createdAt", ut.id AS payment_id
     FROM tbl_stablecoin_conversion sc
     LEFT JOIN tbl_user_transaction ut ON ut.transaction_id = sc.transaction_id
     WHERE ${companyScopeSql(s, "sc.company_id")}
       AND UPPER(sc.status::text) NOT IN ('COMPLETED', 'FAILED')
     ORDER BY sc."updatedAt" DESC
     LIMIT 20`,
    s,
  );
