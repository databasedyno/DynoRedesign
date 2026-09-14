/**
 * CountdownPill — urgency-aware campaign countdown chip.
 *
 * Shows a live "Ends in Xd Xh" (or "Xh Xm" / "Xm") label that ticks down while
 * the tab is focused. Colour + animation shift as the deadline approaches:
 *   • > 7 days  → cool green (calm, informative)
 *   • 3–7 days  → soft amber (heads-up)
 *   • < 3 days  → warm amber (urgent)
 *   • < 24 h    → red with pulse (last chance)
 *   • 0         → returns null (parent should hide the strip entirely)
 *
 * Re-computes on mount + every 30 s while the tab is focused so the label
 * stays fresh without page reloads. Fully localized (common:donation.countdown).
 */
import React, { useEffect, useState } from "react";
import { Box, useTheme, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";

interface Props {
  endsAt: string; // ISO date string
}

type Severity = "calm" | "notice" | "urgent" | "critical";

const pulse = keyframes`
  0%,100% { transform: scale(1);   opacity: 1;   }
  50%     { transform: scale(1.02); opacity: 0.9; }
`;

function computeParts(endsAt: string) {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  const msLeft = end - Date.now();
  if (msLeft <= 0) return null;

  const days = Math.floor(msLeft / 86_400_000);
  const hours = Math.floor((msLeft % 86_400_000) / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);

  const totalDays = msLeft / 86_400_000;
  let severity: Severity = "calm";
  if (totalDays <= 1) severity = "critical";
  else if (totalDays <= 3) severity = "urgent";
  else if (totalDays <= 7) severity = "notice";

  return { days, hours, minutes, severity };
}

export default function CountdownPill({ endsAt }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const [tick, setTick] = useState(0);

  // Re-render every 30 s while visible so the label ticks down organically.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Guard SSR / hydration mismatch: only compute on client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  void tick;

  const info = computeParts(endsAt);
  if (!info) return null;
  const { days, hours, minutes, severity } = info;

  const dU = t("donation.countdown.d", { defaultValue: "d" });
  const hU = t("donation.countdown.h", { defaultValue: "h" });
  const mU = t("donation.countdown.m", { defaultValue: "m" });

  let value: string;
  if (days >= 1) value = hours > 0 ? `${days}${dU} ${hours}${hU}` : `${days}${dU}`;
  else if (hours >= 1) value = minutes > 0 ? `${hours}${hU} ${minutes}${mU}` : `${hours}${hU}`;
  else value = `${Math.max(1, minutes)}${mU}`;

  const label = t("donation.countdown.endsIn", { value, defaultValue: `Ends in ${value}` });

  const palettes: Record<Severity, { bg: string; fg: string; border: string; iconColor: string; animate: boolean }> = {
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
