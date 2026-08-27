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
