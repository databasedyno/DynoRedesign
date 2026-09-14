import React from "react";
import { Box, Button, Menu, MenuItem, Popover, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "../coinbase/styled";

const paperSx = (isDark: boolean, extra: Record<string, unknown>) => ({
  mt: 1,
  borderRadius: "12px",
  border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
  ...extra,
});

interface SettingsProps {
  anchor: HTMLElement | null;
  onClose: () => void;
}

/** Dashboard settings menu: theme + density toggles. */
export const BalanceSettingsMenu: React.FC<SettingsProps> = ({ anchor, onClose }) => {
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { mode, toggleTheme } = useThemeMode();
  const { isCompact, toggleDensity } = useDashboardDensity();
  const isDark = mode === "dark";
  const itemSx = { fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 };
  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{ sx: paperSx(isDark, { minWidth: 236 }) }}
    >
      <MenuItem onClick={() => toggleTheme()} data-testid="dash2026-toggle-theme" sx={itemSx}>
        <Icon name={isDark ? "sun" : "moon"} size={18} style={{ marginRight: 12 }} />
        {isDark ? t("switchLight", { defaultValue: "Light mode" }) : t("switchDark", { defaultValue: "Dark mode" })}
      </MenuItem>
      <MenuItem onClick={() => toggleDensity()} data-testid="dash2026-toggle-density" sx={itemSx}>
        <Icon name={isCompact ? "rows-3" : "rows-2"} size={18} style={{ marginRight: 12 }} />
        {isCompact ? t("spaciousView", { defaultValue: "Spacious view" }) : t("compactView", { defaultValue: "Compact view" })}
      </MenuItem>
    </Menu>
  );
};

interface CustomRangeProps {
  anchor: HTMLElement | null;
  isDark: boolean;
  today: string;
  draftStart: string;
  draftEnd: string;
  setDraftStart: (v: string) => void;
  setDraftEnd: (v: string) => void;
  customActive: boolean;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

/** Custom date-range popover (From / To + Clear / Apply). */
export const CustomRangePopover: React.FC<CustomRangeProps> = ({ anchor, isDark, today, draftStart, draftEnd, setDraftStart, setDraftEnd, customActive, onApply, onClear, onClose }) => {
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primaryInk = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const dateSx = { "& input::-webkit-calendar-picker-indicator": { filter: isDark ? "invert(0.8)" : "none", cursor: "pointer" } };
  return (
    <Popover
      open={Boolean(anchor)}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      PaperProps={{ sx: paperSx(isDark, { p: 2, width: 280 }) }}
    >
      <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, mb: 1.5, color: primaryInk }}>
        {t("customRangeTitle", { defaultValue: "Custom date range" })}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          type="date"
          size="small"
          label={t("from", { defaultValue: "From" })}
          InputLabelProps={{ shrink: true }}
          value={draftStart}
          onChange={(e) => setDraftStart(e.target.value)}
          inputProps={{ max: draftEnd || today }}
          data-testid="dash2026-custom-start"
          sx={dateSx}
        />
        <TextField
          type="date"
          size="small"
          label={t("to", { defaultValue: "To" })}
          InputLabelProps={{ shrink: true }}
          value={draftEnd}
          onChange={(e) => setDraftEnd(e.target.value)}
          inputProps={{ min: draftStart, max: today }}
          data-testid="dash2026-custom-end"
          sx={dateSx}
        />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, gap: 1 }}>
        {customActive ? (
          <Button size="small" onClick={onClear} data-testid="dash2026-custom-clear" sx={{ textTransform: "none", fontFamily: "var(--font-sans)", color: muted }}>
            {t("clear", { defaultValue: "Clear" })}
          </Button>
        ) : (
          <Box />
        )}
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={onApply}
          disabled={!draftStart || !draftEnd || draftStart > draftEnd}
          data-testid="dash2026-custom-apply"
          sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, borderRadius: 999, px: 2, background: indigo, "&:hover": { background: indigo, opacity: 0.9 } }}
        >
          {t("apply", { defaultValue: "Apply" })}
        </Button>
      </Box>
    </Popover>
  );
};
