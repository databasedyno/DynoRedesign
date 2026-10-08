import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdConfig, SdCreateDealBody, sdError } from "@/api/safedeal";
import { useSdSession, useSdHref } from "./sdRouting";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_INK_RAISED, goldAlpha } from "./sdTheme";

const DRAFT_KEY = "sd_deal_draft";

const darkField = {
  "& .MuiInputBase-root": { color: "#fff", backgroundColor: SD_INK_RAISED, borderRadius: 3 },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.28)" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: `${SD_GOLD} !important`, boxShadow: `0 0 0 3px ${goldAlpha(0.22)}` },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.62)" },
  "& .MuiInputLabel-root.Mui-focused": { color: SD_GOLD },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.5)", mx: 0.5 },
  "& .MuiInputAdornment-root p": { color: "rgba(255,255,255,0.6)" },
} as const;

function Segment<T extends string>({ value, onChange, options, testid }: { value: T; onChange: (v: T) => void; options: Array<{ v: T; label: string; icon: string }>; testid: string }) {
  return (
    <Box role="radiogroup" data-testid={testid} sx={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, p: 0.4, borderRadius: 99, backgroundColor: SD_INK_RAISED, border: "1px solid rgba(255,255,255,0.10)" }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Box
            key={o.v}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`${testid}-${o.v}`}
            onClick={() => onChange(o.v)}
            sx={{ border: 0, cursor: "pointer", borderRadius: 99, py: 0.9, px: 1, minHeight: 36, "@media (pointer: coarse)": { minHeight: 44 }, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.7, fontWeight: 800, fontSize: 13, fontFamily: "inherit", color: on ? SD_INK : "rgba(255,255,255,0.72)", backgroundColor: on ? SD_GOLD : "transparent", transition: "background-color .18s, color .18s", "&:hover": { color: on ? SD_INK : "#fff" } }}
          >
            <Icon icon={o.icon} width={16} aria-hidden />
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * The landing hero IS the create-deal form. Signed in → creates the deal now.
 * Guest → keeps the draft (sessionStorage) and continues via sign-in → /deals/new?resume=1.
 */
export default function HeroDealForm({ cfg }: { cfg: SdConfig | null }) {
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
  const fee = cfg?.fee_percent ?? 5;
  const amountNum = Number(amount);
  const byLink = inviteBy === "link";
  const emailValid = /.+@.+\..+/.test(email.trim());
  const canStart = title.trim().length >= 2 && amountNum > 0 && (byLink || emailValid);
  const feePreview = amountNum > 0 ? Math.max((amountNum * fee) / 100, cfg?.fee_min_usd ?? 10) : null;

  const start = async () => {
    setError(null);
    if (!canStart) return setError(byLink ? "Add a title and amount to continue." : "Add a title, amount and the other party's email.");
    const draft = { title: title.trim(), amount: amountNum, currency: "USD", role, email: byLink ? "" : email.trim(), inviteByLink: byLink, feePayer: "buyer", days: cfg?.auto_release_default ?? 3, dealType: null, due: "", terms: "" };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    if (!token) {
      void router.push(href(`/signin?next=${encodeURIComponent(href("/deals/new?resume=1"))}`));
      return;
    }
    setBusy(true);
    try {
      const body: SdCreateDealBody = { title: draft.title, amount: draft.amount, price_currency: "USD", my_role: role, fee_payer: "buyer", auto_release_days: draft.days, ...(byLink ? { invite_by_link: true } : { counterparty_email: draft.email }) };
      const deal = await safedealApi.createDeal(body);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      void router.push(href(`/deal/${deal.deal_token}?created=1`));
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  return (
    <Box
      data-testid="sd-landing-start"
      sx={{ p: { xs: 2.2, sm: 3 }, borderRadius: 5, backgroundColor: "rgba(20,20,23,0.72)", backdropFilter: "blur(18px)", border: `1px solid rgba(255,255,255,0.10)`, boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px ${goldAlpha(0.12)}`, color: "#fff", position: "relative" }}
    >
      <Box aria-hidden sx={{ position: "absolute", top: -1, left: 28, right: 28, height: "1px", pointerEvents: "none", background: `linear-gradient(90deg, transparent, ${goldAlpha(0.8)}, transparent)` }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography component="h2" sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 900, letterSpacing: -0.4 }}>Start a deal</Typography>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>under a minute · no account needed</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.6, borderRadius: 2.5 }} data-testid="sd-landing-start-error">{error}</Alert>}

      <Stack spacing={1.6}>
        <Segment value={role} onChange={setRole} testid="sd-ls-role" options={[{ v: "seller", label: "I'm selling", icon: "mdi:storefront-outline" }, { v: "buyer", label: "I'm buying", icon: "mdi:cart-outline" }]} />
        <TextField label="What's the deal?" placeholder="e.g. Logo & brand kit for Acme" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth sx={darkField} inputProps={{ "data-testid": "sd-ls-title", maxLength: 255 }} />
        <TextField
          label="Price"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          fullWidth
          sx={darkField}
          helperText={feePreview ? `≈ $${feePreview.toFixed(2)} escrow fee (${fee}%) · deals from $${minDeal}` : `Deals from $${minDeal} · priced in USD, held as USDT`}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          inputProps={{ "data-testid": "sd-ls-amount", inputMode: "decimal" }}
        />
        <Segment value={inviteBy} onChange={setInviteBy} testid="sd-ls-invite-by" options={[{ v: "email", label: "Invite by email", icon: "mdi:email-outline" }, { v: "link", label: "Share a link", icon: "mdi:link-variant" }]} />
        {!byLink && (
          <TextField label={role === "seller" ? "Buyer's email" : "Seller's email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void start()} fullWidth sx={darkField} inputProps={{ "data-testid": "sd-ls-email", autoComplete: "email" }} />
        )}
        <Button variant="contained" size="large" disabled={busy} onClick={() => void start()} data-testid="sd-ls-submit" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, py: 1.35, fontSize: 15.5, color: SD_INK, backgroundColor: SD_GOLD, boxShadow: `0 12px 28px ${goldAlpha(0.35)}`, transition: "transform .18s, background-color .18s, box-shadow .18s", "&:hover": { backgroundColor: SD_GOLD_DARK, transform: "translateY(-1px)" } }}>
          {busy ? "Creating…" : byLink ? "Create invite link" : "Continue"}
        </Button>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{token ? "Review the fee breakdown next." : "You'll sign in to send it — nothing is retyped."}</Typography>
          <Link href={href("/signin?invited=1")} data-testid="sd-invited-cta" style={{ textDecoration: "none" }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: SD_GOLD, "&:hover": { textDecoration: "underline" } }}>I was invited to a deal →</Typography>
          </Link>
        </Stack>
      </Stack>
    </Box>
  );
}
