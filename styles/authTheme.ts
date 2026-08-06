import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Auth-suite theme — "Aurora Glass" (2026-07-28 indigo migration).
 *
 * Applied ONLY on the /auth/*, /reset-password and /admin/login routes
 * (see _app.tsx `activeTheme`), so the rest of the app is untouched.
 *
 * Migration note (Session 82):
 *   Was:  cyber-lime (#CCFF00) neon accent, black CTA with lime text.
 *   Now:  indigo (#4F46E5) — SAME palette as Landing v3 (Aurora), so the
 *         sign-in / sign-up screens finally feel like the same product as
 *         the marketing site the user just came from.
 *
 * Glass surfaces + backdrop-blur are preserved. Only the accent hue and CTA
 * contrast rules change.
 *
 * We keep a non-standard `primary.hover` token that CustomButton reads (with
 * a safe fallback) so the primary CTA hover matches the accent.
 */

export const AUTH_INDIGO = BRAND_ACCENT; // Landing v3 canonical indigo
export const AUTH_INDIGO_DARK = "#818CF8"; // dark-mode variant (softer, higher lightness)
const INDIGO_HOVER_LIGHT = "#4338CA"; // slightly darker on hover in light mode
const INDIGO_HOVER_DARK = "#6366F1"; // slightly darker on hover in dark mode

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
      light: "rgba(129,140,248,0.14)",
      contrastText: "#FFFFFF",
      // custom token consumed by CustomButton (safe fallback elsewhere)
      hover: INDIGO_HOVER_DARK,
    } as any,
    secondary: {
      main: "#7C5CFF", // aurora violet (matches Landing v3)
      dark: "#6748E6",
      light: "rgba(124,92,255,0.16)",
      contrastText: "#FFFFFF",
    },
    background: { default: "#0B0B0F", paper: "rgba(255,255,255,0.05)" },
    text: { primary: "#FFFFFF", secondary: "#C9C9D1", disabled: "#86868F" },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.14)",
      focus: AUTH_INDIGO_DARK,
      success: "#00E676",
      error: "#FF6B5D",
    },
    error: { main: "#FF6B5D" },
    success: { main: "#0F2A1B", dark: "#00E676", light: "#0F2A1B" },
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(129,140,248,0.14)",
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
  typography: headingTypography,
  palette: {
    mode: "light",
    primary: {
      main: AUTH_INDIGO,
      dark: INDIGO_HOVER_LIGHT,
      light: "rgba(79,70,229,0.10)",
      contrastText: "#FFFFFF",
      hover: INDIGO_HOVER_LIGHT,
    } as any,
    secondary: {
      main: "#7C5CFF", // aurora violet
      dark: "#6748E6",
      light: "rgba(124,92,255,0.12)",
      contrastText: "#FFFFFF",
    },
    background: { default: "#FAFAF7", paper: "rgba(255,255,255,0.72)" },
    text: { primary: "#0A0A0A", secondary: "#3F3F46", disabled: "#73737C" },
    divider: "rgba(10,10,10,0.10)",
    border: {
      main: "rgba(10,10,10,0.12)",
      focus: AUTH_INDIGO,
      success: "#00A651",
      error: "#E8484A",
    },
    error: { main: "#E8484A" },
    action: {
      hover: "rgba(79,70,229,0.06)",
      selected: "rgba(79,70,229,0.10)",
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
