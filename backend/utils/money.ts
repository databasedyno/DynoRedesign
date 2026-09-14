import Decimal from "decimal.js";

/**
 * Exact money arithmetic for DynoPay.
 *
 * Every amount that is stored, transmitted on-chain, shown to a merchant or
 * used in a fee split must go through here instead of raw float math
 * (`0.1 + 0.2`, `amount * pct / 100`, `parseFloat(x.toFixed(8))`).
 *
 * Conventions
 *  - Inputs may be number | string | Decimal | null | undefined. Garbage → 0.
 *  - Intermediate math stays a Decimal; only round at the boundary.
 *  - Fiat is 2 dp, crypto amounts 8 dp unless the asset says otherwise.
 *  - When splitting a payment, the MERCHANT side is rounded DOWN and the fee
 *    takes the remainder, so we never pay out more than was received.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -40, toExpPos: 40 });

export type MoneyInput = Decimal.Value | null | undefined;

export const FIAT_DP = 2;
export const CRYPTO_DP = 8;

/** Coerce anything amount-like into a Decimal. NaN/Infinity/empty → 0. */
export const D = (v: MoneyInput): Decimal => {
  if (v instanceof Decimal) return v;
  if (v === null || v === undefined || v === "") return new Decimal(0);
  if (typeof v === "number") return Number.isFinite(v) ? new Decimal(v) : new Decimal(0);
  const s = String(v).trim().replace(/,/g, "");
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return new Decimal(0);
  return new Decimal(s);
};

export const add = (a: MoneyInput, b: MoneyInput): Decimal => D(a).plus(D(b));
export const sub = (a: MoneyInput, b: MoneyInput): Decimal => D(a).minus(D(b));
export const mul = (a: MoneyInput, b: MoneyInput): Decimal => D(a).times(D(b));
/** Division by zero yields 0 instead of Infinity/NaN poisoning downstream math. */
export const div = (a: MoneyInput, b: MoneyInput): Decimal => {
  const divisor = D(b);
  return divisor.isZero() ? new Decimal(0) : D(a).div(divisor);
};
export const sum = (values: Iterable<MoneyInput>): Decimal => {
  let acc = new Decimal(0);
  for (const v of values) acc = acc.plus(D(v));
  return acc;
};
/** `percent` is a human percentage (1.5 → 1.5%). */
export const pct = (amount: MoneyInput, percent: MoneyInput): Decimal => D(amount).times(D(percent)).div(100);

export type RoundMode = "half-up" | "down" | "up";
const MODES: Record<RoundMode, Decimal.Rounding> = {
  "half-up": Decimal.ROUND_HALF_UP,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
};

export const roundTo = (v: MoneyInput, dp: number, mode: RoundMode = "half-up"): Decimal =>
  D(v).toDecimalPlaces(dp, MODES[mode]);

/** Rounded JS number — for JSON payloads and numeric DB columns. */
export const toNumber = (v: MoneyInput, dp: number, mode: RoundMode = "half-up"): number =>
  roundTo(v, dp, mode).toNumber();

/** Fixed-point string with exactly `dp` decimals, never exponent notation (on-chain APIs, PDFs). */
export const toFixedStr = (v: MoneyInput, dp: number, mode: RoundMode = "half-up"): string =>
  roundTo(v, dp, mode).toFixed(dp);

/** Shortest exact string (trailing zeros trimmed) — Tatum transfer amounts. */
export const toAmountStr = (v: MoneyInput, dp: number = CRYPTO_DP, mode: RoundMode = "down"): string =>
  roundTo(v, dp, mode).toString();

export const fiat = (v: MoneyInput): number => toNumber(v, FIAT_DP);
export const crypto = (v: MoneyInput, dp: number = CRYPTO_DP): number => toNumber(v, dp);

/** Whole satoshi/base units for UTXO chains (exact, no `Math.round(x * 1e8)` drift). */
export const toBaseUnits = (v: MoneyInput, decimals: number = 8): bigint =>
  BigInt(D(v).times(new Decimal(10).pow(decimals)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
export const fromBaseUnits = (units: bigint | number | string, decimals: number = 8): Decimal =>
  D(String(units)).div(new Decimal(10).pow(decimals));

export const isZero = (v: MoneyInput): boolean => D(v).isZero();
export const gt = (a: MoneyInput, b: MoneyInput): boolean => D(a).gt(D(b));
export const gte = (a: MoneyInput, b: MoneyInput): boolean => D(a).gte(D(b));
export const lt = (a: MoneyInput, b: MoneyInput): boolean => D(a).lt(D(b));
export const lte = (a: MoneyInput, b: MoneyInput): boolean => D(a).lte(D(b));
export const eq = (a: MoneyInput, b: MoneyInput, dp?: number): boolean =>
  dp === undefined ? D(a).eq(D(b)) : roundTo(a, dp).eq(roundTo(b, dp));
export const max = (a: MoneyInput, b: MoneyInput): Decimal => Decimal.max(D(a), D(b));
export const min = (a: MoneyInput, b: MoneyInput): Decimal => Decimal.min(D(a), D(b));

export interface FeeSplit {
  /** Amount the merchant receives (rounded DOWN to `dp`). */
  net: Decimal;
  /** Platform take = gross − net; absorbs the sub-unit remainder. */
  fee: Decimal;
  /** Fee before rounding adjustments (percent + fixed), for reporting. */
  nominalFee: Decimal;
}

/**
 * Split a gross amount into merchant net + platform fee.
 * `percent` is a percentage (e.g. 1.5), `fixed` is in the same unit as `gross`.
 * Guarantees: net + fee === gross exactly, net ≥ 0, fee ≥ 0.
 */
export const splitFee = (gross: MoneyInput, percent: MoneyInput, fixed: MoneyInput = 0, dp: number = CRYPTO_DP): FeeSplit => {
  const g = D(gross);
  const nominalFee = Decimal.max(new Decimal(0), pct(g, percent).plus(D(fixed)));
  const net = Decimal.max(new Decimal(0), g.minus(nominalFee).toDecimalPlaces(dp, Decimal.ROUND_DOWN));
  return { net, fee: g.minus(net), nominalFee };
};

/** Convert an amount by a rate (e.g. fiat → crypto), rounded down to `dp` so we never over-quote. */
export const convert = (amount: MoneyInput, rate: MoneyInput, dp: number, mode: RoundMode = "half-up"): Decimal =>
  roundTo(D(amount).times(D(rate)), dp, mode);

export { Decimal };
