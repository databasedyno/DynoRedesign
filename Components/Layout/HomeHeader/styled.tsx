// Aurora v3 restyle (2026-07-18) — frosted glass, coral CTA, mono status pill,
// obsidian mobile drawer, aurora underline. Tokens mirror theme.v3.ts.
import { MenuRounded } from "@mui/icons-material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  styled,
  Typography,
} from "@mui/material";

// Aurora tokens (kept inline here to avoid pulling the whole theme.v3 into
// the header — one source of truth is theme.v3.ts, we duplicate 4 constants).
const CORAL = "#4F46E5";
const CORAL_DEEP = "#4338CA";
const VIOLET = "#7C5CFF";
const VOLT = "#22C55E";
const AURORA_GRADIENT =
  "linear-gradient(90deg, #4F46E5 0%, #7C5CFF 55%, #4FD1FF 100%)";

/* ================= HEADER SHELL ================= */

export const FixedHeader = styled("header")(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "fixed",
    top: "var(--dyno-promo-h, 0px)",
    left: 0,
    right: 0,
    zIndex: 1400,
    // Frosted glass: paper (light) / obsidian (dark) at 78% alpha with blur.
    backgroundColor: dark ? "rgba(11,11,15,0.72)" : "rgba(250,250,247,0.85)",
    backdropFilter: "blur(14px) saturate(1.2)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
    // fade + slide on show/hide (was pure translate — felt jumpy)
    transition:
      "transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 240ms ease, top 250ms ease, background-color 300ms ease",
    width: "100%",

    // MOBILE PERF (2026-07-29, user report — "sometimes takes minutes to
    // respond"). A 14px/saturate(1.2) full-width backdrop-filter re-blurs the
    // entire viewport on every scroll frame on iOS Safari / Firefox mobile,
    // pinning the compositor on lower-end phones. Dropping to 8px + skipping
    // the saturate on mobile is visually near-identical but ~4× cheaper on
    // GPU, which restores prompt tap dispatch to the hamburger.
    [theme.breakpoints.down("md")]: {
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    },
  };
});

export const HeaderContainer = styled(Box)(({ theme }) => ({
  height: 72, // was 68 — extra breathing room next to Unbounded hero types
  padding: "0 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  maxWidth: 1280,
  margin: "0 auto",

  [theme.breakpoints.down("md")]: {
    height: 64,
    padding: "0 16px",
  },
}));

// Bottom hairline divider — kept for consistency but rendered inside
// FixedHeader as a border, so this component is a no-op transparent Box.
export const HeaderDivider = styled(Box)({
  height: 0,
});

/* ================= LEFT + LOGO ================= */

export const ClickableLogo = styled(Button)({
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
  outline: "none",
  border: "none",
  background: "transparent",
  padding: 0,
  minWidth: "auto",
  borderRadius: 8,
  position: "relative",
  transition: "opacity 200ms ease, transform 200ms ease",
  // Aurora underline on hover
  "&::after": {
    content: '""',
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 2,
    height: 2,
    borderRadius: 2,
    background: AURORA_GRADIENT,
    opacity: 0,
    transform: "scaleX(0.6)",
    transformOrigin: "left",
    transition: "opacity 220ms ease, transform 220ms ease",
  },
  "&:hover": {
    background: "transparent",
    "&::after": {
      opacity: 1,
      transform: "scaleX(1)",
    },
  },
});

export const LeftGroup = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "72px",
});

export const RightGroup = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "10px",
});

export const NavLinks = styled("nav")(({ theme }) => ({
  display: "flex",
  gap: 28,
  fontFamily: "var(--font-body)",
  alignItems: "center",

  "@media (max-width: 1025px)": {
    display: "none",
  },

  button: {
    textTransform: "none",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: "22px",
    letterSpacing: "-0.005em",
    fontFamily: "var(--font-body)",
    color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.72)" : "#3F3F46",
    padding: "8px 4px",
    borderRadius: 0,
    transition: "color 200ms ease",

    "&:hover": {
      background: "transparent",
      color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
    },
  },
}));

/* ================= RIGHT / ACTIONS ================= */

export const Actions = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

// Wrapper for the language switcher so we can hide on small viewports
// without touching the inner component.
// MOBILE FIX (2026-07-29): hidden via CSS media query instead of JS
// `!isMobile && ...` gate so the switcher never renders in SSR HTML for
// mobile viewports (previous behaviour was a hydration flicker + crowded
// top-right that squeezed the hamburger against the theme toggle).
export const DesktopLanguageWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginLeft: 4,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

export const MobileLanguageWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: "auto",
  paddingTop: 24,
  borderTop: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
}));

/* ================= MOBILE MENU ================= */

// MOBILE FIX (2026-07-29, user report — iPhone/Firefox: top-right menu wouldn't
// open or "took minutes to respond"). Two compounding causes:
//   (1) HITBOX. The button was 26px icon + 6px padding = ~38×38 — below both
//       Apple HIG (44×44) and WCAG 2.5.5. Its neighbour ThemeToggle IS 44×44.
//       iOS Safari's touch-target algorithm routes ambiguous taps to whichever
//       button has the larger accessible area, so the user's tap on the
//       hamburger silently flipped the theme instead of opening the drawer.
//   (2) 300ms TAP DELAY. Without `touch-action: manipulation` iOS holds every
//       tap on interactive elements for double-tap-to-zoom detection — visible
//       as "the menu takes a long time to respond" even after the hitbox fix.
// Both are addressed below; hitbox is now 44×44, and we also lift the button
// into its own tiny stacking context so nothing can sit over it.
export const MobileMenuButton = styled(IconButton)(() => ({
  display: "none",
  padding: 8,
  minWidth: 44,
  minHeight: 44,
  borderRadius: 10,
  position: "relative",
  zIndex: 1,
  // Kills iOS Safari's 300ms tap delay + Firefox mobile's synthetic click gap.
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  // Belt-and-braces: keep the button above any transient overlays that might
  // land inside the header (language dropdown, tooltip, etc.).
  pointerEvents: "auto",

  "@media (max-width: 1025px)": {
    display: "inline-flex",
  },
}));

export const MenuOpenIcon = styled(MenuRounded)(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  fontSize: 26,
}));

export const MenuCloseIcon = styled(CloseRoundedIcon)(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  fontSize: 26,
}));

export const MobileMenuDrawer = styled(Drawer)(() => ({
  display: "none",
  zIndex: 1500,

  "& .MuiDrawer-paper": {
    top: "64px !important",
    height: "calc(100vh - 64px) !important",
    width: "100%",
    maxWidth: "360px",
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    border: "none !important",
  },

  "& .MuiBackdrop-root": {
    // Perf: a 10px full-screen backdrop-filter re-blurs the entire viewport on
    // every animation frame, which caused visible tap latency / jank when
    // opening the mobile menu on high-DPR phones (e.g. iPhone 14 Pro Max).
    // A small 4px radius keeps the frosted feel at a fraction of the GPU cost;
    // the slightly darker overlay preserves contrast.
    backgroundColor: "rgba(11,11,15,0.6)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    // Promote the backdrop to its own compositor layer so the blur is
    // rasterised once instead of thrashing the main thread during the slide.
    transform: "translateZ(0)",
  },

  "@media (max-width: 1025px)": {
    display: "block",
  },
}));

// Aurora obsidian panel (dark) / clean paper panel (light) — theme-aware so
// the mobile menu matches the frosted header instead of always being dark.
export const MobileDrawer = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    height: "100%",
    backgroundColor: dark ? "#0B0B0F" : "#FFFFFF",
    color: dark ? "#F5F5F5" : "#0A0A0A",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "24px 20px",
    // Subtle aurora bloom in the corners (dimmer in light mode).
    backgroundImage: dark
      ? "radial-gradient(circle at 90% -10%, rgba(79, 70, 229,0.20) 0%, rgba(11,11,15,0) 55%), radial-gradient(circle at -10% 100%, rgba(124,92,255,0.18) 0%, rgba(11,11,15,0) 55%)"
      : "radial-gradient(circle at 92% -8%, rgba(79,70,229,0.07) 0%, rgba(255,255,255,0) 55%)",
  };
});

export const MobileNavContent = styled(Box)({
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "stretch",
  marginTop: 24,
});

export const MobileNavItem = styled(Typography)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: "30px",
    fontFamily: "var(--font-hero)", // Unbounded, big presence
    letterSpacing: "-0.01em",
    color: dark ? "#F5F5F5" : "#0A0A0A",
    cursor: "pointer",
    transition: "color 200ms ease, transform 200ms ease",
    textAlign: "left",
    userSelect: "none",
    padding: "12px 4px",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.08)"}`,

    "&:hover, &:active": {
      color: CORAL,
      transform: "translateX(4px)",
    },
  };
});

// New: trust badges row that sits at the bottom of the mobile drawer.
export const MobileTrustBadges = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  paddingTop: 20,
  paddingBottom: 8,
  color: theme.palette.mode === "dark" ? "rgba(245,245,245,0.6)" : "rgba(10,10,10,0.5)",
  fontFamily: "var(--font-tech)",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
}));

export const TrustPill = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)"}`,
    borderRadius: 999,
    fontFamily: "var(--font-tech)",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.14em",
    color: dark ? "rgba(245,245,245,0.7)" : "rgba(10,10,10,0.55)",
  };
});

/* ================= CTA BUTTONS ================= */

// Sign-in ghost text button
export const StyledSignInButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  fontSize: "15px",
  fontWeight: 500,
  lineHeight: "22px",
  fontFamily: "var(--font-body)",
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  whiteSpace: "nowrap",
  padding: "8px 12px",
  borderRadius: 999,
  minWidth: 0,

  // Hide the inline auth CTAs once the hamburger appears (<1025px). They live
  // inside the mobile drawer instead, so the header never gets crowded and the
  // menu icon is never pushed off the right edge (iPhone 14 Pro Max report).
  "@media (max-width: 1025px)": {
    display: "none",
  },

  "&:hover": {
    background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)",
    color: CORAL,
  },
}));

// "Get started" pill — flat, premium, Coinbase-clean. No glossy inset
// highlight, no heavy colored drop-shadow. Solid indigo that simply darkens
// on hover and nudges down on press.
export const StyledGetStartedButton = styled(Box)({
  borderRadius: 999,
  // Hidden on mobile alongside the sign-in link (<1025px) — the primary CTA is
  // surfaced inside the drawer, keeping room for the hamburger on phones.
  "@media (max-width: 1025px)": {
    display: "none",
  },
  // `&&` doubles the wrapper class to reliably outrank MUI's own
  // primary.main rule in BOTH light and dark themes — keeps the pill an
  // exact indigo (#4F46E5) that darkens to #4338CA on hover/press.
  "&& button, && a": {
    background: CORAL,
    color: "#FFFFFF",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    borderRadius: "999px",
    boxShadow: "none",
    transition:
      "background-color 200ms ease, transform 150ms cubic-bezier(0.16,1,0.3,1)",
  },
  "&& button:hover, && a:hover": {
    background: CORAL_DEEP,
    boxShadow: "none",
  },
  "&& button:active, && a:active": {
    background: CORAL_DEEP,
    transform: "scale(0.97)",
  },
});

/* ================= STATUS PILL ================= */

export const StatusPillWrap = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "6px 12px",
  border: `1px solid ${
    theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"
  }`,
  background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
  borderRadius: 999,
  fontFamily: "var(--font-body)",
  fontSize: 12.5,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.72)" : "#52525B",
  whiteSpace: "nowrap",
  cursor: "default",

  "@keyframes dynoStatusPulse": {
    "0%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.5)" },
    "70%": { boxShadow: "0 0 0 5px rgba(34,197,94,0)" },
    "100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0)" },
  },
  "& .dot": {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: VOLT,
    display: "inline-block",
    animation: "dynoStatusPulse 2.4s ease-out infinite",
  },

  // On mobile, hide the pill entirely — the label is redundant and the dot
  // takes space away from the hamburger tap target next to the theme toggle.
  // (Was previously hidden via `!isMobile &&` JS gate, which caused SSR/mobile
  // hydration to still render it on the first paint.)
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

// Thin vertical rule to group the utility actions (status/lang/theme) apart
// from the auth actions (sign in / get started) — adds structure to the bar.
export const ActionDivider = styled(Box)(({ theme }) => ({
  width: 1,
  height: 22,
  margin: "0 4px",
  flexShrink: 0,
  background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)",
  "@media (max-width: 900px)": {
    display: "none",
  },
}));

// Legacy export (kept for backward compat if anything still imports it).
export { AURORA_GRADIENT, CORAL, VIOLET, VOLT };
