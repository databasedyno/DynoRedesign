import { createTheme } from "@mui/material";
import { BRAND_ACCENT, BRAND_ACCENT_HOVER, BRAND_ON_ACCENT, DARK, GOLD, GOLD_DEEP, INK, LIGHT } from "@/constants/theme";

/**
 * homeTheme — Dynopay marketing surface (landing, fees, blog, docs, legal,
 * system-status, hosted checkout default chrome). 2026-09 rebrand: gold leads,
 * dark brown / black grounds, cream neutrals. SafeDeal keeps its own theme
 * (Components/SafeDeal/SafeDealShell) and the signed-in dashboard keeps its own.
 *
 * NOTE: `background.paper` is kept OPAQUE on purpose so shared MUI surfaces that
 * read it (header menus, language dropdown, tooltips) stay crisp.
 *
 * A non-standard `primary.hover` token is added (cast `as any`) — consumed by
 * CustomButton / HomeButton with safe fallbacks.
 */

// Marketing accent — signal gold (pairs with dark-brown text). Kept name for back-compat.
export const HOME_LIME = BRAND_ACCENT;

/** Links: dark brown on light, gold on dark. Text/outlined buttons never render gold text on cream. */
const homeComponents = (isDark: boolean) => {
  const link = isDark ? GOLD : INK;
  const fg = isDark ? GOLD : GOLD_DEEP;
  return {
    MuiLink: {
      styleOverrides: {
        root: { color: link, textDecorationColor: isDark ? "rgba(255,209,0,0.45)" : "rgba(43,29,20,0.35)" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none" as const, fontWeight: 600 },
        containedPrimary: {
          color: BRAND_ON_ACCENT,
          backgroundColor: BRAND_ACCENT,
          "&:hover": { backgroundColor: BRAND_ACCENT_HOVER },
        },
        outlinedPrimary: {
          color: fg,
          borderColor: isDark ? "rgba(255,209,0,0.5)" : "rgba(139,94,0,0.45)",
          "&:hover": { borderColor: fg, backgroundColor: isDark ? "rgba(255,209,0,0.10)" : "rgba(139,94,0,0.08)" },
        },
        textPrimary: {
          color: fg,
          "&:hover": { backgroundColor: isDark ? "rgba(255,209,0,0.10)" : "rgba(139,94,0,0.08)" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: { backgroundColor: BRAND_ACCENT, color: BRAND_ON_ACCENT },
        outlinedPrimary: { color: fg, borderColor: fg },
      },
    },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? GOLD : INK } } } },
    MuiRadio: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? GOLD : INK } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: fg },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { "&.Mui-focused": { color: fg } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: BRAND_ACCENT } } },
    MuiTab: { styleOverrides: { root: { "&.Mui-selected": { color: isDark ? DARK.text : LIGHT.text } } } },
  };
};

export const homeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: BRAND_ACCENT,
      dark: BRAND_ACCENT_HOVER,
      light: "rgba(255,209,0,0.16)",
      contrastText: BRAND_ON_ACCENT,
      hover: BRAND_ACCENT_HOVER,
    } as any,
    // Secondary = dark brown (solid "ink" buttons / chips on the marketing site).
    secondary: {
      main: "#2B1D14",
      dark: "#0B0908",
      light: "rgba(43,29,20,0.08)",
      contrastText: "#FFFDF7",
    },
    success: {
      main: "#15803D",
    },
    text: {
      primary: LIGHT.text,
      secondary: LIGHT.textSecondary,
      // ~4.6:1 muted (WCAG AA) for badge subtitles, footnotes, section eyebrows.
      disabled: LIGHT.textMuted,
    },
    background: {
      default: LIGHT.canvas,
      paper: LIGHT.surface,
    },
    divider: "rgba(43,29,20,0.10)",
    border: {
      main: "rgba(43,29,20,0.12)",
      focus: GOLD_DEEP,
    } as any,
    // Custom `surface` palette used by the checkout (pay) page. Must exist in
    // BOTH light and dark or `theme.palette.surface.border` throws in dark mode.
    surface: {
      main: LIGHT.raised,
      paper: LIGHT.surface,
      border: LIGHT.border,
    } as any,
    action: {
      hover: "rgba(43,29,20,0.04)",
      selected: "rgba(255,209,0,0.16)",
    },
  },
  components: homeComponents(false),
});

export const homeThemeDark = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: BRAND_ACCENT,
      dark: BRAND_ACCENT_HOVER,
      light: "rgba(255,209,0,0.16)",
      contrastText: BRAND_ON_ACCENT,
      hover: "#FFDA33",
    } as any,
    // Secondary = cream "ink-inverse" for solid neutral buttons on dark.
    secondary: {
      main: "#F3EDE2",
      dark: "#D9CFC2",
      light: "rgba(255,240,210,0.10)",
      contrastText: "#2B1D14",
    },
    success: {
      main: "#22C55E",
    },
    text: {
      primary: DARK.text,
      secondary: DARK.textSecondary,
      disabled: DARK.textMuted,
    },
    background: {
      default: DARK.canvas,
      paper: DARK.surface,
    },
    divider: "rgba(255,240,210,0.10)",
    border: {
      main: "rgba(255,240,210,0.14)",
      focus: GOLD,
    } as any,
    // Custom `surface` palette used by the checkout (pay) page — see light theme note.
    surface: {
      main: DARK.canvas,
      paper: DARK.surface,
      border: DARK.border,
    } as any,
    action: {
      hover: "rgba(255,240,210,0.06)",
      selected: "rgba(255,209,0,0.14)",
    },
  },
  components: homeComponents(true),
});
