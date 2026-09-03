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

export interface InclusiveSplitInput {
  /** Crypto the customer will send — already includes the fee when the customer pays it. */
  cryptoAmount: MoneyInput;
  baseAmount: MoneyInput;
  taxAmount: MoneyInput;
  /** Dynopay platform (tier) fee in the same fiat unit as base/tax (USD). */
  feeFiat: MoneyInput;
  /**
   * Network-fee buffer quoted to the customer (customer-pays only). It travels
   * WITH the merchant share because the on-chain forwarding cost is deducted
   * from the merchant transfer — so the merchant nets base + tax after gas.
   */
  networkFeeFiat?: MoneyInput;
  feePayer: "customer" | "company";
  dp?: number;
}

/**
 * Exact split when the quoted crypto amount is already final (hosted checkout addPayment).
 * Invariant at `dp`: merchantAmount + feesAmount === cryptoAmount; fee absorbs the rounding residue.
 *   customer pays → merchant gets the (base + tax + network buffer) share, Dynopay fee is the complement
 *   company pays  → fee = base share × fee fraction (tax passes through), merchant is the complement
 */
export const computeInclusiveSplit = (i: InclusiveSplitInput): Pick<CheckoutSplit, "cryptoAmount" | "merchantAmount" | "feesAmount" | "taxAmount"> => {
  const dp = i.dp ?? 8;
  const cryptoD = roundTo(i.cryptoAmount, dp);
  const base = D(i.baseAmount);
  const tax = D(i.taxAmount);
  const fee = D(i.feeFiat);
  const network = i.feePayer === "customer" ? D(i.networkFeeFiat ?? 0) : D(0);
  const baseWithTax = base.plus(tax);
  const customerTotalFiat = i.feePayer === "customer" ? baseWithTax.plus(fee).plus(network) : baseWithTax;
  const taxD = tax.gt(0) && customerTotalFiat.gt(0) ? roundTo(cryptoD.times(div(tax, customerTotalFiat)), dp) : D(0);

  if (i.feePayer === "customer") {
    const merchantShare = baseWithTax.plus(network);
    const merchantD = customerTotalFiat.gt(0) ? roundTo(cryptoD.times(div(merchantShare, customerTotalFiat)), dp, "down") : cryptoD;
    return { cryptoAmount: cryptoD.toNumber(), merchantAmount: merchantD.toNumber(), feesAmount: cryptoD.minus(merchantD).toNumber(), taxAmount: taxD.toNumber() };
  }

  const baseCryptoD = cryptoD.minus(taxD);
  const feeFraction = base.gt(0) ? div(fee, base) : D(0);
  const feesD = roundTo(baseCryptoD.times(feeFraction), dp, "up");
  const merchantD = cryptoD.minus(feesD);
  return { cryptoAmount: cryptoD.toNumber(), merchantAmount: merchantD.toNumber(), feesAmount: feesD.toNumber(), taxAmount: taxD.toNumber() };
};
