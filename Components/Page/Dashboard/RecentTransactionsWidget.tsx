import PanelCard from "@/Components/UI/PanelCard";
import { getCurrencySymbol } from "@/helpers";
import { formatCryptoAmount, isCryptoCurrency } from "@/utils/currencyFormat";
import { useUsdRates } from "@/hooks/useUsdRates";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import {
  ArrowOutward,
  CheckCircleRounded,
  HourglassEmptyRounded,
  ErrorOutlineRounded,
  DensityMediumRounded,
  DensitySmallRounded,
  ReceiptLongRounded,
  BoltRounded,
  AddRounded,
} from "@mui/icons-material";
import { Box, Button, IconButton, Skeleton, Tooltip, Typography, alpha, useTheme } from "@mui/material";
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
  /**
   * ⚠️ tbl_user_transaction schema is REVERSED from convention:
   *   * `id`             → STRING UUID (e.g. `9b8965a8-…`)
   *   * `transaction_id` → INTEGER autoIncrement PK
   * The transactions LIST page (`/transactions`) maps every row's `id`
   * to `transaction_id` (numeric PK) in `processedTransactions`, so the
   * dashboard deep-link MUST use `transaction_id` too — otherwise the
   * `?tx=<numeric>` cannot match anything and the details modal never opens.
   */
  id?: string | number;
  transaction_id?: string | number;
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
   *   * 'payment_link' — merchant sent a Dynopay checkout URL to the payer
   *   * 'legacy_api'   — accepted via the merchant's REST API
   *   * 'checkout'     — accepted via other Dynopay-internal placeholders
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
  const { isCompact, toggleDensity } = useDashboardDensity();
  const { toUsd } = useUsdRates();

  // Compact mode shows more rows (10) with tighter padding and smaller icons.
  // Spacious mode is the original 5-row / 36px-icon / py=1.5 layout.
  const effectiveMax = isCompact ? Math.max(max, 10) : max;
  const rowPy = isCompact ? 0.85 : 1.5;
  const iconSize = isCompact ? 28 : 36;
  const iconRadius = isCompact ? "10px" : "12px";
  const primaryFontSize = isMobile
    ? isCompact
      ? "13px"
      : "14px"
    : isCompact
      ? "14px"
      : "15px";
  const secondaryFontSize = isCompact ? "11.5px" : "12px";
  const list = (transactions || []).slice(0, effectiveMax);

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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip
              title={
                isCompact
                  ? t("densitySpaciousTip", { defaultValue: "Spacious view" })
                  : t("densityCompactTip", { defaultValue: "Compact view" })
              }
              placement="top"
              arrow
            >
              <IconButton
                onClick={toggleDensity}
                aria-label={
                  isCompact
                    ? t("densitySpaciousAria", { defaultValue: "Switch to spacious view" })
                    : t("densityCompactAria", { defaultValue: "Switch to compact view" })
                }
                data-testid="recent-txns-density-toggle"
                data-density={isCompact ? "compact" : "spacious"}
                size="small"
                sx={{
                  width: 32,
                  height: 32,
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(15,15,20,0.05)",
                    color: theme.palette.text.primary,
                  },
                }}
              >
                {isCompact ? (
                  <DensityMediumRounded sx={{ fontSize: 16 }} />
                ) : (
                  <DensitySmallRounded sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
            <CustomButton
              label={t("viewAll")}
              variant="secondary"
              size="small"
              endIcon={<ArrowOutward sx={{ fontSize: 14 }} />}
              onClick={() => router.push("/transactions")}
              data-testid="recent-txns-view-all"
            />
          </Box>
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
            {/* Charming illustrated empty state — a friendly receipt glyph on a
                branded gradient halo with a little "spark", plus a first-action
                CTA so a brand-new merchant knows exactly what to do until their
                first payment lands. */}
            <Box
              aria-hidden
              sx={{
                position: "relative",
                width: 96,
                height: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 0.5,
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 50% 42%, ${alpha(
                    theme.palette.primary.main,
                    0.32
                  )}, transparent 68%)`,
                }}
              />
              <Box
                sx={{
                  position: "relative",
                  width: 72,
                  height: 72,
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  background: `linear-gradient(140deg, ${theme.palette.primary.main}, ${
                    theme.palette.primary.dark || theme.palette.primary.main
                  })`,
                  boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.4)}`,
                }}
              >
                <ReceiptLongRounded sx={{ fontSize: 34 }} />
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.palette.primary.main,
                  bgcolor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: `0 4px 10px ${alpha("#000", 0.18)}`,
                }}
              >
                <BoltRounded sx={{ fontSize: 15 }} />
              </Box>
            </Box>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              {t("noTransactionsYet")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: theme.palette.text.secondary,
                maxWidth: 320,
                lineHeight: 1.5,
              }}
            >
              {t("noTransactionsDesc")}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => router.push("/create-pay-link")}
              data-testid="empty-create-paylink-btn"
              sx={{
                mt: 1.5,
                textTransform: "none",
                borderRadius: "12px",
                fontWeight: 600,
                px: 2.5,
                py: 0.9,
                boxShadow: "none",
                "&:hover": { boxShadow: "none" },
              }}
            >
              {t("createFirstPaymentLink", {
                defaultValue: "Create payment link",
              })}
            </Button>
          </Box>
        ) : (
          <Box>
            {list.map((tx, i) => {
              const status = String(tx.status || "").toLowerCase();
              const s = statusStyle(status, theme, t);
              const amount = tx.base_amount ?? tx.amount ?? 0;
              const fiat = tx.base_currency || tx.currency || "USD";
              const crypto = tx.crypto_currency || tx.cryptocurrency || "";
              // Approximate USD value shown beside a crypto amount so merchants
              // instantly see what a payment is worth. Only for crypto rows
              // (skip when already fiat); null when we can't price it.
              const usdValue = isCryptoCurrency(fiat)
                ? toUsd(Number(amount), fiat)
                : null;
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
              //   4. nothing to show → status-aware time label. Session 54 fix:
              //      previously ALWAYS showed "Received {when}", which is
              //      misleading for unpaid/pending transactions. Now only paid
              //      transactions say "Received"; pending say "Awaiting payment"
              //      and failed/other say "Created".
              let secondaryLabel: string;
              if (source === "payment_link") {
                secondaryLabel = t("paymentLinkLabel");
              } else if (source === "legacy_api" || source === "checkout" || isInternalId) {
                secondaryLabel = t("apiPaymentLabel");
              } else if (email) {
                secondaryLabel = email;
              } else if (when) {
                const isPaid = ["confirmed", "completed", "settled", "success", "successful", "paid"].includes(status);
                const isPendingState = ["pending", "waiting", "unconfirmed", "processing"].includes(status);
                secondaryLabel = isPaid
                  ? t("receivedWhen", { when })
                  : isPendingState
                    ? t("awaitingWhen", { when })
                    : t("createdWhen", { when });
              } else {
                secondaryLabel = "";
              }
              return (
                <Box
                  key={String(tx.id ?? i)}
                  data-testid="recent-txn-row"
                  data-density={isCompact ? "compact" : "spacious"}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: isCompact ? 1.25 : 1.5,
                    px: 2.5,
                    py: rowPy,
                    borderTop: i === 0 ? "none" : `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F2F7"}`,
                    transition: "background-color 120ms ease",
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFBFD",
                    },
                  }}
                  onClick={() => {
                    // Deep-link id-space MUST match what /transactions
                    // uses. `processedTransactions` maps each row's
                    // `id` field to `transaction_id` (numeric PK),
                    // so we must pass the same numeric PK here — the
                    // UUID-shaped `tx.id` from tbl_user_transaction will
                    // NEVER match on the list side. See RecentTx doc.
                    const routeId = (tx as any).transaction_id ?? tx.id;
                    router.push(
                      routeId
                        ? `/transactions?tx=${encodeURIComponent(String(routeId))}`
                        : "/transactions"
                    );
                  }}
                >
                  <Box
                    sx={{
                      width: iconSize,
                      height: iconSize,
                      borderRadius: iconRadius,
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
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        fontSize: primaryFontSize,
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {getCurrencySymbol(fiat, formatCryptoAmount(Number(amount), fiat))}
                      {crypto && (
                        <Box
                          component="span"
                          sx={{
                            ml: 1,
                            color: theme.palette.text.secondary,
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                          }}
                        >
                          {crypto}
                        </Box>
                      )}
                      {usdValue != null && (
                        <Box
                          component="span"
                          data-testid="recent-txn-fiat"
                          sx={{
                            ml: 1,
                            color: theme.palette.text.secondary,
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                            fontSize: "12px",
                          }}
                        >
                          {`\u2248 ${getCurrencySymbol("USD", formatCryptoAmount(usdValue, "USD"))}`}
                        </Box>
                      )}
                    </Typography>
                    {/* Secondary label hidden in compact mode to save vertical
                        space — the primary line (amount + coin) plus the
                        right-side status/time is enough context. */}
                    {!isCompact && (
                      <Typography
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: secondaryFontSize,
                          color: theme.palette.text.secondary,
                          mt: 0.25,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {secondaryLabel}
                      </Typography>
                    )}
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
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                    >
                      {s.label}
                    </Box>
                    {when && (
                      <Typography
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "11px",
                          color: theme.palette.text.secondary,
                          mt: isCompact ? 0.25 : 0.5,
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
