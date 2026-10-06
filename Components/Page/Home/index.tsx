import { FC, memo, useEffect } from "react";
import { HomeWrapper } from "./styled";
import { LandingMetricsContext, type LandingMetrics } from "./v5/useLandingMetrics";

/* Landing v8 (2026-10 "Bybit-tier" rebuild): a premium, light-first marketing
 * homepage punctuated by near-black live data/mockup panels. Rebuilt from
 * scratch; the old v7 components still power other marketing pages (e.g. /fees).
 *
 *   0. PriceTickerV8      — signature live market-price band (under the nav)
 *   1. HeroV8             — value proposition + layered live checkout panel
 *   2. StatBandV8         — animated count-up headline metrics (dark)
 *   3. ProductShowcaseV8  — interactive Accept / Auto-convert / Payouts / Checkout
 *   4. TrustBandV8        — rating, compliance badges, live supported-assets wall
 *   5. HowItWorksV8       — animated 3-step flow            (#how-it-works)
 *   6. AppShowcaseV8      — device + widget mockups, QR + store badges (dark)
 *   7. FinalCTAV8         — closing conversion moment (dark)
 *
 * SafeDeal escrow is a separate product and is intentionally excluded.
 */
import PriceTickerV8 from "./v8/PriceTickerV8";
import HeroV8 from "./v8/HeroV8";
import StatBandV8 from "./v8/StatBandV8";
import ProductShowcaseV8 from "./v8/ProductShowcaseV8";
import TrustBandV8 from "./v8/TrustBandV8";
import HowItWorksV8 from "./v8/HowItWorksV8";
import AppShowcaseV8 from "./v8/AppShowcaseV8";
import FinalCTAV8 from "./v8/FinalCTAV8";

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
        <PriceTickerV8 />
        <HeroV8 />
        <StatBandV8 />
        <ProductShowcaseV8 />
        <TrustBandV8 />
        <HowItWorksV8 />
        <AppShowcaseV8 />
        <FinalCTAV8 />
      </HomeWrapper>
    </LandingMetricsContext.Provider>
  );
};

export default memo(HomePage);
