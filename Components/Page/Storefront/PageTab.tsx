import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Box, Button, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useApiSWR } from "@/hooks/useApiSWR";
import CreatorPageSettings, { CreatorFormState } from "@/Components/Page/Creator/CreatorPageSettings";
import CreatorLivePreview from "@/Components/Page/Creator/CreatorLivePreview";
import StorefrontPendingCard from "@/Components/Page/Storefront/StorefrontPendingCard";
import HandleClaimNudge from "@/Components/UI/OnboardingFlow/HandleClaimNudge";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import PanelCard from "@/Components/UI/PanelCard";
import OnboardingBanner from "@/Components/UI/OnboardingBanner";
import { buildCreatorUrl } from "@/helpers/creatorUrl";
import { BRAND_ACCENT, brandFg } from "@/constants/theme";
import { API_ENDPOINTS } from "@/api/endpoints";

interface Stats {
  total_visits: number;
  this_week_visits: number;
  supporters_count: number;
  has_handle: boolean;
}

/**
 * Storefront → Page.
 *
 * The former /creator screen: handle, cover, bio, theme, socials and the tip
 * box, with a live preview of the public page. Products and the share tools are
 * sibling tabs, so a merchant configures one storefront in one place.
 */
const PageTab = () => {
  const theme = useTheme();
  const router = useRouter();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const { t } = useTranslation(["dashboardLayout", "common"]);
  // Company-scoped storefront profile: the single source of truth for the
  // banner handle/URL + publish state (account-level Redux profile would show
  // the primary company's handle under other companies when the flag is ON).
  const { profile: storefront } = useStorefrontProfile();
  const publicUrl = buildCreatorUrl(storefront?.handle);

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

  const { data: stats } = useApiSWR<Stats>(API_ENDPOINTS.creator.stats, {
    unwrap: true,
    revalidateOnFocus: false,
  });

  const hasHandle = mounted && Boolean(storefront?.handle);
  const isPublished = mounted && Boolean(storefront?.handle && storefront?.creator_page_enabled);

  const statTiles = useMemo(() => ([
    {
      label: t("statTotalVisits", { defaultValue: "Total visits", ns: "dashboardLayout" }),
      value: (stats?.total_visits ?? 0).toLocaleString(),
      icon: "mdi:eye-outline",
    },
    {
      label: t("statThisWeek", { defaultValue: "This week", ns: "dashboardLayout" }),
      value: (stats?.this_week_visits ?? 0).toLocaleString(),
      icon: "mdi:chart-line",
    },
    {
      label: t("statSupporters", { defaultValue: "Supporters", ns: "dashboardLayout" }),
      value: (stats?.supporters_count ?? 0).toLocaleString(),
      icon: "mdi:heart-outline",
    },
  ]), [stats, t]);

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

      {/* Publish status */}
      {hasHandle && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            p: 1.5,
            borderRadius: "12px",
            border: `1px solid ${isPublished ? "#22c55e33" : theme.palette.warning.main + "33"}`,
            backgroundColor: isPublished
              ? (theme.palette.mode === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.10)")
              : (theme.palette.mode === "dark" ? "rgba(255,159,10,0.08)" : "rgba(255,159,10,0.10)"),
            mb: 2,
            flexWrap: "wrap",
          }}
          data-testid="creator-status-banner"
        >
          <Box
            sx={{
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: isPublished ? "#22c55e" : theme.palette.warning.main,
              boxShadow: isPublished ? "0 0 0 4px rgba(34,197,94,0.18)" : "0 0 0 4px rgba(255,159,10,0.18)",
            }}
          />
          <Typography fontSize={13.5} fontWeight={600} color={theme.palette.text.primary}>
            {isPublished
              ? t("statusPublished", { defaultValue: "Your page is live", ns: "dashboardLayout" })
              : t("statusDraft", { defaultValue: "Draft — turn on the publish toggle below to go live", ns: "dashboardLayout" })}
          </Typography>
          {isPublished && publicUrl && (
            <Typography
              component="a"
              href={publicUrl}
              target="_blank"
              rel="noopener"
              sx={{ ml: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: theme.palette.text.secondary, textDecoration: "none", "&:hover": { color: brandFg(theme.palette.mode === "dark") } }}
            >
              {publicUrl.replace(/^https?:\/\//, "")} <Icon icon="mdi:open-in-new" inline width={12} />
            </Typography>
          )}
        </Box>
      )}

      {/* Stat tiles */}
      {hasHandle && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr 1fr" }, gap: 1.5, mb: 1.25 }}>
          {statTiles.map((s) => {
            const clickable = s.icon === "mdi:heart-outline";
            return (
              <Box
                key={s.label}
                data-testid={`creator-stat-${s.icon.replace(/[^a-z]/gi, "")}`}
                onClick={clickable ? () => router.push("/transactions?source=tip") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={
                  clickable
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push("/transactions?source=tip");
                        }
                      }
                    : undefined
                }
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: "14px",
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.paper,
                  display: "flex", flexDirection: "column", gap: 0.5,
                  cursor: clickable ? "pointer" : "default",
                  transition: "border-color 120ms ease, background-color 120ms ease",
                  "&:hover": clickable
                    ? { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.action.hover }
                    : undefined,
                  "&:focus-visible": clickable
                    ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 }
                    : undefined,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Icon icon={s.icon} width={14} color={theme.palette.text.secondary} />
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                    {s.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "ui-monospace, monospace", fontSize: { xs: 20, sm: 24 }, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  {s.value}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {hasHandle && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
          <Typography
            component="a"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push("/transactions?source=tip");
            }}
            href="/transactions?source=tip"
            data-testid="creator-view-tips-link"
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: brandFg(theme.palette.mode === "dark"),
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {t("creatorViewTips", { defaultValue: "View tip transactions →", ns: "dashboardLayout" })}
          </Typography>
        </Box>
      )}

      {/* Tips CTA — opens the tip box section inside the settings form */}
      <Box
        data-testid="creator-donation-cta"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.75,
          p: { xs: 1.75, sm: 2.25 },
          mb: 3,
          borderRadius: "14px",
          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(129,140,248,0.30)" : "rgba(79,70,229,0.30)"}`,
          backgroundColor: theme.palette.mode === "dark" ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.06)",
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            width: 44, height: 44, borderRadius: "12px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: theme.palette.mode === "dark" ? "#818CF8" : BRAND_ACCENT,
          }}
        >
          <Icon icon="mdi:coffee-outline" width={24} color="#FFFFFF" />
        </Box>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography fontSize={15} fontWeight={800} color={theme.palette.text.primary}>
            {t("creatorDonationCtaTitle", { defaultValue: "Collect tips", ns: "dashboardLayout" })}
          </Typography>
          <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.25}>
            {t("creatorDonationCtaSubtitle", {
              defaultValue: "Turn on your \u201cBuy me a coffee\u201d tip box \u2014 it appears at the top of your page.",
              ns: "dashboardLayout",
            })}
          </Typography>
        </Box>
        <Button
          data-testid="creator-donation-cta-btn"
          disableElevation
          variant="contained"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("dynopay:open-tip-setup"));
            }
          }}
          sx={{
            px: 2.25, py: 1.1, borderRadius: "10px", textTransform: "none",
            fontWeight: 800, fontSize: 13.5, whiteSpace: "nowrap",
            backgroundColor: theme.palette.mode === "dark" ? "#818CF8" : BRAND_ACCENT,
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: theme.palette.mode === "dark" ? "#6D74E8" : "#4338CA",
              filter: "brightness(1.02)",
            },
          }}
        >
          {t("creatorDonationCtaButton", { defaultValue: "Set up tips", ns: "dashboardLayout" })}
        </Button>
      </Box>

      {/* Settings form + live preview */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 480px", minWidth: 0 }}>
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
                <Typography sx={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: "#22c55e", textTransform: "uppercase" }}>
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
