import React, { useState, useCallback, useEffect } from "react";
import {Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert, useTheme} from "@mui/material";
import { WarningAmberRounded, DeleteOutlineRounded } from "@mui/icons-material";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import axiosBaseApi from "@/axiosConfig";
import { useTranslation } from "react-i18next";

interface DeleteWalletModalProps {
  open: boolean;
  onClose: () => void;
  walletId: number | null;
  walletType: string;
  walletAddress: string;
  companyId?: string | number;
  onDeleted: () => void;
}

const DeleteWalletModal: React.FC<DeleteWalletModalProps> = ({
  open,
  onClose,
  walletId,
  walletType,
  walletAddress,
  companyId,
  onDeleted,
}) => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpResetKey, setOtpResetKey] = useState(0);

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleClose = useCallback(() => {
    setStep("confirm");
    setError("");
    setLoading(false);
    setMaskedEmail("");
    setCountdown(0);
    setOtpResetKey((k) => k + 1);
    onClose();
  }, [onClose]);

  const handleSendOtp = useCallback(async () => {
    if (!walletId) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId };
      if (companyId) body.company_id = companyId;
      const response = await axiosBaseApi.post("wallet/wallet/delete/send-otp", body);
      const data = response?.data?.data;
      if (data?.email) setMaskedEmail(data.email);
      setStep("otp");
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }, [walletId, companyId]);

  const handleResendOtp = useCallback(async () => {
    if (!walletId || countdown > 0) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId };
      if (companyId) body.company_id = companyId;
      await axiosBaseApi.post("wallet/wallet/delete/send-otp", body);
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  }, [walletId, companyId, countdown]);

  const handleDelete = useCallback(async (otpCode: string) => {
    if (!walletId || !otpCode || otpCode.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId, otp: otpCode };
      if (companyId) body.company_id = companyId;
      await axiosBaseApi.post("wallet/wallet/delete/verify", body);
      onDeleted();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to delete wallet");
    } finally {
      setLoading(false);
    }
  }, [walletId, companyId, onDeleted, handleClose]);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : "";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: "12px" } }}
    >
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        {step === "confirm" ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  backgroundColor: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DeleteOutlineRounded sx={{ color: "#DC2626", fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "UrbanistSemibold",
                  fontWeight: 600,
                  fontSize: "18px",
                  lineHeight: "100%",
                }}
              >
                {t("deleteWalletTitle")}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                color: theme.palette.text.secondary,
                mb: 1.5,
              }}
            >
              You&apos;re about to remove the {walletType} wallet
              {truncatedAddress && (
                <Typography
                  component="span"
                  sx={{ fontFamily: "UrbanistSemibold", color: "text.primary" }}
                >
                  {" "}
                  ({truncatedAddress})
                </Typography>
              )}
              . This action is permanent and cannot be undone. An OTP will be sent to your email for verification.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: "UrbanistMedium", fontSize: "13px" }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  backgroundColor: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <WarningAmberRounded sx={{ color: "#D97706", fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "UrbanistSemibold",
                  fontWeight: 600,
                  fontSize: "18px",
                  lineHeight: "100%",
                }}
              >
                {t("enterVerificationCode")}
              </Typography>
            </Box>

            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                fontSize: "14px",
                lineHeight: "150%",
                color: theme.palette.text.secondary,
                mb: 2,
              }}
            >
              We sent a 6-digit code to {maskedEmail || "your email"}. Enter it below to confirm deletion.
            </Typography>

            {/* Shared OTP block — auto-submits and triggers delete the moment 6 digits are entered */}
            <OtpInputPanel
              contactType="email"
              otpLength={6}
              onVerify={handleDelete}
              onResendCode={handleResendOtp}
              onClearError={() => setError("")}
              countdown={countdown}
              loading={loading}
              error={error}
              primaryButtonLabel="Verify"
              showInfoChip={false}
              showLabel={false}
              actionsLayout="stacked"
              resetKey={otpResetKey}
            />
          </>
        )}
      </DialogContent>

      {/* Action bar only shown on the confirm step — the OTP step has its own action row inside <OtpInputPanel/>. */}
      {step === "confirm" && (
        <DialogActions sx={{ px: "28px", pb: "24px", display: "flex", gap: "12px" }}>
          <Button
            fullWidth
            onClick={handleClose}
            disabled={loading}
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "14px",
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.border.main}`,
              py: "10px",
              borderRadius: "8px",
              textTransform: "none",
            }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={handleSendOtp}
            disabled={loading}
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "14px",
              color: "#FFFFFF",
              backgroundColor: "#DC2626",
              py: "10px",
              borderRadius: "8px",
              textTransform: "none",
              "&:hover": { backgroundColor: "#B91C1C" },
              "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : t("deleteWalletAction")}
          </Button>
        </DialogActions>
      )}

      {step === "otp" && (
        <DialogActions sx={{ px: "28px", pb: "24px", justifyContent: "center" }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              fontSize: "13px",
              color: theme.palette.text.secondary,
              textTransform: "none",
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DeleteWalletModal;
