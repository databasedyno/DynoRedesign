import { FC, memo, useEffect } from "react";
import dynamic from "next/dynamic";
import HeroV5 from "./v5/HeroV5";
import { HomeWrapper } from "./styled";

/* HYDRATION BUDGET (2026-08 — "hamburger tap does nothing on mobile"):
 * everything below the hero is code-split. next/dynamic keeps the
 * server-rendered HTML (SEO unchanged) but moves the JS into lazy chunks, so
 * the header + hero hydrate first and become interactive almost immediately.
 * Do NOT convert these back to static imports. ssr:true (default) is required. */
const ProofBandV5 = dynamic(() => import("./v5/ProofBandV5"));
const OnchainProofV5 = dynamic(() => import("./v5/OnchainProofV5"));
const HowItWorksV5 = dynamic(() => import("./v5/HowItWorksV5"));
const ProductsV5 = dynamic(() => import("./v5/ProductsV5"));
const PricingV5 = dynamic(() => import("./v5/PricingV5"));
const TrustSecurityV5 = dynamic(() => import("./v5/TrustSecurityV5"));
const DevelopersV5 = dynamic(() => import("./v5/DevelopersV5"));
const CoinsV5 = dynamic(() => import("./v5/CoinsV5"));
const FAQV5 = dynamic(() => import("./v5/FAQV5"));
const GlobalReachV5 = dynamic(() => import("./v5/GlobalReachV5"));
const FinalCTAV5 = dynamic(() => import("./v5/FinalCTAV5"));
// Scroll-driven navigators — client-only by nature.
const LandingNav = dynamic(() => import("./v3/LandingNav"), { ssr: false });
const StickyMobileCta = dynamic(() => import("./v5/StickyMobileCta"), { ssr: false });

/**
 * HomePage v5 — "nine concise moments" (2026-09 landing audit + re-imagining).
 *
 *   1. HeroV5           — one promise, one action, interactive checkout demo + live proof strip
 *   2. ProofBandV5      — "built in the open": status, docs, on-chain settlement, global
 *   3. HowItWorksV5     — 3 steps + network ETAs straight from the checkout catalogue
 *   4. ProductsV5       — one tabbed showcase (links / checkout / storefront / invoices / embeds / API)
 *   5. PricingV5        — tier ladder + fee calculator + who-pays toggle + compare table
 *   6. TrustSecurityV5  — the shipped controls (non-custodial, 2FA, wallet lock, webhooks, KYC…)
 *   7. DevelopersV5     — cURL / Node / Python tabs + real response shape
 *   8. CoinsV5          — every supported code from CRYPTO_INFO
 *   9. FAQV5            — eleven real questions + FAQPage JSON-LD
 *  10. FinalCTAV5       — Start free · Try a live checkout · Talk to us
 *
 * Section anchor ids match LANDING_SECTIONS (chip bar + header/footer hash links).
 * MOTION (2026-09, Hostinger study): each section owns its own staggered
 * reveals (`motion/Stagger`) — no whole-section fade wrapper any more.
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
      <HeroV5 />
      <LandingNav />
      <ProofBandV5 />
      <OnchainProofV5 />
      <HowItWorksV5 />
      <ProductsV5 />
      <PricingV5 />
      <TrustSecurityV5 />
      <DevelopersV5 />
      <CoinsV5 />
      <FAQV5 />
      <GlobalReachV5 />
      <FinalCTAV5 />
      <StickyMobileCta />
    </HomeWrapper>
  );
};

export default memo(HomePage);
