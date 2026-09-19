import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Container, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { sdError, sdSession } from "@/api/safedeal";
import { useSdHref, useSdSession } from "./sdRouting";
import { SafeDealLogo } from "./SafeDealShell";

export default function SignIn() {
  const router = useRouter();
  const href = useSdHref();
  const { token, ready } = useSdSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const nextParam = typeof router.query.next === "string" ? router.query.next : "";
  const hintEmail = typeof router.query.email === "string" ? router.query.email : "";
  const target = nextParam && nextParam.startsWith("/") ? href(nextParam.replace(/^\/safedeal(?=\/|$)/, "")) : href("/deals");

  useEffect(() => {
    if (hintEmail && !email) setEmail(hintEmail);
  }, [hintEmail, email]);
  useEffect(() => {
    if (ready && token) void router.replace(target);
  }, [ready, token, router, target]);

  const sendCode = async () => {
    setError(null);
    if (!/.+@.+\..+/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      const r = await safedealApi.sendCode(email.trim());
      setPreviewCode(r.preview_code || null);
      setStage("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (code.trim().length < 6) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      const r = await safedealApi.verifyCode(email.trim(), code.trim());
      sdSession.set(r.token, r.user);
      void router.replace(target);
    } catch (e) {
      setError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
        <SafeDealLogo size={26} />
      </Box>
      <Box sx={{ p: 3.5, borderRadius: 4, backgroundColor: "#fff", border: "1px solid #E5E7EB", boxShadow: "0 20px 50px rgba(15,23,42,0.06)" }} data-testid="sd-signin-card">
        <Typography component="h1" sx={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.6, mb: 0.6 }}>
          {stage === "email" ? "Sign in with your email" : "Check your inbox"}
        </Typography>
        <Typography sx={{ fontSize: 14, color: "#6B7280", mb: 2.5 }}>
          {stage === "email"
            ? "No password. We'll email you a one-time code — that's it. First time here? This also creates your SafeDeal wallet."
            : <>We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</>}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="sd-signin-error">{error}</Alert>}
        {previewCode && stage === "code" && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="sd-signin-preview-code">
            Preview environment — outbound email is off. Your code: <b>{previewCode}</b>
          </Alert>
        )}

        {stage === "email" ? (
          <Stack spacing={1.5}>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendCode()}
              fullWidth
              autoFocus
              inputProps={{ "data-testid": "sd-signin-email", autoComplete: "email" }}
            />
            <Button
              variant="contained"
              size="large"
              disabled={busy}
              onClick={() => void sendCode()}
              data-testid="sd-signin-send"
              endIcon={<Icon icon="mdi:arrow-right" />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, py: 1.2, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}
            >
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && void verify()}
              fullWidth
              inputRef={codeRef}
              inputProps={{ "data-testid": "sd-signin-code", inputMode: "numeric", style: { letterSpacing: 6, fontSize: 22, fontWeight: 700, textAlign: "center" } }}
            />
            <Button
              variant="contained"
              size="large"
              disabled={busy || code.length < 6}
              onClick={() => void verify()}
              data-testid="sd-signin-verify"
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, py: 1.2, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}
            >
              {busy ? "Checking…" : "Sign in"}
            </Button>
            <Stack direction="row" justifyContent="space-between">
              <Button size="small" onClick={() => { setStage("email"); setCode(""); }} sx={{ textTransform: "none" }} data-testid="sd-signin-change-email">Use a different email</Button>
              <Button size="small" disabled={busy} onClick={() => void sendCode()} sx={{ textTransform: "none" }} data-testid="sd-signin-resend">Resend code</Button>
            </Stack>
          </Stack>
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", mt: 2 }}>
        By signing in you agree to the SafeDeal terms. Payments, custody and payouts are provided by Dynopay.
      </Typography>
    </Container>
  );
}
