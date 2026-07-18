// RecentOrdersMiniTable — richer Aurora "Recent transactions" table (upgraded
// 2026-07-18). Table-shaped list below the fold: coin badge · fiat + crypto
// amount · relative time · status pill. Complements LiveActivityFeed with more
// rows and columnar detail. Rows deep-link into /transactions?tx=<id>.
import { ArrowForwardRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CardTitle,
  CoinBadge,
  Eyebrow,
  MonoLabel,
  StatusPill,
  SurfaceCard,
  VoltLink,
} from "./styled";

interface Props {
  loading: boolean;
  recentTransactions: any[];
}

const mapStatus = (status: string): "settled" | "pending" | "confirming" | "failed" => {
  const s = String(status || "").toLowerCase();
  if (["confirmed", "completed", "settled", "success", "successful", "paid"].includes(s))
    return "settled";
  if (["confirming", "processing"].includes(s)) return "confirming";
  if (["failed", "error", "rejected", "declined", "cancelled", "canceled"].includes(s))
    return "failed";
  return "pending";
};

const relTime = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const fmtMoney = (v: any, currency: string) => {
  const n = Number(v);
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  if (!Number.isFinite(n)) return `${currency} ${v ?? "0"}`;
  return symbol
    ? `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${n.toFixed(2)} ${currency}`;
};

const RecentOrdersMiniTable: React.FC<Props> = ({ loading, recentTransactions }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const rows = useMemo(() => {
    const list = Array.isArray(recentTransactions) ? recentTransactions : [];
    return list.slice(0, 8);
  }, [recentTransactions]);

  return (
    <SurfaceCard
      data-testid="aurora-recent-orders"
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Eyebrow>{t("recentOrders", { defaultValue: "Recent transactions" })}</Eyebrow>
          <CardTitle sx={{ mt: 0.5, fontSize: 18 }}>
            {t("latestPayments", { defaultValue: "Latest payments" })}
          </CardTitle>
        </Box>
        <VoltLink onClick={() => router.push("/transactions")} data-testid="recent-see-all">
          {t("viewAll", { defaultValue: "See all" })}
          <ArrowForwardRounded sx={{ fontSize: 14 }} />
        </VoltLink>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.25,
                borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)"}`,
              }}
            >
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={"60%"} />
                <Skeleton width={"35%"} />
              </Box>
              <Skeleton width={80} />
            </Box>
          ))
        ) : rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <MonoLabel>{t("noOrdersYet", { defaultValue: "No transactions yet" })}</MonoLabel>
          </Box>
        ) : (
          rows.map((tx, i) => {
            const status = mapStatus(tx?.status);
            const crypto = (tx?.crypto_currency || tx?.cryptocurrency || "").toString().toUpperCase();
            const fiat = tx?.base_currency || tx?.currency || "USD";
            const amount = fmtMoney(tx?.base_amount ?? tx?.amount, fiat);
            const cryptoAmount = tx?.crypto_amount ? String(tx.crypto_amount) : "";
            const when = relTime(tx?.createdAt || tx?.created_at);
            const txId = tx?.transaction_id ?? tx?.id;
            const symbol = (crypto || "?").slice(0, 3);

            return (
              <Box
                key={String(txId ?? i)}
                role="button"
                tabIndex={0}
                onClick={() => txId != null && router.push(`/transactions?tx=${txId}`)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && txId != null) {
                    e.preventDefault();
                    router.push(`/transactions?tx=${txId}`);
                  }
                }}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 108px 96px",
                  gap: 1.25,
                  alignItems: "center",
                  py: 1.25,
                  px: 0.5,
                  cursor: "pointer",
                  minHeight: 56,
                  borderRadius: 8,
                  borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)"}`,
                  transition: "background 180ms ease",
                  "&:hover": {
                    background: dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
                  },
                  "&:focus-visible": {
                    outline: `2px solid #FF5B49`,
                    outlineOffset: 2,
                  },
                  "&:last-child": { borderBottom: "none" },
                  [theme.breakpoints.down("sm")]: {
                    gridTemplateColumns: "36px 1fr auto",
                    "& > .col-hide-sm": { display: "none" },
                  },
                }}
              >
                <CoinBadge>{symbol}</CoinBadge>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-hero)",
                      fontWeight: 600,
                      fontSize: 14.5,
                      color: dark ? "#F5F5F5" : "#0A0A0A",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {amount}
                  </Typography>
                  <MonoLabel sx={{ mt: 0.25, fontSize: 11 }} noWrap>
                    {cryptoAmount ? `${cryptoAmount} ${crypto}` : crypto || "—"}
                  </MonoLabel>
                </Box>

                <MonoLabel className="col-hide-sm" sx={{ fontSize: 11 }}>
                  {when || "—"}
                </MonoLabel>

                <StatusPill variant={status}>
                  <span className="dot" />
                  {status}
                </StatusPill>
              </Box>
            );
          })
        )}
      </Box>
    </SurfaceCard>
  );
};

export default memo(RecentOrdersMiniTable);
