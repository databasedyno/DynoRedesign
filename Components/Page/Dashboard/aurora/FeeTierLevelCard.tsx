// FeeTierLevelCard — Aurora "level ladder → unlock lower fees" widget.
// Restores the fee-tier progress that the Aurora rewrite dropped, rebuilt to
// match the Aurora surface tokens (volt-lime unlocked levels, coral current,
// muted locked). Driven by feeTiers from useDashboardData (same source the
// legacy DashboardRightSection used):
//   usedAmount        → all-time cumulative USD volume
//   tiers[]           → full ladder ({ display_name, percent, min_volume, is_current })
//   currentTier(%)    → tier the merchant is on right now
//   nextTier(%)       → the tier that unlocks a lower fee
//   percentToNextTier → 0-100 progress toward the next level
//   amountToNextTier  → USD still needed to level up
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import { useDashboardData } from "@/hooks/useDashboardData";
import useIsMobile from "@/hooks/useIsMobile";
import {
  CheckRounded,
  LockOutlined,
  SavingsOutlined,
} from "@mui/icons-material";
import { Box, Skeleton, useTheme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Body,
  CardTitle,
  CORAL,
  DeltaChip,
  Eyebrow,
  MonoLabel,
  SurfaceCard,
  VOLT,
  VOLT_INK,
} from "./styled";

interface TierItem {
  name?: string;
  display_name?: string;
  percent?: number;
  min_volume?: number;
  max_volume?: number | null;
  max_volume_formatted?: string;
  is_current?: boolean;
}

const FeeTierLevelCard: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("sm");
  const { feeTiers, loading } = useDashboardData();
  const { t } = useTranslation("dashboardLayout");
  const td = (key: string, dflt: string) => t(key, { defaultValue: dflt });

  const currency = (feeTiers as any)?.currency || "USD";
  const usedAmount = Number(feeTiers?.usedAmount || 0);
  const currentTier = feeTiers?.currentTier || "Starter";
  const currentPct = Number(feeTiers?.currentTierPercent ?? 1.5);
  const nextTier = feeTiers?.nextTier || "";
  const nextPctRaw = feeTiers?.nextTierPercent;
  const nextPct =
    nextPctRaw === null || nextPctRaw === undefined ? null : Number(nextPctRaw);
  const amountToNext = Number(feeTiers?.amountToNextTier || 0);
  const pctToNext = Math.min(
    100,
    Math.max(0, Number(feeTiers?.percentToNextTier || 0)),
  );
  const tiers: TierItem[] = Array.isArray(feeTiers?.tiers)
    ? (feeTiers.tiers as TierItem[])
    : [];

  const atTopTier = !nextTier || nextPct === null;
  const savings = nextPct !== null ? Math.max(0, currentPct - nextPct) : 0;

  const fmtMoney = (n: number) =>
    getCurrencySymbol(currency, formatNumberWithComma(Math.round(n)));

  // Build ladder steps. A tier is "unlocked" once the merchant's all-time
  // volume clears its min_volume threshold. The current tier gets a coral
  // highlight ring; unlocked-but-past tiers glow volt; future tiers are muted.
  const ladder = useMemo(() => {
    if (!tiers.length) return [];
    return tiers.map((tier) => {
      const min = Number(tier.min_volume ?? 0);
      const unlocked = usedAmount >= min;
      const isCurrent =
        Boolean(tier.is_current) ||
        (tier.display_name || tier.name || "").toLowerCase() ===
          currentTier.toLowerCase();
      return {
        label: tier.display_name || tier.name || "",
        percent: Number(tier.percent ?? 0),
        unlocked,
        isCurrent,
      };
    });
  }, [tiers, usedAmount, currentTier]);

  const mutedTrack = dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.06)";
  const voltFill = dark ? VOLT : VOLT_INK;

  return (
    <SurfaceCard
      data-testid="aurora-fee-tier-level"
      sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 280 }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Eyebrow>{td("feeTierLevel", "Fee tier")}</Eyebrow>
        <MonoLabel sx={{ fontSize: 11 }}>
          {fmtMoney(usedAmount)} {td("volumeLabel", "volume")}
        </MonoLabel>
      </Box>

      {/* Current tier + rate */}
      {loading ? (
        <Skeleton variant="text" width={200} height={44} sx={{ transform: "none" }} />
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
          <CardTitle data-testid="fee-tier-current-name" sx={{ fontSize: 26 }}>
            {currentTier}
          </CardTitle>
          <DeltaChip variant="positive" data-testid="fee-tier-current-percent">
            {currentPct}% {td("perTx", "per tx")}
          </DeltaChip>
        </Box>
      )}

      {/* Level ladder */}
      {ladder.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: isMobile ? 0.75 : 1,
            mt: 0.5,
          }}
        >
          {ladder.map((step, i) => (
            <Box
              key={`${step.label}-${i}`}
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
              }}
            >
              {/* level bar */}
              <Box
                sx={{
                  height: 8,
                  borderRadius: 999,
                  background: step.unlocked
                    ? `linear-gradient(90deg, ${voltFill}, ${step.isCurrent ? CORAL : voltFill})`
                    : mutedTrack,
                  boxShadow: step.isCurrent
                    ? `0 0 0 2px ${dark ? "#15151B" : "#FFFFFF"}, 0 0 0 3px ${CORAL}`
                    : "none",
                  transition: "background 240ms ease",
                }}
              />
              {/* level label */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, minWidth: 0 }}>
                {step.unlocked ? (
                  <CheckRounded
                    sx={{ fontSize: 12, color: step.isCurrent ? CORAL : voltFill, flexShrink: 0 }}
                  />
                ) : (
                  <LockOutlined
                    sx={{
                      fontSize: 11,
                      color: dark ? "rgba(255,255,255,0.4)" : "#A1A1AA",
                      flexShrink: 0,
                    }}
                  />
                )}
                <MonoLabel
                  noWrap
                  sx={{
                    fontSize: isMobile ? 9.5 : 10.5,
                    fontWeight: step.isCurrent ? 700 : 500,
                    color: step.isCurrent
                      ? dark
                        ? "#F5F5F5"
                        : "#0A0A0A"
                      : undefined,
                  }}
                >
                  {step.label}
                </MonoLabel>
              </Box>
              <MonoLabel
                sx={{
                  fontSize: isMobile ? 9.5 : 10.5,
                  color: step.unlocked ? voltFill : undefined,
                  fontWeight: step.unlocked ? 600 : 500,
                }}
              >
                {step.percent}%
              </MonoLabel>
            </Box>
          ))}
        </Box>
      )}

      {/* Progress toward next tier */}
      <Box sx={{ mt: "auto", pt: 1 }}>
        {atTopTier ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 1.25,
              borderRadius: 2,
              background: "rgba(204,255,0,0.12)",
              border: "1px solid rgba(204,255,0,0.28)",
            }}
          >
            <SavingsOutlined sx={{ fontSize: 18, color: voltFill }} />
            <Body sx={{ fontSize: 13, color: voltFill, fontWeight: 600 }}>
              {td("topTierUnlocked", "Top tier unlocked — you're on the lowest fee")}
            </Body>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                mb: 0.75,
              }}
            >
              <MonoLabel sx={{ fontSize: 11 }}>
                {pctToNext.toFixed(0)}% {td("towardLabel", "toward")} {nextTier}
              </MonoLabel>
              <MonoLabel sx={{ fontSize: 11 }}>
                {fmtMoney(amountToNext)} {td("toGo", "to go")}
              </MonoLabel>
            </Box>
            {/* thin track */}
            <Box
              sx={{
                position: "relative",
                height: 6,
                borderRadius: 999,
                background: mutedTrack,
                overflow: "hidden",
              }}
              data-testid="fee-tier-next-progress"
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: `${pctToNext}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${CORAL}, ${voltFill})`,
                  transition: "width 400ms ease",
                }}
              />
            </Box>
            {savings > 0 && (
              <Body
                data-testid="fee-tier-savings-hint"
                sx={{ mt: 1, fontSize: 12.5, color: dark ? "rgba(255,255,255,0.7)" : "#52525B" }}
              >
                {td("unlockNextTierHint", "Unlock {next} for {pct}% fees — save {savings}% per payment")
                  .replace("{next}", nextTier)
                  .replace("{pct}", `${nextPct}`)
                  .replace("{savings}", savings.toFixed(2))}
              </Body>
            )}
          </>
        )}
      </Box>
    </SurfaceCard>
  );
};

export default memo(FeeTierLevelCard);
