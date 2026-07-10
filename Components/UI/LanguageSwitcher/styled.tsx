import { Box, styled, Typography } from "@mui/material";

export const WrapperBox = styled(Box)(() => ({
  position: "relative",
  width: "fit-content",
}));

export const TriggerBox = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E4E4E7"}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderRadius: 8,
  cursor: "pointer",
  backgroundColor: theme.palette.background.paper,

  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const TriggerLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const TriggerRight = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 14,

  [theme.breakpoints.down("md")]: {
    gap: 10,
  },
}));

export const TriggerDivider = styled(Box)(({ theme }) => ({
  width: 1,
  background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.16)" : "#D9D9D9",
}));

export const DropdownContainer = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: 0,
  right: 0,
  width: 196,
  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E4E4E7"}`,
  backgroundColor: theme.palette.background.paper,
  zIndex: 2000,
  padding: "10px 8px 8px",
  boxShadow: theme.palette.mode === "dark"
    ? "0px 12px 32px rgba(0, 0, 0, 0.5)"
    : "0px 12px 32px rgba(0, 0, 0, 0.10)",
  borderRadius: 10,
}));

export const DropdownHeader = styled(Box)(() => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0px 8px 12px",
  cursor: "pointer",
}));

export const HeaderSelectedLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const HeaderRight = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 14,
}));

export const HeaderDivider = styled(Box)(({ theme }) => ({
  width: 1,
  background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.16)" : "#ddd",
  height: 16,

  [theme.breakpoints.down("md")]: {
    height: 14,
  },
}));

export const DropdownListItem = styled(Box)(({ theme }) => ({
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderRadius: 8,
  cursor: "pointer",
  marginBottom: 4,
  transition: "background 0.2s ease",

  "&[data-selected='true']": {
    background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.15)" : "rgba(10,10,10,0.07)",
  },

  "&:hover": {
    background: theme.palette.mode === "dark" ? "rgba(204,255,0,0.1)" : "rgba(10,10,10,0.045)",
  },

  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ListItemLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const LangTextDesktop = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  lineHeight: 1.2,
  letterSpacing: 0,
  paddingTop: 0,
  color: theme.palette.text.primary,

  [theme.breakpoints.down("md")]: {
    lineHeight: "100%",
    paddingTop: 2.5,
  },
}));

export const LangTextMobile = styled(Typography)(({ theme }) => ({
  fontSize: 10.5,
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  lineHeight: "100%",
  letterSpacing: 0,
  paddingTop: 2.5,
  color: theme.palette.text.primary,

  [theme.breakpoints.up("md")]: {
    fontSize: 15,
    lineHeight: 1.2,
    paddingTop: 0,
  },
}));

export const ExpandIconBox = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
}));

export const CheckIconBox = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  minWidth: 11,
  justifyContent: "flex-end",
}));
