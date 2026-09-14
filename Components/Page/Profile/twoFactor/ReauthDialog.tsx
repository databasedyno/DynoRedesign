import React, { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Typography, useTheme } from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import BackupCodesList from "./BackupCodesList";
import { brandFg } from "@/constants/theme";

export type ReauthIntent = "disable" | "regenerate";

interface ReauthDialogProps {
  open: boolean;
  intent: ReauthIntent;
  onClose: () => void;
  /** Performs the action. Resolve with new backup codes (regenerate) or nothing (disable). Throw on failure. */
  onConfirm: () => Promise<string[] | void>;
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

/**
 * Confirmation before disabling 2FA / rotating backup codes. The identity check
 * itself is the unified step-up dialog (raised by the axios interceptor on the
 * backend's 403 STEPUP_REQUIRED) — no password field here anymore.
 */
const ReauthDialog: React.FC<ReauthDialogProps> = ({ open, intent, onClose, onConfirm }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setNewCodes(null);
    setLoading(false);
  }, [open]);

  const isDisable = intent === "disable";
  const title = isDisable
    ? t("twoFactor.disableTitle", { defaultValue: "Switch to email codes?" })
    : t("twoFactor.regenerateTitle", { defaultValue: "Generate new backup codes" });
  const body = isDisable
    ? t("twoFactor.disableBodyStepUp", { defaultValue: "Your authenticator app will be removed. A second step stays mandatory, so we'll email you a code when you sign in on a new browser instead. We'll ask you to verify it's you first." })
    : t("twoFactor.regenerateBodyStepUp", { defaultValue: "Your current backup codes stop working the moment new ones are created. We'll ask you to verify it's you first." });

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await onConfirm();
      if (Array.isArray(result) && result.length) {
        setNewCodes(result);
      } else {
        onClose();
      }
    } catch (e) {
      if (!(e as { stepUpCancelled?: boolean })?.stepUpCancelled) {
        setError(errMsg(e, t("twoFactor.reauthFailed", { defaultValue: "We couldn't confirm your identity. Please try again." })));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid={`twofa-reauth-dialog-${intent}`}>
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: isDisable ? "#FEE2E2" : (theme.palette.mode === "dark" ? "rgba(99,102,241,0.18)" : "#EEF2FF"), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockOutlined sx={{ color: isDisable ? "#DC2626" : brandFg(theme.palette.mode === "dark"), fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>{title}</Typography>
        </Box>

        {newCodes ? (
          <>
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.newCodesBody", { defaultValue: "Here are your new backup codes. Store them safely — the old ones no longer work." })}
            </Typography>
            <BackupCodesList codes={newCodes} />
          </>
        ) : (
          <>
            <Typography data-testid="twofa-reauth-body" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary }}>{body}</Typography>
            {error && (
              <Alert severity="error" data-testid="twofa-reauth-error" sx={{ mt: 1.5, fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "22px", display: "flex", gap: "12px" }}>
        {newCodes ? (
          <Button
            fullWidth
            onClick={onClose}
            data-testid="twofa-reauth-done"
            sx={{ fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#4F46E5", py: "10px", borderRadius: "8px", textTransform: "none", "&:hover": { backgroundColor: "#4338CA" } }}
          >
            {t("twoFactor.savedCodes", { defaultValue: "I've saved my codes" })}
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              onClick={onClose}
              disabled={loading}
              data-testid="twofa-reauth-cancel"
              sx={{ fontWeight: 500, fontSize: "14px", color: theme.palette.text.secondary, border: `1px solid ${theme.palette.border.main}`, py: "10px", borderRadius: "8px", textTransform: "none" }}
            >
              {t("twoFactor.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              fullWidth
              onClick={submit}
              disabled={loading}
              data-testid="twofa-reauth-confirm"
              sx={{
                fontWeight: 600, fontSize: "14px", color: "#FFFFFF", py: "10px", borderRadius: "8px", textTransform: "none",
                backgroundColor: isDisable ? "#DC2626" : "#4F46E5",
                "&:hover": { backgroundColor: isDisable ? "#B91C1C" : "#4338CA" },
                "&:disabled": { backgroundColor: isDisable ? "#FCA5A5" : "#A5B4FC", color: "#FFF" },
              }}
            >
              {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : isDisable
                ? t("twoFactor.disableCta", { defaultValue: "Turn off 2FA" })
                : t("twoFactor.regenerateCta", { defaultValue: "Generate new codes" })}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ReauthDialog;
