// Aurora v3 restyle (2026-07-18) — frosted glass, coral CTA, mono status pill,
// obsidian mobile drawer, aurora underline. Tokens mirror theme.v3.ts.
import type React from "react";
import { MenuRounded } from "@mui/icons-material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { BRAND_ACCENT } from "@/constants/theme";
import {
  Box,
  BoxProps,
  Button,
  Drawer,
  IconButton,
  styled,
  Typography,
} from "@mui/material";

// Aurora tokens (kept inline here to avoid pulling the whole theme.v3 into
// the header — one source of truth is theme.v3.ts, we duplicate 4 constants).
const CORAL = BRAND_ACCENT;
const CORAL_DEEP = "#4338CA";
const VIOLET = "#7C5CFF";
const VOLT = "#22C55E";
const AURORA_GRADIENT =
  `linear-gradient(90deg, ${BRAND_ACCENT} 0%, #7C5CFF 55%, #4FD1FF 100%)`;

/* ================= HEADER SHELL ================= */

export const FixedHeader = styled("header")(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "fixed",
    top: "var(--dyno-promo-h, 0px)",
    left: 0,
    right: 0,
    // MOBILE BUG FIX (2025-07, iPhone 14 user report — "menu opened first tap
    // but subsequent tap didn't open, icon looked selected with dark shade,
    // took several seconds to open").
    //
    // Root cause: this header was zIndex 1400, but MobileMenuDrawer is 1500,
    // so when the drawer opened its backdrop (rgba(11,11,15,0.6)) sat OVER
    // the hamburger button. The "dark shade on the menu icon" WAS the
    // backdrop overlaying the button. Any tap on the hamburger to close hit
    // the backdrop (which calls onClose), not the button — requiring a
    // second tap on the empty header area (with drawer fully gone) to
    // reopen. That two-tap dance felt like a broken button.
    //
    // Bumping the header stack above the drawer (1600 > 1500) lets taps on
    // the hamburger always land on the button itself — pointerUp toggles
    // menu, drawer opens/closes cleanly, no double-tap ambiguity, no
    // backdrop discolouration on the icon.
    zIndex: 1600,
    // Frosted glass: paper (light) / obsidian (dark) at 78% alpha with blur.
    backgroundColor: dark ? "rgba(11,11,15,0.72)" : "rgba(250,250,247,0.85)",
    backdropFilter: "blur(14px) saturate(1.2)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
    // fade + slide on show/hide (was pure translate — felt jumpy)
    transition:
      "transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 240ms ease, top 250ms ease, background-color 300ms ease",
    width: "100%",

    // MOBILE PERF FIX (2026-08, iPhone 14 Pro Max — "menu freezes for several
    // seconds then opens"). ROOT CAUSE: an always-on full-width backdrop-filter
    // on this position:fixed header. When the mobile Drawer/Modal opens, iOS
    // Safari must re-rasterise the entire blurred header (@3x DPR = millions of
    // pixels) against the new full-screen backdrop layer every frame, stalling
    // the main thread/compositor for SECONDS. Desktop + Playwright emulation
    // never hit this (lower DPR / different compositor). Coinbase avoids
    // backdrop-filter on mobile entirely — so below the hamburger breakpoint we
    // DROP the blur and use a near-solid background. Visually clean, and the
    // menu now opens/closes instantly.
    "@media (max-width: 1025px)": {
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
      backgroundColor: dark ? "rgba(11,11,15,0.96)" : "rgba(250,250,247,0.98)",
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
  // Reclaim horizontal space on laptops (1025–1360) so the desktop nav row
  // + right-side actions never overflow the 1280 content cap.
  "@media (max-width: 1360px)": {
    gap: "36px",
  },
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
export const MobileMenuButton = styled(IconButton)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
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
    backgroundColor: "transparent",
    transition: "background-color 120ms ease",

    // STICKY-HOVER FIX (2026-08, iPhone 14 Pro Max report — "dark shade
    // remains on the icon after closing"). On touch devices :hover / :active
    // latch after a tap and don't clear until you tap elsewhere, leaving a
    // dark shade on the hamburger; MUI's ripple/focus bg does the same. Keep
    // the button visually flat on touch (no bg on hover/active/focus, ripple
    // hidden) and only show a hover tint on hover-CAPABLE pointers (real
    // mouse). Combined with disableRipple on the element, no shade lingers.
    "&:hover, &:active, &.Mui-focusVisible, &:focus": {
      backgroundColor: "transparent",
    },
    "& .MuiTouchRipple-root": { display: "none" },
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover": {
        backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)",
      },
    },

    "@media (max-width: 1025px)": {
      display: "inline-flex",
    },
  };
});

export const MenuOpenIcon = styled(MenuRounded)(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  fontSize: 26,
}));

export const MenuCloseIcon = styled(CloseRoundedIcon)(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  fontSize: 26,
}));

/* ================= LIGHTWEIGHT MOBILE PANEL (2026-08 rewrite) =================
 * Replaces the MUI <Drawer> for the hamburger menu. WHY: three prior band-aids
 * (pointer-event de-dupe, FocusTrap disabling, backdrop-filter removal) still
 * left taps feeling dead on mobile WebKit/Blink. The remaining cost was MUI
 * Modal machinery itself: portal mount on open, ModalManager aria-hidden sweep
 * over every <body> child of this LONG landing page, and JS-scheduled Slide
 * transitions — all synchronous main-thread work performed ON TAP.
 * This panel is ALWAYS mounted, GPU-composited (transform/opacity only) and
 * toggled by one data attribute: the open cost after hydration is a single
 * style flip → instant on any device. visibility:hidden keeps the closed panel
 * out of the a11y tree and paint. */
export const MobilePanelBackdrop = styled("div")({
  position: "fixed",
  inset: 0,
  top: 64,
  zIndex: 1499,
  display: "none",
  backgroundColor: "rgba(11,11,15,0.6)",
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 160ms ease",
  // Own compositor layer — the fade never touches layout.
  transform: "translateZ(0)",
  "&[data-open='true']": {
    opacity: 1,
    pointerEvents: "auto",
  },
  "@media (max-width: 1025px)": {
    display: "block",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

export const MobilePanel = styled("div")({
  position: "fixed",
  top: 64,
  right: 0,
  height: "calc(100dvh - 64px)",
  width: "100%",
  // Coinbase-style: effectively full-screen on phones, comfortable panel on
  // tablets. width:100% + this cap = full-bleed under ~420px viewports.
  maxWidth: 420,
  zIndex: 1500,
  display: "none",
  visibility: "hidden",
  transform: "translate3d(100%, 0, 0)",
  // Delay the visibility flip until the slide-out finishes.
  transition:
    "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 200ms",
  willChange: "transform",
  "&[data-open='true']": {
    visibility: "visible",
    transform: "translate3d(0, 0, 0)",
    transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
  "@media (max-width: 1025px)": {
    display: "block",
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "&[data-open='true']": { transition: "none" },
  },
});

export const MobileMenuDrawer = styled(Drawer)(() => ({
  display: "none",
  zIndex: 1500,

  "& .MuiDrawer-paper": {
    top: "64px !important",
    height: "calc(100vh - 64px) !important",
    width: "100%",
    // Coinbase-style: effectively full-screen on phones, comfortable panel on
    // tablets. width:100% + this cap = full-bleed under ~420px viewports.
    maxWidth: "420px",
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    border: "none !important",
  },

  "& .MuiBackdrop-root": {
    // PERF (2026-08 iPhone 14 Pro Max report): dropped the 4px full-screen
    // backdrop-filter here. On high-DPR phones (@3x) stacking this blur ON TOP
    // of the header's always-on backdrop-filter meant every open/close
    // re-blurred the whole viewport twice, pinning the compositor and delaying
    // the next tap. A plain dark overlay is visually near-identical (the
    // frosted header is still visible behind it) and composites instantly.
    backgroundColor: "rgba(11,11,15,0.6)",
    // Promote to its own layer so the fade composites cheaply.
    transform: "translateZ(0)",
    willChange: "opacity",
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

  // Hidden below 1360px so the desktop nav + right-side actions never overflow
  // the 1280 content cap on laptops (1025–1360). The status label is
  // decorative; the utility actions and the primary CTA take priority.
  "@media (max-width: 1360px)": {
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

/* ================= DESKTOP MEGA-MENU (Coinbase-style) ================= */

// Shared entrance keyframe for dropdown cards.
const megaIn = {
  "@keyframes dynoMegaIn": {
    from: { opacity: 0, transform: "translateY(-6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
} as const;

// Per-item wrapper — establishes the positioning context for the panel and
// owns the hover region (button + panel) so moving the cursor between them
// never closes the menu.
export const MegaTrigger = styled(Box)({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
});

export const MegaTriggerButton = styled(Button)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    textTransform: "none",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: "22px",
    letterSpacing: "-0.005em",
    fontFamily: "var(--font-body)",
    color: dark ? "rgba(255,255,255,0.72)" : "#3F3F46",
    padding: "8px 6px",
    borderRadius: 8,
    minWidth: 0,
    gap: 2,
    transition: "color 200ms ease",
    "& .chev": { transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)", fontSize: 18, marginTop: 1 },
    "&:hover": { background: "transparent", color: dark ? "#F5F5F5" : "#0A0A0A" },
    "&[data-open='true']": { color: dark ? "#F5F5F5" : "#0A0A0A" },
    "&[data-open='true'] .chev": { transform: "rotate(180deg)", color: CORAL },
  };
});

// Absolutely-positioned wrapper. `paddingTop` is a transparent bridge that
// keeps the hover region continuous from the trigger down to the visible card.
export const MegaPanel = styled(Box)(() => ({
  position: "absolute",
  top: "100%",
  left: 0,
  paddingTop: 14,
  zIndex: 1450,
  ...megaIn,
  animation: "dynoMegaIn 180ms cubic-bezier(0.16,1,0.3,1)",
}));

export const MegaCard = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    minWidth: 328,
    maxWidth: 384,
    padding: 10,
    borderRadius: 18,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    backgroundColor: dark ? "rgba(18,18,24,0.98)" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"}`,
    boxShadow: dark
      ? "0 24px 60px -14px rgba(0,0,0,0.72)"
      : "0 24px 60px -18px rgba(10,10,10,0.20)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  };
});

export const MegaItemLink = styled(Box)<BoxProps & { component?: React.ElementType; href?: string }>(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 160ms ease",
    "&:hover": { background: dark ? "rgba(255,255,255,0.05)" : "rgba(79,70,229,0.05)" },
    "&:hover .mega-icon": { color: "#FFFFFF", background: CORAL, borderColor: CORAL },
    "&:hover .mega-title": { color: CORAL },
  };
});

export const MegaItemIcon = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: CORAL,
    background: dark ? "rgba(79,70,229,0.16)" : "rgba(79,70,229,0.08)",
    border: `1px solid ${dark ? "rgba(124,92,255,0.28)" : "rgba(79,70,229,0.16)"}`,
    transition: "all 160ms ease",
    "& svg": { fontSize: 20 },
  };
});

export const MegaItemTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-body)",
  fontSize: 14.5,
  fontWeight: 600,
  lineHeight: "20px",
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  transition: "color 160ms ease",
}));

export const MegaItemDesc = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-body)",
  fontSize: 12.5,
  fontWeight: 400,
  lineHeight: "17px",
  marginTop: 2,
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : "#71717A",
}));

/* ================= LANGUAGE GLOBE (desktop) ================= */

export const LangWrap = styled(Box)(() => ({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
}));

export const LangGlobeButton = styled(IconButton)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    minWidth: 44,
    minHeight: 40,
    height: 40,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: dark ? "rgba(255,255,255,0.82)" : "#3F3F46",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.02em",
    transition: "all 180ms ease",
    touchAction: "manipulation",
    "& svg": { fontSize: 19 },
    "&:hover": {
      borderColor: CORAL,
      color: dark ? "#fff" : "#0A0A0A",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(79,70,229,0.05)",
    },
  };
});

export const LangPanel = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "absolute",
    top: "calc(100% + 12px)",
    right: 0,
    minWidth: 220,
    padding: 8,
    borderRadius: 16,
    zIndex: 1460,
    backgroundColor: dark ? "rgba(18,18,24,0.98)" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"}`,
    boxShadow: dark
      ? "0 24px 60px -14px rgba(0,0,0,0.72)"
      : "0 24px 60px -18px rgba(10,10,10,0.20)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    ...megaIn,
    animation: "dynoMegaIn 160ms cubic-bezier(0.16,1,0.3,1)",
  };
});

export const LangOption = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background 150ms ease",
    "&:hover": { background: dark ? "rgba(255,255,255,0.05)" : "rgba(79,70,229,0.05)" },
    "&[data-selected='true']": {
      background: dark ? "rgba(79,70,229,0.16)" : "rgba(79,70,229,0.08)",
    },
  };
});

export const LangOptionLabel = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  fontWeight: 500,
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#18181B",
}));

/* ================= MOBILE ACCORDION ================= */

export const MobileSection = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${
    theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.08)"
  }`,
}));

export const MobileSectionButton = styled("button")(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    width: "100%",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 2px",
    color: dark ? "#F5F5F5" : "#0A0A0A",
    fontFamily: "var(--font-hero)",
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    textAlign: "left",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    "& .chev": {
      transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
      fontSize: 24,
      color: dark ? "rgba(255,255,255,0.6)" : "rgba(10,10,10,0.5)",
    },
    "&[data-open='true'] .chev": { transform: "rotate(180deg)", color: CORAL },
  };
});

export const MobileSubItem = styled(Box)<BoxProps & { component?: React.ElementType; href?: string }>(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 6px 11px 2px",
    cursor: "pointer",
    textDecoration: "none",
    color: dark ? "rgba(255,255,255,0.82)" : "#27272A",
    transition: "color 160ms ease, transform 160ms ease",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    "& .msub-icon": {
      width: 34,
      height: 34,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      color: CORAL,
      background: dark ? "rgba(79,70,229,0.16)" : "rgba(79,70,229,0.08)",
      border: `1px solid ${dark ? "rgba(124,92,255,0.26)" : "rgba(79,70,229,0.16)"}`,
      flexShrink: 0,
    },
    "& .msub-icon svg": { fontSize: 18 },
    "& .msub-title": { fontFamily: "var(--font-body)", fontSize: 15.5, fontWeight: 500 },
    "&:active": { color: CORAL, transform: "translateX(3px)" },
  };
});

/* ================= FEATURED MEGA TILE (Products menu) ================= */

export const FeaturedTile = styled(Box)<BoxProps & { component?: React.ElementType; href?: string }>(() => ({
  position: "relative",
  overflow: "hidden",
  width: 240,
  minWidth: 240,
  borderRadius: 14,
  padding: "18px 18px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  textDecoration: "none",
  color: "#FFFFFF",
  background: `linear-gradient(150deg, ${CORAL} 0%, ${VIOLET} 100%)`,
  boxShadow: "0 12px 30px -12px rgba(79,70,229,0.55)",
  transition: "transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease",
  "&:hover": { transform: "translateY(-2px)", boxShadow: "0 18px 42px -14px rgba(79,70,229,0.6)" },
  "&:hover .feat-arrow": { transform: "translateX(3px)" },
  "&::after": {
    content: '""',
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.20)",
    filter: "blur(34px)",
    top: -46,
    right: -34,
    pointerEvents: "none",
  },
}));

export const FeaturedBadge = styled(Box)(() => ({
  position: "relative",
  zIndex: 1,
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.30)",
  fontFamily: "var(--font-tech), var(--font-body)",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
}));

/* ================= SEARCH — command menu (⌘K) ================= */

export const SearchButton = styled(IconButton)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    height: 40,
    minWidth: 40,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: dark ? "rgba(255,255,255,0.72)" : "#52525B",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.10)"}`,
    background: dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)",
    transition: "all 180ms ease",
    touchAction: "manipulation",
    "& svg": { fontSize: 19 },
    "& .kbd": {
      fontFamily: "var(--font-tech), var(--font-body)",
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 6px",
      borderRadius: 6,
      lineHeight: 1.4,
      color: dark ? "rgba(255,255,255,0.6)" : "#71717A",
      border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)"}`,
      background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
    },
    "&:hover": {
      borderColor: CORAL,
      color: dark ? "#fff" : "#0A0A0A",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(79,70,229,0.05)",
    },
    [theme.breakpoints.down("sm")]: { padding: 0, width: 40, "& .kbd": { display: "none" } },
  };
});

export const CmdCard = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    width: "min(600px, 92vw)",
    maxHeight: "72vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: dark ? "rgba(18,18,24,0.98)" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"}`,
    boxShadow: dark
      ? "0 40px 90px -20px rgba(0,0,0,0.75)"
      : "0 40px 90px -24px rgba(10,10,10,0.28)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    // Drop the blur on mobile — same iOS Safari compositor stall as the header
    // (the card's background is already near-opaque, so no visual change).
    "@media (max-width: 1025px)": {
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
    },
    ...megaIn,
    animation: "dynoMegaIn 180ms cubic-bezier(0.16,1,0.3,1)",
  };
});

export const CmdInputRow = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 18px",
    borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`,
    "& svg.search-ic": { fontSize: 22, color: dark ? "rgba(255,255,255,0.5)" : "#A1A1AA" },
  };
});

export const CmdInput = styled("input")(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: "var(--font-body)",
    fontSize: 16,
    fontWeight: 400,
    color: dark ? "#F5F5F5" : "#0A0A0A",
    "&::placeholder": { color: dark ? "rgba(255,255,255,0.4)" : "#A1A1AA" },
  };
});

export const CmdResults = styled(Box)({
  overflowY: "auto",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 2,
});

export const CmdGroupLabel = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-tech), var(--font-body)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.4)" : "#A1A1AA",
  padding: "10px 12px 4px",
}));

export const CmdItem = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    textDecoration: "none",
    color: dark ? "rgba(255,255,255,0.86)" : "#27272A",
    transition: "background 140ms ease",
    "& .cmd-ic": {
      width: 34,
      height: 34,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      color: CORAL,
      background: dark ? "rgba(79,70,229,0.16)" : "rgba(79,70,229,0.08)",
      border: `1px solid ${dark ? "rgba(124,92,255,0.26)" : "rgba(79,70,229,0.16)"}`,
      flexShrink: 0,
    },
    "& .cmd-ic svg": { fontSize: 18 },
    "& .cmd-title": { fontFamily: "var(--font-body)", fontSize: 14.5, fontWeight: 500 },
    "& .cmd-group": {
      marginLeft: "auto",
      fontFamily: "var(--font-body)",
      fontSize: 12,
      color: dark ? "rgba(255,255,255,0.4)" : "#A1A1AA",
    },
    "&[data-active='true']": { background: dark ? "rgba(255,255,255,0.06)" : "rgba(79,70,229,0.07)" },
    "&:hover": { background: dark ? "rgba(255,255,255,0.06)" : "rgba(79,70,229,0.07)" },
  };
});

export const CmdFooter = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 16px",
    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`,
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: dark ? "rgba(255,255,255,0.5)" : "#A1A1AA",
    "& .kbd": {
      fontFamily: "var(--font-tech), var(--font-body)",
      fontSize: 11,
      fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 5,
      marginRight: 6,
      border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)"}`,
    },
  };
});

// Legacy export (kept for backward compat if anything still imports it).
export { AURORA_GRADIENT, CORAL, VIOLET, VOLT };
