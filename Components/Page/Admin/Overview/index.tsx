import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import {
  GroupsRounded,
  SouthWestRounded,
  NorthEastRounded,
  PaidRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { StatCard, SectionCard, formatUSD, formatNumber, formatCrypto } from "../adminUi";

interface RevenueRow {
  base_currency: string;
  amount: number;
  amount_in_usd: number | string;
  fee_amount: string;
  fee_in_usd: string;
}
interface Analytics {
  activeUsers: number;
  totalTransactionsIncoming: number;
  totalTransactionOutgoing: number;
  popularCurrency: { wallet_type: string; transaction_count: string | number; currency_type: string }[];
  invoicesCreatedIn30Days: { date_temp: string; invoices_created: string | number }[];
  paymentSuccessRates: { successful_payments: string; failed_payments: string; pending_payments: string }[];
  revenue_performance: RevenueRow[];
}

const AdminOverview: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminBaseApi.post("/admin/getAdminAnalytics", {});
      setData(res.data?.data || null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      dispatch({ type: TOAST_SHOW, payload: { message: msg || "Could not load analytics.", severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const derived = useMemo(() => {
    const rates = data?.paymentSuccessRates?.[0];
    const successful = Number(rates?.successful_payments) || 0;
    const failed = Number(rates?.failed_payments) || 0;
    const pending = Number(rates?.pending_payments) || 0;
    const totalOutcomes = successful + failed + pending;
    const successRate = totalOutcomes ? (successful / totalOutcomes) * 100 : 0;

    const totalRevenueUsd = (data?.revenue_performance || []).reduce(
      (s, r) => s + (Number(r.amount_in_usd) || 0),
      0
    );
    const totalFeesUsd = (data?.revenue_performance || []).reduce(
      (s, r) => s + (Number(r.fee_in_usd) || 0),
      0
    );
    const paidToMerchants = Math.max(0, totalRevenueUsd - totalFeesUsd);

    const outcomes = [
      { name: "Successful", value: successful, color: theme.palette.success.main },
      { name: "Pending", value: pending, color: theme.palette.warning.main },
      { name: "Failed", value: failed, color: theme.palette.error.main },
    ];

    const trend = (data?.invoicesCreatedIn30Days || [])
      .map((r) => ({
        date: new Date(r.date_temp),
        count: Number(r.invoices_created) || 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => ({
        label: r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: r.count,
      }));

    const topCurrencies = [...(data?.popularCurrency || [])]
      .map((c) => ({ ...c, transaction_count: Number(c.transaction_count) || 0 }))
      .filter((c) => c.transaction_count > 0)
      .sort((a, b) => b.transaction_count - a.transaction_count)
      .slice(0, 6);
    const maxCurrency = topCurrencies[0]?.transaction_count || 1;

    const revenueRows = [...(data?.revenue_performance || [])].sort(
      (a, b) => (Number(b.amount_in_usd) || 0) - (Number(a.amount_in_usd) || 0)
    );

    return {
      successful,
      failed,
      pending,
      totalOutcomes,
      successRate,
      totalRevenueUsd,
      totalFeesUsd,
      paidToMerchants,
      outcomes,
      trend,
      topCurrencies,
      maxCurrency,
      revenueRows,
    };
  }, [data, theme]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }} data-testid="admin-overview-loading">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-testid="admin-overview">
      {/* KPI cards */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={4} lg>
          <StatCard
            label="Active merchants"
            value={formatNumber(data?.activeUsers)}
            icon={<GroupsRounded />}
            accent={theme.palette.primary.main}
            testid="kpi-active-merchants"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg>
          <StatCard
            label="Incoming payments"
            value={formatNumber(data?.totalTransactionsIncoming)}
            sub="Settled payments"
            icon={<SouthWestRounded />}
            accent={theme.palette.success.main}
            testid="kpi-incoming"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg>
          <StatCard
            label="Paid to merchants"
            value={formatUSD(derived.paidToMerchants)}
            sub="Forwarded (net of fees)"
            icon={<NorthEastRounded />}
            accent={theme.palette.info?.main || theme.palette.primary.main}
            testid="kpi-payouts"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg>
          <StatCard
            label="Total volume"
            value={formatUSD(derived.totalRevenueUsd)}
            sub={`${formatUSD(derived.totalFeesUsd)} in platform fees`}
            icon={<PaidRounded />}
            accent={theme.palette.warning.main}
            testid="kpi-volume"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg>
          <StatCard
            label="Success rate"
            value={`${derived.successRate.toFixed(1)}%`}
            sub={`${formatNumber(derived.successful)} of ${formatNumber(derived.totalOutcomes)} paid`}
            icon={<CheckCircleRounded />}
            accent={theme.palette.success.main}
            testid="kpi-success-rate"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={5}>
          <SectionCard title="Payment outcomes" testid="section-outcomes">
            {derived.totalOutcomes === 0 ? (
              <Typography sx={{ color: "text.secondary", fontSize: 13, py: 4, textAlign: "center" }}>
                No payment activity yet.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ width: 180, height: 180 }}>
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={derived.outcomes}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {derived.outcomes.map((o) => (
                            <Cell key={o.name} fill={o.color} />
                          ))}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 140 }}>
                  {derived.outcomes.map((o) => (
                    <Box
                      key={o.name}
                      sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                    >
                      <Box sx={{ width: 12, height: 12, borderRadius: "3px", backgroundColor: o.color }} />
                      <Typography sx={{ fontSize: 13, flex: 1 }}>{o.name}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{formatNumber(o.value)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={7}>
          <SectionCard title="Payments created · last 30 days" testid="section-trend">
            <Box sx={{ height: 210 }}>
              {mounted && derived.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={derived.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="txArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={34} />
                    <RTooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      fill="url(#txArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Typography sx={{ color: "text.secondary", fontSize: 13, py: 6, textAlign: "center" }}>
                  No payments created in the last 30 days.
                </Typography>
              )}
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Revenue + currencies */}
      <Grid container spacing={2.5} sx={{ mt: 0.5, mb: 3 }}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Volume by currency" testid="section-revenue">
            {derived.revenueRows.length === 0 ? (
              <Typography sx={{ color: "text.secondary", fontSize: 13, py: 4, textAlign: "center" }}>
                No settled volume yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Currency</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>USD value</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Fees (USD)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {derived.revenueRows.map((r) => (
                    <TableRow key={r.base_currency} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{r.base_currency}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                        {formatCrypto(r.amount)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                        {formatUSD(r.amount_in_usd)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", color: "text.secondary" }}>
                        {formatUSD(r.fee_in_usd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <SectionCard title="Popular currencies" testid="section-currencies">
            {derived.topCurrencies.length === 0 ? (
              <Typography sx={{ color: "text.secondary", fontSize: 13, py: 4, textAlign: "center" }}>
                No transactions to rank yet.
              </Typography>
            ) : (
              derived.topCurrencies.map((c) => (
                <Box key={c.wallet_type} sx={{ mb: 1.75 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{c.wallet_type}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                      {formatNumber(c.transaction_count)} txns
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(c.transaction_count / derived.maxCurrency) * 100}
                    sx={{ height: 7, borderRadius: 4 }}
                  />
                </Box>
              ))
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminOverview;
