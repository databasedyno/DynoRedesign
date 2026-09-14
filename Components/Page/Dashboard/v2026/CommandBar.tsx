import React, { useMemo, useState } from "react";
import { Box, Button, Menu, MenuItem, Popover, TextField, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { rootReducer } from "@/utils/types";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { PillButton } from "../coinbase/styled";
import { CB_TOKENS, GhostIconButton } from "./styled";

export type RangeId = "7d" | "30d" | "90d" | "1y";

const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

interface Props {
  range: RangeId;
  onRangeChange: (r: RangeId) => void;
  custom?: { startDate: string; endDate: string } | null;
  onCustomApply: (startDate: string, endDate: string) => void;
  onCustomClear: () => void;
}

/**
 * CommandBar — the top zone of the 2026 dashboard: a personalised greeting +
 * date on the left, and a global time-range control + settings menu on the
 * right. The range control drives BOTH the VolumeHero chart and the KPI-strip
 * sparklines (a single fetchChartData call lives in the parent).
 */
const CommandBar: React.FC<Props> = ({
  range,
  onRangeChange,
  custom,
  onCustomApply,
  onCustomClear,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { mode, toggleTheme } = useThemeMode();
  const { isCompact, toggleDensity } = useDashboardDensity();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  // ── Custom date-range picker state ──
  const [customAnchor, setCustomAnchor] = useState<null | HTMLElement>(null);
  const customActive = !!(custom && custom.startDate && custom.endDate);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);
  const [draftStart, setDraftStart] = useState<string>(custom?.startDate || defaultStart);
  const [draftEnd, setDraftEnd] = useState<string>(custom?.endDate || today);

  const fmtDay = (iso: string) => {
    try {
      return format(new Date(`${iso}T00:00:00`), "MMM d");
    } catch {
      return iso;
    }
  };
  const customLabel =
    customActive && custom
      ? `${fmtDay(custom.startDate)} – ${fmtDay(custom.endDate)}`
      : t("customRange", { defaultValue: "Custom" });

  const openCustom = (e: React.MouseEvent<HTMLElement>) => {
    setDraftStart(custom?.startDate || defaultStart);
    setDraftEnd(custom?.endDate || today);
    setCustomAnchor(e.currentTarget);
  };
  const applyCustom = () => {
    if (draftStart && draftEnd && draftStart <= draftEnd) {
      onCustomApply(draftStart, draftEnd);
      setCustomAnchor(null);
    }
  };

  const name = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile?.name,
  ) as string | undefined;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("greetMorning", { defaultValue: "Good morning" });
    if (h < 18) return t("greetAfternoon", { defaultValue: "Good afternoon" });
    return t("greetEvening", { defaultValue: "Good evening" });
  }, [t]);

  const dateStr = useMemo(() => format(new Date(), "EEEE, MMM d"), []);

  return (
    <Box
      data-testid="dash2026-commandbar"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        mb: { xs: 2, md: 2.5 },
      }}
    >
      <Box>
        <Box
          sx={{
            fontFamily:
              "var(--font-unbounded, 'Unbounded', 'Inter', system-ui)",
            fontSize: { xs: 22, md: 26 },
            fontWeight: 500,
            letterSpacing: -0.6,
            color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
          }}
        >
          {greeting}
          {name ? `, ${String(name).trim().split(/\s+/)[0]}` : ""}
        </Box>
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            mt: 0.5,
          }}
        >
          {dateStr}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box
          data-testid="dash2026-range"
          role="tablist"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            p: 0.5,
            borderRadius: 999,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(10,10,15,0.05)",
          }}
        >
          {RANGES.map((r) => (
            <PillButton
              key={r.id}
              active={range === r.id && !customActive}
              onClick={() => onRangeChange(r.id)}
              role="tab"
              aria-selected={range === r.id && !customActive}
              data-testid={`dash2026-range-${r.id}`}
            >
              {r.label}
            </PillButton>
          ))}
          <PillButton
            active={customActive}
            onClick={openCustom}
            role="tab"
            aria-selected={customActive}
            data-testid="dash2026-range-custom"
            aria-label={t("customRange", { defaultValue: "Custom range" })}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            <Icon name="calendar" size={14} />
            {customLabel}
          </PillButton>
        </Box>

        <Popover
          open={Boolean(customAnchor)}
          anchorEl={customAnchor}
          onClose={() => setCustomAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              mt: 1,
              p: 2,
              width: 280,
              borderRadius: "14px",
              border: `1px solid ${
                isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light
              }`,
            },
          }}
        >
          <Box
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 700,
              mb: 1.5,
              color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
            }}
          >
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
              sx={{
                "& input::-webkit-calendar-picker-indicator": {
                  filter: isDark ? "invert(0.8)" : "none",
                  cursor: "pointer",
                },
              }}
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
              sx={{
                "& input::-webkit-calendar-picker-indicator": {
                  filter: isDark ? "invert(0.8)" : "none",
                  cursor: "pointer",
                },
              }}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 2,
              gap: 1,
            }}
          >
            {customActive ? (
              <Button
                size="small"
                onClick={() => {
                  onCustomClear();
                  setCustomAnchor(null);
                }}
                data-testid="dash2026-custom-clear"
                sx={{
                  textTransform: "none",
                  fontFamily: "var(--font-sans)",
                  color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
                }}
              >
                {t("clear", { defaultValue: "Clear" })}
              </Button>
            ) : (
              <Box />
            )}
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={applyCustom}
              disabled={!draftStart || !draftEnd || draftStart > draftEnd}
              data-testid="dash2026-custom-apply"
              sx={{
                textTransform: "none",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                borderRadius: 999,
                px: 2,
                background: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                "&:hover": {
                  background: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                  opacity: 0.9,
                },
              }}
            >
              {t("apply", { defaultValue: "Apply" })}
            </Button>
          </Box>
        </Popover>

        <GhostIconButton
          data-testid="dash2026-settings"
          aria-label={t("dashboardSettings", { defaultValue: "Dashboard settings" })}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <Icon name="sliders-horizontal" size={18} />
        </GhostIconButton>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 236,
              borderRadius: "14px",
              border: `1px solid ${
                isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light
              }`,
            },
          }}
        >
          <MenuItem
            onClick={() => toggleTheme()}
            data-testid="dash2026-toggle-theme"
            sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 }}
          >
            {mode === "dark" ? (
              <Icon name="sun" size={18} style={{ marginRight: 12 }} />
            ) : (
              <Icon name="moon" size={18} style={{ marginRight: 12 }} />
            )}
            {mode === "dark"
              ? t("switchLight", { defaultValue: "Light mode" })
              : t("switchDark", { defaultValue: "Dark mode" })}
          </MenuItem>
          <MenuItem
            onClick={() => toggleDensity()}
            data-testid="dash2026-toggle-density"
            sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 }}
          >
            {isCompact ? (
              <Icon name="rows-3" size={18} style={{ marginRight: 12 }} />
            ) : (
              <Icon name="rows-2" size={18} style={{ marginRight: 12 }} />
            )}
            {isCompact
              ? t("spaciousView", { defaultValue: "Spacious view" })
              : t("compactView", { defaultValue: "Compact view" })}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default CommandBar;
