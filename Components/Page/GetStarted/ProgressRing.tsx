import React, { useId } from "react";
import { Box, useTheme } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { MONO } from "@/styles/uiKit";

interface Props {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  label: string;
  testId?: string;
  /** Ring only — no "n/total" figure inside (for tiny rail sizes). */
  hideLabel?: boolean;
}

/** Circular setup-progress indicator (SVG, gold→aqua gradient, animated, reduced-motion safe). */
const ProgressRing: React.FC<Props> = ({ value, total, size = 96, stroke = 8, label, testId, hideLabel = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gradId = `gs-ring-${useId().replace(/:/g, "")}`;
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const complete = pct >= 1;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;

  return (
    <Box
      data-testid={testId}
      data-value={value}
      data-total={total}
      role="img"
      aria-label={label}
      sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={complete ? "#2BD4C4" : "#FFD100"} />
            <stop offset="100%" stopColor={complete ? positive : "#2BD4C4"} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.07)"}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 600ms cubic-bezier(0.2, 0.7, 0.2, 1)",
            filter: pct > 0 ? `drop-shadow(0 0 6px ${complete ? "rgba(43,212,196,0.5)" : "rgba(255,209,0,0.45)"})` : undefined,
          }}
        />
      </svg>
      {!hideLabel && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            fontSize: Math.round(size * 0.24),
            letterSpacing: "-0.02em",
            color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
          }}
        >
          {value}
          <Box component="span" sx={{ opacity: 0.45, fontWeight: 500, mx: "1px" }}>/</Box>
          {total}
        </Box>
      )}
    </Box>
  );
};

export default ProgressRing;
