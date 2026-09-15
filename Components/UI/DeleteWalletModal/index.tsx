import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogActions, Typography, Box, Button, CircularProgress, Alert, useTheme } from "@mui/material";
import { DeleteOutlineRounded } from "@mui/icons-material";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
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

/**
 * Confirm-and-delete for a payout wallet. Identity is proven by the unified
 * step-up dialog (raised automatically by the axios interceptor when the
 * `wallet` scope is locked) — no inline OTP step.
 */
const DeleteWalletModal: React.FC<DeleteWalletModalProps> = ({ open, onClose, walletId, walletType, walletAddress, companyId, onDeleted }) => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = useCallback(() => {
    setError("");
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(async () => {
    if (!walletId) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { wallet_id: walletId };
      if (companyId) body.company_id = companyId;
      await axiosBaseApi.post(API_ENDPOINTS.wallet.deleteWallet, body);
      onDeleted();
      handleClose();
    } catch (e: any) {
      if (!e?.stepUpCancelled) setError(e?.response?.data?.message || e?.message || "Failed to delete wallet");
    } finally {
      setLoading(false);
    }
  }, [walletId, companyId, onDeleted, handleClose]);

  const truncatedAddress = walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : "";

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="delete-wallet-modal">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DeleteOutlineRounded sx={{ color: "#DC2626", fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>{t("deleteWalletTitle")}</Typography>
        </Box>

        <Typography data-testid="delete-wallet-body" sx={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "14px", lineHeight: "150%", color: theme.palette.text.secondary, mb: 1.5 }}>
          {t("deleteWalletBody", {
            defaultValue: "You're about to remove the {{type}} payout address{{address}}. This action is permanent and cannot be undone. We'll ask you to verify it's you first.",
            type: walletType,
            address: truncatedAddress ? ` (${truncatedAddress})` : "",
          })}
        </Typography>

        {error && (
          <Alert severity="error" data-testid="delete-wallet-error" sx={{ mb: 1, fontFamily: "var(--font-sans)", fontSize: "13px" }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: "28px", pb: "24px", display: "flex", gap: "12px" }}>
        <Button
          fullWidth
          onClick={handleClose}
          disabled={loading}
          data-testid="delete-wallet-cancel-btn"
          sx={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "14px", color: theme.palette.text.secondary, border: `1px solid ${theme.palette.border.main}`, py: "10px", borderRadius: "8px", textTransform: "none" }}
        >
          {t("cancel")}
        </Button>
        <Button
          fullWidth
          onClick={handleDelete}
          disabled={loading}
          data-testid="delete-wallet-confirm-btn"
          sx={{
            fontFamily: "var(--font-sans)",
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
    </Dialog>
  );
};

export default DeleteWalletModal;
