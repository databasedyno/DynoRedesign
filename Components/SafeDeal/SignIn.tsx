import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Container, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdDealPreview, sdError, sdSession } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useSdHref, useSdSession } from "./sdRouting";
import { SafeDealLogo } from "./SafeDealShell";
import CodeInput from "./CodeInput";
import { TABULAR } from "./sdFormat";

const RESEND_COOLDOWN_S = 30;
const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, py: 1.2, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } } as const;

/** Compact "what you're signing in for" card when the link carries a deal. */
function InviteCard({ p }: { p: SdDealPreview }) {
  const invitedRole = p.creator_role === "buyer" ? "seller" : "buyer";
  const inviter = p.creator_role === "buyer" ? p.buyer_email_masked : p.seller_email_masked;
  return (
    <Box sx={{ p: 1.8, mb: 2.5, borderRadius: 3, backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE" }} data-testid="sd-signin-invite-card">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
        <Icon icon="mdi:email-open-outline" width={18} color={BRAND_ACCENT} aria-hidden />
        <Typography sx={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: BRAND_ACCENT }}>You&apos;re invited as the {invitedRole}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="sd-signin-invite-title">{p.title}</Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 900, flexShrink: 0, ...TABULAR }} data-testid="sd-signin-invite-amount">{money(p.amount, p.currency)}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: "#4B5563", mt: 0.3 }}>
        Invited by <b>{inviter}</b> · {invitedRole === "buyer" ? `you'd pay ${money(p.buyer_pays, p.currency)}` : `you'd receive ${money(p.seller_receives, p.currency)}`}
      </Typography>
    </Box>
  );
}

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
  const [invite, setInvite] = useState<SdDealPreview | null>(null);
  const [locked, setLocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const nextParam = typeof router.query.next === "string" ? router.query.next : "";
  const hintEmail = typeof router.query.email === "string" ? router.query.email : "";
  const invitedFlag = router.query.invited === "1";
  const cleanNext = nextParam.replace(/^\/safedeal(?=\/|$)/, "");
  const target = nextParam && nextParam.startsWith("/") ? href(cleanNext) : href("/deals");
  const dealToken = /^\/deal\/([A-Za-z0-9_-]+)/.exec(cleanNext)?.[1] || null;

  useEffect(() => {
    if (hintEmail && !email) setEmail(hintEmail);
  }, [hintEmail, email]);
  useEffect(() => {
    if (!dealToken) return;
    safedealApi.previewDeal(dealToken).then((p) => {
      setInvite(p);
      if (p.counterparty_email_hint) { setEmail(p.counterparty_email_hint); setLocked(true); }
    }).catch(() => undefined);
  }, [dealToken]);
  useEffect(() => {
    if (ready && token) void router.replace(target);
  }, [ready, token, router, target]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  useEffect(() => {
    if (!sentAt) return;
    const id = setTimeout(() => setShowHelp(true), 60000);
    return () => clearTimeout(id);
  }, [sentAt]);

  const sendCode = async () => {
    setError(null);
    if (!/.+@.+\..+/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      const r = await safedealApi.sendCode(email.trim());
      setPreviewCode(r.preview_code || null);
      setStage("code");
      setCode("");
      setCooldown(RESEND_COOLDOWN_S);
      setSentAt(Date.now());
      setShowHelp(false);
    } catch (e) {
      setError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setError(null);
    if (value.length < 6) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      const r = await safedealApi.verifyCode(email.trim(), value);
      sdSession.set(r.token, r.user);
      void router.replace(target);
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  const heading = stage === "code" ? "Check your inbox" : invite ? "Sign in to respond" : invitedFlag ? "Open your invite" : "Sign in with your email";

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 5, md: 9 } }}>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
        <SafeDealLogo size={26} />
      </Box>
      <Box sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 4, backgroundColor: "#fff", border: "1px solid #E5E7EB", boxShadow: "0 20px 50px rgba(15,23,42,0.06)" }} data-testid="sd-signin-card">
        {invite && stage === "email" && <InviteCard p={invite} />}
        <Typography component="h1" sx={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.6, mb: 0.6 }}>{heading}</Typography>
        <Typography sx={{ fontSize: 14, color: "#6B7280", mb: 2.5 }} data-testid="sd-signin-sub">
          {stage === "code" ? (
            <>We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</>
          ) : invite ? (
            <>Use the email the invite was sent to. We&apos;ll send a one-time code — no password.</>
          ) : invitedFlag ? (
            <>The quickest way in is the link in your invite email. Or enter the email address the invite was sent to and we&apos;ll send you a code.</>
          ) : (
            <>No password. We&apos;ll email you a one-time code — that&apos;s it.</>
          )}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="sd-signin-error">{error}</Alert>}
        {previewCode && stage === "code" && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="sd-signin-preview-code">
            Preview environment — outbound email is off. Your code: <b data-testid="sd-signin-preview-code-value">{previewCode}</b>
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
              autoFocus={!locked}
              InputProps={{ readOnly: locked, endAdornment: locked ? <Icon icon="mdi:lock-outline" width={18} color="#9CA3AF" aria-label="Locked to the invited address" /> : undefined }}
              inputProps={{ "data-testid": "sd-signin-email", autoComplete: "email", "data-locked": locked ? "1" : "0" }}
              helperText={locked ? "This invite is addressed to this inbox." : undefined}
            />
            {locked && (
              <Button size="small" onClick={() => setLocked(false)} sx={{ textTransform: "none", alignSelf: "flex-start", mt: -1 }} data-testid="sd-signin-unlock">
                This isn&apos;t my email
              </Button>
            )}
            <Button variant="contained" size="large" disabled={busy} onClick={() => void sendCode()} data-testid="sd-signin-send" endIcon={<Icon icon="mdi:arrow-right" />} sx={primaryBtn}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
            <Typography sx={{ fontSize: 12.5, color: "#6B7280", textAlign: "center" }} data-testid="sd-signin-reassurance">
              No bank details, no password. Your SafeDeal wallet is only used for the money in your deals.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.8}>
            <CodeInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} autoFocus disabled={busy} />
            <Button variant="contained" size="large" disabled={busy || code.length < 6} onClick={() => void verify()} data-testid="sd-signin-verify" sx={primaryBtn}>
              {busy ? "Checking…" : "Sign in"}
            </Button>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button size="small" onClick={() => { setStage("email"); setCode(""); setError(null); }} sx={{ textTransform: "none" }} data-testid="sd-signin-change-email">Use a different email</Button>
              <Button size="small" disabled={busy || cooldown > 0} onClick={() => void sendCode()} sx={{ textTransform: "none", ...TABULAR }} data-testid="sd-signin-resend" data-cooldown={cooldown}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </Stack>
            {showHelp && (
              <Alert severity="info" icon={<Icon icon="mdi:email-search-outline" />} data-testid="sd-signin-help">
                Still nothing? Check your spam folder, make sure <b>{email}</b> is spelled right, or use a different email.
              </Alert>
            )}
          </Stack>
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: "#6B7280", textAlign: "center", mt: 2 }}>
        By signing in you agree to the SafeDeal <a href={href("/terms")} style={{ color: "inherit", fontWeight: 700 }} data-testid="sd-signin-terms-link">terms</a>. Payments, custody and payouts are provided by Dynopay.
      </Typography>
    </Container>
  );
}
