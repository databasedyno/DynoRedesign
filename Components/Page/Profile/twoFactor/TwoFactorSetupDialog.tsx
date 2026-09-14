import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
  useTheme,
} from "@mui/material";
import { ContentCopyRounded, CheckRounded, QrCode2Rounded, VerifiedUserRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import BackupCodesList from "./BackupCodesList";
import { brandFg } from "@/constants/theme";

interface TwoFactorSetupDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fired once 2FA is verified + enabled so the card can refresh its status. */
  onEnabled: () => void;
}

interface SetupPayload {
  qr_code: string;
  secret: string;
  backup_codes: string[];
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const groupSecret = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

/** Enable flow: scan QR (or type secret) → enter a code → save backup codes. */
const TwoFactorSetupDialog: React.FC<TwoFactorSetupDialogProps> = ({ open, onClose, onEnabled }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const [step, setStep] = useState<"scan" | "done">("scan");
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
      setError(errMsg(e, t("twoFactor.setupFailed", { defaultValue: "Couldn't start the 2FA setup. Please try again." })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setStep("scan");
    setSetup(null);
    setError("");
    setSecretCopied(false);
    setOtpResetKey((k) => k + 1);
    startSetup();
  }, [open, startSetup]);

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      await axiosBaseApi.post(API_ENDPOINTS.user.twoFaVerifySetup, { token: code });
      setStep("done");
      onEnabled();
    } catch (e) {
      setError(errMsg(e, t("twoFactor.invalidCode", { defaultValue: "That code didn't work. Enter a fresh code from your app." })));
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
    } catch {
      /* ignore */
    }
  };

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
        {step === "scan" ? (
          <>
            {header(<QrCode2Rounded sx={{ color: brandFg(theme.palette.mode === "dark"), fontSize: 22 }} />, t("twoFactor.setupTitle", { defaultValue: "Set up two-factor authentication" }))}
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
                  <Typography sx={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: "6px" }}>
                    {t("twoFactor.manualKey", { defaultValue: "Can't scan? Enter this key" })}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: 2 }}>
                    <Typography data-testid="twofa-secret" sx={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontSize: "12.5px", letterSpacing: "0.04em", wordBreak: "break-all", color: theme.palette.text.primary }}>
                      {groupSecret(setup.secret)}
                    </Typography>
                    <Button size="small" onClick={copySecret} data-testid="twofa-copy-secret" sx={{ minWidth: 0, p: "4px", color: theme.palette.text.secondary }} aria-label="Copy key">
                      {secretCopied ? <CheckRounded sx={{ fontSize: 16 }} /> : <ContentCopyRounded sx={{ fontSize: 16 }} />}
                    </Button>
                  </Box>
                  <Typography sx={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: "8px" }}>
                    {t("twoFactor.enterCode", { defaultValue: "Enter the 6-digit code" })}
                  </Typography>
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
          </>
        ) : (
          <>
            {header(<VerifiedUserRounded sx={{ color: "#16A34A", fontSize: 22 }} />, t("twoFactor.enabledTitle", { defaultValue: "Two-factor authentication is on" }))}
            <Typography data-testid="twofa-enabled-body" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("twoFactor.enabledBody", { defaultValue: "Save these backup codes somewhere safe. If you lose your phone, each code lets you sign in once. They won't be shown again." })}
            </Typography>
            {setup && <BackupCodesList codes={setup.backup_codes} />}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "22px", display: "flex", gap: "12px" }}>
        {step === "scan" ? (
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
