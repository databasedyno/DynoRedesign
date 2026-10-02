import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  GavelRounded,
  CheckCircleRounded,
  SwapHorizRounded,
  SupportAgentRounded,
  SendRounded,
  CancelRounded,
} from "@mui/icons-material";
import { DisputeProposalInput, EscrowDeal, SettlementOutcome } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha, brandFg } from "@/constants/theme";
import { money, shortDate } from "./escrowUtils";

/** Injected so the same UI drives the merchant (Bearer) and public (OTP) APIs. */
export interface DisputeActionsApi {
  raise: (body: DisputeProposalInput) => Promise<EscrowDeal>;
  counter: (body: DisputeProposalInput) => Promise<EscrowDeal>;
  accept: () => Promise<EscrowDeal>;
  message: (msg: string) => Promise<EscrowDeal>;
  escalate: () => Promise<EscrowDeal>;
}

interface Props {
  deal: EscrowDeal;
  myRole: "buyer" | "seller";
  api: DisputeActionsApi;
  onUpdated: (deal: EscrowDeal) => void;
  notify: (msg: string, severity?: "success" | "error") => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function describeProposal(outcome: SettlementOutcome, sellerPct: number, kind?: string | null): string {
  if (kind === "cancellation") return "Cancel the deal — refund the buyer (fees & costs kept)";
  if (outcome === "release") return "Release everything to the seller";
  if (outcome === "refund") return "Refund everything to the buyer";
  return `Partial — seller keeps ${sellerPct}%, buyer refunded ${100 - sellerPct}%`;
}

export default function DisputePanel({ deal, myRole, api, onUpdated, notify }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "raise" | "counter" | "cancel">(null);
  const [outcome, setOutcome] = useState<SettlementOutcome>(myRole === "buyer" ? "refund" : "release");
  const [sellerPct, setSellerPct] = useState(50);
  const [proposalMsg, setProposalMsg] = useState("");
  const [reason, setReason] = useState("");
  const [threadMsg, setThreadMsg] = useState("");

  const status = deal.status;
  const isDisputed = status === "disputed";
  const stage = deal.dispute_stage || (isDisputed ? "negotiation" : null);
  const canRaise = !isDisputed && ["funded", "delivered"].includes(status || "");

  // The net pool that gets distributed (platform keeps all fees/costs on every outcome).
  const pool = Number(deal.breakdown?.sellerReceives ?? deal.amount ?? 0);
  const totalCost = Number(deal.breakdown?.totalCost ?? 0);
  const proposalAmounts = (o: SettlementOutcome, pct: number) => {
    if (o === "release") return { seller: pool, buyer: 0 };
    if (o === "refund") return { seller: 0, buyer: pool };
    const s = round2((pool * pct) / 100);
    return { seller: s, buyer: round2(pool - s) };
  };

  const prop = deal.dispute_proposal || null;
  const iProposed = !!prop && deal.dispute_proposal_by === myRole;
  const myTurn = stage === "negotiation" && !!prop && !iProposed;
  // A post-funding cancel request runs through this same engine — label it honestly.
  const openedAsCancellation = (deal.dispute_thread || []).some((t) => t.type === "open" && t.kind === "cancellation");
  const liveIsCancellation = !!prop && prop.kind === "cancellation";
  const panelTitle = openedAsCancellation ? "Cancellation request" : "Dispute";

  const cardSx = {
    p: 2.2,
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  } as const;

  const run = async (fn: () => Promise<EscrowDeal>, successMsg: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      onUpdated(updated);
      notify(successMsg);
      setDialog(null);
      setProposalMsg("");
      setReason("");
    } catch (e: any) {
      notify(e?.response?.data?.message || "That action could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitProposal = () => {
    if (dialog === "cancel") {
      const body: DisputeProposalInput = { proposed_outcome: "refund", kind: "cancellation", ...(proposalMsg.trim() ? { message: proposalMsg.trim() } : {}) };
      run(() => api.raise(body), "Cancellation requested — waiting for the other party to agree.");
      return;
    }
    const body: DisputeProposalInput = {
      proposed_outcome: outcome,
      ...(outcome === "split" ? { split_percent_seller: sellerPct } : {}),
      ...(proposalMsg.trim() ? { message: proposalMsg.trim() } : {}),
    };
    if (dialog === "raise") {
      if (reason.trim()) body.reason = reason.trim();
      run(() => api.raise(body), "Dispute opened — your proposal was sent.");
    } else {
      run(() => api.counter(body), "Counter-offer sent.");
    }
  };

  const sendThreadMsg = () => {
    const m = threadMsg.trim();
    if (!m) return;
    setThreadMsg("");
    run(() => api.message(m), "Message added.");
  };

  // ── Not disputed: a compact "open a dispute" entry (funded/delivered only) ──
  if (!isDisputed) {
    if (!canRaise) return null;
    return (
      <>
        <Box sx={cardSx} data-testid="escrow-dispute-panel">
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Something wrong with this deal?</Typography>
              <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                Open a dispute with a proposed resolution, or ask to cancel. You and the other party can agree directly — an admin only steps in if you can&apos;t.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Button
                variant="text"
                size="small"
                startIcon={<CancelRounded />}
                onClick={() => setDialog("cancel")}
                data-testid="escrow-cancel-request-btn"
                sx={{ textTransform: "none", fontWeight: 700, color: "text.secondary" }}
              >
                Request cancellation
              </Button>
              <Button
                variant="outlined"
                startIcon={<GavelRounded />}
                onClick={() => setDialog("raise")}
                data-testid="escrow-dispute-open-btn"
                sx={{ textTransform: "none", fontWeight: 700, borderColor: theme.palette.warning.main, color: theme.palette.warning.main }}
              >
                Open dispute
              </Button>
            </Stack>
          </Stack>
        </Box>
        {renderProposalDialog()}
        {renderCancelDialog()}
      </>
    );
  }

  // ── Disputed: negotiation / escalated card ─────────────────────────────────
  const escalated = stage === "escalated";
  const amounts = prop ? proposalAmounts(prop.outcome, Number(prop.split_percent_seller ?? 50)) : null;

  return (
    <>
      <Box sx={cardSx} data-testid="escrow-dispute-panel" data-kind={openedAsCancellation ? "cancellation" : "dispute"}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
          {openedAsCancellation ? <CancelRounded sx={{ color: theme.palette.warning.main }} /> : <GavelRounded sx={{ color: theme.palette.warning.main }} />}
          <Typography sx={{ fontSize: 15, fontWeight: 800 }} data-testid="escrow-dispute-title">{panelTitle}</Typography>
          <Chip
            size="small"
            label={escalated ? "With admin" : openedAsCancellation && liveIsCancellation ? "Awaiting agreement" : "In negotiation"}
            data-testid="escrow-dispute-stage"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              color: escalated ? theme.palette.error.main : theme.palette.warning.main,
              backgroundColor: (escalated ? theme.palette.error.main : theme.palette.warning.main) + "22",
            }}
          />
        </Stack>

        {escalated ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }} data-testid="escrow-dispute-escalated-note">
            A Dynopay admin is reviewing this {openedAsCancellation ? "cancellation request" : "dispute"} and will decide the outcome. You can still add messages or evidence below.
          </Typography>
        ) : prop ? (
          <Box
            sx={{ p: 1.6, borderRadius: 2, mb: 1.5, backgroundColor: brandAlpha(isDark ? 0.1 : 0.05), border: `1px solid ${theme.palette.divider}` }}
            data-testid="escrow-dispute-current-proposal"
          >
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: brandFg(isDark) }}>
              {iProposed
                ? liveIsCancellation ? "Your cancellation request — awaiting their agreement" : "Your proposal — awaiting their response"
                : liveIsCancellation ? `${prop.by || "other"} asked to cancel — your agreement needed` : `${(prop.by || "other")} proposed — your response needed`}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mt: 0.4 }}>{describeProposal(prop.outcome, Number(prop.split_percent_seller ?? 50), prop.kind)}</Typography>
            {amounts && (
              <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.3 }}>
                Seller gets <b>{money(amounts.seller, deal.currency)}</b> · Buyer refunded <b>{money(amounts.buyer, deal.currency)}</b>
                <br />
                <span style={{ fontSize: 11 }}>Fees are non-refundable and already deducted — figures are from the {money(pool, deal.currency)} net pool.</span>
              </Typography>
            )}
          </Box>
        ) : null}

        {/* Negotiation actions */}
        {!escalated && (
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              disabled={busy || !myTurn}
              startIcon={<CheckCircleRounded />}
              onClick={() => run(() => api.accept(), liveIsCancellation ? "Cancellation agreed — the buyer is being refunded." : "Proposal accepted — resolved by agreement.")}
              data-testid="escrow-dispute-accept-btn"
              sx={{ textTransform: "none", fontWeight: 700, backgroundColor: theme.palette.success.main, "&:hover": { backgroundColor: theme.palette.success.dark } }}
            >
              {liveIsCancellation ? "Agree to cancel" : "Accept"}
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={busy || !myTurn}
              startIcon={<SwapHorizRounded />}
              onClick={() => {
                if (prop) {
                  setOutcome(prop.outcome);
                  setSellerPct(Number(prop.split_percent_seller ?? 50));
                }
                setDialog("counter");
              }}
              data-testid="escrow-dispute-counter-btn"
              sx={{ textTransform: "none", fontWeight: 700, borderColor: BRAND_ACCENT, color: brandFg(isDark) }}
            >
              Counter-offer
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              startIcon={<SupportAgentRounded />}
              onClick={() => run(() => api.escalate(), "Escalated to a Dynopay admin.")}
              data-testid="escrow-dispute-escalate-btn"
              sx={{ textTransform: "none", fontWeight: 700, borderColor: theme.palette.error.main, color: theme.palette.error.main }}
            >
              Escalate to admin
            </Button>
          </Stack>
        )}
        {!escalated && !myTurn && prop && (
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }} data-testid="escrow-dispute-waiting">
            {liveIsCancellation
              ? "Waiting for the other party to agree to cancel. If they agree, the buyer is refunded minus fees & costs. You can add a message or escalate to an admin."
              : "Waiting for the other party to respond to your proposal. You can counter once they do, add a message, or escalate to an admin."}
          </Typography>
        )}

        {/* Thread */}
        <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary", mb: 0.8 }}>
          Messages &amp; offers
        </Typography>
        <Stack spacing={1} sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }} data-testid="escrow-dispute-thread">
          {(deal.dispute_thread || []).length === 0 && (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>No messages yet.</Typography>
          )}
          {(deal.dispute_thread || []).map((t, i) => {
            const mine = t.by === myRole;
            const system = t.by === "system" || t.by === "admin";
            const label =
              t.type === "open"
                ? t.kind === "cancellation"
                  ? "asked to cancel the deal — refund the buyer minus fees & costs"
                  : `opened a dispute — ${describeProposal(t.outcome as SettlementOutcome, Number(t.split_percent_seller ?? 50))}`
                : t.type === "counter"
                ? `countered — ${describeProposal(t.outcome as SettlementOutcome, Number(t.split_percent_seller ?? 50))}`
                : t.type === "accept"
                ? t.kind === "cancellation" ? "agreed to cancel the deal" : "accepted the proposal"
                : t.type === "escalate"
                ? "escalated to a Dynopay admin"
                : t.type === "auto_escalate"
                ? "auto-escalated to a Dynopay admin (no response in time)"
                : t.type === "resolve"
                ? `resolved this dispute — ${t.outcome}`
                : null;
            return (
              <Box
                key={i}
                sx={{
                  alignSelf: system ? "center" : mine ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  px: 1.4,
                  py: 0.9,
                  borderRadius: 2,
                  backgroundColor: system
                    ? theme.palette.action.hover
                    : mine
                    ? brandAlpha(isDark ? 0.16 : 0.09)
                    : theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "capitalize" }}>
                  {t.by || "system"} {t.at ? `· ${shortDate(t.at)}` : ""}
                </Typography>
                {label && <Typography sx={{ fontSize: 12.5, fontStyle: "italic", color: "text.secondary" }}>{label}</Typography>}
                {t.reason && <Typography sx={{ fontSize: 13 }}>Reason: {t.reason}</Typography>}
                {t.message && <Typography sx={{ fontSize: 13 }}>{t.message}</Typography>}
              </Box>
            );
          })}
        </Stack>

        {/* Composer */}
        {stage !== "resolved" && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add a message or evidence…"
              value={threadMsg}
              onChange={(e) => setThreadMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendThreadMsg();
                }
              }}
              inputProps={{ "data-testid": "escrow-dispute-thread-msg-input", maxLength: 2000 }}
            />
            <Button
              variant="contained"
              disabled={busy || !threadMsg.trim()}
              onClick={sendThreadMsg}
              data-testid="escrow-dispute-thread-send"
              sx={{ minWidth: 0, px: 1.6, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#F0C300" } }}
            >
              <SendRounded fontSize="small" />
            </Button>
          </Stack>
        )}
      </Box>
      {renderProposalDialog()}
      {renderCancelDialog()}
    </>
  );

  function renderCancelDialog() {
    const refund = proposalAmounts("refund", 0).buyer;
    return (
      <Dialog open={dialog === "cancel"} onClose={busy ? undefined : () => setDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Request to cancel this deal</DialogTitle>
        <DialogContent data-testid="escrow-cancel-request-dialog">
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
            The escrow is already funded, so cancelling needs the other party&apos;s agreement. They can agree, make a counter-offer, or escalate to a Dynopay admin.
          </Typography>
          <Box sx={{ p: 1.3, borderRadius: 2, mb: 1.5, backgroundColor: theme.palette.action.hover }} data-testid="escrow-cancel-request-summary">
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
              If they agree, the buyer is refunded <b>{money(refund, deal.currency)}</b>. The escrow fee &amp; network/exchange costs
              {totalCost > 0 ? <> (<b>{money(totalCost, deal.currency)}</b>)</> : null} are non-refundable.
            </Typography>
          </Box>
          <TextField
            label="Why do you want to cancel? (optional)"
            value={proposalMsg}
            onChange={(e) => setProposalMsg(e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={2}
            inputProps={{ "data-testid": "escrow-cancel-request-message", maxLength: 2000 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} disabled={busy} sx={{ textTransform: "none" }}>
            Keep deal
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={submitProposal}
            data-testid="escrow-cancel-request-submit"
            sx={{ textTransform: "none", fontWeight: 700, backgroundColor: theme.palette.error.main, "&:hover": { backgroundColor: theme.palette.error.dark } }}
          >
            {busy ? "Sending…" : "Request cancellation"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  function renderProposalDialog() {
    const amt = proposalAmounts(outcome, sellerPct);
    return (
      <Dialog open={dialog === "raise" || dialog === "counter"} onClose={busy ? undefined : () => setDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{dialog === "raise" ? "Open a dispute" : "Make a counter-offer"}</DialogTitle>
        <DialogContent data-testid="escrow-dispute-proposal-dialog">
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
            Propose how the held funds should be settled. The other party can accept, counter, or escalate to a Dynopay admin.
          </Typography>

          <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.6 }}>Proposed resolution</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            {(["release", "refund", "split"] as SettlementOutcome[]).map((o) => (
              <Box
                key={o}
                role="button"
                onClick={() => setOutcome(o)}
                data-testid={`escrow-dispute-outcome-${o}`}
                data-selected={outcome === o ? "true" : "false"}
                sx={{
                  flex: 1,
                  textAlign: "center",
                  py: 0.9,
                  px: 0.5,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: `1.5px solid ${outcome === o ? BRAND_ACCENT : theme.palette.divider}`,
                  color: outcome === o ? brandFg(isDark) : theme.palette.text.secondary,
                  backgroundColor: outcome === o ? brandAlpha(isDark ? 0.14 : 0.07) : "transparent",
                }}
              >
                {o === "release" ? "Release" : o === "refund" ? "Refund" : "Partial"}
              </Box>
            ))}
          </Stack>

          {outcome === "split" && (
            <Box sx={{ mb: 1.5, px: 0.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.4 }}>
                Seller keeps {sellerPct}% · Buyer refunded {100 - sellerPct}%
              </Typography>
              <Slider
                value={sellerPct}
                onChange={(_, v) => setSellerPct(v as number)}
                step={5}
                marks
                min={0}
                max={100}
                valueLabelDisplay="auto"
                data-testid="escrow-dispute-split-slider"
                sx={{ color: BRAND_ACCENT }}
              />
            </Box>
          )}

          <Box sx={{ p: 1.3, borderRadius: 2, mb: 1.5, backgroundColor: theme.palette.action.hover }}>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
              This settles the <b>{money(pool, deal.currency)}</b> net pool: seller <b>{money(amt.seller, deal.currency)}</b>, buyer{" "}
              <b>{money(amt.buyer, deal.currency)}</b>. Escrow fee &amp; network/exchange costs are non-refundable.
            </Typography>
          </Box>

          {dialog === "raise" && (
            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 1.2 }}
              inputProps={{ "data-testid": "escrow-dispute-reason-input" }}
            />
          )}
          <TextField
            label="Message to the other party (optional)"
            value={proposalMsg}
            onChange={(e) => setProposalMsg(e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={2}
            inputProps={{ "data-testid": "escrow-dispute-message-input", maxLength: 2000 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} disabled={busy} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={submitProposal}
            data-testid="escrow-dispute-submit"
            sx={{ textTransform: "none", fontWeight: 700, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#F0C300" } }}
          >
            {busy ? "Sending…" : dialog === "raise" ? "Open dispute" : "Send counter-offer"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}
