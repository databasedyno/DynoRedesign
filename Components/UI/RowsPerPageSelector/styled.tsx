import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const RowsPerPageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 12px",
  border: `1px solid ${theme.palette.border.main}`,
  borderRadius: "8px",
  backgroundColor: theme.palette.background.paper,
  height: "fit-content",
  [theme.breakpoints.down("md")]: {
    padding: "7px 6px",
    gap: "4px",
  },
}));

export const VerticalSeparator = styled(Box)(({ theme }) => ({
  width: "1px",
  height: "20px",
  backgroundColor: theme.palette.border.main,
  margin: "0 4px",
  [theme.breakpoints.down("md")]: {
    height: "16px",
  },
}));

// Trigger is ≥ 32px with a mouse / ≥ 44px on touch (UX audit S18) while the pill keeps its
// height: the extra box is given back with negative margins (natural content height ≈ 18px).
export const CustomSelect = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  cursor: "pointer",
  boxSizing: "border-box",
  minHeight: "32px",
  padding: "0 4px",
  margin: "-7px -4px",
  borderRadius: "6px",
  "&:hover": {
    opacity: 0.8,
    backgroundColor: theme.palette.action.hover,
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: "-2px",
  },
  "@media (pointer: coarse)": {
    minHeight: "44px",
    minWidth: "44px",
    justifyContent: "center",
    margin: "-13px -4px",
  },
}));

export const CustomSelectValue = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-sans)",
  lineHeight: "1",
  minWidth: "20px",
  textAlign: "center",
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));
