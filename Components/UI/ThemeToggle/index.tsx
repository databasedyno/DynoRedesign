import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useThemeMode } from "@/contexts/ThemeContext";

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

  return (
    <Tooltip title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
      <IconButton
        onClick={toggleTheme}
        size={size}
        data-testid={testId}
        aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        sx={{
          color: isDark ? "#FFD54F" : "#676768",
          transition: "all 0.3s ease",
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
