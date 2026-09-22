import React, { useMemo, useState } from "react";
import { Box, Button, Chip, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import { SdStatementRow } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime } from "../sdFormat";
import { SD_GOLD, SD_GOLD_DEEP, SD_BORDER, SD_TEXT_MUTED, SD_INK, SD_NOTE_BG, SD_PAGE, goldAlpha } from "../sdTheme";

export const KIND_LABEL: Record<string, string> = {
  escrow_funding: "Escrow funding received",
  escrow_hold: "Paid into escrow from balance",
  hold_released: "Escrow hold released",
  paid_to_seller: "Paid to seller",
  escrow_fee: "Escrow fee",
  exchange_fee: "Exchange fee",
  escrow_costs: "Network & conversion costs",
  release_received: "Release received",
  topup: "Top-up",
  payout: "Deal payout sent",
  withdrawal: "Cashout",
  withdrawal_reversed: "Cashout reversed",
  adjustment_credit: "Adjustment (credit)",
  adjustment_debit: "Adjustment (debit)",
  rounding: "Rounding",
};

const KIND_ICON: Record<string, string> = {
  escrow_funding: "mdi:lock-plus-outline",
  escrow_hold: "mdi:lock-outline",
  hold_released: "mdi:lock-open-variant-outline",
  paid_to_seller: "mdi:arrow-top-right",
  escrow_fee: "mdi:percent-outline",
  exchange_fee: "mdi:swap-horizontal",
  escrow_costs: "mdi:gas-station-outline",
  release_received: "mdi:arrow-bottom-left",
  topup: "mdi:wallet-plus-outline",
  payout: "mdi:bank-transfer-out",
  withdrawal: "mdi:bank-transfer-out",
  withdrawal_reversed: "mdi:undo-variant",
};

type Group = "all" | "deals" | "fees" | "topups" | "cashouts";
const GROUPS: Array<{ key: Group; label: string }> = [
  { key: "all", label: "All" },
  { key: "deals", label: "Deals" },
  { key: "fees", label: "Fees & costs" },
  { key: "topups", label: "Top-ups" },
  { key: "cashouts", label: "Cashouts" },
];
const groupOf = (kind: string): Group => {
  if (["escrow_fee", "exchange_fee", "escrow_costs", "rounding"].includes(kind)) return "fees";
  if (kind === "topup") return "topups";
  if (["withdrawal", "withdrawal_reversed", "payout"].includes(kind)) return "cashouts";
  return "deals";
};

/** Ledger rows written before the "cashout" vocabulary still say "Withdrawal …" — normalise on display. */
const cashoutWording = (d?: string | null) => (d || "").replace(/\bWithdrawal\b/g, "Cashout").replace(/\bwithdrawal\b/g, "cashout").replace(/\bauto-withdraw\b/gi, "auto-cashout");

/** Network/exchange fee in USD for a row, read from its stored meta (top-ups carry it). */
export const rowFeeUsd = (meta?: Record<string, unknown> | null): number => {
  const m = (meta || {}) as Record<string, unknown>;
  const total = Number(m.total_fee_usd);
  if (isFinite(total) && total > 0) return total;
  const sum = Number(m.network_fee_usd || 0) + Number(m.conversion_fee_usd || 0) + Number(m.exchange_fee_usd || 0);
  return sum > 0 ? sum : 0;
};

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const PAGE = 25;

interface Props {
  rows: SdStatementRow[] | null;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
  onCsv: () => void;
  /** Compact mode for the Overview tab: no filters, first N rows, "See all" link. */
  compact?: number;
  onSeeAll?: () => void;
}

function Row({ r, i, reduce }: { r: SdStatementRow; i: number; reduce: boolean }) {
  const fee = rowFeeUsd(r.meta);
  const transfer = r.signed === 0;
  const positive = r.signed > 0;
  const content = (
    <Box data-testid={`sd-statement-row-${r.kind}`} sx={{ display: "grid", gridTemplateColumns: { xs: "36px 1fr auto", md: "44px 1fr 120px 120px" }, alignItems: "center", gap: { xs: 1.2, md: 2 }, px: { xs: 1, md: 1.5 }, py: 1.25, borderRadius: 3, transition: "background-color .15s", "&:hover": { backgroundColor: SD_PAGE } }}>
      <Box sx={{ width: { xs: 36, md: 40 }, height: { xs: 36, md: 40 }, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: positive ? "rgba(18,183,106,0.12)" : transfer ? SD_NOTE_BG : "#F4F1E8", color: positive ? "#0E9F5C" : transfer ? SD_GOLD_DEEP : SD_INK }} aria-hidden>
        <Icon icon={KIND_ICON[r.kind] || "mdi:circle-small"} width={19} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{KIND_LABEL[r.kind] || r.kind}</Typography>
          {r.escrow_id && <Typography sx={{ fontSize: 12, color: SD_GOLD_DEEP, fontWeight: 800 }}>Deal #{r.escrow_id}</Typography>}
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Tooltip title={absTime(r.at)}><time dateTime={r.at}>{dayLabel(r.at)}</time></Tooltip>
          {r.deal_title ? ` · ${r.deal_title}` : ""}
          {r.description ? ` · ${cashoutWording(r.description)}` : ""}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontWeight: 900, fontSize: 14.5, ...TABULAR, color: positive ? "#047857" : transfer ? SD_GOLD_DEEP : SD_INK }}>
          {transfer ? (r.type === "HOLD" ? `→ held ${money(r.amount)}` : `→ available ${money(r.amount)}`) : `${positive ? "+" : "−"}${money(Math.abs(r.signed))}`}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: fee > 0 ? SD_TEXT_MUTED : "#C9C6BC", ...TABULAR, display: { xs: "block", md: "none" } }} data-testid={`sd-statement-fee-${r.kind}`}>{fee > 0 ? `fee ${money(fee)}` : ""}</Typography>
      </Box>
      <Box sx={{ textAlign: "right", display: { xs: "none", md: "block" } }}>
        <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, ...TABULAR }}>bal. {money(r.running_balance)}</Typography>
        <Typography sx={{ fontSize: 11.5, color: fee > 0 ? SD_TEXT_MUTED : "#C9C6BC", ...TABULAR }} data-testid={`sd-statement-fee-${r.kind}-md`}>{fee > 0 ? `fee ${money(fee)}` : ""}</Typography>
      </Box>
    </Box>
  );
  if (reduce || i > 12) return content;
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}>{content}</motion.div>;
}

/** Statement re-imagined as a month-grouped activity feed with filters, paging and CSV. */
export default function ActivityFeed({ rows, from, to, onRange, onCsv, compact, onSeeAll }: Props) {
  const reduce = Boolean(useReducedMotion());
  const [group, setGroup] = useState<Group>("all");
  const [deal, setDeal] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);

  const deals = useMemo(() => {
    const m = new Map<number, string>();
    (rows || []).forEach((r) => { if (r.escrow_id) m.set(r.escrow_id, r.deal_title || `Deal #${r.escrow_id}`); });
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [rows]);

  const filtered = useMemo(() => {
    const list = (rows || []).filter((r) => (group === "all" || groupOf(r.kind) === group) && (deal === "all" || String(r.escrow_id) === deal));
    return compact ? list.slice(0, compact) : list;
  }, [rows, group, deal, compact]);

  const visible = compact ? filtered : filtered.slice(0, shown);
  const months = useMemo(() => {
    const out: Array<{ key: string; rows: SdStatementRow[]; net: number }> = [];
    visible.forEach((r) => {
      const k = monthKey(r.at);
      let g = out[out.length - 1];
      if (!g || g.key !== k) { g = { key: k, rows: [], net: 0 }; out.push(g); }
      g.rows.push(r);
      g.net += r.signed;
    });
    return out;
  }, [visible]);

  return (
    <Box data-testid="sd-statement" sx={{ borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, p: { xs: 1.5, md: 2.2 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1.2} sx={{ mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>Activity</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }}>Every funding, release, fee, top-up and cashout, with your running balance.</Typography>
        </Box>
        {compact ? (
          <Button size="small" onClick={onSeeAll} data-testid="sd-activity-see-all" endIcon={<Icon icon="mdi:arrow-right" width={16} />} sx={{ textTransform: "none", fontWeight: 800, color: SD_GOLD_DEEP, borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>See all</Button>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => onRange(e.target.value, to)} inputProps={{ "data-testid": "sd-statement-from" }} sx={{ width: 150 }} />
            <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => onRange(from, e.target.value)} inputProps={{ "data-testid": "sd-statement-to" }} sx={{ width: 150 }} />
            <Button size="small" variant="outlined" onClick={onCsv} data-testid="sd-statement-csv" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, borderColor: SD_BORDER, color: SD_INK, whiteSpace: "nowrap", "&:hover": { borderColor: SD_GOLD_DEEP, backgroundColor: SD_NOTE_BG } }} startIcon={<Icon icon="mdi:download" />}>CSV</Button>
          </Stack>
        )}
      </Stack>

      {!compact && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap role="tablist" aria-label="Filter activity">
            {GROUPS.map((g) => (
              <Chip key={g.key} role="tab" aria-selected={group === g.key} label={g.label} onClick={() => { setGroup(g.key); setShown(PAGE); }} data-testid={`sd-activity-filter-${g.key}`} sx={{ fontWeight: 800, fontSize: 12.5, backgroundColor: group === g.key ? SD_GOLD : "#fff", color: SD_INK, border: `1px solid ${group === g.key ? SD_GOLD : SD_BORDER}`, "&:hover": { backgroundColor: group === g.key ? SD_GOLD : SD_PAGE } }} />
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          {deals.length > 0 && (
            <TextField select size="small" value={deal} onChange={(e) => { setDeal(e.target.value); setShown(PAGE); }} inputProps={{ "data-testid": "sd-activity-deal-filter" }} sx={{ minWidth: 200 }}>
              <MenuItem value="all">All deals</MenuItem>
              {deals.map(([id, title]) => <MenuItem key={id} value={String(id)}>#{id} · {title}</MenuItem>)}
            </TextField>
          )}
        </Stack>
      )}

      {!rows ? (
        <Skeleton variant="rounded" height={180} />
      ) : filtered.length === 0 ? (
        <Box sx={{ py: 4, textAlign: "center" }} data-testid="sd-statement-empty">
          <Icon icon="mdi:timeline-text-outline" width={34} color="#C9C6BC" aria-hidden />
          <Typography sx={{ fontWeight: 800, mt: 1 }}>Nothing here yet</Typography>
          <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED }}>{rows.length === 0 ? "Funding, releases, fees and cashouts all show up here with a running balance." : "No entries match these filters."}</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {months.map((m) => (
            <Box key={m.key} data-testid={`sd-activity-month-${m.key}`}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 1, md: 1.5 }, py: 0.6, position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: SD_TEXT_MUTED }}>{monthLabel(m.key)}</Typography>
                <Box sx={{ flex: 1, height: "1px", backgroundColor: SD_BORDER }} />
                <Typography sx={{ fontSize: 12, fontWeight: 800, ...TABULAR, color: m.net >= 0 ? "#047857" : SD_TEXT_MUTED }}>{m.net >= 0 ? "+" : "−"}{money(Math.abs(m.net))} net</Typography>
              </Stack>
              {m.rows.map((r, i) => <Row key={r.id || r.reference} r={r} i={i} reduce={reduce} />)}
            </Box>
          ))}
          {!compact && shown < filtered.length && (
            <Button onClick={() => setShown((s) => s + PAGE)} data-testid="sd-activity-more" sx={{ alignSelf: "center", textTransform: "none", fontWeight: 800, borderRadius: 99, px: 3, color: SD_INK, backgroundColor: SD_PAGE, border: `1px solid ${SD_BORDER}`, "&:hover": { borderColor: goldAlpha(0.7), backgroundColor: SD_NOTE_BG } }}>
              Show {Math.min(PAGE, filtered.length - shown)} more · {filtered.length - shown} left
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
