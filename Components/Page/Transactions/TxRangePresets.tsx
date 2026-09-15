import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { PillButton } from "@/Components/Page/Dashboard/coinbase/styled";
import { TxRangePreset } from "@/utils/types/transaction";
import { TX_RANGE_PRESETS } from "./txRange";

interface Props {
  range: TxRangePreset;
  /** Label shown on the custom pill once a custom window is applied. */
  customLabel: string;
  onChange: (preset: Exclude<TxRangePreset, "custom">) => void;
  onOpenCustom: (anchor: HTMLElement) => void;
}

/** Segmented date presets (Today · 7D · 30D · 90D · All) + a calendar pill for a custom window. */
const TxRangePresets: React.FC<Props> = ({ range, customLabel, onChange, onOpenCustom }) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isDark = theme.palette.mode === "dark";
  const customActive = range === "custom";
  return (
    <Box
      data-testid="transactions-range-presets"
      role="tablist"
      aria-label={t("rangeLabel", { defaultValue: "Date range" }) as string}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        p: 0.5,
        borderRadius: 999,
        flexShrink: 0,
        maxWidth: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)",
      }}
    >
      {TX_RANGE_PRESETS.map((p) => (
        <PillButton
          key={p.id}
          active={range === p.id}
          role="tab"
          aria-selected={range === p.id}
          onClick={() => onChange(p.id)}
          data-testid={`transactions-range-${p.id}`}
          sx={{ whiteSpace: "nowrap", minHeight: 32 }}
        >
          {t(p.key, { defaultValue: p.fallback })}
        </PillButton>
      ))}
      <PillButton
        active={customActive}
        role="tab"
        aria-selected={customActive}
        onClick={(e: React.MouseEvent<HTMLElement>) => onOpenCustom(e.currentTarget)}
        data-testid="transactions-range-custom"
        aria-label={t("customRange", { defaultValue: "Custom range" }) as string}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap", minHeight: 32 }}
      >
        <Icon name="calendar" size={14} />
        {customActive ? customLabel : t("customShort", { defaultValue: "Custom" })}
      </PillButton>
    </Box>
  );
};

export default TxRangePresets;
