import PanelCard from "@/Components/UI/PanelCard";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowOutward, CheckCircleRounded, HourglassEmptyRounded, ErrorOutlineRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
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
  customer_name?: string;
  customerName?: string;
  /**
   * Set by the backend when it can determine how the transaction originated:
   *   * 'payment_link' — merchant sent a DynoPay checkout URL to the payer
   *   * 'legacy_api'   — accepted via the merchant's REST API
   *   * 'checkout'     — accepted via other DynoPay-internal placeholders
   *   * null/undefined — direct crypto receive or a real customer email
   * The frontend uses this to render a friendly label instead of the
   * synthetic `…@dynopay.internal` placeholder addresses.
   */
  source?: "payment_link" | "legacy_api" | "checkout" | null;
}

/**
 * Hide system-generated internal customer identifiers on the dashboard.
 * The backend synthesises a placeholder like
 * `legacy-api-1-1776537566415@dynopay.internal` / "Legacy API Customer"
 * for payments accepted through the legacy REST API (where no real
 * customer email is provided). Showing that raw string to the merchant
 * looks broken/leaky. Fall back to a source-appropriate label instead.
 */
const isInternalCustomerEmail = (email: string): boolean => {
  if (!email) return false;
  const lower = email.toLowerCase();
  return (
    lower.endsWith("@dynopay.internal") ||
    lower.startsWith("legacy-api-") ||
    lower.includes("@dynopay.local")
  );
};
const isInternalCustomerName = (name: string): boolean => {
  if (!name) return false;
  return /legacy\s*api\s*customer/i.test(name);
};

export interface RecentTransactionsWidgetProps {
  transactions?: RecentTx[];
  loading?: boolean;
  max?: number;
}

const statusStyle = (status: string, theme: any, t: (k: string) => string) => {
  const s = String(status || "").toLowerCase();
  // Backend actually persists "successful" (not "success") for confirmed payments,
  // so include both here and everywhere else in the app that classifies status.
  if (["confirmed", "completed", "settled", "success", "successful", "paid"].includes(s)) {
    return {
      color: theme.palette.success.dark || "#059669",
      bg: theme.palette.mode === "dark" ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.12)",
      icon: <CheckCircleRounded sx={{ fontSize: 14 }} />,
      label: t("statusPaid"),
    };
  }
  if (["pending", "waiting", "unconfirmed", "processing"].includes(s)) {
    return {
      color: theme.palette.warning.dark || "#B45309",
      bg: theme.palette.mode === "dark" ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.12)",
      icon: <HourglassEmptyRounded sx={{ fontSize: 14 }} />,
      label: t("statusPending"),
    };
  }
  return {
    color: theme.palette.error.main,
    bg: theme.palette.mode === "dark" ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)",
    icon: <ErrorOutlineRounded sx={{ fontSize: 14 }} />,
    label: t("statusFailed"),
  };
};

const formatWhen = (
  iso: string | undefined,
  t: (k: string, opts?: Record<string, unknown>) => string,
  lang: string,
) => {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const diff = Date.now() - time;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t("timeJustNow");
  if (min < 60) return t("timeMinAgo", { count: min });
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return t("timeHrAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("timeDayAgo", { count: days });
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString(lang || "en", { month: "short" })}`;
};

const RecentTransactionsWidget: React.FC<RecentTransactionsWidgetProps> = ({
  transactions = [],
  loading = false,
  max = 5,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const { t, i18n } = useTranslation("dashboardLayout");
  const list = (transactions || []).slice(0, max);

  return (
    <Box sx={{ px: { xs: 2, md: 0 }, mb: { xs: 2, md: 2.5 } }} data-testid="recent-transactions-widget">
      <PanelCard
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 1.5, 2.5)}
        bodyPadding={theme.spacing(0, 0, 1.5, 0)}
        title={t("recentTransactions")}
        subTitle={list.length > 0 ? t("recentActivitySubtitle") : undefined}
        headerActionLayout="inline"
        headerAction={
          <CustomButton
            label={t("viewAll")}
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
              {t("noTransactionsYet")}
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
              {t("noTransactionsDesc")}
            </Typography>
          </Box>
        ) : (
          <Box>
            {list.map((tx, i) => {
              const status = String(tx.status || "").toLowerCase();
              const s = statusStyle(status, theme, t);
              const amount = tx.base_amount ?? tx.amount ?? 0;
              const fiat = tx.base_currency || tx.currency || "USD";
              const crypto = tx.crypto_currency || tx.cryptocurrency || "";
              const when = formatWhen(tx.createdAt || tx.created_at, t, i18n.language);
              const rawEmail = tx.customer_email || tx.customerEmail || "";
              const rawName = (tx as any).customer_name || (tx as any).customerName || "";
              const source = tx.source;

              // Prefer the backend-provided `source` when available. Fall back
              // to email/name heuristics for older API responses that don't
              // return the source field yet (cached responses, etc.).
              const isInternalId =
                isInternalCustomerEmail(rawEmail) || isInternalCustomerName(rawName);
              const hideCustomerId = source != null || isInternalId;
              const email = hideCustomerId ? "" : rawEmail;

              // Label priority:
              //   1. `payment_link` source → "Payment link"
              //   2. `legacy_api` or `checkout` source, or legacy internal id → "API payment"
              //   3. real customer email → show email
              //   4. nothing to show → "Received {when}" (existing fallback)
              let secondaryLabel: string;
              if (source === "payment_link") {
                secondaryLabel = t("paymentLinkLabel");
              } else if (source === "legacy_api" || source === "checkout" || isInternalId) {
                secondaryLabel = t("apiPaymentLabel");
              } else if (email) {
                secondaryLabel = email;
              } else {
                secondaryLabel = when ? t("receivedWhen", { when }) : "";
              }
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
                      {secondaryLabel}
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
