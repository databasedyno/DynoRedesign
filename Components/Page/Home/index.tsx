import { FC, memo, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import HeroClean from "./HeroClean";
import AsciiShimmer from "./AsciiShimmer";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import SupportedChainsRail from "./SupportedChainsRail";
import FeeCalculator from "./FeeCalculator";
import TryItNow from "./TryItNow";
import CoreValueProps from "./CoreValueProps";
import TestimonialsV2 from "./TestimonialsV2";
import FinalCTA from "./FinalCTA";
import FAQ from "./FAQ";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

/**
 * HomePage — cleaned up (2026-07-05, second pass).
 *
 * Structure:
 *   1. HeroClean            — plain centered hero, one accent color
 *   2. ComplianceLogoStrip  — compact "ENTERPRISE-GRADE SECURITY" row
 *   3. SupportedChainsRail  — chain logos rail
 *   4. FeeCalculator        — the interactive calculator (highest value)
 *   5. TryItNow             — embedded live checkout + curl playground
 *   6. CoreValueProps       — three reasons businesses choose us
 *   7. TestimonialsV2       — merchant testimonials
 *   8. FAQ                  — accordion
 *   9. FinalCTA             — plain CTA panel
 *
 * REMOVED for the "clean" pass (previous set was too visually busy):
 *   • StickyPromoBar         — sticky "$500 fee-free" bar at the top of every
 *                              page. Adds constant visual pressure. Kept in the
 *                              tree for A/B rollback (Components/Common/StickyPromoBar.tsx).
 *   • LivePriceStrip         — full-width scrolling marquee of live crypto
 *                              prices. Great signal, but marquees add motion
 *                              noise and don't survive a "cleanliness" audit.
 *   • HeroV2                 — replaced with HeroClean. HeroV2 had audience
 *                              switcher + tabbed product preview + mesh
 *                              gradient + gradient text + trust badges row +
 *                              star pill — 6 mini-elements too many.
 *
 * Also on the same pass, `Components/UI/SectionTitle/styled.tsx` was updated
 * so every downstream section title stops using the pill badge + blue→purple
 * gradient text — meaning FAQ, CoreValueProps, TestimonialsV2, FinalCTA,
 * ComplianceLogoStrip, SEO country/vertical pages, and `/fees` all render
 * calmer without touching their individual JSX.
 */
const HomePage: FC = () => {
  const theme = useTheme();
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
      <HomeFullWidthContainer>
        {/* Emergent-style animated ASCII shimmer behind the hero (full viewport width) */}
        <Box sx={{ position: "relative", overflow: "hidden" }}>
          <AsciiShimmer isDark={theme.palette.mode === "dark"} />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <HeroClean />
          </Box>
        </Box>
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <ComplianceLogoStrip />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <SupportedChainsRail />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <FeeCalculator />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <TryItNow />
      </HomeFullWidthContainer>

      <HomeContainer>
        <CoreValueProps />
      </HomeContainer>

      <HomeFullWidthContainer>
        <TestimonialsV2 />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <FAQ />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <FinalCTA />
      </HomeFullWidthContainer>
    </HomeWrapper>
  );
};

export default memo(HomePage);
