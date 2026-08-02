import React, { useMemo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import {
  ArrowForwardIosRounded,
  CurrencyBitcoinRounded,
  PaidRounded,
  HourglassEmptyRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatNumberWithComma } from "@/helpers";
import { CB_TOKENS, SurfaceCard } from "./styled";

/**
 * AssetBreakdownRows — the Coinbase Crypto/Cash/Futures rows, adapted for
 * a merchant. Shows a compact 3-row summary at the bottom of the LEFT fold:
 *
 *   1. Crypto received (settled) — total volume across all confirmed txs
 *   2. Fiat converted — cumulative converted-to-fiat amount (from stats)
 *   3. Pending — count of transactions awaiting confirmation
 *
 * Each row is a link — clicking navigates to /transactions with a
 * pre-filtered query (status=confirmed / status=pending etc.).
 */

type RowSpec = {
  id: string;
  icon: React.ReactElement;
  label: string;
  meta: string;
  value: string;
  href: string;
};

const AssetBreakdownRows: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { stats, recentTransactions, loading } = useDashboardData();
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const walletsCount = walletState.walletList?.length ?? 0;

  const currencySymbol = stats?.currencySymbol || "$";

  // Derive breakdown from stats + recentTransactions
  const rows = useMemo<RowSpec[]>(() => {
    const totalVolFmt = stats?.totalVolumeFormatted || `${currencySymbol}0.00`;
    const list = (recentTransactions as any[]) || [];
    // Count pending in the recent list — a rough indicator; users click through for the full count
    const pendingCount = list.filter((tx) => {
      const s = String(tx?.status || "").toLowerCase();
      return s === "pending" || s === "confirming" || s === "processing";
    }).length;

    const invoiceCount = Number(stats?.totalTransactions ?? 0);

    return [
      {
        id: "crypto",
        icon: <CurrencyBitcoinRounded sx={{ fontSize: 20 }} />,
        label: t("assetCrypto", { defaultValue: "Crypto" }),
        meta: t("assetCryptoMeta", {
          defaultValue: "Across {{count}} wallets",
          count: walletsCount,
        }),
        value: totalVolFmt,
        href: "/transactions",
      },
      {
        id: "fiat",
        icon: <PaidRounded sx={{ fontSize: 20 }} />,
        label: t("assetFiat", { defaultValue: "Fiat converted" }),
        meta: t("assetFiatMeta", {
          defaultValue: "Auto-converted to your base currency",
        }),
        value:
          stats?.taxCollectedFormatted && Number(stats.taxCollected) > 0
            ? `${currencySymbol}${formatNumberWithComma(Number(stats.taxCollected))}`
            : totalVolFmt,
        href: "/transactions?converted=true",
      },
      {
        id: "pending",
        icon: <HourglassEmptyRounded sx={{ fontSize: 20 }} />,
        label: t("assetPending", { defaultValue: "Pending" }),
        meta: t("assetPendingMeta", {
          defaultValue: "{{count}} waiting for confirmation",
          count: pendingCount,
        }),
        value: `${pendingCount}`,
        href: "/transactions?status=pending",
      },
      {
        id: "invoices",
        icon: <ReceiptLongRounded sx={{ fontSize: 20 }} />,
        label: t("assetInvoices", { defaultValue: "Total payments" }),
        meta: t("assetInvoicesMeta", {
          defaultValue: "Lifetime transaction count",
        }),
        value: formatNumberWithComma(invoiceCount),
        href: "/transactions",
      },
    ];
  }, [
    stats,
    recentTransactions,
    walletsCount,
    t,
    currencySymbol,
  ]);

  return (
    <SurfaceCard
      data-testid="cb-asset-breakdown"
      sx={{ p: { xs: 1.5, md: 2 } }}
    >
      {rows.map((r, idx) => (
        <Box
          key={r.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(r.href)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push(r.href);
          }}
          data-testid={`cb-asset-row-${r.id}`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: { xs: "12px 12px", md: "16px 12px" },
            borderRadius: 12,
            cursor: "pointer",
            borderBottom:
              idx < rows.length - 1
                ? `1px solid ${
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.border.dark
                      : CB_TOKENS.border.light
                  }`
                : "none",
            transition: "background-color 150ms ease",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(10,10,15,0.02)",
            },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.indigo.darkGlow
                  : CB_TOKENS.indigo.lightGlow,
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.indigo.dark
                  : CB_TOKENS.indigo.light,
              flexShrink: 0,
            }}
          >
            {r.icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.primaryDark
                    : CB_TOKENS.ink.primaryLight,
                lineHeight: 1.3,
              }}
            >
              {r.label}
            </Box>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                color:
                  theme.palette.mode === "dark"
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight,
                mt: 0.25,
              }}
            >
              {r.meta}
            </Box>
          </Box>
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 600,
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.ink.primaryDark
                  : CB_TOKENS.ink.primaryLight,
              textAlign: "right",
            }}
          >
            {loading ? <Skeleton width={60} /> : r.value}
          </Box>
          <ArrowForwardIosRounded
            sx={{
              fontSize: 14,
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.ink.mutedDark
                  : CB_TOKENS.ink.mutedLight,
              flexShrink: 0,
            }}
          />
        </Box>
      ))}
    </SurfaceCard>
  );
};

export default AssetBreakdownRows;
