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

export const CustomSelect = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  cursor: "pointer",
  padding: "0",
  "&:hover": {
    opacity: 0.8,
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
