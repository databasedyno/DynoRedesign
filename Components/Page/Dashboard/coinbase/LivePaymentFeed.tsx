import React, { useMemo } from "react";
import { Box, Skeleton, useTheme, keyframes } from "@mui/material";
import {
  BoltRounded,
  FiberManualRecordRounded,
  TrendingUpRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useLivePayments, LivePaymentItem } from "@/hooks/useLivePayments";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { formatCryptoAmount, isCryptoCurrency } from "@/utils/currencyFormat";
import { CB_TOKENS, SurfaceCard, Eyebrow } from "./styled";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * LivePaymentFeed — the Stripe-style activity strip that lives directly
 * below the HeroKPI on the dashboard.
 *
 * Data pipeline:
 *   `useLivePayments` polls `/api/dashboard/recent-transactions` every 20s,
 *   filters to CONFIRMED statuses, keeps last 10, exposes `newIds` for the
 *   subset that just arrived on the latest poll (used to flash them).
 *
 * Visual pattern:
 *   • Horizontal strip, chips flow left → right, newest on the LEFT
 *   • Each chip: coin dot + amount + coin symbol + tx-short-id + time-ago
 *   • New arrivals slide in with a soft indigo halo, then settle to neutral
 *   • Empty state: "Waiting for your next payment…" with a subtle pulse dot
 *
 * Accessibility:
 *   • `role="log"` + `aria-live="polite"` so screen readers announce new items
 *   • Horizontal scroll enabled with momentum on touch
 */

// Slide-in + soft indigo halo for newly arrived items
const flashIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-8px);
    box-shadow: 0 0 0 6px rgba(129,140,248,0.28);
  }
  to {
    opacity: 1;
    transform: translateX(0);
    box-shadow: 0 0 0 0 rgba(129,140,248,0);
  }
`;

// Pulse dot for the empty state
const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
`;

const COIN_COLOR: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  USDT: "#26A17B",
  "USDT-TRC20": "#26A17B",
  "USDT-ERC20": "#26A17B",
  "USDT-POLYGON": "#26A17B",
  USDC: "#2775CA",
  "USDC-ERC20": "#2775CA",
  LTC: "#345D9D",
  DOGE: "#C2A633",
  TRX: "#EB0029",
  BCH: "#0AC18E",
  SOL: "#00FFA3",
  XRP: "#00AAE4",
  POLYGON: "#8247E5",
  RLUSD: BRAND_ACCENT,
};

function coinDotColor(coin?: string | null): string {
  if (!coin) return "#6B7280";
  const key = String(coin).toUpperCase();
  if (COIN_COLOR[key]) return COIN_COLOR[key];
  // Match partial (e.g. USDT-BEP20)
  for (const k of Object.keys(COIN_COLOR)) {
    if (key.startsWith(k)) return COIN_COLOR[k];
  }
  return "#6B7280";
}

function formatAmount(n: unknown, currency?: string | null): string {
  const val = Number(n ?? 0);
  if (!Number.isFinite(val)) return "—";
  // Crypto currencies (BTC, ETH, USDT-TRC20, …) need up to 8 decimals — a
  // 2-decimal cap would render small BTC amounts like 0.00047 as "0.00".
  if (currency && isCryptoCurrency(currency)) {
    return `${formatCryptoAmount(val, currency)} ${String(currency).toUpperCase()}`;
  }
  const symbol =
    currency === "USD" || !currency
      ? "$"
      : currency === "EUR"
        ? "€"
        : currency === "GBP"
          ? "£"
          : "";
  const withComma = val.toLocaleString("en-US", {
    minimumFractionDigits: val < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return symbol
    ? `${symbol}${withComma}`
    : `${withComma} ${String(currency).toUpperCase()}`;
}

function txShortId(tx: LivePaymentItem): string {
  const src = tx.transaction_id || String(tx.id || "");
  if (!src) return "—";
  // Prefer trailing 6 chars for uniqueness
  const s = String(src);
  return s.length > 8 ? `#${s.slice(-6).toUpperCase()}` : `#${s.toUpperCase()}`;
}

interface Props {
  paused?: boolean;
}

const LivePaymentFeed: React.FC<Props> = ({ paused = false }) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const rel = useRelativeTime();
  const { items, newIds, loading, error } = useLivePayments({
    limit: 10,
    intervalMs: 20000,
    paused,
  });

  const isDark = theme.palette.mode === "dark";

  // Loading skeleton
  if (loading && items.length === 0) {
    return (
      <SurfaceCard
        data-testid="cb-live-feed"
        sx={{ p: { xs: 1.5, md: 2 }, pt: { xs: 2, md: 2.25 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.25,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BoltRounded sx={{ fontSize: 16, color: CB_TOKENS.indigo.dark }} />
            <Eyebrow>
              {t("liveFeedEyebrow", { defaultValue: "Live payments" })}
            </Eyebrow>
          </Box>
          <Skeleton width={80} height={18} />
        </Box>
        <Box sx={{ display: "flex", gap: 1.25, overflow: "hidden" }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={44}
              width={200}
              sx={{
                borderRadius: 999,
                flexShrink: 0,
                bgcolor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(10,10,15,0.05)",
              }}
            />
          ))}
        </Box>
      </SurfaceCard>
    );
  }

  // Empty state — no confirmed payments yet OR error → still show the strip
  const showEmpty = !error && items.length === 0;

  return (
    <SurfaceCard
      data-testid="cb-live-feed"
      role="log"
      aria-live="polite"
      sx={{ p: { xs: 1.5, md: 2 }, pt: { xs: 2, md: 2.25 } }}
    >
      {/* Header row: eyebrow + pulse indicator + count */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.25,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <BoltRounded
            sx={{
              fontSize: 16,
              color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
            }}
          />
          <Eyebrow data-testid="cb-live-feed-eyebrow">
            {t("liveFeedEyebrow", { defaultValue: "Live payments" })}
          </Eyebrow>
          {/* Live pulse dot */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              ml: 0.5,
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 600,
              color: isDark
                ? CB_TOKENS.ink.mutedDark
                : CB_TOKENS.ink.mutedLight,
            }}
          >
            <FiberManualRecordRounded
              sx={{
                fontSize: 8,
                color: "#05B169",
                animation: `${pulse} 2s ease-in-out infinite`,
              }}
            />
            LIVE
          </Box>
        </Box>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => router.push("/transactions")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              router.push("/transactions");
          }}
          data-testid="cb-live-feed-view-all"
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {t("viewAll", { defaultValue: "View all" })} →
        </Box>
      </Box>

      {/* Strip */}
      {showEmpty ? (
        <Box
          data-testid="cb-live-feed-empty"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 1,
            borderRadius: 999,
            border: `1px dashed ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: isDark
              ? CB_TOKENS.ink.secondaryDark
              : CB_TOKENS.ink.secondaryLight,
          }}
        >
          <FiberManualRecordRounded
            sx={{
              fontSize: 12,
              color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
              animation: `${pulse} 2s ease-in-out infinite`,
            }}
          />
          {t("liveFeedEmpty", {
            defaultValue: "Waiting for your next payment…",
          })}
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            gap: 1.25,
            overflowX: "auto",
            overflowY: "hidden",
            pb: 0.5,
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
            "&::-webkit-scrollbar": { height: 4 },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(10,10,15,0.12)",
              borderRadius: 999,
            },
          }}
        >
          {items.map((tx) => {
            const isNew = newIds.has(String(tx.transaction_id));
            const dot = coinDotColor(tx.crypto_currency || tx.base_currency);
            const label = tx.crypto_currency || tx.base_currency || "";
            return (
              <Box
                key={String(tx.transaction_id) + String(tx.id ?? "")}
                data-testid={`cb-live-feed-item${isNew ? "-new" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  router.push(`/transactions?tx=${tx.transaction_id}`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    router.push(`/transactions?tx=${tx.transaction_id}`);
                }}
                sx={{
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  height: 44,
                  px: 1.5,
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${
                    isDark
                      ? CB_TOKENS.border.dark
                      : CB_TOKENS.border.light
                  }`,
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(10,10,15,0.02)",
                  fontFamily: "var(--font-sans)",
                  transition: "transform 150ms ease, background-color 150ms ease",
                  animation: isNew ? `${flashIn} 700ms ease-out` : undefined,
                  "&:hover": {
                    transform: "translateY(-1px)",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(10,10,15,0.04)",
                  },
                }}
              >
                {/* Coin colored dot */}
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${dot}22`,
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: dot,
                    }}
                  />
                </Box>
                {/* Amount */}
                <Box
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDark
                      ? CB_TOKENS.ink.primaryDark
                      : CB_TOKENS.ink.primaryLight,
                    lineHeight: 1,
                  }}
                >
                  {formatAmount(tx.base_amount, tx.base_currency)}
                </Box>
                {/* Coin symbol */}
                {label && (
                  <Box
                    sx={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: dot,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </Box>
                )}
                {/* Tx short id — muted */}
                <Box
                  sx={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    color: isDark
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                    lineHeight: 1,
                  }}
                >
                  {txShortId(tx)}
                </Box>
                {/* Time-ago */}
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.25,
                    fontSize: 11,
                    color: isDark
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                    lineHeight: 1,
                  }}
                >
                  <TrendingUpRounded sx={{ fontSize: 10 }} />
                  {rel(tx.createdAt)}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </SurfaceCard>
  );
};

export default LivePaymentFeed;
