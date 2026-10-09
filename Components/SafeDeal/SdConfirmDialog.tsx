import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { SD_GOLD, SD_GOLD_DARK, SD_INK } from "./sdTheme";

const primaryBtn = {
  textTransform: "none",
  fontWeight: 800,
  borderRadius: 99,
  minHeight: 44,
  color: SD_INK,
  backgroundColor: SD_GOLD,
  "&:hover": { backgroundColor: SD_GOLD_DARK },
} as const;

/** SafeDeal-styled confirm dialog (replaces native window.confirm inside the SafeDeal shell). */
export default function SdConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  testId = "sd-confirm",
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  testId?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      {message && (
        <DialogContent data-testid={`${testId}-content`}>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>{message}</Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }} data-testid={`${testId}-cancel`}>
          {cancelLabel}
        </Button>
        <Button variant="contained" onClick={onConfirm} sx={primaryBtn} data-testid={`${testId}-confirm`}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
