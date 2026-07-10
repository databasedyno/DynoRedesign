import { FC, memo, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import HeroClean from "./HeroClean";
import AsciiShimmer from "./AsciiShimmer";
import ComplianceLogoStrip from "./ComplianceLogoStrip";
import SupportedChainsRail from "./SupportedChainsRail";
import ProductShowcase from "./ProductShowcase";
import FeeCalculator from "./FeeCalculator";
import CoreValueProps from "./CoreValueProps";
import TestimonialsV2 from "./TestimonialsV2";
import FinalCTA from "./FinalCTA";
import FAQ from "./FAQ";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

/**
 * SectionPanel — WalletConnect-style full-width rounded panel (session 15).
 * Gives the landing a "panel rhythm": alternating white canvas and soft
 * rounded panels, instead of every section floating on the same background.
 * Purely a wrapper — section internals are untouched, so theme'd text/cards
 * keep their contrast in both light and dark mode.
 */
const SectionPanel: FC<{ children: React.ReactNode; testId?: string }> = ({
  children,
  testId,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, width: "100%" }}>
      <Box
        data-testid={testId}
        sx={{
          maxWidth: 1360,
          mx: "auto",
          borderRadius: { xs: "20px", md: "28px" },
          bgcolor: isDark ? "rgba(255,255,255,0.035)" : "#F5F6F8",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(17,18,20,0.05)"}`,
          overflow: "hidden",
          py: { xs: 1, md: 2 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

/**
 * HomePage — cleaned up (2026-07-05, second pass; reordered 2026-07-10, session 14).
 *
 * Structure:
 *   1. HeroClean            — plain centered hero, one accent color
 *   2. ProductShowcase      — animated product story (moved up near the top —
 *                             it replaces the old "Watch 90s demo" video)
 *   3. ComplianceLogoStrip  — compact "ENTERPRISE-GRADE SECURITY" row
 *   4. SupportedChainsRail  — chain logos rail
 *   5. FeeCalculator        — the interactive calculator (highest value)
 *   6. CoreValueProps       — three reasons businesses choose us
 *   7. TestimonialsV2       — merchant testimonials
 *   8. FAQ                  — accordion
 *   9. FinalCTA             — plain CTA panel
 *
 * REMOVED (session 14, per user):
 *   • TryItNow              — live sandbox curl playground moved to /documentation
 *                             (kept in the tree: Components/Page/Home/TryItNow.tsx).
 *   • "Watch 90s demo" CTA  — removed from HeroClean; the ProductShowcase
 *                             animation replaces the demo video.
 *
 * REMOVED for the "clean" pass (previous set was too visually busy):
 *   • StickyPromoBar         — sticky "$500 fee-free" bar at the top of every
 *                              page. Adds constant visual pressure. Kept in the
 *                              tree for A/B rollback (Components/Common/StickyPromoBar.tsx).
 *   • LivePriceStrip         — full-width scrolling marquee of live crypto
 *                              prices. Great signal, but marquees add motion
 *                              noise and don't survive a "cleanliness" audit.
 *   • HeroV2                 — replaced with HeroClean.
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
        {/* Emergent-style animated product story (checkout → settlement → API) */}
        <ProductShowcase />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        {/* Compliance badges + supported chains — grouped in one soft panel
            (WalletConnect-style rounded panel rhythm, session 15) */}
        <SectionPanel testId="panel-trust">
          <ComplianceLogoStrip />
          <SupportedChainsRail />
        </SectionPanel>
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <SectionPanel testId="panel-fees">
          <FeeCalculator />
        </SectionPanel>
      </HomeFullWidthContainer>

      <HomeContainer>
        <CoreValueProps />
      </HomeContainer>

      <HomeFullWidthContainer>
        <SectionPanel testId="panel-testimonials">
          <TestimonialsV2 />
        </SectionPanel>
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
