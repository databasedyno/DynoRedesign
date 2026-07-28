/**
 * DonorWallV2 — enhanced list of recent supporters.
 *
 * Improvements over the previous flat list:
 *   • Colour-coded avatar circles (deterministic hue from name), with initials
 *     or a heart icon for anonymous supporters.
 *   • Top-3 donors (by amount) get a 🥇 / 🥈 / 🥉 medal ribbon corner.
 *   • Relative time labels ("just now / 5m ago / 3h ago / 2d ago") — computed
 *     client-side only to avoid SSR/hydration drift.
 *   • Compact list keeps focus on the donation amount and message.
 *
 * Renders nothing when there are no supporters — parent should hide the
 * whole section in that case.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";

export interface DonorSupporter {
  name: string | null;
  message: string | null;
  amount: number;
  currency: string;
  at: string;
  is_anonymous?: boolean;
}

interface Props {
  supporters: DonorSupporter[];
  defaultCurrency: string;
  formatWithSeparators: (n: number, ccy?: string) => string;
  getCurrencySymbolFromFormat: (ccy: string) => string;
  anonymousLabel?: string;
  headerLabel?: string;
}

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 45) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  return dd < 30 ? `${dd}d ago` : `${Math.floor(dd / 30)}mo ago`;
}

function hueFromName(name: string | null): number {
  const s = name || "anon";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

const MEDALS: Array<{ emoji: string; label: string }> = [
  { emoji: "🥇", label: "Top supporter" },
  { emoji: "🥈", label: "2nd" },
  { emoji: "🥉", label: "3rd" },
];

export default function DonorWallV2({
  supporters,
  defaultCurrency,
  formatWithSeparators,
  getCurrencySymbolFromFormat,
  anonymousLabel = "Anonymous",
  headerLabel = "Recent supporters",
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const accent = "#4F46E5";
  const limeTint = isDark ? "rgba(79,70,229,0.10)" : "rgba(79,70,229,0.16)";
  const border = theme.palette.divider;
  const surfaceGlass = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  // Rank top-3 donors by amount (converted to base if same currency; if mixed
  // currencies, we compare raw amounts — imperfect but good enough).
  const top3Ids = useMemo(() => {
    const ranked = supporters
      .map((s, idx) => ({ idx, amount: s.amount || 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((x) => x.idx);
    return new Set(ranked);
  }, [supporters]);

  if (!supporters || supporters.length === 0) return null;

  return (
    <Box data-testid="donation-supporter-wall">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.25,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          {headerLabel}
          <Box component="span" sx={{ ml: 1, color: theme.palette.text.disabled, fontWeight: 600 }}>
            · {supporters.length}
          </Box>
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {supporters.slice(0, 12).map((s, i) => {
          const displayName = s.is_anonymous || !s.name ? anonymousLabel : s.name;
          const initial = s.is_anonymous || !s.name ? null : s.name.charAt(0).toUpperCase();
          const hue = hueFromName(s.name);
          const isTop = top3Ids.has(i);
          const medalIdx = isTop
            ? [...top3Ids].sort((a, b) => (supporters[b].amount || 0) - (supporters[a].amount || 0)).indexOf(i)
            : -1;
          const medal = medalIdx >= 0 && medalIdx < 3 ? MEDALS[medalIdx] : null;

          return (
            <Box
              key={`${s.at}-${i}`}
              data-testid={`donation-supporter-row-${i}`}
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 1.25,
                p: 1.5,
                borderRadius: "14px",
                border: `1px solid ${medal ? "rgba(79,70,229,0.35)" : border}`,
                backgroundColor: medal ? limeTint : surfaceGlass,
                textAlign: "left",
                overflow: "hidden",
              }}
            >
              {/* Medal ribbon (top-right, only for top-3) */}
              {medal && (
                <Box
                  aria-label={medal.label}
                  sx={{
                    position: "absolute",
                    top: 6,
                    right: 8,
                    fontSize: 18,
                    lineHeight: 1,
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                    pointerEvents: "none",
                  }}
                  data-testid={`donation-supporter-medal-${i}`}
                >
                  {medal.emoji}
                </Box>
              )}

              {/* Avatar */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: 700,
                  backgroundColor: s.is_anonymous || !s.name
                    ? limeTint
                    : `hsl(${hue}, 55%, 55%)`,
                  border: `2px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)"}`,
                }}
              >
                {initial ? (
                  initial
                ) : (
                  <Icon icon="mdi:heart" width={16} color={accent} />
                )}
              </Box>

              {/* Body */}
              <Box flex={1} minWidth={0}>
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                  <Typography
                    fontSize={14}
                    fontWeight={700}
                    color={theme.palette.text.primary}
                    noWrap
                    sx={{ maxWidth: "70%" }}
                  >
                    {displayName}
                  </Typography>
                  <Typography
                    fontSize={13.5}
                    fontWeight={800}
                    fontFamily={MONO}
                    color={theme.palette.text.primary}
                    sx={{ flexShrink: 0 }}
                  >
                    {getCurrencySymbolFromFormat(s.currency || defaultCurrency)}
                    {formatWithSeparators(s.amount, s.currency || defaultCurrency)}
                  </Typography>
                </Box>
                {s.message && (
                  <Typography
                    fontSize={12.5}
                    color={theme.palette.text.secondary}
                    mt={0.35}
                    sx={{ wordBreak: "break-word", lineHeight: 1.5 }}
                  >
                    &ldquo;{s.message}&rdquo;
                  </Typography>
                )}
                {s.at && mounted && (
                  <Typography
                    fontSize={11}
                    fontFamily={MONO}
                    color={theme.palette.text.disabled}
                    mt={0.35}
                    data-testid={`donation-supporter-time-${i}`}
                  >
                    {timeAgo(s.at)}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
