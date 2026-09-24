import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";
import { GOLD, GOLD_DEEP, BRAND_ACCENT, BRAND_ACCENT_HOVER, BRAND_ON_ACCENT } from "@/constants/theme";

/**
 * Auth-suite theme — "Aurora Glass" (2026-07-28 indigo migration).
 *
 * Applied ONLY on the /auth/*, /reset-password and /admin/login routes
 * (see _app.tsx `activeTheme`), so the rest of the app is untouched.
 *
 * Migration note (Session 82):
 *   Was:  cyber-lime (#CCFF00) neon accent, black CTA with lime text.
 *   Now:  indigo (#8B5E00) — SAME palette as Landing v3 (Aurora), so the
 *         sign-in / sign-up screens finally feel like the same product as
 *         the marketing site the user just came from.
 *
 * Glass surfaces + backdrop-blur are preserved. Only the accent hue and CTA
 * contrast rules change.
 *
 * We keep a non-standard `primary.hover` token that CustomButton reads (with
 * a safe fallback) so the primary CTA hover matches the accent.
 */

// 2026-09 rebrand: names kept for the ~20 importers; values are now the brand yellow / aqua.
export const AUTH_INDIGO = BRAND_ACCENT; // signal yellow — solid CTA fills (dark-brown text)
export const AUTH_INDIGO_DARK = BRAND_ACCENT; // same yellow on dark grounds
/** Gold text/link accent for the auth screens (theme-aware). */
export const AUTH_ACCENT_TEXT = GOLD_DEEP;
export const AUTH_ACCENT_TEXT_DARK = GOLD;
const INDIGO_HOVER_LIGHT = BRAND_ACCENT_HOVER;
const INDIGO_HOVER_DARK = BRAND_ACCENT_HOVER;

/**
 * Legacy export kept so any code that still imports `AUTH_LIME` doesn't
 * break during the migration. Points at the new indigo so behavior is
 * consistent even for stragglers.
 */
export const AUTH_LIME = AUTH_INDIGO;

/**
 * Brand display font for auth-screen headings (2026-07-21 consistency pass).
 * `var(--font-hero)` = self-hosted Unbounded. The auth title (TitleDescription)
 * and brand panel already use it explicitly; this theme-level override on the
 * semantic heading variants h1–h6 catches any straggler headings so the whole
 * /auth suite is consistent. Body/labels stay on var(--font-sans) (Geist).
 */
const HEADING_FONT = "var(--font-hero), var(--font-sans), system-ui, sans-serif";
const headingTypography = {
  h1: { fontFamily: HEADING_FONT },
  h2: { fontFamily: HEADING_FONT },
  h3: { fontFamily: HEADING_FONT },
  h4: { fontFamily: HEADING_FONT },
  h5: { fontFamily: HEADING_FONT },
  h6: { fontFamily: HEADING_FONT },
};

export const authThemeDark = createTheme(themeDark, {
  typography: headingTypography,
  palette: {
    mode: "dark",
    primary: {
      main: AUTH_INDIGO_DARK,
      dark: INDIGO_HOVER_DARK,
      light: "rgba(255,209,0,0.14)",
      contrastText: BRAND_ON_ACCENT,
      // custom token consumed by CustomButton (safe fallback elsewhere)
      hover: INDIGO_HOVER_DARK,
    } as any,
    secondary: {
      main: GOLD, // gold accent
      dark: GOLD_DEEP,
      light: "rgba(255,209,0,0.16)",
      contrastText: "#0A0A0D",
    },
    info: { main: GOLD, dark: GOLD_DEEP, light: "rgba(255,209,0,0.16)", contrastText: "#0A0A0D" },
    background: { default: "#0A0A0D", paper: "#101014" },
    text: { primary: "#F5F7FA", secondary: "#ADB1B8", disabled: "#81858C" },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.14)",
      focus: GOLD,
      success: "#00E676",
      error: "#FF6B5D",
    },
    error: { main: "#FF6B5D" },
    success: { main: "#0F2A1B", dark: "#00E676", light: "#0F2A1B" },
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(255,209,0,0.14)",
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
          backgroundColor: "#101014",
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.10)",
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: "#101014",
          backgroundImage: "none",
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: "#101014",
          backgroundImage: "none",
        },
      },
    },
  },
});

export const authThemeLight = createTheme(theme, {
  typography: headingTypography,
  palette: {
    mode: "light",
    primary: {
      main: AUTH_INDIGO,
      dark: INDIGO_HOVER_LIGHT,
      light: "rgba(255,209,0,0.16)",
      contrastText: BRAND_ON_ACCENT,
      hover: INDIGO_HOVER_LIGHT,
    } as any,
    secondary: {
      main: GOLD_DEEP, // deep gold (readable on light)
      dark: "#6B4800",
      light: "rgba(139,94,0,0.10)",
      contrastText: "#FFFFFF",
    },
    info: { main: GOLD_DEEP, dark: "#6B4800", light: "#FFF6CC", contrastText: "#fff" },
    background: { default: "#F5F7FA", paper: "rgba(255,255,255,0.78)" },
    text: { primary: "#121214", secondary: "#6A6E73", disabled: "#81858C" },
    divider: "rgba(18,18,20,0.10)",
    border: {
      main: "rgba(18,18,20,0.14)",
      focus: GOLD_DEEP,
      success: "#00A651",
      error: "#E8484A",
    },
    error: { main: "#E8484A" },
    action: {
      hover: "rgba(18,18,20,0.05)",
      selected: "rgba(255,209,0,0.16)",
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
          border: "1px solid rgba(18,18,20,0.10)",
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
