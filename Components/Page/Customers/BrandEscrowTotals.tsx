import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import axiosBaseApi from "@/axiosConfig";
import { toFixedStr } from "@/utils/money";

interface Totals {
  customers: number;
  available_total: number;
  held_total: number;
  fees_earned: number;
  costs_retained: number;
  withdrawals_paid: number;
  withdrawals_pending: number;
  deals_total: number;
  deals_funded: number;
  deals_volume: number;
  deals_open: number;
  deals_open_volume: number;
  deals_closed_unfunded: number;
  pending_approvals: number;
  is_safedeal_brand: boolean;
}

/** Brand-level escrow wallet totals (reconcilable against USDT custody). Hidden for brands with no escrow activity. */
export const BrandEscrowTotals: React.FC<{ companyId: string | number | null | undefined; cardBorder: string }> = ({ companyId, cardBorder }) => {
  const theme = useTheme();
  const [t, setT] = useState<Totals | null>(null);
  useEffect(() => {
    if (!companyId) return setT(null);
    axiosBaseApi.get(`/safedeal/brand/${companyId}/totals`).then((r) => setT(r.data?.data || null)).catch(() => setT(null));
  }, [companyId]);
  if (!t || (t.deals_total === 0 && t.available_total === 0 && t.held_total === 0)) return null;
  const funded = t.deals_funded ?? 0;
  const pipeline = [
    t.deals_open > 0 ? `${t.deals_open} awaiting funding (${toFixedStr(t.deals_open_volume, 2)} USD)` : null,
    t.deals_closed_unfunded > 0 ? `${t.deals_closed_unfunded} cancelled before funding` : null,
  ].filter(Boolean).join(" · ");
  const cells: [string, string, string, string?][] = [
    ["Customer balances", `${toFixedStr(t.available_total, 2)} USD`, "brand-escrow-available"],
    ["Held in escrow", `${toFixedStr(t.held_total, 2)} USD`, "brand-escrow-held"],
    ["Fees earned", `${toFixedStr(t.fees_earned, 2)} USD`, "brand-escrow-fees"],
    ["Withdrawals paid", `${toFixedStr(t.withdrawals_paid, 2)} USD`, "brand-escrow-withdrawals"],
    ["Funded deals", `${funded} · ${toFixedStr(t.deals_volume, 2)} USD`, "brand-escrow-deals", pipeline || undefined],
  ];
  const custody = t.available_total + t.held_total + t.withdrawals_pending;
  return (
    <Box data-testid="brand-escrow-totals" sx={{ mb: 2, p: "12px 14px", borderRadius: "14px", border: `1px solid ${cardBorder}`, background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FBFBFE" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <ShieldRounded sx={{ fontSize: 17, color: theme.palette.text.secondary }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", flexGrow: 1 }}>
          SafeDeal escrow — brand totals · expected USDT custody <b style={{ color: theme.palette.text.primary }}>{toFixedStr(custody, 2)}</b>
        </Typography>
        {t.pending_approvals > 0 && (
          <Typography data-testid="brand-escrow-pending" sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.warning.main, fontFamily: "var(--font-sans)" }}>
            {t.pending_approvals} withdrawal{t.pending_approvals === 1 ? "" : "s"} awaiting approval (Admin → Escrow)
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" }, gap: 1 }}>
        {cells.map(([l, v, tid, sub]) => (
          <Box key={l}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>{l}</Typography>
            <Typography data-testid={tid} className="tabular-nums" sx={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{v}</Typography>
            {sub && (
              <Typography data-testid={`${tid}-pipeline`} sx={{ fontSize: 12, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mt: 0.25 }}>{sub}</Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default BrandEscrowTotals;
