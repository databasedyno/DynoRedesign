import { FC, memo, useEffect } from "react";
import HeroV2 from "./HeroV2";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import LiveActivityStrip from "./LiveActivityStrip";
import LivePriceStrip from "./LivePriceStrip";
import SupportedChainsRail from "./SupportedChainsRail";
import FeeCalculator from "./FeeCalculator";
import TryItNow from "./TryItNow";
import CoreValueProps from "./CoreValueProps";
import ComparisonTable from "./ComparisonTable";
import IndustryLogoWall from "./IndustryLogoWall";
import TestimonialsV2 from "./TestimonialsV2";
import FinalCTA from "./FinalCTA";
import FAQ from "./FAQ";
import StickyPromoBar from "@/Components/Common/StickyPromoBar";
import ExitIntentModal from "@/Components/Modals/ExitIntentModal";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

/**
 * HomePage — order optimized for conversion:
 *
 *   1. StickyPromoBar (C)              — $500 fee-free bar at the very top
 *   2. LivePriceStrip                  — real-time crypto prices (existing)
 *   3. HeroV2 (A + J + M + K)          — product-tabbed hero, audience switcher,
 *                                        mesh gradient, country personalization
 *   4. ComplianceLogoStrip (F)         — SOC 2 · GDPR · PCI DSS · KYT · Chainalysis
 *   5. LiveActivityStrip               — anonymized settlement ticker (existing)
 *   6. SupportedChainsRail             — chain logos
 *   7. FeeCalculator (B)               — interactive slider + savings vs picked competitor
 *   8. TryItNow                        — embedded checkout + curl (existing)
 *   9. CoreValueProps                  — 4 core benefits (existing)
 *  10. ComparisonTable (L)             — DynoPay vs Coinbase Commerce / BitPay / Stripe
 *  11. IndustryLogoWall (G)            — anonymized industry-silhouette wall
 *  12. TestimonialsV2 (H)              — richer cards with initials avatars
 *  13. FAQ                             — existing
 *  14. FinalCTA                        — existing
 *
 * Plus:
 *   • ExitIntentModal (N)              — fires on mouse-leave-top (desktop only)
 *   • Sticky nav / status pill (D + E) — inside HomeHeader (see Layout/HomeHeader)
 *   • DemoVideoModal (I)               — mounted inside HeroV2, opens on "Watch demo"
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

        {/* Anonymized, live-feeling activity strip */}
        <HomeFullWidthContainer>
          <LiveActivityStrip />
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

        {/* L — head-to-head vs Coinbase Commerce, BitPay, Stripe */}
        <HomeFullWidthContainer>
          <ComparisonTable />
        </HomeFullWidthContainer>

        {/* G — industry logo wall (anonymized) */}
        <HomeFullWidthContainer>
          <IndustryLogoWall />
        </HomeFullWidthContainer>

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

      {/* N — desktop-only exit-intent modal */}
      <ExitIntentModal />
    </>
  );
};

export default memo(HomePage);
