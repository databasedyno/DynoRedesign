import React, { useMemo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CB_TOKENS } from "./styled";

/**
 * Sparkline — Coinbase-style thin area chart used inside the KPI hero.
 *
 * Design specs:
 * - Bright indigo stroke, 2px width, sharp corners
 * - Subtle area fill (indigo at 15% top → transparent bottom)
 * - No gridlines, no axes, no ticks — just the line + fill (Coinbase pattern)
 * - Tooltip on hover: bare date + value, no card
 * - Renders 220px tall on desktop, 160px on mobile
 */

type Point = { date: string; value: number };

interface SparklineProps {
  data: Point[];
  loading?: boolean;
  height?: number;
  currencySymbol?: string;
}

const formatValue = (v: number, symbol = "$"): string => {
  if (!Number.isFinite(v)) return `${symbol}0`;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${symbol}${(v / 1_000).toFixed(2)}k`;
  if (abs >= 1) return `${symbol}${v.toFixed(2)}`;
  return `${symbol}${v.toFixed(4)}`;
};

const CustomTooltip: React.FC<any> = ({ active, payload, label, currencySymbol }) => {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: "10px",
        backgroundColor:
          theme.palette.mode === "dark" ? "#1F2029" : "#FFFFFF",
        border: `1px solid ${
          theme.palette.mode === "dark"
            ? CB_TOKENS.border.dark
            : CB_TOKENS.border.light
        }`,
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 8px 24px rgba(0,0,0,0.35)"
            : "0 8px 24px rgba(10,10,15,0.10)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Box
        sx={{
          fontSize: 11,
          color:
            theme.palette.mode === "dark"
              ? CB_TOKENS.ink.mutedDark
              : CB_TOKENS.ink.mutedLight,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontSize: 15,
          fontWeight: 700,
          color:
            theme.palette.mode === "dark"
              ? CB_TOKENS.ink.primaryDark
              : CB_TOKENS.ink.primaryLight,
          mt: 0.25,
        }}
      >
        {formatValue(v, currencySymbol)}
      </Box>
    </Box>
  );
};

const Sparkline: React.FC<SparklineProps> = ({
  data,
  loading = false,
  height = 220,
  currencySymbol = "$",
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const stroke = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  // Prepare data — if all zero, seed a subtle baseline so the chart still renders
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const anyNonZero = data.some((d) => Number(d.value) > 0);
    if (!anyNonZero) {
      // Render a flat baseline near zero — never a fake ramp
      return data.map((d) => ({ ...d, value: 0 }));
    }
    return data;
  }, [data]);

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        height={height}
        sx={{ borderRadius: 3, bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.04)" }}
      />
    );
  }

  return (
    <Box
      data-testid="dashboard-sparkline"
      sx={{
        width: "100%",
        height,
        position: "relative",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="cb-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={isDark ? 0.28 : 0.18} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{
              stroke: isDark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.14)",
              strokeDasharray: "3 3",
              strokeWidth: 1,
            }}
            content={<CustomTooltip currencySymbol={currencySymbol} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.5}
            fill="url(#cb-spark-fill)"
            activeDot={{
              r: 4,
              fill: stroke,
              stroke: isDark ? "#0A0A0F" : "#FFFFFF",
              strokeWidth: 2,
            }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default Sparkline;
