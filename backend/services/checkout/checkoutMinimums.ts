/**
 * Checkout minimums — single source of truth for the per-coin "minimum amount we
 * can economically accept on-chain".
 *
 * WHY THIS EXISTS
 * ---------------
 * At settlement (controller/payment/settlement/chainVerification.ts) a payment
 * whose received USD is below the chain's forwarding threshold is credited 100%
 * to the DynoPay admin wallet — the merchant receives nothing. On top of that,
 * the platform fee ($1 fixed + 1.5%) is taken from the payment. So a small order
 * on an EXPENSIVE network (e.g. USDT-TRC20 / ERC-20) can leave the merchant with
 * a trivial or zero net, or silently disappear.
 *
 * MODEL (founder decision 2026-09-13):
 *   • Source of the per-coin floor N(coin) = the LIVE network fee for that chain
 *     (services/blockchainFeeService.getBlockchainNetworkFee -> feeInUSD), so the
 *     minimum reflects the REAL cost per chain (TRC-20/ERC-20 » XRP).
 *   • N(coin) = ceil( liveFeeUSD × CHECKOUT_MIN_FEE_MULTIPLE ), floored at $1.
 *     The ~2× multiple matches the existing static sweep floors ("~2× typical
 *     gas per chain"). The checkout minimum IS N(coin); the platform fee comes
 *     out of it (the payer is simply not offered a coin below N).
 *   • FALLBACK: if the live fee is unavailable (0 / lookup fails), use the static
 *     per-chain sweep floor (merchantPoolConfig.getMinSweepUSD: $10 token / $5
 *     native / $2 cheap) so checkout NEVER blocks on a bad lookup.
 *
 * This module changes NO fund routing; it only decides which coins the checkout
 * offers and the minimum it shows the payer.
 */
import { getBlockchainNetworkFee } from "../blockchainFeeService";
import { getMinSweepUSD } from "../merchantPool/merchantPoolConfig";
import { cronLogger } from "../../utils/loggers";

/**
 * Display currencies shown on the checkout map onto the internal wallet_type
 * the fee service / settlement understand. Keep aligned with the alias map in
 * controller/payment/cryptoCheckout.ts (createCryptoPayment).
 */
const DISPLAY_TO_INTERNAL: Record<string, string> = {
  USDC: "USDC-ERC20",
  "RLUSD-XRPL": "RLUSD",
};

/** Absolute floor so a coin never reports a $0 minimum. */
export const SAFETY_FLOOR_USD = 1;

/** Multiple applied to the live network fee to get a "worth-forwarding" floor. */
const FEE_MULTIPLE = (() => {
  const v = Number(process.env.CHECKOUT_MIN_FEE_MULTIPLE);
  return Number.isFinite(v) && v > 0 ? v : 2;
})();

/** Short in-memory cache so a hot checkout path never recomputes per request. */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: number; at: number }>();

/** Resolve the internal wallet_type used by settlement for a display coin. */
export function toInternalCurrency(currency: string): string {
  return DISPLAY_TO_INTERNAL[currency] || currency;
}

function roundUpDollar(n: number): number {
  return Math.max(SAFETY_FLOOR_USD, Math.ceil(n));
}

/** Static per-chain floor used when the live fee is unavailable. */
function staticFloor(internal: string): number {
  const s = Number(getMinSweepUSD(internal));
  return Number.isFinite(s) && s > 0 ? Math.max(s, SAFETY_FLOOR_USD) : SAFETY_FLOOR_USD;
}

/**
 * Minimum USD an order must be worth to be offered in `currency`.
 * Live-fee driven with a static fallback; cached for CACHE_TTL_MS.
 */
export async function getCoinMinimumUsd(currency: string): Promise<number> {
  if (!currency) return SAFETY_FLOOR_USD;
  const internal = toInternalCurrency(currency);

  const hit = cache.get(internal);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let min: number;
  try {
    const { feeInUSD } = await getBlockchainNetworkFee(internal, "fast");
    const live = Number(feeInUSD);
    min = Number.isFinite(live) && live > 0 ? roundUpDollar(live * FEE_MULTIPLE) : staticFloor(internal);
  } catch (e) {
    min = staticFloor(internal);
    cronLogger.info(`[checkoutMinimums] live fee unavailable for ${internal}; static floor $${min} (${(e as Error)?.message || e})`);
  }
  cache.set(internal, { value: min, at: Date.now() });
  return min;
}

/** Per-coin minimums for a list of display currencies (for the checkout UI). */
export async function getCoinMinimumsUsd(currencies: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const list = (currencies || []).filter(Boolean);
  await Promise.all(list.map(async (c) => { out[c] = await getCoinMinimumUsd(c); }));
  return out;
}

/**
 * The smallest order payable with AT LEAST ONE available coin (= cheapest coin's
 * minimum). Below this, no coin can be offered.
 */
export async function getOrderMinimumUsd(currencies: string[]): Promise<number> {
  const list = (currencies || []).filter(Boolean);
  if (list.length === 0) return SAFETY_FLOOR_USD;
  const mins = await Promise.all(list.map(getCoinMinimumUsd));
  return Math.min(...mins);
}

export default {
  SAFETY_FLOOR_USD,
  toInternalCurrency,
  getCoinMinimumUsd,
  getCoinMinimumsUsd,
  getOrderMinimumUsd,
};
