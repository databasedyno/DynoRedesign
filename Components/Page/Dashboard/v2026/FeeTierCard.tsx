import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import { MONO } from "@/styles/uiKit";
import CheckCircleIcon from "@/assets/Icons/correct-icon.png";

/**
 * FeeTierCard — the redesigned fee-tier progress module. Surfaces the
 * merchant's monthly processed volume against the tier ceiling, a single
 * clean progress bar (replacing the old day-by-day "bar forest"), the
 * current tier + real %-rate badge, and a next-tier savings hint.
 * Self-sources its data from useDashboardData.
 */
const FeeTierCard: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { feeTiers } = useDashboardData();

  const monthlyLimit = feeTiers?.monthlyLimit || 10000;
  const usedAmount = useMemo(
    () => Math.min(Number(feeTiers?.usedAmount || 0), monthlyLimit),
    [feeTiers?.usedAmount, monthlyLimit],
  );
  const currentTier = feeTiers?.currentTier || "Starter";
  const currentTierPercent = feeTiers?.currentTierPercent ?? 1.5;
  const nextTier = feeTiers?.nextTier || "";
  const nextTierPercent = feeTiers?.nextTierPercent ?? null;

  const pct = monthlyLimit > 0 ? Math.min(100, (usedAmount / monthlyLimit) * 100) : 0;
  const remaining = Math.max(0, monthlyLimit - usedAmount);
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

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
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
          }}
        >
          {t("monthlyVolume", { defaultValue: "Monthly volume" })}
        </Box>
        <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
          <Box
            component="span"
            sx={{
              fontSize: 15,
              fontWeight: 600,
              color: isDark
                ? CB_TOKENS.ink.primaryDark
                : CB_TOKENS.ink.primaryLight,
            }}
          >
            {getCurrencySymbol("USD", formatNumberWithComma(usedAmount))}
          </Box>
          <Box
            component="span"
            sx={{
              px: "6px",
              fontSize: 13,
              fontWeight: 500,
              color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            }}
          >
            /
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            }}
          >
            {getCurrencySymbol("USD", monthlyLimit.toLocaleString())}
          </Box>
        </Box>
      </Box>

      {/* Clean single progress bar (replaces the old day-by-day bar forest) */}
      <Box
        sx={{
          position: "relative",
          height: 10,
          borderRadius: 999,
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.06)",
          overflow: "hidden",
        }}
      >
        <Box
          data-testid="dash2026-fee-tier-bar"
          sx={{
            height: "100%",
            width: `${pct}%`,
            minWidth: pct > 0 ? 8 : 0,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${indigo} 0%, #7C5CFF 100%)`,
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
          {pct.toFixed(1)}% {t("complete", { defaultValue: "complete" })}
        </Box>
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 500,
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
          }}
        >
          {getCurrencySymbol("USD", formatNumberWithComma(remaining))}{" "}
          {t("toNextTier", { defaultValue: "to next tier" })}
        </Box>
      </Box>

      {/* Current tier badge */}
      <Box
        sx={{
          mt: 2.5,
          minHeight: 40,
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          px: 1.5,
          py: "11px",
          borderRadius: "100px",
          background: theme.palette.success.light,
          border: `1px solid ${theme.palette.success.main}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: theme.palette.success.dark,
          }}
        >
          {t("currentTier", { defaultValue: "Current tier" })}:
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Image src={CheckCircleIcon} alt="Active tier" width={16} height={16} draggable={false} />
            <Box component="span" data-testid="dash2026-tier-name">
              {currentTier}
            </Box>
            <Box
              component="span"
              data-testid="dash2026-tier-percent"
              sx={{ fontWeight: 700, ml: 0.5 }}
            >
              · {currentTierPercent}%
            </Box>
          </Box>
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
              lineHeight: 1.4,
              px: 1,
              color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
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
                `${(currentTierPercent - nextTierPercent).toFixed(2)}%`,
              )}
          </Box>
        )}
    </SurfaceCard>
  );
};

export default FeeTierCard;
