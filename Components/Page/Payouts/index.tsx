import { showToast } from "@/helpers/toastStore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
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
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";

import axiosBaseApi from "@/axiosConfig";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import HourglassTopRounded from "@mui/icons-material/HourglassTopRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import MailRounded from "@mui/icons-material/MailRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import Sparkline from "@/Components/UI/Sparkline";
import { useDashboardData } from "@/hooks/useDashboardData";
import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import API_ENDPOINTS from "@/api/endpoints";
import { formatDateI18n, formatRelativeTime } from "@/utils/formatDate";
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

// API-originated payments have no real customer email — the backend mints a
// synthetic placeholder (legacy-api-…@dynopay.internal etc). Never surface those.
const isInternalEmail = (v?: string) => {
  if (!v) return false;
  const s = String(v).toLowerCase();
  return (
    s.endsWith("@dynopay.internal") ||
    s.endsWith("@dynopay.local") ||
    s.startsWith("legacy-api-") ||
    s.startsWith("pk-buyer-") ||
    s.startsWith("elements-buyer-") ||
    s.startsWith("recovered-")
  );
};

const SOURCE_TYPES = new Set([
  "api", "payment_link", "tip", "product", "contribution", "direct",
]);

// A human-friendly payer label: prefer a real name/email, otherwise fall back to
// the (localized) payment source (never the synthetic internal email).
const payerLabel = (tx: any, t: (k: string, o?: any) => string): string => {
  const name = (tx?.customer_name || "").toString().trim();
  const email = (tx?.customer_email || tx?.customerEmail || "").toString().trim();
  if (email && !isInternalEmail(email)) return name || email;
  if (name && !isInternalEmail(name)) return name;
  const type = tx?.source?.type;
  if (type && SOURCE_TYPES.has(type)) return t(`payouts.source.${type}`);
  return isInternalEmail(email) ? t("payouts.source.api") : "";
};

// Amount + single ticker (e.g. "0.016338 ETH"). base_currency and crypto_currency
// are usually identical, so show the ticker exactly once.
const amountLabel = (tx: any, fallbackSym: string): string => {
  const amount = tx?.base_amount ?? tx?.amount;
  if (amount == null) return "\u2014";
  const ticker =
    tx?.crypto_currency ||
    tx?.cryptocurrency ||
    tx?.wallet_type ||
    tx?.base_currency ||
    tx?.currency ||
    fallbackSym;
  return `${amount} ${ticker}`.trim();
};

const formatDate = (v?: string) => {
  if (!v) return "";
  return formatDateI18n(v, { month: "short", day: "numeric", year: "numeric" });
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
  const ts = new Date(v).getTime();
  if (!Number.isFinite(ts)) return "";
  return formatRelativeTime(ts, "narrow");
};

const PAYMENT_WINDOW_MIN = 60;
const minutesLeftToConfirm = (v?: string) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  const left = PAYMENT_WINDOW_MIN - Math.floor((Date.now() - t) / 60000);
  return left > 0 ? left : null;
};

const RANGE_PRESETS: { value: string; labelKey: string }[] = [
  { value: "7", labelKey: "payouts.range7" },
  { value: "30", labelKey: "payouts.range30" },
  { value: "90", labelKey: "payouts.range90" },
  { value: "365", labelKey: "payouts.range365" },
  { value: "custom", labelKey: "payouts.rangeCustom" },
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

  const { t } = useTranslation("common");

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

  // Real-time nudge: when a previously-pending payment leaves the pending set
  // (confirmed → settled), toast the merchant and refresh the settlements list.
  const prevPendingIdsRef = useRef<Set<string>>(new Set());
  const pendingSeededRef = useRef(false);
  useEffect(() => {
    if (!pendingSummary) return;
    const ids = new Set<string>(
      pendingTxns
        .map((t) => String(t?.transaction_id ?? t?.id ?? ""))
        .filter(Boolean),
    );
    if (!pendingSeededRef.current) {
      prevPendingIdsRef.current = ids;
      pendingSeededRef.current = true;
      return;
    }
    const settled = [...prevPendingIdsRef.current].filter((id) => !ids.has(id));
    if (settled.length > 0) {
      showToast({
          message:
            settled.length === 1
              ? t("payoutsToast.settledOne")
              : t("payoutsToast.settledMany", { count: settled.length }),
          severity: "success",
        });
      dashboard.refreshDashboard?.();
    }
    prevPendingIdsRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSummary]);

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
  const savingsAllTimeCount: number = Number(savings?.all_time_count) || 0;
  const savingsMonthly: number[] = Array.isArray(savings?.monthly)
    ? savings.monthly.map((v: unknown) => Number(v) || 0)
    : [];

  // Weekly payout digest opt-in (notification preference).
  const { data: notifPrefs, mutate: mutateNotifPrefs } = useApiSWR<any>(
    "/notifications/preferences",
    { select: (raw) => raw?.data ?? raw },
  );
  const digestEnabled = notifPrefs?.payout_digest_weekly === true;
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestPreviewing, setDigestPreviewing] = useState(false);
  const toggleDigest = async (next: boolean) => {
    if (digestSaving) return;
    setDigestSaving(true);
    mutateNotifPrefs(
      { ...(notifPrefs || {}), payout_digest_weekly: next },
      false,
    );
    try {
      await axiosBaseApi.put("/notifications/preferences", {
        payout_digest_weekly: next,
      });
      await mutateNotifPrefs();
      showToast({
          message: next
            ? t("payouts.digestOnToast")
            : t("payouts.digestOffToast"),
          severity: "success",
        });
    } catch {
      await mutateNotifPrefs();
      showToast({
          message: t("payouts.digestUpdateError"),
          severity: "error",
        });
    } finally {
      setDigestSaving(false);
    }
  };
  const sendDigestPreview = async () => {
    if (digestPreviewing) return;
    setDigestPreviewing(true);
    try {
      await axiosBaseApi.post("/notifications/payout-digest/preview", {});
      showToast({
          message: t("payouts.digestPreviewSent"),
          severity: "success",
        });
    } catch {
      showToast({ message: t("payouts.digestPreviewError"), severity: "error" });
    } finally {
      setDigestPreviewing(false);
    }
  };

  const fmtUsd = (n: number) =>
    `$${(Number(n) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Payout history CSV export (date-ranged).
  const [exportRange, setExportRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [settledOnly, setSettledOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const handleExportPayouts = async () => {
    if (!selectedCompanyId || exporting) return;

    let dateFrom: string;
    let dateTo: string;
    if (exportRange === "custom") {
      if (!customFrom || !customTo) {
        showToast({
            message: t("payouts.exportPickDates"),
            severity: "error",
          });
        return;
      }
      const f = new Date(`${customFrom}T00:00:00`);
      const to = new Date(`${customTo}T23:59:59.999`);
      if (f > to) {
        showToast({
            message: t("payouts.exportDateOrder"),
            severity: "error",
          });
        return;
      }
      dateFrom = f.toISOString();
      dateTo = to.toISOString();
    } else {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - parseInt(exportRange, 10));
      dateFrom = from.toISOString();
      dateTo = to.toISOString();
    }

    setExporting(true);
    try {
      const res = await axiosBaseApi.post(
        "/wallet/transactions/export",
        {
          date_from: dateFrom,
          date_to: dateTo,
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
      showToast({ message: t("payouts.exportSuccess"), severity: "success" });
    } catch {
      showToast({
          message: t("payouts.exportError"),
          severity: "error",
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
      label: t("payouts.summaryTotalSettled"),
      value: loading ? null : stats?.totalVolumeFormatted || `${sym}0.00`,
      hint: t("payouts.summaryTotalSettledHint"),
    },
    {
      label: t("payouts.summaryPending"),
      value: loading ? null : `${stats?.pendingTransactions ?? 0}`,
      hint: t("payouts.summaryPendingHint"),
    },
    {
      label: t("payouts.summaryAutoConvert"),
      value: settlementLoading ? null : autoEnabled ? t("payouts.on") : t("payouts.off"),
      hint: autoEnabled
        ? t("payouts.summaryAutoConvertHintOn", { target: settlementTarget })
        : t("payouts.summaryAutoConvertHintOff"),
      accent: autoEnabled ? SUCCESS_GREEN : undefined,
    },
    {
      label: t("payouts.summaryFeeTier"),
      value: loading ? null : feeTiers?.currentTier || t("payouts.feeTierStarter"),
      hint:
        feeTiers?.currentTierPercent != null
          ? t("payouts.summaryFeeTierHintPct", { pct: feeTiers.currentTierPercent })
          : t("payouts.summaryFeeTierHintDefault"),
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
                {t("payouts.settlementTitle")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {settlementLoading
                  ? t("payouts.loading")
                  : autoEnabled
                    ? t("payouts.settlementDescOn", { target: settlementTarget })
                    : t("payouts.settlementDescOff")}
              </Typography>
            </Box>
          </Stack>
          <Tooltip
            title={
              !hasStablecoinWallet && !enabled
                ? t("payouts.addStablecoinFirst")
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
              {t("payouts.settleTo")}
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
                  {t("payouts.selectSettlementCoin")}
                </MenuItem>
                {settlementOptions.map((opt) => {
                  const val =
                    opt.wallet_type || `${opt.currency}-${opt.chain}`;
                  return (
                    <MenuItem key={val} value={val}>
                      {STABLECOIN_LABELS[opt.wallet_type || ""] ||
                        t("payouts.coinOnChain", { currency: opt.currency, chain: opt.chain })}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          {t("payouts.settlementWallets")}
        </Typography>
        {settlementLoading ? (
          <Skeleton height={48} />
        ) : settlementOptions.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.secondary }}
          >
            {t("payouts.noStablecoinWallet")}
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
                          {t("payouts.onChainInline", { chain: o.chain })}
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
                      label={t("payouts.active")}
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
      <Box sx={{ ...cardSx }} data-testid="payouts-autoconvert-savings-card">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1.5}
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
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography sx={{ fontWeight: 700 }}>
                  {t("payouts.protectionTitle")}
                </Typography>
                {savingsAllTimeCount === 1 && (
                  <Chip
                    size="small"
                    icon={<AutoAwesomeRounded sx={{ fontSize: 14 }} />}
                    label={t("payouts.firstConversion")}
                    data-testid="payouts-first-conversion-badge"
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      fontSize: 11,
                      color: SUCCESS_GREEN,
                      bgcolor: `${SUCCESS_GREEN}1A`,
                      "& .MuiChip-icon": { color: SUCCESS_GREEN, ml: 0.5 },
                      animation: "payoutsCelebratePulse 1.6s ease-in-out 3",
                      "@keyframes payoutsCelebratePulse": {
                        "0%, 100%": { transform: "scale(1)" },
                        "50%": { transform: "scale(1.06)" },
                      },
                    }}
                  />
                )}
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {savingsAllTimeCount === 1 && savingsMonthUsd > 0
                  ? t("payouts.protectionFirstDesc")
                  : savingsMonthUsd > 0
                    ? savingsMonthCount === 1
                      ? t("payouts.protectionMonthOne")
                      : t("payouts.protectionMonthMany", {
                          count: savingsMonthCount,
                        })
                    : savingsInProgress > 0
                      ? savingsInProgress === 1
                        ? t("payouts.protectionInProgressOne")
                        : t("payouts.protectionInProgressMany", {
                            count: savingsInProgress,
                          })
                      : t("payouts.protectionEmptyDesc")}
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
              {t("payouts.thisMonth")}
            </Typography>
          </Box>
        </Stack>
        {(savingsMonthly.some((v) => v > 0) || savingsAllTimeCount > 0) && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack
              direction="row"
              alignItems="flex-end"
              justifyContent="space-between"
              gap={1}
            >
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
              >
                {t("payouts.last6Months")}
              </Typography>
              <Sparkline
                points={savingsMonthly}
                width={168}
                height={36}
                color={SUCCESS_GREEN}
                ariaLabel={t("payouts.sparklineAria")}
                data-testid="payouts-savings-sparkline"
              />
            </Stack>
          </>
        )}
      </Box>

      {/* Weekly payout digest opt-in */}
      <Box
        sx={{
          ...cardSx,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
        }}
        data-testid="payouts-digest-card"
      >
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${theme.palette.primary.main}1A`,
              color: brandFg(theme.palette.mode === "dark"),
              flexShrink: 0,
            }}
          >
            <MailRounded fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }}>{t("payouts.digestTitle")}</Typography>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary }}
            >
              {t("payouts.digestDesc")}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {digestEnabled && (
            <Button
              size="small"
              variant="text"
              disabled={digestPreviewing}
              onClick={sendDigestPreview}
              data-testid="payouts-digest-preview-btn"
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              {digestPreviewing ? t("payouts.sending") : t("payouts.sendPreview")}
            </Button>
          )}
          <Switch
            checked={digestEnabled}
            onChange={(e) => toggleDigest(e.target.checked)}
            disabled={digestSaving}
            data-testid="payouts-digest-toggle"
          />
        </Stack>
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
              <Typography sx={{ fontWeight: 700 }}>{t("payouts.payoutWalletsTitle")}</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {t("payouts.payoutWalletsDesc")}
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={() => router.push("/wallet")}
            sx={{ textTransform: "none" }}
          >
            {t("payouts.manage")}
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
              <Typography sx={{ fontWeight: 700 }}>{t("payouts.taxCollectedTitle")}</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {loading
                  ? "\u2026"
                  : t("payouts.taxToDate", {
                      amount: stats?.taxCollectedFormatted || `${sym}0.00`,
                    })}
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={() => router.push("/invoices")}
            sx={{ textTransform: "none" }}
          >
            {t("payouts.receipts")}
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
              <Typography sx={{ fontWeight: 700 }}>{t("payouts.pendingFundsTitle")}</Typography>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.secondary }}
              >
                {t("payouts.pendingFundsDesc")}
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
                ? t("payouts.paymentAwaitingOne")
                : t("payouts.paymentsAwaitingMany", { count: pendingCount })}
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
            {t("payouts.pendingEmpty")}
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {pendingTxns.slice(0, 6).map((tx, i) => {
              const who = payerLabel(tx, t);
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
                      {amountLabel(tx, sym)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      {who ? `${who} \u00b7 ` : ""}
                      {started ? t("payouts.startedAgo", { time: started }) : ""}
                      {left != null
                        ? ` \u00b7 ${t("payouts.minsLeftToConfirm", { min: left })}`
                        : ""}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={t("payouts.confirming")}
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
          <Typography sx={{ fontWeight: 700 }}>{t("payouts.recentSettlements")}</Typography>
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
                    {t(r.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {exportRange === "custom" && (
              <>
                <TextField
                  size="small"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  label={t("payouts.from")}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    max: customTo || undefined,
                    "data-testid": "payouts-export-custom-from",
                  }}
                  sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
                <TextField
                  size="small"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  label={t("payouts.to")}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: customFrom || undefined,
                    "data-testid": "payouts-export-custom-to",
                  }}
                  sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={settledOnly}
                  onChange={(e) => setSettledOnly(e.target.checked)}
                  data-testid="payouts-export-settled-only"
                />
              }
              label={t("payouts.settledOnly")}
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
              {exporting ? t("payouts.exporting") : t("payouts.exportCsv")}
            </Button>
            <Button
              size="small"
              endIcon={<ArrowForwardRounded />}
              onClick={() => router.push("/transactions")}
              sx={{ textTransform: "none" }}
            >
              {t("payouts.viewAll")}
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
            {t("payouts.noPaymentsYet")}
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {txns.slice(0, 6).map((tx, i) => {
              const meta = statusMeta(tx?.status);
              const who = payerLabel(tx, t);
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
                      {amountLabel(tx, sym)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      {who || "\u2014"}
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
