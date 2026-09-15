import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { ShieldOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import { brandFg } from "@/constants/theme";
import EnrollDialog from "@/Components/UI/TwoFactorEnroll/EnrollDialog";
import { useMfaEnforcement } from "./useMfaEnforcement";

const INTERSTITIAL_KEY = "mfa_interstitial_seen";
const SKIP_PATHS = ["/get-started", "/admin"];
// The dashboard surfaces the soft wall as a "Needs attention" feed row instead of the shell banner.
const BANNER_HIDDEN_PATHS = ["/dashboard"];

const seenThisSession = () => {
  try { return sessionStorage.getItem(INTERSTITIAL_KEY) === "1"; } catch { return true; }
};
const markSeen = () => {
  try { sessionStorage.setItem(INTERSTITIAL_KEY, "1"); } catch { /* ignore */ }
};

/**
 * Mandatory-2FA rollout for EXISTING accounts.
 *  - Soft wall (≤14 days): amber banner with a countdown + a once-per-session skippable interstitial.
 *  - Hard wall (deadline passed): non-dismissable full-screen enrolment gate.
 * New signups enrol in the onboarding wizard instead, so the gate stays quiet on /get-started.
 */
const MfaGate: React.FC = () => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("sm");
  const { enforcement, refresh } = useMfaEnforcement();
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  const skipped = SKIP_PATHS.some((p) => router.pathname === p || router.pathname.startsWith(p + "/"));
  const bannerHidden = BANNER_HIDDEN_PATHS.includes(router.pathname);
  const pending = !!enforcement && !enforcement.enrolled && !skipped;
  const hardWall = pending && enforcement!.hard_wall;
  const softWall = pending && !enforcement!.hard_wall;

  useEffect(() => {
    if (softWall && !seenThisSession()) setInterstitialOpen(true);
  }, [softWall]);

  if (!pending) return null;

  const daysLeft = enforcement!.days_left ?? 0;
  const deadline = enforcement!.deadline_at ? new Date(enforcement!.deadline_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const finish = () => { setInterstitialOpen(false); setBannerDialogOpen(false); void refresh(); };
  const dismissInterstitial = () => { markSeen(); setInterstitialOpen(false); };

  if (hardWall) {
    return (
      <EnrollDialog
        open
        dismissable={false}
        testId="mfa-hard-wall"
        title={t("twoFactor.hardWallTitle", { defaultValue: "Two-step verification is now required" })}
        subtitle={t("twoFactor.hardWallSubtitle", { defaultValue: "Your 14-day grace period has ended. Set up an authenticator app or email codes to keep using Dynopay — it takes about a minute." })}
        onDone={finish}
      />
    );
  }

  return (
    <>
      {!bannerHidden && (
      <Box
        data-testid="mfa-soft-banner"
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap",
          px: isMobile ? 2 : 3, py: 1.25,
          backgroundColor: theme.palette.mode === "dark" ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.08)",
          borderBottom: "1px solid rgba(245,158,11,0.35)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <ShieldOutlined sx={{ color: "#F59E0B", fontSize: 20, flexShrink: 0 }} />
          <Typography sx={{ fontSize: isMobile ? "12px" : "13.5px", fontFamily: "var(--font-sans)", color: theme.palette.text.primary }} data-testid="mfa-soft-banner-text">
            {daysLeft <= 1
              ? t("twoFactor.bannerLastDay", { defaultValue: "Two-step verification becomes required tomorrow. Set it up now to avoid interruptions." })
              : t("twoFactor.bannerDays", { defaultValue: "Two-step verification becomes required on {{date}} ({{days}} days left). Protect your account now.", date: deadline, days: daysLeft })}
          </Typography>
        </Box>
        <Button
          onClick={() => setBannerDialogOpen(true)}
          data-testid="mfa-soft-banner-cta"
          sx={{
            fontSize: isMobile ? "11px" : "13px", fontFamily: "var(--font-sans)", color: brandFg(theme.palette.mode === "dark"), textTransform: "none", fontWeight: 600,
            border: `1px solid ${theme.palette.primary.main}`, borderRadius: "6px", px: 2, py: 0.5, whiteSpace: "nowrap",
            "&:hover": { backgroundColor: theme.palette.primary.light },
          }}
        >
          {t("twoFactor.bannerCta", { defaultValue: "Set up now" })}
        </Button>
      </Box>
      )}

      <EnrollDialog
        open={interstitialOpen || bannerDialogOpen}
        dismissable
        testId={interstitialOpen ? "mfa-interstitial" : "mfa-banner-dialog"}
        title={t("twoFactor.interstitialTitle", { defaultValue: "Protect your account in a minute" })}
        subtitle={t("twoFactor.interstitialSubtitle", { defaultValue: "Two-step verification becomes required for everyone on {{date}}. Set it up now and you won't be asked again — only new browsers get a code check.", date: deadline })}
        onDone={finish}
        onClose={interstitialOpen ? dismissInterstitial : () => setBannerDialogOpen(false)}
        dismissLabel={interstitialOpen ? t("twoFactor.remindLater", { defaultValue: "Remind me later" }) : undefined}
      />
    </>
  );
};

export default MfaGate;
