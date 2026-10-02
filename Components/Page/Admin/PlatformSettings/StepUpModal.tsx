import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import { ShieldRounded } from "@mui/icons-material";

export interface PendingChange {
  key: string;
  label: string;
  /** Human-readable summary of the change, e.g. "1.5 % → 2.5 %" or "Revert to environment default". */
  summary: string;
  danger?: boolean;
}

interface Props {
  open: boolean;
  pending: PendingChange | null;
  submitting: boolean;
  error: string | null;
  onConfirm: (reason: string, code: string) => void;
  onClose: () => void;
}

/** "Verify it's you" — collects a reason + authenticator code before a settings write. */
const StepUpModal: React.FC<Props> = ({ open, pending, submitting, error, onConfirm, onClose }) => {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setCode("");
    }
  }, [open, pending?.key]);

  const canConfirm = code.trim().length >= 6 && !submitting;

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth
      PaperProps={{ "data-testid": "ps-stepup-modal", sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 17, fontWeight: 700 }}>
        <ShieldRounded fontSize="small" color={pending?.danger ? "error" : "primary"} />
        Verify it&apos;s you
      </DialogTitle>
      <DialogContent>
        {pending && (
          <Box
            data-testid="ps-stepup-summary"
            sx={{ p: 1.5, mb: 2, borderRadius: "12px", bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}
          >
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 0.25 }}>{pending.label}</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{pending.summary}</Typography>
          </Box>
        )}
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>
          Changes to platform settings are audited. Enter a reason and the 6-digit code from your authenticator app.
        </Typography>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          inputProps={{ "data-testid": "ps-stepup-reason", maxLength: 200 }}
        />
        <TextField
          label="Authenticator code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          fullWidth
          size="small"
          autoFocus
          placeholder="123456"
          inputProps={{ "data-testid": "ps-stepup-code", inputMode: "numeric" }}
          onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) onConfirm(reason.trim(), code.trim()); }}
        />
        {error && <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }} data-testid="ps-stepup-error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} data-testid="ps-stepup-cancel" sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={pending?.danger ? "error" : "primary"}
          disabled={!canConfirm}
          onClick={() => onConfirm(reason.trim(), code.trim())}
          data-testid="ps-stepup-confirm"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {submitting ? "Verifying…" : "Confirm change"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StepUpModal;
