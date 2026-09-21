import React, { useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdConfig, SdCreateDealBody, sdError } from "@/api/safedeal";
import { useSdSession, useSdHref } from "./sdRouting";
import SdChoice from "./SdChoice";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_BORDER } from "./sdTheme";

const DRAFT_KEY = "sd_deal_draft";
const primaryBtn = { textTransform: "none", fontWeight: 900, borderRadius: 99, py: 1.25, px: 3, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

/**
 * Inline "quick start" — begin a deal straight from the landing page.
 * Signed in: creates the deal now. Guest: keeps the entries and drops the person
 * into sign-in, then the full New Deal page finishes it (resume=1) — nothing retyped.
 * The advanced options (terms, due date, fee payer, currency) live on /deals/new.
 */
export default function LandingStartDeal({ cfg }: { cfg: SdConfig | null }) {
  const { token } = useSdSession();
  const router = useRouter();
  const href = useSdHref();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [inviteBy, setInviteBy] = useState<"email" | "link">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDeal = cfg?.min_deal_usd ?? 30;
  const amountNum = Number(amount);
  const byLink = inviteBy === "link";
  const emailValid = /.+@.+\..+/.test(email.trim());
  const canStart = title.trim().length >= 2 && amountNum > 0 && (byLink || emailValid);

  const buildDraft = () => ({
    title: title.trim(), amount: amountNum, currency: "USD", role, email: byLink ? "" : email.trim(),
    inviteByLink: byLink, feePayer: "buyer", days: cfg?.auto_release_default ?? 3, dealType: null, due: "", terms: "",
  });

  const start = async () => {
    setError(null);
    if (!canStart) return setError(byLink ? "Add a title and amount to continue." : "Add a title, amount and the other party's email.");
    const draft = buildDraft();
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    if (!token) {
      void router.push(href(`/signin?next=${encodeURIComponent(href("/deals/new?resume=1"))}`));
      return;
    }
    setBusy(true);
    try {
      const body: SdCreateDealBody = {
        title: draft.title, amount: draft.amount, price_currency: "USD", my_role: role, fee_payer: "buyer", auto_release_days: draft.days,
        ...(byLink ? { invite_by_link: true } : { counterparty_email: draft.email }),
      };
      const deal = await safedealApi.createDeal(body);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      void router.push(href(`/deal/${deal.deal_token}?created=1`));
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2.2, sm: 3 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, boxShadow: "0 24px 60px rgba(15,23,42,0.10)" }} data-testid="sd-landing-start">
      <Typography component="h2" sx={{ fontSize: { xs: 20, md: 22 }, fontWeight: 900, letterSpacing: -0.4 }}>Start a deal in under a minute</Typography>
      <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2 }}>Set it up here — we&apos;ll walk you through funding and delivery next. Nothing is charged until the buyer funds.</Typography>

      {error && <Alert severity="error" sx={{ mb: 1.8 }} data-testid="sd-landing-start-error">{error}</Alert>}

      <Stack spacing={1.8}>
        <TextField label="What's the deal?" placeholder="e.g. Logo & brand kit for Acme" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth inputProps={{ "data-testid": "sd-ls-title", maxLength: 255 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.8}>
          <TextField
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            fullWidth
            helperText={`Deals from $${minDeal} · priced in USD`}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            inputProps={{ "data-testid": "sd-ls-amount", inputMode: "decimal" }}
          />
          <Box sx={{ minWidth: { sm: 220 } }}>
            <SdChoice value={role} onChange={setRole} testid="sd-ls-role" columns={2} options={[
              { v: "seller", label: "I'm selling", sub: "I get paid", icon: "mdi:storefront-outline" },
              { v: "buyer", label: "I'm buying", sub: "I pay", icon: "mdi:cart-outline" },
            ]} />
          </Box>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, mb: 0.7, color: "#374151" }}>How do you want to invite them?</Typography>
          <SdChoice value={inviteBy} onChange={setInviteBy} testid="sd-ls-invite-by" columns={2} options={[
            { v: "email", label: "By email", sub: "We email an invite", icon: "mdi:email-outline" },
            { v: "link", label: "By link", sub: "Share it anywhere", icon: "mdi:link-variant" },
          ]} />
        </Box>
        {!byLink && (
          <TextField label={role === "seller" ? "Buyer's email" : "Seller's email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void start()} fullWidth helperText="They don't need an account — they sign in with a code." inputProps={{ "data-testid": "sd-ls-email", autoComplete: "email" }} />
        )}
        <Button variant="contained" size="large" disabled={busy} onClick={() => void start()} data-testid="sd-ls-submit" endIcon={<Icon icon="mdi:arrow-right" />} sx={primaryBtn}>
          {busy ? "Creating…" : byLink ? "Create invite link" : "Continue"}
        </Button>
        <Typography sx={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
          {token ? "You'll review the fee breakdown on the next screen." : "You'll sign in to send it — your details are kept, nothing is retyped."}
        </Typography>
      </Stack>
    </Box>
  );
}
