/**
 * Fiat currencies the product offers for merchant / creator selection
 * (e.g. the Support Widget currency dropdown). This is the *supported list*,
 * distinct from `utils/currencyFormat.ts` which owns per-currency formatting
 * metadata (symbol / decimals / locale) for any currency we might display.
 */
export const SUPPORTED_FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "INR",
  "NGN",
  "ZAR",
  "BRL",
] as const;

export type SupportedFiatCurrency = (typeof SUPPORTED_FIAT_CURRENCIES)[number];
