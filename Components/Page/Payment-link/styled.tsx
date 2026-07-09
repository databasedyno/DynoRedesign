import { theme } from "@/styles/theme";
import { Box, TableCell } from "@mui/material";
import { styled } from "@mui/material/styles";

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

export const StatusChip = styled(Box)<StatusChipProps>(({ status, theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  gap: "4px",
  padding: "10px 9px",
  border:
    status === "active"
      ? "1px solid #DCF6E4"
      : status === "expired"
        ? "1px solid #FFC9CA"
        : status === "paid" || status === "completed"
          ? "1px solid #B8D3FF"
          : "1px solid #FFE3C0",
  borderRadius: "100px",
  backgroundColor:
    status === "active"
      ? "#EAFFF0"
      : status === "expired"
        ? "#FFEBE5"
        : status === "paid" || status === "completed"
          ? "#F0F6FF"
          : "#FFEDD7",
  color:
    status === "active"
      ? "#47B464"
      : status === "expired"
        ? "#E8484A"
        : status === "paid" || status === "completed"
          ? "#0071BC"
          : "#F7931A",
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
}));

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
  scrollbarWidth: "none",
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
