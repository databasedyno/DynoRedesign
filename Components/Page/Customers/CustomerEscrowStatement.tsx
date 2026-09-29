import React, { useCallback, useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Collapse, Typography, useTheme } from "@mui/material";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import axiosBaseApi from "@/axiosConfig";
import { toFixedStr } from "@/utils/money";
import { formatDateI18n } from "@/utils/formatDate";

interface Row {
  id: string | null;
  at: string;
  type: string;
  kind: string;
  amount: number;
  signed: number;
  description: string;
  escrow_id: number | null;
  deal_title: string | null;
  running_balance: number;
}

interface Statement {
  customer: { customer_id: number; email: string | null; name: string | null };
  wallet: { available: number; held: number; total: number; currency: string };
  deals: { count: number; volume: number; active: number; open?: number; total?: number; closed_unfunded?: number };
  entries: Row[];
  withdrawals: { withdrawal_id: number; amount_usd: number | string; status: string; created_at: string }[];
}

const KIND: Record<string, string> = {
  escrow_funding: "Escrow funding", escrow_hold: "Paid into escrow", hold_released: "Hold released", paid_to_seller: "Paid to seller",
  escrow_fee: "Escrow fee", escrow_costs: "Network & exchange", release_received: "Release received", withdrawal: "Withdrawal",
  withdrawal_reversed: "Withdrawal reversed", adjustment_credit: "Adjustment", adjustment_debit: "Adjustment", rounding: "Rounding",
};

/**
 * Brand-owner view of a customer's SafeDeal (escrow) wallet: Available / Held,
 * deal count + volume and the full statement (same rows the customer sees).
 * Renders nothing when the customer has no escrow activity.
 */
export const CustomerEscrowStatement: React.FC<{ companyId: string | number; customerId: number; cardBorder: string; softBg: string }> = ({ companyId, customerId, cardBorder, softBg }) => {
  const theme = useTheme();
  const sans = { fontFamily: "var(--font-sans)" };
  const mono = { fontFamily: "var(--font-mono)" };
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosBaseApi.get(`/safedeal/brand/${companyId}/customers/${customerId}/statement`, { params: { limit: 100 } });
      setData(res.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, customerId]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}><CircularProgress size={14} /></Box>;
  if (!data || (data.entries.length === 0 && (data.deals.total ?? data.deals.count) === 0 && data.wallet.held === 0)) return null;

  const csvUrl = `${(process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "")}/api/safedeal/brand/${companyId}/customers/${customerId}/statement?format=csv`;
  const downloadCsv = async () => {
    const res = await axiosBaseApi.get(`/safedeal/brand/${companyId}/customers/${customerId}/statement`, { params: { format: "csv" }, responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-${customerId}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box data-testid="customer-escrow-statement" sx={{ mt: 1.5, p: "12px 14px", borderRadius: "12px", border: `1px solid ${cardBorder}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <ShieldRounded sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
        <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, ...sans, flexGrow: 1 }}>SafeDeal escrow wallet</Typography>
        <Chip size="small" label={`${data.deals.count} funded deal${data.deals.count === 1 ? "" : "s"} · ${toFixedStr(data.deals.volume, 2)} USD${data.deals.open ? ` · ${data.deals.open} awaiting funding` : ""}`} data-testid="customer-escrow-deals" sx={{ fontWeight: 700, fontSize: 11 }} />
      </Box>
      <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1 }}>
        {[
          ["Available", data.wallet.available, "customer-escrow-available"],
          ["Held in escrow", data.wallet.held, "customer-escrow-held"],
          ["Active deals", data.deals.active, "customer-escrow-active"],
        ].map(([l, v, tid]) => (
          <Box key={String(l)} sx={{ p: 1, borderRadius: "10px", bgcolor: softBg }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.palette.text.secondary, ...sans }}>{l}</Typography>
            <Typography data-testid={String(tid)} className="tabular-nums" sx={{ fontSize: 15, fontWeight: 700, ...mono }}>{typeof v === "number" && l !== "Active deals" ? `${toFixedStr(v, 2)} USD` : v}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 1, display: "flex", gap: 1.5, alignItems: "center" }}>
        <Typography role="button" onClick={() => setOpen((o) => !o)} data-testid="customer-escrow-toggle" sx={{ fontSize: 12.5, fontWeight: 700, color: theme.palette.primary.main, cursor: "pointer", ...sans }}>
          {open ? "Hide statement" : `Statement (${data.entries.length})`}
        </Typography>
        <Typography role="button" onClick={() => void downloadCsv()} data-testid="customer-escrow-csv" data-href={csvUrl} sx={{ fontSize: 12.5, fontWeight: 700, color: theme.palette.text.secondary, cursor: "pointer", ...sans }}>Export CSV</Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1 }}>
          {data.entries.map((r) => (
            <Box key={r.id || `${r.at}-${r.kind}`} data-testid="customer-escrow-row" data-kind={r.kind} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.7, borderBottom: `1px solid ${cardBorder}` }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13, ...sans }}>
                  <b>{KIND[r.kind] || r.kind}</b>{r.escrow_id ? ` · #${r.escrow_id}${r.deal_title ? ` ${r.deal_title}` : ""}` : ""}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11.5, color: theme.palette.text.secondary, ...sans }}>
                  {formatDateI18n(r.at, { year: "numeric", month: "short", day: "numeric" })} · {r.description}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography className="tabular-nums" sx={{ fontSize: 13, fontWeight: 700, ...mono, color: r.signed > 0 ? theme.palette.success.main : r.signed < 0 ? theme.palette.error.main : theme.palette.text.secondary }}>
                  {r.signed !== 0 ? `${r.signed > 0 ? "+" : "−"}${toFixedStr(Math.abs(r.signed), 2)}` : `${r.type === "HOLD" ? "→ held" : "→ avail"} ${toFixedStr(r.amount, 2)}`}
                </Typography>
                <Typography className="tabular-nums" sx={{ fontSize: 11, color: theme.palette.text.secondary, ...mono }}>bal {toFixedStr(r.running_balance, 2)}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CustomerEscrowStatement;
