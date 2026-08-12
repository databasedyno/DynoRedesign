/**
 * transactionSource.ts — single source of truth for classifying WHERE a
 * transaction came from, used by every surface that lists transactions
 * (wallet/getAllTransactions -> /transactions page, company/getTransactions,
 * and dashboard/getRecentTransactions).
 *
 * Before this helper each surface derived "source" differently:
 *   - /transactions used relational data (link_id / order_id / link_type)
 *     and produced a rich {type,title} object, but had NO "api" concept
 *     (API payments looked like "direct").
 *   - the dashboard used a raw SQL CASE on the customer email pattern and
 *     produced a plain string with a DIFFERENT taxonomy (legacy_api/checkout,
 *     no tip/product/donation).
 *
 * Now all three call resolveTransactionSource() so a given transaction is
 * classified identically everywhere.
 *
 * Canonical activity taxonomy (the exact activity that produced the payment):
 *   payment_link  — a hosted Dynopay payment link ("Payment Link")
 *   api           — accepted via the merchant REST API / publishable-key
 *                   buy-button / elements ("API")
 *   tip           — a tip-jar contribution ("Tip")
 *   product       — a store / product-catalog order ("Store")
 *   contribution  — a donation / crowdfunding contribution ("Donation")
 *   direct        — a plain on-chain receive with no Dynopay object ("Direct")
 */

export type CanonicalTxSourceType =
  | "payment_link"
  | "api"
  | "tip"
  | "product"
  | "contribution"
  | "direct";

export interface TxSourceInput {
  source_order_id?: string | number | null;
  source_order_ref?: string | null;
  source_link_id?: string | number | null;
  source_link_type?: string | null;
  source_link_title?: string | null;
  source_parent_link_id?: string | number | null;
  source_parent_title?: string | null;
  source_parent_is_tip_jar?: boolean | number | null;
  /** Customer email — used ONLY as the fallback signal for API payments. */
  customer_email?: string | null;
}

export interface TxSource {
  type: CanonicalTxSourceType;
  title: string | null;
  ref: string | number | null;
  link_id: number | null;
  link_type: string | null;
  parent_link_id: number | null;
  order_id: number | null;
  order_ref: string | null;
}

/**
 * API-originated payments never have a real customer email, so the backend
 * mints a synthetic placeholder on the @dynopay.internal (or .local) domain:
 *   - legacy-api-…    (legacyApiAuthMiddleware)
 *   - pk-buyer-…      (publishable-key buy-buttons)
 *   - elements-buyer- (elements)
 *   - recovered-…     (merchantApi recovery)
 * Any of these => the payment came through the API, not a hosted link.
 */
export const isApiBuyerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const e = String(email).toLowerCase();
  return (
    e.endsWith("@dynopay.internal") ||
    e.endsWith("@dynopay.local") ||
    e.startsWith("legacy-api-") ||
    e.startsWith("pk-buyer-") ||
    e.startsWith("elements-buyer-") ||
    e.startsWith("recovered-")
  );
};

/**
 * Resolve the canonical source object for a transaction. Precedence:
 *   product order > tip/contribution link > payment link > API > direct
 */
export const resolveTransactionSource = (input: TxSourceInput): TxSource => {
  const {
    source_order_id,
    source_order_ref,
    source_link_id,
    source_link_type,
    source_link_title,
    source_parent_link_id,
    source_parent_title,
    source_parent_is_tip_jar,
    customer_email,
  } = input;

  let type: CanonicalTxSourceType = "direct";
  let title: string | null = null;
  let ref: string | number | null = null;

  if (source_order_id) {
    type = "product";
    title = source_link_title ? String(source_link_title) : "Store order";
    ref = String(source_order_ref || source_order_id);
  } else if (source_link_type === "contribution") {
    if (source_parent_is_tip_jar) {
      type = "tip";
      title = source_parent_title ? String(source_parent_title) : "Tip";
    } else {
      type = "contribution";
      title = source_parent_title ? String(source_parent_title) : "Donation";
    }
    ref = source_parent_link_id
      ? Number(source_parent_link_id)
      : source_link_id
        ? Number(source_link_id)
        : null;
  } else if (source_link_id) {
    type = "payment_link";
    title = source_link_title ? String(source_link_title) : null;
    ref = Number(source_link_id);
  } else if (isApiBuyerEmail(customer_email)) {
    type = "api";
    title = "API payment";
  }

  return {
    type,
    title,
    ref,
    link_id: source_link_id ? Number(source_link_id) : null,
    link_type: source_link_type ? String(source_link_type) : null,
    parent_link_id: source_parent_link_id ? Number(source_parent_link_id) : null,
    order_id: source_order_id ? Number(source_order_id) : null,
    order_ref: source_order_ref ? String(source_order_ref) : null,
  };
};

export default resolveTransactionSource;
