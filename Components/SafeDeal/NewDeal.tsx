import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Alert, Box, Button, Collapse, Container, Divider, Grid, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_GOLD, SD_GOLD_DARK, SD_INK } from "./sdTheme";
import safedealApi, { SdConfig, SdDealType, SdFeePreview, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useSdSession, useSdHref } from "./sdRouting";
import { TABULAR } from "./sdFormat";
import { SD_INK_MUTED } from "./SafeDealShell";
import SdChoice from "./SdChoice";
import { DEAL_TYPES, TERMS_TEMPLATES } from "./sdDealTypes";
import { NewDealDraft, NewDealReview, QuoteBody, stepDot } from "./NewDealReview";

type Role = "buyer" | "seller";
type FeePayer = "buyer" | "seller" | "split";
const STEPS = ["The basics", "Terms (optional)"];
const primaryBtn = { textTransform: "none", fontWeight: 900, borderRadius: 99, py: 1.2, px: 3, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;
const DRAFT_KEY = "sd_deal_draft";

export default function NewDeal() {
  const { user, token, ready } = useSdSession();
  const router = useRouter();
  const href = useSdHref();
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [role, setRole] = useState<Role>("seller");
  const [email, setEmail] = useState("");
  const [inviteBy, setInviteBy] = useState<"email" | "link">("link");
  const [feePayer, setFeePayer] = useState<FeePayer>("buyer");
  const [days, setDays] = useState<number>(3);
  const [dealType, setDealType] = useState<SdDealType | null>(null);
  const [due, setDue] = useState("");
  const [terms, setTerms] = useState("");
  const [preview, setPreview] = useState<SdFeePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    safedealApi.config().then((c) => { setCfg(c); setDays(c.auto_release_default); }).catch(() => undefined);
  }, []);

  const minDeal = cfg?.min_deal_usd ?? 30;
  const maxDealUsd = cfg?.max_deal_usd ?? null;
  const maxDealEur = cfg?.max_deal_eur ?? 2999;
  // SD-05: same-currency range copy ("$30 – $3,416 (≈ €2,999)") instead of the
  // confusing mixed "$30 and €2,999".
  const rangeCopy = maxDealUsd
    ? `$${minDeal} – $${Math.round(maxDealUsd).toLocaleString()} (≈ €${maxDealEur.toLocaleString()})`
    : `$${minDeal} – €${maxDealEur.toLocaleString()} equivalent`;
  const amountNum = Number(amount);
  const fiat = currency !== "USD";
  const usdEquivalent = preview?.price ? preview.price.usd : amountNum;
  const belowMin = amountNum > 0 && (fiat ? !!preview && usdEquivalent < minDeal : amountNum < minDeal);
  const aboveMax = amountNum > 0 && (preview?.aboveMaximum === true || (!fiat && maxDealUsd != null && amountNum > maxDealUsd));
  const emailValid = /.+@.+\..+/.test(email.trim());
  const byLink = inviteBy === "link";
  const selfInvite = !byLink && !!user && email.trim().toLowerCase() === user.email.toLowerCase();
  const contactOk = byLink || (emailValid && !selfInvite);

  useEffect(() => {
    if (!(amountNum > 0) || (!fiat && amountNum < minDeal)) return setPreview(null);
    const t = setTimeout(() => {
      safedealApi.feePreview({ amount: amountNum, fee_payer: feePayer, price_currency: currency, my_role: role }).then((p) => setPreview(p.belowMinimum ? null : p)).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [amountNum, feePayer, minDeal, currency, fiat, role]);

  const step0Ok = title.trim().length >= 2 && amountNum > 0 && !belowMin && !aboveMax && contactOk;
  const canSubmit = step0Ok && !!preview && !busy;
  const draft = useMemo<NewDealDraft>(() => ({ title: title.trim(), amount: amountNum, currency, role, email: byLink ? "" : email.trim(), inviteByLink: byLink, feePayer, days, dealType, due, terms }), [title, amountNum, currency, role, email, byLink, feePayer, days, dealType, due, terms]);

  const applyTemplate = () => {
    const tpl = TERMS_TEMPLATES[dealType || "other"];
    if (terms.trim() && !window.confirm("Replace your current terms with the template?")) return;
    setTerms(tpl);
  };

  const doCreate = async (d: NewDealDraft) => {
    setError(null);
    setBusy(true);
    try {
      const deal = await safedealApi.createDeal({
        title: d.title, amount: d.amount, price_currency: d.currency, my_role: d.role, fee_payer: d.feePayer, auto_release_days: d.days,
        ...(d.inviteByLink ? { invite_by_link: true } : { counterparty_email: d.email }),
        ...(d.dealType ? { deal_type: d.dealType as SdDealType } : {}), ...(d.due ? { delivery_due_at: d.due } : {}), ...(d.terms.trim() ? { terms: d.terms.trim() } : {}),
      });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      void router.push(href(`/deal/${deal.deal_token}?created=1`));
    } catch (e) {
      setError(sdError(e));
      setBusy(false);
    }
  };

  // "Send invite": a signed-in user creates immediately; a guest's draft is saved,
  // they sign in, and are brought straight back here to finish (auto-submitted).
  const submit = () => {
    if (!token) {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
      void router.push(href(`/signin?next=${encodeURIComponent(href("/deals/new?resume=1"))}`));
      return;
    }
    void doCreate(draft);
  };

  // Returning from sign-in with a saved draft (?resume=1): restore the form and finish the deal.
  useEffect(() => {
    if (!ready || !token || router.query.resume !== "1" || resumed) return;
    setResumed(true);
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(DRAFT_KEY); } catch { /* ignore */ }
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as NewDealDraft;
      setTitle(d.title || "");
      setAmount(d.amount ? String(d.amount) : "");
      setCurrency(d.currency || "USD");
      setRole(d.role || "seller");
      setEmail(d.email || "");
      setInviteBy(d.inviteByLink ? "link" : "email");
      setFeePayer(d.feePayer || "buyer");
      setDays(d.days || 3);
      setDealType((d.dealType as SdDealType) ?? null);
      setDue(d.due || "");
      setTerms(d.terms || "");
      setStep(1);
      void doCreate(d);
    } catch { /* ignore malformed draft */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, router.query.resume, resumed]);

  if (!ready) return null;
  const today = new Date().toISOString().slice(0, 10);

  // SD-05: inline live quote shown directly under the amount (and on review) on
  // phones — replaces the old fixed bottom bar that covered the form.
  // Fees only appear from the fee-payer step (step >= 1); before that the quote is
  // limited to the deal amount so we don't imply a fee split the user hasn't chosen.
  const feesVisible = step >= 1;
  const mobileQuote = (
    <Box sx={{ display: { xs: "block", md: "none" }, borderRadius: 2.5, backgroundColor: "#0B1020", color: "#fff", overflow: "hidden" }} data-testid="sd-new-quote-inline">
      <Box role="button" tabIndex={0} aria-expanded={feesVisible ? quoteOpen : undefined} aria-controls="sd-quote-details" onClick={() => feesVisible && setQuoteOpen((o) => !o)} onKeyDown={(e) => feesVisible && (e.key === "Enter" || e.key === " ") && setQuoteOpen((o) => !o)} data-testid="sd-new-quote-bar-toggle" sx={{ px: 1.8, py: 1.3, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: preview && feesVisible ? "pointer" : "default" }}>
        {preview ? (
          feesVisible ? (
            <Typography sx={{ fontSize: 14, fontWeight: 800, ...TABULAR }} data-testid="sd-new-quote-summary" data-role={role} data-fees="1">
              {role === "seller"
                ? <>You receive <span style={{ color: "#6EE7B7" }}>{money(preview.sellerReceives, "USD")}</span> · Buyer pays <span style={{ color: SD_INK_MUTED }}>{money(preview.buyerPays, "USD")}</span></>
                : <>You pay <span style={{ color: SD_GOLD }}>{money(preview.buyerPays, "USD")}</span> · Seller gets <span style={{ color: SD_INK_MUTED }}>{money(preview.sellerReceives, "USD")}</span></>}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 14, fontWeight: 800, ...TABULAR }} data-testid="sd-new-quote-summary" data-fees="0">
              Deal amount <span style={{ color: SD_GOLD }}>{money(preview.amount, "USD")}</span> <span style={{ color: SD_INK_MUTED, fontWeight: 600 }}>· fees shown next step</span>
            </Typography>
          )
        ) : (
          <Typography sx={{ fontSize: 13.5, color: SD_INK_MUTED }}>Live quote appears once the amount is ${minDeal} or more</Typography>
        )}
        {preview && feesVisible && <Icon icon={quoteOpen ? "mdi:chevron-up" : "mdi:chevron-down"} width={22} aria-hidden />}
      </Box>
      <Collapse in={quoteOpen && !!preview && feesVisible} id="sd-quote-details"><Box sx={{ px: 1.8, pb: 1.8 }}>{preview && <QuoteBody preview={preview} role={role} showFees={feesVisible} />}</Box></Collapse>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-new-deal-page" data-step={step}>
      <Typography component="h1" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, letterSpacing: -0.8, mb: 0.5 }}>Create a deal</Typography>
      <Typography sx={{ fontSize: 14, color: "#6B7280", mb: 2.5 }}>Invite the other party by shareable link or email. Nothing is charged until the buyer funds the escrow.</Typography>

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
                    error={belowMin || aboveMax}
                    helperText={aboveMax ? `Maximum deal is €${maxDealEur.toLocaleString()}${maxDealUsd ? ` (≈ ${money(maxDealUsd)})` : ""}${fiat ? ` — your amount ≈ ${money(usdEquivalent)}` : ""}` : belowMin ? `Minimum deal amount is $${minDeal}${fiat ? ` (≈ ${money(usdEquivalent)} today)` : ""}` : fiat && preview?.price ? `≈ ${money(preview.price.usd)} today · USD locked when the buyer funds` : rangeCopy}
                    FormHelperTextProps={{ "data-testid": "sd-new-amount-helper" } as any}
                    InputProps={{ startAdornment: <InputAdornment position="start">{currency === "USD" ? "$" : currency}</InputAdornment> }}
                    inputProps={{ "data-testid": "sd-new-amount", inputMode: "decimal" }}
                  />
                  <TextField select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} sx={{ minWidth: 118 }} inputProps={{ "data-testid": "sd-new-currency" }} SelectProps={{ SelectDisplayProps: { "data-testid": "sd-new-currency-select" } as any, MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>
                    {(cfg?.price_currencies || ["USD"]).map((c) => <MenuItem key={c} value={c} data-testid={`sd-new-currency-${c}`}>{c}</MenuItem>)}
                  </TextField>
                </Stack>
                {mobileQuote}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.8 }}>I am the…</Typography>
                  <SdChoice value={role} onChange={setRole} testid="sd-new-role" options={[
                    { v: "seller", label: "Seller", sub: "I deliver and get paid", icon: "mdi:storefront-outline" },
                    { v: "buyer", label: "Buyer", sub: "I pay and receive", icon: "mdi:cart-outline" },
                  ]} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.8 }}>How do you want to invite them?</Typography>
                  <SdChoice value={inviteBy} onChange={setInviteBy} testid="sd-new-invite-by" options={[
                    { v: "link", label: "By shareable link", sub: "Send it over Telegram, WhatsApp…", icon: "mdi:link-variant" },
                    { v: "email", label: "By email", sub: "We email them an invite", icon: "mdi:email-outline" },
                  ]} />
                </Box>
                {byLink ? (
                  <Box sx={{ p: 1.6, borderRadius: 2.5, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", display: "flex", gap: 1.2, alignItems: "flex-start" }} data-testid="sd-new-link-note">
                    <Icon icon="mdi:information-outline" width={20} color="#6B7280" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                    <Typography sx={{ fontSize: 13, color: "#4B5563" }}>You&apos;ll get a link to share anywhere. The first person who opens it and signs in joins as the <b>{role === "seller" ? "buyer" : "seller"}</b> — and you&apos;ll see who joined before any money moves.</Typography>
                  </Box>
                ) : (
                  <TextField label={role === "seller" ? "Buyer's email" : "Seller's email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth error={selfInvite} helperText={selfInvite ? "That's you — enter the other party's email." : "They'll receive an invite link. No account needed."} inputProps={{ "data-testid": "sd-new-email" }} />
                )}
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

                <Divider sx={{ my: 0.5 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 800 }} data-testid="sd-new-review-heading">Review & send</Typography>
                <NewDealReview d={draft} preview={preview} minDeal={minDeal} />
                {mobileQuote}
              </>
            )}

            <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ pt: 0.5 }}>
              <Button disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)} data-testid="sd-new-back" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, visibility: step === 0 ? "hidden" : "visible" }} startIcon={<Icon icon="mdi:arrow-left" />}>Back</Button>
              {step < 1 ? (
                <Button variant="contained" disabled={step === 0 && !step0Ok} onClick={() => setStep((s) => s + 1)} data-testid="sd-new-continue" sx={primaryBtn} endIcon={<Icon icon="mdi:arrow-right" />}>Continue</Button>
              ) : (
                <Button variant="contained" size="large" disabled={!canSubmit} onClick={() => void submit()} data-testid="sd-new-submit" endIcon={<Icon icon="mdi:send" />} sx={primaryBtn}>{busy ? "Creating…" : byLink ? "Create invite link" : "Send invite"}</Button>
              )}
            </Stack>
          </Stack>
        </Grid>

        <Grid item xs={12} md={5} sx={{ display: { xs: "none", md: "block" } }}>
          <Box sx={{ p: 2.5, borderRadius: 3, backgroundColor: "#0B1020", color: "#fff", position: "sticky", top: 84 }} data-testid="sd-new-quote">
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: SD_INK_MUTED, mb: 1.2 }}>Live quote</Typography>
            {!preview ? <Typography sx={{ fontSize: 14, color: SD_INK_MUTED }}>Enter an amount of ${minDeal} or more to see the itemised quote.</Typography> : <QuoteBody preview={preview} role={role} showFees={feesVisible} />}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
