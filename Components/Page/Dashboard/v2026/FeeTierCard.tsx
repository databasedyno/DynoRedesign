import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import { MONO } from "@/styles/uiKit";
import { toFixedStr } from "@/utils/money";

/**
 * FeeTierCard — the redesigned fee-tier progress module.
 *
 * Enhanced (Aug 2026): instead of a single "progress within the current tier"
 * bar, this now renders the FULL pricing ladder (Starter → Growth → Scale →
 * Enterprise) as a segmented meter so a merchant sees the whole journey to the
 * cheapest rate at a glance — completed tiers filled, the current tier filled
 * proportionally to this period's volume, future tiers muted, each labelled
 * with its real % rate. Below it: the current tier + rate, the exact amount to
 * the next tier, and a forward savings projection at this volume.
 *
 * Self-sources its data from useDashboardData. The ladder (feeTiers.tiers) is
 * supplied by the backend /dashboard/fee-tiers endpoint; if it's unavailable
 * we gracefully fall back to a single-tier bar.
 */

type LadderTier = {
  name?: string;
  display_name?: string;
  percent?: number;
  min_volume?: number;
  max_volume?: number | null;
  min_volume_formatted?: string;
  max_volume_formatted?: string;
  is_current?: boolean;
};

const FeeTierCard: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { feeTiers } = useDashboardData();

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const mutedInk = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primaryInk = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const trackBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.06)";

  const monthlyLimit = feeTiers?.monthlyLimit || 10000;
  const totalVolume = Number(feeTiers?.usedAmount || 0);
  const usedAmount = useMemo(
    () => Math.min(totalVolume, monthlyLimit),
    [totalVolume, monthlyLimit],
  );
  const currentTier = feeTiers?.currentTier || "Starter";
  const currentTierPercent = feeTiers?.currentTierPercent ?? 1.5;
  const nextTier = feeTiers?.nextTier || "";
  const nextTierPercent = feeTiers?.nextTierPercent ?? null;
  const amountToNextTier = Number(feeTiers?.amountToNextTier ?? 0);

  // The full pricing ladder (may be empty if the endpoint hasn't populated it).
  const ladder = useMemo<LadderTier[]>(
    () =>
      Array.isArray(feeTiers?.tiers)
        ? [...(feeTiers?.tiers as LadderTier[])].sort(
            (a, b) => Number(a.min_volume ?? 0) - Number(b.min_volume ?? 0),
          )
        : [],
    [feeTiers?.tiers],
  );
  const hasLadder = ladder.length >= 2;
  const currentIndex = useMemo(() => {
    const i = ladder.findIndex((tr) => tr.is_current);
    return i >= 0 ? i : 0;
  }, [ladder]);

  // Fill % for a given ladder segment: completed tiers = 100, future = 0,
  // current = proportional to this period's volume within the tier band.
  const segmentFill = (tier: LadderTier, i: number): number => {
    if (i < currentIndex) return 100;
    if (i > currentIndex) return 0;
    const min = Number(tier.min_volume ?? 0);
    const max = tier.max_volume == null ? null : Number(tier.max_volume);
    if (max == null) return 100; // unbounded top tier — a reached top tier is full
    const span = max - min;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, ((totalVolume - min) / span) * 100));
  };

  // Progress within the current tier (used for the "% complete" caption).
  const pct = monthlyLimit > 0 ? Math.min(100, (usedAmount / monthlyLimit) * 100) : 0;
  const remaining = Math.max(0, amountToNextTier || monthlyLimit - usedAmount);

  // Forward savings projection: at THIS period's volume, how much less would the
  // merchant pay once they reach the next (cheaper) tier. Purely motivational.
  const projectedSaving = useMemo(() => {
    if (nextTierPercent == null || nextTierPercent >= currentTierPercent) return 0;
    return (totalVolume * (currentTierPercent - nextTierPercent)) / 100;
  }, [totalVolume, currentTierPercent, nextTierPercent]);

  return (
    <SurfaceCard data-testid="dash2026-fee-tier" sx={{ p: { xs: 2.25, md: 3 } }}>
      <Eyebrow sx={{ mb: 1.75 }}>
        {t("feeTierProgress", { defaultValue: "Fee tier" })}
      </Eyebrow>

      {/* Monthly volume header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            color: mutedInk,
          }}
        >
          {t("monthlyVolume", { defaultValue: "Monthly volume" })}
        </Box>
        <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
          <Box
            component="span"
            sx={{ fontSize: 15, fontWeight: 600, color: primaryInk }}
          >
            {getCurrencySymbol("USD", formatNumberWithComma(usedAmount))}
          </Box>
          <Box
            component="span"
            sx={{ px: "6px", fontSize: 13, fontWeight: 500, color: mutedInk }}
          >
            /
          </Box>
          <Box
            component="span"
            sx={{ fontSize: 13, fontWeight: 500, color: mutedInk }}
          >
            {getCurrencySymbol("USD", monthlyLimit.toLocaleString())}
          </Box>
        </Box>
      </Box>

      {hasLadder ? (
        /* ── Segmented tier ladder: the whole journey to the cheapest rate ── */
        <Box data-testid="dash2026-fee-tier-ladder">
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75 }}>
            {ladder.map((tier, i) => {
              const fill = segmentFill(tier, i);
              const isCurrent = i === currentIndex;
              const isPassed = i < currentIndex;
              return (
                <Box
                  key={tier.name || i}
                  data-testid={`dash2026-tier-seg-${tier.name || i}`}
                  data-current={isCurrent ? "true" : "false"}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {/* segment track */}
                  <Box
                    sx={{
                      position: "relative",
                      height: isCurrent ? 8 : 6,
                      borderRadius: 999,
                      backgroundColor: isCurrent
                        ? isDark
                          ? "rgba(99,102,241,0.16)"
                          : "rgba(67,56,202,0.10)"
                        : trackBg,
                      overflow: "hidden",
                      transition: "height 200ms ease",
                      boxShadow: isCurrent
                        ? `0 0 0 1px ${isDark ? "rgba(99,102,241,0.35)" : "rgba(67,56,202,0.25)"}`
                        : "none",
                    }}
                  >
                    <Box
                      data-testid={
                        isCurrent ? "dash2026-fee-tier-bar" : undefined
                      }
                      sx={{
                        height: "100%",
                        width: `${fill}%`,
                        minWidth: fill > 0 ? 4 : 0,
                        borderRadius: 999,
                        background: indigo,
                        opacity: isPassed ? 0.55 : 1,
                        transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </Box>
                  {/* segment label: tier name (current only) + rate */}
                  <Box
                    sx={{
                      mt: 0.75,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "1px",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 10.5,
                        fontWeight: isCurrent ? 700 : 500,
                        lineHeight: 1.2,
                        textAlign: "center",
                        color: isCurrent ? primaryInk : mutedInk,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      {tier.display_name}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: MONO,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: 10.5,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        color: isCurrent ? indigo : mutedInk,
                      }}
                    >
                      {tier.percent}%
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Caption row: progress within current tier + amount to next */}
          {nextTier && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 1.5,
              }}
            >
              <Box
                data-testid="dash2026-fee-tier-pct"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: indigo,
                }}
              >
                {toFixedStr(pct, 1)}% {t("complete", { defaultValue: "complete" })}
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: mutedInk,
                }}
              >
                {getCurrencySymbol("USD", formatNumberWithComma(remaining))}{" "}
                {t("toNextTier", { defaultValue: "to next tier" })}
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        /* ── Fallback: single-tier progress bar (ladder unavailable) ── */
        <>
          <Box
            sx={{
              position: "relative",
              height: 6,
              borderRadius: 999,
              backgroundColor: trackBg,
              overflow: "hidden",
            }}
          >
            <Box
              data-testid="dash2026-fee-tier-bar"
              sx={{
                height: "100%",
                width: `${pct}%`,
                minWidth: pct > 0 ? 6 : 0,
                borderRadius: 999,
                background: indigo,
                transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 1.25,
            }}
          >
            <Box
              data-testid="dash2026-fee-tier-pct"
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                fontWeight: 600,
                color: indigo,
              }}
            >
              {toFixedStr(pct, 1)}% {t("complete", { defaultValue: "complete" })}
            </Box>
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                fontWeight: 500,
                color: mutedInk,
              }}
            >
              {getCurrencySymbol("USD", formatNumberWithComma(remaining))}{" "}
              {t("toNextTier", { defaultValue: "to next tier" })}
            </Box>
          </Box>
        </>
      )}

      {/* Current tier — quiet inline line (no filled pill) */}
      <Box
        sx={{
          mt: 2.25,
          pt: 2.25,
          borderTop: `1px solid ${
            isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light
          }`,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flexWrap: "wrap",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
        }}
      >
        <Box component="span" sx={{ color: mutedInk }}>
          {t("currentTier", { defaultValue: "Current tier" })}
        </Box>
        <Box
          component="span"
          data-testid="dash2026-tier-name"
          sx={{ fontWeight: 700, color: primaryInk }}
        >
          {currentTier}
        </Box>
        <Box
          component="span"
          data-testid="dash2026-tier-percent"
          sx={{ fontWeight: 600, color: indigo }}
        >
          · {currentTierPercent}%
        </Box>
      </Box>

      {nextTier &&
        nextTierPercent !== null &&
        nextTierPercent < currentTierPercent && (
          <Box
            data-testid="dash2026-next-tier-hint"
            sx={{
              mt: 1.5,
              textAlign: "center",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              lineHeight: 1.5,
              px: 1,
              color: mutedInk,
            }}
          >
            {(t("nextTierHint", {
              defaultValue:
                "Reach {next} tier for {pct} — save {savings} per transaction",
            }) as string)
              .replace("{next}", nextTier)
              .replace("{pct}", `${nextTierPercent}%`)
              .replace(
                "{savings}",
                `${toFixedStr((currentTierPercent - nextTierPercent), 2)}%`,
              )}
            {projectedSaving > 0 && (
              <Box
                component="span"
                data-testid="dash2026-projected-saving"
                sx={{ display: "block", mt: 0.5, fontWeight: 600, color: indigo }}
              >
                {(t("nextTierProjection", {
                  defaultValue: "≈ {amount}/mo saved at this volume",
                }) as string).replace(
                  "{amount}",
                  getCurrencySymbol("USD", formatNumberWithComma(projectedSaving)),
                )}
              </Box>
            )}
          </Box>
        )}
    </SurfaceCard>
  );
};

export default FeeTierCard;
