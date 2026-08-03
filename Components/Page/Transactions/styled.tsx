import { theme } from "@/styles/theme";
import {
  Box,
  Button,
  IconButton,
  ListItemButton,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";

export const TransactionsTableContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  backgroundColor: theme.palette.background.paper,
  borderRadius: "14px",
  overflow: "hidden",
  minHeight: 0,
  ["@media (max-width:960px)"]: {
    height: "auto",
  },
}));

export const TransactionsTableHeader = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gridAutoColumns: "minmax(0, 1fr)",
  alignItems: "center",
  padding: "19px 20px",
  backgroundColor: theme.palette.primary.light,
  borderRadius: "14px 14px 0 0",
  gap: "16px",
  minWidth: "max-content",
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns:
      "minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(150px, 1fr) minmax(100px, 1fr)",
    padding: "15px 12px",
    gap: "12px",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns:
      "minmax(100px, 1fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(120px, 1fr) minmax(80px, 1fr)",
    padding: "12px 10px",
    gap: "10px",
  },
  [theme.breakpoints.down("xs")]: {
    gridTemplateColumns:
      "minmax(90px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(100px, 1fr) minmax(70px, 1fr)",
    padding: "10px 8px",
    gap: "8px",
  },
}));

export const TransactionsTableHeaderItem = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  minWidth: "180px",
  gap: 10,
  "& span": {
    fontSize: "15px",
    fontWeight: 500,
    color: theme.palette.text.primary,
    fontFamily: "var(--font-sans)",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("md")]: {
      fontSize: "13px",
    },
  },
  "& img": {
    width: "16px",
    height: "16px",
    objectFit: "contain",
    objectPosition: "center",
    flexShrink: 0,
  },
  [theme.breakpoints.down("md")]: {
    minWidth: "180px",
    gap: 8,
    "& span": {
      fontSize: "10px",
    },
    "& img": {
      width: "14px",
      height: "11px",
    },
  },
  [theme.breakpoints.down("sm")]: {
    minWidth: "110px",
    gap: 6,
    "& span": {
      fontSize: "11px",
    },
    "& img": {
      width: "12px",
      height: "10px",
    },
  },
  [theme.breakpoints.down("xs")]: {
    gap: 6,
    "& span": {
      fontSize: "10px",
    },
    "& img": {
      width: "10px",
      height: "10px",
    },
  },
}));

export const TransactionsTableBody = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  padding: "0 20px",
  minWidth: "max-content",
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  [theme.breakpoints.down("md")]: {
    padding: "0 12px",
  },
}));

export const TransactionsTableRow = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gridAutoColumns: "minmax(0, 1fr)",
  alignItems: "center",
  padding: "11px 0",
  borderBottom: `1px solid ${theme.palette.divider}`,
  gap: "16px",
  minWidth: "max-content",
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns:
      "minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(150px, 1fr) minmax(100px, 1fr)",
    gap: "12px",
    padding: "8px 0",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns:
      "minmax(100px, 1fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(120px, 1fr) minmax(80px, 1fr)",
    gap: "10px",
    padding: "6px 0",
  },
  [theme.breakpoints.down("xs")]: {
    gridTemplateColumns:
      "minmax(90px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(100px, 1fr) minmax(70px, 1fr)",
    gap: "8px",
    padding: "4px 0",
  },
}));

export const TransactionsTableCell = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  maxWidth: "180px",
  minWidth: 0,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-sans)",
  lineHeight: "100%",
  letterSpacing: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "flex",
  gap: "12px",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "110px",
    fontSize: "12px",
    lineHeight: "14px",
  },
  [theme.breakpoints.down("xs")]: {
    maxWidth: "90px",
    fontSize: "11px",
    lineHeight: "12px",
  },
}));

export const TransactionsTableFooter = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px 20px 20px",
  flexShrink: 0,
  minHeight: "max-content",
  [theme.breakpoints.down("md")]: {
    padding: "12px 12px 16px 12px",
    flexWrap: "wrap",
    gap: "8px",
  },
}));

export const TransactionsTableFooterText = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
  lineHeight: "16px",
  whiteSpace: "nowrap",
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
    lineHeight: "12px",
  },
}));

export const StatusBadge = styled(Box)<{
  status: "pending" | "confirmed" | "settled" | "failed" | "processing";
}>(({ theme, status }) => {
  const statusColors: Record<string, { bg: string; border: string }> = {
    settled: {
      bg: "#EAFFF0",
      border: "#DCF6E4",
    },
    confirmed: {
      bg: "#E3F2FD",
      border: "#BBDEFB",
    },
    pending: {
      bg: "#FFEDD7",
      border: "#FFE3C0",
    },
    processing: {
      bg: "#FFEDD7",
      border: "#FFE3C0",
    },
    failed: {
      bg: "#FFEBE5",
      border: "#FFC9CA",
    },
  };

  const colors = statusColors[status] || statusColors.pending;

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 9px",
    borderRadius: "100px",
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    width: "fit-content",
    [theme.breakpoints.down("md")]: {
      padding: "5px 9px",
    },
  };
});

export const StatusIconWrapper = styled(Box)<{
  status: "pending" | "confirmed" | "settled" | "failed" | "processing";
}>(({ theme }) => {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,

    "& img": {
      width: "14px",
      height: "14px",
      [theme.breakpoints.down("md")]: {
        width: "12px",
        height: "12px",
      },
    },
  };
});

export const StatusText = styled(Typography)<{
  status: "pending" | "confirmed" | "settled" | "failed" | "processing";
}>(({ status, theme }) => {
  const statusColors: Record<string, { textColor: string }> = {
    // Session 56 WCAG fix: darkened text colors so every badge clears
    // AA-Normal contrast (4.5:1) against its pastel backdrop.
    settled: {
      textColor: "#1B7A3E", // was #47B464 (2.51:1) → 5.14:1
    },
    confirmed: {
      textColor: "#1565C0", // 5.03:1 (unchanged)
    },
    pending: {
      textColor: "#8A5300", // was #F7931A (2.01:1) → 5.53:1
    },
    processing: {
      textColor: "#8A5300", // was #F7931A (2.01:1) → 5.53:1
    },
    failed: {
      textColor: "#B91E20", // was #E8484A (3.35:1) → 5.59:1
    },
  };

  return {
    fontSize: "13px",
    fontWeight: 500,
    color: (statusColors[status] || statusColors.pending).textColor,
    fontFamily: "var(--font-sans)",
    textTransform: "capitalize",
    lineHeight: "16px",
    [theme.breakpoints.down("md")]: {
      fontSize: "10px",
      lineHeight: "12px",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "10px",
      lineHeight: "12px",
    },
    [theme.breakpoints.down("xs")]: {
      fontSize: "9px",
      lineHeight: "10px",
    },
  };
});

export const CryptoIconChip = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 9px",
  borderRadius: "999px",
  background: theme.palette.secondary.light,
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  flexShrink: 0,
  border: `1px solid ${theme.palette.border.main}`,

  [theme.breakpoints.down("md")]: {
    padding: "5px 8px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "4px 6px",
  },

  "& span": {
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    lineHeight: "18px",
    flexShrink: 0,
    [theme.breakpoints.down("md")]: {
      fontSize: "10px",
      lineHeight: "12px",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "10px",
      lineHeight: "12px",
    },
    [theme.breakpoints.down("xs")]: {
      fontSize: "9px",
      lineHeight: "10px",
    },
  },

  "& img": {
    width: "20px",
    height: "20px",
    objectFit: "contain",
    objectPosition: "center",
    flexShrink: 0,
    [theme.breakpoints.down("md")]: {
      width: "14px",
      height: "14px",
    },
    [theme.breakpoints.down("sm")]: {
      width: "12px",
      height: "12px",
    },
    [theme.breakpoints.down("xs")]: {
      width: "10px",
      height: "10px",
    },
  },
}));

export const MobileNavigationButtons = styled(Button)(({ theme }) => ({
  display: "none",
  width: "28px",
  height: "28px",
  padding: "0",
  minWidth: "28px",
  borderRadius: "8px",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  color: theme.palette.text.primary,
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
    border: `1px solid ${theme.palette.border.main}`,
  },
  "&:disabled": {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.border.main}`,
    color: theme.palette.text.secondary,
    opacity: 0.5,
    cursor: "not-allowed",
  },
  [theme.breakpoints.down("md")]: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

export const SearchContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  [theme.breakpoints.up("md")]: {
    flex: 1,
    minWidth: "350px",
  },
  // On mobile (< md), let search take the full available row and wrap
  // instead of forcing a 350px minWidth (which overflowed iPhone SE 320px
  // and squeezed neighboring filter chips on 360-390px devices).
  [theme.breakpoints.down("md")]: {
    gap: "8px",
    flex: "1 1 100%",
    minWidth: 0,
    width: "100%",
  },
}));

export const FiltersContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "10px",
  flex: 1,
  [theme.breakpoints.down("md")]: {
    gap: "8px",
    flex: 1,
    flexWrap: "nowrap",
  },
}));

export const DatePickerWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  position: "relative",
  minWidth: "fit-content",
}));

export const WalletSelectorWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  position: "relative",
  flex: 1,
  minWidth: "fit-content",
}));

export const ExportButtonWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexShrink: 0,
}));

export const WalletSelectorButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "9px 16px",
  borderRadius: "6px",
  textTransform: "none",
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  justifyContent: "space-between",
  whiteSpace: "nowrap",
  width: "100%",
  height: "40px",
  "&:hover": {
    backgroundColor: theme.palette.action?.hover || "rgba(255,255,255,0.05)",
    borderColor: theme.palette.border.focus,
  },
  "&:focus": {
    borderColor: theme.palette.border.focus,
  },
  "& .wallet-icon": {
    fontSize: "18px",
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  "& .wallet-text": {
    flex: 1,
    textAlign: "left",
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.primary,
    lineHeight: "18px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("md")]: {
      fontSize: "13px",
      lineHeight: "16px",
    },
  },
  "& .separator": {
    width: "1px",
    height: "20px",
    backgroundColor: theme.palette.border.main,
    flexShrink: 0,
  },
  "& .arrow-icon": {
    fontSize: "16px",
    color: theme.palette.text.secondary,
    flexShrink: 0,
  },
  [theme.breakpoints.up("md")]: {
    minWidth: "200px",
  },
  [theme.breakpoints.down("md")]: {
    padding: "8px 10px",
    height: "32px",
    gap: "6px",
    minWidth: "fit-content",
    "& .separator": {
      height: "16px",
    },
    "& .arrow-icon": {
      fontSize: "14px",
    },
  },
}));

export const SearchIconButton = styled(IconButton)(({ theme }) => ({
  width: "40px",
  height: "40px",
  borderRadius: "6px",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.primary.main}`,
  "&:hover": {
    borderColor: theme.palette.primary.main,
  },
  "& img": {
    width: "17px",
    height: "17px",
    objectFit: "contain",
    objectPosition: "center",
    flexShrink: 0,
    [theme.breakpoints.down("md")]: {
      width: "12px",
      height: "12px",
    },
  },
  [theme.breakpoints.down("md")]: {
    width: "32px",
    height: "32px",
  },
}));

export const TransactionsTopBarContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  gap: "20px",
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  [theme.breakpoints.down("md")]: {
    gap: "8px",
  },
}));

// Combined redundant media queries
export const TransactionsTableScrollWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
  [theme.breakpoints.down("md")]: {
    WebkitOverflowScrolling: "touch",
  },
}));

export const WalletDropdownContainer = styled(Box)<{ isMobile: boolean }>(
  ({ theme, isMobile }) => ({
    position: "absolute",
    top: "0",
    left: isMobile ? "auto" : 0,
    right: isMobile ? 0 : "auto",
    width: isMobile ? "250px" : "270px",
    background: theme.palette.background.paper,
    borderRadius: "6px",
    border: `1px solid ${theme.palette.border.main}`,
    boxShadow: "0px 8px 24px 0px rgba(16, 24, 40, 0.12)",
    padding: "10px 8px",
    zIndex: 3000,
    "& .dropdown-header": {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0px 6px 8px",
      cursor: "pointer",
    },
    "& .header-text": {
      fontSize: isMobile ? "13px" : "15px",
      fontFamily: "var(--font-sans)",
      fontWeight: 500,
      color: theme.palette.text.primary,
    },
  }),
);

export const WalletListItem = styled(ListItemButton)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  borderRadius: "50px",
  padding: "3px 12px 3px 3px",
  transition: "background-color 0.2s",
  "&.Mui-selected": {
    backgroundColor: theme.palette.primary.light,
  },
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
  "& .option-label": {
    fontSize: "15px",
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    color: theme.palette.text.primary,
    [theme.breakpoints.down("md")]: { fontSize: "13px" },
  },
}));

export const DatePickerTriggerButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "9px 16px",
  borderRadius: "6px",
  textTransform: "none",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  height: "40px",
  minWidth: "200px",
  "& .date-text": {
    flex: 1,
    textAlign: "left",
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .separator": {
    width: "1px",
    height: "20px",
    backgroundColor: theme.palette.border.main,
  },
  "& .arrow-icon": {
    fontSize: "16px",
    color: "rgba(103, 103, 104, 1)",
  },
  [theme.breakpoints.down("md")]: {
    padding: "8px 10px",
    height: "32px",
    minWidth: "fit-content",
    "& .date-text": { fontSize: "13px" },
  },
}));


/* ─────────────────────────────────────────────────────────────────────────
 * Source filter chips (Session 48) — segmented control that slices
 * transactions by revenue source: payment links / contributions / tips /
 * product orders / direct payments. Horizontal scroll on mobile so long
 * localized labels never wrap.
 * ────────────────────────────────────────────────────────────────────── */
export const SourceChipsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
  paddingBottom: "4px",
  marginBottom: "12px",
  scrollBehavior: "smooth",
  [theme.breakpoints.down("md")]: {
    marginBottom: "8px",
    paddingLeft: "0px",
    paddingRight: "0px",
    // Swipe hint: fade the trailing edge so it's obvious more filters
    // (Tips / Product orders / Direct) are reachable by scrolling right.
    scrollSnapType: "x proximity",
    WebkitMaskImage:
      "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
    maskImage:
      "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
  },
}));

export const SourceChip = styled(Button, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ selected, theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 12px",
  minHeight: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "999px",
  border: `1px solid ${
    selected ? theme.palette.primary.main : theme.palette.border.main
  }`,
  backgroundColor: selected
    ? theme.palette.primary.main
    : theme.palette.background.paper,
  color: selected
    ? theme.palette.primary.contrastText
    : theme.palette.text.primary,
  fontFamily: "var(--font-sans)",
  fontWeight: selected ? 700 : 500,
  fontSize: "13px",
  lineHeight: 1.2,
  letterSpacing: "0.01em",
  textTransform: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition:
    "background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease",
  boxShadow: selected
    ? theme.palette.mode === "dark"
      ? "0 2px 10px rgba(204,255,0,0.28)"
      : "0 2px 10px rgba(10,10,10,0.18)"
    : "none",
  "& .chip-label": {
    display: "inline-block",
  },
  "&:hover": {
    backgroundColor: selected
      ? theme.palette.primary.main
      : theme.palette.secondary.main,
  },
  "&:active": {
    transform: "scale(0.97)",
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 16px",
    minHeight: "44px",
    height: "44px",
    fontSize: "13px",
    scrollSnapAlign: "start",
  },
}));

/* ─────────────────────────────────────────────────────────────────────────
 * Source badge (Session 48) — compact pill shown inline in each transaction
 * row (ID cell on desktop / top-of-card on mobile) so merchants can identify
 * where a transaction came from at a glance without opening the detail modal.
 * ────────────────────────────────────────────────────────────────────── */
export const SourceBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== "sourceType",
})<{ sourceType?: string }>(({ sourceType, theme }) => {
  const palettes: Record<
    string,
    { bg: string; fg: string; border: string; darkBg: string; darkFg: string }
  > = {
    payment_link: {
      bg: "#EFF6FF",
      fg: "#1D4ED8",
      border: "#BFDBFE",
      darkBg: "rgba(59,130,246,0.15)",
      darkFg: "#93C5FD",
    },
    contribution: {
      bg: "#FDF2F8",
      fg: "#BE185D",
      border: "#FBCFE8",
      darkBg: "rgba(236,72,153,0.14)",
      darkFg: "#F9A8D4",
    },
    tip: {
      bg: "#FEFCE8",
      fg: "#854D0E",
      border: "#FEF08A",
      darkBg: "rgba(234,179,8,0.18)",
      darkFg: "#FDE047",
    },
    product: {
      bg: "#F0FDF4",
      fg: "#15803D",
      border: "#BBF7D0",
      darkBg: "rgba(34,197,94,0.16)",
      darkFg: "#86EFAC",
    },
    direct: {
      bg: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#F3F4F6",
      fg: theme.palette.text.secondary as string,
      border:
        theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "#E5E7EB",
      darkBg: "rgba(255,255,255,0.05)",
      darkFg: theme.palette.text.secondary as string,
    },
  };
  const key = sourceType && palettes[sourceType] ? sourceType : "direct";
  const p = palettes[key];
  const isDark = theme.palette.mode === "dark";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "999px",
    fontFamily: "var(--font-sans)",
    fontSize: "10.5px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    lineHeight: 1.4,
    backgroundColor: isDark ? p.darkBg : p.bg,
    color: isDark ? p.darkFg : p.fg,
    border: `1px solid ${p.border}`,
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    "& svg": {
      flexShrink: 0,
    },
    "& .badge-title": {
      maxWidth: "22ch",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  };
});
