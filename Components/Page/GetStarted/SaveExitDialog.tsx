import React, { useCallback } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, Typography, useTheme } from "@mui/material";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { setAuthNotice } from "@/helpers/authNotice";
import { stepLabel, STEP_TRACK_KEY } from "./stepMeta";
import { clearOnboardingSessionFlags, SETUP_STEPS, SetupStepKey, type SetupProgress } from "./useSetupProgress";

interface Props {
  open: boolean;
  onClose: () => void;
  progress: SetupProgress;
}

/** Where a fresh login resumes the wizard — kept in one place so the dialog copy and the redirect agree. */
export const RESUME_LOGIN_URL = "/auth/login?next=%2Fget-started";

/**
 * "Save & exit setup" confirmation. Progress is already persisted step by step,
 * so leaving means SIGNING OUT: the next login lands straight back on the first
 * unfinished step (on any device), instead of dropping the user on the dashboard.
 */
const SaveExitDialog: React.FC<Props> = ({ open, onClose, progress }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const { doneCount, total, firstIncomplete, track } = progress;
  const isDark = theme.palette.mode === "dark";

  const queryStep = router.query.step;
  const current: SetupStepKey =
    typeof queryStep === "string" && (SETUP_STEPS as string[]).includes(queryStep) ? (queryStep as SetupStepKey) : firstIncomplete;
  const resumeIndex = SETUP_STEPS.indexOf(firstIncomplete) + 1;
  const resumeLabel = stepLabel(t, firstIncomplete, track);

  const handleSignOut = useCallback(() => {
    trackOnboarding({
      event_type: "dismissed",
      step_key: STEP_TRACK_KEY[current],
      completed_count: doneCount,
      metadata: { surface: "wizard_header_save_exit", sign_out: true },
    });
    if (typeof window === "undefined") return;
    // Explicit "bring me back here": drop the per-tab auto-open guard AND the
    // 24h "Do this later" snooze so the dashboard guard resumes the wizard.
    clearOnboardingSessionFlags({ clearLaterCooldown: true });
    setAuthNotice("setup_saved");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("refreshToken");
    window.location.replace(RESUME_LOGIN_URL);
  }, [current, doneCount]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      data-testid="gs-save-exit-dialog"
      PaperProps={{ sx: { borderRadius: "16px", backgroundImage: "none" } }}
    >
      <DialogContent sx={{ px: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.5, sm: 3.5 }, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              backgroundColor: isDark ? "rgba(255,209,0,0.14)" : "rgba(255,209,0,0.22)",
              color: isDark ? "#FFD100" : "#8B5E00",
            }}
          >
            <LogoutRounded sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            component="h2"
            data-testid="gs-save-exit-title"
            sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            {t("gs.saveExitTitle", { defaultValue: "Sign out and finish later?" })}
          </Typography>
        </Box>

        <Typography
          data-testid="gs-save-exit-body"
          sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, lineHeight: 1.55, color: theme.palette.text.primary }}
        >
          {doneCount > 0
            ? t("gs.saveExitBody", {
                done: doneCount,
                total,
                n: resumeIndex,
                label: resumeLabel,
                defaultValue:
                  "Your progress is saved — {{done}} of {{total}} steps done. When you sign back in, you'll pick up at step {{n}}: {{label}}.",
              })
            : t("gs.saveExitBodyNone", {
                label: resumeLabel,
                defaultValue: "No steps completed yet. When you sign back in, you'll start at step 1: {{label}}.",
              })}
        </Typography>
        <Typography
          data-testid="gs-save-exit-note"
          sx={{ mt: 1.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: theme.palette.text.secondary }}
        >
          {t("gs.saveExitNote", { defaultValue: "Anything typed on the current step but not yet saved will need to be entered again." })}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2.5, sm: 3.5 }, pb: { xs: 2.5, sm: 3 }, pt: 1, display: "flex", gap: 1.5 }}>
        <Button
          fullWidth
          onClick={onClose}
          data-testid="gs-save-exit-cancel"
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 14,
            textTransform: "none",
            py: "10px",
            borderRadius: 999,
            color: theme.palette.text.primary,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.16)" : "rgba(18,18,20,0.16)"}`,
          }}
        >
          {t("gs.saveExitKeepGoing", { defaultValue: "Keep going" })}
        </Button>
        <Button
          fullWidth
          onClick={handleSignOut}
          data-testid="gs-save-exit-confirm"
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 14,
            textTransform: "none",
            py: "10px",
            borderRadius: 999,
            color: "#121214",
            background: "linear-gradient(135deg, #FFD100 0%, #FFE566 100%)",
            boxShadow: "0 10px 24px -12px rgba(255,209,0,0.9)",
            "&:hover": { background: "linear-gradient(135deg, #F2C600 0%, #FFE04D 100%)" },
          }}
        >
          {t("gs.saveExitSignOut", { defaultValue: "Sign out" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveExitDialog;
