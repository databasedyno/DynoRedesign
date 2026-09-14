import { brandFg } from "@/constants/theme";
import CustomButton from "@/Components/UI/Buttons";
import TrustStrip from "@/Components/UI/AuthLayout/TrustStrip";
import useIsMobile from "@/hooks/useIsMobile";
import {
  ArrowOutward,
  AutoAwesomeRounded,
  PlayCircleFilledRounded,
  RocketLaunchRounded,
} from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";

/**
 * EmptyStatePanel — shown INSTEAD of HeroMetrics when the merchant has
 * completed setup (has a company + at least one wallet) but hasn't seen
 * a single confirmed payment yet. Turns the top-of-dashboard into a
 * guide toward the first AHA moment ("first payment received") instead
 * of a wall of zeroes.
 */

export interface EmptyStatePanelProps {
  hasCompany?: boolean;
  hasWallet?: boolean;
  onCreateLink?: () => void;
}

const EmptyStatePanel: React.FC<EmptyStatePanelProps> = ({
  hasCompany = false,
  hasWallet = false,
  onCreateLink,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const ready = hasCompany && hasWallet;

  return (
    <Box
      data-testid="dashboard-empty-state"
      sx={{
        mx: { xs: 2, md: 0 },
        mb: { xs: 2, md: 2.5 },
        p: isMobile ? 3 : 4,
        borderRadius: "20px",
        border: `1px solid ${theme.palette.primary.main}33`,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}0f 0%, ${theme.palette.primary.main}03 100%)`,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: isMobile ? 2.5 : 4,
        alignItems: { xs: "flex-start", md: "center" },
      }}
    >
      <Box
        sx={{
          width: isMobile ? 56 : 72,
          height: isMobile ? 56 : 72,
          borderRadius: isMobile ? "18px" : "22px",
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          boxShadow: `0 12px 32px ${theme.palette.primary.main}40`,
          flexShrink: 0,
        }}
      >
        <RocketLaunchRounded sx={{ fontSize: isMobile ? 28 : 36 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: isMobile ? "20px" : "26px",
            color: theme.palette.text.primary,
            lineHeight: 1.2,
            mb: 1,
          }}
        >
          {ready ? t("emptyReadyTitle") : t("emptyNotReadyTitle")}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "13.5px" : "15px",
            color: theme.palette.text.secondary,
            lineHeight: 1.55,
            mb: 2,
          }}
        >
          {ready ? t("emptyReadyBody") : t("emptyNotReadyBody")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {ready ? (
            <>
              <CustomButton
                data-testid="empty-state-create-link"
                label={t("createPaymentLink")}
                variant="primary"
                size={isMobile ? "small" : "medium"}
                endIcon={<ArrowOutward sx={{ fontSize: 16 }} />}
                onClick={onCreateLink || (() => router.push("/create-pay-link"))}
              />
              <Box
                role="button"
                tabIndex={0}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.palette.text.secondary,
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  "&:hover": { color: brandFg(theme.palette.mode === "dark") },
                  // Session 75 P1 fix — WCAG 2.5.5 tap target on mobile.
                  minHeight: { xs: "44px", md: "auto" },
                  px: { xs: "8px", md: 0 },
                  ml: { xs: "-8px", md: 0 },
                  "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: "2px",
                    borderRadius: "6px",
                  },
                }}
                onClick={() => router.push("/creator")}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/creator"); } }}
                data-testid="empty-state-claim-creator"
              >
                <AutoAwesomeRounded sx={{ fontSize: 18 }} />
                {t("emptyClaimCreator", { defaultValue: "Or claim your creator page →" })}
              </Box>
              <Box
                role="button"
                tabIndex={0}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.palette.text.secondary,
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  "&:hover": { color: brandFg(theme.palette.mode === "dark") },
                  // Session 75 P1 fix — WCAG 2.5.5 tap target on mobile.
                  minHeight: { xs: "44px", md: "auto" },
                  px: { xs: "8px", md: 0 },
                  ml: { xs: "-8px", md: 0 },
                  "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: "2px",
                    borderRadius: "6px",
                  },
                }}
                onClick={() => router.push("/help/getting-started")}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/help/getting-started"); } }}
                data-testid="empty-state-watch-demo"
              >
                <PlayCircleFilledRounded sx={{ fontSize: 20 }} />
                {t("emptyWatchDemo")}
              </Box>
            </>
          ) : (
            <CustomButton
              data-testid="empty-state-finish-setup"
              label={hasCompany ? t("emptyAddWallet") : t("emptyCreateCompany")}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              endIcon={<ArrowOutward sx={{ fontSize: 16 }} />}
              onClick={() =>
                router.push(hasCompany ? "/wallet" : "/company")
              }
            />
          )}
        </Box>
      </Box>
      {/* Trust strip — same social-proof row that lives below the login card,
          reused here so a merchant's very first empty dashboard still feels
          backed by real activity ("$24M+ processed") instead of a wall of
          zeroes. Sits below the CTA row so the primary action stays first. */}
      <Box
        sx={{
          mt: isMobile ? 3 : 3.5,
          pt: isMobile ? 2 : 2.5,
          borderTop: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,15,20,0.06)"}`,
        }}
      >
        <TrustStrip />
      </Box>
    </Box>
  );
};

export default EmptyStatePanel;
