import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import { ContentCopyRounded, CheckRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

interface SetupPayload {
  qr_code: string;
  secret: string;
  backup_codes: string[];
}

export const enrollErrMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const groupSecret = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

interface Props {
  /** Fired once the code is verified; receives the one-time backup codes. */
  onEnrolled: (backupCodes: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}

/** Inline authenticator enrolment: QR (or manual key) → 6-digit code. Reused by the setup dialog, onboarding step and the 2FA gate. */
const AuthenticatorEnroll: React.FC<Props> = ({ onEnrolled, onBusyChange }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);

  const startSetup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaSetup);
      setSetup(data?.data as SetupPayload);
    } catch (e) {
      setError(enrollErrMsg(e, t("twoFactor.setupFailed", { defaultValue: "Couldn't start the 2FA setup. Please try again." })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { startSetup(); }, [startSetup]);
  useEffect(() => { onBusyChange?.(verifying); }, [verifying, onBusyChange]);

  const handleVerify = async (code: string) => {
    if (code.length !== 6 || !setup) return;
    setVerifying(true);
    setError("");
    try {
      await axiosBaseApi.post(API_ENDPOINTS.user.twoFaVerifySetup, { token: code });
      onEnrolled(setup.backup_codes);
    } catch (e) {
      setError(enrollErrMsg(e, t("twoFactor.invalidCode", { defaultValue: "That code didn't work. Enter a fresh code from your app." })));
      setOtpResetKey((k) => k + 1);
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (!setup?.secret) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const label = (text: string) => (
    <Typography sx={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: "6px" }}>{text}</Typography>
  );

  return (
    <Box data-testid="authenticator-enroll">
      <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
        {t("twoFactor.setupBody", { defaultValue: "Scan this QR code with Google Authenticator, 1Password, Authy or any TOTP app, then enter the 6-digit code it shows." })}
      </Typography>

      {loading || !setup ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          {error ? <Alert severity="error" data-testid="twofa-setup-error">{error}</Alert> : <CircularProgress size={26} />}
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: "20px", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "center", sm: "flex-start" } }}>
          <Box
            component="img"
            src={setup.qr_code}
            alt="2FA QR code"
            data-testid="twofa-qr"
            sx={{ width: 168, height: 168, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}`, backgroundColor: "#fff", p: "6px", flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            {label(t("twoFactor.manualKey", { defaultValue: "Can't scan? Enter this key" }))}
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: 2 }}>
              <Typography data-testid="twofa-secret" sx={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontSize: "12.5px", letterSpacing: "0.04em", wordBreak: "break-all", color: theme.palette.text.primary }}>
                {groupSecret(setup.secret)}
              </Typography>
              <Button size="small" onClick={copySecret} data-testid="twofa-copy-secret" sx={{ minWidth: 0, p: "4px", color: theme.palette.text.secondary }} aria-label="Copy key">
                {secretCopied ? <CheckRounded sx={{ fontSize: 16 }} /> : <ContentCopyRounded sx={{ fontSize: 16 }} />}
              </Button>
            </Box>
            {label(t("twoFactor.enterCode", { defaultValue: "Enter the 6-digit code" }))}
            <OtpInputPanel
              otpLength={6}
              onVerify={handleVerify}
              onClearError={() => setError("")}
              loading={verifying}
              error={error}
              showInfoChip={false}
              showLabel={false}
              showActions={false}
              resetKey={otpResetKey}
            />
            {verifying && (
              <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, mt: "6px" }}>
                {t("twoFactor.verifying", { defaultValue: "Verifying…" })}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AuthenticatorEnroll;
