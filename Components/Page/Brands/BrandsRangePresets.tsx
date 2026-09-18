import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PillButton } from "@/Components/Page/Dashboard/coinbase/styled";
import { BrandsRange } from "./useBrands";

const PRESETS: Array<{ id: BrandsRange; key: string; fallback: string }> = [
  { id: "today", key: "brandsOverview.rangeToday", fallback: "Today" },
  { id: "7d", key: "brandsOverview.range7d", fallback: "7D" },
  { id: "30d", key: "brandsOverview.range30d", fallback: "30D" },
  { id: "90d", key: "brandsOverview.range90d", fallback: "90D" },
  { id: "1y", key: "brandsOverview.range1y", fallback: "1Y" },
  { id: "all", key: "brandsOverview.rangeAll", fallback: "All" },
];

/** Segmented date presets (Today · 7D · 30D · 90D · 1Y · All) for the brands overview. */
const BrandsRangePresets: React.FC<{ range: BrandsRange; onChange: (r: BrandsRange) => void }> = ({ range, onChange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  return (
    <Box
      data-testid="brands-range-presets"
      role="tablist"
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
      {PRESETS.map((p) => (
        <PillButton
          key={p.id}
          active={range === p.id}
          role="tab"
          aria-selected={range === p.id}
          onClick={() => onChange(p.id)}
          data-testid={`brands-range-${p.id}`}
          sx={{ whiteSpace: "nowrap", minHeight: 32 }}
        >
          {t(p.key, { defaultValue: p.fallback })}
        </PillButton>
      ))}
    </Box>
  );
};

export default BrandsRangePresets;
