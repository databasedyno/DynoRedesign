import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { ArrowUpwardRounded, ArrowDownwardRounded, BoltRounded } from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useDashboardData } from "@/hooks/useDashboardData";
import useIsMobile from "@/hooks/useIsMobile";
import Sparkline from "./Sparkline";
import {
  BigNumber,
  CB_TOKENS,
  DeltaChip,
  Eyebrow,
  PillButton,
  SurfaceCard,
} from "./styled";

/**
 * HeroKPI — the huge Lifetime Volume headline + delta chip + sparkline +
 * timeframe pills. Coinbase's Home fold, adapted for a merchant KPI.
 *
 * Data source:
 * - stats.totalVolume / totalVolumeFormatted (lifetime cumulative)
 * - stats.volumeChange (% period-over-period)
 * - chartData (per-day volume points)
 * - fetchChartData(period) — refetches when the pill changes
 *
 * Timeframe pills:
 *   1D · 1W · 1M · 3M · 1Y · All
 * Mapped to backend periods:
 *   1D → "1d"  (falls back to "7d" if not supported)
 *   1W → "7d"
 *   1M → "30d"
 *   3M → "90d"
 *   1Y → "1y"
 *   All → "all"
 */

const TIMEFRAMES: Array<{ id: string; label: string; period: string }> = [
  { id: "1d", label: "1D", period: "7d" }, // graceful fall-back: show latest week
  { id: "1w", label: "1W", period: "7d" },
  { id: "1m", label: "1M", period: "30d" },
  { id: "3m", label: "3M", period: "90d" },
  { id: "1y", label: "1Y", period: "1y" },
  { id: "all", label: "All", period: "all" },
];

const HeroKPI: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { stats, chartData, loading, chartLoading, fetchChartData } =
    useDashboardData();

  const [active, setActive] = useState<string>("1w");

  // Fetch chart data whenever the active timeframe changes
  useEffect(() => {
    const tf = TIMEFRAMES.find((x) => x.id === active);
    if (!tf) return;
    fetchChartData(tf.period);
  }, [active, fetchChartData]);

  const totalVolumeFormatted = stats?.totalVolumeFormatted || "$0.00";
  const volumeChange = Number(stats?.volumeChange ?? 0);
  const currencySymbol = stats?.currencySymbol || "$";
  const positive = volumeChange >= 0;

  const handleTimeframe = useCallback((id: string) => setActive(id), []);

  // Split the "$1,234.56 USD" string into number and suffix for typographic control
  const { bigPart, suffixPart } = useMemo(() => {
    const raw = totalVolumeFormatted;
    // If the format is like "$1,234.56 USD" split at the space
    const spaceIdx = raw.lastIndexOf(" ");
    if (spaceIdx > 0 && spaceIdx < raw.length - 1) {
      return { bigPart: raw.slice(0, spaceIdx), suffixPart: raw.slice(spaceIdx + 1) };
    }
    return { bigPart: raw, suffixPart: "" };
  }, [totalVolumeFormatted]);

  return (
    <SurfaceCard
      data-testid="cb-hero"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2, md: 2.5 },
      }}
    >
      {/* Top row: eyebrow left, "Save on fees" pill right */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow data-testid="cb-hero-eyebrow">
          {t("heroLifetimeVolume", { defaultValue: "Lifetime volume" })}
        </Eyebrow>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => router.push("/fees")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push("/fees");
          }}
          data-testid="cb-hero-save-on-fees"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            cursor: "pointer",
            border: `1px solid ${
              theme.palette.mode === "dark"
                ? CB_TOKENS.border.dark
                : CB_TOKENS.border.light
            }`,
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(10,10,15,0.02)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            color:
              theme.palette.mode === "dark"
                ? CB_TOKENS.ink.secondaryDark
                : CB_TOKENS.ink.secondaryLight,
            transition: "background-color 150ms ease",
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(10,10,15,0.04)",
            },
          }}
        >
          <BoltRounded
            sx={{
              fontSize: 14,
              color:
                theme.palette.mode === "dark"
                  ? CB_TOKENS.indigo.dark
                  : CB_TOKENS.indigo.light,
            }}
          />
          {t("saveOnFees", { defaultValue: "Save on fees" })}
        </Box>
      </Box>

      {/* Big KPI */}
      <Box>
        <BigNumber data-testid="cb-hero-value">
          {loading ? (
            <Skeleton width={isMobile ? 240 : 380} height={isMobile ? 48 : 84} />
          ) : (
            <>
              {bigPart}
              {suffixPart && (
                <Box
                  component="span"
                  sx={{
                    fontSize: "0.42em",
                    fontWeight: 400,
                    color:
                      theme.palette.mode === "dark"
                        ? CB_TOKENS.ink.mutedDark
                        : CB_TOKENS.ink.mutedLight,
                    ml: 1,
                    verticalAlign: "middle",
                  }}
                >
                  {suffixPart}
                </Box>
              )}
            </>
          )}
        </BigNumber>

        {/* Delta row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: 1,
            flexWrap: "wrap",
          }}
        >
          {loading ? (
            <Skeleton width={140} height={20} />
          ) : (
            <>
              <DeltaChip positive={positive} data-testid="cb-hero-delta">
                {positive ? (
                  <ArrowUpwardRounded sx={{ fontSize: 14 }} />
                ) : (
                  <ArrowDownwardRounded sx={{ fontSize: 14 }} />
                )}
                {Math.abs(volumeChange).toFixed(2)}%
              </DeltaChip>
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color:
                    theme.palette.mode === "dark"
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                }}
              >
                {t("vsLastMonth", { defaultValue: "vs previous period" })}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Sparkline chart */}
      <Sparkline
        data={chartData || []}
        loading={loading || chartLoading}
        height={isMobile ? 160 : 220}
        currencySymbol={currencySymbol}
      />

      {/* Timeframe pills */}
      <Box
        role="tablist"
        data-testid="cb-hero-timeframes"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: { xs: "space-between", md: "flex-start" },
          gap: { xs: 0.5, md: 1.5 },
          flexWrap: "nowrap",
          overflowX: "auto",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {TIMEFRAMES.map((tf) => (
          <PillButton
            key={tf.id}
            active={active === tf.id}
            onClick={() => handleTimeframe(tf.id)}
            data-testid={`cb-hero-tf-${tf.id}`}
            role="tab"
            aria-selected={active === tf.id}
          >
            {tf.label}
          </PillButton>
        ))}
      </Box>
    </SurfaceCard>
  );
};

export default HeroKPI;
