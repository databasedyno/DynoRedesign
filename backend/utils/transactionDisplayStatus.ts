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
 */
export function deriveTxDisplayStatus(
  status: unknown,
  createdAt: unknown
): string {
  const s = String(status ?? "");
  if (s.toLowerCase().trim() !== "pending") return s;
  if (!createdAt) return s;
  const created = new Date(createdAt as string | Date).getTime();
  if (!Number.isFinite(created)) return s;
  const ageMs = Date.now() - created;
  return ageMs > UNPAID_AFTER_MINUTES * 60 * 1000 ? "unpaid" : s;
}
