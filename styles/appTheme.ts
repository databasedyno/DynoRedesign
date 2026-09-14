import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";
import { DARK } from "@/constants/theme";

/**
 * App / dashboard theme — "Quiet Money" (UI Redesign Blueprint 2026-08, Phase 1).
 * Applied on the `client` (dashboard) layout via _app.tsx `activeTheme`. Built on
 * top of the existing dashboard theme (styles/theme.ts) so all component sizing /
 * spacing survives — Phase 1 re-skins the palette to a single deep-indigo accent
 * on calm slate/zinc canvases, consolidates the heading font to Manrope, and
 * squares off the CTA radius (pill → 8px) per the "restraint" system.
 *
 * Light → white/near-white canvas, slate-200 hairlines, indigo-700 accent.
 * Dark  → zinc-950 canvas, zinc-900 surfaces, indigo-500 accent.
 *
 * Scoped to the dashboard only — the auth (/auth/*) and landing (home) themes
 * are untouched (they get reskinned in later phases).
 */

// Brand accent (Blueprint §1.2): deepened indigo-700 for trust on white (light),
// indigo-500 for legibility on the dark canvas.
const INDIGO_LIGHT = "#4338CA"; // indigo-700
const INDIGO_LIGHT_HOVER = "#4F46E5"; // indigo-600
const INDIGO_DARK = DARK.accent;
const INDIGO_DARK_HOVER = DARK.accentHover;

/**
 * Heading font (Blueprint §1.3): consolidate 5+ families → Manrope for all
 * H1–H6 (page titles + section/card headers). Body / tables / forms stay on the
 * body sans (var(--font-body) = IBM Plex Sans) and money on IBM Plex Mono.
 * Manrope is self-hosted (@font-face in globals.css) so there is no new font cost.
 */
const HEADING_FONT = "'Manrope', 'Manrope Fallback', var(--font-hero), var(--font-sans), system-ui, sans-serif";
const BODY_FONT = "var(--font-body), 'IBM Plex Sans', var(--font-sans), system-ui, sans-serif";
const headingTypography = {
  fontFamily: BODY_FONT,
  h1: { fontFamily: HEADING_FONT, letterSpacing: "-0.02em" },
  h2: { fontFamily: HEADING_FONT, letterSpacing: "-0.02em" },
  h3: { fontFamily: HEADING_FONT, letterSpacing: "-0.015em" },
  h4: { fontFamily: HEADING_FONT, letterSpacing: "-0.01em" },
  h5: { fontFamily: HEADING_FONT },
  h6: { fontFamily: HEADING_FONT },
};

/**
 * Re-declares the custom Button variants with the indigo accent + an 8px radius
 * (Blueprint §3: primary = solid indigo, 8px, medium weight — pills retired for
 * standard CTAs). Full style is included (not just color) so it's correct
 * whether MUI replaces or concatenates the `variants` array.
 */
const buttonVariants = (fillBg: string, fillText: string, fillHoverBg: string) => [
  {
    props: { variant: "rounded" as const },
    style: {
      border: "1px solid transparent",
      color: fillText,
      padding: "10px 22px",
      background: fillBg,
      fontWeight: 500,
      borderRadius: "8px",
      textTransform: "none" as const,
      cursor: "pointer",
      boxShadow: "none",
      "&:hover": { color: fillText, background: fillHoverBg, boxShadow: "none" },
      "&.Mui-disabled": {
        background: fillBg,
        color: fillText,
        opacity: 0.45,
        pointerEvents: "auto",
        cursor: "not-allowed",
      },
      "&.MuiButton-roundedSuccess": {
        background: "#059669",
        color: "#fff",
        "&:hover": { color: "#fff", background: "#047857" },
      },
      "&.MuiButton-roundedError": {
        background: "#E11D48",
        color: "#fff",
        "&:hover": { color: "#fff", background: "#BE123C" },
      },
      "&.MuiButton-roundedSecondary": {
        background: "transparent",
        color: "inherit",
        border: "1px solid",
        "&:hover": { background: "rgba(100,116,139,0.08)" },
      },
      "&.MuiButton-roundedWhite": {
        background: "#fff",
        color: "#0F172A",
        "&:hover": { color: "#fff", background: "#0F172A" },
      },
    },
  },
  {
    props: { variant: "pills" as const },
    style: {
      border: "1px solid",
      borderColor: fillBg,
      padding: "9px 22px",
      color: fillBg,
      fontWeight: 500,
      borderRadius: "8px",
      fontSize: "15px",
      textTransform: "none" as const,
      "&:hover": { color: fillText, background: fillBg },
    },
  },
  {
    props: { variant: "bluepill" as const },
    style: {
      border: "1px solid transparent",
      padding: "9px 22px",
      color: fillText,
      background: fillBg,
      fontWeight: 500,
      borderRadius: "8px",
      fontSize: "15px",
      textTransform: "none" as const,
      boxShadow: "none",
      "&:hover": { color: fillText, background: fillHoverBg },
      "&.Mui-disabled": { background: fillBg, color: fillText, opacity: 0.45 },
    },
  },
];

/** Shared component overrides (Blueprint §3): calm buttons, hairline cards, 8px inputs. */
const sharedComponents = (isDark: boolean) => ({
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: "none" as const,
        borderRadius: 8,
        fontWeight: 500,
        boxShadow: "none",
        "&:hover": { boxShadow: "none" },
      },
      ...(isDark
        ? {
            outlinedPrimary: {
              color: INDIGO_DARK_HOVER,
              borderColor: "rgba(129,140,248,0.45)",
              "&:hover": {
                borderColor: INDIGO_DARK_HOVER,
                backgroundColor: "rgba(129,140,248,0.08)",
              },
            },
            textPrimary: {
              color: INDIGO_DARK_HOVER,
              "&:hover": { backgroundColor: "rgba(129,140,248,0.08)" },
            },
          }
        : {}),
    },
    variants: isDark
      ? buttonVariants(INDIGO_DARK, "#FFFFFF", INDIGO_DARK_HOVER)
      : buttonVariants(INDIGO_LIGHT, "#FFFFFF", INDIGO_LIGHT_HOVER),
  },
  // Cards: flat solid surface + 1px hairline, no drop shadow at rest (§1.4).
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
        border: `1px solid ${isDark ? DARK.border : "#E2E8F0"}`,
        boxShadow: "none",
        borderRadius: 12,
      },
    },
  },
  // Inputs: 1px border, 8px radius, indigo focus ring (§3).
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        ...(isDark ? { backgroundColor: DARK.canvas } : {}),
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: isDark ? DARK.border : "#E2E8F0",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: isDark ? DARK.borderStrong : "#CBD5E1",
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: isDark ? INDIGO_DARK : INDIGO_LIGHT,
          borderWidth: 2,
        },
      },
    },
  },
  ...(isDark
    ? {
        // a11y: disabled/read-only inputs were gray-on-gray in dark mode.
        MuiInputBase: {
          styleOverrides: {
            input: {
              "&.Mui-disabled": {
                WebkitTextFillColor: "rgba(255,255,255,0.62)",
                color: "rgba(255,255,255,0.62)",
              },
            },
          },
        },
      }
    : {}),
});

export const appThemeDark = createTheme(themeDark, {
  palette: {
    mode: "dark",
    primary: {
      main: INDIGO_DARK,
      dark: INDIGO_LIGHT_HOVER,
      light: "rgba(99,102,241,0.16)",
      contrastText: "#FFFFFF",
      hover: INDIGO_DARK_HOVER,
    } as any,
    // Canvas (page bg) is `secondary.main` app-wide; cards are `background.paper`.
    secondary: {
      main: DARK.canvas,
      dark: DARK.border,
      light: DARK.raised,
      contrastText: DARK.textSecondary,
    },
    background: { default: DARK.canvas, paper: DARK.surface },
    text: { primary: DARK.text, secondary: DARK.textSecondary, disabled: DARK.textMuted },
    divider: DARK.border,
    border: {
      main: DARK.border,
      focus: INDIGO_DARK,
      success: DARK.success,
      error: DARK.error,
    },
    success: { main: DARK.success, dark: "#22C55E", light: "rgba(34,197,94,0.14)" },
    error: { main: DARK.error },
    warning: { main: DARK.warning },
    info: { main: DARK.info },
    action: {
      hover: "rgba(148,163,184,0.08)",
      selected: "rgba(99,102,241,0.14)",
    },
  } as any,
  typography: headingTypography,
  components: sharedComponents(true),
});

export const appThemeLight = createTheme(theme, {
  palette: {
    mode: "light",
    primary: {
      main: INDIGO_LIGHT,
      dark: "#3730A3",
      light: "rgba(67,56,202,0.08)",
      contrastText: "#FFFFFF",
      hover: INDIGO_LIGHT_HOVER,
    } as any,
    secondary: {
      main: "#F1F5F9",
      dark: "#E2E8F0",
      light: "#F8FAFC",
      contrastText: "#475569",
    },
    background: { default: "#FAFAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#475569", disabled: "#94A3B8" },
    divider: "#E2E8F0",
    border: {
      main: "#E2E8F0",
      focus: INDIGO_LIGHT,
      success: "#059669",
      error: "#E11D48",
    },
    success: { main: "#059669", dark: "#047857", light: "rgba(5,150,105,0.10)" },
    error: { main: "#E11D48" },
    action: {
      hover: "#F1F5F9",
      selected: "rgba(67,56,202,0.06)",
    },
  } as any,
  typography: headingTypography,
  components: sharedComponents(false),
});
