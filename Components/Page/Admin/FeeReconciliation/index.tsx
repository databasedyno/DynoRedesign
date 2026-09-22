import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, CircularProgress, Link as MuiLink, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { LocalGasStationRounded, PaidRounded, RuleRounded, SyncRounded, TrendingDownRounded, TrendingUpRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { FeeAuditRow, FeeReconciliation, feeReconciliationApi } from "@/api/feeReconciliation";
import { SectionCard, StatCard, formatCrypto, formatDateTime, formatUSD } from "../adminUi";
import CrumbSweeperCard from "./CrumbSweeperCard";

const STATUSES = [
  { key: "", label: "Any status" },
  { key: "reconciled", label: "Reconciled" },
  { key: "pending", label: "Pending receipt" },
  { key: "unavailable", label: "No tx hash" },
];
const VERDICTS = [
  { key: "", label: "Any verdict" },
  { key: "over", label: "Over-charged" },
  { key: "under", label: "Under-charged" },
  { key: "ok", label: "Within ±$0.05" },
];

const VERDICT_CHIP: Record<string, { label: string; color: "success" | "warning" | "error" | "default" | "info" }> = {
  ok: { label: "OK", color: "success" },
  over: { label: "Over", color: "info" },
  under: { label: "Under", color: "error" },
  pending: { label: "Pending", color: "warning" },
  unavailable: { label: "No hash", color: "default" },
};

const VerdictChip = ({ verdict, testid }: { verdict: string; testid?: string }) => {
  const c = VERDICT_CHIP[verdict] || { label: verdict, color: "default" as const };
  return <Chip size="small" label={c.label} color={c.color} variant={c.color === "default" ? "outlined" : "filled"} data-testid={testid} data-verdict={verdict} sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />;
};

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatUSD(Math.abs(n))}`;
const varianceColor = (n: number | null) => (n === null ? "text.disabled" : n > 0.05 ? "info.main" : n < -0.05 ? "error.main" : "success.main");
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

/** Admin → Fee Reconciliation: what merchants were charged for network fees vs what the chain actually burned. */
const AdminFeeReconciliation: React.FC = () => {
  const dispatch = useDispatch();
  const [data, setData] = useState<FeeReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "reconcile" | "backfill">(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chain, setChain] = useState("");
  const [status, setStatus] = useState("");
  const [verdict, setVerdict] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);

  const toast = useCallback((message: string, severity: "success" | "error" = "success") => dispatch({ type: TOAST_SHOW, payload: { message, severity } }), [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await feeReconciliationApi.report({ from: from || undefined, to: to || undefined, chain: chain || undefined, status: status || undefined, verdict: verdict || undefined, page: page + 1, limit }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || "Could not load the fee reconciliation report.", "error");
    } finally {
      setLoading(false);
    }
  }, [from, to, chain, status, verdict, page, limit, toast]);

  useEffect(() => { void load(); }, [load]);

  const run = async (what: "reconcile" | "backfill") => {
    setBusy(what);
    try {
      if (what === "reconcile") {
        const r = await feeReconciliationApi.reconcile(100);
        toast(`Checked pending payouts: ${r.reconciled} reconciled, ${r.pending} still pending, ${r.unavailable} unavailable.`);
      } else {
        const r = await feeReconciliationApi.backfill(90);
        toast(`Backfill ${r.days}d: scanned ${r.scanned}, added ${r.inserted}, reconciled ${r.reconciled}.`);
      }
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const s = data?.summary;
  const chains = useMemo(() => Object.entries(s?.by_chain || {}).sort((a, b) => b[1].payouts - a[1].payouts), [s]);
  const recoveryPct = s && s.actual_usd > 0 ? (s.charged_usd / s.actual_usd) * 100 : null;
  const fieldSx = { minWidth: 150 };

  return (
    <Box data-testid="fee-reconciliation-page" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px" }} data-testid="fee-filters">
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField type="date" size="small" label="Settled from" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} inputProps={{ "data-testid": "fee-filter-from" }} sx={fieldSx} />
          <TextField type="date" size="small" label="Settled to" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} inputProps={{ "data-testid": "fee-filter-to" }} sx={fieldSx} />
          <TextField select size="small" label="Chain" value={chain} onChange={(e) => { setChain(e.target.value); setPage(0); }} inputProps={{ "data-testid": "fee-filter-chain" }} sx={fieldSx} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
            <MenuItem value="">All chains</MenuItem>
            {chains.map(([k]) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} inputProps={{ "data-testid": "fee-filter-status" }} sx={fieldSx} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
            {STATUSES.map((o) => <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Verdict" value={verdict} onChange={(e) => { setVerdict(e.target.value); setPage(0); }} inputProps={{ "data-testid": "fee-filter-verdict" }} sx={fieldSx} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
            {VERDICTS.map((o) => <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" disabled={busy !== null} onClick={() => void run("reconcile")} data-testid="fee-reconcile-btn" startIcon={busy === "reconcile" ? <CircularProgress size={14} /> : <SyncRounded fontSize="small" />} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>Fetch receipts</Button>
          <Tooltip title="Scan the last 90 days of settled payouts and add any that are missing from the audit table">
            <Button size="small" variant="outlined" disabled={busy !== null} onClick={() => void run("backfill")} data-testid="fee-backfill-btn" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>Backfill 90d</Button>
          </Tooltip>
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" } }} data-testid="fee-kpis">
        <StatCard label="Payouts audited" value={s ? s.payouts.toLocaleString() : "—"} sub={s ? `${s.reconciled} reconciled · ${s.pending} pending · ${s.unavailable} no hash` : undefined} icon={<RuleRounded fontSize="small" />} testid="fee-kpi-payouts" />
        <StatCard label="Charged (reconciled)" value={s ? formatUSD(s.charged_usd) : "—"} sub="Network fee deducted from merchants" icon={<PaidRounded fontSize="small" />} testid="fee-kpi-charged" />
        <StatCard label="Actual gas burned" value={s ? formatUSD(s.actual_usd) : "—"} sub="From on-chain receipts, priced at settlement" icon={<LocalGasStationRounded fontSize="small" />} testid="fee-kpi-actual" />
        <StatCard label="Net variance" value={s ? <Box component="span" sx={{ color: varianceColor(s.variance_usd) }}>{signed(s.variance_usd)}</Box> : "—"} sub={s ? `${s.over} over · ${s.under} under · ${s.ok} within band` : undefined} icon={s && s.variance_usd < 0 ? <TrendingDownRounded fontSize="small" /> : <TrendingUpRounded fontSize="small" />} accent={s && s.variance_usd < -0.05 ? "#DC2626" : undefined} testid="fee-kpi-variance" />
        <StatCard label="Fee recovery" value={recoveryPct === null ? "—" : `${recoveryPct.toFixed(0)}%`} sub="Charged ÷ actual gas · 100% = break-even" accent={recoveryPct !== null && recoveryPct < 90 ? "#DC2626" : recoveryPct !== null && recoveryPct > 150 ? "#0F8F86" : undefined} testid="fee-kpi-recovery" />
      </Box>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.2fr 1fr" }, alignItems: "start" }}>
        <SectionCard title="By chain" testid="fee-by-chain">
          {chains.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>No audited payouts in this range.</Typography>
          ) : (
            <Table size="small" sx={{ "& th": { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary" } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Chain</TableCell>
                  <TableCell align="right">Payouts</TableCell>
                  <TableCell align="right">Charged</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="right">Gas burned</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {chains.map(([k, c]) => (
                  <TableRow key={k} hover data-testid={`fee-chain-row-${k}`} onClick={() => { setChain(k); setPage(0); }} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ fontWeight: 700 }}>{k}</TableCell>
                    <TableCell align="right">{c.payouts} <Box component="span" sx={{ color: "text.secondary", fontSize: 11.5 }}>({c.reconciled} rec.)</Box></TableCell>
                    <TableCell align="right">{formatUSD(c.charged_usd)}</TableCell>
                    <TableCell align="right">{formatUSD(c.actual_usd)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: varianceColor(c.reconciled ? c.variance_usd : null) }}>{c.reconciled ? signed(c.variance_usd) : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{c.reconciled ? `${formatCrypto(c.actual_gas_native)} ${c.gas_token}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
        <CrumbSweeperCard />
      </Box>

      <SectionCard title="Payouts" testid="fee-rows" action={data ? <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} data-testid="fee-rows-total">{data.total.toLocaleString()} rows</Typography> : undefined}>
        {loading && !data ? (
          <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={26} /></Box>
        ) : !data || data.rows.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3, textAlign: "center" }} data-testid="fee-rows-empty">No payouts match these filters.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto", opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
            <Table size="small" sx={{ "& th": { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary", whiteSpace: "nowrap" }, "& td": { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Settled</TableCell>
                  <TableCell>Chain</TableCell>
                  <TableCell>Merchant</TableCell>
                  <TableCell align="right">Payout</TableCell>
                  <TableCell align="right">Charged fee</TableCell>
                  <TableCell align="right">Actual gas</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell>Verdict</TableCell>
                  <TableCell>Tx</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r: FeeAuditRow) => (
                  <TableRow key={r.audit_id} hover data-testid={`fee-row-${r.audit_id}`} data-status={r.status}>
                    <TableCell>{formatDateTime(r.settled_at)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{r.wallet_type}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{r.company_id ? `#${r.company_id}` : "—"}{r.transaction_id ? <Box component="span" sx={{ fontSize: 11, ml: 0.6 }}>· tx {String(r.transaction_id).slice(0, 8)}</Box> : null}</TableCell>
                    <TableCell align="right">{r.payout_amount === null ? "—" : formatCrypto(r.payout_amount)}</TableCell>
                    <TableCell align="right">
                      {formatUSD(r.charged_fee_usd)}
                      <Box component="span" sx={{ color: "text.secondary", fontSize: 11, ml: 0.6 }}>{formatCrypto(r.charged_fee_asset)}</Box>
                    </TableCell>
                    <TableCell align="right">
                      {r.actual_gas_usd === null ? <Box component="span" sx={{ color: "text.disabled" }}>—</Box> : formatUSD(r.actual_gas_usd)}
                      {r.actual_gas_native !== null && <Box component="span" sx={{ color: "text.secondary", fontSize: 11, ml: 0.6 }}>{formatCrypto(r.actual_gas_native)} {r.gas_token}</Box>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: varianceColor(r.variance_usd) }} data-testid={`fee-row-variance-${r.audit_id}`}>{r.variance_usd === null ? "—" : signed(r.variance_usd)}</TableCell>
                    <TableCell><VerdictChip verdict={r.verdict} testid={`fee-row-verdict-${r.audit_id}`} /></TableCell>
                    <TableCell>
                      {r.payout_tx_hash ? (
                        r.explorer_url ? <MuiLink href={r.explorer_url} target="_blank" rel="noopener noreferrer" sx={{ fontFamily: "monospace", fontSize: 12 }} data-testid={`fee-row-tx-${r.audit_id}`}>{short(r.payout_tx_hash)}</MuiLink> : <Box component="span" sx={{ fontFamily: "monospace", fontSize: 12 }}>{short(r.payout_tx_hash)}</Box>
                      ) : <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination component="div" count={data.total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={limit} onRowsPerPageChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[25, 50, 100, 200]} data-testid="fee-rows-pagination" />
          </Box>
        )}
      </SectionCard>
    </Box>
  );
};

export default AdminFeeReconciliation;
