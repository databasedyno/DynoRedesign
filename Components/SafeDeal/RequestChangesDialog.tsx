import React, { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { SD_GOLD, SD_GOLD_DARK, SD_INK } from "./sdTheme";
import type { SdDeal } from "@/api/safedeal";

const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

/** Buyer sends the delivery back for changes (capped rounds) — lighter than a dispute. */
export default function RequestChangesDialog({ open, deal, busy, onClose, onSubmit }: {
  open: boolean; deal: SdDeal; busy: boolean; onClose: () => void; onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const round = Number(deal.revision_round || 0);
  const max = Number(deal.max_revision_rounds || 2);
  const last = round + 1 >= max;
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Ask the seller for changes</DialogTitle>
      <DialogContent data-testid="sd-changes-dialog">
        <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>
          The deal goes back to <b>Funded</b> and the inspection timer stops until the seller delivers again. Your money stays held securely in escrow. Round <b>{round + 1} of {max}</b>.
        </Typography>
        {last && <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }} data-testid="sd-changes-last-round">This is your last round of changes — after this you&apos;ll need to release or open a dispute.</Alert>}
        <TextField
          label="What needs to change?"
          placeholder="Be specific: what's missing, wrong or different from the terms…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={3}
          helperText={`${message.trim().length}/2000 · at least 10 characters`}
          inputProps={{ "data-testid": "sd-changes-message", maxLength: 2000 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Back</Button>
        <Button variant="contained" disabled={busy || message.trim().length < 10} onClick={() => onSubmit(message.trim())} data-testid="sd-act-request-changes" sx={primaryBtn}>
          {busy ? "Sending…" : "Send to seller"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
