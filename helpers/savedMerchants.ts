// Device-local "saved merchants" list for anonymous buyers (no account needed).
export type SavedMerchant = {
  handle: string;
  name: string;
  avatar?: string | null;
  savedAt: number;
};

export const SAVED_MERCHANTS_KEY = "dynopay_saved_merchants_v1";
export const SAVED_MERCHANTS_EVENT = "dynopay:saved-merchants";
const MAX_ITEMS = 50;

const norm = (h: string) => String(h || "").trim().toLowerCase();

export function readSavedMerchants(): SavedMerchant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_MERCHANTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((m): m is SavedMerchant => !!m && typeof m.handle === "string" && m.handle.length > 0);
  } catch {
    return [];
  }
}

function write(list: SavedMerchant[]) {
  try {
    window.localStorage.setItem(SAVED_MERCHANTS_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new CustomEvent(SAVED_MERCHANTS_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function isMerchantSaved(handle: string): boolean {
  const h = norm(handle);
  return readSavedMerchants().some((m) => norm(m.handle) === h);
}

export function saveMerchant(m: Omit<SavedMerchant, "savedAt">) {
  const h = norm(m.handle);
  if (!h) return;
  const rest = readSavedMerchants().filter((x) => norm(x.handle) !== h);
  write([{ handle: h, name: m.name || `@${h}`, avatar: m.avatar ?? null, savedAt: Date.now() }, ...rest]);
}

export function removeSavedMerchant(handle: string) {
  const h = norm(handle);
  write(readSavedMerchants().filter((x) => norm(x.handle) !== h));
}
