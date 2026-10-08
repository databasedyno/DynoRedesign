import React from "react";
import { Box, useTheme } from "@mui/material";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/contexts/ThemeContext";

/** Appearance: Light / Dark / System — the one theme control (account menu + phone More sheet). */
const ThemePreferenceControl: React.FC<{ testId?: string }> = ({ testId = "theme-preference" }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { mode, source, setPreference } = useThemeMode();
  const current = source === "system" ? "system" : mode;
  const options = [
    { key: "light", label: t("themeLight", { defaultValue: "Light" }), Icon: LightModeOutlined },
    { key: "dark", label: t("themeDark", { defaultValue: "Dark" }), Icon: DarkModeOutlined },
    { key: "system", label: t("themeSystem", { defaultValue: "System" }), Icon: SettingsBrightnessOutlined },
  ] as const;
  return (
    <Box
      role="radiogroup"
      aria-label={t("appearance", { defaultValue: "Appearance" })}
      data-testid={testId}
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2px",
        p: "3px",
        borderRadius: "10px",
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)",
      }}
    >
      {options.map(({ key, label, Icon }) => {
        const on = current === key;
        return (
          <Box
            key={key}
            component="button"
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`${testId}-${key}`}
            onClick={() => setPreference(key)}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minHeight: 36,
              px: 1,
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: on ? 700 : 500,
              color: on ? theme.palette.text.primary : theme.palette.text.secondary,
              backgroundColor: on ? theme.palette.background.paper : "transparent",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,0.12)" : "none",
              transition: "background-color 150ms ease, color 150ms ease",
              "&:focus-visible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 1 },
            }}
          >
            <Icon sx={{ fontSize: 16 }} />
            {label}
          </Box>
        );
      })}
    </Box>
  );
};

export default ThemePreferenceControl;
