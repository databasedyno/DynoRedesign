import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import HourglassTopRounded from "@mui/icons-material/HourglassTopRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useDashboardData } from "@/hooks/useDashboardData";
import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import API_ENDPOINTS from "@/api/endpoints";
import {
  brandFg,
  brandAlpha,
  SUCCESS_GREEN,
  WARNING_AMBER,
  ERROR_RED,
} from "@/constants/theme";

/**
 * Balances & Payouts (prototype) — a single "where's my money" surface that
 * pulls together settled volume, pending funds, auto-conversion status,
 * settlement wallets and recent settlements. All data is real (dashboard
 * stats + /company/auto-convert); actions link out to the existing Settings,
 * Payout wallets, Receipts and Transactions screens.
 */

interface SettlementOption {
  currency?: string;
  chain?: string;
  wallet_type?: string;
  wallet_address?: string;
}

const STABLECOIN_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC-20)",
  usdt_erc20: "USDT (ERC-20)",
  usdc_erc20: "USDC (ERC-20)",
  "USDT-TRC20": "USDT (TRC-20)",
  "USDT-ERC20": "USDT (ERC-20)",
  "USDC-ERC20": "USDC (ERC-20)",
  "USDT-POLYGON": "USDT (Polygon)",
};

const maskAddr = (a?: string) =>
  !a ? "\u2014" : a.length <= 12 ? a : `${a.slice(0, 6)}\u2026${a.slice(-4)}`;

const formatDate = (v?: string) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const statusMeta = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (
    ["complete", "success", "settled", "confirmed", "paid"].some((k) =>
      s.includes(k),
    )
  )
    return { label: status || "Settled", color: SUCCESS_GREEN };
  if (
    ["pending", "processing", "awaiting", "confirming"].some((k) =>
      s.includes(k),
    )
  )
    return { label: status || "Pending", color: WARNING_AMBER };
  if (["fail", "expire", "cancel", "error"].some((k) => s.includes(k)))
    return { label: status || "Failed", color: ERROR_RED };
  return { label: status || "\u2014", color: WARNING_AMBER };
};

// Matches the backend UNPAID_AFTER_MINUTES payment window — a fresh 'pending'
// row auto-expires (shown as 'unpaid') after this many minutes.
const relativeFromNow = (v?: string) => {
  if (!v) return "";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const PAYMENT_WINDOW_MIN = 60;
const minutesLeftToConfirm = (v?: string) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  const left = PAYMENT_WINDOW_MIN - Math.floor((Date.now() - t) / 60000);
  return left > 0 ? left : null;
};

const RANGE_PRESETS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const PayoutsPage: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const accent = brandFg(isDark);

  const dashboard = useDashboardData();
  // stats/feeTiers are read loosely: the saga populates more fields at runtime
  // (e.g. pendingTransactions) than the reducer's TS type currently declares.
  const stats: any = dashboard.stats;
  const feeTiers: any = dashboard.feeTiers;
  const recentTransactions = dashboard.recentTransactions;
  const loading = dashboard.loading;
  const { selectedCompanyId } = useCompanyStore();

  const {
    data: settlement,
    isLoading: settlementLoading,
    mutate: mutateSettlement,
  } = useApiSWR<any>(
    selectedCompanyId
      ? API_ENDPOINTS.company.autoConvert(selectedCompanyId)
      : null,
    { select: (raw) => raw?.data ?? raw },
  );

  const settlementOptions: SettlementOption[] = Array.isArray(
    settlement?.available_settlement_options,
  )
    ? settlement.available_settlement_options
    : [];

  const [enabled, setEnabled] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [toggling, setToggling] = useState(false);

  // Seed local toggle/selection state from the fetched settings.
  useEffect(() => {
    if (!settlement) return;
    setEnabled(settlement.auto_convert_enabled === true);
    const cur = settlement.settlement_currency;
    const ch = settlement.settlement_chain;
    const opts: SettlementOption[] = Array.isArray(
      settlement.available_settlement_options,
    )
      ? settlement.available_settlement_options
      : [];
    if (cur && ch) {
      const match = opts.find((o) => o.currency === cur && o.chain === ch);
      setSelectedWallet(match?.wallet_type || `${cur}-${ch}`);
    } else if (opts.length > 0) {
      setSelectedWallet(opts[0].wallet_type || "");
    }
  }, [settlement]);

  const hasStablecoinWallet = settlementOptions.length > 0;
  const autoEnabled = enabled;

  const activeOption = settlementOptions.find(
    (o) => o.wallet_type === selectedWallet,
  );
  const settlementTarget = activeOption
    ? `${activeOption.currency} \u00b7 ${activeOption.chain}`
    : settlement?.settlement_currency && settlement?.settlement_chain
      ? `${settlement.settlement_currency} \u00b7 ${settlement.settlement_chain}`
      : settlementOptions[0]
        ? `${settlementOptions[0].currency} \u00b7 ${settlementOptions[0].chain}`
        : "\u2014";

  const putAutoConvert = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!selectedCompanyId) return;
      await axiosBaseApi.put(
        API_ENDPOINTS.company.autoConvert(selectedCompanyId),
        payload,
      );
    },
    [selectedCompanyId],
  );

  const enableAutoConvert = useCallback(
    async (walletType: string) => {
      if (!walletType) return;
      const opt = settlementOptions.find((o) => o.wallet_type === walletType);
      const currency = opt?.currency || walletType.split("-")[0];
      const chain = opt?.chain || walletType.split("-")[1];
      setToggling(true);
      setEnabled(true);
      setSelectedWallet(walletType);
      try {
        await putAutoConvert({
          auto_convert_enabled: true,
          settlement_currency: currency,
          settlement_chain: chain,
        });
        await mutateSettlement();
      } catch {
        setEnabled(false);
      } finally {
        setToggling(false);
      }
    },
    [settlementOptions, putAutoConvert, mutateSettlement],
  );

  const disableAutoConvert = useCallback(async () => {
    setToggling(true);
    setEnabled(false);
    try {
      await putAutoConvert({ auto_convert_enabled: false });
      await mutateSettlement();
    } catch {
      setEnabled(true);
    } finally {
      setToggling(false);
    }
  }, [putAutoConvert, mutateSettlement]);

  const handleToggle = () => {
    if (!selectedCompanyId || toggling) return;
    if (enabled) {
      disableAutoConvert();
      return;
    }
    if (!hasStablecoinWallet) return;
    enableAutoConvert(selectedWallet || settlementOptions[0]?.wallet_type || "");
  };

  const handleCoinChange = (walletType: string) => {
    setSelectedWallet(walletType);
    if (enabled) enableAutoConvert(walletType);
  };

  const toggleDisabled = toggling || (!hasStablecoinWallet && !enabled);

  const dispatch = useDispatch();

  // Pending funds — awaiting on-chain confirmation. Dedicated endpoint returns
  // fresh-pending rows + an accurate USD total (server converts crypto → USD).
  const { data: pendingSummary } = useApiSWR<any>(
    selectedCompanyId
      ? `/dashboard/pending-summary?company_id=${selectedCompanyId}`
      : null,
    {
      select: (raw) => raw?.data ?? raw,
      refreshInterval: 30000,
    },
  );
  const pendingTxns: any[] = Array.isArray(pendingSummary?.transactions)
    ? pendingSummary.transactions
    : [];
  const pendingCount: number = pendingSummary?.count ?? pendingTxns.length;
  const pendingTotalUsd: number = Number(pendingSummary?.total_usd) || 0;

  // Auto-convert "volatility protection" — value locked into stablecoins.
  const { data: savings } = useApiSWR<any>(
    selectedCompanyId
      ? `/company/conversion-savings/${selectedCompanyId}`
      : null,
    { select: (raw) => raw?.data ?? raw },
  );
  const savingsMonthUsd: number = Number(savings?.month_converted_usd) || 0;
  const savingsMonthCount: number = Number(savings?.month_count) || 0;
  const savingsInProgress: number = Number(savings?.in_progress_count) || 0;

  const fmtUsd = (n: number) =>
    `$${(Number(n) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Payout history CSV export (date-ranged).
  const [exportRange, setExportRange] = useState("30");
  const [settledOnly, setSettledOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const handleExportPayouts = async () => {
    if (!selectedCompanyId || exporting) return;
    setExporting(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - parseInt(exportRange, 10));
      const res = await axiosBaseApi.post(
        "/wallet/transactions/export",
        {
          date_from: from.toISOString(),
          date_to: to.toISOString(),
          company_id: String(selectedCompanyId),
          settled_only: settledOnly,
        },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], {
        type: res.headers?.["content-type"] || "text/csv",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `payout_history_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Payout history exported", severity: "success" },
      });
    } catch {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: "Export failed. Please try again.",
          severity: "error",
        },
      });
    } finally {
      setExporting(false);
    }
  };

  const txns: any[] = Array.isArray(recentTransactions)
    ? recentTransactions
    : [];
  const sym = stats?.currencySymbol || "$";

  const cardSx = {
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    bgcolor: theme.palette.background.paper,
    p: { xs: 2, sm: 2.5 },
  } as const;

  const summary: {
    label: string;
    value: string | null;
    hint: string;
    accent?: string;
  }[] = [
    {
      label: "Total settled",
      value: loading ? null : stats?.totalVolumeFormatted || `${sym}0.00`,
      hint: "Lifetime volume received",
    },
    {
      label: "Pending",
      value: loading ? null : `${stats?.pendingTransactions ?? 0}`,
      hint: "Payments awaiting confirmation",
    },
    {
      label: "Auto\u2011convert",
      value: settlementLoading ? null : autoEnabled ? "On" : "Off",
      hint: autoEnabled
        ? `Settling to ${settlementTarget}`
        : "Convert crypto to a stablecoin",
      accent: autoEnabled ? SUCCESS_GREEN : undefined,
    },
    {
      label: "Fee tier",
      value: loading ? null : feeTiers?.currentTier || "Starter",
      hint:
        feeTiers?.currentTierPercent != null
          ? `${feeTiers.currentTierPercent}% per transaction`
          : "Your current pricing",
    },
  ];

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 3 } }}
    >
      {/* Summary strip */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        {summary.map((c) => (
          <Box key={c.label} sx={cardSx}>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {c.label}
            </Typography>
            {c.value === null ? (
              <Skeleton width="70%" height={34} />
            ) : (
              <Typography
                sx={{
                  fontSize: { xs: 20, sm: 24 },
                  fontWeight: 700,
                  mt: 0.5,
                  color: c.accent || theme.palette.text.primary,
                  lineHeight: 1.2,
                }}
              >
                {c.value}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                display: "block",
                mt: 0.5,
              }}
            >
              {c.hint}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Settlement & auto-convert */}
      <Box sx={cardSx}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: brandAlpha(0.12),
                color: accent,
              }}
            >
              <AutorenewRounded fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                Settlement & auto-convert
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {settlementLoading
                  ? "Loading\u2026"
                  : autoEnabled
                    ? `Incoming crypto auto\u2011converts to ${settlementTarget}`
                    : "Auto\u2011convert is off \u2014 payments settle in the coin received"}
              </Typography>
            </Box>
          </Stack>
          <Tooltip
            title={
              !hasStablecoinWallet && !enabled
                ? "Add a stablecoin settlement wallet first"
                : ""
            }
            arrow
            placement="top"
          >
            <span>
              <Switch
                checked={enabled}
                onChange={handleToggle}
                disabled={toggleDisabled}
                data-testid="payouts-autoconvert-toggle"
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: SUCCESS_GREEN,
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: SUCCESS_GREEN,
                  },
                }}
              />
            </span>
          </Tooltip>
        </Stack>

        {hasStablecoinWallet && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1}
            sx={{ mt: 2 }}
          >
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
            >
              Settle to
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedWallet}
                onChange={(e) => handleCoinChange(e.target.value as string)}
                displayEmpty
                data-testid="payouts-settlement-coin-select"
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                <MenuItem value="" disabled>
                  Select settlement coin
                </MenuItem>
                {settlementOptions.map((opt) => {
                  const val =
                    opt.wallet_type || `${opt.currency}-${opt.chain}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {STABLECOIN_LABELS[opt.wallet_type || ""] ||
                        `${opt.currency} on ${opt.chain}`}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Settlement wallets
        </Typography>
        {settlementLoading ? (
          <Skeleton height={48} />
        ) : settlementOptions.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.secondary }}
          >
            No stablecoin settlement wallet configured yet. Add one in Settings
            to auto-convert payouts.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {settlementOptions.map((o, i) => {
              const isActive =
                autoEnabled &&
                settlement?.settlement_currency === o.currency &&
                settlement?.settlement_chain === o.chain;
              return (
                <Stack
                  key={o.wallet_type || i}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 1 }}
                >
                  <Stack direction="row" alignItems="center" gap={1.25}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: theme.palette.action.hover,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {(o.currency || "?").slice(0, 3)}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                        {o.currency || o.wallet_type}{" "}
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          on {o.chain}
                        </Typography>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.secondary,
                          fontFamily: "monospace",
                        }}
                      >
                        {maskAddr(o.wallet_address)}
                      </Typography>
                    </Box>
                  </Stack>
                  {isActive && (
                    <Chip
                      size="small"
                      label="Active"
                      sx={{
                        color: SUCCESS_GREEN,
                        bgcolor: `${SUCCESS_GREEN}1A`,
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Auto-convert protection */}
      <Box
        sx={{
          ...cardSx,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
        data-testid="payouts-autoconvert-savings-card"
      >
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${SUCCESS_GREEN}1A`,
              color: SUCCESS_GREEN,
              flexShrink: 0,
            }}
          >
            <ShieldRounded fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }}>
              Auto-convert protection
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary }}
            >
              {savingsMonthUsd > 0
                ? `Locked into stablecoins this month across ${savingsMonthCount} ${
                    savingsMonthCount === 1 ? "payment" : "payments"
                  } — shielded from crypto volatility`
                : savingsInProgress > 0
                  ? `${savingsInProgress} conversion${
                      savingsInProgress === 1 ? "" : "s"
                    } in progress — protecting your revenue`
                  : "Turn on auto-convert to lock incoming crypto into stablecoins"}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography
            data-testid="payouts-savings-month"
            sx={{
              fontSize: { xs: 20, sm: 24 },
              fontWeight: 800,
              lineHeight: 1.1,
              color: savingsMonthUsd > 0 ? SUCCESS_GREEN : theme.palette.text.primary,
            }}
          >
            {fmtUsd(savingsMonthUsd)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            This month
          </Typography>
        </Box>
      </Box>

      {/* Payout destinations + tax quick links */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <Box
          sx={{
            ...cardSx,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: brandAlpha(0.12),
                color: accent,
              }}
            >
              <AccountBalanceWalletRounded fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Payout wallets</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                Where your settled funds land
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={() => router.push("/wallet")}
            sx={{ textTransform: "none" }}
          >
            Manage
          </Button>
        </Box>
        <Box
          sx={{
            ...cardSx,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: brandAlpha(0.12),
                color: accent,
              }}
            >
              <ReceiptLongRounded fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Tax collected</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {loading
                  ? "\u2026"
                  : stats?.taxCollectedFormatted || `${sym}0.00`}{" "}
                to date
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={() => router.push("/invoices")}
            sx={{ textTransform: "none" }}
          >
            Receipts
          </Button>
        </Box>
      </Box>

      {/* Pending funds */}
      <Box sx={cardSx} data-testid="payouts-pending-funds-card">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: `${WARNING_AMBER}1A`,
                color: WARNING_AMBER,
              }}
            >
              <HourglassTopRounded fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Pending funds</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                Payments awaiting on-chain confirmation
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ textAlign: "right" }}>
            <Typography
              data-testid="payouts-pending-total"
              sx={{
                fontSize: { xs: 18, sm: 22 },
                fontWeight: 800,
                lineHeight: 1.1,
                color: pendingTotalUsd > 0 ? WARNING_AMBER : theme.palette.text.primary,
              }}
            >
              {`\u2248 ${fmtUsd(pendingTotalUsd)}`}
            </Typography>
            <Typography
              variant="caption"
              data-testid="payouts-pending-count"
              sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
            >
              {pendingCount === 1
                ? "1 payment awaiting"
                : `${pendingCount} payments awaiting`}
            </Typography>
          </Box>
        </Stack>
        {pendingTxns.length === 0 ? (
          <Typography
            variant="body2"
            data-testid="payouts-pending-empty"
            sx={{
              color: theme.palette.text.secondary,
              py: 1.5,
              textAlign: "center",
            }}
          >
            No payments awaiting confirmation right now.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {pendingTxns.slice(0, 6).map((tx, i) => {
              const amount = tx?.base_amount ?? tx?.amount;
              const cur = tx?.base_currency || sym;
              const coin = tx?.crypto_currency || tx?.wallet_type;
              const who = (
                tx?.customer_name ||
                tx?.customer_email ||
                ""
              ).toString();
              const started = relativeFromNow(tx?.createdAt || tx?.created_at);
              const left = minutesLeftToConfirm(tx?.createdAt || tx?.created_at);
              return (
                <Stack
                  key={tx?.transaction_id || tx?.id || i}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 1.25 }}
                  data-testid={`payouts-pending-row-${i}`}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                      {amount != null ? `${cur} ${amount}` : "\u2014"}{" "}
                      {coin ? (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          · {coin}
                        </Typography>
                      ) : null}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      {who ? `${who} \u00b7 ` : ""}
                      {started ? `started ${started}` : ""}
                      {left != null ? ` \u00b7 ~${left}m left to confirm` : ""}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label="Confirming"
                    sx={{
                      color: WARNING_AMBER,
                      bgcolor: `${WARNING_AMBER}1A`,
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Recent settlements */}
      <Box sx={cardSx}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Recent settlements</Typography>
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            flexWrap="wrap"
            justifyContent="flex-end"
          >
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={exportRange}
                onChange={(e) => setExportRange(e.target.value as string)}
                data-testid="payouts-export-range-select"
                sx={{ borderRadius: 2, fontSize: 13 }}
              >
                {RANGE_PRESETS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={settledOnly}
                  onChange={(e) => setSettledOnly(e.target.checked)}
                  data-testid="payouts-export-settled-only"
                />
              }
              label="Settled only"
              sx={{
                m: 0,
                "& .MuiFormControlLabel-label": { fontSize: 13 },
              }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={exporting || !selectedCompanyId}
              onClick={handleExportPayouts}
              data-testid="payouts-export-csv-btn"
              startIcon={
                exporting ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <FileDownloadRounded />
                )
              }
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              {exporting ? "Exporting\u2026" : "Export CSV"}
            </Button>
            <Button
              size="small"
              endIcon={<ArrowForwardRounded />}
              onClick={() => router.push("/transactions")}
              sx={{ textTransform: "none" }}
            >
              View all
            </Button>
          </Stack>
        </Stack>
        {loading ? (
          <Stack spacing={1}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        ) : txns.length === 0 ? (
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
              py: 2,
              textAlign: "center",
            }}
          >
            No payments yet. Your settled payments will appear here.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {txns.slice(0, 6).map((tx, i) => {
              const meta = statusMeta(tx?.status);
              const amount = tx?.base_amount ?? tx?.amount;
              const cur = tx?.base_currency || tx?.currency || sym;
              const coin = tx?.crypto_currency || tx?.cryptocurrency;
              const email = (
                tx?.customerEmail ||
                tx?.customer_email ||
                ""
              ).toString();
              const date = formatDate(tx?.createdAt || tx?.created_at);
              return (
                <Stack
                  key={tx?.id || i}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 1.25 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                      {amount != null ? `${cur} ${amount}` : "\u2014"}{" "}
                      {coin ? (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          · {coin}
                        </Typography>
                      ) : null}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      {email || "\u2014"}
                      {date ? ` \u00b7 ${date}` : ""}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={meta.label}
                    sx={{
                      color: meta.color,
                      bgcolor: `${meta.color}1A`,
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default PayoutsPage;
