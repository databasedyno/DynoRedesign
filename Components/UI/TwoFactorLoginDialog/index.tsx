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
import { ShieldOutlined, MailOutline } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import CustomButton from "@/Components/UI/Buttons";
import { brandFg } from "@/constants/theme";
import ResetViaEmailPanel from "./ResetViaEmailPanel";
import { useResendChallengeCode } from "./useResendChallengeCode";

interface TwoFactorLoginDialogProps {
  open: boolean;
  loading?: boolean;
  error?: string;
  /** Which second factor the account uses — decides the copy and the resend control. */
  method?: "totp" | "email";
  maskedEmail?: string;
  challengeToken?: string;
  onVerify: (code: string) => void;
  onClose: () => void;
}

type Mode = "code" | "backup" | "reset";
const BACKUP_CODE_RE = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;

/** Second-factor prompt after the first factor succeeded on a browser this account hasn't trusted yet. */
const TwoFactorLoginDialog: React.FC<TwoFactorLoginDialogProps> = ({
  open, loading = false, error, method = "totp", maskedEmail = "", challengeToken = "", onVerify, onClose,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [mode, setMode] = useState<Mode>("code");
  const [backupCode, setBackupCode] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const resend = useResendChallengeCode(challengeToken, open && method === "email");

  useEffect(() => {
    if (!open) return;
    setMode("code");
    setBackupCode("");
    setResetKey((k) => k + 1);
  }, [open]);

  useEffect(() => {
    if (error) setResetKey((k) => k + 1);
  }, [error]);

  const backupValid = BACKUP_CODE_RE.test(backupCode.trim());
  const isEmail = method === "email";
  const Icon = isEmail ? MailOutline : ShieldOutlined;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="login-2fa-dialog">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon sx={{ color: brandFg(isDark), fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }} data-testid="login-2fa-title">
            {mode === "reset"
              ? t("twoFactor.resetTitle", { defaultValue: "Reset two-step verification" })
              : t("twoFactor.title", { defaultValue: "Two-step verification" })}
          </Typography>
        </Box>

        {mode === "code" && (
          <>
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }} data-testid="login-2fa-subtitle">
              {isEmail
                ? t("twoFactor.emailSubtitle", { defaultValue: "We emailed a 6-digit code to {{email}}. Enter it to finish signing in — this browser will be remembered for 90 days.", email: maskedEmail || t("twoFactor.yourEmail", { defaultValue: "your email" }) })
                : t("twoFactor.subtitle", { defaultValue: "Enter the 6-digit code from your authenticator app to finish signing in. This browser will be remembered for 90 days." })}
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
            {isEmail && (
              <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Button
                  onClick={resend.send}
                  disabled={loading || resend.countdown > 0 || resend.sending}
                  data-testid="login-2fa-resend"
                  sx={{ fontSize: "13px", textTransform: "none", fontWeight: 600, color: brandFg(isDark), px: 0.5, minWidth: 0 }}
                >
                  {resend.countdown > 0
                    ? t("twoFactor.resendIn", { defaultValue: "Resend code in {{s}}s", s: resend.countdown })
                    : t("twoFactor.resend", { defaultValue: "Resend code" })}
                </Button>
                {resend.message && (
                  <Typography sx={{ fontSize: "12px", color: resend.isError ? theme.palette.error.main : theme.palette.text.secondary }} data-testid="login-2fa-resend-status">
                    {resend.message}
                  </Typography>
                )}
              </Box>
            )}
          </>
        )}

        {mode === "backup" && (
          <>
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.backupSubtitle", { defaultValue: "Enter one of the backup codes you saved when you set up two-step verification. Each code works once." })}
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

        {mode === "reset" && <ResetViaEmailPanel challengeToken={challengeToken} onBack={() => setMode("code")} />}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 0.5 }}>
        <Button onClick={onClose} disabled={loading} data-testid="login-2fa-cancel" sx={{ fontSize: "13px", color: theme.palette.text.secondary, textTransform: "none" }}>
          {t("twoFactor.cancel", { defaultValue: "Cancel" })}
        </Button>
        {mode !== "reset" && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button
              onClick={() => { setMode(mode === "code" ? "backup" : "code"); setBackupCode(""); }}
              disabled={loading}
              data-testid="login-2fa-toggle-mode"
              sx={{ fontSize: "13px", color: brandFg(isDark), textTransform: "none", fontWeight: 600 }}
            >
              {mode === "code"
                ? t("twoFactor.useBackup", { defaultValue: "Use a backup code" })
                : isEmail
                  ? t("twoFactor.useEmail", { defaultValue: "Use emailed code" })
                  : t("twoFactor.useApp", { defaultValue: "Use authenticator app" })}
            </Button>
            {!isEmail && (
              <Button
                onClick={() => setMode("reset")}
                disabled={loading}
                data-testid="login-2fa-lost-app"
                sx={{ fontSize: "13px", color: theme.palette.text.secondary, textTransform: "none" }}
              >
                {t("twoFactor.lostApp", { defaultValue: "Lost your authenticator?" })}
              </Button>
            )}
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorLoginDialog;
