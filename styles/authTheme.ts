import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";

/**
 * Auth-suite theme — "Floating Glass Bento" (bold, Emergent-style).
 * Applied ONLY on the /auth/*, /reset-password and /admin/login routes
 * (see _app.tsx `activeTheme`), so the rest of the app is untouched.
 *
 * Dark  → void-black canvas + cyber-lime (#CCFF00) neon accent, glass surfaces.
 * Light → frosty silver canvas + bold near-black buttons with lime text.
 *
 * We add a non-standard `primary.hover` token that CustomButton reads
 * (with a safe fallback) so the primary CTA hover matches the accent.
 */

export const AUTH_LIME = "#CCFF00";
const LIME_HOVER = "#B4E600";

export const authThemeDark = createTheme(themeDark, {
  palette: {
    mode: "dark",
    primary: {
      main: AUTH_LIME,
      dark: LIME_HOVER,
      light: "rgba(204,255,0,0.14)",
      contrastText: "#060606",
      // custom token consumed by CustomButton (safe fallback elsewhere)
      hover: LIME_HOVER,
    } as any,
    secondary: {
      main: "#5865F2",
      dark: "#4650C7",
      light: "rgba(88,101,242,0.16)",
      contrastText: "#FFFFFF",
    },
    background: { default: "#060606", paper: "rgba(255,255,255,0.05)" },
    text: { primary: "#FFFFFF", secondary: "#9CA3AF", disabled: "#5B5B63" },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.14)",
      focus: AUTH_LIME,
      success: "#00E676",
      error: "#FF6B5D",
    },
    error: { main: "#FF6B5D" },
    success: { main: "#0F2A1B", dark: "#00E676", light: "#0F2A1B" },
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(204,255,0,0.10)",
    },
  },
  components: {
    // FLOATING SURFACES MUST BE OPAQUE.
    // The glass `background.paper` above (rgba(255,255,255,0.05)) is meant for
    // the auth card ONLY. MUI Menu/Popover/Autocomplete papers default to
    // `background.paper` and have NO backdrop-filter, so a translucent paper
    // lets the page content bleed through (user-reported: the country dropdown
    // in the phone input rendered transparent on login/signup).
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: "#15161B",
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.10)",
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: "#15161B",
          backgroundImage: "none",
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: "#15161B",
          backgroundImage: "none",
        },
      },
    },
  },
});

export const authThemeLight = createTheme(theme, {
  palette: {
    mode: "light",
    primary: {
      main: "#0A0A0A",
      dark: "#000000",
      light: "rgba(10,10,10,0.06)",
      contrastText: AUTH_LIME,
      hover: "#1F1F1F",
    } as any,
    secondary: {
      main: "#5865F2",
      dark: "#4650C7",
      light: "rgba(88,101,242,0.12)",
      contrastText: "#FFFFFF",
    },
    background: { default: "#EEF1F6", paper: "rgba(255,255,255,0.72)" },
    text: { primary: "#0A0A0A", secondary: "#52525B", disabled: "#A1A1AA" },
    divider: "rgba(10,10,10,0.10)",
    border: {
      main: "rgba(10,10,10,0.12)",
      focus: "#0A0A0A",
      success: "#00A651",
      error: "#E8484A",
    },
    error: { main: "#E8484A" },
    action: {
      hover: "rgba(10,10,10,0.04)",
      selected: "rgba(10,10,10,0.06)",
    },
  },
  components: {
    // FLOATING SURFACES MUST BE OPAQUE (see note in authThemeDark above).
    // Light glass paper is rgba(255,255,255,0.72) — dropdowns inherited it and
    // let the buttons behind bleed through the country list.
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          backgroundImage: "none",
          border: "1px solid rgba(10,10,10,0.08)",
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          backgroundImage: "none",
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          backgroundImage: "none",
        },
      },
    },
  },
});
