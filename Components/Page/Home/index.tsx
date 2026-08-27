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
const HowItWorksV3 = dynamic(() => import("./v3/HowItWorksV3"));
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
 * Order (2026-08 — merchant-first conversion pass: one clear promise + one primary action):
 *   1. HeroPlayground        — "accept crypto → settle in stablecoin" + primary CTA + checkout demo card
 *   2. HowItWorksV3          — 3-step path to first payment (replaced the crypto price ticker)
 *   3. AudienceDoorsV3       — four doors (Merchants primary / Fundraisers / Creators / Developers)
 *   4. ProductFeatureCards   — Coinbase-style "one idea per card" band (Checkout / Auto-convert / API)
 *   5. NumbersTrustBand      — honest stats + compliance badges
 *   6. LearnDocsCards        — education band (Docs / Learn / Fees)
 *   7. FAQCompact            — five real questions
 *   8. FinalCTAAurora        — dark close; bookends the "first payment fee-free" offer from the hero
 *
 * LivePriceStrip is retained in-repo but unwired (gave an "exchange" feel that distracted from
 * "accept payments"). ProductStoryV3 + TryItNowV3 also kept in-repo, unwired.
 */
const HomePage: FC = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "dynopay_visitor_tracked";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    const url = `${apiBase}/api/track/visitor`;
    const payload = JSON.stringify({
      page: window.location.pathname,
      referrer: document.referrer || null,
    });

    // Fire-and-forget visitor beacon. Prefer navigator.sendBeacon so the request
    // is queued at the browser level and completes even if the user navigates
    // away immediately (SPA route change or full unload). A plain fetch gets
    // ABORTED on navigation, surfacing as a noisy net::ERR_ABORTED failed request.
    // Falls back to fetch({ keepalive: true }) when sendBeacon is unavailable.
    try {
      const beacon =
        typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
          ? navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))
          : false;
      if (!beacon) {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Tracking must never break the page.
    }
  }, []);

  return (
    <HomeWrapper>
      <HeroPlayground />
      <HowItWorksV3 />
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
