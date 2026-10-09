import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_GOLD, SD_INK } from "./sdTheme";
import type { SdFeePreview } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "./sdFormat";
import { SD_INK_MUTED } from "./SafeDealShell";
import { dealTypeMeta, fiatMoney } from "./sdDealTypes";

export interface NewDealDraft {
  title: string;
  amount: number;
  currency: string;
  role: "buyer" | "seller";
  email: string;
  inviteByLink?: boolean;
  feePayer: "buyer" | "seller" | "split";
  days: number;
  dealType: string | null;
  due: string;
  terms: string;
}

/** Step 3 — everything the other party will see, before the invite goes out. */
export function NewDealReview({ d, preview, minDeal }: { d: NewDealDraft; preview: SdFeePreview | null; minDeal: number }) {
  const t = dealTypeMeta(d.dealType);
  const fiat = d.currency !== "USD";
  const otherRole = d.role === "seller" ? "buyer" : "seller";
  return (
    <Stack spacing={1.2} data-testid="sd-new-review">
      <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>
        {d.inviteByLink
          ? <>Check the details — you&apos;ll get a <b>shareable link</b> to send the <b>{otherRole}</b>. The first person who opens it and signs in joins the deal.</>
          : <>Check the details — <b>{d.email}</b> will get an email invite to accept these terms as the <b>{otherRole}</b>.</>}
      </Typography>
      <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }} data-testid="sd-review-title">{d.title}</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 900, mt: 0.3, ...TABULAR }} data-testid="sd-review-amount">
          {fiatMoney(d.amount, d.currency)}
          {fiat && preview?.price && <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "#6B7280", ml: 1 }}>≈ {money(preview.price.usd)} today</Typography>}
        </Typography>
        <Divider sx={{ my: 1.2 }} />
        <Fact icon={t?.icon || "mdi:handshake-outline"} label="Deal type" value={t?.label || "Not specified"} testid="sd-review-type" />
        <Fact icon="mdi:account-arrow-right-outline" label="You are the" value={d.role} testid="sd-review-role" />
        <Fact icon="mdi:email-outline" label={d.role === "seller" ? "Buyer" : "Seller"} value={d.inviteByLink ? "Shareable link (anyone with the link)" : d.email} testid="sd-review-email" />
        <Fact icon="mdi:percent-outline" label="Escrow fee paid by" value={d.feePayer === "split" ? "Split 50/50" : d.feePayer} testid="sd-review-fee" />
        <Fact icon="mdi:timer-sand" label="Inspection period" value={`${d.days} days after delivery`} testid="sd-review-days" />
        <Fact icon="mdi:calendar-clock" label="Delivery due" value={d.due ? new Date(d.due).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "No fixed date"} testid="sd-review-due" />
        {d.terms.trim() && (
          <Box sx={{ mt: 1.2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6 }}>Terms</Typography>
            <Typography sx={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", mt: 0.4 }} data-testid="sd-review-terms">{d.terms.trim()}</Typography>
          </Box>
        )}
      </Box>
      {fiat && (
        <Typography sx={{ fontSize: 12.5, color: "#6B7280" }} data-testid="sd-review-fiat-note">
          <Icon icon="mdi:information-outline" width={14} style={{ verticalAlign: -2 }} /> Priced in {d.currency}. The USD amount is locked at the live rate when the buyer funds; the buyer pays the USD/USDT equivalent and fees are calculated on it.
        </Typography>
      )}
      {!preview && d.amount < minDeal && <Typography sx={{ fontSize: 12.5, color: "#B91C1C" }}>Minimum deal is ${minDeal}.</Typography>}
    </Stack>
  );
}

function Fact({ icon, label, value, testid }: { icon: string; label: string; value: string; testid: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.35 }} data-testid={testid}>
      <Icon icon={icon} width={16} color="#9CA3AF" />
      <Typography sx={{ fontSize: 13, color: "#6B7280", minWidth: 140 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, textTransform: label === "You are the" ? "capitalize" : undefined, wordBreak: "break-word" }}>{value}</Typography>
    </Stack>
  );
}

/** Itemised live quote (dark panel + mobile bar), tailored to the viewer's role.
 *  `showFees=false` renders a limited quote (deal amount + hint) for the early step,
 *  before the buyer/seller/split fee-payer choice is made. */
/** Loyalty rate + fee credit (applied when the deal is released) for the signed-in creator. */
function RewardsQuoteNote({ preview }: { preview: SdFeePreview }) {
  const credit = preview.feeCreditPreviewUsd || 0;
  const loyal = !!preview.feeLevel && preview.standardFeePercent != null && preview.feePercent < preview.standardFeePercent;
  if (!credit && !loyal) return null;
  return (
    <Stack spacing={0.4} data-testid="sd-quote-rewards" sx={{ p: 1, borderRadius: 2, border: `1px dashed ${SD_GOLD}`, backgroundColor: "rgba(255,198,26,0.08)" }}>
      {loyal && <Typography sx={{ fontSize: 12, color: "#fff" }} data-testid="sd-quote-loyalty">Loyalty rate <b>{preview.feePercent}%</b> instead of {preview.standardFeePercent}%.</Typography>}
      {credit > 0 && <Typography sx={{ fontSize: 12, color: "#fff" }} data-testid="sd-quote-credit">Your fee credit takes <b>{money(credit, "USD")}</b> off your share of the escrow fee when the deal is released.</Typography>}
    </Stack>
  );
}

export function QuoteBody({ preview, role = "seller", showFees = true }: { preview: SdFeePreview; role?: "buyer" | "seller"; showFees?: boolean }) {
  const isSeller = role === "seller";
  if (!showFees) {
    return (
      <Stack spacing={1} data-testid="sd-quote-body" data-role={role} data-fees="0">
        {preview.price && (
          <Row l={`Priced in ${preview.price.currency}`} v={`${fiatMoney(preview.price.amount, preview.price.currency)} ≈ ${money(preview.price.usd)}`} soft testid="sd-quote-fiat" />
        )}
        <Row l="Deal amount (USD)" v={money(preview.amount, "USD")} strong />
        <Typography sx={{ fontSize: 12, color: SD_INK_MUTED, mt: 0.5 }} data-testid="sd-quote-fees-hint">
          Escrow, network & cashout fees are shown on the next step, once you choose who covers them.
        </Typography>
      </Stack>
    );
  }
  const items = preview.costItems || [];
  // How much of a cost line THIS side bears (cashout is always the seller's; the rest
  // follow the fee_payer selector; a 50/50 split shows half on each side).
  const shareFor = (c: { amount: number; borneBy?: "buyer" | "seller" | "split" }, side: "buyer" | "seller") => {
    const b = c.borneBy || "buyer";
    if (b === "split") return c.amount / 2;
    return b === side ? c.amount : 0;
  };
  const mine = items
    .map((c) => ({ ...c, share: shareFor(c, role) }))
    .filter((c) => c.share > 0);
  const youValue = isSeller ? preview.sellerReceives : preview.buyerPays;
  const youLabel = isSeller ? "You receive" : "You pay";
  const youColor = isSeller ? "#6EE7B7" : SD_GOLD;
  const youTestid = isSeller ? "sd-quote-seller-receives" : "sd-quote-buyer-pays";
  const otherValue = isSeller ? preview.buyerPays : preview.sellerReceives;
  const otherLabel = isSeller ? "Buyer pays" : "Seller receives";
  const otherTestid = isSeller ? "sd-quote-buyer-pays" : "sd-quote-seller-receives";
  return (
    <Stack spacing={1} data-testid="sd-quote-body" data-role={role}>
      {preview.price && (
        <Row l={`Priced in ${preview.price.currency}`} v={`${fiatMoney(preview.price.amount, preview.price.currency)} ≈ ${money(preview.price.usd)}`} soft testid="sd-quote-fiat" />
      )}
      <Row l="Deal amount (USD)" v={money(preview.amount, "USD")} />
      {mine.map((c) => (
        <Row
          key={c.key}
          l={`${c.label}${c.borneBy === "split" ? " · your ½" : ""}`}
          v={`${isSeller ? "−" : "+"}${money(c.share, "USD")}`}
          soft
          testid={`sd-quote-${c.key}`}
        />
      ))}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.12)", pt: 1 }}>
        <Row l={youLabel} v={money(youValue, "USD")} strong color={youColor} testid={youTestid} />
        <Row l={otherLabel} v={money(otherValue, "USD")} soft testid={otherTestid} />
      </Box>
      <RewardsQuoteNote preview={preview} />
      <Typography sx={{ fontSize: 12, color: SD_INK_MUTED, mt: 0.5 }}>
        {isSeller
          ? "The cashout fee is your cost to withdraw — it's deducted from your payout, not added to what the buyer pays. "
          : "You never pay the seller's cashout fee. "}
        {preview.price ? "Indicative — the USD amount locks at the live rate when the buyer funds. " : ""}
        {preview.fundingCoinAssumed && (preview.nonStableSurchargeUsd || 0) > 0
          ? <span data-testid="sd-quote-surcharge-note">Priced for a stablecoin payment (USDT/USDC). Paying with BTC, ETH or another non-stablecoin adds ≈ {money(preview.nonStableSurchargeUsd || 0, "USD")} ({preview.exchangeFeePercent ?? 2}% exchange fee, conversion and network costs) — the exact total is shown per coin at checkout. </span>
          : "Network, conversion & cashout costs are estimates and depend on the coin used. "}
        Fees are set by SafeDeal and charged on release, refund and split; a cancellation fee applies on a mutually-agreed cancellation.
      </Typography>
    </Stack>
  );
}

export function Row({ l, v, soft, strong, color, testid }: { l: string; v: string; soft?: boolean; strong?: boolean; color?: string; testid?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1} data-testid={testid}>
      <Typography sx={{ fontSize: strong ? 14.5 : 13.5, fontWeight: strong ? 800 : 500, color: soft ? SD_INK_MUTED : "#fff" }}>{l}</Typography>
      <Typography sx={{ fontSize: strong ? 14.5 : 13.5, fontWeight: strong ? 900 : 700, color: color || (soft ? SD_INK_MUTED : "#fff"), textAlign: "right", ...TABULAR }}>{v}</Typography>
    </Stack>
  );
}

export const stepDot = (on: boolean, done: boolean) => ({ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, color: on ? SD_INK : done ? "#fff" : "#6B7280", backgroundColor: on ? SD_GOLD : done ? "#047857" : "#E5E7EB", flexShrink: 0 });
