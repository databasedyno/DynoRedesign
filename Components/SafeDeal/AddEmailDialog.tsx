import React, { useState } from "react";
import { Alert, Box, Button, Dialog, DialogContent, IconButton, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_NOTE_BG, SD_NOTE_BORDER } from "./sdTheme";
import safedealApi, { sdError, sdSession } from "@/api/safedeal";
import CodeInput from "./CodeInput";

const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, py: 1.15, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

/**
 * Add a real email to the signed-in SafeDeal account (typically a Telegram user).
 * Ownership is proven with a one-time code. On success the session is re-issued with
 * the real email, pending email invitations connect, and email login is unlocked.
 */
export default function AddEmailDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (connected: number, email: string) => void }) {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const reset = () => { setStage("email"); setEmail(""); setCode(""); setError(null); setPreviewCode(null); setBusy(false); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const start = async () => {
    setError(null);
    if (!/.+@.+\..+/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      const r = await safedealApi.addEmailStart(email.trim());
      setPreviewCode(r.preview_code || null);
      setStage("code");
      setCode("");
    } catch (e) {
      setError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setError(null);
    if (value.length < 6) return setError("Enter the 6-digit code we emailed you.");
    setBusy(true);
    try {
      const r = await safedealApi.addEmailVerify(value);
      sdSession.set(r.token, r.user);
      const connected = Number(r.connected_deals || 0);
      onDone?.(connected, r.user.email);
      reset();
      onClose();
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: SD_NOTE_BG, border: `1px solid ${SD_NOTE_BORDER}` }}>
            <Icon icon="mdi:email-plus-outline" width={22} color={SD_GOLD_DARK} aria-hidden />
          </Box>
          <IconButton onClick={close} size="small" aria-label="Close" data-testid="sd-addemail-close"><Icon icon="mdi:close" width={20} /></IconButton>
        </Stack>

        <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.5, mb: 0.5 }} data-testid="sd-addemail-title">
          {stage === "code" ? "Check your inbox" : "Add an email"}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2.2 }}>
          {stage === "code"
            ? <>We sent a 6-digit code to <b>{email}</b>. Enter it to confirm this address.</>
            : "Add an email so people can invite you to deals, and so you can sign in by email as well as Telegram. We'll send a one-time code to confirm it — no password."}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="sd-addemail-error">{error}</Alert>}
        {previewCode && stage === "code" && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="sd-addemail-preview-code">
            Preview environment — outbound email is off. Your code: <b data-testid="sd-addemail-preview-code-value">{previewCode}</b>
          </Alert>
        )}

        {stage === "email" ? (
          <Stack spacing={1.5}>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void start()}
              fullWidth
              autoFocus
              inputProps={{ "data-testid": "sd-addemail-email", autoComplete: "email" }}
            />
            <Button variant="contained" size="large" disabled={busy} onClick={() => void start()} data-testid="sd-addemail-send" endIcon={<Icon icon="mdi:arrow-right" />} sx={primaryBtn}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.8}>
            <CodeInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} autoFocus disabled={busy} testId="sd-addemail-code" />
            <Button variant="contained" size="large" disabled={busy || code.length < 6} onClick={() => void verify()} data-testid="sd-addemail-verify" sx={primaryBtn}>
              {busy ? "Confirming…" : "Confirm email"}
            </Button>
            <Button size="small" onClick={() => { setStage("email"); setCode(""); setError(null); }} sx={{ textTransform: "none", alignSelf: "center" }} data-testid="sd-addemail-change">Use a different email</Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
