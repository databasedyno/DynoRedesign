import { FC, memo, useEffect } from "react";
import { Box } from "@mui/material";
import dynamic from "next/dynamic";
import HeroPlayground from "./v3/HeroPlayground";
import { Reveal } from "./v3/Reveal";
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
const CoinShowcaseV3 = dynamic(() => import("./v3/CoinShowcaseV3"));
const NumbersTrustBand = dynamic(() => import("./v3/NumbersTrustBand"));
const FAQCompact = dynamic(() => import("./v3/FAQCompact"));
const ReferralCtaBandV3 = dynamic(() => import("./v3/ReferralCtaBandV3"));
const FinalCTAAurora = dynamic(() => import("./v3/FinalCTAAurora"));
const WhyDynoPayV3 = dynamic(() => import("./v3/WhyDynoPayV3"));
const BrandSpotlightV3 = dynamic(() => import("./v3/BrandSpotlightV3"));
const DeveloperBandV3 = dynamic(() => import("./v3/DeveloperBandV3"));
const ProductShowcaseV3 = dynamic(() => import("./v3/ProductShowcaseV3"));
const CompareV3 = dynamic(() => import("./v3/CompareV3"));
const TrustLogosV3 = dynamic(() => import("./v3/TrustLogosV3"));
const MoreAboutV3 = dynamic(() => import("./v3/MoreAboutV3"));
// Scroll-driven navigators (rail + chip bar) — client-only by nature.
const LandingNav = dynamic(() => import("./v3/LandingNav"), { ssr: false });

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
    fetch(`${apiBase}/api/track/visitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, []);

  // Every section below the hero sits in a <Reveal/> — a bidirectional
  // scroll-linked fade/slide (replays on the way back up, reduced-motion aware).
  // Anchor ids match LANDING_SECTIONS (rail / chip bar / header hash links).
  // Pain, Solutions grid, Ways-to-get-paid, Who-pays-the-fee, Refunds and Learn are
  // folded into the tabbed MoreAboutV3 block (2026-09 "page is too long to navigate").
  const anchor = { scrollMarginTop: "88px" } as const;
  return (
    <HomeWrapper>
      <HeroPlayground />
      <LandingNav />
      <Reveal><TrustLogosV3 /></Reveal>
      <Box id="how-it-works" component="div" sx={anchor}>
        <Reveal><HowItWorksV3 /></Reveal>
      </Box>
      <Box id="use-cases" component="div" sx={anchor}>
        <Reveal><AudienceDoorsV3 /></Reveal>
      </Box>
      <Box id="features" component="div" sx={anchor}>
        <Reveal><ProductFeatureCards /></Reveal>
      </Box>
      <Reveal><ProductShowcaseV3 /></Reveal>
      <Box id="why-dynopay" component="div" sx={anchor}>
        <Reveal><WhyDynoPayV3 /></Reveal>
      </Box>
      <Reveal><BrandSpotlightV3 /></Reveal>
      <Box id="compare" component="div" sx={anchor}>
        <Reveal><CompareV3 /></Reveal>
      </Box>
      <Box id="coins" component="div" sx={anchor}>
        <Reveal><CoinShowcaseV3 /></Reveal>
      </Box>
      <Reveal><NumbersTrustBand /></Reveal>
      <Box id="developers" component="div" sx={anchor}>
        <Reveal><DeveloperBandV3 /></Reveal>
      </Box>
      <Box id="more" component="div" sx={anchor}>
        <Reveal><MoreAboutV3 /></Reveal>
      </Box>
      <Box id="faq" component="div" sx={anchor}>
        <Reveal><FAQCompact /></Reveal>
      </Box>
      <Reveal><ReferralCtaBandV3 /></Reveal>
      <Reveal><FinalCTAAurora /></Reveal>
    </HomeWrapper>
  );
};

export default memo(HomePage);
