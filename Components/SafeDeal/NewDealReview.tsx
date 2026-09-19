import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
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
  return (
    <Stack spacing={1.2} data-testid="sd-new-review">
      <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Check the details — <b>{d.email}</b> will get an email invite to accept these terms as the <b>{d.role === "seller" ? "buyer" : "seller"}</b>.</Typography>
      <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }} data-testid="sd-review-title">{d.title}</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 900, mt: 0.3, ...TABULAR }} data-testid="sd-review-amount">
          {fiatMoney(d.amount, d.currency)}
          {fiat && preview?.price && <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: "#6B7280", ml: 1 }}>≈ {money(preview.price.usd)} today</Typography>}
        </Typography>
        <Divider sx={{ my: 1.2 }} />
        <Fact icon={t?.icon || "mdi:handshake-outline"} label="Deal type" value={t?.label || "Not specified"} testid="sd-review-type" />
        <Fact icon="mdi:account-arrow-right-outline" label="You are the" value={d.role} testid="sd-review-role" />
        <Fact icon="mdi:email-outline" label={d.role === "seller" ? "Buyer" : "Seller"} value={d.email} testid="sd-review-email" />
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

/** Itemised live quote (dark panel + mobile bar). */
export function QuoteBody({ preview }: { preview: SdFeePreview }) {
  return (
    <Stack spacing={1}>
      {preview.price && (
        <Row l={`Priced in ${preview.price.currency}`} v={`${fiatMoney(preview.price.amount, preview.price.currency)} ≈ ${money(preview.price.usd)}`} soft testid="sd-quote-fiat" />
      )}
      <Row l="Deal amount (USD)" v={money(preview.amount, "USD")} />
      {(preview.costItems || []).map((c) => (
        <Row key={c.key} l={c.label} v={money(c.amount, "USD")} soft testid={`sd-quote-${c.key}`} />
      ))}
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.12)", pt: 1 }}>
        <Row l="Buyer pays" v={money(preview.buyerPays, "USD")} strong color="#A5B4FC" testid="sd-quote-buyer-pays" />
        <Row l="Seller receives" v={money(preview.sellerReceives, "USD")} strong color="#6EE7B7" testid="sd-quote-seller-receives" />
      </Box>
      <Typography sx={{ fontSize: 11.5, color: SD_INK_MUTED, mt: 0.5 }}>
        {preview.price ? "Indicative — the USD amount locks at the live rate when the buyer funds. " : ""}Network, conversion & withdrawal costs are estimates and depend on the coin the buyer pays with. Fees are set by Dynopay and charged on every outcome.
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

export const stepDot = (on: boolean, done: boolean) => ({ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, color: on || done ? "#fff" : "#6B7280", backgroundColor: on ? BRAND_ACCENT : done ? "#047857" : "#E5E7EB", flexShrink: 0 });
