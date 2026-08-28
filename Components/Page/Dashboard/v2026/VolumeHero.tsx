import React, { useEffect, useMemo, useState } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import CustomButton from "@/Components/UI/Buttons";
import Sparkline from "../coinbase/Sparkline";
import {
  BigNumber,
  DeltaChip,
  Eyebrow,
  PillButton,
  SurfaceCard,
  CB_TOKENS,
} from "../coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { formatNumberWithComma } from "@/helpers";

interface Props {
  stats: any;
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  chartSummary?: {
    total_volume: number;
    previous_total_volume: number;
    volume_change_percent: number;
  } | null;
  loading?: boolean;
  chartLoading?: boolean;
  rangeLabel: string;
}

const splitAmount = (raw: string) => {
  const idx = raw.lastIndexOf(" ");
  if (idx > 0 && idx < raw.length - 1) {
    return { big: raw.slice(0, idx), suffix: raw.slice(idx + 1) };
  }
  return { big: raw, suffix: "" };
};

/**
 * VolumeHero — the headline card of the merchant command center. Shows the
 * lifetime (or today's) processed volume as a huge tabular number with a
 * delta chip and a full-width area chart. The chart series is driven by the
 * global time-range control in the CommandBar (data passed in as a prop).
 */
const VolumeHero: React.FC<Props> = ({ stats, chartData, chartSummary, loading, chartLoading, rangeLabel }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("md");
  const { isCompact } = useDashboardDensity();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const router = useRouter();
  const [metric, setMetric] = useState<"period" | "lifetime" | "today">("period");

  // Changing the CommandBar range (or applying a custom range) must always be
  // reflected in the headline — snap back to the range-driven "This period"
  // metric whenever the active window changes.
  useEffect(() => {
    setMetric("period");
  }, [rangeLabel]);

  const currencySymbol = stats?.currencySymbol || "$";
  const lifetimeStr = stats?.totalVolumeFormatted || `${currencySymbol}0.00`;
  const todayStr = stats?.todaySummary?.volumeTodayFormatted || `${currencySymbol}0.00`;
  const lifetimeDelta = Number(stats?.volumeChange ?? 0);
  const todayDelta = Number(stats?.todaySummary?.volumeChangePercent ?? 0);

  // Period totals derive from the range-driven chart series so the headline
  // number tracks the CommandBar time filter (7d / 30d / 90d / 1y / custom).
  const { periodVolumeFromChart, periodTxCount } = useMemo(() => {
    let v = 0;
    let c = 0;
    for (const d of chartData || []) {
      v += Number(d?.value) || 0;
      c += Number(d?.transactionCount) || 0;
    }
    return { periodVolumeFromChart: v, periodTxCount: c };
  }, [chartData]);
  // Prefer the backend's authoritative period total (it is the base for the
  // delta); fall back to the client-side chart sum until the summary loads.
  const periodVolume =
    chartSummary && typeof chartSummary.total_volume === "number"
      ? chartSummary.total_volume
      : periodVolumeFromChart;
  const periodStr = `${currencySymbol}${formatNumberWithComma(periodVolume)}`;
  const periodDelta = Number(chartSummary?.volume_change_percent ?? 0);
  const hasPeriodDelta = !!chartSummary;

  const activeStr =
    metric === "period" ? periodStr : metric === "lifetime" ? lifetimeStr : todayStr;
  const activeDelta =
    metric === "period" ? periodDelta : metric === "lifetime" ? lifetimeDelta : todayDelta;
  const positive = activeDelta >= 0;
  const { big, suffix } = useMemo(() => splitAmount(activeStr), [activeStr]);

  // The period number comes from the chart fetch, so reflect chartLoading too.
  const showSkeleton = loading || (metric === "period" && chartLoading);

  // ── Empty / onboarding state ──────────────────────────────────────────────
  // A brand-new merchant with ZERO lifetime settled sales sees an encouraging
  // "make your first sale" nudge instead of a flat $0 chart. Gate on !loading
  // so we never flash the empty state while the first fetch is in flight.
  const isEmpty =
    !loading &&
    !!stats &&
    Number(stats.totalTransactions ?? 0) === 0 &&
    Number(stats.totalVolume ?? 0) === 0;

  if (isEmpty) {
    return (
      <SurfaceCard
        data-testid="dash2026-hero-empty"
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: { xs: 300, md: 380 },
        }}
      >
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: { xs: 1.5, md: 2 },
            maxWidth: 460,
          }}
        >
          <Box
            sx={{
              width: { xs: 46, md: 52 },
              height: { xs: 46, md: 52 },
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
              backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
            }}
          >
            <Icon name="rocket" size={isMobile ? 22 : 26} />
          </Box>
          <Eyebrow>{t("heroEmptyEyebrow", { defaultValue: "Welcome to Dynopay" })}</Eyebrow>
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontSize: { xs: 24, md: 30 },
              lineHeight: 1.15,
              color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
            }}
          >
            {t("heroEmptyTitle", { defaultValue: "Make your first sale" })}
          </Box>
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: { xs: 14, md: 15 },
              lineHeight: 1.55,
              color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            }}
          >
            {t("heroEmptyDesc", {
              defaultValue:
                "Create a payment link or set up your storefront — your volume, payments and growth will show up here in real time.",
            })}
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.25,
              mt: 0.5,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {/* Pulsing ring behind the primary CTA to guide the very first action */}
            <Box sx={{ position: "relative", width: { xs: "100%", sm: "auto" } }}>
              <Box
                component={motion.span}
                aria-hidden
                animate={{
                  boxShadow: [
                    `0 0 0 0 ${isDark ? "rgba(129,140,248,0.45)" : "rgba(79,70,229,0.35)"}`,
                    `0 0 0 12px ${isDark ? "rgba(129,140,248,0)" : "rgba(79,70,229,0)"}`,
                  ],
                }}
                transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "12px",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />
              <CustomButton
                label={t("heroEmptyCta", { defaultValue: "Create your first payment link" })}
                variant="primary"
                size="medium"
                fullWidth={isMobile}
                data-testid="dash2026-hero-empty-cta"
                onClick={() => router.push("/create-pay-link")}
                sx={{ position: "relative", zIndex: 1 }}
              />
            </Box>
            <CustomButton
              label={t("heroEmptyCta2", { defaultValue: "Set up storefront" })}
              variant="outlined"
              size="medium"
              fullWidth={isMobile}
              data-testid="dash2026-hero-empty-cta2"
              onClick={() => router.push("/creator")}
            />
          </Box>
        </Box>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      data-testid="dash2026-hero"
      sx={{
        display: "flex",
        flexDirection: "column",
        // Compact density: tighter padding + smaller vertical rhythm so the
        // headline card visibly shrinks when the merchant picks Compact view.
        gap: isCompact ? 1.25 : { xs: 2, md: 2.5 },
        ...(isCompact && { p: { xs: 1.75, md: 2 } }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            p: 0.5,
            borderRadius: 999,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(10,10,15,0.05)",
          }}
        >
          <PillButton
            active={metric === "period"}
            onClick={() => setMetric("period")}
            data-testid="dash2026-hero-period"
          >
            {t("heroPeriodVolume", { defaultValue: "This period" })}
          </PillButton>
          <PillButton
            active={metric === "lifetime"}
            onClick={() => setMetric("lifetime")}
            data-testid="dash2026-hero-lifetime"
          >
            {t("heroLifetimeVolume", { defaultValue: "Lifetime volume" })}
          </PillButton>
          <PillButton
            active={metric === "today"}
            onClick={() => setMetric("today")}
            data-testid="dash2026-hero-today"
          >
            {t("heroTodayRevenue", { defaultValue: "Today" })}
          </PillButton>
        </Box>
        <Eyebrow data-testid="dash2026-hero-rangelabel">
          {(
            t("volumeOver", { defaultValue: "Volume · {range}" }) as string
          ).replace("{range}", rangeLabel)}
        </Eyebrow>
      </Box>

      <Box>
        <BigNumber
          data-testid="dash2026-hero-value"
          sx={{
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            // Compact density: scale the headline figure down (72 -> 52)
            ...(isCompact && { fontSize: { xs: 32, sm: 38, md: 48, lg: 52 } }),
          }}
        >
          {showSkeleton ? (
            <Skeleton width={isMobile ? 240 : 380} height={isMobile ? 48 : isCompact ? 60 : 84} />
          ) : (
            <>
              {big}
              {suffix && (
                <Box
                  component="span"
                  sx={{
                    fontSize: "0.42em",
                    fontWeight: 400,
                    color: isDark
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                    ml: 1,
                    verticalAlign: "middle",
                  }}
                >
                  {suffix}
                </Box>
              )}
            </>
          )}
        </BigNumber>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: 1,
            flexWrap: "wrap",
          }}
        >
          {showSkeleton ? (
            <Skeleton width={160} height={20} />
          ) : metric === "period" ? (
            <>
              {hasPeriodDelta && (
                <DeltaChip positive={positive} data-testid="dash2026-hero-delta">
                  <Icon name={positive ? "arrow-up" : "arrow-down"} size={14} />
                  {Math.abs(periodDelta).toFixed(2)}%
                </DeltaChip>
              )}
              <Box
                component="span"
                data-testid="dash2026-hero-subline"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: isDark
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight,
                }}
              >
                {(
                  t("periodVsPrevious", {
                    defaultValue: "vs previous period · {count} payments",
                  }) as string
                ).replace("{count}", String(periodTxCount))}
              </Box>
            </>
          ) : (
            <>
              <DeltaChip positive={positive} data-testid="dash2026-hero-delta">
                <Icon name={positive ? "arrow-up" : "arrow-down"} size={14} />
                {Math.abs(activeDelta).toFixed(2)}%
              </DeltaChip>
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: isDark
                    ? CB_TOKENS.ink.mutedDark
                    : CB_TOKENS.ink.mutedLight,
                }}
              >
                {metric === "lifetime"
                  ? t("vsLastMonth", { defaultValue: "vs previous period" })
                  : t("vsYesterday", { defaultValue: "vs yesterday" })}
              </Box>
            </>
          )}
        </Box>
      </Box>

      <Sparkline
        data={chartData || []}
        loading={loading || chartLoading}
        height={isCompact ? (isMobile ? 120 : 160) : isMobile ? 170 : 240}
        currencySymbol={currencySymbol}
      />
    </SurfaceCard>
  );
};

export default VolumeHero;
