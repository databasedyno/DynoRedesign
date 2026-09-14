/**
 * Shared "payment" resource object (API Architecture Review §5.3.1).
 *
 * Every create/retrieve endpoint returns the SAME first-class object so a
 * client no longer has to parse the id out of a URL or reconcile two different
 * shapes. This is ADDITIVE — it is embedded as `data.payment` alongside the
 * existing top-level fields, so no existing integration needs to change.
 *
 * Convention (owner decision 2026-06): fiat amounts are JSON numbers; crypto
 * amounts are STRINGS (up to 8dp, trailing zeros trimmed) to avoid float drift
 * in dynamically-typed clients — matching Coinbase/BitPay.
 */

const cryptoAmountStr = (v: number | string | null | undefined): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return null;
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
};

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

const isoOrNull = (v: string | Date | null | undefined): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export interface PaymentObjectInput {
  id: string;
  /** External status enum: waiting|pending|confirmed|processing|settled|underpaid|failed|expired|refunded */
  status: string;
  hostedUrl?: string | null;
  redirectUrl?: string | null;
  /** Fiat (base) amount + currency — the amount the merchant requested. */
  baseAmount?: number | string | null;
  baseCurrency?: string | null;
  cryptoAmount?: number | string | null;
  cryptoCurrency?: string | null;
  cryptoAddress?: string | null;
  destinationTag?: number | null;
  fee?: number | string | null;
  taxAmount?: number | string | null;
  expiresAt?: string | Date | null;
  metadata?: unknown;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  autoConverted?: boolean;
  autoConvert?: unknown;
}

/** All statuses the `payment.status` field can take (published in the spec). */
export const PAYMENT_STATUS_ENUM = [
  "waiting",
  "pending",
  "confirmed",
  "processing",
  "settled",
  "underpaid",
  "failed",
  "expired",
  "refunded",
] as const;

export interface PaymentObject {
  id: string;
  object: "payment";
  status: string;
  hosted_url: string | null;
  amount: number | null;
  currency: string | null;
  crypto: {
    amount: string | null;
    currency: string | null;
    address?: string;
    destination_tag?: number;
  } | null;
  fee: number | null;
  tax_amount: number | null;
  expires_at: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  redirect_url: string | null;
  auto_converted?: boolean;
  auto_convert?: unknown;
}

export const buildPaymentObject = (i: PaymentObjectInput): PaymentObject => {
  const hasCrypto = i.cryptoAmount != null || !!i.cryptoCurrency || !!i.cryptoAddress;
  const crypto = hasCrypto
    ? {
        amount: cryptoAmountStr(i.cryptoAmount),
        currency: i.cryptoCurrency ?? null,
        ...(i.cryptoAddress ? { address: i.cryptoAddress } : {}),
        ...(i.destinationTag != null ? { destination_tag: Number(i.destinationTag) } : {}),
      }
    : null;

  const obj: PaymentObject = {
    id: i.id,
    object: "payment",
    status: i.status,
    hosted_url: i.hostedUrl ?? null,
    amount: numOrNull(i.baseAmount),
    currency: i.baseCurrency ?? null,
    crypto,
    fee: numOrNull(i.fee),
    tax_amount: numOrNull(i.taxAmount),
    expires_at: isoOrNull(i.expiresAt),
    metadata: i.metadata ?? null,
    created_at: isoOrNull(i.createdAt),
    updated_at: isoOrNull(i.updatedAt),
    redirect_url: i.redirectUrl ?? null,
  };
  if (i.autoConverted !== undefined) obj.auto_converted = i.autoConverted;
  if (i.autoConvert !== undefined) obj.auto_convert = i.autoConvert;
  return obj;
};
