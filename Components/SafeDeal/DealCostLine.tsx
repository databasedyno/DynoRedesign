import React, { useState } from "react";
import { Box, Collapse, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { CostItem } from "@/api/escrow";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { SD_ACCENT, SD_BORDER, SD_TEXT_MUTED } from "./sdTheme";
import { TABULAR } from "./sdFormat";

type FeePayer = "buyer" | "seller" | "split" | string;

/** "Buyer pays $139 = $120 price + $19 costs. Seller receives $115 = $120 − $5 cashout." */
export function costSentence(p: { amount: number; buyerPays: number; sellerReceives: number; totalCost: number; feePayer: FeePayer; currency: string }): string {
  const c = p.currency;
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  // Derive each side's SafeDeal cost from the authoritative amounts — works for any
  // fee model (cashout on the seller) and any fee_payer without re-deriving the split.
  const buyerCost = Math.max(0, r2(p.buyerPays - p.amount));
  const sellerCost = Math.max(0, r2(p.amount - p.sellerReceives));
  if (buyerCost <= 0 && sellerCost <= 0) return `Buyer pays ${money(p.buyerPays, c)} · seller receives ${money(p.sellerReceives, c)} — no SafeDeal costs on this deal.`;
  const buyerPart = buyerCost > 0
    ? `Buyer pays ${money(p.buyerPays, c)} = ${money(p.amount, c)} price + ${money(buyerCost, c)} SafeDeal costs`
    : `Buyer pays ${money(p.buyerPays, c)} (the deal price)`;
  const sellerPart = sellerCost > 0
    ? `seller receives ${money(p.sellerReceives, c)} = ${money(p.amount, c)} − ${money(sellerCost, c)} SafeDeal costs`
    : `seller receives the full ${money(p.sellerReceives, c)}`;
  return `${buyerPart}. ${sellerPart.charAt(0).toUpperCase()}${sellerPart.slice(1)}.`;
}

interface LineProps {
  amount: number;
  buyerPays: number;
  sellerReceives: number;
  totalCost: number;
  feePayer: FeePayer;
  currency: string;
  items?: CostItem[] | null;
  estimated?: boolean;
  testid?: string;
  /** Compact variant for card headers: one line + toggle, no sentence. */
  compact?: boolean;
}

/** Cost transparency line with an expandable itemised breakdown (E2E audit SD-02). */
export default function DealCostLine({ amount, buyerPays, sellerReceives, totalCost, feePayer, currency, items, estimated, testid = "sd-cost-line", compact }: LineProps) {
  const [open, setOpen] = useState(false);
  const list = (items || []).filter((i) => Number(i.amount) > 0);
  const sentence = costSentence({ amount, buyerPays, sellerReceives, totalCost, feePayer, currency });
  return (
    <Box data-testid={testid} data-open={open ? "1" : "0"} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.6} alignItems="flex-start" flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontSize: compact ? 12.5 : 13, color: "#4B5563", flex: "1 1 220px", minWidth: 0 }} data-testid={`${testid}-text`}>
          {compact ? <>Includes <b>{money(totalCost, currency)}</b> SafeDeal costs{estimated ? " (estimate)" : ""}</> : sentence}
        </Typography>
        {list.length > 0 && (
          <Box component="button" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`${testid}-toggle`}
            sx={{ border: 0, background: "none", p: 0, cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 12.5 : 13, fontWeight: 800, color: SD_ACCENT, display: "inline-flex", alignItems: "center", gap: 0.3, whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
            {open ? "Hide breakdown" : "See breakdown"} <Icon icon={open ? "mdi:chevron-up" : "mdi:chevron-down"} width={16} />
          </Box>
        )}
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={0.4} sx={{ mt: 1, p: 1.2, borderRadius: 2, border: `1px solid ${SD_BORDER}`, backgroundColor: "#F9FAFB" }} data-testid={`${testid}-items`}>
          {list.map((i) => (
            <Stack key={i.key} direction="row" justifyContent="space-between" spacing={1} data-testid={`${testid}-item-${i.key}`}>
              <Typography sx={{ fontSize: 12.5, color: "#4B5563" }}>{i.label}</Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, ...TABULAR }}>{money(i.amount, currency)}</Typography>
            </Stack>
          ))}
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ pt: 0.5, borderTop: `1px solid ${SD_BORDER}` }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>Total SafeDeal costs</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 900, ...TABULAR }}>{money(totalCost, currency)}</Typography>
          </Stack>
          <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED }}>
            {estimated ? "Estimates until the buyer funds — the exact costs are fixed at funding and never change afterwards." : "Fixed when the deal was funded — exactly what is charged."}{" "}
            Nothing is charged until the buyer funds the escrow.
          </Typography>
        </Stack>
      </Collapse>
    </Box>
  );
}

const STEPS = [
  { icon: "mdi:lock-outline", title: "Buyer funds", body: "The buyer pays into SafeDeal escrow — held as USDT, never by the other party." },
  { icon: "mdi:package-variant-closed-check", title: "Seller delivers", body: "The seller does the work or ships the item, then marks it delivered." },
  { icon: "mdi:cash-check", title: "Buyer releases", body: "The buyer checks it and releases the money to the seller. Disagree? Raise an issue instead." },
];

/** 3-step "how an escrow deal works" strip for first-time visitors (E2E audit SD-03). */
export function HowEscrowWorksStrip({ testid = "sd-how-strip" }: { testid?: string }) {
  return (
    <Box data-testid={testid} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
      {STEPS.map((s, i) => (
        <Stack key={s.title} direction={{ xs: "row", sm: "column" }} spacing={1} alignItems={{ xs: "flex-start", sm: "stretch" }} sx={{ p: 1.2, borderRadius: 2.5, border: `1px solid ${SD_BORDER}`, backgroundColor: "#F9FAFB", minWidth: 0 }} data-testid={`${testid}-${i + 1}`}>
          <Box sx={{ width: 30, height: 30, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, flexShrink: 0 }} aria-hidden>
            <Icon icon={s.icon} width={17} color={SD_ACCENT} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 900 }}>{i + 1}. {s.title}</Typography>
            <Typography sx={{ fontSize: 12, color: "#4B5563", lineHeight: 1.4 }}>{s.body}</Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}
