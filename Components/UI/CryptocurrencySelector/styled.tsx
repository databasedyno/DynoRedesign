import { theme } from "@/styles/theme";
import styled from "@emotion/styled";
import { Box } from "@mui/material";
import { styled as muiStyled } from "@mui/material/styles";
import Image from "next/image";

export const CryptocurrencyTrigger = muiStyled(Box, {
  shouldForwardProp: (prop) =>
    prop !== "error" &&
    prop !== "fullWidth" &&
    prop !== "isOpen" &&
    prop !== "isMobile",
})<{
  error?: boolean;
  fullWidth?: boolean;
  isOpen?: boolean;
  isMobile?: boolean;
}>(({ theme, error, fullWidth, isMobile }: any) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "14px",
  borderRadius: "6px",
  border: "1px solid",
  borderColor: error ? theme.palette.error.main : theme.palette.border.main,
  cursor: "pointer",
  background: error ? theme.palette.error.main : theme.palette.common.white,
  color: theme.palette.text.primary,
  width: fullWidth ? "100%" : "auto",
  height: isMobile ? "32px" : "40px",
  minHeight: isMobile ? "32px" : "40px",
  boxSizing: "border-box",
  transition: "all 0.3s ease",
  boxShadow: "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
  fontFamily: "var(--font-sans)",
  "&:hover": {
    borderColor: error ? theme.palette.error.main : theme.palette.primary.light,
  },
  "&:focus": {
    outline: "none",
    borderColor: error ? theme.palette.error.main : theme.palette.primary.main,
  },
}));

export const CryptocurrencyIcon = styled(Image)({
  objectFit: "contain",
  flexShrink: 0,
});

export const CryptocurrencyText = styled.span<{ isMobile?: boolean }>(
  ({ isMobile }) => ({
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.primary,
    lineHeight: "100%",
    letterSpacing: 0,

    [theme.breakpoints.down("sm")]: {
      fontSize: "13px",
    },
  }),
);

export const CryptocurrencyDropdown = styled(Box)({
  padding: "8px",
  background: theme.palette.background.paper,
  overflow: "auto",
  maxHeight: "200px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

export const IconChip = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 9px",
  borderRadius: "999px",
  background: theme.palette.secondary.light,
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  flexShrink: 0,
  border: `1px solid ${theme.palette.border.main}`,

  "& span": {
    fontSize: "13px",
    fontWeight: 500,
    color: theme.palette.text.primary,
    flexShrink: 0,

    [theme.breakpoints.down("sm")]: {
      fontSize: "10px",
    },
  },
});

export const CryptocurrencyDividerLine = styled(Box)({
  width: "1px",
  height: "20px",
  background: "#D9D9D9",
  marginRight: "8px",
});
