import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  ArrowBackRounded,
  ContentCopyRounded,
  OpenInNewRounded,
  PaymentsRounded,
  LocalShippingRounded,
  LockOpenRounded,
  CancelRounded,
  AccountBalanceWalletRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import confetti from "canvas-confetti";
import { escrowApi, EscrowDeal } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha, brandFg } from "@/constants/theme";
import StatusChip from "./StatusChip";
import EscrowProgress from "./EscrowProgress";
import FeeBreakdownCard from "./FeeBreakdownCard";
import DisputePanel from "./DisputePanel";
import { CoinIcon } from "./CoinIcon";
import { money, stable, shortDate, titleize, legTone, relativeDays, FUNDING_COINS, PAYOUT_OPTIONS } from "./escrowUtils";

type DialogKind = null | "fund" | "deliver" | "release" | "cancel" | "seller-address" | "buyer-address";

const celebrate = () => {
  try {
    confetti({
      disableForReducedMotion: true,
      particleCount: 90,
      spread: 72,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.35 },
      colors: ["#4338CA", "#6366F1", "#818CF8", "#12B76A"],
      scalar: 0.9,
    });
  } catch {
    /* best-effort */
  }
};

export default function EscrowDetail({ id }: { id: string | number }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const notify = (message: string, severity: "success" | "error" = "success") =>
    dispatch({ type: "TOAST_SHOW", payload: { message, severity } });

  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  // dialog inputs
  const [coin, setCoin] = useState("USDT-TRON");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [reason, setReason] = useState("");
  const [addr, setAddr] = useState("");
  const [payoutCoin, setPayoutCoin] = useState("USDT-TRON");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await escrowApi.get(id);
      setDeal(d);
      setNotFound(false);
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.response?.status === 403) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const closeDialog = () => {
    setDialog(null);
    setReason("");
    setDeliveryNote("");
    setAddr("");
  };

  const copy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      notify("Copied to clipboard.");
    } catch {
      notify("Could not copy.", "error");
    }
  };

  const runAction = async (fn: () => Promise<EscrowDeal>, successMsg: string, party?: boolean) => {
    setBusy(true);
    try {
      const updated = await fn();
      setDeal(updated);
      notify(successMsg);
      closeDialog();
      if (party) setTimeout(celebrate, 100);
    } catch (e: any) {
      notify(e?.response?.data?.message || "That action could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const myRole = deal?.my_role || deal?.creator_role;
  const isBuyer = myRole === "buyer";
  const isSeller = myRole === "seller";
  const status = deal?.status;

  // ── which actions are available? ─────────────────────────────────────────
  const canCancel = deal?.is_creator && ["draft", "invited", "awaiting_payment"].includes(status || "");
  const canFund = isBuyer && status === "awaiting_payment";
  const canDeliver = isSeller && status === "funded";
  const canRelease = isBuyer && ["funded", "delivered"].includes(status || "");
  const sellerNeedsAddress =
    isSeller && !deal?.seller_payout_address && (deal?.seller_payout_state === "pending" || ["funded", "delivered"].includes(status || ""));
  const buyerNeedsRefund = isBuyer && !deal?.buyer_refund_address && deal?.buyer_payout_state === "pending";

  const hasAnyAction = canCancel || canFund || canDeliver || canRelease || sellerNeedsAddress || buyerNeedsRefund;

  const cardSx = {
    p: 2.2,
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  } as const;

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
        <CircularProgress size={30} sx={{ color: BRAND_ACCENT }} />
      </Box>
    );
  }

  if (notFound || !deal) {
    return (
      <Box sx={{ textAlign: "center", py: 10 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>Deal not found</Typography>
        <Typography sx={{ color: "text.secondary", mb: 2 }}>
          This escrow deal doesn&apos;t exist or you don&apos;t have access to it.
        </Typography>
        <Button onClick={() => router.push("/escrow")} startIcon={<ArrowBackRounded />} sx={{ textTransform: "none" }}>
          Back to escrow
        </Button>
      </Box>
    );
  }

  const b = deal.breakdown;

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto", width: "100%", pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => router.push("/escrow")} data-testid="escrow-back" size="small">
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 800, fontSize: 20, minWidth: 0 }}>{deal.title}</Typography>
            <StatusChip deal={deal} testId="escrow-detail-status" />
            {deal.simulated && <StatusChip tone="neutral" label="Simulated" size="sm" testId="escrow-detail-simulated" />}
          </Box>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            You are the <b>{titleize(myRole)}</b> · deal #{deal.escrow_id}
          </Typography>
        </Box>
      </Box>

      {/* Progress tracker */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={sectionTitleSx}>Progress</Typography>
        <EscrowProgress deal={deal} testId="escrow-detail-progress" />
      </Box>

      <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start" }}>
        {/* Main column */}
        <Stack spacing={2} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {/* Dispute — negotiation / escalation (parties settle first, admin fallback) */}
          {(status === "disputed" || ["funded", "delivered"].includes(status || "")) && (isBuyer || isSeller) && (
            <DisputePanel
              deal={deal}
              myRole={(myRole as "buyer" | "seller") || "seller"}
              onUpdated={(d) => setDeal(d)}
              notify={notify}
              api={{
                raise: (body) => escrowApi.dispute(deal.escrow_id, body),
                counter: (body) => escrowApi.counterDispute(deal.escrow_id, body),
                accept: () => escrowApi.acceptDispute(deal.escrow_id),
                message: (m) => escrowApi.disputeMessage(deal.escrow_id, m),
                escalate: () => escrowApi.escalateDispute(deal.escrow_id),
              }}
            />
          )}

          {/* Money / fee breakdown */}
          <Box sx={cardSx}>
            <Typography sx={sectionTitleSx}>Amounts</Typography>
            <FeeBreakdownCard breakdown={b} currency={deal.currency} totalTestId="escrow-detail-total" />
            {deal.custody_amount_stable != null && (
              <Box sx={{ mt: 1.5, p: 1.4, borderRadius: 2, backgroundColor: brandAlpha(isDark ? 0.12 : 0.06) }}>
                <Typography sx={{ fontSize: 12.5, color: brandFg(isDark), fontWeight: 700 }}>In custody</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, mt: 0.3 }} data-testid="escrow-detail-custody">
                  <CoinIcon code={deal.custody_stablecoin} size={18} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {stable(deal.custody_amount_stable, deal.custody_stablecoin)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.3 }}>
                  Converted on funding{deal.converted_at ? ` · ${shortDate(deal.converted_at)}` : ""} — held stable so the value can&apos;t drift.
                </Typography>
              </Box>
            )}
          </Box>

          {/* Parties */}
          <Box sx={cardSx}>
            <Typography sx={sectionTitleSx}>Parties</Typography>
            <Stack spacing={1}>
              <Row label={`You (${titleize(myRole)})`} value={deal.is_creator ? "Creator" : "Counterparty"} />
              <Row
                label={`Counterparty (${titleize(deal.creator_role === "seller" ? "buyer" : "seller")})`}
                value={deal.counterparty_email}
              />
              <Row label="Counterparty verified email" value={deal.counterparty_verified ? "Yes" : "Not yet"} />
            </Stack>
            {deal.terms && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 600 }}>Terms</Typography>
                <Typography sx={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{deal.terms}</Typography>
              </Box>
            )}
            {deal.delivery_note && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 600 }}>Delivery note</Typography>
                <Typography sx={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{deal.delivery_note}</Typography>
              </Box>
            )}
          </Box>

          {/* Settlement / payout legs */}
          {(deal.outcome || deal.settlement_phase !== "none" || deal.seller_payout_state !== "na" || deal.buyer_payout_state !== "na") && (
            <Box sx={cardSx}>
              <Typography sx={sectionTitleSx}>Settlement</Typography>
              {deal.outcome && (
                <Typography sx={{ fontSize: 13.5, mb: 1 }}>
                  Outcome authorized: <b>{titleize(deal.outcome)}</b>
                  {deal.outcome === "split" && deal.split_percent_seller != null ? ` (seller ${deal.split_percent_seller}%)` : ""}
                  {deal.outcome_authorized_at ? ` · ${shortDate(deal.outcome_authorized_at)}` : ""}
                </Typography>
              )}
              <Stack spacing={1.2}>
                {deal.seller_payout_state && deal.seller_payout_state !== "na" && (
                  <LegRow
                    who="Seller payout"
                    coin={deal.seller_payout_coin || deal.custody_stablecoin}
                    entitlement={stable(deal.seller_entitlement_stable, deal.seller_payout_coin || deal.custody_stablecoin)}
                    state={deal.seller_payout_state}
                    address={deal.seller_payout_address}
                    tx={deal.seller_payout_tx}
                    paidAt={deal.seller_paid_at}
                  />
                )}
                {deal.buyer_payout_state && deal.buyer_payout_state !== "na" && (
                  <LegRow
                    who="Buyer refund"
                    coin={deal.buyer_refund_coin || deal.custody_stablecoin}
                    entitlement={stable(deal.buyer_entitlement_stable, deal.buyer_refund_coin || deal.custody_stablecoin)}
                    state={deal.buyer_payout_state}
                    address={deal.buyer_refund_address}
                    tx={deal.buyer_payout_tx}
                    paidAt={deal.buyer_paid_at}
                  />
                )}
              </Stack>
            </Box>
          )}

          {/* Timeline */}
          {Array.isArray(deal.activity_log) && deal.activity_log.length > 0 && (
            <Box sx={cardSx}>
              <Typography sx={sectionTitleSx}>Timeline</Typography>
              <Stack spacing={1.4} sx={{ position: "relative" }}>
                {deal.activity_log
                  .slice()
                  .reverse()
                  .map((a, i) => (
                    <Box key={i} sx={{ display: "flex", gap: 1.2 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: 999, mt: 0.7, flexShrink: 0, backgroundColor: BRAND_ACCENT }} />
                      <Box>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{a.note || titleize(a.type)}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                          {[a.role ? titleize(a.role) : null, a.actor, a.at ? shortDate(a.at) : null].filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
              </Stack>
            </Box>
          )}
        </Stack>

        {/* Action side panel */}
        <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0, position: { md: "sticky" }, top: { md: 12 } }}>
          <Box sx={cardSx}>
            <Typography sx={sectionTitleSx}>Actions</Typography>

            {/* Share invite link (creator, non-terminal) */}
            {deal.is_creator && ["draft", "invited", "awaiting_payment", "funded", "delivered"].includes(status || "") && (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>Counterparty invite link</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all", flex: 1 }} data-testid="escrow-detail-invite-url">
                    {deal.invite_url}
                  </Typography>
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={() => copy(deal.invite_url)} data-testid="escrow-detail-copy">
                      <ContentCopyRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open">
                    <IconButton size="small" component="a" href={deal.invite_url} target="_blank">
                      <OpenInNewRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Divider sx={{ my: 1.5 }} />
              </Box>
            )}

            <Stack spacing={1.2}>
              {sellerNeedsAddress && (
                <ActionBtn
                  icon={<AccountBalanceWalletRounded />}
                  label="Add payout address"
                  testId="escrow-action-seller-address"
                  onClick={() => {
                    setAddr(deal.seller_payout_address || "");
                    setPayoutCoin(deal.seller_payout_coin || "USDT-TRON");
                    setDialog("seller-address");
                  }}
                  primary
                />
              )}
              {buyerNeedsRefund && (
                <ActionBtn
                  icon={<AccountBalanceWalletRounded />}
                  label="Add refund address"
                  testId="escrow-action-buyer-address"
                  onClick={() => {
                    setAddr(deal.buyer_refund_address || "");
                    setPayoutCoin(deal.buyer_refund_coin || "USDT-TRON");
                    setDialog("buyer-address");
                  }}
                  primary
                />
              )}
              {canFund && <ActionBtn icon={<PaymentsRounded />} label="Fund escrow" testId="escrow-action-fund" onClick={() => setDialog("fund")} primary />}
              {canDeliver && <ActionBtn icon={<LocalShippingRounded />} label="Mark as delivered" testId="escrow-action-deliver" onClick={() => setDialog("deliver")} primary />}
              {canRelease && <ActionBtn icon={<LockOpenRounded />} label="Release funds" testId="escrow-action-release" onClick={() => setDialog("release")} primary />}
              {canCancel && <ActionBtn icon={<CancelRounded />} label="Cancel deal" testId="escrow-action-cancel" onClick={() => setDialog("cancel")} tone="error" />}
              {!hasAnyAction && (
                <Typography sx={{ fontSize: 13, color: "text.secondary" }} data-testid="escrow-no-actions">
                  {status === "disputed"
                    ? "This deal is under dispute — see the dispute panel to respond, counter, or escalate."
                    : "No actions needed from you right now."}
                </Typography>
              )}
            </Stack>

            {/* auto-release hint */}
            {status === "delivered" && deal.auto_release_at && (
              <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 1.5 }}>
                Auto-releases to the seller {relativeDays(deal.auto_release_at)} if the buyer takes no action.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Action dialogs ── */}
      <Dialog open={dialog === "fund"} onClose={busy ? undefined : closeDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Fund the escrow</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
            The buyer pays <b>{money(b.buyerPays, deal.currency)}</b>. In preview this is simulated and converted to a
            stablecoin held in custody — no real crypto moves.
          </Typography>
          <Select fullWidth size="small" value={coin} onChange={(e) => setCoin(e.target.value)} data-testid="escrow-fund-coin" renderValue={(v) => <CoinMenuLabel code={String(v)} prefix="Pay with " />}>
            {FUNDING_COINS.map((c) => (
              <MenuItem key={c} value={c}>
                <CoinMenuLabel code={c} />
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => runAction(() => escrowApi.simulateFund(deal.escrow_id, coin), "Escrow funded (simulated).")}
            data-testid="escrow-fund-confirm"
            sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Funding…" : "Fund now"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "deliver"} onClose={busy ? undefined : closeDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Mark as delivered</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
            Let the buyer know the work/goods are delivered. This starts the auto-release timer.
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label="Delivery note (optional)"
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            inputProps={{ "data-testid": "escrow-deliver-note" }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => runAction(() => escrowApi.deliver(deal.escrow_id, deliveryNote.trim() || undefined), "Marked as delivered.")}
            data-testid="escrow-deliver-confirm"
            sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Saving…" : "Mark delivered"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "release"} onClose={busy ? undefined : closeDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Release funds to the seller</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            This confirms the deal is complete and authorizes payout of{" "}
            <b>{stable(b.sellerReceives, deal.custody_stablecoin || "USDT-TRON")}</b> to the seller. If the seller
            hasn&apos;t added a payout address yet, the payout waits until they do.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => runAction(() => escrowApi.release(deal.escrow_id), "Release authorized.", true)}
            data-testid="escrow-release-confirm"
            sx={{ backgroundColor: "#12B76A", textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Releasing…" : "Release funds"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "cancel"} onClose={busy ? undefined : closeDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel this deal</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
            You can cancel before it&apos;s funded. This can&apos;t be undone.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ "data-testid": "escrow-cancel-reason" }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ textTransform: "none" }}>Keep deal</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => runAction(() => escrowApi.cancel(deal.escrow_id, reason.trim() || undefined), "Deal cancelled.")}
            data-testid="escrow-cancel-confirm"
            sx={{ backgroundColor: "#DC2626", textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Cancelling…" : "Cancel deal"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "seller-address" || dialog === "buyer-address"} onClose={busy ? undefined : closeDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialog === "seller-address" ? "Add your payout address" : "Add your refund address"}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
            {dialog === "seller-address"
              ? "Where should DynoPay send your released funds? Pick a network and paste a stablecoin address you control."
              : "Where should your refund be sent? Pick a network and paste a stablecoin address you control."}
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: 0.6 }}>Payout network</Typography>
          <Select fullWidth size="small" value={payoutCoin} onChange={(e) => setPayoutCoin(e.target.value)} sx={{ mb: 2 }} data-testid="escrow-address-coin" renderValue={(v) => <CoinMenuLabel code={String(v)} network />}>
            {PAYOUT_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                <CoinMenuLabel code={o.key} network />
              </MenuItem>
            ))}
          </Select>
          <TextField
            fullWidth
            size="small"
            label={`${payoutCoin} address`}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            inputProps={{ "data-testid": "escrow-address-input" }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || addr.trim().length < 6}
            onClick={() =>
              runAction(
                () =>
                  escrowApi.payoutInfo(
                    deal.escrow_id,
                    dialog === "seller-address"
                      ? { payout_address: addr.trim(), payout_coin: payoutCoin }
                      : { refund_address: addr.trim(), refund_coin: payoutCoin }
                  ),
                "Address saved.",
                true
              )
            }
            data-testid="escrow-address-confirm"
            sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Saving…" : "Save address"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const sectionTitleSx = { fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "text.secondary", mb: 1.5 } as const;

function CoinMenuLabel({ code, prefix, network }: { code: string; prefix?: string; network?: boolean }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
      <CoinIcon code={code} size={18} />
      <span>
        {prefix}
        {network ? PAYOUT_OPTIONS.find((o) => o.key === code)?.label || code : code}
      </span>
    </Box>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "baseline" }}>
      <Typography sx={{ fontSize: 13, color: bold ? "text.primary" : "text.secondary", fontWeight: bold ? 700 : 400 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: bold ? 700 : 500, textAlign: "right" }}>{value}</Typography>
    </Box>
  );
}

function LegRow({
  who,
  coin,
  entitlement,
  state,
  address,
  tx,
  paidAt,
}: {
  who: string;
  coin?: string | null;
  entitlement: string;
  state: string;
  address?: string | null;
  tx?: string | null;
  paidAt?: string | null;
}) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{who}</Typography>
        <StatusChip tone={legTone(state)} label={titleize(state)} size="sm" />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.2 }}>
        <CoinIcon code={coin} size={16} />
        <Typography sx={{ fontSize: 13 }}>{entitlement}</Typography>
      </Box>
      {address && <Typography sx={{ fontSize: 11.5, color: "text.secondary", wordBreak: "break-all" }}>To {address}</Typography>}
      {tx && <Typography sx={{ fontSize: 11.5, color: "text.secondary", wordBreak: "break-all" }}>Tx {tx}{paidAt ? ` · ${shortDate(paidAt)}` : ""}</Typography>}
    </Box>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  testId,
  primary,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
  primary?: boolean;
  tone?: "warning" | "error";
}) {
  const color = tone === "error" ? "#DC2626" : tone === "warning" ? "#B45309" : BRAND_ACCENT;
  return (
    <Button
      fullWidth
      variant={primary ? "contained" : "outlined"}
      startIcon={icon}
      onClick={onClick}
      data-testid={testId}
      sx={{
        justifyContent: "flex-start",
        textTransform: "none",
        fontWeight: 600,
        ...(primary
          ? { backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }
          : { color, borderColor: color, "&:hover": { borderColor: color, backgroundColor: `${color}12` } }),
      }}
    >
      {label}
    </Button>
  );
}
