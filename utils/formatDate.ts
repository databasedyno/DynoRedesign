import { appLocale } from "@/utils/locale";

/** The current app UI language as a BCP-47 locale (never the browser default). */
export const currentDateLocale = (): string => appLocale();

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
