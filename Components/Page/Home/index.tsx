import { FC, memo, useEffect } from "react";
import dynamic from "next/dynamic";
import HeroV6 from "./v6/HeroV6";
import { HomeWrapper } from "./styled";
import { LandingMetricsContext, type LandingMetrics } from "./v5/useLandingMetrics";

/* HYDRATION BUDGET (2026-08 — "hamburger tap does nothing on mobile"):
 * everything below the hero is code-split. next/dynamic keeps the
 * server-rendered HTML (SEO unchanged) but moves the JS into lazy chunks, so
 * the header + hero hydrate first and become interactive almost immediately.
 * Do NOT convert these back to static imports. ssr:true (default) is required. */
const ProductsBento = dynamic(() => import("./v6/ProductsBento"));
const ConversionStory = dynamic(() => import("./v6/ConversionStory"));
const NumbersBand = dynamic(() => import("./v6/NumbersBand"));
const ProofV6 = dynamic(() => import("./v6/ProofV6"));
const MerchantStoriesV6 = dynamic(() => import("./v6/MerchantStoriesV6"));
const GlobalV6 = dynamic(() => import("./v6/GlobalV6"));
const DevelopersV6 = dynamic(() => import("./v6/DevelopersV6"));
const PricingTeaser = dynamic(() => import("./v6/PricingTeaser"));
const TrustSecurityV5 = dynamic(() => import("./v5/TrustSecurityV5"));
const ResourcesV6 = dynamic(() => import("./v6/ResourcesV6"));
const FAQV5 = dynamic(() => import("./v5/FAQV5"));
const FinalCTAV6 = dynamic(() => import("./v6/FinalCTAV6"));
// Scroll-driven navigators — client-only by nature.
const LandingNav = dynamic(() => import("./v3/LandingNav"), { ssr: false });
const StickyMobileCta = dynamic(() => import("./v5/StickyMobileCta"), { ssr: false });

/**
 * HomePage v6 — "Stripe quality" structure (plan/plan.md §2.3):
 *
 *   1. HeroV6           — statement headline over the animated conversion gradient, floating sandbox checkout, live strip
 *   2. ProductsBento    — seven surfaces as a bento grid, each a UI vignette built from the product
 *   3. ConversionStory  — buyer pays BTC → you receive USDC → your wallet (animated), three steps + network ETAs
 *   4. NumbersBand      — four live stats + settlements by chain (30d), server-rendered
 *   5. ProofV6          — verify it yourself: real on-chain settlements + status/docs/languages
 *   5b. MerchantStoriesV6 — three live merchants (The Dev Store · SafeDeal · Nameword) in their own words
 *   6. GlobalV6         — world map, live country count, coins & chains grid, wallets strip
 *   7. DevelopersV6     — No-code · Pre-built · Build your own + live request/response
 *   8. PricingTeaser    — tier ladder + calculator (comparison table lives on /fees)
 *   9. TrustSecurityV5  — the nine shipped controls, tight grid
 *  10. ResourcesV6      — published posts + guides carousel
 *  11. FAQV5            — eight highest-intent questions + FAQPage JSON-LD
 *  12. FinalCTAV6       — headline + two cards (See pricing · Start building)
 *
 * Section anchor ids match LANDING_SECTIONS (chip bar + header/footer hash links).
 */
const HomePage: FC<{ landingMetrics?: LandingMetrics | null }> = ({ landingMetrics = null }) => {
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
    <LandingMetricsContext.Provider value={landingMetrics}>
    <HomeWrapper>
      <HeroV6 />
      <LandingNav />
      <ProductsBento />
      <ConversionStory />
      <NumbersBand />
      <ProofV6 />
      <MerchantStoriesV6 />
      <GlobalV6 />
      <DevelopersV6 />
      <PricingTeaser />
      <TrustSecurityV5 />
      <ResourcesV6 />
      <FAQV5 />
      <FinalCTAV6 />
      <StickyMobileCta />
    </HomeWrapper>
    </LandingMetricsContext.Provider>
  );
};

export default memo(HomePage);
