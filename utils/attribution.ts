import axiosBaseApi from "@/axiosConfig";

/**
 * First-touch signup attribution (client side).
 *
 * captureFirstTouch(): on the very first page a visitor lands on, records
 * document.referrer + any utm_* params + the landing path into localStorage
 * (once — first touch wins, survives navigation and the whole signup flow).
 *
 * syncAttribution(): once the visitor is authenticated, sends that stored
 * first-touch to the backend a single time. Fire-and-forget; never blocks or
 * throws. The backend adds server-derived IP→country and stores one row per
 * user (POST /api/track/attribution is idempotent — first write wins).
 */
const FIRST_TOUCH_KEY = "dp_first_touch";
const SYNCED_KEY = "dp_attr_synced";

export function captureFirstTouch(): void {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm = {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      term: params.get("utm_term"),
      content: params.get("utm_content"),
    };
    const data = {
      referrer: document.referrer || null,
      landing_page: window.location.pathname || "/",
      utm,
      ts: Date.now(),
    };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
  } catch {
    /* attribution must never break the page */
  }
}

export function syncAttribution(): void {
  try {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("token")) return;
    if (localStorage.getItem(SYNCED_KEY)) return;
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    const payload = raw
      ? JSON.parse(raw)
      : { referrer: document.referrer || null, landing_page: window.location.pathname || "/", utm: {} };
    axiosBaseApi
      .post("track/attribution", payload)
      .then(() => localStorage.setItem(SYNCED_KEY, "1"))
      .catch(() => {});
  } catch {
    /* never break the app */
  }
}
