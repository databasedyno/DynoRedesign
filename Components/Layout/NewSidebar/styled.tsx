import { styled } from "@mui/material";
import Link from "next/link";
import { brandFg } from "@/constants/theme";

export const SidebarWrapper = styled("aside")(({ theme }) => ({
  height: "100%",
  background: theme.palette.background.paper,
  display: "flex",
  flexDirection: "column",
  padding: "16px 12px 12px",
  // The wrapper itself never scrolls — only the nav Menu (below) does. This
  // keeps the referral card + Help/Support footer PINNED to the bottom so the
  // referral code is always visible without scrolling, on any viewport height.
  overflow: "hidden",
}));

export const Menu = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  // 10px between groups: with Sell / Money / Grow / Settings all open the full
  // 12-row nav fits a 768px-tall laptop without scrolling.
  gap: "12px",
  "@media (max-height:940px)": { gap: "6px" },
  "@media (max-height:760px)": { gap: "4px" },
  background: "transparent",
  // Fill the free space and become the ONLY scroll region when the nav list is
  // taller than the sidebar. `minHeight: 0` is required for a flex child to
  // shrink below its content and actually scroll. Scrollbar visually hidden.
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
}));

/** Small uppercase group caption — modern SaaS sidebar pattern. */
export const SectionLabel = styled("div")(({ theme }) => ({
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "1.4px",
  textTransform: "uppercase",
  // text.secondary (not .disabled) so the caption clears WCAG AA at 10.5px in
  // dark mode (§7): text.disabled was #71717A on #18181B ≈ 3.67:1.
  color: theme.palette.text.disabled,
  padding: "0 12px",
  marginBottom: "4px",
  userSelect: "none",
}));

/** Clickable group caption — same type as SectionLabel, folds its rows. */
export const SectionToggle = styled("button")(({ theme }) => ({
  all: "unset",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  width: "100%",
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
  padding: "4px 10px 4px 14px",
  marginBottom: "2px",
  "@media (max-height:760px)": { padding: "2px 10px 2px 14px", marginBottom: 0 },
  borderRadius: "8px",
  cursor: "pointer",
  userSelect: "none",
  transition: "background-color 140ms ease, color 140ms ease",
  "&:hover": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,15,20,0.04)",
    color: theme.palette.text.primary,
  },
  "&:focus-visible": {
    outline: `2px solid ${brandFg(theme.palette.mode === "dark")}`,
    outlineOffset: "1px",
  },
}));

const menuItemStyles = ({ active, theme }: { active?: boolean; theme: any }) => {
  const isDark = theme.palette.mode === "dark";
  // Active row: yellow text/icon + 3px yellow left-bar + faint yellow tint on the brown rail.
  const activeTint = "rgba(255,209,0,0.12)";
  return {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "40px",
    maxHeight: "44px",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    textDecoration: "none",
    background: active ? activeTint : "transparent",
    fontSize: "14px",
    fontWeight: active ? 600 : 500,
    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
    boxShadow: "none",
    transition: "background 0.16s ease, color 0.16s ease, transform 0.16s ease",
    position: "relative" as const,
    "&::before": {
      content: '""',
      position: "absolute" as const,
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: "3px",
      height: active ? "20px" : "0px",
      borderRadius: "0 3px 3px 0",
      background: theme.palette.primary.main,
      transition: "height 0.16s ease",
    },
    "&:hover": {
      background: active ? activeTint : isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.07)",
      color: active ? theme.palette.primary.main : theme.palette.text.primary,
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: "-2px",
    },
    "&:active": {
      transform: "scale(0.99)",
    },
    // Height-aware density (§8.1): short laptops (incl. 1440×900 / 1280×800) keep every row —
    // incl. Help & Support — visible without scrolling; ≤ 760 tall (1280×720) tightens once more.
    // Row height = 26px icon box + vertical padding.
    "@media (max-height:940px)": {
      minHeight: "34px",
      padding: "4px 12px",
    },
    "@media (max-height:760px)": {
      minHeight: "32px",
      padding: "3px 12px",
    },
  };
};

export const MenuItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(menuItemStyles as any);

/** Real anchor for nav rows (⌘/middle-click, long-press "open in new tab", URL preview). */
export const MenuLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(menuItemStyles as any);

/** Labelled rail (touch tablets): icon over a caption, one per nav group. */
export const RailGroupButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ active, theme }) => ({
  all: "unset",
  boxSizing: "border-box",
  width: "100%",
  minHeight: "60px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  padding: "8px 2px",
  borderRadius: "12px",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  fontWeight: active ? 700 : 500,
  lineHeight: 1.15,
  textAlign: "center",
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  background: active ? "rgba(255,209,0,0.12)" : "transparent",
  transition: "background-color 0.16s ease, color 0.16s ease",
  WebkitTapHighlightColor: "transparent",
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: "-2px" },
  "@media (max-height:700px)": { minHeight: "52px", padding: "6px 2px" },
}));

/** @deprecated kept for backward-compat — the pill itself now signals the active route. */
export const ActiveIndicator = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "none",
  }),
);

export const IconBox = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "26px",
    height: "26px",
    borderRadius: "6px",
    background: "transparent",
    flexShrink: 0,
  }),
);

/** Inline quick-action (+) on the Payment Links row. */
export const QuickAddButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    marginLeft: "auto",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    color: active ? theme.palette.primary.main : theme.palette.primary.contrastText, // contrast-ok (indigo on white contrastText bg)
    background: active ? theme.palette.primary.contrastText : theme.palette.primary.main,
    transition: "transform 0.15s ease, opacity 0.15s ease",
    "&:hover": {
      transform: "scale(1.12)",
    },
    "&:active": {
      transform: "scale(0.95)",
    },
  }),
);

export const SidebarFooter = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  // Pinned above the collapse toggle — never compressed by a tall nav list, so
  // the referral code stays visible without scrolling.
  flexShrink: 0,
  paddingTop: "14px",
  [theme.breakpoints.down("md")]: {
    gap: "10px",
  },
}));

export const HelpSupportBtn = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px 14px",
  maxHeight: "40px",
  borderRadius: "6px",
  cursor: "pointer",
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  fontWeight: 500,
  color: theme.palette.text.secondary,
}));

export const KnowledgeBaseTitle = styled("div")(({ theme }) => ({
  fontSize: "15px",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));

export const ReferralCard = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px 20px",
  borderRadius: "12px",
  border: `1px solid ${theme.palette.border.main}`,
  fontWeight: 500,
  color: theme.palette.text.secondary,
  background: theme.palette.secondary.main,
  position: "relative",
  [theme.breakpoints.down("md")]: {
    padding: "13px 14px 13px 14px",
  },
}));

export const ReferralCardTitle = styled("div")(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
  lineHeight: "1.2",
  letterSpacing: "0",
}));

export const ReferralCardContent = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  zIndex: 1,
  color: theme.palette.text.primary,
  position: "relative",
  [theme.breakpoints.down("md")]: {
    gap: "6.41px",
  },
}));

export const ReferralCardContentValueContainer = styled("div")(({ theme }) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  minWidth: 0, // Allow flex children to shrink below content size
}));

export const ReferralCardContentValue = styled("span")(({ theme }) => ({
  borderRadius: "7px",
  padding: "11px",
  border: `1px dashed ${theme.palette.border.main}`,
  background: theme.palette.background.paper,
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: brandFg(theme.palette.mode === "dark"),
  flex: 1,
  lineHeight: 1.2,
  maxHeight: "40px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0, // Enable text-overflow in flex child
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
    padding: "8px 10px",
    maxHeight: "32px",
  },
}));

export const CopyButton = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  padding: "6px",
  borderRadius: "7px",
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.background.paper,
  cursor: "pointer",
  transition: "all 0.2s ease",
  flexShrink: 0, // Never let the copy button shrink
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
  "&:active": {
    transform: "scale(0.95)",
  },
  [theme.breakpoints.down("md")]: {
    // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
    width: "44px",
    height: "44px",
    padding: "10px",
  },
}));
