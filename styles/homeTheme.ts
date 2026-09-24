import { createTheme } from "@mui/material";
import { BTN_RADIUS, GREEN, ON_YELLOW, PUB_DARK, PUB_LIGHT, RED, YELLOW, YELLOW_HOVER, YELLOW_PRESSED, YELLOW_TEXT_LIGHT } from "@/constants/publicTheme";

/**
 * homeTheme — Dynopay marketing surface (landing, fees, blog, docs, legal,
 * system-status, hosted checkout default chrome). 2026-09 Bybit-style restyle:
 * pure black / white grounds, Bybit grey scale, yellow as the only accent.
 * SafeDeal keeps its own theme and the signed-in dashboard keeps its own.
 *
 * NOTE: `background.paper` is kept OPAQUE on purpose so shared MUI surfaces that
 * read it (header menus, language dropdown, tooltips) stay crisp.
 *
 * A non-standard `primary.hover` token is added (cast `as any`) — consumed by
 * CustomButton / HomeButton with safe fallbacks.
 */

// Marketing accent — signal yellow (pairs with #121214 text). Kept name for back-compat.
export const HOME_LIME = YELLOW;

const homeComponents = (isDark: boolean) => {
  const fg = isDark ? YELLOW : YELLOW_TEXT_LIGHT;
  const link = isDark ? YELLOW : PUB_LIGHT.t1;
  return {
    MuiLink: {
      styleOverrides: {
        root: { color: link, textDecorationColor: isDark ? "rgba(255,209,0,0.45)" : "rgba(18,18,20,0.35)" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none" as const, fontWeight: 600, borderRadius: BTN_RADIUS, boxShadow: "none" },
        containedPrimary: {
          color: ON_YELLOW,
          backgroundColor: YELLOW,
          "&:hover": { backgroundColor: YELLOW_HOVER, boxShadow: "none" },
          "&:active": { backgroundColor: YELLOW_PRESSED },
        },
        outlinedPrimary: {
          color: isDark ? PUB_DARK.t1 : PUB_LIGHT.t1,
          borderColor: isDark ? PUB_DARK.border : PUB_LIGHT.border,
          "&:hover": { borderColor: isDark ? PUB_DARK.t4 : PUB_LIGHT.t3, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(18,18,20,0.04)" },
        },
        textPrimary: {
          color: fg,
          "&:hover": { backgroundColor: isDark ? "rgba(255,209,0,0.10)" : "rgba(255,209,0,0.16)" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: { backgroundColor: YELLOW, color: ON_YELLOW },
        outlinedPrimary: { color: fg, borderColor: fg },
      },
    },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? YELLOW : PUB_LIGHT.t1 } } } },
    MuiRadio: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? YELLOW : PUB_LIGHT.t1 } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: fg },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { "&.Mui-focused": { color: fg } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: YELLOW } } },
    MuiTab: { styleOverrides: { root: { "&.Mui-selected": { color: isDark ? PUB_DARK.t1 : PUB_LIGHT.t1 } } } },
  };
};

export const homeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: YELLOW,
      dark: YELLOW_PRESSED,
      light: "rgba(255,209,0,0.16)",
      contrastText: ON_YELLOW,
      hover: YELLOW_HOVER,
    } as any,
    // Secondary = Bybit black (solid "ink" buttons / chips on the marketing site).
    secondary: {
      main: PUB_LIGHT.t1,
      dark: "#000000",
      light: "rgba(18,18,20,0.08)",
      contrastText: "#FFFFFF",
    },
    success: { main: GREEN },
    error: { main: RED },
    text: {
      primary: PUB_LIGHT.t1,
      secondary: PUB_LIGHT.t2,
      disabled: PUB_LIGHT.t3,
    },
    background: {
      default: PUB_LIGHT.page,
      paper: PUB_LIGHT.card,
    },
    divider: PUB_LIGHT.line,
    border: {
      main: PUB_LIGHT.border,
      focus: YELLOW_TEXT_LIGHT,
    } as any,
    // Custom `surface` palette used by the checkout (pay) page. Must exist in
    // BOTH light and dark or `theme.palette.surface.border` throws in dark mode.
    surface: {
      main: PUB_LIGHT.surface,
      paper: PUB_LIGHT.card,
      border: PUB_LIGHT.border,
    } as any,
    action: {
      hover: "rgba(18,18,20,0.04)",
      selected: "rgba(255,209,0,0.16)",
    },
  },
  components: homeComponents(false),
});

export const homeThemeDark = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: YELLOW,
      dark: YELLOW_PRESSED,
      light: "rgba(255,209,0,0.16)",
      contrastText: ON_YELLOW,
      hover: YELLOW_HOVER,
    } as any,
    // Secondary = white "ink-inverse" for solid neutral buttons on black.
    secondary: {
      main: "#FFFFFF",
      dark: "#E9ECF0",
      light: "rgba(255,255,255,0.10)",
      contrastText: PUB_DARK.page,
    },
    success: { main: GREEN },
    error: { main: RED },
    text: {
      primary: PUB_DARK.t1,
      secondary: PUB_DARK.t2,
      disabled: PUB_DARK.t3,
    },
    background: {
      default: PUB_DARK.page,
      paper: PUB_DARK.card,
    },
    divider: PUB_DARK.line,
    border: {
      main: PUB_DARK.border,
      focus: YELLOW,
    } as any,
    // Custom `surface` palette used by the checkout (pay) page — see light theme note.
    surface: {
      main: PUB_DARK.page,
      paper: PUB_DARK.card,
      border: PUB_DARK.border,
    } as any,
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(255,209,0,0.14)",
    },
  },
  components: homeComponents(true),
});
