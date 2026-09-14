import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { ShieldOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import CustomButton from "@/Components/UI/Buttons";

interface TwoFactorLoginDialogProps {
  open: boolean;
  loading?: boolean;
  error?: string;
  onVerify: (code: string) => void;
  onClose: () => void;
}

const BACKUP_CODE_RE = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;

/** Step-up prompt shown after the first factor when the account has TOTP enabled. */
const TwoFactorLoginDialog: React.FC<TwoFactorLoginDialogProps> = ({ open, loading = false, error, onVerify, onClose }) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [backupCode, setBackupCode] = useState("");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMode("totp");
    setBackupCode("");
    setResetKey((k) => k + 1);
  }, [open]);

  useEffect(() => {
    if (error) setResetKey((k) => k + 1);
  }, [error]);

  const backupValid = BACKUP_CODE_RE.test(backupCode.trim());

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="login-2fa-dialog">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: theme.palette.mode === "dark" ? "rgba(99,102,241,0.18)" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldOutlined sx={{ color: "#4F46E5", fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>
            {t("twoFactor.title", { defaultValue: "Two-factor authentication" })}
          </Typography>
        </Box>

        {mode === "totp" ? (
          <>
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.subtitle", { defaultValue: "Enter the 6-digit code from your authenticator app to finish signing in." })}
            </Typography>
            <OtpInputPanel
              otpLength={6}
              onVerify={onVerify}
              loading={loading}
              error={error}
              showInfoChip={false}
              showLabel={false}
              showActions={false}
              resetKey={resetKey}
            />
            {loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: theme.palette.text.secondary, fontSize: "13px" }}>
                <CircularProgress size={14} color="inherit" /> {t("verifying", { defaultValue: "Verifying…" })}
              </Box>
            )}
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.backupSubtitle", { defaultValue: "Enter one of the backup codes you saved when you set up two-factor authentication. Each code works once." })}
            </Typography>
            <TextField
              fullWidth
              size="small"
              autoFocus
              autoComplete="off"
              placeholder="XXXX-XXXX"
              value={backupCode}
              disabled={loading}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && backupValid && !loading) onVerify(backupCode.trim()); }}
              inputProps={{ "data-testid": "login-2fa-backup-input", style: { fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.08em" } }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
            {error && (
              <Alert severity="error" data-testid="login-2fa-error" sx={{ mt: 1.5, fontSize: "13px" }}>
                {error}
              </Alert>
            )}
            <Box sx={{ mt: 2 }}>
              <CustomButton
                label={t("twoFactor.verifyBackup", { defaultValue: "Verify backup code" })}
                variant="primary"
                size="medium"
                fullWidth
                loading={loading}
                disabled={loading || !backupValid}
                onClick={() => onVerify(backupCode.trim())}
                data-testid="login-2fa-backup-submit"
              />
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "20px", display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onClose} disabled={loading} data-testid="login-2fa-cancel" sx={{ fontSize: "13px", color: theme.palette.text.secondary, textTransform: "none" }}>
          {t("twoFactor.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={() => { setMode(mode === "totp" ? "backup" : "totp"); setBackupCode(""); }}
          disabled={loading}
          data-testid="login-2fa-toggle-mode"
          sx={{ fontSize: "13px", color: "#4F46E5", textTransform: "none", fontWeight: 600 }}
        >
          {mode === "totp"
            ? t("twoFactor.useBackup", { defaultValue: "Use a backup code" })
            : t("twoFactor.useApp", { defaultValue: "Use authenticator app" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorLoginDialog;
