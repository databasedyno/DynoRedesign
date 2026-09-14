import { FC, memo, useEffect } from "react";
import { Box, Button, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import useTokenData from "@/hooks/useTokenData";

const BAR_HEIGHT = 64;

/** Phone-only bottom bar on public pages for signed-in merchants: one tap back to the dashboard.
 *  Reuses the --dp-lang-bar footprint variable (mutually exclusive with the language chooser,
 *  which only shows without a token) so the chat FAB, scroll-top button and footer clear it. */
const PublicDashboardBar: FC = () => {
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const user = useTokenData();
  const visible = isMobile && !!user;

  useEffect(() => {
    if (!visible) return;
    const el = document.documentElement;
    el.style.setProperty("--dp-lang-bar", `${BAR_HEIGHT}px`);
    return () => el.style.setProperty("--dp-lang-bar", "0px");
  }, [visible]);

  if (!visible) return null;

  const dark = theme.palette.mode === "dark";
  const accent = dark ? "#6366F1" : "#4338CA";

  return (
    <Box
      data-testid="public-dashboard-bar"
      role="region"
      aria-label={t("signedInBar.title")}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: BAR_HEIGHT,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        px: 2,
        bgcolor: dark ? "rgba(17,19,26,0.92)" : "rgba(255,255,255,0.94)",
        backdropFilter: "blur(16px)",
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: dark ? "0 -8px 24px rgba(0,0,0,0.45)" : "0 -8px 24px rgba(16,24,40,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          aria-hidden
          sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#12B76A", flexShrink: 0, boxShadow: "0 0 0 3px rgba(18,183,106,0.18)" }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, color: theme.palette.text.primary }}>
            {t("signedInBar.title")}
          </Typography>
          <Typography
            data-testid="public-dashboard-bar-email"
            noWrap
            sx={{ fontSize: 11.5, color: theme.palette.text.secondary, lineHeight: 1.2, maxWidth: 170 }}
          >
            {user.email}
          </Typography>
        </Box>
      </Box>
      <Button
        data-testid="public-dashboard-bar-btn"
        onClick={() => void router.push("/dashboard")}
        endIcon={<Icon icon="mdi:arrow-right" width={16} height={16} />}
        sx={{
          flexShrink: 0,
          textTransform: "none",
          fontWeight: 700,
          fontSize: 13.5,
          borderRadius: 999,
          px: 2,
          minHeight: 40,
          color: "#fff",
          bgcolor: accent,
          "&:hover": { bgcolor: dark ? "#4F46E5" : "#3730A3" },
        }}
      >
        {t("goToDashboard")}
      </Button>
    </Box>
  );
};

export default memo(PublicDashboardBar);
