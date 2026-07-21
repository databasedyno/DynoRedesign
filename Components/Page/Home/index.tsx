import { FC, memo, useEffect } from "react";
import HeroPlayground from "./v3/HeroPlayground";
import LivePriceStrip from "./LivePriceStrip";
import AudienceDoorsV3 from "./v3/AudienceDoorsV3";
import ProductStoryV3 from "./v3/ProductStoryV3";
import ProductFeatureCards from "./v3/ProductFeatureCards";
import TryItNowV3 from "./v3/TryItNowV3";
import NumbersTrustBand from "./v3/NumbersTrustBand";
import LearnDocsCards from "./v3/LearnDocsCards";
import FAQCompact from "./v3/FAQCompact";
import FinalCTAAurora from "./v3/FinalCTAAurora";
import { HomeWrapper } from "./styled";

/**
 * HomePage v3 — "Creator-first, cut in half" (2026-07-18).
 *
 * The site now ships six intentional moments instead of sixteen mini-sections.
 * Every previous section (HeroSwiss, Features, Testimonials, UseCasesBento,
 * etc.) is retained in-repo but unwired from the stack below so it can be
 * A/B'd back on with a single import swap.
 *
 * Order (2026-07-21 — Coinbase-inspired refinements, additive):
 *   1. HeroPlayground        — monumental headline + $500 fee-free reward hook + live @handle card
 *   2. LivePriceStrip        — real-time BTC/ETH/… ticker (self-hides if no data) "this is live"
 *   3. AudienceDoorsV3       — four coloured doors (Merchants / Fundraisers / Creators / Developers)
 *   4. ProductStoryV3        — three-step scroll story (Pay → Convert → Land in wallet)
 *   5. ProductFeatureCards   — Coinbase-style "one idea per card" capability band (Checkout / Auto-convert / API)
 *   6. TryItNowV3            — dark obsidian playground: cURL + 201 response
 *   7. NumbersTrustBand      — four big stats + compliance badges (merges StatWall + Compliance)
 *   8. LearnDocsCards        — education band (Docs / Learn / Fees) — reduces newbie anxiety
 *   9. FAQCompact            — five real questions
 *  10. FinalCTAAurora        — aurora obsidian band; bookends the $500 fee-free offer from the hero
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
      <HeroPlayground />
      <LivePriceStrip />
      <AudienceDoorsV3 />
      <ProductStoryV3 />
      <ProductFeatureCards />
      <TryItNowV3 />
      <NumbersTrustBand />
      <LearnDocsCards />
      <FAQCompact />
      <FinalCTAAurora />
    </HomeWrapper>
  );
};

export default memo(HomePage);
