import i18n from "@/i18n";

/**
 * Map an app UI language code (en, pt, es, fr, de, nl — optionally with a region
 * suffix) to a BCP-47 locale suitable for Intl date formatting. Falls back to
 * en-US so we NEVER silently inherit the browser's locale.
 */
const localeFromLang = (lang?: string): string => {
  const base = (lang || "").split("-")[0].toLowerCase();
  const map: Record<string, string> = {
    en: "en-US",
    pt: "pt-BR",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    nl: "nl-NL",
  };
  return map[base] || "en-US";
};

/** The current app UI language as a BCP-47 locale (never the browser default). */
export const currentDateLocale = (): string => {
  try {
    return localeFromLang(i18n?.language);
  } catch {
    return "en-US";
  }
};

/**
 * Format a DATE in the app's SELECTED language.
 *
 * Use this instead of `date.toLocaleDateString(undefined, ...)`: passing
 * `undefined` makes the browser locale win, which is why receipts/month headers
 * rendered in Portuguese even when the app language was English.
 */
export const formatDateI18n = (
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string => {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(currentDateLocale(), options);
};

/** Format a DATE + TIME in the app's SELECTED language. */
export const formatDateTimeI18n = (
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string => {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(currentDateLocale(), options);
};

// Largest-fitting unit ladder for relative time (seconds → years).
const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/**
 * Format a RELATIVE time ("5 minutes ago", "in 2 days") in the app's SELECTED
 * language via the native Intl.RelativeTimeFormat — locale-aware units/plurals,
 * so non-English merchants (and buyers on hosted pages) see it in their own
 * language WITHOUT per-string translation keys. Replaces hand-rolled
 * `${n}m ago` / `${n} minutes ago` strings scattered across the app.
 *
 * style: "long"   → "5 minutes ago"  (default, verbose surfaces)
 *        "short"  → "5 min. ago"
 *        "narrow" → "5m ago"         (compact chips / live feeds; en matches the old format exactly)
 * Past instants are negative (…ago); future instants read "in …".
 */
export const formatRelativeTime = (
  date: Date | string | number | null | undefined,
  style: Intl.RelativeTimeFormatStyle = "long"
): string => {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  try {
    const rtf = new Intl.RelativeTimeFormat(currentDateLocale(), { numeric: "always", style });
    let duration = (d.getTime() - Date.now()) / 1000; // seconds; negative = past
    // Very recent → locale-aware "now" (agora / ahora / maintenant / …) instead of "0s ago".
    if (Math.abs(duration) < 5) {
      return new Intl.RelativeTimeFormat(currentDateLocale(), { numeric: "auto", style }).format(0, "second");
    }
    for (const division of RELATIVE_DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return rtf.format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
    return rtf.format(Math.round(duration), "year");
  } catch {
    return "";
  }
};
