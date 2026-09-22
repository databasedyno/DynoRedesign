import React, { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { sdError, type StepUpAction } from "@/api/safedeal";
import { primaryBtn } from "./sdStyles";

/** Reusable "request code → enter code → confirm" dialog for sensitive actions. */
export function StepUpDialog({ title, body, confirmLabel, testid, onClose, onConfirm, onError, children, disabled, action }: {
  title: string; body?: string; confirmLabel: string; testid: string; onClose: () => void;
  onConfirm: (code: string) => Promise<void>; onError: (m: string) => void; children?: React.ReactNode; disabled?: boolean;
  /** What the code confirms — makes the email say "Confirm your cashout" instead of a vague wallet change. */
  action?: StepUpAction;
}) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await safedealApi.stepUp(action);
      setPreview(r.preview_code || null);
      setSent(true);
    } catch (e) {
      onError(sdError(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(code.trim());
    } catch (e) {
      onError(sdError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent data-testid={`${testid}-dialog`}>
        {body && <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>{body}</Typography>}
        {children}
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: sent ? 1 : 0 }}>
            <Typography sx={{ fontSize: 12.5, color: "#4B5563" }}><Icon icon="mdi:shield-lock-outline" width={14} style={{ verticalAlign: -2 }} /> Confirm with a one-time email code</Typography>
            <Button size="small" disabled={busy} onClick={() => void send()} data-testid={`${testid}-send-code`} sx={{ textTransform: "none", fontWeight: 700 }}>{sent ? "Resend" : "Send code"}</Button>
          </Stack>
          {preview && <Alert severity="info" sx={{ mb: 1, py: 0 }} data-testid={`${testid}-preview-code`}>Preview: your code is <b>{preview}</b></Alert>}
          {sent && <TextField size="small" fullWidth label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputProps={{ "data-testid": `${testid}-code`, inputMode: "numeric" }} />}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={busy || disabled || code.length < 6} onClick={() => void confirm()} data-testid={`${testid}-confirm`} sx={primaryBtn}>{busy ? "Working…" : confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
