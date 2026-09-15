import React from "react";
import { Box, Skeleton, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { DeltaChip, CB_TOKENS } from "../../coinbase/styled";
import { durationLabel, signed } from "./format";
import type { DashboardOverview } from "./useDashboardOverview";

interface Props {
  health?: DashboardOverview["health"] | null;
  loading: boolean;
}

interface Stat {
  id: string;
  label: string;
  value: string;
  tip: string;
  /** Raw signed change of the displayed metric (drives the arrow). Undefined hides the chip. */
  change?: number;
  /** Whether that change is good news (drives the colour). */
  good?: boolean;
  unit?: string;
}

/** Beneath the trend chart: completion rate · median time to settle · underpaid + expired rate, each vs previous period. */
const CheckoutHealthLine: React.FC<Props> = ({ health, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const hairline = isDark ? "rgba(255,255,255,0.06)" : "#EEF1F6";

  const h = health;
  const hasPrev = !!h && h.previous_completion_rate > 0;
  const medianChange = h && h.median_settle_minutes != null && h.previous_median_settle_minutes != null
    ? h.median_settle_minutes - h.previous_median_settle_minutes
    : undefined;

  const stats: Stat[] = [
    {
      id: "completion",
      label: t("command.completionRate", { defaultValue: "Checkout completion" }),
      value: h ? `${h.completion_rate.toFixed(0)}%` : "—",
      tip: t("command.completionTip", { paid: h?.paid ?? 0, created: h?.created ?? 0, defaultValue: "{{paid}} of {{created}} checkouts paid" }),
      change: h && hasPrev ? h.completion_rate - h.previous_completion_rate : undefined,
      good: h && hasPrev ? h.completion_rate >= h.previous_completion_rate : undefined,
      unit: "pp",
    },
    {
      id: "settle",
      label: t("command.medianSettle", { defaultValue: "Median time to settle" }),
      value: durationLabel(h?.median_settle_minutes, t),
      tip: t("command.medianSettleTip", { defaultValue: "From checkout created to funds settled, median of paid checkouts" }),
      change: medianChange,
      good: medianChange != null ? medianChange <= 0 : undefined,
      unit: "min",
    },
    {
      id: "exceptions",
      label: t("command.exceptionRate", { defaultValue: "Underpaid + expired" }),
      value: h ? `${h.exception_rate.toFixed(0)}%` : "—",
      tip: t("command.exceptionTip", { underpaid: h?.underpaid_count ?? 0, expired: h?.expired_count ?? 0, defaultValue: "{{underpaid}} underpaid · {{expired}} expired unpaid" }),
      change: h && hasPrev ? h.exception_rate - h.previous_exception_rate : undefined,
      good: h && hasPrev ? h.exception_rate <= h.previous_exception_rate : undefined,
      unit: "pp",
    },
  ];

  return (
    <Box
      data-testid="checkout-health-line"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: { xs: 1.25, sm: 2 },
        pt: { xs: 1.5, md: 2 },
        borderTop: `1px solid ${hairline}`,
      }}
    >
      {stats.map((s) => (
        <Tooltip key={s.id} title={s.tip} placement="top" arrow>
          <Box data-testid={`health-${s.id}`} sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.label}
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
              <Box data-testid={`health-${s.id}-value`} sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: { xs: 18, md: 20 }, fontWeight: 600, color: ink, lineHeight: 1.1 }}>
                {loading && !h ? <Skeleton width={60} height={24} /> : s.value}
              </Box>
              {!loading && s.change != null && s.good != null && (
                <DeltaChip positive={s.good} data-testid={`health-${s.id}-delta`} sx={{ fontSize: 12 }}>
                  <Icon name={s.change >= 0 ? "arrow-up" : "arrow-down"} size={11} />
                  {signed(s.change, s.unit === "min" ? 0 : 1)} {s.unit}
                </DeltaChip>
              )}
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

export default CheckoutHealthLine;
