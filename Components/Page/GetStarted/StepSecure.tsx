import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import EnrollPanel from "@/Components/UI/TwoFactorEnroll/EnrollPanel";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { StepFooter, StepHeader } from "./StepChrome";
import type { SetupProgress } from "./useSetupProgress";

interface Props {
  progress: SetupProgress;
  onNext: () => void;
}

/** Step 1 — Secure your account: mandatory second factor (authenticator app or email codes). Gates the payout step. */
const StepSecure: React.FC<Props> = ({ progress, onNext }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { twoFaEnrolled, refreshMfa } = progress;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  const handleEnrolled = () => {
    trackOnboarding({ event_type: "step_completed", step_key: "security", metadata: { surface: "wizard" } });
    void refreshMfa();
  };

  return (
    <Box data-testid="gs-step-secure">
      <StepHeader
        eyebrow={t("gs.stepOf", { n: 1, total: 5, defaultValue: "Step {{n}} of {{total}}" })}
        title={t("gs.secureTitle", { defaultValue: "First, secure your account" })}
        subtitle={t("gs.secureSubtitle", {
          defaultValue: "Dynopay forwards real money to your wallets, so every account uses two-step verification. Pick a method — you'll only be asked for a code on a new browser.",
        })}
      />

      {twoFaEnrolled ? (
        <>
          <Box data-testid="gs-secure-done" sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, borderRadius: "14px", border: `1px solid ${border}` }}>
            <Box sx={{ color: positive, display: "flex" }}><Icon name="shield-check" size={22} /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
                {t("gs.secureDoneTitle", { defaultValue: "Two-step verification is on" })}
              </Box>
              <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
                {t("gs.secureDoneBody", { defaultValue: "This browser is trusted for 90 days. You can manage methods and trusted devices anytime in Settings → Security." })}
              </Box>
            </Box>
          </Box>
          <StepFooter primaryLabel={t("gs.continue", { defaultValue: "Continue" })} onPrimary={onNext} primaryTestId="gs-secure-continue" />
        </>
      ) : (
        <Box sx={{ p: { xs: 0, md: 0.5 } }}>
          <EnrollPanel
            onEnrolled={handleEnrolled}
            onDone={onNext}
            doneLabel={t("gs.secureSavedContinue", { defaultValue: "I've saved my codes — continue" })}
          />
        </Box>
      )}
    </Box>
  );
};

export default StepSecure;
