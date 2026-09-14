/**
 * App-wide date/time display helpers (UI/UX audit P1 fix, 2026-06).
 * Before this, three surfaces used three ambiguous numeric formats
 * (13.08.2026 vs 08.13.2026 vs 18.04.2026). Month-abbreviated output is
 * unambiguous in every locale: "13 Aug 2026, 13:10".
 */

const resolveLocale = (locale?: string): string => {
  if (locale) return locale;
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  return "en";
};

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

export const formatDisplayDate = (value: Date | string, locale?: string): string => {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(resolveLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDisplayTime = (value: Date | string, locale?: string): string => {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(resolveLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatDisplayDateTime = (value: Date | string, locale?: string): string => {
  const date = formatDisplayDate(value, locale);
  if (!date) return "";
  return `${date}, ${formatDisplayTime(value, locale)}`;
};
