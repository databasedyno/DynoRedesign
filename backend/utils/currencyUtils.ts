/**
 * Currency Formatting Utility
 * Provides consistent currency display across all endpoints
 * Format: "$ USD", "€ EUR", "£ GBP", "₦ NGN"
 */

// Supported base currencies for API keys
export const SUPPORTED_BASE_CURRENCIES = [
  'USD',  // US Dollar
  'EUR',  // Euro
  'GBP',  // British Pound
  'AUD',  // Australian Dollar
  'CAD',  // Canadian Dollar
  'INR',  // Indian Rupee
  'NGN',  // Nigerian Naira
  'VND',  // Vietnamese Dong
  'PKR',  // Pakistani Rupee
  'BRL',  // Brazilian Real
  'ARS',  // Argentine Peso
  'PHP',  // Philippine Peso
  'SGD',  // Singapore Dollar
  'AED',  // UAE Dirham
  'KES',  // Kenyan Shilling
  'GHS',  // Ghanaian Cedi
  'ZAR',  // South African Rand
  'XOF',  // West African CFA Franc
  'XAF',  // Central African CFA Franc
  'EGP',  // Egyptian Pound
  'MAD',  // Moroccan Dirham
];

// Supported CURATED display currencies for the merchant dashboard (Session 39).
// Distinct from SUPPORTED_BASE_CURRENCIES (API-key pricing currencies). This is
// a presentation preference only — it never affects stored data or pricing.
export const SUPPORTED_DISPLAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];

export const isSupportedDisplayCurrency = (c?: string | null): boolean =>
  !!c && SUPPORTED_DISPLAY_CURRENCIES.includes(String(c).toUpperCase());

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Supported Base Currencies
  USD: '$',      // US Dollar
  EUR: '€',      // Euro
  GBP: '£',      // British Pound
  AUD: 'A$',     // Australian Dollar
  CAD: 'C$',     // Canadian Dollar
  INR: '₹',      // Indian Rupee
  NGN: '₦',      // Nigerian Naira
  VND: '₫',      // Vietnamese Dong
  PKR: '₨',      // Pakistani Rupee
  BRL: 'R$',     // Brazilian Real
  ARS: 'ARS$',   // Argentine Peso
  PHP: '₱',      // Philippine Peso
  SGD: 'S$',     // Singapore Dollar
  AED: 'د.إ',    // UAE Dirham
  // Legacy/Other (kept for backward compatibility)
  CHF: 'CHF', CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$',
  ZAR: 'R', KES: 'KSh', GHS: 'GH₵', MXN: 'MX$', XOF: 'CFA', XAF: 'FCFA', EGP: 'E£', MAD: 'DH',
  // Crypto (for reference)
  BTC: '₿', ETH: 'Ξ', USDT: '₮', USDC: 'USDC',
};

// Email-context symbol table (regional coverage + trailing-space layout used by
// the email templates). Consolidated here from utils/emailTemplate.ts so every
// currency-symbol table lives in one module. Output is byte-identical to the
// former local copy.
const EMAIL_CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
  CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
  BRL: 'R$', ARS: 'ARS ', COP: 'COP ', CLP: 'CLP ', PEN: 'S/', MXN: 'MX$', VES: 'Bs.', UYU: '$U',
  NGN: '₦', ZAR: 'R', KES: 'KSh', GHS: 'GH₵', TZS: 'TSh', XAF: 'FCFA ', XOF: 'CFA ', EGP: 'E£', MAD: 'MAD ',
  UGX: 'USh', RWF: 'FRw', ETB: 'Br', ZMW: 'ZK', BWP: 'P', MUR: '₨', AOA: 'Kz', MZN: 'MT', CDF: 'FC',
};

// PDF-context symbol table (invoice PDFs). Consolidated here from
// services/pdfService.ts. Output is byte-identical to the former local copy.
const PDF_CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
  CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
  BRL: 'R$', NGN: '₦', ZAR: 'R', KES: 'KSh', MXN: 'MX$',
};

/**
 * Which symbol table + fallback to use.
 *  - 'default': dashboard/API — falls back to the raw code.
 *  - 'email':   email templates — regional map, falls back to "CODE " (trailing space).
 *  - 'pdf':     invoice PDFs — smaller map, falls back to "" (no symbol).
 * The three variants exist because they render in different contexts and MUST
 * keep their exact historical output (they are NOT interchangeable).
 */
export type CurrencySymbolVariant = 'default' | 'email' | 'pdf';

/**
 * Get currency symbol for a currency code.
 * @param currency - ISO 4217 currency code
 * @param variant - display context (see CurrencySymbolVariant); default 'default'
 * @returns Symbol string (e.g., '$', '€', '₦')
 */
export const getCurrencySymbol = (
  currency: string,
  variant: CurrencySymbolVariant = 'default'
): string => {
  const code = currency?.toUpperCase();
  if (variant === 'email') {
    return EMAIL_CURRENCY_SYMBOLS[code] || `${currency} `;
  }
  if (variant === 'pdf') {
    return PDF_CURRENCY_SYMBOLS[code] || '';
  }
  return CURRENCY_SYMBOLS[code] || currency || '';
};

/**
 * Format amount with symbol and currency code
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code
 * @param includeCode - Whether to append currency code (default: true)
 * @returns Formatted string like "$1,234.56 USD" or "€1.234,56 EUR"
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  includeCode: boolean = true
): string => {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  if (includeCode) {
    return `${symbol}${formattedAmount} ${currency}`;
  }
  return `${symbol}${formattedAmount}`;
};

/**
 * Format amount for display (returns object with all components)
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code
 * @returns Object with symbol, amount, code, and formatted string
 */
export const formatAmountForDisplay = (
  amount: number,
  currency: string = 'USD'
): {
  symbol: string;
  amount: number;
  amount_formatted: string;
  currency_code: string;
  display_value: string;
} => {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return {
    symbol,
    amount,
    amount_formatted: formattedAmount,
    currency_code: currency,
    display_value: `${symbol}${formattedAmount} ${currency}`,
  };
};

/**
 * Get currency info object for API responses
 * Provides consistent currency information across all endpoints
 */
export const getCurrencyInfo = (currency: string = 'USD'): {
  code: string;
  symbol: string;
  display_format: string;
} => {
  const symbol = getCurrencySymbol(currency);
  return {
    code: currency,
    symbol,
    display_format: `${symbol} ${currency}`, // e.g., "$ USD", "€ EUR"
  };
};

// =============================================
// Consolidated Currency Conversion Helpers
// Wrap the raw currencyConvert() to eliminate boilerplate at call sites.
// =============================================

import currencyConvert from "../helper/currencyConvert";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "./dbInstance";
import { log } from "./loggers";
import { getRedisItem, setRedisItemWithTTL } from "./redisInstance";

/**
 * Get a company's preferred base currency from their API key config.
 * Priority: active production key > active dev key > last used key > 'USD' default.
 */
export const getCompanyBaseCurrency = async (companyId: number | string | null | undefined): Promise<string> => {
  if (!companyId) return 'USD';
  try {
    const result = await sequelizeInstance.query(
      COMPANY_CURRENCY_QUERY,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    ) as Array<{ base_currency: string }>;
    return (result.length > 0 && result[0].base_currency) ? result[0].base_currency : 'USD';
  } catch (err) {
    log(`[getCompanyBaseCurrency] Query failed for company ${companyId}, defaulting to USD`, 'warn');
    return 'USD';
  }
};

/**
 * Get a company's DASHBOARD DISPLAY currency (Session 39).
 *
 * This is a presentation-only preference, decoupled from the API key's pricing
 * `base_currency`. Resolution order:
 *   1. tbl_company.display_currency (if a supported display currency)
 *   2. legacy API-key base_currency (clamped to supported) — safety fallback
 *   3. 'USD'
 * NEVER affects stored data or payment pricing — display conversions only.
 */
// Some environments predate migrations/legacy/addDisplayCurrency.ts (which adds
// tbl_company.display_currency). If the column is absent we detect it ONCE and
// then skip the query, so we never spam warns / waste a round-trip on hot
// dashboard paths. The per-user tbl_user.display_currency path is unaffected.
let companyDisplayCurrencyColumnMissing = false;

export const getCompanyDisplayCurrency = async (
  companyId: number | string | null | undefined
): Promise<string> => {
  if (!companyId) return 'USD';
  if (!companyDisplayCurrencyColumnMissing) {
    try {
      const rows = (await sequelizeInstance.query(
        `SELECT display_currency FROM tbl_company WHERE company_id = :companyId LIMIT 1`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      )) as Array<{ display_currency: string | null }>;
      const pref = rows.length > 0 ? rows[0].display_currency : null;
      if (isSupportedDisplayCurrency(pref)) return String(pref).toUpperCase();
    } catch (err: any) {
      const code = err?.parent?.code || err?.original?.code || err?.code;
      const missingColumn =
        code === '42703' ||
        /column .*display_currency.* does not exist/i.test(String(err?.message || ''));
      if (missingColumn) {
        companyDisplayCurrencyColumnMissing = true;
        log(
          `[getCompanyDisplayCurrency] tbl_company.display_currency not present — using base-currency fallback (run migrations/legacy/addDisplayCurrency.ts). Further attempts suppressed.`,
          'warn'
        );
      } else {
        log(`[getCompanyDisplayCurrency] Query failed for company ${companyId}`, 'warn');
      }
    }
  }
  // Fallback to the legacy API-key currency (clamped), else USD.
  try {
    const base = await getCompanyBaseCurrency(companyId);
    if (isSupportedDisplayCurrency(base)) return String(base).toUpperCase();
  } catch {
    /* ignore */
  }
  return 'USD';
};

/**
 * Get a USER's dashboard DISPLAY currency (Doc-3 workstream E).
 *
 * Full resolution chain for per-user display preferences:
 *   1. tbl_user.display_currency  (user's personal pick — Doc 3 §E)
 *   2. tbl_company.display_currency  (company default — Session 39)
 *   3. legacy API-key base_currency (clamped to supported)
 *   4. 'USD'
 *
 * When companyId is null/undefined, only steps (1) and (4) apply.
 * NEVER affects pricing or stored data — display only.
 */
export const getUserDisplayCurrency = async (
  userId: number | string | null | undefined,
  companyId: number | string | null | undefined
): Promise<string> => {
  if (userId) {
    try {
      const rows = (await sequelizeInstance.query(
        `SELECT display_currency FROM tbl_user WHERE user_id = :userId LIMIT 1`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      )) as Array<{ display_currency: string | null }>;
      const pref = rows.length > 0 ? rows[0].display_currency : null;
      if (isSupportedDisplayCurrency(pref)) return String(pref).toUpperCase();
    } catch (err) {
      log(`[getUserDisplayCurrency] Query failed for user ${userId}`, 'warn');
    }
  }
  // Fall through to company preference (which itself falls through to key
  // base_currency then USD).
  if (companyId) return getCompanyDisplayCurrency(companyId);
  return 'USD';
};

/**
 * Cached USD → target-fiat rate (Redis, ~10 min TTL). Keeps the dashboard fast
 * and avoids burning FX-provider quota per request. Returns 1 on total failure
 * (i.e. amounts shown unconverted) rather than throwing.
 */
export const getUsdToFiatRate = async (target: string): Promise<number> => {
  const cur = String(target || 'USD').toUpperCase();
  if (cur === 'USD') return 1;
  const key = `fxrate:USD:${cur}`;
  try {
    const cached = await getRedisItem(key);
    if (cached && Number(cached.rate) > 0) return Number(cached.rate);
  } catch {
    /* cache miss / error → fetch live */
  }
  try {
    const { amount } = await convertToFiat('USD', cur, 1);
    const rate = Number(amount) || 0;
    if (rate > 0) {
      try {
        await setRedisItemWithTTL(key, { rate }, 600);
      } catch {
        /* non-fatal */
      }
      return rate;
    }
  } catch (err) {
    log(`[getUsdToFiatRate] USD→${cur} conversion failed, using rate 1`, 'warn');
  }
  return 1;
};

/**
 * Convert a USD amount into the merchant's display currency (cached rate).
 * Returns the USD amount unchanged if target is USD or conversion is unavailable.
 */
export const convertUsdForDisplay = async (
  usd: number,
  target: string
): Promise<number> => {
  const cur = String(target || 'USD').toUpperCase();
  if (!usd || cur === 'USD') return usd || 0;
  const rate = await getUsdToFiatRate(cur);
  return usd * rate;
};

/**
 * Convert any currency amount to USD (most common pattern).
 * Returns the USD amount as a number.
 */
export const convertToUSD = async (sourceCurrency: string, amount: number): Promise<number> => {
  if (sourceCurrency === 'USD') return amount;
  const result = await currencyConvert({
    currency: ['USD'],
    sourceCurrency,
    amount,
    fixedDecimal: true,
  });
  return Number(result[0]?.amount || 0);
};

/**
 * Convert a fiat/crypto amount into a target crypto currency.
 * Returns { amount, rate }.
 */
export const convertToCrypto = async (
  baseCurrency: string,
  cryptoType: string,
  amount: number,
): Promise<{ amount: number; rate: number }> => {
  const result = await currencyConvert({
    currency: [cryptoType],
    sourceCurrency: baseCurrency,
    amount,
    fixedDecimal: false,
  });
  return {
    amount: Number(result[0]?.amount || 0),
    rate: Number(result[0]?.transferRate || 0),
  };
};

/**
 * Convert a crypto/fiat amount into a target fiat currency.
 * Returns { amount, rate }.
 */
export const convertToFiat = async (
  sourceCurrency: string,
  targetFiat: string,
  amount: number,
): Promise<{ amount: number; rate: number }> => {
  if (sourceCurrency === targetFiat) return { amount, rate: 1 };
  const result = await currencyConvert({
    currency: [targetFiat],
    sourceCurrency,
    amount,
    fixedDecimal: true,
  });
  return {
    amount: Number(result[0]?.amount || 0),
    rate: Number(result[0]?.transferRate || 0),
  };
};

/**
 * Get rates for multiple target currencies at once.
 * Returns the full CurrencyRateList array.
 */
export const convertToMultiple = async (
  sourceCurrency: string,
  targets: string[],
  amount: number,
  fixedDecimal: boolean = true,
): Promise<Array<{ currency: string; amount: number; transferRate: number }>> => {
  return await currencyConvert({
    currency: targets,
    sourceCurrency,
    amount,
    fixedDecimal,
  });
};

/**
 * Format a crypto (or stablecoin) amount for human-readable display.
 * Fixes float artifacts like 0.00033163515000000004 → "0.00033164".
 * - Stablecoins / fiat-pegged: max 2 decimals
 * - All other crypto: max 8 decimals (native precision for BTC/LTC/DOGE/BCH)
 * - Trailing zeros trimmed ("0.65400000" → "0.654", "100.00" → "100")
 * NOTE: display-only — never use for on-chain math or stored values.
 */
export const formatCryptoAmount = (
  amount: number | string,
  currency: string = ''
): string => {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (!isFinite(num)) return String(amount);
  const upper = String(currency || '').toUpperCase();
  const isStableOrFiat = /USDT|USDC|BUSD|DAI|USD|EUR|GBP|BRL/.test(upper);
  const decimals = isStableOrFiat ? 2 : 8;
  const fixed = num.toFixed(decimals);
  // toFixed(>0) always contains '.', so trimming trailing zeros is safe
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
};

export default {
  getCurrencySymbol,
  formatCurrency,
  formatAmountForDisplay,
  formatCryptoAmount,
  getCurrencyInfo,
  CURRENCY_SYMBOLS,
  SUPPORTED_BASE_CURRENCIES,
  convertToUSD,
  convertToCrypto,
  convertToFiat,
  convertToMultiple,
  getCompanyBaseCurrency,
};

/**
 * SQL query to get company's preferred currency
 * Priority: Active production key > Active development key > Last used key (any status) > USD default
 */
export const COMPANY_CURRENCY_QUERY = `
  SELECT base_currency FROM tbl_api 
  WHERE company_id = :companyId 
  ORDER BY 
    CASE WHEN status = 'active' THEN 0 ELSE 1 END,
    CASE WHEN environment = 'production' THEN 0 ELSE 1 END, 
    "createdAt" DESC 
  LIMIT 1
`;
