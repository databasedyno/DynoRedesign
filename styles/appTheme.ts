import { createTheme } from "@mui/material";
import { theme, themeDark } from "./theme";
import { AUTH_LIME } from "./authTheme";

/**
 * App / dashboard theme — "Bold Bento" (extends the auth + landing look into
 * the logged-in product). Applied on the `client` (dashboard) layout via
 * _app.tsx `activeTheme`. Built on top of the existing dashboard theme so all
 * component sizing / spacing / typography is preserved — we re-skin the palette
 * to the cyber-lime accent + bold dark/frost canvases, and re-color the custom
 * Button variants (rounded / pills / bluepill) that hardcoded the old blue.
 *
 * Dark  → near-void canvas + cyber-lime (#CCFF00) accent.
 * Light → frost canvas + bold near-black primary with lime text.
 *
 * Scoped to the dashboard only — the auth (/auth/*) and landing (home) themes
 * are untouched.
 */

const LIME_HOVER = "#B4E600";

/**
 * Re-declares the custom Button variants with an accent fill/outline so the
 * dashboard CTAs match the bento brand. Full style is included (not just color)
 * so it is correct whether MUI replaces or concatenates the `variants` array.
 * `fillBg`/`fillText` = primary fill; `fillHoverBg` = hover fill.
 */
const buttonVariants = (fillBg: string, fillText: string, fillHoverBg: string) => [
  {
    props: { variant: "rounded" as const },
    style: {
      border: "1px solid transparent",
      color: fillText,
      padding: "12px 30px",
      background: fillBg,
      fontWeight: 600,
      borderRadius: "50px",
      textTransform: "none" as const,
      cursor: "pointer",
      "&:hover": { color: fillText, background: fillHoverBg },
      "&.Mui-disabled": {
        background: fillBg,
        color: fillText,
        opacity: 0.45,
        pointerEvents: "auto",
        cursor: "not-allowed",
      },
      "&.MuiButton-roundedSuccess": {
        background: "#00A651",
        color: "#fff",
        "&:hover": { color: "#00A651", background: "#fff" },
      },
      "&.MuiButton-roundedError": {
        background: "#E8484A",
        color: "#fff",
        "&:hover": { color: "#E8484A", background: "#fff" },
      },
      "&.MuiButton-roundedSecondary": {
        background: "#12131C",
        color: "#fff",
        "&:hover": { color: "#12131C", background: "#fff" },
      },
      "&.MuiButton-roundedWhite": {
        background: "#fff",
        color: "#12131C",
        "&:hover": { color: "#fff", background: "#12131C" },
      },
    },
  },
  {
    props: { variant: "pills" as const },
    style: {
      border: "1px solid",
      borderColor: fillBg,
      padding: "10px 30px",
      color: fillBg,
      fontWeight: 600,
      borderRadius: "15px",
      fontSize: "16px",
      "&:hover": { color: fillText, background: fillBg },
    },
  },
  {
    props: { variant: "bluepill" as const },
    style: {
      border: "1px solid transparent",
      padding: "10px 30px",
      color: fillText,
      background: fillBg,
      fontWeight: 600,
      borderRadius: "15px",
      fontSize: "16px",
      "&:hover": { color: fillText, background: fillHoverBg },
      "&.Mui-disabled": { background: fillBg, color: fillText, opacity: 0.45 },
    },
  },
];

export const appThemeDark = createTheme(themeDark, {
  palette: {
    mode: "dark",
    primary: {
      main: AUTH_LIME,
      dark: LIME_HOVER,
      light: "rgba(204,255,0,0.14)",
      contrastText: "#060606",
      hover: LIME_HOVER,
    } as any,
    secondary: {
      main: AUTH_LIME,
      dark: LIME_HOVER,
      light: "rgba(204,255,0,0.14)",
      contrastText: "#060606",
    },
    background: { default: "#08080A", paper: "#141417" },
    text: { primary: "#FFFFFF", secondary: "#9CA3AF", disabled: "#5B5B63" },
    divider: "rgba(255,255,255,0.10)",
    border: {
      main: "rgba(255,255,255,0.12)",
      focus: AUTH_LIME,
      success: "#00E676",
      error: "#FF6B5D",
    },
    success: { main: "#00E676", dark: "#00C853", light: "rgba(0,230,118,0.14)" },
    error: { main: "#FF6B5D" },
    action: {
      hover: "rgba(255,255,255,0.06)",
      selected: "rgba(204,255,0,0.10)",
    },
  } as any,
  components: {
    MuiButton: { variants: buttonVariants(AUTH_LIME, "#060606", LIME_HOVER) },
  },
});

export const appThemeLight = createTheme(theme, {
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
      main: "#0A0A0A",
      dark: "#000000",
      light: "rgba(10,10,10,0.06)",
      contrastText: AUTH_LIME,
    },
    background: { default: "#EEF1F6", paper: "#FFFFFF" },
    text: { primary: "#0A0A0A", secondary: "#52525B", disabled: "#A1A1AA" },
    divider: "rgba(10,10,10,0.10)",
    border: {
      main: "rgba(10,10,10,0.12)",
      focus: "#0A0A0A",
      success: "#00A651",
      error: "#E8484A",
    },
    success: { main: "#00A651", dark: "#008a44", light: "rgba(0,166,81,0.12)" },
    error: { main: "#E8484A" },
    action: {
      hover: "rgba(10,10,10,0.04)",
      selected: "rgba(10,10,10,0.06)",
    },
  } as any,
  components: {
    MuiButton: { variants: buttonVariants("#0A0A0A", AUTH_LIME, "#1F1F1F") },
  },
});
