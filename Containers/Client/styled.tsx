import { Box, styled, Typography } from "@mui/material";

export const FixedBottomWrapper = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  right: 0,
  padding: theme.spacing(1.5),
  background: "transparent",
  zIndex: 999,
}));

export const PageHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    justifyContent: "start",
    gap: theme.spacing(8),
  },
}));

export const MainPageHeader = styled(Box)(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 10,
  backgroundColor: theme.palette.secondary.main,
  display: "flex",
  flexDirection: "column",
}));

export const PageHeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: "24px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-hero), var(--font-sans)",
  letterSpacing: "-0.01em",
  lineHeight: 1.25,
  mb: 1,
  [theme.breakpoints.down("md")]: {
    fontSize: "19px",
  },
}));

export const PageHeaderDescription = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  lineHeight: 1.2,
  fontFamily: "UrbanistMedium",
  paddingLeft: 0,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));
