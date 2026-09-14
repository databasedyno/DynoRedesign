import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const InfoWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  width: "100%",
  padding: "11px 14px",
  backgroundColor: theme.palette.primary.light,
  borderRadius: "8px",
  gap: "12px",
  outline: `1px solid ${theme.palette.border.main}`,
  [theme.breakpoints.down("md")]: {
    padding: "9px 22px 9px 12px",
  },
}));

export const InfoText = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  lineHeight: "1.23",
  fontFamily: "var(--font-sans)",
  flex: 1,
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
  },
}));

export const InfoIconBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
}));
