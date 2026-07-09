import { createTheme } from "@mui/material";

/**
 * homeTheme — "Floating Glass Bento" (bold, Emergent-style) mirrored from the
 * auth suite onto ALL `home`-layout pages (landing, fees, blog, docs, legal,
 * system-status). See `styles/authTheme.ts` for the sibling auth theme.
 *
 * Dark  → void-black canvas (#060606) + cyber-lime (#CCFF00) neon accent.
 * Light → frosty silver canvas (#EEF1F6) + bold near-black accent with lime text.
 *
 * NOTE: `background.paper` is kept OPAQUE on purpose so shared MUI surfaces that
 * read it (header menus, language dropdown, tooltips) stay crisp. The frosted
 * "glass" translucency for landing cards is applied explicitly per-section via
 * `styles/homeBento.ts` (backdrop-blur + translucent rgba), not through paper.
 *
 * A non-standard `primary.hover` token is added (cast `as any`) — consumed by
 * CustomButton / HomeButton with safe fallbacks.
 */

export const HOME_LIME = "#CCFF00";
const LIME_HOVER = "#B4E600";

export const homeTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0A0A0A",
      dark: "#000000",
      light: "rgba(10,10,10,0.06)",
      contrastText: HOME_LIME,
      hover: "#1F1F1F",
    } as any,
    secondary: {
      main: "#5865F2",
      dark: "#4650C7",
      light: "rgba(88,101,242,0.12)",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#16A34A",
    },
    text: {
      primary: "#18181B",
      secondary: "#71717A",
      disabled: "#A1A1AA",
    },
    background: {
      default: "#EEF1F6",
      paper: "#FFFFFF",
    },
    divider: "rgba(10,10,10,0.10)",
    border: {
      main: "rgba(10,10,10,0.12)",
      focus: "#0A0A0A",
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
      main: HOME_LIME,
      dark: LIME_HOVER,
      light: "rgba(204,255,0,0.14)",
      contrastText: "#060606",
      hover: LIME_HOVER,
    } as any,
    secondary: {
      main: "#5865F2",
      dark: "#4650C7",
      light: "rgba(88,101,242,0.16)",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#22C55E",
    },
    text: {
      primary: "#FAFAFA",
      secondary: "#A1A1AA",
      disabled: "#52525B",
    },
    background: {
      default: "#060606",
      paper: "#0E0F12",
    },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.14)",
      focus: HOME_LIME,
    } as any,
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(204,255,0,0.10)",
    },
  },
});
