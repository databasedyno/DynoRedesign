interface CurrencyFormat {
  symbol: string;
  decimals: number;
  locale: string;
}

const currencyFormats: Record<string, CurrencyFormat> = {
  // International
  USD: { symbol: '$', decimals: 2, locale: 'en-US' },
  EUR: { symbol: '€', decimals: 2, locale: 'de-DE' },
  GBP: { symbol: '£', decimals: 2, locale: 'en-GB' },
  AUD: { symbol: 'A$', decimals: 2, locale: 'en-AU' },
  CAD: { symbol: 'C$', decimals: 2, locale: 'en-CA' },
  CHF: { symbol: 'Fr', decimals: 2, locale: 'de-CH' },
  CNY: { symbol: '¥', decimals: 2, locale: 'zh-CN' },
  JPY: { symbol: '¥', decimals: 0, locale: 'ja-JP' },
  HKD: { symbol: 'HK$', decimals: 2, locale: 'zh-HK' },
  NZD: { symbol: 'NZ$', decimals: 2, locale: 'en-NZ' },
  SGD: { symbol: 'S$', decimals: 2, locale: 'en-SG' },
  // Latin America
  BRL: { symbol: 'R$', decimals: 2, locale: 'pt-BR' },
  ARS: { symbol: '$', decimals: 2, locale: 'es-AR' },
  COP: { symbol: '$', decimals: 0, locale: 'es-CO' },
  CLP: { symbol: '$', decimals: 0, locale: 'es-CL' },
  PEN: { symbol: 'S/', decimals: 2, locale: 'es-PE' },
  MXN: { symbol: '$', decimals: 2, locale: 'es-MX' },
  VES: { symbol: 'Bs', decimals: 2, locale: 'es-VE' },
  UYU: { symbol: '$U', decimals: 2, locale: 'es-UY' },
  // Africa
  NGN: { symbol: '₦', decimals: 2, locale: 'en-NG' },
  ZAR: { symbol: 'R', decimals: 2, locale: 'en-ZA' },
  KES: { symbol: 'KSh', decimals: 2, locale: 'en-KE' },
  GHS: { symbol: '₵', decimals: 2, locale: 'en-GH' },
  TZS: { symbol: 'TSh', decimals: 0, locale: 'sw-TZ' },
  XAF: { symbol: 'FCFA', decimals: 0, locale: 'fr-CM' },
  XOF: { symbol: 'CFA', decimals: 0, locale: 'fr-SN' },
  EGP: { symbol: 'E£', decimals: 2, locale: 'ar-EG' },
  MAD: { symbol: 'DH', decimals: 2, locale: 'ar-MA' },
  UGX: { symbol: 'USh', decimals: 0, locale: 'en-UG' },
  RWF: { symbol: 'FRw', decimals: 0, locale: 'rw-RW' },
  ETB: { symbol: 'Br', decimals: 2, locale: 'am-ET' },
  ZMW: { symbol: 'ZK', decimals: 2, locale: 'en-ZM' },
  BWP: { symbol: 'P', decimals: 2, locale: 'en-BW' },
  MUR: { symbol: '₨', decimals: 2, locale: 'en-MU' },
  AOA: { symbol: 'Kz', decimals: 2, locale: 'pt-AO' },
  MZN: { symbol: 'MT', decimals: 2, locale: 'pt-MZ' },
  CDF: { symbol: 'FC', decimals: 2, locale: 'fr-CD' },
};

export const formatCurrency = (amount: number, currency: string): string => {
  const format = currencyFormats[currency?.toUpperCase()] || { symbol: '', decimals: 2, locale: 'en-US' };
  
  try {
    return new Intl.NumberFormat(format.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: format.decimals,
      maximumFractionDigits: format.decimals
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${format.symbol} ${amount.toFixed(format.decimals)}`;
  }
};

export const getCurrencyDecimals = (currency: string): number => {
  return currencyFormats[currency?.toUpperCase()]?.decimals ?? 2;
};

export const getCurrencySymbolFromFormat = (currency: string): string => {
  return currencyFormats[currency?.toUpperCase()]?.symbol ?? '';
};

/**
 * Format a number with thousand separators based on currency locale
 * @param amount - The amount to format
 * @param currency - Currency code to determine locale (optional, defaults to en-US)
 * @param decimals - Number of decimal places (optional, auto-detected from currency or defaults to 2)
 * @returns Formatted string with thousand separators (e.g., "10,000.00" or "10.000,00")
 */
export const formatWithSeparators = (
  amount: number | string,
  currency?: string,
  decimals?: number
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '0';
  
  const format = currency ? currencyFormats[currency.toUpperCase()] : null;
  const locale = format?.locale || 'en-US';
  const fractionDigits = decimals ?? format?.decimals ?? 2;
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numAmount);
};

/**
 * Format crypto amounts with proper precision (up to 8 decimals, trimmed trailing zeros)
 * Also adds thousand separators for the integer part
 * @param amount - The crypto amount
 * @param currency - Crypto currency code
 * @returns Formatted crypto amount string
 */
export const formatCryptoAmount = (amount: number | string, currency: string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '0';
  
  const cryptoCurrencies = [
    'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH',
    'USDT', 'USDT-TRC20', 'USDT-ERC20', 'USDC', 'USDC-ERC20', 'BNB'
  ];
  
  const isCrypto = cryptoCurrencies.some(c =>
    currency?.toUpperCase().includes(c)
  );
  
  if (isCrypto) {
    // Format with up to 8 decimal places, then trim trailing zeros
    const formatted = numAmount.toFixed(8);
    const trimmed = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    
    // Add thousand separators to integer part
    const parts = trimmed.split('.');
    parts[0] = parseInt(parts[0]).toLocaleString('en-US');
    return parts.join('.');
  }
  
  // For fiat currencies in crypto context, use 2 decimals with separators
  return formatWithSeparators(numAmount, currency, 2);
};

/**
 * Round overly-long decimal numbers inside a free-text string.
 * Fixes float artifacts stored in historical notification messages, e.g.
 * "received 0.00033163515000000004 BTC" → "received 0.00033164 BTC".
 * Only numbers with 9+ fractional digits are touched (legit on-chain
 * amounts never exceed 8 decimals), so tx ids/dates/short amounts are safe.
 */
export const roundLongDecimalsInText = (text?: string | null): string => {
  if (!text) return text ?? "";
  return text.replace(/\d+\.\d{9,}/g, (match) => {
    const num = parseFloat(match);
    if (!isFinite(num)) return match;
    return num.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  });
};

export default currencyFormats;
