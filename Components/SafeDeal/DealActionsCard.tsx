import React from "react";
import Link from "next/link";
import { Alert, Box, Button, Divider, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";
import { prettyParty } from "@/api/safedeal";
import type { SdDeal, SdDealAction } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { absTime, relTime } from "./sdFormat";
import FundPanel from "./FundPanel";
import { ghostBtn, primaryBtn } from "./sdStyles";
import { explorerTxUrl, shortHash } from "@/helpers/explorerUrl";

export { ghostBtn, primaryBtn };
export type DealDialog = "decline" | "cancel" | "deliver" | "release" | "changes" | "amend";

interface Props {
  deal: SdDeal;
  busy: string | null;
  live: boolean;
  now: number;
  walletHref: string;
  newDealHref: string;
  act: (a: SdDealAction, extra?: Record<string, unknown>) => void;
  openDialog: (d: DealDialog) => void;
  copyInvite: () => void;
  reload: () => void;
  notify: (m: string, s?: "success" | "error") => void;
}

/** The status-driven "what you can do now" card. */
export default function DealActionsCard({ deal, busy, live, now, walletHref, newDealHref, act, openDialog, copyInvite, reload, notify }: Props) {
  const me = deal.my_role as "buyer" | "seller";
  const isBuyer = me === "buyer";
  const other = isBuyer ? deal.seller_email : deal.buyer_email;
  const b = deal.breakdown;
  const status = deal.status;
  const preFunding = ["invited", "awaiting_payment"].includes(status);
  const settled = ["completed", "refunded", "split"].includes(status);
  const round = Number(deal.revision_round || 0);
  const maxRounds = Number(deal.max_revision_rounds || 2);
  const canRequestChanges = status === "delivered" && isBuyer && round < maxRounds;
  const resendWait = deal.invite_resent_at ? 10 * 60000 - (now - new Date(deal.invite_resent_at).getTime()) : 0;

  return (
    <>
      {status === "invited" && !deal.is_creator && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>{other} invited you as the {me}</Typography>
          {deal.amended_at && <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }} data-testid="sd-amended-notice">The creator updated the terms {relTime(deal.amended_at, now)} — please review them again before accepting.</Alert>}
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>
            {isBuyer ? `If you accept, you'll be asked to fund ${money(b.buyerPays, deal.currency)} into escrow.` : `If you accept, the buyer funds ${money(b.buyerPays, deal.currency)} and you receive ${money(b.sellerReceives, deal.currency)} once the deal completes.`}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!!busy} onClick={() => act("accept")} data-testid="sd-act-accept" sx={primaryBtn} startIcon={<Icon icon="mdi:check" />}>Accept deal</Button>
            <Button variant="outlined" disabled={!!busy} onClick={() => openDialog("decline")} data-testid="sd-act-decline-open" sx={ghostBtn}>Decline</Button>
          </Stack>
        </>
      )}
      {status === "invited" && deal.is_creator && (
        deal.invite_kind === "link" ? (
          deal.counterparty_claimed_at ? (
            <>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }} data-testid="sd-link-joined">{prettyParty(other)} joined — waiting for them to accept</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>Someone joined this deal from your link. They accept the terms next — nothing is charged until the buyer funds the escrow.</Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Share this link to invite the {isBuyer ? "seller" : "buyer"}</Typography>
              <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>Send it over Telegram, WhatsApp or anywhere. The first person who opens it and signs in joins as the {isBuyer ? "seller" : "buyer"} — you&apos;ll see them here before any money moves.</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <TextField size="small" value={deal.invite_url || ""} fullWidth InputProps={{ readOnly: true }} inputProps={{ "data-testid": "sd-invite-link" }} />
                <Button variant="outlined" onClick={copyInvite} data-testid="sd-copy-invite" sx={{ ...ghostBtn, flexShrink: 0 }} startIcon={<Icon icon="mdi:content-copy" />}>Copy</Button>
                <Tooltip title="Create a fresh link — the current one stops working immediately">
                  <span>
                    <Button variant="outlined" disabled={!!busy} onClick={() => act("regenerate-link")} data-testid="sd-regenerate-link" sx={{ ...ghostBtn, flexShrink: 0, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:refresh" />}>New link</Button>
                  </span>
                </Tooltip>
              </Stack>
            </>
          )
        ) : (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Waiting for {other} to accept</Typography>
            <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>We emailed them an invite. You can also send them this link directly:</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <TextField size="small" value={deal.invite_url || ""} fullWidth InputProps={{ readOnly: true }} inputProps={{ "data-testid": "sd-invite-link" }} />
              <Button variant="outlined" onClick={copyInvite} data-testid="sd-copy-invite" sx={{ ...ghostBtn, flexShrink: 0 }} startIcon={<Icon icon="mdi:content-copy" />}>Copy</Button>
              <Tooltip title={resendWait > 0 ? `You can resend again in ${Math.ceil(resendWait / 60000)} min` : "Send the invite email again"}>
                <span>
                  <Button variant="outlined" disabled={!!busy || resendWait > 0} onClick={() => act("resend-invite")} data-testid="sd-resend-invite" sx={{ ...ghostBtn, flexShrink: 0, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:email-sync-outline" />}>Resend email</Button>
                </span>
              </Tooltip>
            </Stack>
          </>
        )
      )}
      {status === "awaiting_payment" && isBuyer && (
        <Box id="sd-fund" data-testid="sd-fund-section">
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Fund the escrow — {money(b.buyerPays, deal.currency)}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.8 }}>
            {deal.price_currency && deal.price_currency !== "USD" ? `The ${deal.price_currency} price converts to USD at the live rate the moment you pay. ` : ""}Your payment is held securely in escrow as USDT until you release it (or the inspection timer runs out after delivery). Nothing reaches the seller before that.
          </Typography>
          <Box sx={{ mb: 1.8, p: 1.4, borderRadius: 2.5, border: "1px solid #E5E7EB", backgroundColor: "#F9FAFB", display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }} data-testid="sd-fund-balance-box">
            <Icon icon="mdi:wallet-outline" width={22} color={SD_ACCENT} />
            <Typography sx={{ fontSize: 13, color: "#374151", flex: 1, minWidth: 160 }}>
              SafeDeal balance: <b>{money(deal.buyer_balance?.available || 0)}</b>
              {(deal.buyer_balance?.available || 0) < b.buyerPays ? <> — not enough for this deal. <Link href={walletHref} style={{ color: SD_ACCENT, fontWeight: 700 }} data-testid="sd-fund-topup-link">Top up your balance</Link> to pay in one tap (stablecoin top-ups carry no exchange fee).</> : ""}
            </Typography>
            <Button size="small" variant="contained" disabled={!!busy || (deal.buyer_balance?.available || 0) < b.buyerPays} onClick={() => act("fund-balance")} data-testid="sd-act-fund-balance" sx={primaryBtn}>Pay from balance</Button>
          </Box>
          <FundPanel deal={deal} live={live} busy={busy} now={now} notify={notify} onFunded={reload} onSimulate={(coin) => act("fund", { coin })} />
        </Box>
      )}
      {status === "awaiting_payment" && !isBuyer && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Accepted — waiting for the buyer to fund</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Don&apos;t start work until the deal shows <b>Funded</b>. We&apos;ll email you the moment it does.</Typography>
        </>
      )}
      {status === "funded" && !isBuyer && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>{round > 0 ? "The buyer asked for changes" : `Funded — ${money(deal.custody_amount_stable ?? b.buyerPays, deal.currency)} is held in escrow`}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>
            {round > 0 ? "Update the delivery to match what they asked for, then mark it delivered again. The money stays held." : `Deliver the work, then mark it delivered with proof. The buyer then has a ${deal.auto_release_days}-day inspection period before funds release automatically.`}
          </Typography>
          <Button variant="contained" disabled={!!busy} onClick={() => openDialog("deliver")} data-testid="sd-act-deliver-open" sx={primaryBtn} startIcon={<Icon icon="mdi:package-variant-closed-check" />}>{round > 0 ? "Deliver the changes" : "Mark as delivered"}</Button>
        </>
      )}
      {status === "funded" && isBuyer && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>{round > 0 ? "Waiting for the seller to make your changes" : "Funded — waiting for the seller to deliver"}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>Already received what you paid for? You can release early.</Typography>
          <Button variant="outlined" disabled={!!busy} onClick={() => openDialog("release")} data-testid="sd-act-release-open" sx={ghostBtn} startIcon={<Icon icon="mdi:cash-check" />}>Release funds early</Button>
        </>
      )}
      {status === "delivered" && isBuyer && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Delivered — confirm to release {money(b.sellerReceives, deal.currency)} to the seller</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 2 }}>
            Your inspection period ends <b>{relTime(deal.auto_release_at, now)}</b> ({absTime(deal.auto_release_at)}). If you do nothing, the funds release then. Not quite right? Ask for changes first — a dispute is the last resort.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" disabled={!!busy} onClick={() => openDialog("release")} data-testid="sd-act-release-open" sx={primaryBtn} startIcon={<Icon icon="mdi:cash-check" />}>Confirm &amp; release</Button>
            <Tooltip title={canRequestChanges ? `Round ${round + 1} of ${maxRounds}` : `You've used all ${maxRounds} rounds of changes`}>
              <span>
                <Button variant="outlined" disabled={!!busy || !canRequestChanges} onClick={() => openDialog("changes")} data-testid="sd-act-changes-open" sx={ghostBtn} startIcon={<Icon icon="mdi:undo-variant" />}>Request changes</Button>
              </span>
            </Tooltip>
          </Stack>
        </>
      )}
      {status === "delivered" && !isBuyer && (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Delivered — waiting for the buyer</Typography>
          <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Funds release automatically <b>{relTime(deal.auto_release_at, now)}</b> ({absTime(deal.auto_release_at)}) unless the buyer confirms sooner, asks for changes or raises an issue.</Typography>
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
          {(isBuyer ? (deal.buyer_entitlement_stable || 0) > 0 : (deal.seller_entitlement_stable || 0) > 0) && (() => {
            const amount = isBuyer ? deal.buyer_entitlement_stable : deal.seller_entitlement_stable;
            const tx = isBuyer ? deal.buyer_payout_tx : deal.seller_payout_tx;
            const sent = !!tx && !String(tx).startsWith("WALLET-CREDIT");
            // Exchange/internal refs (BINANCE-…, WITHDRAWAL-…, SIMULATED-…) are not blockchain hashes;
            // the real hash is backfilled a few minutes after dispatch.
            const chainHash = tx && !/^(SIMULATED-|BINANCE-|WALLET-CREDIT|WITHDRAWAL-)/i.test(String(tx)) ? String(tx) : null;
            const dest = deal.my_payout_pref?.address;
            return (
              <Alert severity="success" icon={<Icon icon={sent ? "mdi:bank-transfer-out" : "mdi:wallet-plus-outline"} />} data-testid="sd-settled-credit" data-mode={sent ? "sent" : "balance"}>
                {sent ? (
                  <><b>{money(amount, deal.currency)}</b> {isBuyer ? "refund" : "payout"} sent to {dest ? `${dest.payout_key} ${dest.address.slice(0, 6)}…${dest.address.slice(-4)}` : "your payout address"} — network fee covered by the deal.{" "}
                    {chainHash ? (
                      <a href={explorerTxUrl((dest?.payout_key || "USDT-TRON").replace(/-TRON$/i, "-TRC20"), chainHash)} target="_blank" rel="noopener noreferrer" data-testid="sd-settled-tx-link" style={{ fontWeight: 800, color: SD_ACCENT, fontFamily: "monospace" }}>tx {shortHash(chainHash, 8, 6)} ↗</a>
                    ) : (
                      <span data-testid="sd-settled-tx-pending" style={{ color: "#6B7280" }}>Blockchain transaction follows by email in a few minutes.</span>
                    )}{" "}</>
                ) : (
                  <><b>{money(amount, deal.currency)}</b> is in your SafeDeal balance{deal.my_addresses?.length ? " and goes out automatically to your payout address" : " — add a payout address and it's sent automatically"}.{" "}</>
                )}
                <Link href={walletHref} style={{ fontWeight: 800, color: SD_ACCENT }} data-testid="sd-settled-wallet-link">Open wallet →</Link>
              </Alert>
            );
          })()}
        </>
      )}
      {["cancelled", "declined", "expired"].includes(status) && (
        <Typography sx={{ fontSize: 13.5, color: "#4B5563" }} data-testid="sd-terminal-note">
          This deal was {status}. Nothing was charged. <Link href={newDealHref} style={{ color: SD_ACCENT, fontWeight: 700 }}>Start a new deal</Link>
        </Typography>
      )}

      {preFunding && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontSize: 12.5, color: "#6B7280" }}>{deal.is_creator ? "Need to tweak something? Changing terms is free before funding." : "Changed your mind? Cancelling before funding is free."}</Typography>
            <Stack direction="row" spacing={0.5}>
              {deal.is_creator && <Button size="small" disabled={!!busy} onClick={() => openDialog("amend")} data-testid="sd-act-amend-open" sx={{ ...ghostBtn, color: SD_ACCENT }} startIcon={<Icon icon="mdi:pencil-outline" />}>Change terms</Button>}
              <Button size="small" color="inherit" disabled={!!busy} onClick={() => openDialog("cancel")} data-testid="sd-act-cancel-open" sx={{ ...ghostBtn, color: "#6B7280" }} startIcon={<Icon icon="mdi:cancel" />}>Cancel deal</Button>
            </Stack>
          </Stack>
        </>
      )}
    </>
  );
}
