import i18n, { loadLanguageAsync } from "@/i18n";

export const SUPPORTED_LANGUAGES = ["en", "pt", "fr", "es", "de", "nl"] as const;

const LS_LANG = "lang";
// "pending sync": a manual choice made locally (e.g. picked on the landing page
// while logged out) that has NOT yet been saved to the user's account. It is
// pushed to the account on the next authenticated load, then cleared.
const LS_PENDING = "lang_manual";

function isSupported(lng: string): boolean {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);
}

// Mirror the chosen language into a cookie so server-rendered pages (e.g. the
// public shop/product SEO <Head> meta) can localize snippets. This is the only
// server-visible language signal and is written ONLY on an explicit user choice
// — never auto-detected — matching the app's "explicit choice only" i18n policy.
function writeLangCookie(base: string): void {
  try {
    if (typeof document === "undefined") return;
    document.cookie = `dp_lang=${encodeURIComponent(base)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* private mode — ignore */
  }
}

function isLoggedIn(): boolean {
  try {
    return typeof window !== "undefined" && !!localStorage.getItem("token");
  } catch {
    return false;
  }
}

// Buyer/checkout surfaces: the "language" there belongs to the customer's
// checkout session, never the merchant's account — so we never PUT the merchant
// profile from these routes (a stale merchant token would 401 → bounce the
// buyer to /auth/login mid-checkout).
function isCheckoutSurface(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname || "";
  return (
    path === "/pay" ||
    path.startsWith("/pay/") ||
    path.startsWith("/pay-links/") ||
    path.startsWith("/payment")
  );
}

async function saveLanguageToAccount(lng: string): Promise<boolean> {
  try {
    const { default: axiosBaseApi } = await import("@/axiosConfig");
    await axiosBaseApi.put("user/profile", { language: lng });
    return true;
  } catch {
    return false;
  }
}

/**
 * Single entry point for a user-initiated language change — every language
 * switcher calls this. It applies the language, persists it locally, and, when
 * a merchant is signed in, saves it to their account so the choice follows them
 * across devices. When logged out (e.g. on the landing page) the choice is
 * flagged "pending sync" and pushed to the account on the next authenticated
 * load (see `reconcileLanguageOnAuth`).
 */
export async function setAppLanguage(lng: string): Promise<void> {
  const base = (lng || "").split("-")[0];
  if (!isSupported(base)) return;

  try {
    await loadLanguageAsync(base);
  } catch {
    /* fall back to the already-loaded bundle */
  }
  await i18n.changeLanguage(base);

  try {
    localStorage.setItem(LS_LANG, base);
  } catch {
    /* private mode — ignore */
  }
  writeLangCookie(base);

  if (isLoggedIn() && !isCheckoutSurface()) {
    const ok = await saveLanguageToAccount(base);
    try {
      if (ok) localStorage.removeItem(LS_PENDING);
      else localStorage.setItem(LS_PENDING, "true");
    } catch {}
  } else {
    // Logged out or on a buyer surface → remember as a pending manual choice so
    // it syncs up to the account after the user logs in.
    try {
      localStorage.setItem(LS_PENDING, "true");
    } catch {}
  }
}

/**
 * Reconcile the client language with the signed-in user's account language.
 * Called once per authenticated session from `LanguageBootstrap`.
 *
 * 1. A pending local choice (e.g. picked on the landing page before logging in)
 *    WINS and is pushed up to the account.
 * 2. Otherwise the account language is the source of truth and is applied here,
 *    so a language chosen on one device follows the user to another.
 */
export async function reconcileLanguageOnAuth(): Promise<void> {
  if (!isLoggedIn()) return;

  let localLang: string | null = null;
  let pending = false;
  try {
    localLang = localStorage.getItem(LS_LANG);
    pending = localStorage.getItem(LS_PENDING) === "true";
  } catch {}

  // 1) Pending local choice → the account catches up to this device.
  if (pending && localLang && isSupported(localLang)) {
    if (localLang !== i18n.language) {
      try {
        await loadLanguageAsync(localLang);
      } catch {}
      await i18n.changeLanguage(localLang);
    }
    const ok = await saveLanguageToAccount(localLang);
    try {
      if (ok) localStorage.removeItem(LS_PENDING);
    } catch {}
    return;
  }

  // 2) Account language is the source of truth → this device catches up.
  try {
    const { default: axiosBaseApi } = await import("@/axiosConfig");
    const res: any = await axiosBaseApi.get("user/profile");
    const serverLang = String(res?.data?.data?.language || "").split("-")[0];
    if (serverLang && isSupported(serverLang) && serverLang !== i18n.language) {
      try {
        await loadLanguageAsync(serverLang);
      } catch {}
      await i18n.changeLanguage(serverLang);
      try {
        localStorage.setItem(LS_LANG, serverLang);
      } catch {}
      writeLangCookie(serverLang);
    }
  } catch {
    /* best-effort — network/401 failures never block the UI */
  }
}
