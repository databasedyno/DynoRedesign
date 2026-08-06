import styled from "@emotion/styled";
import { Box } from "@mui/material";
import { styled as muiStyled } from "@mui/material/styles";
import Image from "next/image";

export const CurrencyTrigger = muiStyled(Box, {
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
  gap: "4px",
  padding: "8px",
  borderRadius: "6px",
  border: "1px solid",
  borderColor: error ? theme.palette.error.main : theme.palette.border.main,
  cursor: "pointer",
  background: error ? theme.palette.error.main : theme.palette.background.paper,
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
  [theme.breakpoints.down("md")]: {
    gap: "3px",
  },
}));

export const CurrencyFlag = styled(Image)({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  // md breakpoint (MUI default 900px) — inlined so this emotion-styled element
  // no longer needs the static theme import.
  "@media (max-width:899.95px)": {
    width: "10px",
    height: "10px",
  },
});

export const CurrencyText = muiStyled('span', {
  shouldForwardProp: (prop) => prop !== 'isMobile',
})<{ isMobile?: boolean }>(({ theme, isMobile }: any) => ({
  fontSize: isMobile ? "10px" : "13px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  lineHeight: 1.2,
}));

export const CurrencyDropdown = muiStyled(Box)(({ theme }) => ({
  padding: "8px",
  background: theme.palette.background.paper,
  overflow: "auto",
  maxHeight: "200px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
}));
