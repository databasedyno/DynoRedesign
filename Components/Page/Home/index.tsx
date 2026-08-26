import { FC, memo, useEffect } from "react";
import { Box } from "@mui/material";
import dynamic from "next/dynamic";
import HeroPlayground from "./v3/HeroPlayground";
import { HomeWrapper } from "./styled";

/* HYDRATION BUDGET (2026-08 — "hamburger tap does nothing on mobile"):
 * everything below the hero is code-split. All of these sections used to sit
 * in the critical "/" chunk, so a phone had to download+parse+hydrate the
 * WHOLE landing page before ANY header tap handler existed — on mobile
 * WebKit/Blink that was seconds of dead taps on the top-right menu button.
 * next/dynamic keeps the server-rendered HTML (SEO unchanged) but moves the
 * JS into lazy chunks, so the header + hero hydrate first and become
 * interactive almost immediately. Do NOT convert these back to static
 * imports. ssr:true (default) is required — the HTML must not change. */
const LivePriceStrip = dynamic(() => import("./LivePriceStrip"));
const AudienceDoorsV3 = dynamic(() => import("./v3/AudienceDoorsV3"));
const ProductFeatureCards = dynamic(() => import("./v3/ProductFeatureCards"));
const NumbersTrustBand = dynamic(() => import("./v3/NumbersTrustBand"));
const LearnDocsCards = dynamic(() => import("./v3/LearnDocsCards"));
const FAQCompact = dynamic(() => import("./v3/FAQCompact"));
const FinalCTAAurora = dynamic(() => import("./v3/FinalCTAAurora"));

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
      <Box id="use-cases" component="div" sx={{ scrollMarginTop: "88px" }}>
        <AudienceDoorsV3 />
      </Box>
      <Box id="features" component="div" sx={{ scrollMarginTop: "88px" }}>
        <ProductFeatureCards />
      </Box>
      <NumbersTrustBand />
      <LearnDocsCards />
      <FAQCompact />
      <FinalCTAAurora />
    </HomeWrapper>
  );
};

export default memo(HomePage);
