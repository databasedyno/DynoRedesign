import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const HeaderTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: "100px",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    gap: "50px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "25px",
  },
}));

export const TitleColumn = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  [theme.breakpoints.down("md")]: {
    gap: "8px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "6px",
  },
}));

export const TitleLabel = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color:
    theme.palette.mode === "dark"
      ? "rgba(232, 232, 236, 0.82)"
      : theme.palette.text.secondary,
  lineHeight: "1.2",
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));

export const TitleValue = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  lineHeight: "1.2",
  [theme.breakpoints.down("md")]: {
    fontSize: "15px",
  },
}));

export const SectionTitleWithIcon = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  "& img": {
    width: "    ",
    height: "15px",
    objectFit: "contain",
    filter:
      "brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)",
  },
});

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 500,
  lineHeight: "1.2",
  letterSpacing: "-0.02em",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "15px",
  },
}));

export const SectionDivider = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "1px",
  backgroundColor: theme.palette.border.main,
  margin: "24px 0",
  [theme.breakpoints.down("md")]: {
    margin: "12px 0",
  },
}));

export const DetailRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}));

export const DetailLabel = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));

export const DetailValue = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "14px",
  },
}));

export const StatusBadge = styled(Box)<{
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid" | "awaiting_payment";
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
    unpaid: {
      bg: "#F3F4F6",
      border: "#E5E7EB",
    },
    awaiting_payment: {
      bg: "#F3F4F6",
      border: "#E5E7EB",
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
    gap: "4px",
    padding: "9px 8px",
    borderRadius: "50px",
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    width: "fit-content",
    [theme.breakpoints.down("md")]: {
      padding: "6px 7px",
    },
  };
});

export const StatusIconWrapper = styled(Box)(({ theme }) => {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    "& img": {
      width: "14px",
      height: "14px",
    },
    [theme.breakpoints.down("md")]: {
      "& img": {
        width: "10px",
        height: "10px",
      },
    },
  };
});

export const StatusText = styled(Typography)<{
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid" | "awaiting_payment";
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
      textColor: "#8A5300", // was #F57C00 (2.36:1) → 5.53:1
    },
    processing: {
      textColor: "#8A5300", // was #F57C00 (2.36:1) → 5.53:1
    },
    unpaid: {
      textColor: "#4B5563", // neutral grey, 7.6:1 on #F3F4F6
    },
    awaiting_payment: {
      textColor: "#4B5563", // same calm grey as unpaid
    },
    failed: {
      textColor: "#B91E20", // was theme.palette.error.main (~3.35:1) → 5.59:1
    },
  };

  return {
    fontSize: "13px",
    fontWeight: 500,
    color: (statusColors[status] || statusColors.pending).textColor,
    fontFamily: "var(--font-sans)",
    textTransform: "capitalize",
    lineHeight: 1.2,
    [theme.breakpoints.down("md")]: {
      fontSize: "10px",
      lineHeight: "100%",
    },
  };
});

export const CryptoIconWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  backgroundColor: theme.palette.secondary.light,
  border: `1px solid ${theme.palette.border.main}`,
  padding: "4px",
  "& img": {
    width: "24px",
    height: "24px",
    objectFit: "contain",
  },
}));

export const HashRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
  [theme.breakpoints.down("sm")]: {
    gap: "8px",
  },
}));

export const HashInputBox = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  backgroundColor: theme.palette.secondary.light,
  borderRadius: "6px",
  border: `1px solid ${theme.palette.border.main}`,
  fontSize: "13px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  wordBreak: "break-all",
  lineHeight: "1.5",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
}));

export const HashValue = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  wordBreak: "break-all",
  lineHeight: "1.5",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
}));

export const ActionButtonGroup = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
});

export const CopyButton = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  padding: "8px",
  borderRadius: "6px",
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.background.paper,
  cursor: "pointer",
  transition: "all 0.2s ease",
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

export const ExplorerButton = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  padding: "8px",
  borderRadius: "6px",
  border: `1px solid ${theme.palette.text.primary}`,
  backgroundColor: theme.palette.background.paper,
  cursor: "pointer",
  transition: "all 0.2s ease",
  color: theme.palette.text.primary,
  "&:hover": {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  },
  "&:active": {
    transform: "scale(0.95)",
  },
  [theme.breakpoints.down("md")]: {
    // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
    width: "44px",
    height: "44px",
    padding: "6px",
  },
}));

export const WebhookResponseBox = styled(Box)(({ theme }) => ({
  margin: "11px 8px 11px 14px",
  backgroundColor: theme.palette.background.paper,
  maxHeight: "150px",
  overflowY: "auto",
  scrollbarWidth: "none",
  "& pre": {
    color: theme.palette.text.primary,
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
  },
  [theme.breakpoints.down("md")]: {
    margin: "10px",
  },
}));
