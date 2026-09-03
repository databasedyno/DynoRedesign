import { toNumber } from "../../../utils/money";
import { formatCryptoAmount } from "../../../utils/currencyUtils";

export interface SettledBreakdown {
  merchantAmount: number;
  feeAmount: number;
  feePayer: "customer" | "company";
  currency: string;
}

export interface BreakdownDisplay {
  merchantReceives: string;
  platformFee: string;
  feePayer: "customer" | "company";
}

/** Exact merchant/fee split for a payment: settled figures first, the planned addPayment split as fallback. */
export const resolveSettledBreakdown = (
  tempData: Record<string, unknown> | null | undefined,
  currency: string
): SettledBreakdown | null => {
  if (!tempData) return null;
  const settledMerchant = Number(tempData.settled_merchant_amount);
  const settledFee = Number(tempData.settled_fee_amount);
  const useSettled = Number.isFinite(settledMerchant) && settledMerchant > 0 && Number.isFinite(settledFee) && settledFee >= 0;
  const merchantAmount = useSettled ? settledMerchant : Number(tempData.merchant_amount);
  const feeAmount = useSettled ? settledFee : Number(tempData.total_fees);
  if (!Number.isFinite(merchantAmount) || merchantAmount <= 0 || !Number.isFinite(feeAmount) || feeAmount < 0) return null;
  return {
    merchantAmount: toNumber(merchantAmount, 8),
    feeAmount: toNumber(feeAmount, 8),
    feePayer: tempData.fee_payer === "customer" ? "customer" : "company",
    currency,
  };
};

export const formatBreakdown = (b: SettledBreakdown | null): BreakdownDisplay | undefined =>
  b
    ? {
        merchantReceives: `${formatCryptoAmount(b.merchantAmount, b.currency)} ${b.currency}`,
        platformFee: `${formatCryptoAmount(b.feeAmount, b.currency)} ${b.currency}`,
        feePayer: b.feePayer,
      }
    : undefined;
