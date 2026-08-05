import { Box, styled } from "@mui/material";

/**
 * StatusPill — small monospace status label used across tables, transaction
 * rows, invoice status columns, wallet cards, and command bars.
 *
 * Tones map to the semantic states of the payments product:
 *   settled  → volt-lime green (money confirmed on chain, funds cleared)
 *   pending  → amber (waiting for blockchain confirmation)
 *   failed   → coral red (unrecoverable failure)
 *   info     → indigo (neutral information — e.g. "auto-converted")
 *   neutral  → grey (fallback, unknown state)
 *
 * Radius, padding, letter-spacing, and dark-mode contrast all match the
 * shipped v2026 dashboard chips so plugging this into pages outside the
 * dashboard doesn't require any surface-specific overrides.
 */
export type StatusPillTone = "settled" | "pending" | "failed" | "info" | "neutral";

export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "tone",
})<{ tone?: StatusPillTone }>(({ theme, tone = "neutral" }) => {
  const dark = theme.palette.mode === "dark";
  const palettes: Record<StatusPillTone, { bg: string; fg: string; ring: string }> = {
    settled: {
      bg:   dark ? "rgba(204,255,0,0.12)" : "rgba(90,107,0,0.08)",
      fg:   dark ? "#CCFF00" : "#5A6B00",
      ring: dark ? "rgba(204,255,0,0.32)" : "rgba(90,107,0,0.22)",
    },
    pending: {
      bg:   dark ? "rgba(255,159,10,0.14)" : "rgba(255,159,10,0.12)",
      fg:   dark ? "#FFB04D" : "#B45309",
      ring: dark ? "rgba(255,159,10,0.34)" : "rgba(255,159,10,0.28)",
    },
    failed: {
      bg:   dark ? "rgba(255,91,73,0.14)" : "rgba(255,91,73,0.10)",
      fg:   dark ? "#FF7A6B" : "#B91C1C",
      ring: dark ? "rgba(255,91,73,0.34)" : "rgba(255,91,73,0.26)",
    },
    info: {
      bg:   dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.08)",
      fg:   dark ? "#A5B4FC" : "#4F46E5",
      ring: dark ? "rgba(129,140,248,0.30)" : "rgba(79,70,229,0.22)",
    },
    neutral: {
      bg:   dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)",
      fg:   dark ? "rgba(255,255,255,0.72)" : "rgba(10,10,15,0.62)",
      ring: dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.12)",
    },
  };
  const { bg, fg, ring } = palettes[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    fontFamily: "var(--font-tech), ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: fg,
    backgroundColor: bg,
    border: `1px solid ${ring}`,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
});
