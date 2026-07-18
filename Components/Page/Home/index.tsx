import { FC, memo, useEffect } from "react";
import HeroPlayground from "./v3/HeroPlayground";
import AudienceDoorsV3 from "./v3/AudienceDoorsV3";
import ProductStoryV3 from "./v3/ProductStoryV3";
import TryItNowV3 from "./v3/TryItNowV3";
import NumbersTrustBand from "./v3/NumbersTrustBand";
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
 * Order:
 *   1. HeroPlayground        — monumental headline + live @handle card + handle claim input
 *   2. AudienceDoorsV3       — four coloured doors (Merchants / Fundraisers / Creators / Developers)
 *   3. ProductStoryV3        — three-step scroll story (Pay → Convert → Land in wallet) with real screenshots
 *   4. TryItNowV3            — dark obsidian playground: cURL + 201 response
 *   5. NumbersTrustBand      — four big stats + compliance badges (merges StatWall + Compliance)
 *   6. FAQCompact            — five real questions
 *   7. FinalCTAAurora        — aurora obsidian band with volt CTA
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
      <AudienceDoorsV3 />
      <ProductStoryV3 />
      <TryItNowV3 />
      <NumbersTrustBand />
      <FAQCompact />
      <FinalCTAAurora />
    </HomeWrapper>
  );
};

export default memo(HomePage);
