import { FC, memo, useEffect } from "react";
import { HomeWrapper } from "./styled";
import { LandingMetricsContext, type LandingMetrics } from "./v5/useLandingMetrics";

/* Landing v8.1 (2026-10 "Bybit-tier" quality pass): a premium, light-first
 * marketing homepage punctuated by near-black live data/mockup panels. The
 * old v7 components still power other marketing pages (e.g. /fees).
 *
 *   1. HeroV8             — flow ribbon, 2-line headline, sign-up block, live checkout mock
 *   2. StatBandV8         — four REAL count-up metrics (dark)
 *   3. ProductShowcaseV8  — "One platform" bento: Accept / Auto-convert / Settlement / Checkout
 *   4. HowItWorksV8       — compact 3-step strip                  (#how-it-works)
 *   5. TrustBandV8        — trust pillars + live settled-by-chain shares
 *   6. DeviceShowcaseV8   — works on every device (web dashboard, no store badges) (dark)
 *   7. FinalCTAV8         — closing conversion moment (dark)
 *
 * SafeDeal escrow is a separate product and is intentionally excluded.
 */
import HeroV8 from "./v8/HeroV8";
import StatBandV8 from "./v8/StatBandV8";
import ProductShowcaseV8 from "./v8/ProductShowcaseV8";
import HowItWorksV8 from "./v8/HowItWorksV8";
import TrustBandV8 from "./v8/TrustBandV8";
import DeviceShowcaseV8 from "./v8/DeviceShowcaseV8";
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
        <HeroV8 />
        <StatBandV8 />
        <ProductShowcaseV8 />
        <HowItWorksV8 />
        <TrustBandV8 />
        <DeviceShowcaseV8 />
        <FinalCTAV8 />
      </HomeWrapper>
    </LandingMetricsContext.Provider>
  );
};

export default memo(HomePage);
