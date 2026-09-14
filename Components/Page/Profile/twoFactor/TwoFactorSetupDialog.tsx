import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, Typography, useTheme } from "@mui/material";
import { QrCode2Rounded, VerifiedUserRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import AuthenticatorEnroll from "@/Components/UI/TwoFactorEnroll/AuthenticatorEnroll";
import BackupCodesList from "./BackupCodesList";
import { brandFg } from "@/constants/theme";

interface TwoFactorSetupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fired once 2FA is verified + enabled so the card can refresh its status. */
  onEnabled: () => void;
}

/** Enable flow: scan QR (or type secret) → enter a code → save backup codes. */
const TwoFactorSetupDialog: React.FC<TwoFactorSetupDialogProps> = ({ open, onClose, onEnabled }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { if (open) setCodes(null); }, [open]);

  const header = (icon: React.ReactNode, title: string) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: theme.palette.mode === "dark" ? "rgba(99,102,241,0.18)" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>{title}</Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={verifying ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="twofa-setup-dialog">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        {!codes ? (
          <>
            {header(<QrCode2Rounded sx={{ color: brandFg(theme.palette.mode === "dark"), fontSize: 22 }} />, t("twoFactor.setupTitle", { defaultValue: "Set up an authenticator app" }))}
            {open && <AuthenticatorEnroll onEnrolled={(c) => { setCodes(c); onEnabled(); }} onBusyChange={setVerifying} />}
          </>
        ) : (
          <>
            {header(<VerifiedUserRounded sx={{ color: "#16A34A", fontSize: 22 }} />, t("twoFactor.enabledTitle", { defaultValue: "Two-step verification is on" }))}
            <Typography data-testid="twofa-enabled-body" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.enabledBody", { defaultValue: "Save these backup codes somewhere safe. If you lose your phone, each code lets you sign in once. They won't be shown again." })}
            </Typography>
            <BackupCodesList codes={codes} />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "22px", display: "flex", gap: "12px" }}>
        {!codes ? (
          <Button
            fullWidth
            onClick={onClose}
            disabled={verifying}
            data-testid="twofa-setup-cancel"
            sx={{ fontWeight: 500, fontSize: "14px", color: theme.palette.text.secondary, border: `1px solid ${theme.palette.border.main}`, py: "10px", borderRadius: "8px", textTransform: "none" }}
          >
            {t("twoFactor.cancel", { defaultValue: "Cancel" })}
          </Button>
        ) : (
          <Button
            fullWidth
            onClick={onClose}
            data-testid="twofa-setup-done"
            sx={{ fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#4F46E5", py: "10px", borderRadius: "8px", textTransform: "none", "&:hover": { backgroundColor: "#4338CA" } }}
          >
            {t("twoFactor.savedCodes", { defaultValue: "I've saved my codes" })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorSetupDialog;
