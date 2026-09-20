import React, { useEffect, useState } from "react";
import { Box, InputAdornment, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi from "@/api/safedeal";
import type { FeeBreakdown } from "@/api/escrow";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "./sdFormat";
import { SD_AMBER } from "./SafeDealShell";
import { SD_GOLD, SD_INK } from "./sdTheme";

type FeePayer = "buyer" | "seller" | "split";
const PAYERS: { v: FeePayer; label: string }[] = [
  { v: "buyer", label: "Buyer pays fee" },
  { v: "seller", label: "Seller pays fee" },
  { v: "split", label: "Split 50/50" },
];

/** Landing calculator on the ink hero: real quote from the fee engine, never a hard-coded example. */
export default function FeeCalculator({ minDeal, autoReleaseDefault, maxDealUsd, maxDealEur }: { minDeal: number; autoReleaseDefault: number; maxDealUsd?: number | null; maxDealEur?: number }) {
  const [amount, setAmount] = useState("500");
  const [payer, setPayer] = useState<FeePayer>("buyer");
  const [q, setQ] = useState<FeeBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const n = Number(amount);
  const tooHigh = maxDealUsd != null && n > maxDealUsd;
  const valid = n >= minDeal && !tooHigh;

  useEffect(() => {
    if (!valid) { setQ(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      safedealApi.feePreview({ amount: n, fee_payer: payer }).then(setQ).catch(() => setQ(null)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [n, payer, valid]);

  const muted = "rgba(255,255,255,0.72)";
  return (
    <Box sx={{ borderRadius: 4, p: 2.5, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(14px)" }} data-testid="sd-hero-card">
      <Typography component="h2" sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: muted, mb: 1.5 }}>Try the numbers</Typography>
      <TextField
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        fullWidth
        size="small"
        label="Deal amount"
        error={!!amount && !valid}
        helperText={!!amount && !valid ? (tooHigh ? `Deals cap at €${(maxDealEur ?? 2999).toLocaleString()}` : `Deals start at $${minDeal}`) : " "}
        sx={{ "& .MuiOutlinedInput-root": { background: "rgba(255,255,255,0.07)" }, "& .MuiOutlinedInput-root input": { color: "#fff" } }}
        InputProps={{ startAdornment: <InputAdornment position="start" sx={{ "& p": { color: "#fff" } }}>$</InputAdornment>, sx: { color: "#fff", fontWeight: 800, ...TABULAR, "& fieldset": { borderColor: "rgba(255,255,255,0.3)" }, "&:hover fieldset": { borderColor: "rgba(255,255,255,0.55) !important" }, "&.Mui-focused fieldset": { borderColor: `${SD_GOLD} !important` } } }}
        InputLabelProps={{ sx: { color: muted, "&.Mui-focused": { color: SD_GOLD } } }}
        FormHelperTextProps={{ sx: { color: "#FCA5A5", m: 0, mt: 0.4 } }}
        inputProps={{ "data-testid": "sd-calc-amount", inputMode: "decimal", "aria-label": "Deal amount in US dollars" }}
      />
      <Stack direction="row" spacing={0.8} sx={{ my: 1.2 }} role="radiogroup" aria-label="Who pays the escrow fee">
        {PAYERS.map((p) => {
          const on = p.v === payer;
          return (
            <Box
              key={p.v}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onClick={() => setPayer(p.v)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPayer(p.v)}
              data-testid={`sd-calc-payer-${p.v}`}
              sx={{ flex: 1, textAlign: "center", py: 0.7, px: 0.5, borderRadius: 99, cursor: "pointer", fontSize: 12, fontWeight: 800, color: on ? SD_INK : muted, backgroundColor: on ? "#fff" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", transition: "background-color .15s, color .15s", "&:focus-visible": { outline: `2px solid ${SD_GOLD}`, outlineOffset: 2 } }}
            >
              {p.label}
            </Box>
          );
        })}
      </Stack>

      {loading ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} height={22} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />)}</Stack>
      ) : !q ? (
        <Typography sx={{ fontSize: 13.5, color: muted }}>Enter an amount of ${minDeal} or more to see the itemised quote.</Typography>
      ) : (
        <Stack spacing={1} data-testid="sd-calc-quote">
          <Line l="Deal amount" v={money(q.amount)} />
          {(q.costItems || []).map((c) => <Line key={c.key} l={c.label} v={money(c.amount)} soft />)}
          <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.12)", pt: 1.2 }}>
            <Line l="Buyer pays" v={money(q.buyerPays)} strong color={SD_GOLD} testid="sd-calc-buyer-pays" />
            <Line l="Seller receives" v={money(q.sellerReceives)} strong color="#6EE7B7" testid="sd-calc-seller-receives" />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Icon icon="mdi:timer-sand" width={16} color={SD_AMBER} aria-hidden />
            <Typography sx={{ fontSize: 12.5, color: muted }}>Held in USDT escrow by SafeDeal · releases {autoReleaseDefault} days after delivery unless the buyer objects</Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function Line({ l, v, soft, strong, color, testid }: { l: string; v: string; soft?: boolean; strong?: boolean; color?: string; testid?: string }) {
  const c = soft ? "rgba(255,255,255,0.72)" : "#fff";
  return (
    <Stack direction="row" justifyContent="space-between" data-testid={testid}>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 800 : 500, color: c }}>{l}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 900 : 700, color: color || c, ...TABULAR }}>{v}</Typography>
    </Stack>
  );
}
