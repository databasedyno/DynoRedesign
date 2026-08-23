import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import i18n, { applyDetectedLanguage } from "@/i18n";
import { reconcileLanguageOnAuth } from "@/helpers/setAppLanguage";

function updateHtmlLang(lang: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

// Public buyer surfaces never carry a merchant's account language, so the
// account-language reconcile is skipped there (mirrors CompanyDataContext's
// isBuyerRoute) to avoid a stale-token 401 → bounce mid-checkout. Uses the
// route PATTERN (router.pathname), so it correctly excludes in-app /pay-links.
function isBuyerRoute(pathname: string): boolean {
  return (
    pathname === "/pay" ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/payment") ||
    pathname === "/[handle]" ||
    pathname.startsWith("/[handle]/") ||
    pathname.startsWith("/order/")
  );
}

export default function LanguageBootstrap() {
  const router = useRouter();
  const reconciledRef = useRef(false);

  // Apply the user's SAVED language once after hydration + keep <html lang> in
  // sync. English is the default — no browser/timezone/IP auto-detection.
  useEffect(() => {
    applyDetectedLanguage().then(() => updateHtmlLang(i18n.language));
    const onLangChanged = (lng: string) => updateHtmlLang(lng);
    i18n.on("languageChanged", onLangChanged);
    return () => {
      i18n.off("languageChanged", onLangChanged);
    };
  }, []);

  // Reconcile the language with the signed-in user's account (cross-device).
  // Re-checks on every navigation + window focus because the token can appear
  // AFTER mount (client-side login fires no same-tab storage event).
  useEffect(() => {
    const maybeReconcile = () => {
      let hasToken = false;
      try {
        hasToken = !!localStorage.getItem("token");
      } catch {}
      if (!hasToken) {
        reconciledRef.current = false; // reset so the next login reconciles again
        return;
      }
      if (reconciledRef.current) return;
      if (isBuyerRoute(router.pathname)) return;
      reconciledRef.current = true;
      reconcileLanguageOnAuth();
    };
    maybeReconcile();
    window.addEventListener("focus", maybeReconcile);
    return () => window.removeEventListener("focus", maybeReconcile);
  }, [router.pathname]);

  return null;
}
