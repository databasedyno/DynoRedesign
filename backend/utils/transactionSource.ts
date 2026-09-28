/**
 * transactionSource.ts — single source of truth for classifying WHERE a
 * transaction came from, used by every surface that lists transactions
 * (wallet/getAllTransactions -> /transactions page, company/getTransactions,
 * and dashboard/getRecentTransactions).
 *
 * SafeDeal payments (escrow deal funding / wallet top-ups placed through the
 * Direct API by the SafeDeal brand) resolve to `safedeal`.
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

import { raw as envRaw } from "./config";


export type CanonicalTxSourceType =
  | "payment_link"
  | "api"
  | "tip"
  | "product"
  | "contribution"
  | "safedeal"
  | "direct";

/**
 * SafeDeal (escrow product on the Dynopay engine) funds deals and wallet top-ups
 * through the Direct API as its own brand — every such payment is a normal
 * tbl_user_transaction row keyed back to the deal (funding_link_transaction_id)
 * or the top-up (payment_id). Append these two fragments to a transaction query
 * aliased `ut` so the resolver can label the row "SafeDeal · Deal #N / Wallet top-up".
 */
export const SAFEDEAL_SOURCE_SELECT_SQL = `
        sd.escrow_id         as source_safedeal_escrow_id,
        sd.title             as source_safedeal_title,
        st.topup_id          as source_safedeal_topup_id,
        ut.company_id        as source_company_id`;
export const SAFEDEAL_SOURCE_JOIN_SQL = `
      LEFT JOIN tbl_escrow_deal sd ON sd.source = 'safedeal' AND sd.funding_link_transaction_id = ut.id
      LEFT JOIN tbl_safedeal_topup st ON st.payment_id = ut.id`;

const SAFEDEAL_COMPANY_ID = Number(envRaw("SAFEDEAL_COMPANY_ID")) || 0;

export interface TxSourceInput {
  source_safedeal_escrow_id?: string | number | null;
  source_safedeal_title?: string | null;
  source_safedeal_topup_id?: string | number | null;
  /** Owning brand — every payment on the SafeDeal brand is a SafeDeal payment. */
  source_company_id?: string | number | null;
  source_order_id?: string | number | null;
  source_order_ref?: string | null;
  source_link_id?: string | number | null;
  source_link_type?: string | null;
  source_link_title?: string | null;
  source_parent_link_id?: string | number | null;
  source_parent_title?: string | null;
  source_parent_is_tip_jar?: boolean | number | null;
  /** When the originating payment link was created (tbl_payment_link.createdAt). */
  source_link_created_at?: string | Date | null;
  /** Parent (tip jar / campaign) createdAt — a contribution row's own link is a per-payment child. */
  source_parent_link_created_at?: string | Date | null;
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
  /** ISO timestamp of when the originating payment link was created (null if not link-backed). */
  link_created_at: string | null;
}

/**
 * API-originated payments never have a real customer email, so the backend
 * mints a synthetic placeholder on the @dynopay.internal (or .local) domain:
 *   - legacy-api-…    (legacyApiAuthMiddleware)
 *   - pk-buyer-…      (publishable-key buy-buttons)
 *   - elements-buyer- (elements)
 *   - recovered-…     (merchantApi recovery)
 * Any of these => the payment came through the API, not a hosted link.
 *
 * `isPlaceholderBuyerEmail` is the single source of truth for "this is NOT a
 * real, buyer-supplied email" — used by every merchant/admin-facing surface so
 * a synthetic address (e.g. `buyer@nameword.local`) is never shown as if the
 * buyer typed it. It is a SUPERSET of the api-buyer check: it also treats ANY
 * `*.local` domain (any brand slug, not just dynopay.local) and an empty value
 * as "no real email". Show "No email provided" instead.
 */
const PLACEHOLDER_EMAIL_PREFIXES = [
  "legacy-api-",
  "pk-buyer-",
  "elements-buyer-",
  "recovered-",
];

export const isPlaceholderBuyerEmail = (email?: string | null): boolean => {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return true; // no email at all is, by definition, not provided
  // `.local` is a reserved non-public TLD — any @something.local address is a
  // synthesised placeholder (covers @dynopay.local AND @<brand-slug>.local).
  if (e.endsWith(".local")) return true;
  if (e.endsWith("@dynopay.internal")) return true;
  return PLACEHOLDER_EMAIL_PREFIXES.some((p) => e.startsWith(p));
};

export const isApiBuyerEmail = (email?: string | null): boolean => {
  if (!email) return false; // preserve original semantics: empty ≠ "api"
  return isPlaceholderBuyerEmail(email);
};

/**
 * True when `email` is a usable, buyer-supplied address we can send a receipt
 * to — i.e. it looks like an email AND is not one of our synthetic placeholders
 * (`*.local`, `@dynopay.internal`, `legacy-api-…`, etc). Callers use this to
 * decide whether to attach a REAL customer (receipt goes out, merchant sees the
 * address) or fall back to the placeholder. Invalid input returns false so the
 * caller can fall back gracefully — never throw / never block a payment.
 */
export const isValidBuyerEmail = (email?: string | null): boolean => {
  const e = String(email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  return !isPlaceholderBuyerEmail(e);
};

/**
 * Resolve the canonical source object for a transaction. Precedence:
 *   product order > tip/contribution link > payment link > API > direct
 */
export const resolveTransactionSource = (input: TxSourceInput): TxSource => {
  const {
    source_safedeal_escrow_id,
    source_safedeal_title,
    source_safedeal_topup_id,
    source_company_id,
    source_order_id,
    source_order_ref,
    source_link_id,
    source_link_type,
    source_link_title,
    source_parent_link_id,
    source_parent_title,
    source_parent_is_tip_jar,
    source_link_created_at,
    source_parent_link_created_at,
    customer_email,
  } = input;

  const toIso = (v: string | Date | null | undefined): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  let type: CanonicalTxSourceType = "direct";
  let title: string | null = null;
  let ref: string | number | null = null;
  let link_created_at: string | null = toIso(source_link_created_at);

  if (source_safedeal_escrow_id) {
    type = "safedeal";
    const dealTitle = String(source_safedeal_title || "").trim();
    title = `Deal #${source_safedeal_escrow_id}${dealTitle ? ` — ${dealTitle}` : ""}`;
    ref = Number(source_safedeal_escrow_id);
  } else if (source_safedeal_topup_id) {
    type = "safedeal";
    title = "Wallet top-up";
    ref = `DEP-${source_safedeal_topup_id}`;
  } else if (SAFEDEAL_COMPANY_ID && Number(source_company_id) === SAFEDEAL_COMPANY_ID) {
    // A payment on the SafeDeal brand whose deal/top-up row no longer exists.
    type = "safedeal";
  } else if (source_order_id) {
    type = "product";
    title = source_link_title ? String(source_link_title) : "Store order";
    ref = String(source_order_ref || source_order_id);
  } else if (source_link_type === "contribution") {
    // The contribution row's own link is a per-payment child created at checkout;
    // "when was the tip jar / campaign created" is the PARENT link's createdAt.
    if (source_parent_link_id) link_created_at = toIso(source_parent_link_created_at);
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
    // No redundant title — the badge label already reads "API". A generic
    // "API payment" title only produced the rough "API · API payment" render.
    title = null;
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
    link_created_at,
  };
};

export default resolveTransactionSource;
