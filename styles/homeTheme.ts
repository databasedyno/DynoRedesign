import { createTheme } from "@mui/material";

/**
 * homeTheme — Dynopay marketing surface (landing, fees, blog, docs, legal,
 * system-status, hosted checkout). 2026-06 Tatum-inspired reskin: mint/teal-green
 * leads; indigo dropped as a brand colour. SafeDeal keeps its own gold/black theme
 * (Components/SafeDeal/SafeDealShell) and the signed-in dashboard keeps its own.
 *
 * NOTE: `background.paper` is kept OPAQUE on purpose so shared MUI surfaces that
 * read it (header menus, language dropdown, tooltips) stay crisp.
 *
 * A non-standard `primary.hover` token is added (cast `as any`) — consumed by
 * CustomButton / HomeButton with safe fallbacks.
 */

// Marketing accent (deep teal — white-text safe). Kept name for back-compat.
export const HOME_LIME = "#0F766E";

export const homeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0F766E",
      dark: "#0D5C56",
      light: "rgba(0,208,132,0.10)",
      contrastText: "#FFFFFF",
      hover: "#0D5C56",
    } as any,
    secondary: {
      main: "#00D084",
      dark: "#05B875",
      light: "rgba(0,208,132,0.12)",
      contrastText: "#08231C",
    },
    success: {
      main: "#16A34A",
    },
    text: {
      primary: "#0A0F1D",
      secondary: "#334155",
      // ~4.6:1 muted (WCAG AA) for badge subtitles, footnotes, section eyebrows.
      disabled: "#64748B",
    },
    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
    },
    divider: "rgba(10,10,10,0.10)",
    border: {
      main: "rgba(10,10,10,0.12)",
      focus: "#0F766E",
    } as any,
    // Custom `surface` palette used by the checkout (pay) page. Must exist in
    // BOTH light and dark or `theme.palette.surface.border` throws in dark mode.
    surface: {
      main: "#F4F6FA",
      paper: "#FFFFFF",
      border: "#E9ECF2",
    } as any,
    action: {
      hover: "rgba(10,10,10,0.04)",
      selected: "rgba(10,10,10,0.06)",
    },
  },
});

export const homeThemeDark = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#2DD4BF",
      dark: "#0F766E",
      light: "rgba(0,208,132,0.16)",
      contrastText: "#04231C",
      hover: "#5EEAD4",
    } as any,
    secondary: {
      main: "#00D084",
      dark: "#05B875",
      light: "rgba(0,208,132,0.16)",
      contrastText: "#04231C",
    },
    success: {
      main: "#22C55E",
    },
    text: {
      primary: "#FAFAFA",
      secondary: "#C9C9D1",
      disabled: "#86868F",
    },
    background: {
      default: "#0B0908",
      paper: "#1A120D",
    },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.14)",
      focus: "#2DD4BF",
    } as any,
    // Custom `surface` palette used by the checkout (pay) page — see light theme note.
    surface: {
      main: "#0B0908",
      paper: "#1A120D",
      border: "#1F2D47",
    } as any,
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(0,208,132,0.12)",
    },
  },
});
