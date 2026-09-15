import React, { useState } from "react";
import { Alert, Box, Button, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import CustomButton from "@/Components/UI/Buttons";
import { brandFg } from "@/constants/theme";

interface Props {
  challengeToken: string;
  onBack: () => void;
}

/** Lost-authenticator recovery: sends a signed reset link to the account email. */
const ResetViaEmailPanel: React.FC<Props> = ({ challengeToken, onBack }) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");

  const request = async () => {
    setSending(true);
    setError("");
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaResetRequest, { challenge_token: challengeToken });
      setSent(res.data?.data?.masked_email || "");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || t("twoFactor.resetFailed", { defaultValue: "Could not send the reset link. Please try again." }));
    } finally {
      setSending(false);
    }
  };

  if (sent !== null) {
    return (
      <Box data-testid="login-2fa-reset-sent">
        <Alert severity="success" sx={{ fontSize: "13px", mb: 1.5 }}>
          {t("twoFactor.resetSent", { defaultValue: "Check your inbox at {{email}} — the link works once and expires in 30 minutes.", email: sent || t("twoFactor.yourEmail", { defaultValue: "your email" }) })}
        </Alert>
        <Typography sx={{ fontSize: "13px", lineHeight: 1.6, color: theme.palette.text.secondary }}>
          {t("twoFactor.resetAfter", { defaultValue: "After confirming, sign in with your password and the code we email you, then add a new authenticator app from Settings." })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid="login-2fa-reset-panel">
      <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 1.5 }}>
        {t("twoFactor.resetIntro", { defaultValue: "We'll email you a link to remove the authenticator app from your account. Email codes become your second step instead." })}
      </Typography>
      <Alert severity="warning" sx={{ fontSize: "13px", mb: 2 }} data-testid="login-2fa-reset-warning">
        {t("twoFactor.resetConsequences", { defaultValue: "For your safety this signs you out everywhere, forgets all trusted browsers and locks payout address changes for 24 hours." })}
      </Alert>
      {error && <Alert severity="error" sx={{ fontSize: "13px", mb: 1.5 }} data-testid="login-2fa-reset-error">{error}</Alert>}
      <CustomButton
        label={t("twoFactor.resetCta", { defaultValue: "Email me a reset link" })}
        variant="primary"
        size="medium"
        fullWidth
        loading={sending}
        disabled={sending}
        onClick={request}
        data-testid="login-2fa-reset-submit"
      />
      <Button onClick={onBack} disabled={sending} data-testid="login-2fa-reset-back" sx={{ mt: 1, fontSize: "13px", textTransform: "none", color: brandFg(theme.palette.mode === "dark"), fontWeight: 600 }}>
        {t("twoFactor.backToCode", { defaultValue: "Back to code entry" })}
      </Button>
    </Box>
  );
};

export default ResetViaEmailPanel;
