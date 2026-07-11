import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { pageProps, rootReducer } from "@/utils/types";
import CreatorPageSettings, { CreatorFormState } from "@/Components/Page/Creator/CreatorPageSettings";
import CreatorLivePreview from "@/Components/Page/Creator/CreatorLivePreview";
import PanelCard from "@/Components/UI/PanelCard";

interface Stats {
  total_visits: number;
  this_week_visits: number;
  supporters_count: number;
  has_handle: boolean;
}

const CreatorPageRoute = ({ setPageName, setPageDescription }: pageProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const siteUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const publicUrl = profile?.handle ? `${siteUrl}/${profile.handle}` : "";

  useEffect(() => {
    setPageName?.(t("creatorPage", { defaultValue: "Creator page", ns: "dashboardLayout" }));
    setPageDescription?.(
      t("creatorPageDescription", {
        defaultValue: "Your public dynopay.com/handle — a single link for donations, tips and payments.",
        ns: "dashboardLayout",
      }),
    );
  }, [setPageName, setPageDescription, t]);

  // Mirror the form values in a live preview
  const [formState, setFormState] = useState<CreatorFormState>({
    handle: "",
    bio: "",
    enabled: false,
    coverImage: null,
    socialLinks: {},
  });
  const onFormChange = useCallback((s: CreatorFormState) => setFormState(s), []);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosBaseApi.get("/user/creator/stats");
        if (!cancelled) setStats(r?.data?.data || null);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [profile?.handle, profile?.creator_page_enabled]);

  const hasHandle = Boolean(profile?.handle);
  const isPublished = Boolean(profile?.handle && profile?.creator_page_enabled);

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

  return (
    <>
      <Head>
        <title>Creator page · Dynopay</title>
      </Head>

      <Box sx={{ px: { xs: 2, md: 0 }, pt: { xs: 1, md: 0 }, pb: 4, width: "100%" }} data-testid="creator-page">
        {/* Status banner */}
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
                ? t("statusPublished", { defaultValue: "Your creator page is live", ns: "dashboardLayout" })
                : t("statusDraft", { defaultValue: "Draft — turn on the publish toggle below to go live", ns: "dashboardLayout" })}
            </Typography>
            {isPublished && publicUrl && (
              <Typography
                component="a"
                href={publicUrl}
                target="_blank"
                rel="noopener"
                sx={{ ml: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: theme.palette.text.secondary, textDecoration: "none", "&:hover": { color: theme.palette.primary.main } }}
              >
                {publicUrl.replace(/^https?:\/\//, "")} <Icon icon="mdi:open-in-new" inline width={12} />
              </Typography>
            )}
          </Box>
        )}

        {/* Stat tiles (only meaningful once handle is claimed) */}
        {hasHandle && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr 1fr" }, gap: 1.5, mb: 3 }}>
            {statTiles.map((s) => (
              <Box
                key={s.label}
                data-testid={`creator-stat-${s.icon.replace(/[^a-z]/gi, "")}`}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: "14px",
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.paper,
                  display: "flex", flexDirection: "column", gap: 0.5,
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
            ))}
          </Box>
        )}

        {/* Two-column: form (left) + live preview (right, sticky, desktop only) */}
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 480px", minWidth: 0 }}>
            <PanelCard
              title={t("creatorCustomizeTitle", { defaultValue: "Customize your page", ns: "dashboardLayout" })}
              subTitle={t("creatorCustomizeSubtitle", { defaultValue: "Claim a handle, add a cover image and share your links.", ns: "dashboardLayout" })}
              bodyPadding={theme.spacing(2.5)}
            >
              <CreatorPageSettings onChange={onFormChange} />
            </PanelCard>
          </Box>

          {isDesktop && (
            <Box sx={{ flex: "0 0 360px", position: "sticky", top: 24 }} data-testid="creator-preview-column">
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: 1, ml: 0.5 }}>
                {t("creatorPreviewLabel", { defaultValue: "Live preview", ns: "dashboardLayout" })}
              </Typography>
              <CreatorLivePreview state={formState} />
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

export default CreatorPageRoute;
