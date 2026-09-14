import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { brandFg } from "@/constants/theme";
import type { StepUpScope } from "./stepUpBus";
import { apiErrorMessage, fetchStepUpStatus, requestStepUpCode, verifyStepUpCode, StepUpMethod, StepUpStatus, StepUpVerified } from "./stepUpApi";
import { scopeActionLabel } from "./stepUpCopy";
import { StepUpMethodTabs } from "./StepUpMethodTabs";
import { StepUpCodeEntry } from "./StepUpCodeEntry";

interface Props {
  open: boolean;
  scope: StepUpScope;
  onVerified: (result: StepUpVerified) => void;
  onCancel: () => void;
}

const RESEND_SECONDS = 30;

const pickDefault = (m: StepUpStatus["methods"]): StepUpMethod => (m.totp ? "totp" : m.email ? "email" : m.sms ? "sms" : "backup");

/**
 * Shared step-up ("verify it's you") dialog. Email code always (SMS when the
 * account has no email), authenticator + backup codes when 2FA is enrolled.
 */
const StepUpDialog: React.FC<Props> = ({ open, scope, onVerified, onCancel }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const dark = theme.palette.mode === "dark";
  const [status, setStatus] = useState<StepUpStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [method, setMethod] = useState<StepUpMethod>("email");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const sentForRef = useRef<Set<StepUpMethod>>(new Set());

  const sendCode = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const r = await requestStepUpCode(scope);
      setSentTo(r.contact || "");
      setCountdown(RESEND_SECONDS);
      setResetKey((k) => k + 1);
    } catch (e) {
      setError(apiErrorMessage(e, t("stepUp.sendFailed", { defaultValue: "We couldn't send the code. Please try again." })));
    } finally {
      setSending(false);
    }
  }, [scope, t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus(null);
    setStatusError("");
    setError("");
    setSentTo("");
    setCountdown(0);
    sentForRef.current = new Set();
    (async () => {
      try {
        const s = await fetchStepUpStatus(scope);
        if (cancelled) return;
        setStatus(s);
        const def = pickDefault(s.methods);
        setMethod(def);
        if (def === "email" || def === "sms") {
          sentForRef.current.add(def);
          sendCode();
        }
      } catch (e) {
        if (!cancelled) setStatusError(apiErrorMessage(e, t("stepUp.statusFailed", { defaultValue: "Couldn't start verification. Please try again." })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scope, sendCode, t]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const switchMethod = (m: StepUpMethod) => {
    setMethod(m);
    setError("");
    if ((m === "email" || m === "sms") && !sentForRef.current.has(m)) {
      sentForRef.current.add(m);
      sendCode();
    }
  };

  const verify = async (code: string) => {
    setVerifying(true);
    setError("");
    try {
      const r = await verifyStepUpCode(scope, method, code);
      onVerified(r);
    } catch (e) {
      setError(apiErrorMessage(e, t("stepUp.invalidCode", { defaultValue: "Invalid code. Please try again." })));
      setResetKey((k) => k + 1);
    } finally {
      setVerifying(false);
    }
  };

  const busy = verifying || sending;
  const noMethods = status && !Object.values(status.methods).some(Boolean);

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: "12px" } }}
      data-testid="stepup-dialog"
      data-scope={scope}
    >
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "12px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", flexShrink: 0, backgroundColor: dark ? "rgba(129,140,248,0.16)" : "#EEF2FF", display: "grid", placeItems: "center" }}>
            <Icon name="shield-check" size={20} color={brandFg(dark)} />
          </Box>
          <Typography component="h2" data-testid="stepup-title" sx={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: -0.2, lineHeight: 1.2 }}>
            {t("stepUp.title", { defaultValue: "Verify it's you" })}
          </Typography>
        </Box>
        <Typography data-testid="stepup-body" sx={{ fontSize: 14, lineHeight: 1.6, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 2 }}>
          {t("stepUp.body", {
            defaultValue: "To {{action}}, confirm it's really you. This unlocks the action for 10 minutes — no more codes until then.",
            action: scopeActionLabel(t, scope),
          })}
        </Typography>

        {!status && !statusError && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }} data-testid="stepup-loading">
            <CircularProgress size={24} />
          </Box>
        )}
        {statusError && (
          <Alert severity="error" data-testid="stepup-error" sx={{ fontSize: 13 }}>
            {statusError}
          </Alert>
        )}
        {noMethods && (
          <Alert severity="warning" data-testid="stepup-no-methods" sx={{ fontSize: 13 }}>
            {t("stepUp.noMethods", { defaultValue: "Add an email address to your account first — we need somewhere to send your verification code." })}
          </Alert>
        )}
        {status && !noMethods && (
          <>
            <StepUpMethodTabs methods={status.methods} value={method} onChange={switchMethod} disabled={busy} data-testid="stepup-method-tabs" />
            <StepUpCodeEntry
              key={method}
              method={method}
              contact={sentTo || (method === "sms" ? status.contact.phone : status.contact.email)}
              sending={sending}
              verifying={verifying}
              error={error}
              countdown={countdown}
              resetKey={resetKey}
              onVerify={verify}
              onResend={sendCode}
              onClearError={() => setError("")}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: "28px", pb: "20px", justifyContent: "center" }}>
        <Button onClick={onCancel} disabled={verifying} data-testid="stepup-cancel-btn" sx={{ fontSize: 13, color: theme.palette.text.secondary, textTransform: "none", fontFamily: "var(--font-sans)" }}>
          {t("stepUp.cancel", { defaultValue: "Cancel" })}
        </Button>
      </DialogActions>
      {/* icon-bundle literals: <Icon name="shield-check" /> */}
    </Dialog>
  );
};

export default StepUpDialog;
