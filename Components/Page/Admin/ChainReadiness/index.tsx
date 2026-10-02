import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, CircularProgress, Grid, Typography, useTheme } from "@mui/material";
import { BlockRounded, CheckCircleRounded, SyncRounded, WarningAmberRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { ChainReadinessReport, chainReadinessApi } from "@/api/chainReadiness";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import { SectionCard, StatCard, formatDateTime } from "../adminUi";
import GasWalletCard from "./GasWalletCard";
import CurrencyTable from "./CurrencyTable";

const ORDER = { blocked: 0, degraded: 1, ready: 2 } as const;

/** Admin → Chain Readiness: will every supported coin settle end to end, and which gas wallet needs funding. */
const AdminChainReadiness: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [data, setData] = useState<ChainReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setData(await chainReadinessApi.report(refresh));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      dispatch({ type: TOAST_SHOW, payload: { message: msg || "Could not load chain readiness.", severity: "error" } });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);
  useRefetchOnVisible(load);

  if (loading || !data) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }} data-testid="chain-readiness-loading"><CircularProgress /></Box>;
  }

  const sorted = [...data.currencies].sort((a, b) => ORDER[a.overall] - ORDER[b.overall] || a.currency.localeCompare(b.currency));
  const needsFunding = data.gas_wallets.filter((w) => w.level !== "healthy" && w.level !== "unknown");

  return (
    <Box data-testid="chain-readiness-root">
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} data-testid="chain-readiness-generated">
          Live balances via Tatum · checked {formatDateTime(data.generated_at)}{data.cached ? " (cached ≤60s)" : ""}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => load(true)} disabled={refreshing} startIcon={refreshing ? <CircularProgress size={12} color="inherit" /> : <SyncRounded sx={{ fontSize: 16 }} />} data-testid="chain-readiness-refresh" sx={{ textTransform: "none", fontSize: 12.5 }}>
          Re-check now
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={4}>
          <StatCard label="Ready" value={data.summary.ready} sub="All checks pass" icon={<CheckCircleRounded />} accent={theme.palette.success.main} testid="chain-kpi-ready" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Degraded" value={data.summary.degraded} sub="Works, but a warning needs attention" icon={<WarningAmberRounded />} accent={theme.palette.warning.main} testid="chain-kpi-degraded" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Blocked" value={data.summary.blocked} sub="Payouts / sweeps will fail" icon={<BlockRounded />} accent={theme.palette.error.main} testid="chain-kpi-blocked" />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <SectionCard
          title="Gas & fee wallets"
          testid="chain-gas-wallets"
          action={needsFunding.length > 0 ? (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "error.main" }} data-testid="chain-gas-funding-needed">
              {needsFunding.length} wallet{needsFunding.length > 1 ? "s" : ""} need funding
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "success.main" }} data-testid="chain-gas-all-healthy">All funded</Typography>
          )}
        >
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>
            These wallets pay network gas for token payouts and fee sweeps. Send the native coin to the address shown — thresholds are the same ones the hourly e-mail alert uses.
          </Typography>
          <Grid container spacing={2}>
            {data.gas_wallets.map((w) => (
              <Grid item xs={12} md={6} xl={3} key={w.id}><GasWalletCard wallet={w} /></Grid>
            ))}
          </Grid>
        </SectionCard>
      </Box>

      <Box sx={{ mt: 2.5, mb: 3 }}>
        <SectionCard title={`Supported currencies · ${data.currencies.length}`} testid="chain-currencies">
          <CurrencyTable rows={sorted} />
        </SectionCard>
      </Box>
    </Box>
  );
};

export default AdminChainReadiness;
