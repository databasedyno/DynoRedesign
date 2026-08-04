import React, { useMemo, useState } from "react";
import { Box, Divider, Menu, MenuItem, useTheme } from "@mui/material";
import {
  TuneRounded,
  DarkModeRounded,
  LightModeRounded,
  DensityMediumRounded,
  DensitySmallRounded,
  DashboardCustomizeRounded,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { rootReducer } from "@/utils/types";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { PillButton } from "../coinbase/styled";
import { CB_TOKENS, GhostIconButton } from "./styled";

export type RangeId = "7d" | "30d" | "90d" | "1y" | "all";

const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
  { id: "all", label: "All" },
];

interface Props {
  range: RangeId;
  onRangeChange: (r: RangeId) => void;
  onSwitchClassic?: () => void;
}

/**
 * CommandBar — the top zone of the 2026 dashboard: a personalised greeting +
 * date on the left, and a global time-range control + settings menu on the
 * right. The range control drives BOTH the VolumeHero chart and the KPI-strip
 * sparklines (a single fetchChartData call lives in the parent).
 */
const CommandBar: React.FC<Props> = ({ range, onRangeChange, onSwitchClassic }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { mode, toggleTheme } = useThemeMode();
  const { isCompact, toggleDensity } = useDashboardDensity();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

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
          {name ? `, ${name}` : ""}
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
              active={range === r.id}
              onClick={() => onRangeChange(r.id)}
              role="tab"
              aria-selected={range === r.id}
              data-testid={`dash2026-range-${r.id}`}
            >
              {r.label}
            </PillButton>
          ))}
        </Box>

        <GhostIconButton
          data-testid="dash2026-settings"
          aria-label={t("dashboardSettings", { defaultValue: "Dashboard settings" })}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <TuneRounded sx={{ fontSize: 18 }} />
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
              <LightModeRounded sx={{ fontSize: 18, mr: 1.5 }} />
            ) : (
              <DarkModeRounded sx={{ fontSize: 18, mr: 1.5 }} />
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
              <DensityMediumRounded sx={{ fontSize: 18, mr: 1.5 }} />
            ) : (
              <DensitySmallRounded sx={{ fontSize: 18, mr: 1.5 }} />
            )}
            {isCompact
              ? t("spaciousView", { defaultValue: "Spacious view" })
              : t("compactView", { defaultValue: "Compact view" })}
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onSwitchClassic?.();
            }}
            data-testid="dash2026-switch-classic"
            sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 }}
          >
            <DashboardCustomizeRounded sx={{ fontSize: 18, mr: 1.5 }} />
            {t("switchClassic", { defaultValue: "Switch to classic view" })}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default CommandBar;
