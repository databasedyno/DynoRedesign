import { Box, TableCell } from "@mui/material";
import { styled } from "@mui/material/styles";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/* ── Dashboard-parity tokens (Payment Links polish, 2026-09) ─────────────────
   Same quiet language as the Transactions list: flat 16px card + CB hairline,
   uppercase tech-font column eyebrows, hairline row dividers, ghost action
   buttons with the indigo accent reserved for the primary action. */
export const CARD_RADIUS = 16;
export const hairline = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
export const rowDivider = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F2F7";
export const rowHover = (theme: { palette: { mode: string } }) =>
  theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#FAFBFD";
export const EYEBROW_SX = {
  fontFamily: "var(--font-tech), monospace",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const;

/** Ghost row-action button — hairline border, quiet by default; `tone` adds
 *  the indigo accent (primary action) or rose (destructive) on hover. */
export const RowActionButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "tone",
})<{ tone?: "primary" | "danger" | "neutral" }>(({ theme, tone = "neutral" }) => {
  const isDark = theme.palette.mode === "dark";
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const rose = isDark ? "#FB7185" : "#E11D48";
  const ink = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const accent = tone === "primary" ? indigo : tone === "danger" ? rose : ink;
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    padding: 0,
    borderRadius: 10,
    border: `1px solid ${tone === "primary" ? (isDark ? "rgba(129,140,248,0.45)" : "rgba(67,56,202,0.35)") : hairline(theme)}`,
    backgroundColor: tone === "primary" ? (isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow) : "transparent",
    color: accent,
    cursor: "pointer",
    transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 100ms ease",
    "& img, & svg": { color: "inherit" },
    "&:hover": {
      borderColor: accent,
      backgroundColor:
        tone === "primary"
          ? isDark ? "rgba(129,140,248,0.22)" : "rgba(67,56,202,0.14)"
          : tone === "danger"
            ? isDark ? "rgba(251,113,133,0.14)" : "rgba(225,29,72,0.08)"
            : isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)",
    },
    "&:active": { transform: "scale(0.96)" },
    "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
    "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
    [theme.breakpoints.down("md")]: {
      // WCAG 2.5.5 tap target on touch devices.
      width: 44,
      height: 44,
      borderRadius: 12,
    },
  };
});

/* ================= TABLE HEADER ================= */

export const TableHeaderCell = styled(TableCell)(({ theme }) => ({
  ...EYEBROW_SX,
  color: theme.palette.mode === "dark" ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
  borderBottom: `1px solid ${hairline(theme)}`,
  padding: "12px 16px",
  whiteSpace: "nowrap",
}));

/* ================= TABLE BODY ================= */

export const TableBodyCell = styled(TableCell)(({ theme }) => ({
  border: "none",
  padding: "0px 10px",
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  lineHeight: 1,
  letterSpacing: 0,
  whiteSpace: "nowrap",
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
    padding: "0px 12px",
  },
}));

/* ================= STATUS CHIP ================= */

interface StatusChipProps {
  status: "active" | "expired" | "paid" | "completed" | "pending" | string;
}

export const StatusChip = styled(Box)<StatusChipProps>(({ status, theme }) => {
  const isDark = theme.palette.mode === "dark";
  // Theme-aware semantic tones (aligned with Transactions / dashboard):
  // active = green (live), paid/completed = blue, expired = red, pending = amber.
  const S = CB_TOKENS.semantic;
  const map: Record<string, { dark: string; light: string; glowDark: string; glowLight: string }> = {
    active: S.positive,
    paid: S.info,
    completed: S.info,
    expired: S.negative,
    pending: S.warning,
  };
  const s = map[status] || S.warning;
  const main = isDark ? s.dark : s.light;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    gap: "4px",
    padding: "10px 9px",
    border: `1px solid ${main}${isDark ? "38" : "29"}`,
    borderRadius: "100px",
    backgroundColor: isDark ? s.glowDark : s.glowLight,
    color: main,
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    lineHeight: "100%",
    letterSpacing: 0,
    whiteSpace: "nowrap",
    [theme.breakpoints.down("md")]: {
      fontSize: "10px",
      padding: "6px 8px",
    },
  };
});

/* ================= ACTION BUTTON ================= */

export const ActionButton = styled(Box)(({ theme }) => ({
  width: "36px",
  height: "36px",
  fontFamily: "var(--font-sans)",
  borderRadius: "8px",
  border: "1px solid #E0E7FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",

  "&:hover": {
    backgroundColor: "#EEF2FF",
  },
}));

/* ================= FOOTER ================= */

export const TableFooter = styled(Box)(({ theme }) => ({
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
    padding: "30px 12px 12px 12px",
    flexWrap: "wrap",
    gap: "8px",
  },
}));

export const RowsPerPageBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#374151",
  fontFamily: "var(--font-sans)",
}));

export const FooterText = styled(Box)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
  lineHeight: "100%",
  whiteSpace: "nowrap",
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
    lineHeight: "12px",
  },
}));

/* ================= HEADER ROW BACKGROUND ================= */

export const HeaderRow = styled("tr")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  fontFamily: "var(--font-sans)",
}));

export const TransactionsTableScrollWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  overflowX: "auto",
  overflowY: "auto",
  // §4.2 — thin visible scrollbar so it's obvious the table scrolls sideways.
  scrollbarWidth: "thin",
  scrollbarColor:
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.28) transparent"
      : "rgba(15,15,20,0.28) transparent",
  "&::-webkit-scrollbar": { height: 8, width: 8 },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    borderRadius: 8,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.22)"
        : "rgba(15,15,20,0.22)",
  },
  [theme.breakpoints.down("md")]: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  [theme.breakpoints.down("sm")]: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  [theme.breakpoints.down("xs")]: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
}));

export const TransactionsTableContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  backgroundColor: theme.palette.background.paper,
  borderRadius: `${CARD_RADIUS}px`,
  border: `1px solid ${hairline(theme)}`,
  overflow: "hidden",
  minHeight: 0,
  ["@media (max-width:960px)"]: {
    height: "auto",
  },
}));
