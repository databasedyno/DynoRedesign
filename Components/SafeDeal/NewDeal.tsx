import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Collapse, Container, Grid, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdConfig, SdDealType, SdFeePreview, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useRequireSdSession, useSdHref } from "./sdRouting";
import { TABULAR } from "./sdFormat";
import { SD_INK_MUTED } from "./SafeDealShell";
import SdChoice from "./SdChoice";
import { DEAL_TYPES, TERMS_TEMPLATES } from "./sdDealTypes";
import { NewDealDraft, NewDealReview, QuoteBody, stepDot } from "./NewDealReview";

type Role = "buyer" | "seller";
type FeePayer = "buyer" | "seller" | "split";
const STEPS = ["The basics", "Terms", "Review & send"];
const primaryBtn = { textTransform: "none", fontWeight: 900, borderRadius: 99, py: 1.2, px: 3, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } } as const;

export default function NewDeal() {
  const { user, ready } = useRequireSdSession();
  const router = useRouter();
  const href = useSdHref();
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [role, setRole] = useState<Role>("seller");
  const [email, setEmail] = useState("");
  const [feePayer, setFeePayer] = useState<FeePayer>("buyer");
  const [days, setDays] = useState<number>(3);
  const [dealType, setDealType] = useState<SdDealType | null>(null);
  const [due, setDue] = useState("");
  const [terms, setTerms] = useState("");
  const [preview, setPreview] = useState<SdFeePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    safedealApi.config().then((c) => { setCfg(c); setDays(c.auto_release_default); }).catch(() => undefined);
  }, []);

  const minDeal = cfg?.min_deal_usd ?? 30;
  const amountNum = Number(amount);
  const fiat = currency !== "USD";
  const usdEquivalent = preview?.price ? preview.price.usd : amountNum;
  const belowMin = amountNum > 0 && (fiat ? !!preview && usdEquivalent < minDeal : amountNum < minDeal);
  const emailValid = /.+@.+\..+/.test(email.trim());
  const selfInvite = !!user && email.trim().toLowerCase() === user.email.toLowerCase();

  useEffect(() => {
    if (!(amountNum > 0) || (!fiat && amountNum < minDeal)) return setPreview(null);
    const t = setTimeout(() => {
      safedealApi.feePreview({ amount: amountNum, fee_payer: feePayer, price_currency: currency }).then((p) => setPreview(p.belowMinimum ? null : p)).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [amountNum, feePayer, minDeal, currency, fiat]);

  const step0Ok = title.trim().length >= 2 && amountNum > 0 && !belowMin && emailValid && !selfInvite;
  const canSubmit = step0Ok && !!preview && !busy;
  const draft = useMemo<NewDealDraft>(() => ({ title: title.trim(), amount: amountNum, currency, role, email: email.trim(), feePayer, days, dealType, due, terms }), [title, amountNum, currency, role, email, feePayer, days, dealType, due, terms]);

  const applyTemplate = () => {
    const tpl = TERMS_TEMPLATES[dealType || "other"];
    if (terms.trim() && !window.confirm("Replace your current terms with the template?")) return;
    setTerms(tpl);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const deal = await safedealApi.createDeal({
        title: title.trim(), amount: amountNum, price_currency: currency, my_role: role, counterparty_email: email.trim(), fee_payer: feePayer, auto_release_days: days,
        ...(dealType ? { deal_type: dealType } : {}), ...(due ? { delivery_due_at: due } : {}), ...(terms.trim() ? { terms: terms.trim() } : {}),
      });
      void router.push(href(`/deal/${deal.deal_token}?created=1`));
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  if (!ready) return null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-new-deal-page" data-step={step}>
      <Typography component="h1" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, letterSpacing: -0.8, mb: 0.5 }}>Create a deal</Typography>
      <Typography sx={{ fontSize: 14, color: "#6B7280", mb: 2.5 }}>The other party gets an email invite. Nothing is charged until the buyer funds the escrow.</Typography>

      {/* Stepper */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }} role="list" aria-label="Steps" data-testid="sd-new-steps">
        {STEPS.map((s, i) => (
          <Stack key={s} direction="row" spacing={0.8} alignItems="center" role="listitem" aria-current={i === step ? "step" : undefined} data-testid={`sd-new-step-${i}`} data-active={i === step ? "true" : "false"} sx={{ cursor: i < step ? "pointer" : "default" }} onClick={() => i < step && setStep(i)}>
            <Box sx={stepDot(i === step, i < step)}>{i < step ? <Icon icon="mdi:check" width={14} /> : i + 1}</Box>
            <Typography sx={{ fontSize: 13, fontWeight: i === step ? 900 : 600, color: i === step ? "#111827" : "#6B7280", display: { xs: i === step ? "block" : "none", sm: "block" } }}>{s}</Typography>
            {i < STEPS.length - 1 && <Box sx={{ width: { xs: 16, sm: 32 }, height: 2, backgroundColor: i < step ? "#047857" : "#E5E7EB", borderRadius: 1 }} aria-hidden />}
          </Stack>
        ))}
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Stack spacing={2.5} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" }}>
            {error && <Alert severity="error" data-testid="sd-new-deal-error">{error}</Alert>}

            {step === 0 && (
              <>
                <TextField label="What's the deal?" placeholder="e.g. Logo & brand kit for Acme" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth autoFocus inputProps={{ "data-testid": "sd-new-title", maxLength: 255 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.8 }}>What kind of deal is it? <span style={{ color: "#9CA3AF", fontWeight: 600 }}>(optional — tailors the terms template)</span></Typography>
                  <SdChoice value={dealType} onChange={setDealType} testid="sd-new-type" options={DEAL_TYPES} columns={4} />
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    fullWidth
                    error={belowMin}
                    helperText={belowMin ? `Minimum deal amount is $${minDeal}${fiat ? ` (≈ ${money(usdEquivalent)} today)` : ""}` : fiat && preview?.price ? `≈ ${money(preview.price.usd)} today · USD locked when the buyer funds` : `Minimum $${minDeal}${fiat ? " equivalent" : ""}`}
                    FormHelperTextProps={{ "data-testid": "sd-new-amount-helper" } as any}
                    InputProps={{ startAdornment: <InputAdornment position="start">{currency === "USD" ? "$" : currency}</InputAdornment> }}
                    inputProps={{ "data-testid": "sd-new-amount", inputMode: "decimal" }}
                  />
                  <TextField select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} sx={{ minWidth: 118 }} inputProps={{ "data-testid": "sd-new-currency" }} SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>
                    {(cfg?.price_currencies || ["USD"]).map((c) => <MenuItem key={c} value={c} data-testid={`sd-new-currency-${c}`}>{c}</MenuItem>)}
                  </TextField>
                </Stack>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.8 }}>I am the…</Typography>
                  <SdChoice value={role} onChange={setRole} testid="sd-new-role" options={[
                    { v: "seller", label: "Seller", sub: "I deliver and get paid", icon: "mdi:storefront-outline" },
                    { v: "buyer", label: "Buyer", sub: "I pay and receive", icon: "mdi:cart-outline" },
                  ]} />
                </Box>
                <TextField label={role === "seller" ? "Buyer's email" : "Seller's email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth error={selfInvite} helperText={selfInvite ? "That's you — enter the other party's email." : "They'll receive an invite link. No account needed."} inputProps={{ "data-testid": "sd-new-email" }} />
              </>
            )}

            {step === 1 && (
              <>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.8 }}>Who covers the {cfg?.fee_percent ?? 5}% escrow fee?</Typography>
                  <SdChoice value={feePayer} onChange={setFeePayer} testid="sd-new-fee" options={[
                    { v: "buyer", label: "Buyer", sub: "Added on top of the price" },
                    { v: "seller", label: "Seller", sub: "Taken from the payout" },
                    { v: "split", label: "Split 50/50", sub: "Half each" },
                  ]} />
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField select label="Inspection period" value={days} onChange={(e) => setDays(Number(e.target.value))} fullWidth helperText="Buyer's time to check the delivery before funds auto-release." inputProps={{ "data-testid": "sd-new-days" }}>
                    {(cfg?.auto_release_presets ?? [3, 5, 7, 14]).map((d) => <MenuItem key={d} value={d} data-testid={`sd-new-days-${d}`}>{d} days after delivery</MenuItem>)}
                  </TextField>
                  <TextField type="date" label="Delivery due (optional)" value={due} onChange={(e) => setDue(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} helperText="Both sides get a nudge if it passes." inputProps={{ "data-testid": "sd-new-due", min: today }} />
                </Stack>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Terms <span style={{ color: "#9CA3AF", fontWeight: 600 }}>(optional, strongly recommended)</span></Typography>
                    <Button size="small" onClick={applyTemplate} data-testid="sd-new-terms-template" startIcon={<Icon icon="mdi:text-box-plus-outline" />} sx={{ textTransform: "none", fontWeight: 800 }}>Use a template</Button>
                  </Stack>
                  <TextField placeholder="What exactly is being delivered, by when, and what counts as done…" value={terms} onChange={(e) => setTerms(e.target.value)} fullWidth multiline minRows={5} inputProps={{ "data-testid": "sd-new-terms", maxLength: 10000 }} helperText="Clear terms are what a dispute gets judged against." />
                </Box>
              </>
            )}

            {step === 2 && <NewDealReview d={draft} preview={preview} minDeal={minDeal} />}

            <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ pt: 0.5 }}>
              <Button disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)} data-testid="sd-new-back" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, visibility: step === 0 ? "hidden" : "visible" }} startIcon={<Icon icon="mdi:arrow-left" />}>Back</Button>
              {step < 2 ? (
                <Button variant="contained" disabled={step === 0 && !step0Ok} onClick={() => setStep((s) => s + 1)} data-testid="sd-new-continue" sx={primaryBtn} endIcon={<Icon icon="mdi:arrow-right" />}>Continue</Button>
              ) : (
                <Button variant="contained" size="large" disabled={!canSubmit} onClick={() => void submit()} data-testid="sd-new-submit" endIcon={<Icon icon="mdi:send" />} sx={primaryBtn}>{busy ? "Creating…" : "Send invite"}</Button>
              )}
            </Stack>
          </Stack>
        </Grid>

        <Grid item xs={12} md={5} sx={{ display: { xs: "none", md: "block" } }}>
          <Box sx={{ p: 2.5, borderRadius: 3, backgroundColor: "#0B1020", color: "#fff", position: "sticky", top: 84 }} data-testid="sd-new-quote">
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: SD_INK_MUTED, mb: 1.2 }}>Live quote</Typography>
            {!preview ? <Typography sx={{ fontSize: 14, color: SD_INK_MUTED }}>Enter an amount of ${minDeal} or more to see the itemised quote.</Typography> : <QuoteBody preview={preview} />}
          </Box>
        </Grid>
      </Grid>

      {/* Mobile: collapsed sticky quote bar */}
      <Box sx={{ display: { xs: "block", md: "none" }, position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: "#0B1020", color: "#fff", borderTop: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 -10px 30px rgba(0,0,0,0.25)" }} data-testid="sd-new-quote-bar">
        <Box role="button" tabIndex={0} aria-expanded={quoteOpen} aria-controls="sd-quote-details" onClick={() => setQuoteOpen((o) => !o)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setQuoteOpen((o) => !o)} data-testid="sd-new-quote-bar-toggle" sx={{ px: 2, py: 1.3, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          {preview ? (
            <Typography sx={{ fontSize: 14, fontWeight: 800, ...TABULAR }}>Buyer pays <span style={{ color: "#A5B4FC" }}>{money(preview.buyerPays, "USD")}</span> · Seller gets <span style={{ color: "#6EE7B7" }}>{money(preview.sellerReceives, "USD")}</span></Typography>
          ) : (
            <Typography sx={{ fontSize: 13.5, color: SD_INK_MUTED }}>Live quote appears once the amount is ${minDeal} or more</Typography>
          )}
          <Icon icon={quoteOpen ? "mdi:chevron-down" : "mdi:chevron-up"} width={22} aria-hidden />
        </Box>
        <Collapse in={quoteOpen && !!preview} id="sd-quote-details"><Box sx={{ px: 2, pb: 2 }}>{preview && <QuoteBody preview={preview} />}</Box></Collapse>
      </Box>
      <Box sx={{ display: { xs: "block", md: "none" }, height: 64 }} aria-hidden />
    </Container>
  );
}
