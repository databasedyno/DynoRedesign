import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const SecurityNoticeContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
  padding: "8px 14px",
  borderRadius: "7px",
  border: `1px solid ${theme.palette.border.main}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.2),
    gap: theme.spacing(1),
  },
}));

export const SecurityNoticeSubtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 500,
  fontSize: "15px",
  fontFamily: "var(--font-sans)",
  [theme.breakpoints.down("sm")]: {
    fontSize: "13px",
    lineHeight: 1.2,
  },
}));

export const SecurityNoticeTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
  fontSize: "13px",
  lineHeight: 1.2,
  fontFamily: "var(--font-sans)",
  [theme.breakpoints.down("sm")]: {
    fontSize: "10px",
  },
}));

export const SecurityNoticeDescription = styled("ul")(({ theme }) => ({
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
  fontSize: "13px",
  lineHeight: 1.2,
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  [theme.breakpoints.down("sm")]: {
    fontSize: "10px",
  },
}));
