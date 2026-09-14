/**
 * Fire-and-forget storefront visit beacon. Sends the browser's own UA / IP /
 * document.referrer to the backend (SSR fetches all look like one server), and
 * the merchant token when present so a creator viewing their own page is not
 * counted. Once per handle per tab session.
 */
export const sendCreatorVisitBeacon = (handle: string | null | undefined, surface: "page" | "shop"): void => {
  if (typeof window === "undefined" || !handle) return;
  const clean = String(handle).trim().toLowerCase();
  const guardKey = `dp_cv:${clean}`;
  try {
    if (window.sessionStorage.getItem(guardKey)) return;
    window.sessionStorage.setItem(guardKey, "1");
  } catch {
    /* storage unavailable — still send once */
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = window.localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  void fetch(`${base}/api/pay/creator/${encodeURIComponent(clean)}/visit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ referrer: document.referrer || "", surface }),
    keepalive: true,
  }).catch(() => {});
};
