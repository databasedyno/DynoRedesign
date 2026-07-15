/**
 * CountdownPill — urgency-aware campaign countdown chip.
 *
 * Renders a lozenge showing days/hours/minutes remaining. Colour + animation
 * shift as the deadline approaches:
 *   • > 7 days  → cool green (calm, informative)
 *   • 3–7 days  → soft amber (heads-up)
 *   • < 3 days  → warm amber (urgent)
 *   • < 24 h    → red with pulse (last chance)
 *   • 0        → returns null (parent should hide the strip entirely)
 *
 * Re-computes on mount + every 60 s while the tab is focused so the label
 * stays fresh without page reloads.
 */
import React, { useEffect, useState } from "react";
import { Box, useTheme, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";

interface Props {
  endsAt: string; // ISO date string
}

const pulse = keyframes`
  0%,100% { transform: scale(1);   opacity: 1;   }
  50%     { transform: scale(1.02); opacity: 0.9; }
`;

function computeLabel(endsAt: string) {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  const msLeft = end - Date.now();
  if (msLeft <= 0) return null;

  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
  const minutesLeft = Math.ceil(msLeft / (1000 * 60));

  let label = "Ends soon";
  if (daysLeft > 1) label = `Ends in ${daysLeft} days`;
  else if (hoursLeft > 1) label = `Ends in ${hoursLeft} hours`;
  else if (minutesLeft > 1) label = `Ends in ${minutesLeft} min`;

  let severity: "calm" | "notice" | "urgent" | "critical" = "calm";
  if (daysLeft <= 1) severity = "critical";
  else if (daysLeft <= 3) severity = "urgent";
  else if (daysLeft <= 7) severity = "notice";

  return { label, severity } as const;
}

export default function CountdownPill({ endsAt }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [tick, setTick] = useState(0);

  // Re-render every 60 s while visible so the label ticks down organically.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Guard SSR / hydration mismatch: only compute on client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // consume tick to keep effect-deps happy
  void tick;

  const info = computeLabel(endsAt);
  if (!info) return null;
  const { label, severity } = info;

  const palettes: Record<
    typeof severity,
    { bg: string; fg: string; border: string; iconColor: string; animate: boolean }
  > = {
    calm: {
      bg: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.10)",
      fg: isDark ? "#6EE7B7" : "#065F46",
      border: isDark ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.4)",
      iconColor: isDark ? "#34D399" : "#10B981",
      animate: false,
    },
    notice: {
      bg: isDark ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.12)",
      fg: isDark ? "#FCD34D" : "#78350F",
      border: isDark ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.45)",
      iconColor: isDark ? "#F59E0B" : "#B45309",
      animate: false,
    },
    urgent: {
      bg: isDark ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.14)",
      fg: isDark ? "#FDBA74" : "#7C2D12",
      border: isDark ? "rgba(249,115,22,0.45)" : "rgba(249,115,22,0.55)",
      iconColor: isDark ? "#FB923C" : "#EA580C",
      animate: false,
    },
    critical: {
      bg: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.14)",
      fg: isDark ? "#FCA5A5" : "#7F1D1D",
      border: isDark ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.6)",
      iconColor: isDark ? "#F87171" : "#DC2626",
      animate: true,
    },
  };

  const p = palettes[severity];

  return (
    <Box
      data-testid="donation-countdown-pill"
      data-severity={severity}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.35,
        borderRadius: "999px",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: p.fg,
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        animation: p.animate ? `${pulse} 1.6s ease-in-out infinite` : "none",
      }}
    >
      <Icon icon="mdi:timer-outline" width={13} color={p.iconColor} />
      {label}
    </Box>
  );
}
