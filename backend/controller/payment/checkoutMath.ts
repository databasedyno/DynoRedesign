import { D, MoneyInput, div, roundTo, splitFee } from "../../utils/money";

export interface CheckoutSplitInput {
  /** Total crypto the quote is based on (base + tax converted at the live rate). */
  totalCrypto: MoneyInput;
  /** Base amount in the merchant's pricing currency, before tax. */
  baseAmount: MoneyInput;
  /** Tax amount in the merchant's pricing currency (0 when no tax). */
  taxAmount: MoneyInput;
  /** Platform fee as a fraction of the base (USD fee ÷ USD base), e.g. 0.0165. */
  feeFraction: MoneyInput;
  feePayer: "customer" | "company";
  dp?: number;
}

export interface CheckoutSplit {
  /** What the customer must send. */
  cryptoAmount: number;
  /** What the merchant is credited (base after fees if they pay, plus all tax). */
  merchantAmount: number;
  /** Platform fee swept from the temp address. */
  feesAmount: number;
  /** Tax portion (always goes to the merchant). */
  taxAmount: number;
  baseAmount: number;
}

/**
 * Exact checkout split. Invariants (at `dp` decimals):
 *   merchantAmount + feesAmount === cryptoAmount   (no sub-unit residue)
 *   merchant side is rounded DOWN, the fee absorbs the remainder
 *   tax is the exact complement of the base share of the total
 */
export const computeCheckoutSplit = (i: CheckoutSplitInput): CheckoutSplit => {
  const dp = i.dp ?? 8;
  const totalD = D(i.totalCrypto);
  const tax = D(i.taxAmount);
  const totalFiat = D(i.baseAmount).plus(tax);
  // Tax share rounded to dp; base is its exact complement so base + tax === total.
  const taxD = tax.gt(0) && totalFiat.gt(0) ? roundTo(totalD.times(div(tax, totalFiat)), dp) : D(0);
  const baseD = totalD.minus(taxD);
  const feeFraction = D(i.feeFraction);

  if (i.feePayer === "customer") {
    const feesD = roundTo(baseD.times(feeFraction), dp);
    const merchantD = roundTo(baseD.plus(taxD), dp);
    return {
      cryptoAmount: merchantD.plus(feesD).toNumber(),
      merchantAmount: merchantD.toNumber(),
      feesAmount: feesD.toNumber(),
      taxAmount: taxD.toNumber(),
      baseAmount: baseD.toNumber(),
    };
  }

  const cryptoD = roundTo(totalD, dp);
  const merchantD = roundTo(cryptoD.minus(baseD.times(feeFraction)), dp, "down");
  return {
    cryptoAmount: cryptoD.toNumber(),
    merchantAmount: merchantD.toNumber(),
    feesAmount: cryptoD.minus(merchantD).toNumber(),
    taxAmount: taxD.toNumber(),
    baseAmount: baseD.toNumber(),
  };
};

/** Fallback when the fee service is unavailable: flat percent, merchant rounded down. */
export const computeFallbackSplit = (cryptoAmount: MoneyInput, feePercent: MoneyInput, dp: number = 8): Pick<CheckoutSplit, "merchantAmount" | "feesAmount"> => {
  const s = splitFee(cryptoAmount, feePercent, 0, dp);
  return { merchantAmount: s.net.toNumber(), feesAmount: s.fee.toNumber() };
};
