import { Box, TableCell } from "@mui/material";
import { styled } from "@mui/material/styles";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/* ================= TABLE HEADER ================= */

export const TableHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: "#111827",
  borderBottom: "none",
  padding: "14px 16px",
  whiteSpace: "nowrap",
}));

/* ================= TABLE BODY ================= */

export const TableBodyCell = styled(TableCell)(({ theme }) => ({
  border: "none",
  padding: "0px 10px",
  fontSize: "15px",
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
  padding: "22px 20px 24px 20px",
  flexShrink: 0,
  minHeight: "max-content",
  borderTop: "1px solid #E5E7EB",
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

export const HeaderRow = styled("tr")(() => ({
  backgroundColor: "#EEF4FF",
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
  borderRadius: "14px",
  overflow: "hidden",
  minHeight: 0,
  ["@media (max-width:960px)"]: {
    height: "auto",
  },
}));
