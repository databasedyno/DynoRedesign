import { Box, Button, styled } from "@mui/material";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Coinbase-style dashboard tokens (theme-aware).
 * Both light & dark modes render the same visual system — only surfaces flip.
 *
 * Indigo brand accent is preserved from DynoPay's session-82 Aurora Indigo migration
 * (#4F46E5 light / #818CF8 dark). Coinbase uses royal blue for primary interactions;
 * we keep DynoPay indigo which is functionally identical at these alpha levels.
 */
export const CB_TOKENS = {
  bg: {
    dark: "#0A0A0F",
    light: "#F6F7FB",
  },
  surface: {
    // Lifted a step above the page bg (#0A0A0F) so cards read as distinct,
    // elevated surfaces in dark mode instead of blending into the background.
    dark: "#16171F",
    darkElevated: "#1E1F2A",
    light: "#FFFFFF",
    lightElevated: "#FFFFFF",
  },
  border: {
    dark: "rgba(255,255,255,0.10)",
    light: "rgba(10,10,15,0.08)",
  },
  indigo: {
    light: BRAND_ACCENT,
    dark: "#818CF8",
    lightGlow: "rgba(79,70,229,0.10)",
    darkGlow: "rgba(129,140,248,0.14)",
  },
  ink: {
    primaryDark: "#FFFFFF",
    primaryLight: "#0A0A0F",
    // Contrast-tuned for WCAG AA (>=4.5:1 for small text) on the CB surfaces.
    // Previous muted values (0.38 dark / 0.44 light) rendered labels like
    // "Payments", "Active wallets", "Tax collected" and the "vs previous
    // period" caption nearly invisible in dark mode (~3.4:1).
    secondaryDark: "rgba(255,255,255,0.75)",
    secondaryLight: "rgba(10,10,15,0.70)",
    mutedDark: "rgba(255,255,255,0.60)",
    mutedLight: "rgba(10,10,15,0.58)",
  },
  /**
   * Semantic accents — used sparingly, "colour in the right places":
   * positive = money-in / up, negative = down / failed, warning = pending,
   * info = neutral highlight. Each carries a legible ink tone + a soft
   * background glow for chips/badges, tuned per theme for AA contrast.
   */
  semantic: {
    positive: { dark: "#3FD98A", light: "#05936A", glowDark: "rgba(5,177,105,0.16)", glowLight: "rgba(5,177,105,0.10)" },
    negative: { dark: "#FF6B6B", light: "#D92D20", glowDark: "rgba(240,68,56,0.16)", glowLight: "rgba(240,68,56,0.09)" },
    warning:  { dark: "#FBBF24", light: "#B45309", glowDark: "rgba(245,158,11,0.16)", glowLight: "rgba(245,158,11,0.12)" },
    info:     { dark: "#5AC8FA", light: "#2775CA", glowDark: "rgba(39,117,202,0.18)", glowLight: "rgba(39,117,202,0.10)" },
  },
};

/**
 * SurfaceCard — the base rounded card used across every fold.
 * Uses hairline border on both themes and a subtle 1px outer glow on dark.
 */
export const SurfaceCard = styled(Box)(({ theme }) => ({
  position: "relative",
  borderRadius: 20,
  padding: theme.spacing(3),
  backgroundColor:
    theme.palette.mode === "dark" ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
  border: `1px solid ${
    theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light
  }`,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 1px 0 rgba(255,255,255,0.02) inset"
      : "0 1px 3px rgba(10,10,15,0.04)",
  transition: "border-color 200ms ease, box-shadow 200ms ease",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2.25),
    borderRadius: 16,
  },
}));

/**
 * PillButton — the timeframe selector chips (1D / 1W / 1M / 3M / 1Y / All)
 * plus the tab chips in the QuickActionsPanel.
 */
export const PillButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  minWidth: 0,
  padding: "6px 14px",
  borderRadius: 999,
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "none",
  lineHeight: 1,
  letterSpacing: 0.1,
  color: active
    ? theme.palette.mode === "dark"
      ? "#FFFFFF"
      : "#FFFFFF"
    : theme.palette.mode === "dark"
      ? CB_TOKENS.ink.secondaryDark
      : CB_TOKENS.ink.secondaryLight,
  backgroundColor: active
    ? theme.palette.mode === "dark"
      ? CB_TOKENS.indigo.dark
      : CB_TOKENS.indigo.light
    : "transparent",
  border: "1px solid transparent",
  transition: "background-color 150ms ease, color 150ms ease",
  "&:hover": {
    backgroundColor: active
      ? theme.palette.mode === "dark"
        ? CB_TOKENS.indigo.dark
        : CB_TOKENS.indigo.light
      : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(10,10,15,0.04)",
  },
}));

/**
 * Eyebrow label — the small uppercase caption used above section titles.
 */
export const Eyebrow = styled(Box)(({ theme }) => ({
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color:
    theme.palette.mode === "dark"
      ? CB_TOKENS.ink.mutedDark
      : CB_TOKENS.ink.mutedLight,
}));

/**
 * BigNumber — the huge KPI headline (like Coinbase's €4.82).
 * Uses Unbounded/system font at 44-88px with tight tracking.
 */
export const BigNumber = styled(Box)(({ theme }) => ({
  fontFamily: "var(--font-unbounded, 'Unbounded', 'Inter', system-ui, sans-serif)",
  fontWeight: 500,
  fontSize: 72,
  lineHeight: 1.02,
  letterSpacing: -1.6,
  color:
    theme.palette.mode === "dark"
      ? CB_TOKENS.ink.primaryDark
      : CB_TOKENS.ink.primaryLight,
  [theme.breakpoints.down("lg")]: { fontSize: 60 },
  [theme.breakpoints.down("md")]: { fontSize: 48 },
  [theme.breakpoints.down("sm")]: { fontSize: 40, letterSpacing: -1 },
}));

/**
 * QuickActionRow — used for the Send/Receive/Convert stack in the right rail
 * AND the Crypto/Fiat/Pending asset breakdown rows below the hero.
 */
export const QuickActionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: "14px 0",
  borderRadius: 12,
  cursor: "pointer",
  transition: "transform 150ms ease, background-color 150ms ease",
  "&:hover": {
    transform: "translateX(2px)",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(10,10,15,0.02)",
  },
  "&:not(:last-of-type)": {
    borderBottom: `1px solid ${
      theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light
    }`,
  },
}));

/**
 * ActionIconBadge — the small circular icon holder next to each row action.
 */
export const ActionIconBadge = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    theme.palette.mode === "dark" ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
  backgroundColor:
    theme.palette.mode === "dark"
      ? CB_TOKENS.indigo.darkGlow
      : CB_TOKENS.indigo.lightGlow,
  flexShrink: 0,
}));

/**
 * DeltaChip — the coloured ±X% pill next to a KPI number.
 * Positive = green (money-in / up), Negative = a muted red (down). Semantic
 * colour so the trend direction reads at a glance while staying tasteful.
 */
export const DeltaChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== "positive",
})<{ positive?: boolean }>(({ theme, positive }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  borderRadius: 6,
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1,
  color: positive
    ? theme.palette.mode === "dark"
      ? CB_TOKENS.semantic.positive.dark
      : CB_TOKENS.semantic.positive.light
    : theme.palette.mode === "dark"
      ? CB_TOKENS.semantic.negative.dark
      : CB_TOKENS.semantic.negative.light,
  backgroundColor: positive
    ? theme.palette.mode === "dark"
      ? CB_TOKENS.semantic.positive.glowDark
      : CB_TOKENS.semantic.positive.glowLight
    : theme.palette.mode === "dark"
      ? CB_TOKENS.semantic.negative.glowDark
      : CB_TOKENS.semantic.negative.glowLight,
}));

/**
 * PrimaryCTA — the wide blue action button on the right rail.
 */
export const PrimaryCTA = styled(Button)(({ theme }) => ({
  width: "100%",
  height: 52,
  borderRadius: 999,
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  fontWeight: 600,
  textTransform: "none",
  letterSpacing: 0.2,
  color: "#FFFFFF",
  backgroundColor:
    theme.palette.mode === "dark" ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
  boxShadow: "none",
  transition: "transform 150ms ease, opacity 150ms ease",
  "&:hover": {
    backgroundColor:
      theme.palette.mode === "dark" ? "#6D74E8" : "#4338CA",
    boxShadow: "none",
    transform: "translateY(-1px)",
  },
  "&:disabled": {
    opacity: 0.55,
    color: "#FFFFFF",
  },
}));

/**
 * TabPill — segmented control tabs (Receive / Convert / Invoice).
 */
export const TabPill = styled(Button, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  flex: 1,
  height: 36,
  borderRadius: 999,
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 600,
  textTransform: "none",
  color: active
    ? theme.palette.mode === "dark"
      ? "#0A0A0F"
      : "#0A0A0F"
    : theme.palette.mode === "dark"
      ? CB_TOKENS.ink.secondaryDark
      : CB_TOKENS.ink.secondaryLight,
  backgroundColor: active
    ? theme.palette.mode === "dark"
      ? "#FFFFFF"
      : "#FFFFFF"
    : "transparent",
  boxShadow: active ? "0 1px 3px rgba(10,10,15,0.10)" : "none",
  transition: "background-color 150ms ease, color 150ms ease",
  "&:hover": {
    backgroundColor: active
      ? "#FFFFFF"
      : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(10,10,15,0.03)",
  },
}));
