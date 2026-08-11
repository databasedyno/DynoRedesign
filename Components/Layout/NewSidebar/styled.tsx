import { styled } from "@mui/material";

export const SidebarWrapper = styled("aside")(({ theme }) => ({
  height: "100%",
  background: theme.palette.background.paper,
  display: "flex",
  flexDirection: "column",
  borderRadius: "14px",
  border: `1px solid ${theme.palette.border.main}`,
  padding: "16px",
  // The wrapper itself never scrolls — only the nav Menu (below) does. This
  // keeps the referral card + Help/Support footer PINNED to the bottom so the
  // referral code is always visible without scrolling, on any viewport height.
  overflow: "hidden",
}));

export const Menu = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  background: theme.palette.background.paper,
  borderRadius: "12px",
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
  fontSize: "10.5px",
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "1.4px",
  textTransform: "uppercase",
  color: theme.palette.text.disabled,
  padding: "0 14px",
  marginBottom: "4px",
  userSelect: "none",
}));

export const MenuItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxHeight: "44px",
    padding: "10px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    // Bento identity: light mode = near-black pill w/ lime text,
    // dark mode = lime pill w/ near-black text (primary + contrastText tokens).
    background: active ? theme.palette.primary.main : "transparent",
    fontSize: "14px",
    fontWeight: 500,
    color: active ? theme.palette.primary.contrastText : theme.palette.text.primary,
    boxShadow: active
      ? theme.palette.mode === "dark"
        ? "0 4px 14px rgba(129,140,248,0.30)"
        : "0 4px 14px rgba(10,10,10,0.28)"
      : "none",
    transition: "background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
    position: "relative",

    "&:hover": {
      background: active ? theme.palette.primary.main : theme.palette.secondary.main,
      transform: active ? "none" : "translateX(3px)",
    },
    "&:active": {
      transform: "scale(0.985)",
    },
  }),
);

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
    color: active ? theme.palette.primary.main : theme.palette.primary.contrastText,
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
  color: theme.palette.primary.main,
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
