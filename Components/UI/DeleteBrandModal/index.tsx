import React, { useCallback, useEffect, useState } from "react";
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
import { DeleteOutlineRounded, WarningAmberRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

interface DeleteBrandModalProps {
  open: boolean;
  onClose: () => void;
  companyId: number | string | null | undefined;
  companyName: string;
  /** Called with the verified OTP — the caller performs the DELETE. Must throw on failure. */
  onDelete: (otp: string) => Promise<void>;
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const DeleteBrandModal: React.FC<DeleteBrandModalProps> = ({ open, onClose, companyId, companyName, onDelete }) => {
  const { t } = useTranslation("companySettings");
  const theme = useTheme();
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpResetKey, setOtpResetKey] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const nameMatches =
    companyName.trim().length > 0 && confirmText.trim().toLowerCase() === companyName.trim().toLowerCase();

  const handleClose = useCallback(() => {
    setStep("confirm");
    setConfirmText("");
    setError("");
    setLoading(false);
    setMaskedEmail("");
    setCountdown(0);
    setOtpResetKey((k) => k + 1);
    onClose();
  }, [onClose]);

  const requestCode = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post(API_ENDPOINTS.company.deleteSendOtp(companyId));
      if (data?.data?.email) setMaskedEmail(data.data.email);
      setStep("otp");
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch (e) {
      setError(errMsg(e, t("delete.sendFailed", { defaultValue: "Couldn't send the verification code." })));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  const handleVerify = useCallback(
    async (otp: string) => {
      if (otp.length !== 6) return;
      setLoading(true);
      setError("");
      try {
        await onDelete(otp);
        handleClose();
      } catch (e) {
        setError(errMsg(e, t("delete.deleteFailed", { defaultValue: "Couldn't delete the brand." })));
      } finally {
        setLoading(false);
      }
    },
    [onDelete, handleClose, t],
  );

  const header = (icon: React.ReactNode, bg: string, title: string) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>{title}</Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="delete-brand-modal">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        {step === "confirm" ? (
          <>
            {header(<DeleteOutlineRounded sx={{ color: "#DC2626", fontSize: 22 }} />, "#FEE2E2", t("delete.title", { defaultValue: "Delete this brand?" }))}
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("delete.body", {
                defaultValue: "This permanently removes {{name}} together with its payment links, API keys and settings. This cannot be undone. We'll email you a 6-digit code to confirm.",
                name: companyName,
              })}
            </Typography>
            <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, mb: 0.75 }}>
              {t("delete.typeToConfirm", { defaultValue: "Type {{name}} to continue:", name: companyName })}
            </Typography>
            <TextField
              fullWidth
              size="small"
              autoComplete="off"
              placeholder={companyName}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              inputProps={{ "data-testid": "delete-company-confirm-input" }}
              error={confirmText.length > 0 && !nameMatches}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
            {error && (
              <Alert severity="error" data-testid="delete-brand-error" sx={{ mt: 1.5, fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            {header(<WarningAmberRounded sx={{ color: "#D97706", fontSize: 22 }} />, "#FEF3C7", t("delete.otpTitle", { defaultValue: "Enter verification code" }))}
            <Typography data-testid="delete-brand-otp-hint" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              {t("delete.otpBody", {
                defaultValue: "We sent a 6-digit code to {{email}}. Enter it below to delete {{name}}.",
                email: maskedEmail || t("delete.yourEmail", { defaultValue: "your email" }),
                name: companyName,
              })}
            </Typography>
            <OtpInputPanel
              contactType="email"
              otpLength={6}
              onVerify={handleVerify}
              onResendCode={requestCode}
              onClearError={() => setError("")}
              countdown={countdown}
              loading={loading}
              error={error}
              primaryButtonLabel={t("delete.confirmCta", { defaultValue: "Delete brand" })}
              showInfoChip={false}
              showLabel={false}
              actionsLayout="stacked"
              resetKey={otpResetKey}
            />
          </>
        )}
      </DialogContent>

      {step === "confirm" ? (
        <DialogActions sx={{ px: "28px", pb: "24px", display: "flex", gap: "12px" }}>
          <Button
            fullWidth
            onClick={handleClose}
            disabled={loading}
            data-testid="delete-brand-cancel-btn"
            sx={{ fontWeight: 500, fontSize: "14px", color: theme.palette.text.secondary, border: `1px solid ${theme.palette.border.main}`, py: "10px", borderRadius: "8px", textTransform: "none" }}
          >
            {t("delete.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            fullWidth
            onClick={requestCode}
            disabled={loading || !nameMatches}
            data-testid="delete-brand-send-code-btn"
            sx={{
              fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#DC2626", py: "10px", borderRadius: "8px", textTransform: "none",
              "&:hover": { backgroundColor: "#B91C1C" },
              "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : t("delete.sendCode", { defaultValue: "Send code" })}
          </Button>
        </DialogActions>
      ) : (
        <DialogActions sx={{ px: "28px", pb: "24px", justifyContent: "center" }}>
          <Button onClick={handleClose} disabled={loading} data-testid="delete-brand-otp-cancel-btn" sx={{ fontSize: "13px", color: theme.palette.text.secondary, textTransform: "none" }}>
            {t("delete.cancel", { defaultValue: "Cancel" })}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DeleteBrandModal;
