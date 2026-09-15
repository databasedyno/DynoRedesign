import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, useTheme } from "@mui/material";
import { format } from "date-fns";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import TxRangePresets from "@/Components/Page/Transactions/TxRangePresets";
import { DateRange } from "@/utils/types/dashboard";
import { TxRangePreset } from "@/utils/types/transaction";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { CardSx } from "./payoutsHelpers";
import { useAutoConvertSettings } from "./useAutoConvertSettings";
import { useDashboardPayouts } from "./useDashboardPayouts";
import PayoutAttention from "./PayoutAttention";
import PayoutTiles from "./PayoutTiles";
import WalletsTimeline from "./WalletsTimeline";
import RecentForwards from "./RecentForwards";
import SettlementCard from "./SettlementCard";
import SavingsCard from "./SavingsCard";
import DigestCard from "./DigestCard";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Payouts — "did my money reach my wallet, and is anything stuck?"
 * Range line → pinned attention (failed conversions / stuck forwards) → money tiles
 * (forwarded by asset · on its way · auto-convert) → per-wallet timeline + latest
 * payouts with hashes → settlement settings, protection and digest preferences.
 */
const PayoutsPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const { selectedCompanyId } = useCompanyStore();

  const [range, setRange] = useState<TxRangePreset>("30d");
  const [customDates, setCustomDates] = useState<DateRange>({ startDate: null, endDate: null });
  const datePickerRef = useRef<DatePickerRef>(null);
  const custom = range === "custom" && customDates.startDate && customDates.endDate
    ? { startDate: isoDay(customDates.startDate), endDate: isoDay(customDates.endDate) }
    : null;

  const payouts = useDashboardPayouts({ range, custom });
  const data = payouts.data ?? null;
  const loading = payouts.isLoading && !data;
  const ac = useAutoConvertSettings(selectedCompanyId);

  const rangeLabel = useMemo(() => {
    if (range === "custom" && customDates.startDate && customDates.endDate) {
      return `${format(customDates.startDate, "MMM d")} – ${format(customDates.endDate, "MMM d")}`;
    }
    const labels: Record<string, string> = {
      today: t("payouts.rangeToday", { defaultValue: "today" }),
      "7d": t("payouts.range7", { defaultValue: "last 7 days" }),
      "30d": t("payouts.range30", { defaultValue: "last 30 days" }),
      "90d": t("payouts.range90", { defaultValue: "last 90 days" }),
      all: t("payouts.rangeAll", { defaultValue: "all time" }),
    };
    return labels[range] || labels["30d"];
  }, [range, customDates, t]);

  const cardSx: CardSx = {
    borderRadius: 3,
    border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
    bgcolor: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
    p: { xs: 2, sm: 2.5 },
  };
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;

  return (
    <Box data-testid="payouts-root" sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 } }}>
      <Box data-testid="payouts-range-bar" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
          {t("payouts.rangeLead", { defaultValue: "Showing payouts for" })}{" "}
          <Box component="span" sx={{ fontWeight: 700, color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight }}>{rangeLabel}</Box>
        </Box>
        <TxRangePresets
          range={range}
          customLabel={rangeLabel}
          onChange={(preset) => setRange(preset)}
          onOpenCustom={(anchor) => datePickerRef.current?.open({ currentTarget: anchor })}
        />
        <Box sx={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
          <CustomDatePicker
            ref={datePickerRef}
            value={customDates}
            onChange={(next: DateRange) => {
              setCustomDates(next);
              setRange(next.startDate && next.endDate ? "custom" : "30d");
            }}
            hideTrigger
          />
        </Box>
      </Box>

      {data && <PayoutAttention data={data} onChanged={() => payouts.mutate()} />}

      <PayoutTiles data={data} loading={loading} rangeLabel={rangeLabel} ac={ac} />

      <Box sx={{ display: "grid", gap: { xs: 2, sm: 2.5 }, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, alignItems: "start" }}>
        <WalletsTimeline data={data} loading={loading} rangeLabel={rangeLabel} />
        <RecentForwards data={data} loading={loading} companyId={selectedCompanyId} />
      </Box>

      <Box id="payouts-settlement" sx={{ scrollMarginTop: 96 }}>
        <SettlementCard ac={ac} cardSx={cardSx} hideToggle />
      </Box>
      <Box sx={{ display: "grid", gap: { xs: 2, sm: 2.5 }, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, alignItems: "start" }}>
        <SavingsCard companyId={selectedCompanyId} cardSx={cardSx} />
        <DigestCard cardSx={cardSx} />
      </Box>
    </Box>
  );
};

export default PayoutsPage;
