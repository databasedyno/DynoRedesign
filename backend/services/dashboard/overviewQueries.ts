import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { PROCESSED_STATUS_SQL, PROCESSED_USD_EXPR } from "../../utils/processedVolume";
import { UNPAID_AFTER_MINUTES } from "../../utils/transactionDisplayStatus";

/**
 * SQL for the dashboard "command centre" overview. Every fragment assumes the
 * transaction table is aliased `ut` and is scoped exactly like getDashboard
 * (user_id + optional company filter via the customer join) so the numbers
 * reconcile with the rest of the dashboard.
 */
export interface OverviewScope {
  userId: number;
  companyId?: string | null;
  start: Date;
  end: Date;
  prevStart: Date;
  startOfToday: Date;
}

type Row = Record<string, unknown>;

export const NET_USD = PROCESSED_USD_EXPR;
// usd_value is the merchant NET (crypto_amount − transaction_fee); scale it back up to gross.
const GROSS_USD = `CASE WHEN COALESCE(ut.crypto_amount, 0) > 0
  AND (ut.crypto_amount - COALESCE(ut.transaction_fee, 0)) > 0
  THEN (${NET_USD}) * ut.crypto_amount / (ut.crypto_amount - COALESCE(ut.transaction_fee, 0))
  ELSE (${NET_USD}) END`;
export { GROSS_USD };
export const FORWARDED = `(NULLIF(ut.outgoing_tx_hash, '') IS NOT NULL)`;
const DETECTED = `(NULLIF(ut.incoming_tx_hash, '') IS NOT NULL OR COALESCE(ut.confirmations, 0) > 0)`;
const CONFIRMING = `(ut.status IN ('processing', 'confirmed') OR (ut.status = 'pending' AND ${DETECTED}))`;
const WINDOW = `INTERVAL '${UNPAID_AFTER_MINUTES} minutes'`;
const AWAITING = `(ut.status = 'pending' AND NOT ${DETECTED} AND ut."createdAt" > NOW() - ${WINDOW})`;
const EXPIRED = `(ut.status = 'pending' AND NOT ${DETECTED} AND ut."createdAt" <= NOW() - ${WINDOW})`;
export const IN_RANGE = `(ut."createdAt" >= :start AND ut."createdAt" <= :end)`;
const IN_PREV = `(ut."createdAt" >= :prevStart AND ut."createdAt" < :start)`;
const SETTLE_MINUTES = `EXTRACT(EPOCH FROM (ut."updatedAt" - ut."createdAt")) / 60`;

export const fromClause = (s: OverviewScope) =>
  `FROM tbl_user_transaction ut
   ${s.companyId ? "LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id" : ""}
   WHERE ut.user_id = :userId
   ${s.companyId ? "AND (ut.company_id = :companyId OR c.company_id = :companyId)" : ""}`;

const replacements = (s: OverviewScope) => ({
  userId: s.userId,
  companyId: s.companyId,
  start: s.start,
  end: s.end,
  prevStart: s.prevStart,
  startOfToday: s.startOfToday,
});

export const one = async (sql: string, s: OverviewScope): Promise<Row> => {
  const rows = (await sequelize.query(sql, { replacements: replacements(s), type: QueryTypes.SELECT })) as Row[];
  return rows[0] || {};
};
export const many = async (sql: string, s: OverviewScope): Promise<Row[]> =>
  (await sequelize.query(sql, { replacements: replacements(s), type: QueryTypes.SELECT })) as Row[];

/** Settled money in range + previous range, forwarding totals, settle-time medians. */
export const settledAggregate = (s: OverviewScope) =>
  one(
    `SELECT
      COUNT(*) FILTER (WHERE ${IN_RANGE}) AS count,
      COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_RANGE}), 0) AS net,
      COALESCE(SUM(${GROSS_USD}) FILTER (WHERE ${IN_RANGE}), 0) AS gross,
      COUNT(*) FILTER (WHERE ${IN_PREV}) AS prev_count,
      COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_PREV}), 0) AS prev_net,
      COUNT(*) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED}) AS fwd_count,
      COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_RANGE} AND ${FORWARDED}), 0) AS fwd_net,
      MAX(ut."updatedAt") FILTER (WHERE ${FORWARDED}) AS last_forward_at,
      MAX(ut."updatedAt") AS last_paid_at,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${SETTLE_MINUTES}) FILTER (WHERE ${IN_RANGE}) AS median_settle_min,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${SETTLE_MINUTES}) FILTER (WHERE ${IN_PREV}) AS prev_median_settle_min
     ${fromClause(s)}
     AND ${PROCESSED_STATUS_SQL}`,
    s,
  );

/** Forwarded-to-merchant-wallet amounts in range, per asset. */
export const forwardedByAsset = (s: OverviewScope) =>
  many(
    `SELECT UPPER(COALESCE(NULLIF(ut.crypto_currency, ''), ut.base_currency)) AS asset,
            COUNT(*) AS count,
            COALESCE(SUM(${NET_USD}), 0) AS amount
     ${fromClause(s)}
     AND ${PROCESSED_STATUS_SQL} AND ${FORWARDED} AND ${IN_RANGE}
     GROUP BY 1 ORDER BY amount DESC`,
    s,
  );

/** Checkout funnel + exception counts (range, previous range, open items, today). */
export const funnelAggregate = (s: OverviewScope) =>
  one(
    `SELECT
      COUNT(*) FILTER (WHERE ${IN_RANGE}) AS created,
      COUNT(*) FILTER (WHERE ${IN_RANGE} AND ${PROCESSED_STATUS_SQL}) AS paid,
      COUNT(*) FILTER (WHERE ${IN_PREV}) AS prev_created,
      COUNT(*) FILTER (WHERE ${IN_PREV} AND ${PROCESSED_STATUS_SQL}) AS prev_paid,
      COUNT(*) FILTER (WHERE ${IN_RANGE} AND ut.status = 'underpaid') AS underpaid_range,
      COUNT(*) FILTER (WHERE ${IN_RANGE} AND ${EXPIRED}) AS expired_range,
      COUNT(*) FILTER (WHERE ${IN_PREV} AND (ut.status = 'underpaid' OR ${EXPIRED})) AS prev_exceptions,
      COUNT(*) FILTER (WHERE ut.status = 'underpaid') AS underpaid_open,
      COUNT(*) FILTER (WHERE ${CONFIRMING}) AS confirming,
      COUNT(*) FILTER (WHERE ${CONFIRMING} AND ut."createdAt" < NOW() - ${WINDOW}) AS confirming_stale,
      COUNT(*) FILTER (WHERE ${AWAITING}) AS awaiting,
      COUNT(*) FILTER (WHERE ${EXPIRED} AND ut."createdAt" >= :startOfToday) AS expired_today
     ${fromClause(s)}`,
    s,
  );

/** Crypto amounts (per currency) for rows whose USD value is not locked yet. */
export const unlockedAmountsByCurrency = (s: OverviewScope) =>
  many(
    `SELECT CASE WHEN ${CONFIRMING} THEN 'confirming' ELSE 'expired_today' END AS kind,
            UPPER(ut.base_currency) AS currency,
            COALESCE(SUM(ut.base_amount), 0) AS amount
     ${fromClause(s)}
     AND (${CONFIRMING} OR (${EXPIRED} AND ut."createdAt" >= :startOfToday))
     GROUP BY 1, 2`,
    s,
  );

/** Top payment links / campaigns by settled volume in range. */
export const topLinks = (s: OverviewScope) =>
  many(
    `SELECT COALESCE(parent_pl.link_id, pl.link_id) AS link_id,
            COALESCE(NULLIF(parent_pl.title, ''), NULLIF(pl.title, ''), NULLIF(pl.description, '')) AS title,
            COALESCE(parent_pl.link_type, pl.link_type) AS link_type,
            COALESCE(parent_pl.is_tip_jar, pl.is_tip_jar) AS is_tip_jar,
            COUNT(*) AS paid_count,
            COALESCE(SUM(${NET_USD}), 0) AS amount
     FROM tbl_user_transaction ut
     JOIN (
       SELECT DISTINCT ON (transaction_reference) transaction_reference, link_id, title, description, link_type, parent_link_id, is_tip_jar
       FROM tbl_payment_link
       WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
       ORDER BY transaction_reference, link_id DESC
     ) pl ON pl.transaction_reference = ut.transaction_reference
     LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
     ${s.companyId ? "LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id" : ""}
     WHERE ut.user_id = :userId
     ${s.companyId ? "AND (ut.company_id = :companyId OR c.company_id = :companyId)" : ""}
     AND ${PROCESSED_STATUS_SQL} AND ${IN_RANGE}
     GROUP BY 1, 2, 3, 4 ORDER BY amount DESC LIMIT 6`,
    s,
  );

/** Top products by paid order value in range (order currency, cents → units). */
export const topProducts = (s: OverviewScope) =>
  many(
    `SELECT oi.product_id,
            COALESCE(NULLIF(p.title, ''), oi.product_snapshot->>'title') AS title,
            SUM(oi.quantity) AS units,
            COUNT(DISTINCT po.order_id) AS paid_count,
            COALESCE(SUM(oi.line_total_cents), 0) / 100.0 AS amount,
            MAX(po.currency) AS currency
     FROM tbl_product_order po
     JOIN tbl_product_order_item oi ON oi.order_id = po.order_id
     LEFT JOIN tbl_product p ON p.product_id = oi.product_id
     WHERE po.merchant_user_id = :userId
       ${s.companyId ? "AND po.company_id = :companyId" : ""}
       AND LOWER(COALESCE(po.payment_status, '')) IN ('paid', 'confirmed', 'completed')
       AND COALESCE(po.paid_at, po."createdAt") >= :start AND COALESCE(po.paid_at, po."createdAt") <= :end
     GROUP BY 1, 2 ORDER BY amount DESC LIMIT 6`,
    s,
  );

export const companyScopeSql = (s: OverviewScope, col: string) =>
  s.companyId
    ? `${col} = :companyId`
    : `${col} IN (SELECT company_id FROM tbl_company WHERE user_id = :userId AND deleted_at IS NULL)`;

/** Coins accepted by LIVE payment links that have no payout wallet yet (funds for them can't be received). */
export const coinsWithoutWallet = (s: OverviewScope) =>
  many(
    `SELECT DISTINCT UPPER(TRIM(cur)) AS coin
     FROM tbl_payment_link pl, unnest(string_to_array(pl.accepted_currencies, ',')) AS cur
     WHERE ${companyScopeSql(s, "pl.company_id")}
       AND LOWER(COALESCE(pl.status, '')) = 'pending'
       AND (pl.expires_at IS NULL OR pl.expires_at > NOW())
       AND COALESCE(pl.accepted_currencies, '') <> ''
       AND TRIM(cur) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM tbl_user_wallet uw
         WHERE ${companyScopeSql(s, "uw.company_id")}
           AND UPPER(uw.wallet_type) = UPPER(TRIM(cur))
           AND uw.wallet_address IS NOT NULL AND uw.wallet_address <> ''
       )
     ORDER BY 1`,
    s,
  );

/** Configuration gaps: webhook failures, stale API keys, coins without wallets, links expiring. */
export const configGaps = async (s: OverviewScope) => {
  const [webhooks, keys, coins, links] = await Promise.all([
    one(
      `SELECT COUNT(*) FILTER (WHERE status = 'failed') AS failed,
              COUNT(*) AS total,
              MAX(created_at) FILTER (WHERE status = 'failed') AS last_failed_at,
              (ARRAY_AGG(webhook_url ORDER BY created_at DESC) FILTER (WHERE status = 'failed'))[1] AS webhook_url
       FROM tbl_webhook_delivery_log
       WHERE ${companyScopeSql(s, "company_id")} AND created_at > NOW() - INTERVAL '24 hours'`,
      s,
    ),
    many(
      `SELECT key_hint, api_name, environment,
              EXTRACT(DAY FROM NOW() - COALESCE(key_rotated_at, "createdAt"))::int AS age_days
       FROM tbl_api
       WHERE ${companyScopeSql(s, "company_id")}
         AND LOWER(COALESCE(status::text, 'active')) = 'active'
         AND LOWER(COALESCE(environment::text, 'production')) = 'production'
         AND COALESCE(key_rotated_at, "createdAt") < NOW() - INTERVAL '12 months'
       ORDER BY age_days DESC LIMIT 5`,
      s,
    ),
    coinsWithoutWallet(s),
    one(
      `SELECT COUNT(*) AS expiring
       FROM tbl_payment_link pl
       WHERE ${companyScopeSql(s, "pl.company_id")}
         AND LOWER(COALESCE(pl.status, '')) = 'pending'
         AND pl.expires_at IS NOT NULL
         AND pl.expires_at > NOW() AND pl.expires_at <= NOW() + INTERVAL '48 hours'`,
      s,
    ),
  ]);
  return { webhooks, keys, coins, links };
};

/** Auto-convert setting + converted USD in range for the selected company. */
export const autoConvertSummary = async (s: OverviewScope) => {
  if (!s.companyId) return null;
  const [company, converted] = await Promise.all([
    one(
      `SELECT auto_convert_enabled, settlement_currency, settlement_chain
       FROM tbl_company WHERE company_id = :companyId`,
      s,
    ),
    one(
      `SELECT COALESCE(SUM(COALESCE(merchant_payout_usd, source_amount_usd)), 0) AS amount, COUNT(*) AS count
       FROM tbl_stablecoin_conversion
       WHERE company_id = :companyId AND UPPER(status::text) = 'COMPLETED'
         AND "createdAt" >= :start AND "createdAt" <= :end`,
      s,
    ),
  ]);
  return { company, converted };
};
