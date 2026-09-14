import { useEffect } from "react";

// Publishes the height of a phone-only sticky bottom CTA as --dp-sticky-cta so
// floating controls (support FAB, scroll-to-top) lift above it — same pattern
// as --dp-lang-bar from LanguageOnboardingBar.
export default function useStickyCtaFootprint(active: boolean, px = 76) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const el = document.documentElement;
    el.style.setProperty("--dp-sticky-cta", `${px}px`);
    return () => el.style.setProperty("--dp-sticky-cta", "0px");
  }, [active, px]);
}
