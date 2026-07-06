import PanelCard from "@/Components/UI/PanelCard";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowOutward, CheckCircleRounded, HourglassEmptyRounded, ErrorOutlineRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import CustomButton from "@/Components/UI/Buttons";

/**
 * RecentTransactionsWidget — shows the 5 most recent transactions right on
 * the dashboard. This is the trust/retention signal for a payment gateway:
 * every visit answers "my gateway is working, I'm getting paid".
 *
 * Data source: dashboardReducer.recentTransactions (already fetched by
 * useDashboardData()). Falls back to a friendly empty state when the
 * list is empty (new merchant / no confirmed payments yet).
 */

interface RecentTx {
  id?: string | number;
  status?: string;
  base_amount?: number | string;
  amount?: number | string;
  currency?: string;
  base_currency?: string;
  createdAt?: string;
  created_at?: string;
  crypto_currency?: string;
  cryptocurrency?: string;
  customer_email?: string;
  customerEmail?: string;
}

export interface RecentTransactionsWidgetProps {
  transactions?: RecentTx[];
  loading?: boolean;
  max?: number;
}

const statusStyle = (status: string, theme: any) => {
  const s = String(status || "").toLowerCase();
  // Backend actually persists "successful" (not "success") for confirmed payments,
  // so include both here and everywhere else in the app that classifies status.
  if (["confirmed", "completed", "settled", "success", "successful", "paid"].includes(s)) {
    return {
      color: theme.palette.success.dark || "#059669",
      bg: theme.palette.mode === "dark" ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.12)",
      icon: <CheckCircleRounded sx={{ fontSize: 14 }} />,
      label: "Paid",
    };
  }
  if (["pending", "waiting", "unconfirmed", "processing"].includes(s)) {
    return {
      color: theme.palette.warning.dark || "#B45309",
      bg: theme.palette.mode === "dark" ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.12)",
      icon: <HourglassEmptyRounded sx={{ fontSize: 14 }} />,
      label: s ? s.charAt(0).toUpperCase() + s.slice(1) : "Pending",
    };
  }
  return {
    color: theme.palette.error.main,
    bg: theme.palette.mode === "dark" ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)",
    icon: <ErrorOutlineRounded sx={{ fontSize: 14 }} />,
    label: s ? s.charAt(0).toUpperCase() + s.slice(1) : "Failed",
  };
};

const formatWhen = (iso?: string) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short" })}`;
};

const RecentTransactionsWidget: React.FC<RecentTransactionsWidgetProps> = ({
  transactions = [],
  loading = false,
  max = 5,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const list = (transactions || []).slice(0, max);

  return (
    <Box sx={{ px: { xs: 2, md: 0 }, mb: { xs: 2, md: 2.5 } }} data-testid="recent-transactions-widget">
      <PanelCard
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 1.5, 2.5)}
        bodyPadding={theme.spacing(0, 0, 1.5, 0)}
        title="Recent transactions"
        subTitle={list.length > 0 ? "Latest activity on your account" : undefined}
        headerActionLayout="inline"
        headerAction={
          <CustomButton
            label="View all"
            variant="secondary"
            size="small"
            endIcon={<ArrowOutward sx={{ fontSize: 14 }} />}
            onClick={() => router.push("/transactions")}
            data-testid="recent-txns-view-all"
          />
        }
      >
        {loading ? (
          <Box sx={{ px: 2.5, py: 1 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
                <Skeleton variant="circular" width={36} height={36} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width={"70%"} />
                  <Skeleton width={"40%"} />
                </Box>
                <Skeleton width={80} />
              </Box>
            ))}
          </Box>
        ) : list.length === 0 ? (
          <Box
            sx={{
              px: 2.5,
              py: 4,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F4F6FA",
                color: theme.palette.text.secondary,
              }}
            >
              <HourglassEmptyRounded sx={{ fontSize: 22 }} />
            </Box>
            <Typography
              sx={{
                fontFamily: "UrbanistSemiBold",
                fontSize: "15px",
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              No transactions yet
            </Typography>
            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontSize: "13px",
                color: theme.palette.text.secondary,
                maxWidth: 320,
                lineHeight: 1.5,
              }}
            >
              Create your first payment link and share it with a customer to see activity here.
            </Typography>
          </Box>
        ) : (
          <Box>
            {list.map((tx, i) => {
              const status = String(tx.status || "").toLowerCase();
              const s = statusStyle(status, theme);
              const amount = tx.base_amount ?? tx.amount ?? 0;
              const fiat = tx.base_currency || tx.currency || "USD";
              const crypto = tx.crypto_currency || tx.cryptocurrency || "";
              const when = formatWhen(tx.createdAt || tx.created_at);
              const email = tx.customer_email || tx.customerEmail || "";
              return (
                <Box
                  key={String(tx.id ?? i)}
                  data-testid="recent-txn-row"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    borderTop: i === 0 ? "none" : `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F2F7"}`,
                    transition: "background-color 120ms ease",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFBFD",
                    },
                  }}
                  onClick={() => router.push("/transactions")}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "12px",
                      backgroundColor: s.bg,
                      color: s.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: "UrbanistSemiBold",
                        fontWeight: 600,
                        fontSize: isMobile ? "14px" : "15px",
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {getCurrencySymbol(fiat, formatNumberWithComma(String(amount)))}
                      {crypto && (
                        <Box
                          component="span"
                          sx={{
                            ml: 1,
                            color: theme.palette.text.secondary,
                            fontFamily: "UrbanistMedium",
                            fontSize: "12px",
                          }}
                        >
                          {crypto}
                        </Box>
                      )}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: "UrbanistMedium",
                        fontSize: "12px",
                        color: theme.palette.text.secondary,
                        mt: 0.25,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {email || (when ? `Received ${when}` : "")}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: "999px",
                        backgroundColor: s.bg,
                        color: s.color,
                        fontSize: "11px",
                        fontFamily: "UrbanistSemiBold",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                    >
                      {s.label}
                    </Box>
                    {when && (
                      <Typography
                        sx={{
                          fontFamily: "UrbanistMedium",
                          fontSize: "11px",
                          color: theme.palette.text.secondary,
                          mt: 0.5,
                        }}
                      >
                        {when}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </PanelCard>
    </Box>
  );
};

export default RecentTransactionsWidget;
