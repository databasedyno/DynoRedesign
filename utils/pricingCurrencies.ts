/**
 * pricingCurrencies — single source of truth for the fiat currencies a merchant
 * can PRICE payment links, donations and products in.
 *
 * IMPORTANT: keep this list in sync with the backend `SUPPORTED_BASE_CURRENCIES`
 * (backend/utils/currencyUtils.ts + backend/controller/apiController.ts).
 *
 * This is a curated set of major + high-volume local currencies (incl. African
 * currencies such as NGN, KES, GHS, ZAR, XOF, XAF, EGP, MAD) so that a merchant
 * in, e.g., Nigeria can price a link/donation in NGN. The amount is always
 * converted to the crypto the customer pays with at checkout.
 */
export const PRICING_CURRENCIES: string[] = [
  // Global majors
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  // Asia & Middle East
  "INR",
  "PKR",
  "AED",
  "PHP",
  "VND",
  // Latin America
  "BRL",
  "ARS",
  // Africa
  "NGN",
  "KES",
  "GHS",
  "ZAR",
  "XOF",
  "XAF",
  "EGP",
  "MAD",
];

/** Human-friendly names for each supported pricing currency. */
export const PRICING_CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  AUD: "Australian Dollar",
  CAD: "Canadian Dollar",
  SGD: "Singapore Dollar",
  INR: "Indian Rupee",
  PKR: "Pakistani Rupee",
  AED: "UAE Dirham",
  PHP: "Philippine Peso",
  VND: "Vietnamese Dong",
  BRL: "Brazilian Real",
  ARS: "Argentine Peso",
  NGN: "Nigerian Naira",
  KES: "Kenyan Shilling",
  GHS: "Ghanaian Cedi",
  ZAR: "South African Rand",
  XOF: "West African CFA Franc",
  XAF: "Central African CFA Franc",
  EGP: "Egyptian Pound",
  MAD: "Moroccan Dirham",
};

/** True when `code` is one of the supported pricing currencies (case-insensitive). */
export const isSupportedPricingCurrency = (code?: string | null): boolean =>
  !!code && PRICING_CURRENCIES.includes(code.toUpperCase());

/**
 * Clamp an arbitrary currency code to a supported pricing currency.
 * Returns the upper-cased code if supported, otherwise the fallback (default "USD").
 */
export const clampPricingCurrency = (
  code?: string | null,
  fallback = "USD",
): string => (isSupportedPricingCurrency(code) ? (code as string).toUpperCase() : fallback);
