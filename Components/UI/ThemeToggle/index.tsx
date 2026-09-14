import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

interface ThemeToggleProps {
  size?: "small" | "medium";
  sx?: any;
  "data-testid"?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = "medium",
  sx,
  "data-testid": testId = "theme-toggle-button",
}) => {
  const { isDark, toggleTheme } = useThemeMode();
  const { t } = useTranslation("common");
  const label = isDark
    ? t("theme.switchToLight", { defaultValue: "Switch to light mode" })
    : t("theme.switchToDark", { defaultValue: "Switch to dark mode" });

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleTheme}
        size={size}
        data-testid={testId}
        aria-label={label}
        sx={{
          color: isDark ? "#FFD54F" : "#676768",
          transition: "background-color 200ms cubic-bezier(0.16, 1, 0.3, 1), color 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          // F13: enforce 44x44 minimum touch target (WCAG 2.5.5 / iOS HIG).
          // The icon inside stays visually the same via padding.
          minWidth: 44,
          minHeight: 44,
          "&:hover": {
            backgroundColor: isDark ? "rgba(255, 213, 79, 0.1)" : "rgba(0, 4, 255, 0.06)",
            transform: "rotate(30deg)",
          },
          ...sx,
        }}
      >
        {isDark ? (
          <LightModeOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />
        ) : (
          <DarkModeOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
