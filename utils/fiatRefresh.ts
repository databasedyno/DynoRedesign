/** Window event that asks every mounted fiat view to refetch (payment / currency change). */
export const FIAT_REFRESH_EVENT = "dynopay:fiat-refresh";

export type FiatRefreshReason = "currency" | "payment" | "interval";

// SWR keys whose payloads carry fiat amounts in the brand currency.
const AMOUNT_KEY_PREFIXES = [
  "dashboard",
  "user/display-currency",
  "company/display-currency",
  "wallet",
  "invoices",
  "tax/",
  "userapi/customers",
  "paylink-",
];

export const isAmountBearingKey = (key: unknown): boolean => {
  const k = Array.isArray(key) ? key[0] : key;
  if (typeof k !== "string") return false;
  const s = k.replace(/^\/+/, "").toLowerCase();
  return AMOUNT_KEY_PREFIXES.some((p) => s.startsWith(p));
};

export const requestFiatRefresh = (reason: FiatRefreshReason) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FIAT_REFRESH_EVENT, { detail: { reason } }));
};
