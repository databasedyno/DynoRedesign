import { useCallback, useEffect, useState } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CreatorPageSettings, { CreatorFormState } from "@/Components/Page/Creator/CreatorPageSettings";
import CreatorLivePreview from "@/Components/Page/Creator/CreatorLivePreview";
import StorefrontPendingCard from "@/Components/Page/Storefront/StorefrontPendingCard";
import PageFunnelHeader from "@/Components/Page/Storefront/PageFunnelHeader";
import HandleClaimNudge from "@/Components/UI/OnboardingFlow/HandleClaimNudge";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import PanelCard from "@/Components/UI/PanelCard";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";

/**
 * Storefront → Page.
 *
 * The former /creator screen: handle, cover, bio, theme, socials and the tip
 * box, with a live preview of the public page. Products and the share tools are
 * sibling tabs, so a merchant configures one storefront in one place.
 */
const PageTab = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const { t } = useTranslation(["dashboardLayout", "common"]);
  // Company-scoped storefront profile: the single source of truth for the
  // banner handle/URL + publish state (account-level Redux profile would show
  // the primary company's handle under other companies when the flag is ON).
  const { profile: storefront } = useStorefrontProfile();

  // Redux is client-only; gate profile-dependent blocks so SSR and the first
  // client paint agree (this used to cause a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [formState, setFormState] = useState<CreatorFormState>({
    handle: "",
    bio: "",
    enabled: false,
    coverImage: null,
    socialLinks: {},
    swEnabled: true,
    swStyle: "coffee",
    swLabel: "",
    swPresets: [3, 5, 10],
    swCurrency: "USD",
    swMinAmount: 1,
    swAllowMessage: true,
    swThanks: "",
    swShowSupporters: true,
    storeEnabled: true,
    showProductsOnPage: true,
    accentColor: null,
    coverStyle: null,
    coverGradient: null,
  });
  const onFormChange = useCallback((s: CreatorFormState) => setFormState(s), []);

  const scrollToEditor = useCallback(() => {
    document.getElementById("creator-edit-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (storefront?.storefront_pending) {
    return (
      <Box sx={{ width: "100%" }} data-testid="creator-page">
        <StorefrontPendingCard />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }} data-testid="creator-page">
      <OnboardingBanner vertical="creators" />

      {/* Handle Availability Nudge — one-tap claim card shown right after a
          new company is created (falls back to nothing on companies that
          already have a handle). */}
      <HandleClaimNudge />

      {/* Wave 3b — publish state + live-preview thumb + views → checkouts → paid funnel */}
      <PageFunnelHeader storefront={storefront} formState={formState} mounted={mounted} onEdit={scrollToEditor} />

      {/* Settings form + live preview */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box id="creator-edit-panel" sx={{ flex: "1 1 480px", minWidth: 0, scrollMarginTop: 96 }} data-testid="creator-edit-panel">
          <PanelCard
            title={t("creatorCustomizeTitle", { defaultValue: "Customize your page", ns: "dashboardLayout" })}
            subTitle={t("creatorCustomizeSubtitle", { defaultValue: "Personalise your page — cover image, theme and links.", ns: "dashboardLayout" })}
            bodyPadding={theme.spacing(2.5)}
          >
            <CreatorPageSettings onChange={onFormChange} />
          </PanelCard>
        </Box>

        {isDesktop && mounted && (
          <Box sx={{ flex: "0 0 360px", position: "sticky", top: 24 }} data-testid="creator-preview-column">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1, ml: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                {t("creatorPreviewLabel", { defaultValue: "Live preview", ns: "dashboardLayout" })}
              </Typography>
              {/* Live-updates hint: makes it obvious the preview reflects
                  colour/cover changes instantly (no Save required). */}
              <Box
                data-testid="creator-preview-live-chip"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.35,
                  px: 0.85,
                  py: 0.1,
                  borderRadius: 999,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.mode === "dark" ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.08)",
                }}
                title="Updates instantly as you tweak the theme — no Save required."
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    boxShadow: "0 0 0 2px rgba(34,197,94,0.20)",
                  }}
                />
                <Typography sx={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: theme.palette.mode === "dark" ? "#4ADE80" : "#14532D", textTransform: "uppercase" }}>
                  Live
                </Typography>
              </Box>
            </Box>
            <CreatorLivePreview state={formState} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PageTab;
