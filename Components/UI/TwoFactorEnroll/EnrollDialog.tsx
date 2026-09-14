import React from "react";
import { Box, Button, Dialog, DialogContent, Typography, useTheme } from "@mui/material";
import { ShieldOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { brandFg } from "@/constants/theme";
import EnrollPanel, { EnrollMethod } from "./EnrollPanel";

interface Props {
  open: boolean;
  /** When false the dialog cannot be dismissed (hard wall). */
  dismissable?: boolean;
  title?: string;
  subtitle?: string;
  allowEmail?: boolean;
  onEnrolled?: (method: EnrollMethod) => void;
  onDone: () => void;
  onClose?: () => void;
  dismissLabel?: string;
  testId?: string;
}

/** Modal wrapper around EnrollPanel — Settings "Turn on", the soft-wall interstitial and the hard wall. */
const EnrollDialog: React.FC<Props> = ({
  open, dismissable = true, title, subtitle, allowEmail = true, onEnrolled, onDone, onClose, dismissLabel, testId = "twofa-enroll-dialog",
}) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Dialog
      open={open}
      onClose={dismissable ? onClose : undefined}
      disableEscapeKeyDown={!dismissable}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: "14px" } }}
      data-testid={testId}
    >
      <DialogContent sx={{ px: { xs: "20px", sm: "28px" }, pt: "28px", pb: "24px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldOutlined sx={{ color: brandFg(isDark), fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }} data-testid={`${testId}-title`}>
            {title || t("twoFactor.enrollTitle", { defaultValue: "Secure your account" })}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2.5 }} data-testid={`${testId}-subtitle`}>
          {subtitle || t("twoFactor.enrollSubtitle", { defaultValue: "Two-step verification is required on Dynopay. Choose how you'd like to confirm it's you when signing in on a new browser." })}
        </Typography>

        <EnrollPanel allowEmail={allowEmail} onEnrolled={onEnrolled} onDone={onDone} />

        {dismissable && onClose && (
          <Button
            onClick={onClose}
            data-testid={`${testId}-dismiss`}
            sx={{ mt: 2, fontSize: "13px", textTransform: "none", color: theme.palette.text.secondary }}
          >
            {dismissLabel || t("twoFactor.cancel", { defaultValue: "Cancel" })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnrollDialog;
