import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { LockOutlined, Visibility, VisibilityOff } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import BackupCodesList from "./BackupCodesList";

export type ReauthIntent = "disable" | "regenerate";

interface ReauthDialogProps {
  open: boolean;
  intent: ReauthIntent;
  /** Accounts without a password confirm with an authenticator / backup code instead. */
  hasPassword: boolean;
  onClose: () => void;
  /** Performs the action. Resolve with new backup codes (regenerate) or nothing (disable). Throw on failure. */
  onConfirm: (credential: { password?: string; token?: string }) => Promise<string[] | void>;
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

/** Password (or current 2FA code) confirmation before disabling 2FA / rotating backup codes. */
const ReauthDialog: React.FC<ReauthDialogProps> = ({ open, intent, hasPassword, onClose, onConfirm }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setShow(false);
    setError("");
    setNewCodes(null);
    setLoading(false);
  }, [open]);

  const isDisable = intent === "disable";
  const title = isDisable
    ? t("twoFactor.disableTitle", { defaultValue: "Turn off two-factor authentication?" })
    : t("twoFactor.regenerateTitle", { defaultValue: "Generate new backup codes" });
  const body = isDisable
    ? t("twoFactor.disableBody", { defaultValue: "Your account will only be protected by your password. Confirm it's you to continue." })
    : t("twoFactor.regenerateBody", { defaultValue: "Your current backup codes stop working the moment new ones are created. Confirm it's you to continue." });
  const fieldLabel = hasPassword
    ? t("twoFactor.currentPassword", { defaultValue: "Current password" })
    : t("twoFactor.currentCode", { defaultValue: "Code from your authenticator app" });

  const submit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await onConfirm(hasPassword ? { password: value } : { token: value.trim() });
      if (Array.isArray(result) && result.length) {
        setNewCodes(result);
      } else {
        onClose();
      }
    } catch (e) {
      setError(errMsg(e, t("twoFactor.reauthFailed", { defaultValue: "We couldn't confirm your identity. Please try again." })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid={`twofa-reauth-dialog-${intent}`}>
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: isDisable ? "#FEE2E2" : (theme.palette.mode === "dark" ? "rgba(99,102,241,0.18)" : "#EEF2FF"), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockOutlined sx={{ color: isDisable ? "#DC2626" : "#4F46E5", fontSize: 22 }} />
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
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>{body}</Typography>
            <TextField
              fullWidth
              size="small"
              autoFocus
              label={fieldLabel}
              type={hasPassword && !show ? "password" : "text"}
              autoComplete={hasPassword ? "current-password" : "one-time-code"}
              value={value}
              disabled={loading}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              inputProps={{ "data-testid": "twofa-reauth-input" }}
              InputProps={hasPassword ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShow((s) => !s)} aria-label="toggle password visibility" edge="end">
                      {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              } : undefined}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
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
              disabled={loading || !value.trim()}
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
