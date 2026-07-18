// RecentOrdersMiniTable — compact 5-row "Recent orders" table below the fold.
// Complements LiveActivityFeed by showing more historical detail with a table shape.
import { ArrowForwardRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
  CardTitle,
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

const RecentOrdersMiniTable: React.FC<Props> = ({ loading, recentTransactions }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const rows = useMemo(() => {
    const list = Array.isArray(recentTransactions) ? recentTransactions : [];
    return list.slice(0, 5);
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
          <Eyebrow>{t("recentOrders") || "Recent orders"}</Eyebrow>
          <CardTitle sx={{ mt: 0.5, fontSize: 18 }}>
            {t("latestPayments") || "Latest payments"}
          </CardTitle>
        </Box>
        <VoltLink onClick={() => router.push("/transactions")}>
          {t("viewAll") || "See all"}
          <ArrowForwardRounded sx={{ fontSize: 14 }} />
        </VoltLink>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1.25,
                borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.06)"}`,
              }}
            >
              <Skeleton width={60} />
              <Skeleton width={"50%"} sx={{ flex: 1 }} />
              <Skeleton width={80} />
            </Box>
          ))
        ) : rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <MonoLabel>{t("noOrdersYet") || "No orders yet"}</MonoLabel>
          </Box>
        ) : (
          rows.map((tx, i) => {
            const status = mapStatus(tx?.status);
            const crypto = (tx?.crypto_currency || tx?.cryptocurrency || "").toString().toUpperCase();
            const fiat = tx?.base_currency || tx?.currency || "USD";
            const amount = Number(tx?.base_amount ?? tx?.amount ?? 0);
            const symbol = fiat === "USD" ? "$" : fiat === "EUR" ? "€" : "";
            const txId = tx?.transaction_id ?? tx?.id;

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
                  gridTemplateColumns: "70px 1fr 100px 96px",
                  gap: 1,
                  alignItems: "center",
                  py: 1.25,
                  px: 0.5,
                  cursor: "pointer",
                  minHeight: 44,
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
                  "&:last-child": {
                    borderBottom: "none",
                  },
                  [theme.breakpoints.down("sm")]: {
                    gridTemplateColumns: "1fr 80px",
                    "& > .col-hide-sm": { display: "none" },
                  },
                }}
              >
                <MonoLabel className="col-hide-sm">#{txId ?? "—"}</MonoLabel>
                <Body sx={{ fontWeight: 600, fontSize: 14 }}>
                  {symbol}
                  {amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {!symbol && ` ${fiat}`}
                </Body>
                <MonoLabel className="col-hide-sm">{crypto || "—"}</MonoLabel>
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
