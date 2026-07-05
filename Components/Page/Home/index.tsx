import { FC, memo, useEffect } from "react";
import HeroV2 from "./HeroV2";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import LivePriceStrip from "./LivePriceStrip";
import SupportedChainsRail from "./SupportedChainsRail";
import FeeCalculator from "./FeeCalculator";
import TryItNow from "./TryItNow";
import CoreValueProps from "./CoreValueProps";
import TestimonialsV2 from "./TestimonialsV2";
import FinalCTA from "./FinalCTA";
import FAQ from "./FAQ";
import StickyPromoBar from "@/Components/Common/StickyPromoBar";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

/**
 * HomePage — order optimized for conversion, trimmed 2026-07-05 for clarity.
 *
 *   1. StickyPromoBar (C)              — $500 fee-free bar at the very top
 *   2. LivePriceStrip                  — real-time crypto prices
 *   3. HeroV2 (A + J + M + K)          — product-tabbed hero, audience switcher,
 *                                        mesh gradient, country personalization
 *   4. ComplianceLogoStrip (F)         — SOC 2 · GDPR · PCI DSS · KYT · Chainalysis
 *   5. SupportedChainsRail             — chain logos
 *   6. FeeCalculator (B)               — interactive slider + savings vs picked competitor
 *   7. TryItNow                        — embedded checkout + curl
 *   8. CoreValueProps                  — 4 core benefits
 *   9. TestimonialsV2 (H)              — richer cards with initials avatars
 *  10. FAQ
 *  11. FinalCTA
 *
 * REMOVED 2026-07-05 per user feedback ("landing looks too busy, not clean"):
 *   • ComparisonTable (L)  — "How we stack up" — user said "doesn't appear needed"
 *   • ExitIntentModal (N)  — kept re-firing on any mouse-toward-tabs move,
 *                             annoying users who weren't actually leaving
 *   • LiveActivityStrip    — was CURATED FAKE data (per its own file header)
 *   • IndustryLogoWall (G) — used fabricated per-industry merchant counts
 *
 * Components still live in the repo for A/B rollback if we want them back.
 */
const HomePage: FC = () => {
  // ─── Visitor tracking: notify admin of new unique visitors ───
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
    <>
      {/* C — sticky promo bar. Rendered outside HomeWrapper so it can sit above the header. */}
      <StickyPromoBar />

      <HomeWrapper>
        {/* Live crypto price strip — signals "this is a real-time crypto product" */}
        <HomeFullWidthContainer>
          <LivePriceStrip />
        </HomeFullWidthContainer>

        {/* A + J + M + K — new hero */}
        <HomeFullWidthContainer>
          <HeroV2 />
        </HomeFullWidthContainer>

        {/* F — compliance & infra badges */}
        <HomeFullWidthContainer>
          <ComplianceLogoStrip />
        </HomeFullWidthContainer>

        {/* Supported chains rail */}
        <HomeFullWidthContainer>
          <SupportedChainsRail />
        </HomeFullWidthContainer>

        {/* B — interactive fee calculator (highest-converting section) */}
        <HomeFullWidthContainer>
          <FeeCalculator />
        </HomeFullWidthContainer>

        {/* Interactive playground: embedded checkout + curl */}
        <HomeFullWidthContainer>
          <TryItNow />
        </HomeFullWidthContainer>

        <HomeContainer>
          <CoreValueProps />
        </HomeContainer>

        {/* H — testimonial cards with initials + chain badges */}
        <HomeFullWidthContainer>
          <TestimonialsV2 />
        </HomeFullWidthContainer>

        <HomeFullWidthContainer>
          <FAQ />
        </HomeFullWidthContainer>

        <HomeFullWidthContainer>
          <FinalCTA />
        </HomeFullWidthContainer>
      </HomeWrapper>
    </>
  );
};

export default memo(HomePage);
