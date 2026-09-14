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
import { DeleteForeverRounded, WarningAmberRounded } from "@mui/icons-material";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  /** Account email — the user types it to confirm before the OTP step. */
  email: string;
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const clearSessionAndLeave = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("last_company_id");
  } catch (_e) { /* ignore */ }
  // Hard redirect so all in-memory state (SWR / redux) is discarded.
  window.location.replace("/auth/login?account_deleted=1");
};

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ open, onClose, email }) => {
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

  const emailMatches = email.trim().length > 0 && confirmText.trim().toLowerCase() === email.trim().toLowerCase();

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
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post(API_ENDPOINTS.user.deleteAccountSendOtp);
      if (data?.data?.email) setMaskedEmail(data.data.email);
      setStep("otp");
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch (e) {
      setError(errMsg(e, "Couldn't send the verification code."));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerify = useCallback(async (otp: string) => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.user.deleteAccount, { data: { otp } });
      // Backend soft-deleted the account and signed us out — leave immediately.
      clearSessionAndLeave();
    } catch (e) {
      setError(errMsg(e, "Couldn't delete your account."));
      setLoading(false);
    }
  }, []);

  const header = (icon: React.ReactNode, bg: string, title: string) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>{title}</Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="delete-account-modal">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        {step === "confirm" ? (
          <>
            {header(<DeleteForeverRounded sx={{ color: "#DC2626", fontSize: 22 }} />, "#FEE2E2", "Delete your account?")}
            <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              This schedules your <strong>entire Dynopay account</strong> — every brand, wallet, payment link and
              setting — for deletion, and signs you out of all devices. You&apos;ll have <strong>7 days</strong> to
              restore it by contacting support before it&apos;s permanently deleted. We&apos;ll email you a 6-digit code to confirm.
            </Typography>
            <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, mb: 0.75 }}>
              Type your account email <strong>{email}</strong> to continue:
            </Typography>
            <TextField
              fullWidth
              size="small"
              autoComplete="off"
              placeholder={email}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              inputProps={{ "data-testid": "delete-account-confirm-input" }}
              error={confirmText.length > 0 && !emailMatches}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />
            {error && (
              <Alert severity="error" data-testid="delete-account-error" sx={{ mt: 1.5, fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            {header(<WarningAmberRounded sx={{ color: "#D97706", fontSize: 22 }} />, "#FEF3C7", "Enter verification code")}
            <Typography data-testid="delete-account-otp-hint" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
              We sent a 6-digit code to {maskedEmail || "your email"}. Enter it below to schedule your account for deletion.
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
              primaryButtonLabel="Delete account"
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
            data-testid="delete-account-cancel-btn"
            sx={{ fontWeight: 500, fontSize: "14px", color: theme.palette.text.secondary, border: `1px solid ${theme.palette.border.main}`, py: "10px", borderRadius: "8px", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={requestCode}
            disabled={loading || !emailMatches}
            data-testid="delete-account-send-code-btn"
            sx={{
              fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#DC2626", py: "10px", borderRadius: "8px", textTransform: "none",
              "&:hover": { backgroundColor: "#B91C1C" },
              "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : "Send code"}
          </Button>
        </DialogActions>
      ) : (
        <DialogActions sx={{ px: "28px", pb: "24px", justifyContent: "center" }}>
          <Button onClick={handleClose} disabled={loading} data-testid="delete-account-otp-cancel-btn" sx={{ fontSize: "13px", color: theme.palette.text.secondary, textTransform: "none" }}>
            Cancel
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DeleteAccountModal;
