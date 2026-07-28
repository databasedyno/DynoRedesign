// LiveActivityFeed — the "where's it flowing?" answer.
// Compact row-based feed of recent transactions with coin badges,
// amounts, chain pills and status pills. Whole rows are clickable.
import { ArrowForwardRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
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

// Map status string → StatusPill variant.
const mapStatus = (status: string): "settled" | "pending" | "confirming" | "failed" => {
  const s = String(status || "").toLowerCase();
  if (["confirmed", "completed", "settled", "success", "successful", "paid"].includes(s))
    return "settled";
  if (["confirming", "processing"].includes(s)) return "confirming";
  if (["failed", "error", "rejected", "declined", "cancelled", "canceled"].includes(s))
    return "failed";
  return "pending";
};

// Relative time — "just now", "3m", "2h", "5d".
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
  if (!Number.isFinite(n)) return `${currency} ${v ?? "0"}`;
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  return symbol
    ? `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${n.toFixed(2)} ${currency}`;
};

const LiveActivityFeed: React.FC<Props> = ({ loading, recentTransactions }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const list = useMemo(() => {
    const raw = Array.isArray(recentTransactions) ? recentTransactions : [];
    return raw.slice(0, 6);
  }, [recentTransactions]);

  return (
    <SurfaceCard
      data-testid="aurora-activity-feed"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4F46E5",
              boxShadow: "0 0 0 3px rgba(204,255,0,0.22)",
              animation: "pulse 2.4s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                "50%": { opacity: 0.75, transform: "scale(0.94)" },
              },
            }}
          />
          <Eyebrow>{t("liveActivity") || "Live · Activity"}</Eyebrow>
        </Box>

        <VoltLink onClick={() => router.push("/transactions")} data-testid="activity-see-all">
          {t("viewAll") || "See all"}
          <ArrowForwardRounded sx={{ fontSize: 14 }} />
        </VoltLink>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1.5,
                borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)"}`,
              }}
            >
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={"70%"} />
                <Skeleton width={"40%"} />
              </Box>
              <Skeleton width={70} />
            </Box>
          ))
        ) : list.length === 0 ? (
          <Box
            sx={{
              py: 4,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.75,
            }}
          >
            <Body sx={{ fontWeight: 600 }}>
              {t("noTransactionsYet") || "No transactions yet"}
            </Body>
            <MonoLabel sx={{ maxWidth: 320 }}>
              {t("noTransactionsDesc") ||
                "Once your first payment lands, it will appear here in real-time."}
            </MonoLabel>
          </Box>
        ) : (
          list.map((tx, i) => {
            const status = mapStatus(tx?.status);
            const crypto = (tx?.crypto_currency || tx?.cryptocurrency || "").toString().toUpperCase();
            const fiat = tx?.base_currency || tx?.currency || "USD";
            const amount = fmtMoney(tx?.base_amount ?? tx?.amount, fiat);
            const when = relTime(tx?.createdAt || tx?.created_at);
            const cryptoAmount = tx?.crypto_amount ? String(tx.crypto_amount) : "";
            const txId = tx?.transaction_id ?? tx?.id;
            const symbol = (crypto || "?").slice(0, 3);

            return (
              <motion.div
                key={String(txId ?? i)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.04 }}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    txId != null && router.push(`/transactions?tx=${txId}`)
                  }
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && txId != null) {
                      e.preventDefault();
                      router.push(`/transactions?tx=${txId}`);
                    }
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    py: 1.5,
                    px: 0.5,
                    borderRadius: 10,
                    cursor: "pointer",
                    minHeight: 56,
                    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)"}`,
                    transition: "background 180ms ease",
                    "&:hover": {
                      background: dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
                    },
                    "&:focus-visible": {
                      outline: `2px solid #FF5B49`,
                      outlineOffset: 2,
                    },
                    "&:last-child": {
                      borderBottom: "none",
                    },
                  }}
                  data-testid="activity-feed-row"
                >
                  <CoinBadge>{symbol}</CoinBadge>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                      <Typography
                        sx={{
                          fontFamily: "var(--font-hero)",
                          fontWeight: 600,
                          fontSize: 15,
                          color: dark ? "#F5F5F5" : "#0A0A0A",
                          lineHeight: 1.2,
                        }}
                      >
                        {amount}
                      </Typography>
                      {cryptoAmount && (
                        <MonoLabel sx={{ fontSize: 11 }}>
                          {cryptoAmount} {crypto}
                        </MonoLabel>
                      )}
                    </Box>
                    <MonoLabel sx={{ mt: 0.25 }}>
                      {crypto || "—"}{when ? ` · ${when}` : ""}
                    </MonoLabel>
                  </Box>

                  <StatusPill variant={status}>
                    <span className="dot" />
                    {status}
                  </StatusPill>
                </Box>
              </motion.div>
            );
          })
        )}
      </Box>
    </SurfaceCard>
  );
};

export default memo(LiveActivityFeed);
