import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { brandFg } from "@/constants/theme";
import { enrollErrMsg } from "./AuthenticatorEnroll";

const RESEND_SECONDS = 30;

interface Props {
  onEnrolled: (backupCodes: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}

/** Inline email-code enrolment: auto-sends a 6-digit code to the account email, verifies it once. */
const EmailCodeEnroll: React.FC<Props> = ({ onEnrolled, onBusyChange }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [maskedEmail, setMaskedEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const started = useRef(false);

  const sendCode = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaEmailStart, {});
      setMaskedEmail(data?.data?.masked_email || "");
      setCountdown(RESEND_SECONDS);
    } catch (e) {
      setError(enrollErrMsg(e, t("twoFactor.emailSendFailed", { defaultValue: "Couldn't send the code. Please try again." })));
    } finally {
      setSending(false);
    }
  }, [t]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sendCode();
  }, [sendCode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => { onBusyChange?.(verifying); }, [verifying, onBusyChange]);

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaEmailVerify, { code });
      onEnrolled((data?.data?.backup_codes as string[]) || []);
    } catch (e) {
      setError(enrollErrMsg(e, t("twoFactor.emailInvalidCode", { defaultValue: "That code didn't match. Please try again." })));
      setOtpResetKey((k) => k + 1);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Box data-testid="email-code-enroll">
      <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }} data-testid="email-code-enroll-subtitle">
        {maskedEmail
          ? t("twoFactor.emailEnrollBody", { defaultValue: "We sent a 6-digit code to {{email}}. Enter it below to confirm you can receive sign-in codes there.", email: maskedEmail })
          : t("twoFactor.emailEnrollSending", { defaultValue: "Sending a 6-digit code to your account email…" })}
      </Typography>

      {sending && !maskedEmail ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          {error ? <Alert severity="error" data-testid="email-code-enroll-error">{error}</Alert> : <CircularProgress size={26} />}
        </Box>
      ) : (
        <>
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
          <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              onClick={sendCode}
              disabled={sending || verifying || countdown > 0}
              data-testid="email-code-enroll-resend"
              sx={{ fontSize: "13px", textTransform: "none", fontWeight: 600, color: brandFg(theme.palette.mode === "dark"), px: 0.5, minWidth: 0 }}
            >
              {countdown > 0
                ? t("twoFactor.resendIn", { defaultValue: "Resend code in {{s}}s", s: countdown })
                : t("twoFactor.resend", { defaultValue: "Resend code" })}
            </Button>
            {verifying && (
              <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary }}>
                {t("twoFactor.verifying", { defaultValue: "Verifying…" })}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default EmailCodeEnroll;
