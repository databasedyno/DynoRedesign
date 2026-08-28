import { getCurrencySymbol as getCurrencySymbolShared } from "../utils/currencyUtils";
import { t } from "../utils/emailI18n";

export interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  provider_name: string;
  provider_address: string;
  provider_vat_id: string;
  customer_name: string;
  customer_address: string;
  customer_tax_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  vat_rate: number;
  vat_amount: number;
  fixed_fee: number;
  transaction_fee_percent: number;
  blockchain_buffer_percent: number;
  total_usd: number;
  total_amount?: number; // Amount in base_currency (if different from USD)
  base_currency?: string; // Base currency code (e.g., EUR, GBP)
  total_crypto: number;
  crypto_currency: string;
  payment_terms: string;
  transaction_id: number;
  // Session 36 v2 fields — optional so legacy v1 callers still type-check.
  transaction_amount?: number | string;
  invoice_version?: string;
  // "Fiat Everywhere Invoice PDF" — the merchant's chosen DISPLAY currency
  // (Settings → Payments: USD/EUR/GBP/NGN/CAD/AUD) + the USD→display FX rate
  // resolved by the caller. When present, all USD-canonical monetary values
  // (unit_price, vat_amount, fixed_fee, total_usd, transaction_amount) are
  // multiplied by the rate before rendering and the display currency's
  // symbol/code appear on every money line so the invoice reads end-to-end
  // in the merchant's currency. When absent, falls back to the legacy
  // `base_currency`/`total_amount` behaviour so old callers still work.
  display_currency?: string;
  usd_to_display_rate?: number;
  // Merchant's language (ISO 639-1) for localized labels + dates.
  lang?: string;
}

/**
 * Get currency symbol for a given currency code.
 * Table lives in utils/currencyUtils.ts (variant 'pdf'); this wrapper keeps the
 * existing call sites + byte-identical output.
 */
export const getCurrencySymbol = (currency: string): string =>
  getCurrencySymbolShared(currency, 'pdf');

// The stored invoice `description` is generated in English at creation time
// (autoGenerateInvoice) as "Payment processing service - Transaction X". For
// that common auto-generated line we render it in the merchant's language;
// any custom/legacy description falls through unchanged.
export const localizeDescription = (description: string, lang: string): string => {
  if (!description) return description;
  const m = description.match(/^Payment processing service - Transaction (.+)$/);
  if (m) return t("invoice.serviceDescription", lang, { reference: m[1] });
  return description;
};

// Localize the default stored payment terms; custom terms pass through.
export const localizePaymentTerms = (terms: string, lang: string): string => {
  if (!terms) return terms;
  if (terms.trim() === "Payment due upon receipt") return t("invoice.paymentDueUponReceipt", lang);
  return terms;
};
