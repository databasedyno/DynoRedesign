import React, { useCallback, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, TextField, Typography, useTheme } from "@mui/material";
import { DeleteOutlineRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface DeleteBrandModalProps {
  open: boolean;
  onClose: () => void;
  companyId: number | string | null | undefined;
  companyName: string;
  /** Performs the DELETE (step-up is raised automatically by the axios interceptor). Must throw on failure. */
  onDelete: () => Promise<void>;
}

const errMsg = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

/** Type-the-name confirmation before deleting a brand; identity check = unified step-up dialog. */
const DeleteBrandModal: React.FC<DeleteBrandModalProps> = ({ open, onClose, companyId, companyName, onDelete }) => {
  const { t } = useTranslation("companySettings");
  const theme = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nameMatches = companyName.trim().length > 0 && confirmText.trim().toLowerCase() === companyName.trim().toLowerCase();

  const handleClose = useCallback(() => {
    setConfirmText("");
    setError("");
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(async () => {
    if (!companyId || !nameMatches) return;
    setLoading(true);
    setError("");
    try {
      await onDelete();
      handleClose();
    } catch (e) {
      if (!(e as { stepUpCancelled?: boolean })?.stepUpCancelled) {
        setError(errMsg(e, t("delete.deleteFailed", { defaultValue: "Couldn't delete the brand." })));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, nameMatches, onDelete, handleClose, t]);

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "12px" } }} data-testid="delete-brand-modal">
      <DialogContent sx={{ px: "28px", pt: "28px", pb: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DeleteOutlineRounded sx={{ color: "#DC2626", fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "18px", lineHeight: "100%" }}>
            {t("delete.title", { defaultValue: "Delete this brand?" })}
          </Typography>
        </Box>
        <Typography data-testid="delete-brand-body" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
          {t("delete.bodyStepUp", {
            defaultValue: "This permanently removes {{name}} together with its payment links, API keys and settings. This cannot be undone. We'll ask you to verify it's you first.",
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
          data-testid="delete-company-confirm-field"
          placeholder={companyName}
          value={confirmText}
          disabled={loading}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDelete();
          }}
          inputProps={{ "data-testid": "delete-company-confirm-input" }}
          error={confirmText.length > 0 && !nameMatches}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
        />
        {error && (
          <Alert severity="error" data-testid="delete-brand-error" sx={{ mt: 1.5, fontSize: "13px" }}>
            {error}
          </Alert>
        )}
      </DialogContent>

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
          onClick={handleDelete}
          disabled={loading || !nameMatches}
          data-testid="delete-brand-confirm-btn"
          sx={{
            fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#DC2626", py: "10px", borderRadius: "8px", textTransform: "none",
            "&:hover": { backgroundColor: "#B91C1C" },
            "&:disabled": { backgroundColor: "#FCA5A5", color: "#FFF" },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: "#FFF" }} /> : t("delete.confirmCta", { defaultValue: "Delete brand" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteBrandModal;
