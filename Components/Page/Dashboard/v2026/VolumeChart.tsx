import React from "react";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import Sparkline from "../coinbase/Sparkline";
import { SurfaceCard, Eyebrow } from "../coinbase/styled";

interface Props {
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  loading?: boolean;
  chartLoading?: boolean;
  currencySymbol?: string;
  rangeLabel: string;
}

/**
 * VolumeChart — P4 Row 2 (left, col-span-8). The transaction-volume area chart
 * on its own quiet card. The headline number + delta now live in BalanceStrip,
 * so this card carries only the eyebrow + the single indigo Sparkline.
 */
const VolumeChart: React.FC<Props> = ({
  chartData,
  loading,
  chartLoading,
  currencySymbol = "$",
  rangeLabel,
}) => {
  const isMobile = useIsMobile("md");
  const { isCompact } = useDashboardDensity();
  const { t } = useTranslation(["dashboardLayout", "common"]);

  return (
    <SurfaceCard
      data-testid="dash2026-volume-chart"
      sx={{ ...(isCompact && { p: { xs: 1.75, md: 2 } }) }}
    >
      <Eyebrow sx={{ mb: { xs: 1.5, md: 2 } }} data-testid="dash2026-chart-eyebrow">
        {(t("volumeOver", { defaultValue: "Volume · {range}" }) as string).replace(
          "{range}",
          rangeLabel,
        )}
      </Eyebrow>
      <Sparkline
        data={chartData || []}
        loading={loading || chartLoading}
        height={isCompact ? (isMobile ? 140 : 200) : isMobile ? 190 : 280}
        currencySymbol={currencySymbol}
      />
    </SurfaceCard>
  );
};

export default VolumeChart;
