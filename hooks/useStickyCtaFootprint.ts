import { useEffect } from "react";

// Publishes the height of a phone-only sticky bottom CTA as --dp-sticky-cta so
// floating controls (support FAB, scroll-to-top) lift above it — same pattern
// as --dp-lang-bar from LanguageOnboardingBar. Also flags <html data-dp-sticky-cta>
// so the first-visit language bar steps aside (two stacked bottom bars ate
// ~130px of an 844px checkout screen — E2E audit CK-04).
export default function useStickyCtaFootprint(active: boolean, px = 76) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const el = document.documentElement;
    el.style.setProperty("--dp-sticky-cta", `${px}px`);
    el.setAttribute("data-dp-sticky-cta", "1");
    return () => {
      el.style.setProperty("--dp-sticky-cta", "0px");
      el.removeAttribute("data-dp-sticky-cta");
    };
  }, [active, px]);
}
