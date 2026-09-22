import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from "@mui/material";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { CrumbSweepReport, feeReconciliationApi } from "@/api/feeReconciliation";
import { SectionCard, formatCrypto, formatDateTime, formatUSD } from "../adminUi";

const Stat = ({ label, value, testid }: { label: string; value: React.ReactNode; testid: string }) => (
  <Box data-testid={testid}>
    <Typography sx={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{value}</Typography>
  </Box>
);

/** TRON pool crumb sweeper: last report + run (dry-run or live). Polls while a run is in progress. */
export const CrumbSweeperCard: React.FC = () => {
  const dispatch = useDispatch();
  const [report, setReport] = useState<CrumbSweepReport | null>(null);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await feeReconciliationApi.crumbReport();
      setReport(r.report);
      setRunning(r.running);
    } catch {
      /* card is secondary — stay quiet */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const start = async (dryRun: boolean) => {
    setStarting(true);
    setConfirmLive(false);
    try {
      await feeReconciliationApi.startCrumbSweep(dryRun);
      setRunning(true);
      dispatch({ type: TOAST_SHOW, payload: { message: dryRun ? "Dry run started — scanning pool addresses." : "Crumb sweep started — this moves real USDT/TRX on-chain.", severity: "success" } });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      dispatch({ type: TOAST_SHOW, payload: { message: msg || "Could not start the sweep.", severity: "error" } });
    } finally {
      setStarting(false);
    }
  };

  const t = report?.totals;
  return (
    <SectionCard
      title="TRON pool crumb sweeper"
      testid="fee-crumb-card"
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" disabled={running || starting} onClick={() => void start(true)} data-testid="fee-crumb-dry-run" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>Dry run</Button>
          <Button size="small" variant="contained" color="warning" disabled={running || starting} onClick={() => setConfirmLive(true)} data-testid="fee-crumb-run" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99 }}>Sweep now</Button>
        </Stack>
      }
    >
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        Consolidates stranded USDT-TRC20 from temporary pool addresses into the admin wallet and reclaims leftover TRX gas. Runs weekly on its own; use Dry run to preview.
      </Typography>
      {!loaded ? (
        <CircularProgress size={20} />
      ) : (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={running ? "Running…" : report ? (report.dryRun ? "Last run: dry run" : "Last run: live") : "Never run"} color={running ? "warning" : "default"} variant={running ? "filled" : "outlined"} data-testid="fee-crumb-state" sx={{ fontWeight: 600 }} />
            {report && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} data-testid="fee-crumb-when">{formatDateTime(report.finishedAt || report.startedAt)} · scanned {report.scanned} addresses{report.scanErrors ? ` · ${report.scanErrors} scan errors` : ""}</Typography>}
          </Stack>
          {report && t && (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
              <Stat label="Swept USDT" value={formatCrypto(t.sweptUsdt)} testid="fee-crumb-swept" />
              <Stat label="Reclaimed TRX" value={formatCrypto(t.reclaimedTrx)} testid="fee-crumb-reclaimed" />
              <Stat label="Still stranded" value={`${formatCrypto(t.strandedUsdt)} USDT`} testid="fee-crumb-stranded" />
              <Stat label="Counters fixed" value={`${report.reconciled.zeroed + report.reconciled.corrected}`} testid="fee-crumb-reconciled" />
            </Box>
          )}
          {report && (
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1.5 }}>
              {report.swept.length} sweep tx · {report.reclaimed.length} reclaim tx · {report.skipped.length} skipped (below {formatUSD(report.thresholdUsd)}) · gas est. {formatCrypto(report.gas.estimateTrx)} TRX ≈ {formatUSD(report.gas.estimateUsd)}
              {report.errors.length > 0 && <Box component="span" sx={{ color: "error.main" }}> · {report.errors.length} errors</Box>}
            </Typography>
          )}
        </>
      )}
      <Dialog open={confirmLive} onClose={() => setConfirmLive(false)} data-testid="fee-crumb-confirm">
        <DialogTitle sx={{ fontWeight: 800 }}>Sweep pool crumbs now?</DialogTitle>
        <DialogContent>
          <DialogContentText>This broadcasts real TRON transactions: every temporary address holding more than the threshold is swept to the admin USDT wallet and leftover TRX is reclaimed. It cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLive(false)} data-testid="fee-crumb-confirm-cancel" sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => void start(false)} data-testid="fee-crumb-confirm-run" sx={{ textTransform: "none", fontWeight: 700 }}>Sweep now</Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
};

export default CrumbSweeperCard;
