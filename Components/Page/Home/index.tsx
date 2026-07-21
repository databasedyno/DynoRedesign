import { FC, memo, useEffect } from "react";
import HeroPlayground from "./v3/HeroPlayground";
import LivePriceStrip from "./LivePriceStrip";
import AudienceDoorsV3 from "./v3/AudienceDoorsV3";
import ProductFeatureCards from "./v3/ProductFeatureCards";
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
 * Order (2026-07-21 — Coinbase-calm refinement: leaner + more whitespace + indigo accent):
 *   1. HeroPlayground        — headline + $500 fee-free reward hook + live @handle card
 *   2. LivePriceStrip        — real-time BTC/ETH/… ticker (self-hides if no data)
 *   3. AudienceDoorsV3       — four doors (Merchants / Fundraisers / Creators / Developers)
 *   4. ProductFeatureCards   — Coinbase-style "one idea per card" band (Checkout / Auto-convert / API)
 *   5. NumbersTrustBand      — four big stats + compliance badges
 *   6. LearnDocsCards        — education band (Docs / Learn / Fees)
 *   7. FAQCompact            — five real questions
 *   8. FinalCTAAurora        — dark close; bookends the $500 fee-free offer from the hero
 *
 * Trimmed from the stack (kept in-repo, unwired) for a cleaner, airier page:
 * ProductStoryV3 (redundant with ProductFeatureCards) and TryItNowV3 (dev-niche → lives in /documentation).
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
      <ProductFeatureCards />
      <NumbersTrustBand />
      <LearnDocsCards />
      <FAQCompact />
      <FinalCTAAurora />
    </HomeWrapper>
  );
};

export default memo(HomePage);
