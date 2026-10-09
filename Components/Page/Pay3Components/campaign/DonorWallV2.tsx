/**
 * DonorWallV2 — list of recent supporters.
 *
 *   • Colour-coded avatar circles (deterministic hue from name), initials or a
 *     heart for anonymous supporters.
 *   • Top-3 donors (by amount) get an inline rank medal next to their name —
 *     inline (not absolutely positioned) so it never collides with the amount.
 *   • Relative time labels computed client-side only (no hydration drift).
 *
 * Renders nothing when there are no supporters.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import { readableOn } from "@/constants/creatorTheme";
import { useRelativeTime } from "@/hooks/useRelativeTime";

export interface DonorSupporter {
  name: string | null;
  message: string | null;
  amount: number;
  currency: string;
  at: string;
  is_anonymous?: boolean;
  organizer_reply?: string | null;
  organizer_reply_at?: string | null;
}

interface Props {
  supporters: DonorSupporter[];
  defaultCurrency: string;
  formatWithSeparators: (n: number, ccy?: string) => string;
  getCurrencySymbolFromFormat: (ccy: string) => string;
  anonymousLabel?: string;
  headerLabel?: string;
  accent?: string;
}

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const MEDAL_COLORS = ["#F5B301", "#A8B0BD", "#C6803F"];

function hueFromName(name: string | null): number {
  const s = name || "anon";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export default function DonorWallV2({
  supporters,
  defaultCurrency,
  formatWithSeparators,
  getCurrencySymbolFromFormat,
  anonymousLabel = "Anonymous",
  headerLabel = "Recent supporters",
  accent = BRAND_ACCENT,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const rel = useRelativeTime();
  const { t } = useTranslation("landing");
  const rankLabels = [
    t("donorWall.rankTop", { defaultValue: "Top supporter" }),
    t("donorWall.rank2", { defaultValue: "2nd" }),
    t("donorWall.rank3", { defaultValue: "3rd" }),
  ];
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const accentText = isDark ? accent : (readableOn(accent) === "#FFFFFF" ? accent : darken(accent, 0.38));
  const tint = alpha(accent, isDark ? 0.10 : 0.08);
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(18,18,20,0.025)";

  // Rank order of the top-3 donors by amount (index → rank 0..2).
  const rankByIdx = useMemo(() => {
    const ranked = supporters
      .map((s, idx) => ({ idx, amount: s.amount || 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
    const m = new Map<number, number>();
    ranked.forEach((r, rank) => m.set(r.idx, rank));
    return m;
  }, [supporters]);

  if (!supporters || supporters.length === 0) return null;

  return (
    <Box data-testid="donation-supporter-wall">
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography
          component="span"
          sx={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary }}
        >
          {headerLabel}
          <Box component="span" sx={{ ml: 1, color: theme.palette.text.disabled, fontWeight: 700 }}>
            · {supporters.length}
          </Box>
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {supporters.slice(0, 12).map((s, i) => {
          const anon = s.is_anonymous || !s.name;
          const displayName = anon ? anonymousLabel : (s.name as string);
          const initial = anon ? null : (s.name as string).charAt(0).toUpperCase();
          const hue = hueFromName(s.name);
          const rank = rankByIdx.get(i);
          const medal = rank !== undefined && rank < 3 ? rank : null;

          return (
            <Box
              key={`${s.at}-${i}`}
              data-testid={`donation-supporter-row-${i}`}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                p: 1.5,
                borderRadius: "16px",
                border: `1px solid ${medal !== null ? alpha(accent, 0.35) : theme.palette.divider}`,
                backgroundColor: medal !== null ? tint : surface,
                textAlign: "left",
                transition: "transform 160ms ease, border-color 160ms ease",
                "&:hover": { transform: "translateY(-1px)", borderColor: alpha(accent, 0.5) },
              }}
            >
              {/* Avatar */}
              <Box
                sx={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontFamily: MONO, fontSize: 15, fontWeight: 800,
                  backgroundColor: anon ? alpha(accent, isDark ? 0.18 : 0.14) : `hsl(${hue}, 55%, 50%)`,
                  border: `2px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.95)"}`,
                  boxShadow: `0 6px 14px ${alpha(anon ? accent : `hsl(${hue}, 55%, 50%)`, 0.28)}`,
                }}
              >
                {initial ? initial : <Icon icon="mdi:heart" width={17} color={accentText} />}
              </Box>

              {/* Body */}
              <Box flex={1} minWidth={0}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary} noWrap>
                      {displayName}
                    </Typography>
                    {medal !== null && (
                      <Tooltip title={rankLabels[medal] ?? ""}>
                        <Box
                          component="span"
                          role="img"
                          aria-label={rankLabels[medal] ?? ""}
                          data-testid={`donation-supporter-medal-${i}`}
                          sx={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            width: 22, height: 22, borderRadius: "50%",
                            bgcolor: alpha(MEDAL_COLORS[medal], 0.18), color: MEDAL_COLORS[medal],
                          }}
                        >
                          <Icon icon="mdi:medal" width={14} />
                        </Box>
                      </Tooltip>
                    )}
                  </Box>
                  <Typography
                    fontSize={14}
                    fontWeight={800}
                    fontFamily={MONO}
                    color={theme.palette.text.primary}
                    sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}
                    data-testid={`donation-supporter-amount-${i}`}
                  >
                    {getCurrencySymbolFromFormat(s.currency || defaultCurrency)}
                    {formatWithSeparators(s.amount, s.currency || defaultCurrency)}
                  </Typography>
                </Box>
                {s.message && (
                  <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.4} sx={{ wordBreak: "break-word", lineHeight: 1.5 }}>
                    &ldquo;{s.message}&rdquo;
                  </Typography>
                )}
                {s.organizer_reply && (
                  <Box
                    data-testid={`donation-supporter-reply-${i}`}
                    sx={{ mt: 0.85, pl: 1.25, pr: 1, py: 0.7, borderLeft: `2px solid ${accent}`, backgroundColor: alpha(accent, isDark ? 0.10 : 0.07), borderRadius: "10px" }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.2 }}>
                      <Icon icon="mdi:account-tie-voice" width={13} color={accentText} />
                      <Typography component="span" sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accentText }}>
                        {t("donorWall.organizerReplied", { defaultValue: "Organizer replied" })}
                      </Typography>
                    </Box>
                    <Typography fontSize={12.5} color={theme.palette.text.primary} sx={{ wordBreak: "break-word", lineHeight: 1.5 }}>
                      {s.organizer_reply}
                    </Typography>
                  </Box>
                )}
                {s.at && mounted && (
                  <Typography fontSize={11} fontFamily={MONO} color={theme.palette.text.disabled} mt={0.4} data-testid={`donation-supporter-time-${i}`}>
                    {rel(s.at)}
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
