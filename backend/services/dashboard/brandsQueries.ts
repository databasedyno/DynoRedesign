/**
 * Per-brand portfolio metrics for the Brands overview page. Reuses the same
 * scoping/expressions as the single-brand dashboard so numbers reconcile.
 * Each function is scoped to ONE company via OverviewScope (userId = the
 * brand OWNER's user_id, companyId set).
 */
import { NET_USD, IN_RANGE, OverviewScope, fromClause, one } from "./overviewQueries";
import { PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import { UNPAID_AFTER_MINUTES } from "../../utils/transactionDisplayStatus";

const DETECTED = `(NULLIF(ut.incoming_tx_hash, '') IS NOT NULL OR COALESCE(ut.confirmations, 0) > 0)`;
const WINDOW = `INTERVAL '${UNPAID_AFTER_MINUTES} minutes'`;
const CONFIRMING = `(ut.status IN ('processing', 'confirmed') OR (ut.status = 'pending' AND ${DETECTED}))`;
const AWAITING = `(ut.status = 'pending' AND NOT ${DETECTED} AND ut."createdAt" > NOW() - ${WINDOW})`;
/** Live "pending / awaiting confirmation" — money detected/confirming or a fresh unpaid attempt. */
const PENDING = `(${CONFIRMING} OR ${AWAITING})`;

/** Settled volume + count + last activity (range) plus lifetime-paid & pending (all-time live). */
export const brandStats = (s: OverviewScope) =>
  one(
    `SELECT
       COALESCE(SUM(${NET_USD}) FILTER (WHERE ${IN_RANGE} AND ${PROCESSED_STATUS_SQL}), 0) AS settled_net,
       COUNT(*) FILTER (WHERE ${IN_RANGE} AND ${PROCESSED_STATUS_SQL}) AS settled_count,
       MAX(ut."updatedAt") FILTER (WHERE ${PROCESSED_STATUS_SQL}) AS last_paid_at,
       COUNT(*) FILTER (WHERE ${PROCESSED_STATUS_SQL}) AS lifetime_paid,
       COUNT(*) FILTER (WHERE ${PENDING}) AS pending_count,
       COALESCE(SUM(COALESCE(NULLIF(ut.usd_value, 0), ut.base_amount)) FILTER (WHERE ${PENDING}), 0) AS pending_usd_est
     ${fromClause(s)}`,
    s,
  );

/**
 * Needs-attention pieces for one brand — only the items the merchant can
 * actually see and act on inside the brand (so the Brands count reconciles
 * with the brand's own dashboard/payouts feed): stuck payouts (money settled
 * >2h ago, not forwarded, not in an active conversion, not acknowledged) and
 * configured-webhook failures in the last 24h. FAILED auto-conversions are NOT
 * counted here — by platform policy they alert admin/ops only and are hidden
 * from the merchant (conversionsNeedingAttention excludes them); any money left
 * stuck by a failed conversion is already captured by stuck_count. Uses scalar
 * subqueries so it's a single round-trip.
 */
export const brandAttention = (s: OverviewScope) =>
  one(
    `SELECT
       (SELECT COUNT(*) FROM tbl_user_transaction ut
          WHERE ut.user_id = :userId AND ut.company_id = :companyId
            AND ${PROCESSED_STATUS_SQL}
            AND NULLIF(ut.outgoing_tx_hash, '') IS NULL
            AND NOT EXISTS (SELECT 1 FROM tbl_stablecoin_conversion sc
                            WHERE sc.transaction_id = ut.transaction_id AND UPPER(sc.status::text) = 'COMPLETED')
            AND NOT EXISTS (SELECT 1 FROM tbl_stablecoin_conversion sc
                            WHERE sc.transaction_id = ut.transaction_id AND UPPER(sc.status::text) NOT IN ('COMPLETED', 'FAILED'))
            AND ut."updatedAt" < NOW() - INTERVAL '2 hours'
            AND ut.attention_resolved_at IS NULL
       ) AS stuck_count,
       (SELECT COUNT(*) FROM tbl_webhook_delivery_log wl
          JOIN tbl_company co ON co.company_id = wl.company_id
          WHERE wl.company_id = :companyId
            AND wl.created_at > NOW() - INTERVAL '24 hours'
            AND wl.status = 'failed'
            AND co.webhook_url IS NOT NULL AND co.webhook_url <> ''
            AND wl.webhook_url = co.webhook_url
            AND COALESCE(co.webhook_disabled, false) = false) AS webhook_failed`,
    s,
  );
