import { FC, memo, useEffect } from "react";
import { HomeWrapper } from "./styled";
import { LandingMetricsContext, type LandingMetrics } from "./v5/useLandingMetrics";

/* Landing v7 (2026-06 Bybit-style revamp): exactly nine sections, each answering
 * one visitor question. Static imports keep it simple and SSR renders the full
 * HTML for SEO. The old v3/v5/v6 sprawl is retired from the homepage (those
 * components still power other marketing pages like /fees). */
import HeroV7 from "./v7/HeroV7";
import CoinsStripV7 from "./v7/CoinsStripV7";
import TrustBarV7 from "./v7/TrustBarV7";
import HowItWorksV7 from "./v7/HowItWorksV7";
import ThreeWaysV7 from "./v7/ThreeWaysV7";
import WhyDynopayV7 from "./v7/WhyDynopayV7";
import ProofV7 from "./v7/ProofV7";
import PricingV7 from "./v7/PricingV7";
import FAQV7 from "./v7/FAQV7";
import FinalCTAV7 from "./v7/FinalCTAV7";

/**
 * HomePage v7 — Bybit-style, exactly nine sections (LANDING_REVAMP_PLAN_2026-06):
 *
 *   1. HeroV7        — What is it?            (headline + two CTAs)
 *   2. TrustBarV7    — Can I trust it?        (3 live metrics + View live status)
 *   3. HowItWorksV7  — How does it work?      (3 steps)
 *   4. ThreeWaysV7   — How can I use it?      (No code · Checkout · API)
 *   5. WhyDynopayV7  — Why use it?            (4 points)
 *   6. ProofV7       — Do others trust it?    (2 merchant stories)
 *   7. PricingV7     — What does it cost?     (from 1.5% → /fees)
 *   8. FAQV7         — What if…?              (4 questions + FAQPage JSON-LD)
 *   9. FinalCTAV7    — How do I get started?  (headline + Start free)
 *
 * Products → /products · calculator & chain times → /fees · API → /documentation.
 * Anchor ids (#how-it-works, #products, #pricing, #faq) keep header/footer hash links working.
 */
const HomePage: FC<{ landingMetrics?: LandingMetrics | null }> = ({ landingMetrics = null }) => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "dynopay_visitor_tracked";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    fetch(`${apiBase}/api/track/visitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, []);

  return (
    <LandingMetricsContext.Provider value={landingMetrics}>
    <HomeWrapper>
      <HeroV7 />
      <CoinsStripV7 />
      <TrustBarV7 />
      <HowItWorksV7 />
      <ThreeWaysV7 />
      <WhyDynopayV7 />
      <ProofV7 />
      <PricingV7 />
      <FAQV7 />
      <FinalCTAV7 />
    </HomeWrapper>
    </LandingMetricsContext.Provider>
  );
};

export default memo(HomePage);
