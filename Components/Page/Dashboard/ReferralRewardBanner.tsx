import React, { useEffect, useState } from "react";
import { Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { BRAND_ACCENT } from "@/constants/theme";

const DISMISS_KEY = "dynopay.referral-reward-banner.dismissed";
const INK = "#0A0A0B";

/**
 * Dashboard "Refer & earn" banner — surfaces the referral revenue-share
 * program (25% of a referred merchant's fees for 12 months), which otherwise
 * only lived on /referrals with no nav entry. Dismissible (persists in
 * localStorage), rendered for owners on the dashboard.
 */
const ReferralRewardBanner: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const [dismissed, setDismissed] = useState(true); // hidden until client mounts

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  const isDark = theme.palette.mode === "dark";
  const bg = isDark
    ? "linear-gradient(90deg, rgba(79,70,229,0.16) 0%, rgba(129,140,248,0.10) 100%)"
    : "linear-gradient(90deg, rgba(79,70,229,0.10) 0%, rgba(129,140,248,0.16) 100%)";

  return (
    <Box
      data-testid="referral-reward-banner"
      sx={{
        position: "relative",
        borderRadius: "14px",
        border: `1px solid ${theme.palette.divider}`,
        background: bg,
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.75, sm: 1.5 },
        mb: 2,
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        flexWrap: { xs: "wrap", sm: "nowrap" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            backgroundColor: BRAND_ACCENT,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon="mdi:gift-outline" width={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 13.5, sm: 14 }, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
            {t("referralBannerTitle", { defaultValue: "Earn 25% revenue share" })}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mt: 0.25 }}>
            {t("referralBannerSubtitle", {
              defaultValue: "Invite a business to Dynopay and earn 25% of their fees for 12 months — paid as fee credit or USDT.",
            })}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={() => router.push("/referrals")}
          data-testid="referral-banner-cta"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "10px",
            px: 2,
            py: 0.85,
            backgroundColor: BRAND_ACCENT,
            color: "#FFFFFF",
            "&:hover": { backgroundColor: BRAND_ACCENT, filter: "brightness(1.08)" },
          }}
        >
          {t("referralBannerCta", { defaultValue: "Refer & earn →" })}
        </Button>
        <IconButton
          size="small"
          onClick={dismiss}
          data-testid="referral-banner-dismiss"
          aria-label="Dismiss banner"
          sx={{
            color: theme.palette.text.secondary,
            width: { xs: 44, md: 32 },
            height: { xs: 44, md: 32 },
          }}
        >
          <Icon icon="mdi:close" width={18} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ReferralRewardBanner;
