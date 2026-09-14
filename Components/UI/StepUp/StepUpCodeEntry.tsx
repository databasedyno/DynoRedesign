import React, { useState } from "react";
import { Alert, Box, TextField, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomButton from "@/Components/UI/Buttons";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import type { StepUpMethod } from "./stepUpApi";

interface Props {
  method: StepUpMethod;
  /** Masked destination of the emitted code (email / phone). */
  contact: string;
  sending: boolean;
  verifying: boolean;
  error: string;
  countdown: number;
  resetKey: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onClearError: () => void;
}

/** Factor-specific code entry: 6 boxes for emailed/texted codes, a text field for TOTP / backup codes. */
export const StepUpCodeEntry: React.FC<Props> = ({ method, contact, sending, verifying, error, countdown, resetKey, onVerify, onResend, onClearError }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const [value, setValue] = useState("");
  const emitted = method === "email" || method === "sms";

  if (emitted) {
    return (
      <Box data-testid="stepup-code-panel">
        <Typography data-testid="stepup-contact-hint" sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 1.5 }}>
          {sending
            ? t("stepUp.sending", { defaultValue: "Sending your code…" })
            : method === "sms"
              ? t("stepUp.sentSms", { defaultValue: "We texted a 6-digit code to {{contact}}.", contact: contact || t("stepUp.yourPhone", { defaultValue: "your phone" }) })
              : t("stepUp.sentEmail", { defaultValue: "We emailed a 6-digit code to {{contact}}.", contact: contact || t("stepUp.yourEmail", { defaultValue: "your email" }) })}
        </Typography>
        <OtpInputPanel
          contactType={method === "sms" ? "phone" : "email"}
          otpLength={6}
          onVerify={onVerify}
          onResendCode={onResend}
          onClearError={onClearError}
          countdown={countdown}
          loading={verifying || sending}
          error={error}
          primaryButtonLabel={t("stepUp.verify", { defaultValue: "Verify" })}
          showInfoChip={false}
          showLabel={false}
          actionsLayout="stacked"
          resetKey={resetKey}
          testIdPrefix="stepup"
        />
      </Box>
    );
  }

  const isBackup = method === "backup";
  const submit = () => value.trim() && onVerify(value.trim());
  return (
    <Box data-testid="stepup-code-panel">
      <TextField
        fullWidth
        size="small"
        autoFocus
        data-testid="stepup-code-field"
        label={isBackup ? t("stepUp.backupLabel", { defaultValue: "Backup code" }) : t("stepUp.totpLabel", { defaultValue: "Code from your authenticator app" })}
        placeholder={isBackup ? "XXXX-XXXX" : "123456"}
        value={value}
        disabled={verifying}
        autoComplete="one-time-code"
        inputMode={isBackup ? "text" : "numeric"}
        onChange={(e) => {
          setValue(isBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6));
          if (error) onClearError();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        inputProps={{ "data-testid": isBackup ? "stepup-backup-input" : "stepup-totp-input", style: { fontFamily: "var(--font-mono)", letterSpacing: 2 } }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
      />
      {error && (
        <Alert severity="error" data-testid="stepup-error" sx={{ mt: 1.5, fontSize: 13 }}>
          {error}
        </Alert>
      )}
      <CustomButton
        label={t("stepUp.verify", { defaultValue: "Verify" })}
        variant="primary"
        fullWidth
        loading={verifying}
        disabled={verifying || value.trim().length < (isBackup ? 8 : 6)}
        onClick={submit}
        data-testid="stepup-verify-btn"
        sx={{ mt: 2 }}
      />
    </Box>
  );
};

export default StepUpCodeEntry;
