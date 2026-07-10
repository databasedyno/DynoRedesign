import { FC, memo, useEffect } from "react";
import HeroSwiss from "./HeroSwiss";
import ChainsMarquee from "./ChainsMarquee";
import ProductShowcase from "./ProductShowcase";
import StatWall from "./StatWall";
import FeeCalculator from "./FeeCalculator";
import CoreValueProps from "./CoreValueProps";
import UseCasesBento from "./UseCasesBento";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import TestimonialsV2 from "./TestimonialsV2";
import FAQ from "./FAQ";
import FinalCTA from "./FinalCTA";
import { HomeWrapper } from "./styled";

/**
 * HomePage — "Swiss & High-Contrast" redesign (2026-07-10, session 16).
 *
 * Structure:
 *   1. HeroSwiss           — left-aligned Unbounded type + live settlement terminal
 *   2. ChainsMarquee       — mono marquee of the 13 settlement chains
 *   3. ProductShowcase     — animated product story (checkout → settlement → API)
 *   4. StatWall            — 4 massive numbers ($0 / 0.5% / <5min / 13)
 *   5. FeeCalculator       — vertical-bar cost comparison (01 / Pricing)
 *   6. CoreValueProps      — three flat cards, volt top-border (02 / Why DynoPay)
 *   7. UseCasesBento       — product-forward bento grid, no stock photos (03)
 *   8. ComplianceLogoStrip — inverted obsidian trust band
 *   9. TestimonialsV2      — editorial quotes (04)
 *  10. FAQ                 — borderline accordion (05)
 *  11. FinalCTA            — obsidian band, "The old rails are slow."
 */
const HomePage: FC = () => {
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
    <HomeWrapper>
      <HeroSwiss />
      <ChainsMarquee />
      <ProductShowcase />
      <StatWall />
      <FeeCalculator />
      <CoreValueProps />
      <UseCasesBento />
      <ComplianceLogoStrip />
      <TestimonialsV2 />
      <FAQ />
      <FinalCTA />
    </HomeWrapper>
  );
};

export default memo(HomePage);
