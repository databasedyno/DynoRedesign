import React from "react";
import { Box, useTheme } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { tabPillActive } from "@/styles/tabPill";

/** The one "Filters" trigger used by every list toolbar (UX audit S15). */
export const FiltersButton: React.FC<{ label: string; count: number; onClick: () => void; testId: string; countTestId?: string }> = ({ label, count, onClick, testId, countTestId }) => {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      data-testid={testId}
      data-touch-44=""
      data-active-count={count}
      aria-label={label}
      onClick={onClick}
      sx={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        height: 40,
        px: 1.5,
        borderRadius: "10px",
        border: `1px solid ${count ? theme.palette.text.primary : theme.palette.border.main}`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background-color 150ms ease, border-color 150ms ease",
        "&:hover": { backgroundColor: theme.palette.action.hover },
        "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      }}
    >
      <Icon name="sliders-horizontal" size={16} />
      {label}
      {count > 0 && (
        <Box
          component="span"
          data-testid={countTestId || `${testId}-count`}
          sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: theme.palette.text.primary, color: theme.palette.background.paper, fontFamily: MONO, fontSize: 12, fontWeight: 700, lineHeight: 1 }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
};

/** Selectable option pill inside a filter sheet / panel. */
export const FilterOptionChip: React.FC<{ selected: boolean; onClick: () => void; testId: string; children: React.ReactNode }> = ({ selected, onClick, testId, children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      component="button"
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={testId}
      data-touch-44=""
      data-selected={selected ? "true" : "false"}
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 40,
        px: 1.5,
        borderRadius: 999,
        border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
        backgroundColor: "transparent",
        color: theme.palette.text.primary,
        ...(selected ? tabPillActive(theme) : {}),
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 },
      }}
    >
      {children}
    </Box>
  );
};

/** Section label inside a filter sheet. */
export const FilterGroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight, mb: 1.25 }}>
      {children}
    </Box>
  );
};
