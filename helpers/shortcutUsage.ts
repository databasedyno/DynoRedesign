/**
 * Local, privacy-friendly usage counter for the dashboard Quick Actions dock.
 *
 * The dock suggests the 4 destinations a merchant actually lives in. Rather
 * than logging every navigation to the server (a write per page view on a live
 * payment gateway), visits are counted in localStorage on the device that will
 * consume the suggestion. Nothing leaves the browser until the merchant taps
 * "Use these", which saves the picks through the existing
 * PUT /api/user/dashboard-quick-actions endpoint.
 *
 * Keys MUST match the QuickActionsDock CATALOG ids (and the backend
 * ALLOWED_QUICK_ACTIONS list).
 */

const STORE_KEY = "dp_qa_usage_v1";

/** Exact in-app path → catalog id. Longest paths first is irrelevant: exact match only. */
const PATH_TO_ID: Record<string, string> = {
  "/create-pay-link": "create-paylink",
  "/pay-links": "paylinks",
  "/storefront": "creator",
  "/pay-links/products": "products",
  "/invoices": "invoice",
  "/wallet": "wallet",
  "/transactions": "transactions",
  "/creator": "creator",
  "/fees": "fees",
  "/developer-keys": "api",
  "/referrals": "referrals",
};

type Counts = Record<string, number>;

const read = (): Counts => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Counts) : {};
  } catch {
    return {};
  }
};

const write = (counts: Counts): void => {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(counts));
  } catch {
    /* storage unavailable — suggestions simply never appear */
  }
};

export const shortcutIdForPath = (path: string): string | null => {
  const clean = String(path || "").split("?")[0].replace(/\/+$/, "") || "/";
  return PATH_TO_ID[clean] ?? null;
};

/** Count one visit. No-op for pages that aren't pinnable shortcuts. */
export const recordShortcutVisit = (path: string): void => {
  if (typeof window === "undefined") return;
  const id = shortcutIdForPath(path);
  if (!id) return;
  const counts = read();
  counts[id] = (counts[id] || 0) + 1;
  write(counts);
};

export const getShortcutCounts = (): Counts => read();

export const getTotalShortcutVisits = (): number =>
  Object.values(read()).reduce((sum, n) => sum + (Number(n) || 0), 0);

/**
 * The merchant's top `size` destinations, or [] when there isn't enough signal
 * to be useful (we never suggest off 2 page views).
 */
export const getSuggestedShortcuts = (
  size = 4,
  minTotalVisits = 8,
): string[] => {
  const counts = read();
  const total = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
  if (total < minTotalVisits) return [];
  const ranked = Object.entries(counts)
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([id]) => id);
  return ranked.length >= size ? ranked.slice(0, size) : [];
};

const shortcutUsage = {
  recordShortcutVisit,
  getShortcutCounts,
  getSuggestedShortcuts,
  getTotalShortcutVisits,
  shortcutIdForPath,
};

export default shortcutUsage;
