import styled from "@emotion/styled";
import { Box } from "@mui/material";
import { styled as muiStyled } from "@mui/material/styles";
import Image from "next/image";

// All colors resolve from the ACTIVE MUI theme (appTheme = black + lime, with
// proper dark-mode tokens) via the theme prop. Previously this file imported a
// STATIC legacy indigo theme, which made the picker render washed-out / illegible
// (dark text on dark, white trigger box) in dark mode.
const chipSurface = (mode: string) =>
  mode === "dark" ? "rgba(204,255,0,0.10)" : "rgba(10,10,10,0.05)";

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
  borderRadius: "10px",
  border: "1px solid",
  borderColor: error ? theme.palette.error.main : theme.palette.divider,
  cursor: "pointer",
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  width: fullWidth ? "100%" : "auto",
  // Larger, thumb-friendly tap targets.
  height: isMobile ? "44px" : "48px",
  minHeight: isMobile ? "44px" : "48px",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 1px 2px rgba(0,0,0,0.4)"
      : "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
  fontFamily: "var(--font-sans)",
  "&:hover": {
    borderColor: error ? theme.palette.error.main : theme.palette.primary.main,
  },
  "&:focus": {
    outline: "none",
    borderColor: error ? theme.palette.error.main : theme.palette.primary.main,
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 0 0 3px rgba(204,255,0,0.20)"
        : "0 0 0 3px rgba(10,10,10,0.08)",
  },
}));

export const CryptocurrencyIcon = styled(Image)({
  objectFit: "contain",
  flexShrink: 0,
});

export const CryptocurrencyText = styled.span<{ isMobile?: boolean }>(
  ({ theme }: any) => ({
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: theme?.palette?.text?.primary,
    lineHeight: "100%",
    letterSpacing: 0,
    ["@media (max-width:600px)"]: {
      fontSize: "13px",
    },
  }),
);

export const CryptocurrencyDropdown = styled(Box)(({ theme }: any) => ({
  padding: "8px",
  background: theme.palette.background.paper,
  overflow: "auto",
  maxHeight: "200px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
}));

export const IconChip = styled(Box)(({ theme }: any) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 9px",
  borderRadius: "999px",
  background: chipSurface(theme.palette.mode),
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 600,
  color: theme.palette.text.primary,
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,

  "& span": {
    fontSize: "13px",
    fontWeight: 600,
    color: theme.palette.text.primary,
    flexShrink: 0,

    ["@media (max-width:600px)"]: {
      fontSize: "10px",
    },
  },
}));

export const CryptocurrencyDividerLine = styled(Box)(({ theme }: any) => ({
  width: "1px",
  height: "20px",
  background: theme.palette.divider,
  marginRight: "8px",
}));
