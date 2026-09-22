import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";
import { AQUA, AQUA_DEEP, BRAND_ACCENT, BRAND_ACCENT_HOVER, BRAND_ON_ACCENT, DARK, LIGHT, RADIUS, brandFg } from "@/constants/theme";

/**
 * App / dashboard theme — Dynopay 2026-09 rebrand.
 * Yellow primary fills (always with dark-brown text), aqua for links / outlined
 * buttons / focus rings / status, warm cream (light) or black + dark-brown (dark)
 * grounds. Built on top of the base dashboard theme (styles/theme.ts) so all
 * component sizing / spacing survives — only colour changes.
 *
 * Scoped to the dashboard + in-app pages via _app.tsx `activeTheme`.
 */

const YELLOW = BRAND_ACCENT;
const YELLOW_HOVER = BRAND_ACCENT_HOVER;

/** Heading font: Manrope for H1–H6; body on IBM Plex Sans; money on IBM Plex Mono. */
const HEADING_FONT = "'Manrope', 'Manrope Fallback', var(--font-hero), var(--font-sans), system-ui, sans-serif";
const BODY_FONT = "var(--font-body), 'IBM Plex Sans', var(--font-sans), system-ui, sans-serif";
const headingTypography = {
  fontFamily: BODY_FONT,
  h1: { fontFamily: HEADING_FONT, letterSpacing: "-0.03em" },
  h2: { fontFamily: HEADING_FONT, letterSpacing: "-0.025em" },
  h3: { fontFamily: HEADING_FONT, letterSpacing: "-0.015em" },
  h4: { fontFamily: HEADING_FONT, letterSpacing: "-0.01em" },
  h5: { fontFamily: HEADING_FONT },
  h6: { fontFamily: HEADING_FONT },
};

/** Custom Button variants: solid yellow + dark-brown text, 8px radius. */
const buttonVariants = (fillBg: string, fillText: string, fillHoverBg: string, glow: string, isDark: boolean) => [
  {
    props: { variant: "rounded" as const },
    style: {
      border: "1px solid transparent",
      color: fillText,
      padding: "10px 22px",
      background: fillBg,
      fontWeight: 600,
      borderRadius: "8px",
      textTransform: "none" as const,
      cursor: "pointer",
      boxShadow: glow,
      transition: "background .18s ease, box-shadow .18s ease, transform .12s ease",
      "&:hover": { color: fillText, background: fillHoverBg, boxShadow: glow, transform: "translateY(-1px)" },
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
        boxShadow: "none",
        "&:hover": { background: isDark ? "rgba(255,240,210,0.08)" : "rgba(43,29,20,0.06)", boxShadow: "none" },
      },
      "&.MuiButton-roundedWhite": {
        background: "#fff",
        color: BRAND_ON_ACCENT,
        boxShadow: "none",
        "&:hover": { color: "#fff", background: BRAND_ON_ACCENT, boxShadow: "none" },
      },
    },
  },
  {
    // Outlined brand button — aqua (yellow text on light would fail contrast).
    props: { variant: "pills" as const },
    style: {
      border: "1px solid",
      borderColor: isDark ? "rgba(43,212,196,0.55)" : "rgba(15,143,134,0.5)",
      padding: "9px 22px",
      color: brandFg(isDark),
      fontWeight: 600,
      borderRadius: "8px",
      fontSize: "15px",
      textTransform: "none" as const,
      "&:hover": { color: isDark ? "#0B0908" : "#fff", background: brandFg(isDark), borderColor: brandFg(isDark) },
    },
  },
  {
    props: { variant: "bluepill" as const },
    style: {
      border: "1px solid transparent",
      padding: "9px 22px",
      color: fillText,
      background: fillBg,
      fontWeight: 600,
      borderRadius: "8px",
      fontSize: "15px",
      textTransform: "none" as const,
      boxShadow: glow,
      transition: "background .18s ease, box-shadow .18s ease, transform .12s ease",
      "&:hover": { color: fillText, background: fillHoverBg, boxShadow: glow, transform: "translateY(-1px)" },
      "&.Mui-disabled": { background: fillBg, color: fillText, opacity: 0.45 },
    },
  },
];

/** Solid, readable standard Alerts (the shared base theme's translucent `.light` tints made them fade). */
const alertOverrides = (isDark: boolean) => ({
  MuiAlert: {
    styleOverrides: {
      standardSuccess: isDark
        ? { color: "#BBF7D0", backgroundColor: "#10331F", "& .MuiAlert-icon": { color: "#4ADE80" } }
        : { color: "#065F46", backgroundColor: "#ECFDF5", "& .MuiAlert-icon": { color: "#059669" } },
      standardInfo: isDark
        ? { color: "#CFF5F1", backgroundColor: "#123632", "& .MuiAlert-icon": { color: AQUA } }
        : { color: "#0E4F4A", backgroundColor: "#E6F7F5", "& .MuiAlert-icon": { color: AQUA_DEEP } },
      standardWarning: isDark
        ? { color: "#FDE68A", backgroundColor: "#3A2A0A", "& .MuiAlert-icon": { color: "#FBBF24" } }
        : { color: "#7A4B00", backgroundColor: "#FFF6CC", "& .MuiAlert-icon": { color: "#B45309" } },
      standardError: isDark
        ? { color: "#FECACA", backgroundColor: "#3B1212", "& .MuiAlert-icon": { color: "#F87171" } }
        : { color: "#B91C1C", backgroundColor: "#FEF2F2", "& .MuiAlert-icon": { color: "#DC2626" } },
    },
  },
});

/** Shared component overrides: yellow CTAs, aqua links/outlines/focus, hairline cards, 8px inputs. */
const sharedComponents = (isDark: boolean) => {
  const T = isDark ? DARK : LIGHT;
  const fg = brandFg(isDark);
  const fgSoft = isDark ? "rgba(43,212,196,0.10)" : "rgba(15,143,134,0.08)";
  return {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none" as const,
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: "none",
          transition: "background-color .18s ease, box-shadow .2s ease, transform .18s ease, border-color .18s ease",
          "&:hover": { boxShadow: "none" },
          "&.MuiButton-contained:hover, &.MuiButton-outlined:hover": { transform: "translateY(-1px)" },
          "&.Mui-disabled:hover": { transform: "none" },
        },
        containedPrimary: {
          color: BRAND_ON_ACCENT,
          backgroundColor: YELLOW,
          "&:hover": { backgroundColor: YELLOW_HOVER },
          "&.Mui-disabled": { backgroundColor: YELLOW, color: BRAND_ON_ACCENT, opacity: 0.45 },
        },
        outlinedPrimary: {
          color: fg,
          borderColor: isDark ? "rgba(43,212,196,0.5)" : "rgba(15,143,134,0.45)",
          "&:hover": { borderColor: fg, backgroundColor: fgSoft },
        },
        textPrimary: {
          color: fg,
          "&:hover": { backgroundColor: fgSoft },
        },
      },
      variants: buttonVariants(YELLOW, BRAND_ON_ACCENT, YELLOW_HOVER, isDark ? DARK.glowAccentStrong : "0 4px 14px rgba(255,209,0,0.28)", isDark),
    },
    MuiLink: {
      styleOverrides: {
        root: { color: fg, textDecorationColor: isDark ? "rgba(43,212,196,0.4)" : "rgba(15,143,134,0.35)" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${isDark ? DARK.hairline : LIGHT.border}`,
          boxShadow: T.cardShadow,
          borderRadius: RADIUS.card,
          transition: "box-shadow .25s ease, border-color .25s ease, transform .25s ease",
          "&:hover": { boxShadow: T.cardShadowHover, borderColor: isDark ? DARK.hairlineStrong : LIGHT.borderStrong, transform: "translateY(-1px)" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          ...(isDark ? { backgroundColor: DARK.raised } : {}),
          transition: "box-shadow .18s ease, border-color .18s ease",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? DARK.hairlineStrong : LIGHT.border },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? DARK.borderStrong : LIGHT.borderStrong },
          "&.Mui-focused": { boxShadow: T.focusRing },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: fg, borderWidth: 2 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { "&.Mui-focused": { color: fg } } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: YELLOW, height: 3, borderRadius: 3 } },
    },
    MuiTab: {
      styleOverrides: { root: { "&.Mui-selected": { color: T.text } } },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: { backgroundColor: YELLOW, color: BRAND_ON_ACCENT },
        outlinedPrimary: { color: fg, borderColor: fg },
      },
    },
    MuiCheckbox: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? YELLOW : AQUA_DEEP } } } },
    MuiRadio: { styleOverrides: { root: { "&.Mui-checked": { color: isDark ? YELLOW : AQUA_DEEP } } } },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": { color: YELLOW },
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: YELLOW, opacity: isDark ? 0.55 : 0.7 },
        },
      },
    },
    ...alertOverrides(isDark),
    ...(isDark
      ? {
          MuiInputBase: {
            styleOverrides: {
              input: {
                "&.Mui-disabled": { WebkitTextFillColor: "rgba(250,246,239,0.62)", color: "rgba(250,246,239,0.62)" },
              },
            },
          },
        }
      : {}),
  };
};

export const appThemeDark = createTheme(themeDark, {
  palette: {
    mode: "dark",
    primary: {
      main: YELLOW,
      dark: YELLOW_HOVER,
      light: DARK.accentSoft,
      contrastText: BRAND_ON_ACCENT,
      hover: YELLOW_HOVER,
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
      focus: AQUA,
      success: DARK.success,
      error: DARK.error,
    },
    success: { main: DARK.success, dark: "#22C55E", light: "rgba(34,197,94,0.14)" },
    error: { main: DARK.error },
    warning: { main: DARK.warning },
    info: { main: AQUA, dark: AQUA_DEEP, light: "rgba(43,212,196,0.16)", contrastText: "#0B0908" },
    action: {
      hover: "rgba(255,240,210,0.06)",
      selected: "rgba(255,209,0,0.14)",
    },
  } as any,
  typography: headingTypography,
  components: sharedComponents(true),
});

export const appThemeLight = createTheme(theme, {
  palette: {
    mode: "light",
    primary: {
      main: YELLOW,
      dark: YELLOW_HOVER,
      light: LIGHT.accentSoft,
      contrastText: BRAND_ON_ACCENT,
      hover: YELLOW_HOVER,
    } as any,
    secondary: {
      main: LIGHT.raised,
      dark: LIGHT.border,
      light: LIGHT.canvas,
      contrastText: LIGHT.textSecondary,
    },
    background: { default: LIGHT.canvas, paper: LIGHT.surface },
    text: { primary: LIGHT.text, secondary: LIGHT.textSecondary, disabled: "#9A8B7C" },
    divider: LIGHT.border,
    border: {
      main: LIGHT.border,
      focus: AQUA_DEEP,
      success: "#059669",
      error: "#E11D48",
    },
    success: { main: "#059669", dark: "#047857", light: "#ECFDF5" },
    error: { main: "#E11D48", light: "#FEF2F2" },
    warning: { main: "#B45309", light: "#FFF6CC" },
    info: { main: AQUA_DEEP, dark: "#0B6F68", light: "#E6F7F5", contrastText: "#fff" },
    action: {
      hover: LIGHT.raised,
      selected: "rgba(255,209,0,0.16)",
    },
  } as any,
  typography: headingTypography,
  components: sharedComponents(false),
});

/**
 * Sidebar theme — the dark-brown rail is the dashboard's anchor in BOTH modes
 * (espresso on cream in light, espresso on black in dark), so it always renders
 * with dark-mode text tokens.
 */
export const sidebarTheme = createTheme(appThemeDark, {
  palette: {
    background: { default: DARK.raised, paper: DARK.raised },
    secondary: { main: DARK.active, dark: DARK.borderStrong, light: DARK.active, contrastText: DARK.textSecondary },
    divider: "rgba(255,240,210,0.10)",
    border: { main: "rgba(255,240,210,0.12)", focus: AQUA, success: DARK.success, error: DARK.error },
    action: { hover: "rgba(255,240,210,0.07)", selected: "rgba(255,209,0,0.16)" },
  } as any,
});
