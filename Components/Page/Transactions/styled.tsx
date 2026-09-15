import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  ListItemButton,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { MONO } from "@/styles/uiKit";

/* ── Dashboard-parity tokens (Transactions polish, 2026-09) ──────────────────
   The list now shares the v2026 dashboard's flat language: 16px cards with a
   hairline CB border (no shadows / no filled header bands), uppercase tech-font
   column eyebrows, tabular-mono figures and calm dot+text statuses. */
const hairline = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
const rowDivider = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F2F7";
const rowHover = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFBFD";
const inkSecondary = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
export const CARD_RADIUS = CB_TOKENS.radius.card;
/** Uppercase tech-font eyebrow — identical to the dashboard's card labels. */
export const EYEBROW_SX = {
  fontFamily: "var(--font-tech), monospace",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const;

/** Semantic status → CB_TOKENS accent map (shared with the dashboard). */
const STATUS_SEMANTIC: Record<string, { dark: string; light: string; glowDark: string; glowLight: string }> = {
  settled: CB_TOKENS.semantic.positive,
  confirmed: CB_TOKENS.semantic.info,
  pending: CB_TOKENS.semantic.warning,
  processing: CB_TOKENS.semantic.warning,
  failed: CB_TOKENS.semantic.negative,
  // Neutral grey — payment window passed without payment (not an error).
  unpaid: { dark: "#9CA3AF", light: "#6B7280", glowDark: "rgba(156,163,175,0.14)", glowLight: "rgba(107,114,128,0.10)" },
};

export const TransactionsTableContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  backgroundColor: theme.palette.background.paper,
  borderRadius: `${CARD_RADIUS}px`,
  overflow: "hidden",
  minHeight: 0,
  ["@media (max-width:960px)"]: {
    height: "auto",
  },
}));

export const TransactionsTableHeader = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "grid",
  // >=md: weighted columns that always FIT the container (no horizontal scroll,
  // so the Status column is never pushed off-screen on 1280-1440 laptops).
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1.1fr) minmax(0, 0.65fr) minmax(0, 1.2fr) minmax(0, 1.1fr)",
  gridAutoColumns: "minmax(0, 1fr)",
  alignItems: "center",
  padding: "12px 20px",
  // Flat (dashboard parity): no filled band — paper surface + hairline rule.
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${hairline(theme)}`,
  borderRadius: 0,
  gap: "16px",
  minWidth: 0,
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    minWidth: "max-content",
    gridTemplateColumns:
      "minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(150px, 1fr) minmax(100px, 1fr)",
    padding: "10px 12px",
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
  minWidth: 0,
  gap: 6,
  "& span": {
    ...EYEBROW_SX,
    color: inkSecondary(theme),
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    [theme.breakpoints.down("md")]: {
      fontSize: "10.5px",
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
  minWidth: 0,
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  [theme.breakpoints.down("md")]: {
    minWidth: "max-content",
    padding: "0 12px",
  },
}));

export const TransactionsTableRow = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1.1fr) minmax(0, 0.65fr) minmax(0, 1.2fr) minmax(0, 1.1fr)",
  gridAutoColumns: "minmax(0, 1fr)",
  alignItems: "center",
  padding: "11px 0",
  borderBottom: `1px solid ${rowDivider(theme)}`,
  gap: "16px",
  minWidth: 0,
  transition: "background-color 120ms ease",
  "&:hover": { backgroundColor: rowHover(theme) },
  // The frozen first cell paints its own opaque background (so scrolled columns
  // never show through) — tint it together with the row on hover.
  "&:hover > :first-of-type": { backgroundColor: rowHover(theme) },
  "&:last-of-type": { borderBottom: "none" },
  [theme.breakpoints.down("md")]: {
    minWidth: "max-content",
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

// NOTE: intentionally a Box (renders <div>), NOT Typography (<p>). Cells embed
// block-level pills/chips (SourceBadge, CryptoIconChip, StatusBadge, flex Boxes)
// and a <div> inside a <p> is invalid DOM nesting (React validateDOMNesting
// warnings). All text styling below is explicit, so visuals are unchanged.
export const TransactionsTableCell = styled(Box)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 500,
  maxWidth: "100%",
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
  padding: "14px 20px 16px 20px",
  flexShrink: 0,
  minHeight: "max-content",
  borderTop: `1px solid ${hairline(theme)}`,
  [theme.breakpoints.down("md")]: {
    padding: "12px 12px 16px 12px",
    flexWrap: "wrap",
    gap: "8px",
    borderTop: "none",
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
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid";
}>(({ theme, status }) => {
  const isDark = theme.palette.mode === "dark";
  const s = STATUS_SEMANTIC[status] || STATUS_SEMANTIC.pending;
  const main = isDark ? s.dark : s.light;

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 9px",
    borderRadius: "100px",
    // Theme-aware semantic tint (green=paid, blue=confirmed, amber=pending,
    // red=failed) — soft translucent glow works on both light + dark surfaces.
    backgroundColor: isDark ? s.glowDark : s.glowLight,
    border: `1px solid ${main}${isDark ? "38" : "29"}`,
    // Aurora Dark (Phase 2): settled/confirmed get a soft outer bloom in dark
    // so a paid transaction reads as a positive, glowing state at a glance.
    boxShadow:
      isDark && (status === "settled" || status === "confirmed")
        ? `0 0 14px ${main}33`
        : "none",
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
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid";
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
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid";
}>(({ status, theme }) => {
  const isDark = theme.palette.mode === "dark";
  const s = STATUS_SEMANTIC[status] || STATUS_SEMANTIC.pending;

  return {
    fontSize: "13px",
    fontWeight: 600,
    // Theme-aware semantic ink — matches the badge tint, AA-legible both modes.
    color: isDark ? s.dark : s.light,
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

export const CryptoIconChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== "accent",
})<{ accent?: string }>(({ theme, accent }) => {
  const isDark = theme.palette.mode === "dark";
  // Aurora Dark: the coin ICON carries the colour; in dark mode it gets a
  // subtle brand-coloured bloom so BTC/ETH/USDT read vividly against the deep
  // canvas (Phase 2). Light mode stays clean and flat.
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: 0,
    borderRadius: 0,
    background: "transparent",
    fontFamily: "var(--font-sans)",
    fontSize: "13.5px",
    fontWeight: 600,
    color: theme.palette.text.primary,
    flexShrink: 0,
    border: "none",
    position: "relative",

    "& span": {
      fontSize: "13.5px",
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      lineHeight: "18px",
      flexShrink: 0,
      color: theme.palette.text.primary,
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
      width: "22px",
      height: "22px",
      objectFit: "contain",
      objectPosition: "center",
      flexShrink: 0,
      borderRadius: "50%",
      padding: 0,
      background: "transparent",
      // Subtle brand-coloured bloom around the coin logo in dark mode only.
      ...(isDark && accent
        ? { filter: `drop-shadow(0 0 5px ${accent}66)` }
        : {}),
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
  };
});

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
  // UI/UX audit fix (2026-06): the scrollbar was fully hidden, so when columns
  // overflowed (tablet, or the 9-column pay-links table) the cut-off Actions /
  // Status columns looked broken with no hint that the table scrolls.
  scrollbarWidth: "thin",
  scrollbarColor:
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.28) transparent"
      : "rgba(15,15,20,0.28) transparent",
  "&::-webkit-scrollbar": { height: 8 },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    borderRadius: 8,
    backgroundColor:
      theme.palette.mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(15,15,20,0.22)",
  },
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
  // Segmented control — same shell as the dashboard range picker (7D/30D/…):
  // one soft grey pill, indigo active segment, no shadows.
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px",
  borderRadius: 999,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)",
  maxWidth: "100%",
  width: "fit-content",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
  marginBottom: "12px",
  scrollBehavior: "smooth",
  [theme.breakpoints.down("md")]: {
    marginBottom: "8px",
    width: "100%",
    scrollSnapType: "x proximity",
  },
}));

export const SourceChip = styled(Button, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ selected, theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "0 12px",
  minHeight: "30px",
  height: "30px",
  minWidth: 0,
  flexShrink: 0,
  borderRadius: 999,
  border: "1px solid transparent",
  backgroundColor: selected
    ? theme.palette.mode === "dark"
      ? CB_TOKENS.indigo.dark
      : CB_TOKENS.indigo.light
    : "transparent",
  color: selected
    ? "#FFFFFF"
    : theme.palette.mode === "dark"
      ? CB_TOKENS.ink.secondaryDark
      : CB_TOKENS.ink.secondaryLight,
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: 1,
  letterSpacing: 0.1,
  textTransform: "none",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  whiteSpace: "nowrap",
  transition: "background-color 150ms ease, color 150ms ease",
  boxShadow: "none",
  "& .chip-label": {
    display: "inline-block",
  },
  "& svg, & img": { color: "inherit" },
  "&:hover": {
    backgroundColor: selected
      ? theme.palette.mode === "dark"
        ? CB_TOKENS.indigo.dark
        : CB_TOKENS.indigo.light
      : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(10,10,15,0.04)",
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.mode === "dark" ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`,
    outlineOffset: 2,
  },
  [theme.breakpoints.down("md")]: {
    padding: "0 14px",
    minHeight: "38px",
    height: "38px",
    fontSize: "13px",
    scrollSnapAlign: "start",
  },
}));

/* ─────────────────────────────────────────────────────────────────────────
 * Table toolbar strip — sits INSIDE the table card above the column headers:
 * status chips with live counts on the left, Export on the right.
 * ────────────────────────────────────────────────────────────────────── */
export const TableToolbar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "standalone",
})<{ standalone?: boolean }>(({ theme, standalone }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 12px 10px 16px",
  minWidth: 0,
  flexShrink: 0,
  backgroundColor: theme.palette.background.paper,
  border: standalone ? `1px solid ${hairline(theme)}` : "none",
  borderBottom: `1px solid ${hairline(theme)}`,
  borderRadius: standalone ? `${CARD_RADIUS}px` : `${CARD_RADIUS}px ${CARD_RADIUS}px 0 0`,
  [theme.breakpoints.down("md")]: {
    padding: "8px 10px",
    gap: "8px",
    margin: "0 16px 8px",
    borderRadius: `${CARD_RADIUS}px`,
    border: `1px solid ${hairline(theme)}`,
  },
}));

export const StatusChipsRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  flex: 1,
  minWidth: 0,
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

export const StatusChip = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ theme, selected }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    flexShrink: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "12.5px",
    fontWeight: selected ? 600 : 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
    color: selected ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: selected
      ? isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(10,10,15,0.06)"
      : "transparent",
    border: `1px solid ${
      selected
        ? isDark
          ? "rgba(255,255,255,0.18)"
          : "rgba(10,10,15,0.14)"
        : "transparent"
    }`,
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 100ms ease",
    "&:hover": {
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.04)",
      color: theme.palette.text.primary,
    },
    "&:active": { transform: "scale(0.97)" },
    "&.Mui-focusVisible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 1,
    },
    "& .chip-label": { textTransform: "capitalize" },
    "& .chip-count": {
      fontFamily: MONO,
      fontVariantNumeric: "tabular-nums",
      fontSize: "11.5px",
      fontWeight: 600,
      opacity: selected ? 1 : 0.8,
    },
    [theme.breakpoints.down("md")]: {
      height: "34px",
      fontSize: "12px",
    },
  };
});

/* ─────────────────────────────────────────────────────────────────────────
 * Source badge (Session 48) — compact pill shown inline in each transaction
 * row (ID cell on desktop / top-of-card on mobile) so merchants can identify
 * where a transaction came from at a glance without opening the detail modal.
 * ────────────────────────────────────────────────────────────────────── */
export const SourceBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== "sourceType",
})<{ sourceType?: string }>(({ theme }) => {
  // Quiet Money (Blueprint §3): the transaction source is a low-emphasis text
  // label + small muted icon — NOT a per-type coloured pill. Keeps the row calm
  // so the amount + status carry the emphasis.
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
    backgroundColor: "transparent",
    color: theme.palette.text.secondary,
    border: "none",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    "& svg": {
      flexShrink: 0,
      fontSize: "13px",
      opacity: 0.7,
    },
    "& .badge-title": {
      maxWidth: "22ch",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: theme.palette.text.primary,
    },
  };
});
