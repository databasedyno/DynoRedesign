/**
 * Order minimums — the single source of truth for the "minimum order amount"
 * that was previously three contradicting hard-coded numbers (store $10, API $5,
 * buy-button $5, payment-link $1). Consolidated here and made per-brand
 * configurable.
 *
 * TWO layers:
 *   1. SURFACE_DEFAULT_MIN_USD — the platform default per surface (env-tunable).
 *      These replace the scattered magic numbers so the surfaces stop disagreeing.
 *   2. tbl_company.min_order_usd — a per-brand floor a merchant can RAISE above
 *      the default (never below). Enforced universally at pay time in
 *      controller/payment/cryptoCheckout.ts (createCryptoPayment) and surfaced to
 *      the checkout UI so un-payable coins/amounts are greyed up-front.
 *
 * This is distinct from services/checkout/checkoutMinimums.ts, which is the
 * per-COIN network/forwarding floor. The effective minimum a payer must clear is
 * max(perCoinMinimum, merchantMinOrder).
 */
import { toNumber } from "../../utils/money";
import sequelize from "../../utils/dbInstance";
import { QueryTypes } from "sequelize";

export type MinSurface = "store" | "api" | "buy_button" | "payment_link";

const num = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

/** Platform default minimum order (USD) per surface. */
export const SURFACE_DEFAULT_MIN_USD: Record<MinSurface, number> = {
  store: num(process.env.MIN_ORDER_STORE_USD, 10),
  api: num(process.env.MIN_ORDER_API_USD, 5),
  buy_button: num(process.env.MIN_ORDER_BUY_BUTTON_USD, 5),
  payment_link: num(process.env.MIN_ORDER_PAYMENT_LINK_USD, 1),
};

/** Bounds accepted for a merchant-set min_order_usd. */
export const MERCHANT_MIN_ORDER_BOUNDS = { min: 1, max: 100000 };

/** Normalize a stored/submitted value into a positive number, or null if unset. */
export function normalizeMerchantMin(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? toNumber(n, 2) : null;
}

const cache = new Map<number, { value: number; at: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * The merchant's per-brand minimum order (USD) for a company; 0 when unset or
 * unavailable. Cached 60s so hot checkout paths add no repeated DB reads.
 */
export async function getMerchantMinOrderUsdByCompanyId(
  companyId: number | string | null | undefined
): Promise<number> {
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) return 0;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  let value = 0;
  try {
    const rows = (await sequelize.query(
      `SELECT min_order_usd FROM tbl_company WHERE company_id = :id LIMIT 1`,
      { replacements: { id }, type: QueryTypes.SELECT }
    )) as Array<{ min_order_usd: unknown }>;
    value = normalizeMerchantMin(rows?.[0]?.min_order_usd) ?? 0;
  } catch {
    value = 0; // column missing / query error => no merchant floor (safe)
  }
  cache.set(id, { value, at: Date.now() });
  return value;
}

/** Effective creation-time minimum for a surface, raised by the merchant floor. */
export function getEffectiveMinOrderUsd(surface: MinSurface, merchantMinUsd = 0): number {
  return Math.max(SURFACE_DEFAULT_MIN_USD[surface] ?? 1, merchantMinUsd || 0);
}

/** Drop the cache entry after a merchant updates their setting. */
export function invalidateMerchantMinCache(companyId: number | string): void {
  cache.delete(Number(companyId));
}

export default {
  SURFACE_DEFAULT_MIN_USD,
  MERCHANT_MIN_ORDER_BOUNDS,
  normalizeMerchantMin,
  getMerchantMinOrderUsdByCompanyId,
  getEffectiveMinOrderUsd,
  invalidateMerchantMinCache,
};
