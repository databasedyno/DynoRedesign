/**
 * Payment-notification amount display helper.
 *
 * The "Payment Received" (and related) emails show an Amount to the merchant.
 * That Amount MUST be a FIAT figure in the merchant's currency, derived from an
 * AUTHORITATIVE source.
 *
 * History: emails were rendering a wrong figure (e.g. "1.00 USD" for a ~$100
 * BTC payment). Root cause: the amount was taken from `base_amount` /
 * `customerData.base_amount` (a Redis/temp value that could be stale, a
 * placeholder, or crypto-denominated). This helper instead derives the fiat
 * figure from the transaction's USD value (or a crypto→USD conversion of the
 * amount actually received) and only falls back to the priced `base_amount` as
 * a last resort — so it can never show a bogus fee/placeholder amount.
 */
import {
  getCompanyBaseCurrency,
  convertToFiat,
  convertToUSD,
} from "./currencyUtils";
import { toFixedStr } from "./money";

// Crypto currency codes handled by the platform. Anything matching these (or
// containing a network suffix like "-TRC20"/"-ERC20", or a conversion arrow)
// is treated as crypto and therefore NOT a valid fiat figure.
const CRYPTO_CODES = new Set([
  "BTC", "ETH", "LTC", "DOGE", "BCH", "TRX", "TRON", "SOL", "XRP",
  "BNB", "MATIC", "POLYGON", "USDT", "USDC", "RLUSD",
]);

export const isCryptoCurrency = (cur?: string | null): boolean => {
  if (!cur) return false;
  const up = cur.toUpperCase();
  if (up.includes("-") || up.includes("→") || up.includes(">") || up.includes(" ")) return true; // USDT-TRC20, "ETH → USDT"
  return CRYPTO_CODES.has(up);
};

export interface PaymentAmountDisplay {
  fiatAmount: string; // e.g. "99.90"
  fiatCurrency: string; // e.g. "USD"
  cryptoAmount?: string; // e.g. "0.00156395"
  cryptoCurrency?: string; // display label, e.g. "BTC" or "ETH → USDT"
}

const toMerchantCurrency = async (
  usd: number,
  merchantCurrency: string
): Promise<{ amount: number; currency: string }> => {
  if (!merchantCurrency || merchantCurrency === "USD") {
    return { amount: usd, currency: "USD" };
  }
  try {
    const conv = (await convertToFiat("USD", merchantCurrency, usd)).amount;
    if (conv && conv > 0) return { amount: conv, currency: merchantCurrency };
  } catch {
    /* keep USD */
  }
  return { amount: usd, currency: "USD" };
};

/**
 * Build the fiat-primary + crypto-secondary amounts for a payment notification.
 *
 * Priority for the FIAT figure (highest → lowest):
 *   1. `usdValue` — the transaction's authoritative USD value.
 *   2. crypto → USD conversion of `cryptoAmount` (using the RAW `cryptoCurrency`).
 *   3. `knownFiatAmount` (the priced base amount) — LAST RESORT only, and only
 *      when it is a non-crypto fiat value.
 * The resulting USD figure is then converted into the merchant's currency.
 */
export const buildPaymentReceivedDisplay = async (params: {
  companyId?: number | string | null;
  usdValue?: number | string | null;
  cryptoAmount?: number | string | null;
  cryptoCurrency?: string | null; // RAW code used for conversion (e.g. "BTC")
  cryptoDisplayCurrency?: string | null; // optional display label (e.g. "ETH → USDT")
  knownFiatAmount?: number | string | null; // last-resort only
  knownFiatCurrency?: string | null;
}): Promise<PaymentAmountDisplay> => {
  let merchantCurrency = "USD";
  try {
    merchantCurrency = (await getCompanyBaseCurrency(params.companyId as any)) || "USD";
  } catch {
    merchantCurrency = "USD";
  }

  const cryptoAmount =
    params.cryptoAmount != null ? String(params.cryptoAmount) : undefined;
  const cryptoCurrency =
    params.cryptoDisplayCurrency || params.cryptoCurrency || undefined;

  // 1) Authoritative transaction USD value.
  let usd = params.usdValue != null ? Number(params.usdValue) : NaN;

  // 2) Derive USD from the crypto amount actually received (raw currency).
  if (!(usd > 0) && cryptoAmount && params.cryptoCurrency) {
    try {
      usd = await convertToUSD(params.cryptoCurrency, Number(cryptoAmount));
    } catch {
      usd = NaN;
    }
  }

  if (usd > 0) {
    const { amount, currency } = await toMerchantCurrency(usd, merchantCurrency);
    return { fiatAmount: toFixedStr(amount, 2), fiatCurrency: currency, cryptoAmount, cryptoCurrency };
  }

  // 3) LAST RESORT: the priced fiat base amount (never a crypto value).
  const knownFiat =
    params.knownFiatAmount != null ? Number(params.knownFiatAmount) : NaN;
  if (knownFiat > 0 && params.knownFiatCurrency && !isCryptoCurrency(params.knownFiatCurrency)) {
    let amt = knownFiat;
    let cur = params.knownFiatCurrency.toUpperCase();
    if (cur !== merchantCurrency) {
      try {
        const usdFromFiat = cur === "USD" ? knownFiat : await convertToUSD(cur, knownFiat);
        const conv = await toMerchantCurrency(usdFromFiat, merchantCurrency);
        amt = conv.amount;
        cur = conv.currency;
      } catch {
        /* keep original */
      }
    }
    return { fiatAmount: toFixedStr(amt, 2), fiatCurrency: cur, cryptoAmount, cryptoCurrency };
  }

  // Nothing reliable — never surface a bogus fiat number.
  return { fiatAmount: "0.00", fiatCurrency: merchantCurrency, cryptoAmount, cryptoCurrency };
};
