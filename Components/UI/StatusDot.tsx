import React from "react";
import { Box, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

/**
 * StatusDot — the single status primitive for the "Quiet Money" redesign
 * (UI Redesign Blueprint §3). Replaces filled/uppercase status pills with a
 * calm 6px dot + tinted text:  ● Settled   ● Pending   ● Failed   ○ Unpaid
 *
 * Semantic colours (emerald / amber / rose / indigo / slate) are theme-aware:
 * deeper -700 shades on light surfaces, lighter -400 shades on dark surfaces,
 * so contrast passes AA in both modes. NEVER renders a coloured background.
 */
export type StatusTone =
  | "settled"
  | "pending"
  | "failed"
  | "overdue"
  | "info"
  | "draft"
  | "neutral"
  | "unpaid";

interface ToneSpec {
  dot: string;
  light: string;
  dark: string;
  hollow?: boolean;
}

const TONES: Record<StatusTone, ToneSpec> = {
  settled: { dot: "#10B981", light: "#047857", dark: "#34D399" }, // emerald
  pending: { dot: "#F59E0B", light: "#B45309", dark: "#FBBF24" }, // amber
  failed: { dot: "#F43F5E", light: "#BE123C", dark: "#FB7185" }, // rose
  overdue: { dot: "#F43F5E", light: "#BE123C", dark: "#FB7185" }, // rose
  info: { dot: "#6366F1", light: "#4338CA", dark: "#818CF8" }, // indigo
  draft: { dot: "#94A3B8", light: "#475569", dark: "#A1A1AA" }, // slate
  neutral: { dot: "#94A3B8", light: "#475569", dark: "#A1A1AA" }, // slate
  unpaid: { dot: "#94A3B8", light: "#475569", dark: "#A1A1AA", hollow: true }, // hollow slate
};

export interface StatusDotProps {
  tone?: StatusTone;
  children?: React.ReactNode;
  /** Hide the dot and render tinted text only. */
  showDot?: boolean;
  sx?: SxProps<Theme>;
  className?: string;
  "data-testid"?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  tone = "neutral",
  children,
  showDot = true,
  sx,
  className,
  ...rest
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const t = TONES[tone] ?? TONES.neutral;
  const fg = isDark ? t.dark : t.light;
  return (
    <Box
      component="span"
      className={className}
      {...rest}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        color: fg,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        userSelect: "none",
        ...sx,
      }}
    >
      {showDot && (
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: t.hollow ? "transparent" : t.dot,
            border: t.hollow ? `1.5px solid ${t.dot}` : "none",
            boxSizing: "border-box",
          }}
        />
      )}
      {children}
    </Box>
  );
};

export default StatusDot;
