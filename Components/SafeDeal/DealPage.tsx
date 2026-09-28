import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Skeleton, Snackbar, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";
import safedealApi, { SdConfig, SdDeal, SdDealPreview, SdDealAction, sdError, prettyParty } from "@/api/safedeal";
import DisputePanel from "@/Components/Page/Escrow/DisputePanel";
import EscrowProgress from "@/Components/Page/Escrow/EscrowProgress";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useSdHref, useSdSession } from "./sdRouting";
import { SD_AMBER } from "./SafeDealShell";
import NextStepBanner from "./NextStepBanner";
import SdStatusChip from "./SdStatusChip";
import { TABULAR, absTime, nextStep, relTime, useNow } from "./sdFormat";
import DealActionsCard, { DealDialog, ghostBtn, primaryBtn } from "./DealActionsCard";
import PayoutDestinationCard from "./PayoutDestinationCard";
import DeliverDialog from "./DeliverDialog";
import RequestChangesDialog from "./RequestChangesDialog";
import AmendDialog from "./AmendDialog";
import { CounterpartyCard, DealFacts, DeliveryProofCard } from "./DealCards";
import { dealPrice } from "./sdDealTypes";
import DealCostLine, { HowEscrowWorksStrip } from "./DealCostLine";

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" } as const;

const PREVIEW_STATUS: Record<string, string> = {
  invited: "Waiting for a reply to the invite",
  awaiting_payment: "Accepted — waiting for the buyer's payment",
  funded: "Funded — money is held in escrow",
  delivered: "Delivered — the buyer is inspecting",
  disputed: "Paused while an issue is resolved",
  completed: "Completed — the seller has been paid",
  refunded: "Refunded to the buyer",
  cancelled: "Cancelled before any money moved",
  declined: "The invite was declined",
  expired: "The invite expired",
};
const humanPreviewStatus = (s: string) => PREVIEW_STATUS[s] || s.replace(/_/g, " ");

export default function DealPage({ token }: { token: string }) {
  const router = useRouter();
  const href = useSdHref();
  const { token: session, ready } = useSdSession();
  const [deal, setDeal] = useState<SdDeal | null>(null);
  const [preview, setPreview] = useState<SdDealPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: "success" | "error" } | null>(null);
  const [dialog, setDialog] = useState<DealDialog | null>(null);
  const [note, setNote] = useState("");
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  const now = useNow();
  useEffect(() => {
    safedealApi.config().then(setCfg).catch(() => undefined);
  }, []);
  const notify = (msg: string, severity: "success" | "error" = "success") => setToast({ msg, severity });

  const load = useCallback(async () => {
    setError(null);
    if (!session) {
      try {
        setPreview(await safedealApi.previewDeal(token));
      } catch (e) {
        setError(sdError(e));
      }
      return;
    }
    try {
      setDeal(await safedealApi.getDeal(token));
      setForbidden(null);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setForbidden(sdError(e));
        try { setPreview(await safedealApi.previewDeal(token)); } catch { /* ignore */ }
      } else setError(sdError(e));
    }
  }, [token, session]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const act = async (action: SdDealAction, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await safedealApi.act(token, { action, ...extra });
      setDeal(r.deal);
      notify(r.message);
      setDialog(null);
      setNote("");
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const claim = async () => {
    setBusy("claim");
    try {
      const d = await safedealApi.claimDeal(token);
      setDeal(d);
      setForbidden(null);
      notify("You've joined the deal.");
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const openFile = (id: number) => safedealApi.openFile(token, id).catch((e) => notify(sdError(e), "error"));
  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const blob = await safedealApi.dealPdf(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safedeal-${deal?.escrow_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setBusy(null);
    }
  };

  // ── unauthenticated / non-participant preview ──────────────────────────────
  if (ready && (!session || forbidden)) {
    // Never pass the invitee's address around — the guest signs in with their own inbox (audit SD-04).
    const signinHref = href(`/signin?next=${encodeURIComponent(`/deal/${token}`)}`);
    const isLink = preview?.invite_kind === "link";
    const openSeat = !!preview?.open_seat;
    const invitedRole = preview ? (preview.creator_role === "buyer" ? "seller" : "buyer") : "";
    const totalCost = preview ? Number(preview.total_cost ?? Math.max(0, preview.buyer_pays - preview.seller_receives)) : 0;
    const statusHuman = preview ? humanPreviewStatus(preview.status) : "";
    const afterSignIn = invitedRole === "buyer"
      ? [`Accept the terms (or decline)`, `Fund ${preview ? money(preview.buyer_pays, preview.currency) : ""} into escrow — held as USDT by SafeDeal`, `Release the money once you've received what you paid for`]
      : [`Accept the terms (or decline)`, `Wait for the buyer to fund — don't start before the deal shows Funded`, `Deliver, mark it delivered, and get ${preview ? money(preview.seller_receives, preview.currency) : ""} when the buyer releases`];
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }} data-testid="sd-deal-preview">
        {error && !preview && (
          <Box sx={{ ...card, p: 3.5 }} data-testid="sd-deal-unavailable">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Icon icon="mdi:link-variant-off" width={22} color={SD_ACCENT} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: SD_ACCENT, letterSpacing: 0.6, textTransform: "uppercase" }}>Deal link unavailable</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, mb: 1 }} data-testid="sd-deal-unavailable-msg">{error}</Typography>
            <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2.5 }}>
              This link may be mistyped, or the deal may no longer be available. You can still sign in with your email to see the deals on your SafeDeal account.
            </Typography>
            <Link href={href(`/signin?next=${encodeURIComponent("/deals")}`)} style={{ textDecoration: "none" }} data-testid="sd-unavailable-signin">
              <Button fullWidth variant="contained" size="large" sx={{ ...primaryBtn, py: 1.2 }} endIcon={<Icon icon="mdi:arrow-right" />}>
                Sign in with email
              </Button>
            </Link>
            <Link href={href("/")} style={{ textDecoration: "none" }}>
              <Button fullWidth variant="text" sx={{ mt: 1, textTransform: "none", color: "#6B7280" }}>Go to SafeDeal home</Button>
            </Link>
          </Box>
        )}
        {preview && (
          <Box sx={{ ...card, p: 3.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Icon icon="mdi:shield-check" width={22} color={SD_ACCENT} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: SD_ACCENT, letterSpacing: 0.6, textTransform: "uppercase" }}>{isLink ? "You're invited to join an escrow deal" : "You're invited to an escrow deal"}</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }} data-testid="sd-preview-title">{preview.title}</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 900, my: 1, ...TABULAR }}>{money(preview.amount, preview.currency)}</Typography>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563" }} data-testid="sd-preview-buyer">Buyer: <b>{preview.buyer_email_masked || (invitedRole === "buyer" ? "you (joining)" : "—")}</b> · pays {money(preview.buyer_pays, preview.currency)}</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563" }} data-testid="sd-preview-seller">Seller: <b>{preview.seller_email_masked || (invitedRole === "seller" ? "you (joining)" : "—")}</b> · receives {money(preview.seller_receives, preview.currency)}</Typography>
            </Stack>
            <Box sx={{ mb: 1.5 }}>
              <DealCostLine amount={preview.amount} buyerPays={preview.buyer_pays} sellerReceives={preview.seller_receives} totalCost={totalCost} feePayer={preview.fee_payer} currency={preview.currency} items={preview.cost_items} estimated={preview.costs_estimated !== false} testid="sd-preview-costs" />
            </Box>
            <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }} data-testid="sd-preview-inspection">
              {invitedRole === "buyer" ? `You'd have ${preview.auto_release_days} days to inspect after delivery before the money releases.` : `The buyer has ${preview.auto_release_days} days to inspect after delivery before the money releases.`}{statusHuman ? ` · ${statusHuman}` : ""}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "#9CA3AF", mb: 0.8 }}>How an escrow deal works</Typography>
            <HowEscrowWorksStrip />
            <Box sx={{ mt: 2, mb: 2.2, p: 1.4, borderRadius: 2.5, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }} data-testid="sd-preview-after-signin">
              <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#92400E", mb: 0.5 }}>What happens after you sign in</Typography>
              <Stack component="ol" spacing={0.3} sx={{ m: 0, pl: 2.2 }}>
                {afterSignIn.map((s) => <Typography key={s} component="li" sx={{ fontSize: 12.5, color: "#78350F" }}>{s}</Typography>)}
              </Stack>
            </Box>
            {isLink ? (
              openSeat ? (
                <>
                  <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2 }}>
                    You&apos;d join as the <b>{invitedRole}</b>. {session ? "Join to accept, fund and follow this deal." : "Sign in to join — it creates your SafeDeal wallet, no password needed."}
                  </Typography>
                  {session ? (
                    <Button fullWidth variant="contained" size="large" disabled={busy === "claim"} onClick={() => void claim()} data-testid="sd-preview-join" sx={{ ...primaryBtn, py: 1.2 }} endIcon={<Icon icon="mdi:account-plus-outline" />}>
                      {busy === "claim" ? "Joining…" : `Join this deal as the ${invitedRole}`}
                    </Button>
                  ) : (
                    <Link href={signinHref} style={{ textDecoration: "none" }} data-testid="sd-preview-signin">
                      <Button fullWidth variant="contained" size="large" sx={{ ...primaryBtn, py: 1.2 }} endIcon={<Icon icon="mdi:arrow-right" />}>Sign in to join</Button>
                    </Link>
                  )}
                </>
              ) : (
                <Alert severity="warning" data-testid="sd-preview-link-taken">{forbidden || "This deal has already been joined by someone else, so its spot is taken."}</Alert>
              )
            ) : (
              <>
                {forbidden ? (
                  <Alert severity="warning" sx={{ mb: 2 }} data-testid="sd-preview-forbidden">{forbidden}</Alert>
                ) : (
                  <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2 }} data-testid="sd-preview-signin-hint">
                    Sign in with the email this invite was sent to{preview.counterparty_email_masked ? <> — <b>{preview.counterparty_email_masked}</b></> : ""} — to accept, decline, fund or follow this deal. Signing in creates your SafeDeal wallet — no password needed.
                  </Typography>
                )}
                <Link href={signinHref} style={{ textDecoration: "none" }} data-testid="sd-preview-signin">
                  <Button fullWidth variant="contained" size="large" sx={{ ...primaryBtn, py: 1.2 }} endIcon={<Icon icon="mdi:arrow-right" />}>
                    {forbidden ? "Sign in with a different email" : "Sign in to respond"}
                  </Button>
                </Link>
              </>
            )}
          </Box>
        )}
        {!preview && !error && <Skeleton variant="rounded" height={260} />}
      </Container>
    );
  }

  if (!deal) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {error ? <Alert severity="error" data-testid="sd-deal-error">{error}</Alert> : <Skeleton variant="rounded" height={320} />}
      </Container>
    );
  }

  const me = deal.my_role as "buyer" | "seller";
  const isBuyer = me === "buyer";
  const other = isBuyer ? deal.seller_email : deal.buyer_email;
  const otherDisplay = prettyParty(other);
  const isLinkDeal = deal.invite_kind === "link";
  const b = deal.breakdown;
  const status = deal.status;
  // No simulation on this server ⇒ behave exactly like live (no "simulate payment" affordances).
  const live = !!cfg?.live_settlement || cfg?.simulation_allowed === false;
  // A mutually-agreed cancellation after funding is charged a cancellation fee (configurable,
  // default 5%). Settled: the backend labels the escrow-fee line "Cancellation fee". Pending: a
  // cancellation is still being negotiated (dispute_proposal.kind === "cancellation").
  const feeItem = (b.costItems || []).find((c) => c.key === "escrow_fee");
  const cancellationInBreakdown = !!feeItem && /cancellation fee/i.test(feeItem.label);
  const cancellationProposed = deal.dispute_proposal?.kind === "cancellation";
  const cancelFeePct = cfg?.cancellation_fee_percent ?? 5;
  const dispute = safedealApi.disputeApi(token, (d) => setDeal(d));
  const created = router.query.created === "1";
  const funded = router.query.funded === "1";
  const price = dealPrice(deal);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(deal.invite_url || window.location.href);
      notify("Invite link copied.");
    } catch {
      notify("Couldn't copy — select the link manually.", "error");
    }
  };

  const primary = ((): { label: string; testid: string; onClick: () => void; variant?: "contained" | "outlined" } | null => {
    if (status === "invited" && !deal.is_creator) return { label: "Accept deal", testid: "sd-sticky-accept", onClick: () => void act("accept") };
    if (status === "invited" && deal.is_creator) return { label: "Copy invite link", testid: "sd-sticky-copy", onClick: () => void copyInvite(), variant: "outlined" };
    if (status === "awaiting_payment" && isBuyer) return { label: `Fund ${money(b.buyerPays, deal.currency)}`, testid: "sd-sticky-fund", onClick: () => document.getElementById("sd-fund")?.scrollIntoView({ behavior: "smooth", block: "start" }) };
    if (status === "funded" && !isBuyer) return { label: (deal.revision_round || 0) > 0 ? "Deliver changes" : "Mark as delivered", testid: "sd-sticky-deliver", onClick: () => setDialog("deliver") };
    if (status === "delivered" && isBuyer) return { label: "Confirm & release", testid: "sd-sticky-release", onClick: () => setDialog("release") };
    return null;
  })();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-deal-page" data-status={status}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Link href={href("/deals")} style={{ textDecoration: "none" }} data-testid="sd-deal-back">
          <Typography sx={{ fontSize: 13, color: "#6B7280", display: "inline-flex", alignItems: "center", gap: 0.4, "&:hover": { color: SD_ACCENT } }}>
            <Icon icon="mdi:arrow-left" width={16} /> My deals
          </Typography>
        </Link>
        <Button size="small" disabled={busy === "pdf"} onClick={() => void downloadPdf()} data-testid="sd-deal-pdf" sx={{ ...ghostBtn, color: "#6B7280", fontSize: 12.5 }} startIcon={<Icon icon="mdi:file-pdf-box" width={18} />}>
          {busy === "pdf" ? "Preparing…" : "Deal summary (PDF)"}
        </Button>
      </Stack>

      {created && <Alert severity="success" sx={{ mb: 2 }} data-testid="sd-deal-created-banner">{isLinkDeal ? "Deal created — copy the invite link below and send it to the other party over Telegram, WhatsApp or anywhere." : `Deal created — we emailed ${other} an invite. You can also share the link below.`}</Alert>}
      {funded && status !== "awaiting_payment" && <Alert severity="success" sx={{ mb: 2 }}>Payment received — the escrow is funded.</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-start" }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component="h1" sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 900, letterSpacing: -0.8 }} data-testid="sd-deal-title">{deal.title}</Typography>
            <SdStatusChip deal={deal} testId="sd-deal-status" />
          </Stack>
          <Typography sx={{ fontSize: 13.5, color: "#6B7280", mt: 0.4 }} data-testid="sd-deal-parties">
            Deal #{deal.escrow_id} · You are the <b>{me}</b> · {isBuyer ? "Seller" : "Buyer"}: <b>{otherDisplay}</b>
          </Typography>
          <DealFacts deal={deal} />
        </Box>
        <Box sx={{ textAlign: { md: "right" }, flexShrink: 0, minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, ...TABULAR }} data-testid="sd-deal-amount">{price.primary}</Typography>
          {price.secondary && <Typography sx={{ fontSize: 12.5, color: "#6B7280", ...TABULAR }} data-testid="sd-deal-amount-usd">{price.secondary}</Typography>}
          {/* Why "you pay" ≠ the price, right where the price is (audit SD-02). Full itemisation lives in the Money card. */}
          {(b.totalCost ?? 0) > 0 && (
            <Typography sx={{ fontSize: 12.5, color: "#4B5563", mt: 0.4, ...TABULAR }} data-testid="sd-deal-header-costs">
              {isBuyer ? <>You pay <b>{money(b.buyerPays, deal.currency)}</b></> : <>You receive <b>{money(b.sellerReceives, deal.currency)}</b></>} · incl. {money(b.totalCost ?? 0, deal.currency)} SafeDeal costs ·{" "}
              <Box component="button" type="button" onClick={() => document.getElementById("sd-deal-amounts")?.scrollIntoView({ behavior: "smooth", block: "start" })} data-testid="sd-deal-header-costs-link"
                sx={{ border: 0, background: "none", p: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: 800, color: SD_ACCENT, "&:hover": { textDecoration: "underline" } }}>
                see breakdown
              </Box>
            </Typography>
          )}
        </Box>
      </Stack>

      <NextStepBanner deal={deal} />

      <Box sx={{ ...card, mb: 2.5 }}>
        <EscrowProgress deal={deal} testId="sd-deal-progress" accent={SD_ACCENT} />
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Stack spacing={2.5}>
            <Box sx={card} data-testid="sd-deal-actions">
              <DealActionsCard deal={deal} busy={busy} live={live} now={now} stickyOnPhone={!!primary} walletHref={href("/wallet")} newDealHref={href("/deals/new")} act={(a, x) => void act(a, x)} openDialog={setDialog} copyInvite={() => void copyInvite()} reload={() => void load()} notify={notify} />
            </Box>

            <DeliveryProofCard deal={deal} isBuyer={isBuyer} onOpenFile={(id) => void openFile(id)} />

            <DisputePanel deal={deal} myRole={me} api={dispute} onUpdated={(d) => setDeal(d as SdDeal)} notify={notify} />

            {deal.terms && (
              <Box sx={card} data-testid="sd-deal-terms">
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Terms</Typography>
                  {deal.amended_at && <Tooltip title={absTime(deal.amended_at)}><Chip size="small" label={`Updated ${relTime(deal.amended_at, now)}`} sx={{ fontSize: 11, fontWeight: 700 }} data-testid="sd-terms-amended" /></Tooltip>}
                </Stack>
                <Typography sx={{ fontSize: 13.5, color: "#374151", whiteSpace: "pre-wrap" }}>{deal.terms}</Typography>
              </Box>
            )}

            <Box sx={card} data-testid="sd-deal-timeline">
              <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.2 }}>Activity</Typography>
              <Stack spacing={1.2}>
                {[...(deal.activity_log || [])].reverse().map((a, i) => (
                  <Stack key={i} direction="row" spacing={1.2} alignItems="flex-start">
                    <Box sx={{ width: 8, height: 8, mt: 0.7, borderRadius: "50%", flexShrink: 0, backgroundColor: a.type.includes("dispute") || a.type.includes("cancel") || a.type === "changes_requested" ? SD_AMBER : SD_ACCENT }} />
                    <Box>
                      <Typography sx={{ fontSize: 13, color: "#111827" }}>{a.note || a.type}</Typography>
                      <Tooltip title={absTime(a.at)} arrow><Typography component="time" dateTime={a.at} sx={{ fontSize: 11.5, color: "#6B7280", cursor: "help" }}>{relTime(a.at, now)} · {a.role || a.actor}</Typography></Tooltip>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Grid>

        <Grid item xs={12} md={5}>
          <Stack spacing={2.5} sx={{ position: { md: "sticky" }, top: 84 }}>
            <Box sx={card} data-testid="sd-deal-amounts" id="sd-deal-amounts">
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9CA3AF", mb: 1.2 }}>Money</Typography>
              <Stack spacing={0.8}>
                {price.secondary && <Row l={`Agreed price (${deal.price_currency})`} v={price.primary} testid="sd-amt-fiat" />}
                <Row l={price.secondary ? (price.locked ? "USD (rate locked)" : "USD today (indicative)") : "Deal amount"} v={money(b.amount, deal.currency)} />
                {(b.costItems || []).map((c) => <Row key={c.key} l={c.label} v={money(c.amount, deal.currency)} soft />)}
                <Divider sx={{ my: 0.6 }} />
                <Row l="Buyer pays" v={money(b.buyerPays, deal.currency)} strong hi={isBuyer} testid="sd-amt-buyer-pays" />
                <Row l="Seller receives" v={money(b.sellerReceives, deal.currency)} strong hi={!isBuyer} testid="sd-amt-seller-receives" />
              </Stack>
              {b.fundingCoinAssumed && (b.nonStableSurchargeUsd || 0) > 0 && (
                <Typography sx={{ fontSize: 11.5, color: "#92400E", mt: 1, p: 1, borderRadius: 1.5, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }} data-testid="sd-amt-surcharge-note">
                  Priced for a stablecoin payment (USDT/USDC). Paying with BTC, ETH or another non-stablecoin adds ≈ {money(b.nonStableSurchargeUsd || 0, deal.currency)} ({b.exchangeFeePercent ?? 2}% exchange fee, conversion and network costs){deal.fee_payer === "buyer" ? " to what the buyer pays" : deal.fee_payer === "seller" ? " to the costs deducted from the seller" : ", shared per the fee split"} — the exact total is shown per coin at checkout.
                </Typography>
              )}
              <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 1.2 }}>
                Fee payer: <b>{deal.fee_payer}</b>. {cancellationInBreakdown
                  ? `This mutually-agreed cancellation is charged a ${cancelFeePct}% cancellation fee — the buyer is refunded the held amount minus that fee and the real network and exchange costs.`
                  : cancellationProposed
                  ? `If you both agree to cancel, a ${cancelFeePct}% cancellation fee applies — the buyer is refunded the held amount minus that fee and the real network and exchange costs.`
                  : `Fees & costs are charged on release, refund and split; a ${cancelFeePct}% cancellation fee applies on a mutually-agreed cancellation.`} {b.costsEstimated ? "Costs are estimates until funded." : deal.custody_amount_stable != null ? "Costs were fixed when the deal was funded — exactly what was paid." : ""}
                {price.secondary && !price.locked ? ` The ${deal.price_currency} price converts to USD at the live rate when the buyer funds.` : ""}
                {price.locked && deal.fx_rate && deal.price_currency !== "USD" ? ` Locked rate: 1 ${deal.price_currency} = ${Number(deal.fx_rate).toFixed(4)} USD.` : ""}
              </Typography>
              {deal.custody_amount_stable != null && (
                <Box sx={{ mt: 1.5, p: 1.4, borderRadius: 2, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }} data-testid="sd-deal-custody">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Icon icon="mdi:lock-outline" width={18} color="#B45309" />
                    <Typography sx={{ fontSize: 13, color: "#92400E" }}>
                      <b>{money(deal.custody_amount_stable, "USD")}</b> held as {deal.custody_stablecoin || "USDT"} in escrow{deal.funding_coin ? ` · paid in ${deal.funding_coin}` : ""}{deal.custody_realized_usd != null ? ` · ${money(deal.custody_realized_usd, "USD")} realised after conversion` : ""}
                    </Typography>
                  </Stack>
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Inspection period ${deal.auto_release_days}d`} sx={{ fontWeight: 700 }} />
                <Tooltip title={absTime(deal.created_at)} arrow><Chip size="small" label={`Created ${relTime(deal.created_at, now)}`} sx={{ fontWeight: 700 }} /></Tooltip>
              </Stack>
            </Box>
            <PayoutDestinationCard deal={deal} cfg={cfg} now={now} walletHref={href("/wallet")} onUpdated={(d, m) => { setDeal(d); notify(m); }} onError={(m) => notify(m, "error")} />
            <CounterpartyCard deal={deal} isBuyer={isBuyer} />
          </Stack>
        </Grid>
      </Grid>

      {primary && (
        <>
          <Box sx={{ display: { xs: "block", md: "none" }, position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, p: 1.4, pb: "calc(11.2px + env(safe-area-inset-bottom, 0px))", backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", borderTop: "1px solid #E5E7EB", boxShadow: "0 -8px 24px rgba(15,23,42,0.08)" }} data-testid="sd-sticky-bar">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: SD_ACCENT }}>Your move</Typography>
                <Typography sx={{ fontSize: 12.5, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextStep(deal).text}</Typography>
              </Box>
              <Button variant={primary.variant || "contained"} disabled={!!busy} onClick={primary.onClick} data-testid={primary.testid} sx={primary.variant === "outlined" ? { ...ghostBtn, flexShrink: 0 } : { ...primaryBtn, flexShrink: 0 }}>
                {primary.label}
              </Button>
            </Stack>
          </Box>
          <Box sx={{ display: { xs: "block", md: "none" }, height: "calc(76px + env(safe-area-inset-bottom, 0px))" }} aria-hidden />
        </>
      )}

      {/* dialogs */}
      <Dialog open={dialog === "decline"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Decline this deal?</DialogTitle>
        <DialogContent>
          <TextField label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth size="small" multiline minRows={2} inputProps={{ "data-testid": "sd-decline-reason" }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ textTransform: "none" }}>Keep</Button>
          <Button variant="contained" color="error" disabled={!!busy} onClick={() => void act("decline", { reason: note })} data-testid="sd-act-decline" sx={{ textTransform: "none", fontWeight: 700 }}>Decline</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "cancel"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Cancel this deal?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>Nothing has been paid, so cancelling is free and instant. The other party will be notified. This can&apos;t be undone.</Typography>
          <TextField label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth size="small" inputProps={{ "data-testid": "sd-cancel-reason" }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ textTransform: "none" }}>Keep deal</Button>
          <Button variant="contained" color="error" disabled={!!busy} onClick={() => void act("cancel", { reason: note })} data-testid="sd-act-cancel" sx={{ textTransform: "none", fontWeight: 700 }}>Cancel deal</Button>
        </DialogActions>
      </Dialog>

      {dialog === "deliver" && <DeliverDialog open deal={deal} token={token} busy={busy === "deliver"} onClose={() => setDialog(null)} onError={(m) => notify(m, "error")} onSubmit={(p) => void act("deliver", p as unknown as Record<string, unknown>)} />}
      {dialog === "changes" && <RequestChangesDialog open deal={deal} busy={busy === "request-changes"} onClose={() => setDialog(null)} onSubmit={(message) => void act("request-changes", { message })} />}
      {dialog === "amend" && <AmendDialog open deal={deal} cfg={cfg} busy={busy === "amend"} onClose={() => setDialog(null)} onSubmit={(body) => void act("amend", body as Record<string, unknown>)} />}

      <Dialog open={dialog === "release"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Release {money(b.sellerReceives, deal.currency)} to the seller?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>This is final. The seller is paid straight away — to their payout address if they&apos;ve set one, otherwise into their SafeDeal balance — and the deal closes as completed.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ textTransform: "none" }}>Not yet</Button>
          <Button variant="contained" disabled={!!busy} onClick={() => void act("release")} data-testid="sd-act-release" sx={primaryBtn}>Release funds</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast?.severity || "success"} onClose={() => setToast(null)} data-testid="sd-toast" sx={{ fontWeight: 600 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Container>
  );
}

function Row({ l, v, soft, strong, hi, testid }: { l: string; v: string; soft?: boolean; strong?: boolean; hi?: boolean; testid?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" data-testid={testid} sx={hi ? { px: 1, py: 0.4, mx: -1, borderRadius: 1.5, backgroundColor: `${SD_ACCENT}0F` } : undefined}>
      <Typography sx={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 800 : 500, color: soft ? "#6B7280" : "#111827" }}>{l}</Typography>
      <Typography sx={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 900 : 700, color: soft ? "#6B7280" : hi ? SD_ACCENT : "#111827", ...TABULAR }}>{v}</Typography>
    </Stack>
  );
}
