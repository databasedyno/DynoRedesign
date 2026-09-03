/**
 * transactionDisplayStatus — read-time "unpaid" derivation for transaction rows.
 *
 * A tbl_user_transaction row is created with status='pending' the moment a
 * customer generates a deposit address at checkout. If they never send funds
 * the row stays 'pending' FOREVER (there is no expiry job — and background
 * jobs are disabled on secondary instances anyway).
 *
 * Instead of mutating the DB, every read surface (dashboard recent
 * transactions, /transactions page, CSV export) derives a display status:
 * a 'pending' row older than the payment window is shown as 'unpaid'.
 * If a late payment ever settles, the settlement flow overwrites the real
 * status ('successful') and the row naturally stops being 'unpaid'.
 *
 * IMPORTANT: getDashboard's pending_count and action-counts'
 * transactions_pending MUST both use FRESH_PENDING_SQL so the two badges
 * can never disagree (parity is asserted by the test suite).
 */

/** Minutes after which a still-'pending' payment attempt is shown as unpaid.
 *  Matches the longest checkout payment window (cart links expire at 60 min;
 *  address-level payment windows are 30–60 min). */
export const UNPAID_AFTER_MINUTES = 60;

/** SQL fragment (alias `ut`) — a pending row still inside its payment window. */
export const FRESH_PENDING_SQL = `(ut.status = 'pending' AND ut."createdAt" > NOW() - INTERVAL '${UNPAID_AFTER_MINUTES} minutes')`;

/**
 * Derive the display status for a transaction row.
 * Non-pending statuses pass through untouched.
 *
 * `paymentDetected` (optional) tells us whether ANY on-chain payment has been
 * seen for this row (an incoming tx hash, ≥1 confirmation, or a settled USD
 * value). It disambiguates the two very different "pending" cases a merchant
 * used to see identically:
 *   - detected  → a real payment is confirming            → stays 'pending'
 *   - NOT detected, still fresh → nothing has arrived yet  → 'awaiting_payment'
 *   - NOT detected, window passed → buyer never paid       → 'unpaid'
 * When the caller omits the flag we keep the legacy behaviour (fresh→pending,
 * stale→unpaid) so surfaces that don't fetch the signal are unaffected.
 */
export function deriveTxDisplayStatus(
  status: unknown,
  createdAt: unknown,
  paymentDetected?: boolean
): string {
  const s = String(status ?? "");
  if (s.toLowerCase().trim() !== "pending") return s;
  // A detected payment is genuinely mid-confirmation — never downgrade it.
  if (paymentDetected === true) return s;
  const created = createdAt ? new Date(createdAt as string | Date).getTime() : NaN;
  const stale =
    Number.isFinite(created) && Date.now() - created > UNPAID_AFTER_MINUTES * 60 * 1000;
  if (stale) return "unpaid";
  // Fresh + explicitly-known no payment → "awaiting payment". Without the
  // signal (undefined) we can't tell, so preserve the legacy 'pending' label.
  return paymentDetected === false ? "awaiting_payment" : s;
}

/** UI status buckets — mirrors the /transactions page normaliser
 *  (Components/Page/Transactions/index.tsx) so a status chip + Export yields
 *  exactly the rows the merchant is looking at. */
export const TX_STATUS_BUCKETS = [
  "settled",
  "confirmed",
  "processing",
  "pending",
  "awaiting_payment",
  "unpaid",
  "failed",
] as const;
export type TxStatusBucket = (typeof TX_STATUS_BUCKETS)[number];

const SETTLED_RAW = ["success", "successful", "completed", "payout_complete", "converted", "recovered", "done", "settled"];
const FAILED_RAW = ["failed", "expired", "refunded", "settlement_failed"];

export function isTxStatusBucket(v: unknown): v is TxStatusBucket {
  return typeof v === "string" && (TX_STATUS_BUCKETS as readonly string[]).includes(v);
}

/** Collapse a raw/derived status string into its UI bucket. */
export function toTxStatusBucket(displayStatus: unknown): TxStatusBucket {
  const s = String(displayStatus ?? "").toLowerCase().trim();
  if (SETTLED_RAW.includes(s)) return "settled";
  if (s === "confirmed") return "confirmed";
  if (s === "processing") return "processing";
  if (s === "unpaid") return "unpaid";
  if (s === "awaiting_payment" || s === "awaiting") return "awaiting_payment";
  if (FAILED_RAW.includes(s)) return "failed";
  return "pending";
}

/** Raw DB statuses that can resolve to a bucket (cheap SQL pre-filter).
 *  null = no safe pre-filter ('pending' is the catch-all) — rely on the JS post-filter. */
export function rawStatusesForBucket(bucket: TxStatusBucket): string[] | null {
  switch (bucket) {
    case "settled":
      return SETTLED_RAW;
    case "confirmed":
      return ["confirmed"];
    case "processing":
      return ["processing"];
    case "failed":
      return FAILED_RAW;
    case "awaiting_payment":
    case "unpaid":
      return ["pending"];
    default:
      return null;
  }
}

/**
 * Has any on-chain payment been observed for this transaction row? Used to
 * pick between 'pending' (confirming) and 'awaiting_payment' (nothing yet).
 * A non-empty incoming tx hash, ≥1 confirmation, or a positive settled USD
 * value all count as detected. `crypto_amount` is intentionally ignored — it
 * is the EXPECTED (quoted) amount set at address generation, not a receipt.
 */
export function isPaymentDetected(row: {
  incoming_tx_hash?: unknown;
  confirmations?: unknown;
  usd_value?: unknown;
}): boolean {
  const hash = row?.incoming_tx_hash;
  if (hash != null && String(hash).trim() !== "") return true;
  if (Number(row?.confirmations) > 0) return true;
  if (Number(row?.usd_value) > 0) return true;
  return false;
}
