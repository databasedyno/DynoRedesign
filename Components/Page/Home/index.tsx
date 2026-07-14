import { FC, memo, useEffect } from "react";
import HeroSwiss from "./HeroSwiss";
import AudienceDoors from "./AudienceDoors";
import ChainsMarquee from "./ChainsMarquee";
import ProductShowcase from "./ProductShowcase";
import CrowdfundingShowcase from "./CrowdfundingShowcase";
import CreatorShowcase from "./CreatorShowcase";
import DeveloperShowcase from "./DeveloperShowcase";
import TryItNow from "./TryItNow";
import StatWall from "./StatWall";
import FeeStrip from "./FeeStrip";
import CoreValueProps from "./CoreValueProps";
import UseCasesBento from "./UseCasesBento";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import TestimonialsV2 from "./TestimonialsV2";
import FAQ from "./FAQ";
import FinalCTA from "./FinalCTA";
import { HomeWrapper } from "./styled";

/**
 * HomePage — "Three surfaces, one wallet" (2026-07-14 revision).
 *
 * Order:
 *   1. HeroSwiss              — positioning + settlement terminal
 *   2. AudienceDoors          — four "who is this for" doors (Merchants · Fundraisers · Creators · Developers)
 *   3. ChainsMarquee          — mono marquee of the 15+ settlement chains
 *   4. ProductShowcase        — animated product story (checkout → settlement → API)
 *   5. CrowdfundingShowcase   — dedicated section: story + tiers + updates + donor wall
 *   6. CreatorShowcase        — dedicated section: @handle + tips + inline checkout
 *   7. DeveloperShowcase      — dedicated section: mock IDE (cURL + 201) + integrate in ~10 min
 *   8. TryItNow (#try-it-now) — interactive playground: live checkout iframe + copy-paste sandbox curl
 *   9. StatWall               — four massive product numbers
 *  10. CoreValueProps         — three flat cards, volt top-border
 *  11. UseCasesBento          — product-forward bento grid
 *  12. FeeStrip               — compact 3-column fee band
 *  13. ComplianceLogoStrip    — inverted obsidian trust band
 *  14. TestimonialsV2         — editorial quotes
 *  15. FAQ                    — borderline accordion
 *  16. FinalCTA               — obsidian band
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
      <AudienceDoors />
      <ChainsMarquee />
      <ProductShowcase />
      <CrowdfundingShowcase />
      <CreatorShowcase />
      <DeveloperShowcase />
      <div id="try-it-now" aria-hidden />
      <TryItNow />
      <StatWall />
      <CoreValueProps />
      <UseCasesBento />
      <FeeStrip />
      <ComplianceLogoStrip />
      <TestimonialsV2 />
      <FAQ />
      <FinalCTA />
    </HomeWrapper>
  );
};

export default memo(HomePage);
