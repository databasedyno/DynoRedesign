import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogContent, IconButton, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_NOTE_BG, SD_NOTE_BORDER } from "./sdTheme";
import safedealApi, { sdError, sdSession, isPlaceholderSdEmail } from "@/api/safedeal";
import CodeInput from "./CodeInput";

const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, py: 1.15, minHeight: 44, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

type Mode = "add" | "change";
type Stage = "verify_current" | "email" | "code";

/**
 * Add OR change the email on the signed-in SafeDeal account.
 *  - Telegram-only user adding a FIRST email ("add"): prove the NEW address with a one-time code.
 *  - Changing an EXISTING real email ("change"): first prove control of the CURRENT mailbox with a
 *    step-up code (so a stolen session token alone can't swap the email), THEN confirm the NEW one.
 * On success the session is re-issued; a change also signs out every other device and holds
 * cashouts for 24h (enforced server-side).
 */
export default function AddEmailDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (connected: number, email: string) => void }) {
  const [mode, setMode] = useState<Mode>("add");
  const [currentEmail, setCurrentEmail] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");               // new-email confirmation code
  const [currentCode, setCurrentCode] = useState(""); // step-up code sent to the current mailbox
  const [stepUpSent, setStepUpSent] = useState(false);
  const [stepUpPreview, setStepUpPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const u = sdSession.user();
    const isChange = !!u && !isPlaceholderSdEmail(u.email);
    setMode(isChange ? "change" : "add");
    setCurrentEmail(u?.email || "");
    setStage(isChange ? "verify_current" : "email");
    setEmail(""); setCode(""); setCurrentCode("");
    setStepUpSent(false); setStepUpPreview(null);
    setError(null); setPreviewCode(null); setBusy(false);
  }, [open]);

  const close = () => { if (busy) return; onClose(); };

  const sendStepUp = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await safedealApi.stepUp("change_email");
      setStepUpPreview(r.preview_code || null);
      setStepUpSent(true);
      setCurrentCode("");
    } catch (e) {
      setError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  const continueFromCurrent = () => {
    setError(null);
    if (currentCode.length < 6) return setError("Enter the 6-digit code we emailed to your current address.");
    setStage("email");
  };

  const start = async () => {
    setError(null);
    if (!/.+@.+\..+/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      const r = await safedealApi.addEmailStart(email.trim(), mode === "change" ? currentCode : undefined);
      setPreviewCode(r.preview_code || null);
      setStage("code");
      setCode("");
    } catch (e) {
      setError(sdError(e));
      // The step-up code is single-use — if it was rejected/expired, send them back to re-confirm.
      if (mode === "change") { setStage("verify_current"); setStepUpSent(false); setCurrentCode(""); }
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
      onDone?.(Number(r.connected_deals || 0), r.user.email);
      onClose();
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  const title = stage === "code" ? "Check your inbox" : stage === "verify_current" ? "Confirm it's you" : mode === "change" ? "Enter your new email" : "Add an email";
  const subtitle =
    stage === "code" ? <>We sent a 6-digit code to <b>{email}</b>. Enter it to confirm this address.</>
    : stage === "verify_current" ? <>To change your email, first confirm you still control your current address. We&apos;ll email a 6-digit code to <b>{currentEmail}</b>.</>
    : mode === "change" ? "Enter the new email address for your account. We'll send a one-time code there to confirm it."
    : "Add an email so people can invite you to deals, and so you can sign in by email as well as Telegram. We'll send a one-time code to confirm it — no password.";

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: SD_NOTE_BG, border: `1px solid ${SD_NOTE_BORDER}` }}>
            <Icon icon={mode === "change" ? "mdi:email-sync-outline" : "mdi:email-plus-outline"} width={22} color={SD_GOLD_DARK} aria-hidden />
          </Box>
          <IconButton onClick={close} size="small" aria-label="Close" data-testid="sd-addemail-close"><Icon icon="mdi:close" width={20} /></IconButton>
        </Stack>

        <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.5, mb: 0.5 }} data-testid="sd-addemail-title">
          {title}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2.2 }}>{subtitle}</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="sd-addemail-error">{error}</Alert>}
        {previewCode && stage === "code" && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="sd-addemail-preview-code">
            Preview environment — outbound email is off. Your code: <b data-testid="sd-addemail-preview-code-value">{previewCode}</b>
          </Alert>
        )}
        {stepUpPreview && stage === "verify_current" && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="sd-addemail-stepup-preview">
            Preview environment — outbound email is off. Your code: <b data-testid="sd-addemail-stepup-preview-value">{stepUpPreview}</b>
          </Alert>
        )}

        {stage === "verify_current" ? (
          <Stack spacing={1.8}>
            {!stepUpSent ? (
              <Button variant="contained" size="large" disabled={busy} onClick={() => void sendStepUp()} data-testid="sd-addemail-stepup-send" endIcon={<Icon icon="mdi:arrow-right" />} sx={primaryBtn}>
                {busy ? "Sending…" : "Email me a code"}
              </Button>
            ) : (
              <>
                <CodeInput value={currentCode} onChange={setCurrentCode} onComplete={continueFromCurrent} autoFocus disabled={busy} testId="sd-addemail-stepup-code" />
                <Button variant="contained" size="large" disabled={busy || currentCode.length < 6} onClick={continueFromCurrent} data-testid="sd-addemail-stepup-continue" endIcon={<Icon icon="mdi:arrow-right" />} sx={primaryBtn}>
                  Continue
                </Button>
                <Button size="small" onClick={() => void sendStepUp()} disabled={busy} sx={{ textTransform: "none", alignSelf: "center" }} data-testid="sd-addemail-stepup-resend">Resend code</Button>
              </>
            )}
          </Stack>
        ) : stage === "email" ? (
          <Stack spacing={1.5}>
            <TextField
              label="New email address"
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
              {busy ? "Confirming…" : mode === "change" ? "Confirm new email" : "Confirm email"}
            </Button>
            <Button size="small" onClick={() => { setError(null); if (mode === "change") { setStage("verify_current"); setStepUpSent(false); setCurrentCode(""); } else { setStage("email"); } setCode(""); }} sx={{ textTransform: "none", alignSelf: "center" }} data-testid="sd-addemail-change">Use a different email</Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
