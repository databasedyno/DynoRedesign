import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "../sdFormat";
import { SD_GOLD, SD_GOLD_DARK, SD_GOLD_DEEP, SD_INK, SD_INK_MUTED, SD_BORDER, SD_TEXT_MUTED, goldAlpha } from "../sdTheme";

interface Props {
  available: number;
  held: number;
  paidOut: number;
  inEscrowDeals: number;
  minWithdraw: number;
  minTopup: number;
  approvalThreshold: number;
  onTopUp: () => void;
  onCashOut: () => void;
}

const tile = { p: { xs: 2.2, md: 2.6 }, borderRadius: 4, border: `1px solid ${SD_BORDER}`, backgroundColor: "#fff", position: "relative", overflow: "hidden", minHeight: 150, display: "flex", flexDirection: "column", justifyContent: "space-between" } as const;
const label = { fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" } as const;

/** Balance strip: Available (with actions) · In escrow · Paid out. */
export default function BalanceStrip(p: Props) {
  return (
    <Box data-testid="sd-balance-strip" sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1.35fr 1fr 1fr" } }}>
      <Box data-testid="sd-wallet-balance" sx={{ ...tile, backgroundColor: SD_INK, color: "#fff", border: "none" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(360px 200px at 100% 0%, ${goldAlpha(0.22)}, transparent 70%)` }} />
        <Box sx={{ position: "relative" }}>
          <Typography sx={{ ...label, color: SD_INK_MUTED }}>Available to use</Typography>
          <Typography sx={{ fontSize: { xs: 34, md: 40 }, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.1, mt: 0.6, ...TABULAR }} data-testid="sd-wallet-available">{money(p.available)}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ position: "relative", mt: 2 }}>
          <Button fullWidth variant="contained" onClick={p.onTopUp} data-testid="sd-topup-open" startIcon={<Icon icon="mdi:plus-circle-outline" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, minHeight: 44, color: SD_INK, backgroundColor: "#fff", "&:hover": { backgroundColor: "#E1E5EA" } }}>Top up</Button>
          <Button fullWidth variant="contained" disabled={p.available < p.minWithdraw} onClick={p.onCashOut} data-testid="sd-withdraw-open" startIcon={<Icon icon="mdi:bank-transfer-out" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, minHeight: 44, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK }, "&.Mui-disabled": { backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" } }}>Cash out</Button>
        </Stack>
        <Typography sx={{ position: "relative", fontSize: 12, color: SD_INK_MUTED, mt: 1.2 }}>Top up from ${p.minTopup} · cash out from ${p.minWithdraw}</Typography>
      </Box>

      <Box data-testid="sd-balance-held" sx={tile}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography sx={{ ...label, color: SD_TEXT_MUTED }}>In escrow</Typography>
          <Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: goldAlpha(0.16), color: SD_GOLD_DEEP }}><Icon icon="mdi:lock-outline" width={18} aria-hidden /></Box>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 900, letterSpacing: -0.8, ...TABULAR }} data-testid="sd-wallet-held">{money(p.held)}</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, mt: 0.3 }}>{p.inEscrowDeals === 0 ? "No deals holding funds right now" : `Locked across ${p.inEscrowDeals} open ${p.inEscrowDeals === 1 ? "deal" : "deals"}`}</Typography>
        </Box>
      </Box>

      <Box data-testid="sd-balance-paid-out" sx={tile}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography sx={{ ...label, color: SD_TEXT_MUTED }}>Paid out</Typography>
          <Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: "rgba(18,183,106,0.12)", color: "#0E9F5C" }}><Icon icon="mdi:check-decagram-outline" width={18} aria-hidden /></Box>
        </Stack>
        <Box>
          <Typography sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 900, letterSpacing: -0.8, ...TABULAR }} data-testid="sd-wallet-paid-out">{money(p.paidOut)}</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, mt: 0.3 }}>Sent to your payout addresses, all time</Typography>
        </Box>
      </Box>
    </Box>
  );
}
