import React, { useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Icon } from "@/styles/uiKit";
import { GhostIconButton } from "../styled";
import { BalanceRangeControl } from "../BalanceRangeControl";
import { BalanceSettingsMenu, CustomRangePopover } from "../BalanceStripMenus";
import type { CustomRange, RangeId } from "../ranges";
import PulseChip from "./PulseChip";
import type { DashboardOverview } from "./useDashboardOverview";

interface Props {
  pulse?: DashboardOverview["pulse"] | null;
  pulseLoading?: boolean;
  range: RangeId;
  custom: CustomRange;
  onRangeChange: (r: RangeId) => void;
  onCustomApply: (startDate: string, endDate: string) => void;
  onCustomClear: () => void;
}

const isoDay = (d: Date) => d.toISOString().split("T")[0];

/** Zone 1 — live pulse on the left, the global range control + settings on the right. */
const RangeBar: React.FC<Props> = ({ pulse, pulseLoading, range, custom, onRangeChange, onCustomApply, onCustomClear }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [customAnchor, setCustomAnchor] = useState<null | HTMLElement>(null);

  const customActive = !!(custom && custom.startDate && custom.endDate);
  const today = useMemo(() => isoDay(new Date()), []);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDay(d);
  }, []);
  const [draftStart, setDraftStart] = useState(custom?.startDate || defaultStart);
  const [draftEnd, setDraftEnd] = useState(custom?.endDate || today);

  const fmtDay = (iso: string) => {
    try {
      return format(new Date(`${iso}T00:00:00`), "MMM d");
    } catch {
      return iso;
    }
  };
  const customLabel = customActive && custom
    ? `${fmtDay(custom.startDate)} – ${fmtDay(custom.endDate)}`
    : t("customRange", { defaultValue: "Custom" });

  const openCustom = (anchor: HTMLElement) => {
    setDraftStart(custom?.startDate || defaultStart);
    setDraftEnd(custom?.endDate || today);
    setCustomAnchor(anchor);
  };
  const applyCustom = () => {
    if (draftStart && draftEnd && draftStart <= draftEnd) {
      onCustomApply(draftStart, draftEnd);
      setCustomAnchor(null);
    }
  };

  return (
    <Box
      data-testid="dashboard-range-bar"
      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}
    >
      <PulseChip pulse={pulse} loading={pulseLoading} />
      <Box data-testid="dashboard-range-control" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <BalanceRangeControl
          isDark={isDark}
          range={range}
          customActive={customActive}
          customLabel={customLabel}
          onRangeChange={onRangeChange}
          onOpenCustom={openCustom}
        />
        <GhostIconButton
          data-testid="dash2026-settings"
          aria-label={t("dashboardSettings", { defaultValue: "Dashboard settings" })}
          onClick={(e) => setSettingsAnchor(e.currentTarget)}
        >
          <Icon name="sliders-horizontal" size={18} />
        </GhostIconButton>
      </Box>

      <BalanceSettingsMenu anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} />
      <CustomRangePopover
        anchor={customAnchor}
        isDark={isDark}
        today={today}
        draftStart={draftStart}
        draftEnd={draftEnd}
        setDraftStart={setDraftStart}
        setDraftEnd={setDraftEnd}
        customActive={customActive}
        onApply={applyCustom}
        onClear={() => {
          onCustomClear();
          setCustomAnchor(null);
        }}
        onClose={() => setCustomAnchor(null)}
      />
    </Box>
  );
};

export default RangeBar;
