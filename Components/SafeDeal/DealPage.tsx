import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Skeleton, Snackbar, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdDeal, SdDealPreview, SdDealAction, sdError } from "@/api/safedeal";
import DisputePanel from "@/Components/Page/Escrow/DisputePanel";
import EscrowProgress from "@/Components/Page/Escrow/EscrowProgress";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { useSdHref, useSdSession } from "./sdRouting";
import { SD_AMBER } from "./SafeDealShell";
import NextStepBanner from "./NextStepBanner";
import SdStatusChip from "./SdStatusChip";
import { TABULAR, absTime, nextStep, relTime, useNow } from "./sdFormat";

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" } as const;
const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } } as const;
const ghostBtn = { textTransform: "none", fontWeight: 700, borderRadius: 99 } as const;

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
  const [dialog, setDialog] = useState<null | "decline" | "cancel" | "deliver" | "release">(null);
  const [note, setNote] = useState("");
  const [live, setLive] = useState(false);
  const now = useNow();
  useEffect(() => {
    safedealApi.config().then((c) => setLive(!!c.live_settlement)).catch(() => undefined);
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
      if (action === "checkout" && r.deal.checkout?.url) {
        window.location.href = r.deal.checkout.url;
        return;
      }
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

  // ── unauthenticated / non-participant preview ──────────────────────────────
  if (ready && (!session || forbidden)) {
    const signinHref = href(`/signin?next=${encodeURIComponent(`/deal/${token}`)}${preview?.counterparty_email_hint ? `&email=${encodeURIComponent(preview.counterparty_email_hint)}` : ""}`);
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }} data-testid="sd-deal-preview">
        {error && <Alert severity="error">{error}</Alert>}
        {preview && (
          <Box sx={{ ...card, p: 3.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Icon icon="mdi:shield-check" width={22} color={BRAND_ACCENT} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: BRAND_ACCENT, letterSpacing: 0.6, textTransform: "uppercase" }}>You&apos;re invited to an escrow deal</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }} data-testid="sd-preview-title">{preview.title}</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 900, my: 1 }}>{money(preview.amount, preview.currency)}</Typography>
            <Stack spacing={0.5} sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Buyer: <b>{preview.buyer_email_masked}</b> · pays {money(preview.buyer_pays, preview.currency)}</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Seller: <b>{preview.seller_email_masked}</b> · receives {money(preview.seller_receives, preview.currency)}</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Auto-release {preview.auto_release_days} days after delivery · status: {preview.status.replace("_", " ")}</Typography>
            </Stack>
            {forbidden ? (
              <Alert severity="warning" sx={{ mb: 2 }} data-testid="sd-preview-forbidden">{forbidden}</Alert>
            ) : (
              <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 2 }}>
                Sign in with <b>{preview.counterparty_email_hint}</b> to accept, decline, fund or follow this deal. Signing in creates your SafeDeal wallet — no password needed.
              </Typography>
            )}
            <Link href={signinHref} style={{ textDecoration: "none" }} data-testid="sd-preview-signin">
              <Button fullWidth variant="contained" size="large" sx={{ ...primaryBtn, py: 1.2 }} endIcon={<Icon icon="mdi:arrow-right" />}>
                {forbidden ? "Sign in with a different email" : "Sign in to respond"}
              </Button>
            </Link>
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
  const b = deal.breakdown;
  const status = deal.status;
  const preFunding = ["invited", "awaiting_payment"].includes(status);
  const settled = ["completed", "refunded", "split"].includes(status);
  const dispute = safedealApi.disputeApi(token, (d) => setDeal(d));
  const created = router.query.created === "1";
  const funded = router.query.funded === "1";

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
    if (status === "awaiting_payment" && isBuyer) return { label: `Fund ${money(b.buyerPays, deal.currency)}`, testid: "sd-sticky-fund", onClick: () => void act(deal.checkout_url || isLive(deal, live) ? "checkout" : "fund") };
    if (status === "funded" && !isBuyer) return { label: "Mark as delivered", testid: "sd-sticky-deliver", onClick: () => setDialog("deliver") };
    if (status === "delivered" && isBuyer) return { label: "Confirm & release", testid: "sd-sticky-release", onClick: () => setDialog("release") };
    return null;
  })();


  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-deal-page" data-status={status}>
      <Link href={href("/deals")} style={{ textDecoration: "none" }} data-testid="sd-deal-back">
        <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 1.5, display: "inline-flex", alignItems: "center", gap: 0.4, "&:hover": { color: BRAND_ACCENT } }}>
          <Icon icon="mdi:arrow-left" width={16} /> My deals
        </Typography>
      </Link>

      {created && <Alert severity="success" sx={{ mb: 2 }} data-testid="sd-deal-created-banner">Deal created — we emailed {other} an invite. You can also share the link below.</Alert>}
      {funded && status !== "awaiting_payment" && <Alert severity="success" sx={{ mb: 2 }}>Payment received — the escrow is funded.</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component="h1" sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 900, letterSpacing: -0.8 }} data-testid="sd-deal-title">{deal.title}</Typography>
            <SdStatusChip deal={deal} testId="sd-deal-status" />
          </Stack>
          <Typography sx={{ fontSize: 13.5, color: "#6B7280", mt: 0.4 }} data-testid="sd-deal-parties">
            Deal #{deal.escrow_id} · You are the <b>{me}</b> · {isBuyer ? "Seller" : "Buyer"}: <b>{other}</b>
          </Typography>
        </Box>
        <Typography sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, ...TABULAR }} data-testid="sd-deal-amount">{money(deal.amount, deal.currency)}</Typography>
      </Stack>

      <NextStepBanner deal={deal} />

      <Box sx={{ ...card, mb: 2.5 }}>
        <EscrowProgress deal={deal} testId="sd-deal-progress" />
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Stack spacing={2.5}>
            {/* Actions */}
            <Box sx={card} data-testid="sd-deal-actions">
              {status === "invited" && !deal.is_creator && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>{other} invited you as the {me}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>
                    {isBuyer ? `If you accept, you'll be asked to fund ${money(b.buyerPays, deal.currency)} into escrow.` : `If you accept, the buyer funds ${money(b.buyerPays, deal.currency)} and you receive ${money(b.sellerReceives, deal.currency)} once the deal completes.`}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" disabled={!!busy} onClick={() => void act("accept")} data-testid="sd-act-accept" sx={primaryBtn} startIcon={<Icon icon="mdi:check" />}>Accept deal</Button>
                    <Button variant="outlined" disabled={!!busy} onClick={() => setDialog("decline")} data-testid="sd-act-decline-open" sx={ghostBtn}>Decline</Button>
                  </Stack>
                </>
              )}
              {status === "invited" && deal.is_creator && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Waiting for {other} to accept</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>We emailed them an invite. You can also send them this link directly:</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField size="small" value={deal.invite_url || ""} fullWidth InputProps={{ readOnly: true }} inputProps={{ "data-testid": "sd-invite-link" }} />
                    <Button variant="outlined" onClick={() => void copyInvite()} data-testid="sd-copy-invite" sx={{ ...ghostBtn, flexShrink: 0 }} startIcon={<Icon icon="mdi:content-copy" />}>Copy</Button>
                  </Stack>
                </>
              )}
              {status === "awaiting_payment" && isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Fund the escrow — {money(b.buyerPays, deal.currency)}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>Your payment is converted to USDT and held by Dynopay until you release it (or the auto-release timer runs out after delivery).</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    {deal.buyer_balance && deal.buyer_balance.available > 0 && (
                      <Tooltip title={deal.buyer_balance.available < b.buyerPays ? `Available ${money(deal.buyer_balance.available)} — not enough for this deal` : ""}>
                        <span>
                          <Button variant="contained" disabled={!!busy || deal.buyer_balance.available < b.buyerPays} onClick={() => void act("fund-balance")} data-testid="sd-act-fund-balance" sx={primaryBtn} startIcon={<Icon icon="mdi:wallet-outline" />}>
                            Pay from balance ({money(deal.buyer_balance.available)})
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                    <Button variant={deal.buyer_balance && deal.buyer_balance.available >= b.buyerPays ? "outlined" : "contained"} disabled={!!busy} onClick={() => void act(deal.checkout_url || isLive(deal, live) ? "checkout" : "fund")} data-testid="sd-act-fund" sx={deal.buyer_balance && deal.buyer_balance.available >= b.buyerPays ? ghostBtn : primaryBtn} startIcon={<Icon icon="mdi:currency-btc" />}>
                      {isLive(deal, live) ? "Pay with crypto" : "Pay with crypto (simulated)"}
                    </Button>
                  </Stack>
                  {!isLive(deal, live) && <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}>Preview environment: funding is simulated — no real money moves.</Typography>}
                </>
              )}
              {status === "awaiting_payment" && !isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Accepted — waiting for the buyer to fund</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Don&apos;t start work until the deal shows <b>Funded</b>. We&apos;ll email you the moment it does.</Typography>
                </>
              )}
              {status === "funded" && !isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Funded — {money(deal.custody_amount_stable ?? b.buyerPays, deal.currency)} is held in escrow</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>Deliver the work, then mark it delivered. The buyer then has a {deal.auto_release_days}-day inspection period before funds release automatically.</Typography>
                  <Button variant="contained" disabled={!!busy} onClick={() => setDialog("deliver")} data-testid="sd-act-deliver-open" sx={primaryBtn} startIcon={<Icon icon="mdi:package-variant-closed-check" />}>Mark as delivered</Button>
                </>
              )}
              {status === "funded" && isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Funded — waiting for the seller to deliver</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>Already received what you paid for? You can release early.</Typography>
                  <Button variant="outlined" disabled={!!busy} onClick={() => setDialog("release")} data-testid="sd-act-release-open" sx={ghostBtn} startIcon={<Icon icon="mdi:cash-check" />}>Release funds early</Button>
                </>
              )}
              {status === "delivered" && isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Delivered — confirm to release {money(b.sellerReceives, deal.currency)} to the seller</Typography>
                  {deal.delivery_note && <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1, fontStyle: "italic" }}>“{deal.delivery_note}”</Typography>}
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>
                    Your inspection period ends <b>{relTime(deal.auto_release_at, now)}</b> ({absTime(deal.auto_release_at)}). If you do nothing, the funds release then. Something wrong? Raise an issue below before that.
                  </Typography>
                  <Button variant="contained" disabled={!!busy} onClick={() => setDialog("release")} data-testid="sd-act-release-open" sx={primaryBtn} startIcon={<Icon icon="mdi:cash-check" />}>Confirm & release</Button>
                </>
              )}
              {status === "delivered" && !isBuyer && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Delivered — waiting for the buyer</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Funds release automatically <b>{relTime(deal.auto_release_at, now)}</b> ({absTime(deal.auto_release_at)}) unless the buyer confirms sooner or raises an issue.</Typography>
                </>
              )}
              {status === "disputed" && (
                <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>This deal is paused while the {deal.dispute_proposal?.kind === "cancellation" ? "cancellation request" : "dispute"} is resolved — see the panel below.</Typography>
              )}
              {settled && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }} data-testid="sd-settled-title">
                    {status === "completed" ? "Deal completed" : status === "refunded" ? "Deal refunded" : "Deal settled with a split"}
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>{deal.settlement_note}</Typography>
                  {(isBuyer ? (deal.buyer_entitlement_stable || 0) > 0 : (deal.seller_entitlement_stable || 0) > 0) && (
                    <Alert severity="success" icon={<Icon icon="mdi:wallet-plus-outline" />} data-testid="sd-settled-credit">
                      <b>{money(isBuyer ? deal.buyer_entitlement_stable : deal.seller_entitlement_stable, deal.currency)}</b> was credited to your SafeDeal wallet.{" "}
                      <Link href={href("/wallet")} style={{ fontWeight: 800, color: BRAND_ACCENT }} data-testid="sd-settled-wallet-link">Open wallet →</Link>
                    </Alert>
                  )}
                </>
              )}
              {["cancelled", "declined", "expired"].includes(status) && (
                <Typography sx={{ fontSize: 13.5, color: "#4B5563" }} data-testid="sd-terminal-note">
                  This deal was {status}. Nothing was charged. <Link href={href("/deals/new")} style={{ color: BRAND_ACCENT, fontWeight: 700 }}>Start a new deal</Link>
                </Typography>
              )}

              {preFunding && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 12.5, color: "#6B7280" }}>Changed your mind? Cancelling before funding is free.</Typography>
                    <Button size="small" color="inherit" disabled={!!busy} onClick={() => setDialog("cancel")} data-testid="sd-act-cancel-open" sx={{ ...ghostBtn, color: "#6B7280" }} startIcon={<Icon icon="mdi:cancel" />}>Cancel deal</Button>
                  </Stack>
                </>
              )}
            </Box>

            {/* Dispute / cancellation request (funded, delivered, disputed) */}
            <DisputePanel deal={deal} myRole={me} api={dispute} onUpdated={(d) => setDeal(d as SdDeal)} notify={notify} />

            {/* Terms */}
            {deal.terms && (
              <Box sx={card} data-testid="sd-deal-terms">
                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.6 }}>Terms</Typography>
                <Typography sx={{ fontSize: 13.5, color: "#374151", whiteSpace: "pre-wrap" }}>{deal.terms}</Typography>
              </Box>
            )}

            {/* Timeline */}
            <Box sx={card} data-testid="sd-deal-timeline">
              <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.2 }}>Activity</Typography>
              <Stack spacing={1.2}>
                {[...(deal.activity_log || [])].reverse().map((a, i) => (
                  <Stack key={i} direction="row" spacing={1.2} alignItems="flex-start">
                    <Box sx={{ width: 8, height: 8, mt: 0.7, borderRadius: "50%", flexShrink: 0, backgroundColor: a.type.includes("dispute") || a.type.includes("cancel") ? SD_AMBER : BRAND_ACCENT }} />
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

        {/* Amounts */}
        <Grid item xs={12} md={5}>
          <Box sx={{ ...card, position: { md: "sticky" }, top: 84 }} data-testid="sd-deal-amounts">
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9CA3AF", mb: 1.2 }}>Money</Typography>
            <Stack spacing={0.8}>
              <Row l="Deal amount" v={money(b.amount, deal.currency)} />
              {(b.costItems || []).map((c) => <Row key={c.key} l={c.label} v={money(c.amount, deal.currency)} soft />)}
              <Divider sx={{ my: 0.6 }} />
              <Row l="Buyer pays" v={money(b.buyerPays, deal.currency)} strong hi={isBuyer} testid="sd-amt-buyer-pays" />
              <Row l="Seller receives" v={money(b.sellerReceives, deal.currency)} strong hi={!isBuyer} testid="sd-amt-seller-receives" />
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 1.2 }}>
              Fee payer: <b>{deal.fee_payer}</b>. Fees & costs are charged on every outcome. {b.costsEstimated ? "Costs are estimates until funded." : ""}
            </Typography>
            {deal.custody_amount_stable != null && (
              <Box sx={{ mt: 1.5, p: 1.4, borderRadius: 2, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }} data-testid="sd-deal-custody">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Icon icon="mdi:lock-outline" width={18} color="#B45309" />
                  <Typography sx={{ fontSize: 13, color: "#92400E" }}>
                    <b>{money(deal.custody_amount_stable, "USD")}</b> held as {deal.custody_stablecoin || "USDT"} by Dynopay{deal.funding_method ? ` · paid via ${deal.funding_method}` : ""}
                  </Typography>
                </Stack>
              </Box>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`Inspection period ${deal.auto_release_days}d`} sx={{ fontWeight: 700 }} />
              <Tooltip title={absTime(deal.created_at)} arrow><Chip size="small" label={`Created ${relTime(deal.created_at, now)}`} sx={{ fontWeight: 700 }} /></Tooltip>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {/* Mobile: sticky primary action */}
      {primary && (
        <>
          <Box sx={{ display: { xs: "block", md: "none" }, position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, p: 1.4, backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)", borderTop: "1px solid #E5E7EB", boxShadow: "0 -8px 24px rgba(15,23,42,0.08)" }} data-testid="sd-sticky-bar">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: BRAND_ACCENT }}>Your move</Typography>
                <Typography sx={{ fontSize: 12.5, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextStep(deal).text}</Typography>
              </Box>
              <Button variant={primary.variant || "contained"} disabled={!!busy} onClick={primary.onClick} data-testid={primary.testid} sx={primary.variant === "outlined" ? { ...ghostBtn, flexShrink: 0 } : { ...primaryBtn, flexShrink: 0 }}>
                {primary.label}
              </Button>
            </Stack>
          </Box>
          <Box sx={{ display: { xs: "block", md: "none" }, height: 76 }} aria-hidden />
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

      <Dialog open={dialog === "deliver"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Mark as delivered</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>The buyer gets {deal.auto_release_days} days to check. If they do nothing, {money(b.sellerReceives, deal.currency)} releases to your wallet automatically.</Typography>
          <TextField label="Delivery note (optional)" placeholder="Where to find the files, tracking number…" value={note} onChange={(e) => setNote(e.target.value)} fullWidth size="small" multiline minRows={2} inputProps={{ "data-testid": "sd-deliver-note" }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ textTransform: "none" }}>Back</Button>
          <Button variant="contained" disabled={!!busy} onClick={() => void act("deliver", { delivery_note: note })} data-testid="sd-act-deliver" sx={primaryBtn}>Mark delivered</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "release"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Release {money(b.sellerReceives, deal.currency)} to the seller?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>This is final. The seller&apos;s SafeDeal wallet is credited immediately and the deal closes as completed.</Typography>
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

const isLive = (d: SdDeal, live: boolean) => !!d.checkout_url || live;

function Row({ l, v, soft, strong, hi, testid }: { l: string; v: string; soft?: boolean; strong?: boolean; hi?: boolean; testid?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" data-testid={testid} sx={hi ? { px: 1, py: 0.4, mx: -1, borderRadius: 1.5, backgroundColor: `${BRAND_ACCENT}0F` } : undefined}>
      <Typography sx={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 800 : 500, color: soft ? "#6B7280" : "#111827" }}>{l}</Typography>
      <Typography sx={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 900 : 700, color: soft ? "#6B7280" : hi ? BRAND_ACCENT : "#111827", ...TABULAR }}>{v}</Typography>
    </Stack>
  );
}
