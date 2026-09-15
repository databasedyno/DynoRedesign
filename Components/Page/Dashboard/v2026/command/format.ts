import { formatWithSeparators } from "@/utils/currencyFormat";

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** "$1,234.56" in the merchant's display currency. */
export const money = (amount: number, symbol: string, currency = "USD", decimals = 2): string =>
  `${symbol}${formatWithSeparators(Number(amount) || 0, currency, decimals)}`;

/** Compact money for tight tiles: $1.2k · $3.4M. */
export const moneyCompact = (amount: number, symbol: string, currency = "USD"): string => {
  const v = Number(amount) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${symbol}${(v / 1_000).toFixed(1)}k`;
  return money(v, symbol, currency);
};

/** "4 min ago" · "3 h ago" · "Tue 14:02" · "Sep 3". */
export const relativeTime = (iso: string | null | undefined, t: TFn, lang = "en"): string => {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60_000));
  if (diffMin < 1) return t("command.justNow", { defaultValue: "just now" });
  if (diffMin < 60) return t("command.minAgo", { count: diffMin, defaultValue: "{{count}} min ago" });
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return t("command.hrAgo", { count: hrs, defaultValue: "{{count}} h ago" });
  const d = new Date(ms);
  if (hrs < 24 * 7) {
    return d.toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(lang, { month: "short", day: "numeric" });
};

/** Minutes → "5 min" · "1 h 20 min" · "2 d". */
export const durationLabel = (minutes: number | null | undefined, t: TFn): string => {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const m = Math.round(minutes);
  if (m < 1) return t("command.underMinute", { defaultValue: "<1 min" });
  if (m < 60) return t("command.minutes", { count: m, defaultValue: "{{count}} min" });
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }
  return t("command.days", { count: Math.round(h / 24), defaultValue: "{{count}} d" });
};

/** Signed percentage-point / percent delta label: "+3.2", "−1.5". */
export const signed = (n: number, digits = 1): string => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `\u2212${s}` : s;
};
