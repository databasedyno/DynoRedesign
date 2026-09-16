import React, { useCallback, useState } from "react";
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
import { DeleteForeverRounded } from "@mui/icons-material";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { isStepUpCancelled } from "@/Components/UI/StepUp/stepUpBus";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  /** Account email — the user types it to confirm before the step-up challenge. */
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

/**
 * Account deletion: type the email to confirm, then DELETE /user/account. The
 * backend answers 403 STEPUP_REQUIRED (scope account_delete) and the shared
 * step-up dialog runs the account's 2FA factor — authenticator when enrolled,
 * otherwise an emailed code — before the request is retried.
 */
const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ open, onClose, email }) => {
  const theme = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailMatches = email.trim().length > 0 && confirmText.trim().toLowerCase() === email.trim().toLowerCase();

  const handleClose = useCallback(() => {
    if (loading) return;
    setConfirmText("");
    setError("");
    onClose();
  }, [loading, onClose]);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await axiosBaseApi.delete(API_ENDPOINTS.user.deleteAccount);
      // Backend soft-deleted the account and signed us out — leave immediately.
      clearSessionAndLeave();
    } catch (e) {
      if (!isStepUpCancelled(e)) setError(errMsg(e, "Couldn't delete your account."));
      setLoading(false);
    }
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="delete-account-modal">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DeleteForeverRounded sx={{ color: "#DC2626", fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>Delete your account?</Typography>
        </Box>
        <Typography sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
          This <strong>deactivates your entire Dynopay account</strong> — every brand, wallet, payment link and
          setting — and signs you out of all devices immediately. For legal/compliance reasons some records are
          kept securely afterwards, so only our support team can restore the account. You&apos;ll confirm with your
          two-step verification next.
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
      </DialogContent>

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
          onClick={handleDelete}
          disabled={loading || !emailMatches}
          data-testid="delete-account-submit-btn"
          sx={{
            fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#DC2626", py: "10px", borderRadius: "8px", textTransform: "none",
            "&:hover": { backgroundColor: "#B91C1C" },
            "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : "Delete account"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteAccountModal;
