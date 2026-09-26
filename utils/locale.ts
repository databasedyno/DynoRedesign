import i18n from "@/i18n";
import { toFixedStr, type MoneyLike } from "@/utils/money";

/** UI language → BCP-47 locale used for every Intl number/date call. */
export const LOCALE_BY_LANG: Record<string, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  nl: "nl-NL",
};

export const localeForLang = (lang?: string): string =>
  LOCALE_BY_LANG[(lang || "").split("-")[0].toLowerCase()] || "en-US";

/** Locale of the app's SELECTED language — never the browser default. */
export const appLocale = (): string => {
  try {
    return localeForLang(i18n?.language);
  } catch {
    return "en-US";
  }
};

const nfCache = new Map<string, Intl.NumberFormat>();
const nf = (locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = locale + JSON.stringify(opts);
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    nfCache.set(key, f);
  }
  return f;
};

const NUMERIC_PARTS = new Set(["integer", "group", "decimal", "fraction", "minusSign", "plusSign"]);

/** Localise an already-rounded decimal string ("1234.5", "0.00100") keeping its exact digits. */
export const localizeDecimal = (fixed: string, locale: string = appLocale()): string => {
  const dp = (fixed.split(".")[1] || "").length;
  const f = nf(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  try {
    return f.format(fixed as unknown as number);
  } catch {
    return f.format(Number(fixed));
  }
};

/** Plain number, exactly `dp` decimals: 1234.5 → "1.234,50" (de) / "1,234.50" (en). */
export const formatLocaleNumber = (v: MoneyLike, dp = 2, locale: string = appLocale()): string =>
  localizeDecimal(toFixedStr(v, dp), locale);

/** Integer count: 12345 → "12.345" (de) / "12,345" (en). */
export const formatLocaleInt = (v: MoneyLike, locale: string = appLocale()): string =>
  formatLocaleNumber(v, 0, locale);

/** ISO-currency amount; symbol position follows the locale: "1.234,56 €" (de) / "€1,234.56" (en). */
export const formatLocaleCurrency = (
  v: MoneyLike,
  currency: string,
  dp?: number,
  locale: string = appLocale(),
): string => {
  const code = (currency || "USD").toUpperCase();
  try {
    const digits = dp ?? nf(locale, { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    const fixed = toFixedStr(v, digits);
    const f = nf(locale, { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits });
    try {
      return f.format(fixed as unknown as number);
    } catch {
      return f.format(Number(fixed));
    }
  } catch {
    return `${toFixedStr(v, dp ?? 2)} ${code}`;
  }
};

/**
 * Amount with an arbitrary symbol ("$", "R$", "USDT"…) placed where the locale
 * puts its currency symbol: "$1,234.56" (en) · "1.234,56 $" (de) · "US$ 1.234,56" (pt).
 * `unit` (e.g. "k", "M") is glued to the number, not the symbol.
 */
export const formatWithSymbol = (
  v: MoneyLike,
  symbol: string,
  dp = 2,
  unit = "",
  locale: string = appLocale(),
): string => {
  const fixed = toFixedStr(v, dp);
  if (!symbol) return localizeDecimal(fixed, locale) + unit;
  const f = nf(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: dp, maximumFractionDigits: dp });
  let parts: Intl.NumberFormatPart[];
  try {
    parts = f.formatToParts(fixed as unknown as number);
  } catch {
    parts = f.formatToParts(Number(fixed));
  }
  let lastNumeric = -1;
  parts.forEach((p, i) => {
    if (NUMERIC_PARTS.has(p.type)) lastNumeric = i;
  });
  return parts
    .map((p, i) => {
      const value = p.type === "currency" ? symbol : p.value;
      return unit && i === lastNumeric ? value + unit : value;
    })
    .join("");
};
