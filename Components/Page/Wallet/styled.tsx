import { Box, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const HeaderIcon = styled(IconButton)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: "50%",
  border: `1px solid ${theme.palette.border.main}`,
  backgroundColor: theme.palette.secondary.light,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "&:hover": {
    backgroundColor: theme.palette.secondary.dark,
  },
  "& img": {
    objectFit: "contain",
    height: 24,
    width: 24,
  },
  [theme.breakpoints.down("md")]: {
    width: 30,
    height: 30,
    "& img": {
      height: 14,
      width: 14,
    },
  },
}));

export const WalletHeaderAction = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  backgroundColor: theme.palette.secondary.light,
  padding: "6px 8px",
  borderRadius: 50,
  border: `1px solid ${theme.palette.border.main}`,
  textTransform: "capitalize",
  fontFamily: "UrbanistMedium",
  position: "absolute",
  top: 0,
  right: 0,
  zIndex: 1,

  "& img": {
    objectFit: "contain",
    height: 18,
    width: 18,
  },
  "& span": {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: "18px",
    letterSpacing: "0",
    fontFamily: "UrbanistMedium",
    color: theme.palette.text.secondary,
  },
  [theme.breakpoints.down("md")]: {
    gap: 4,
    padding: "6px 5px",
    "& img": {
      height: 14,
      width: 14,
    },
    "& span": {
      fontSize: 10,
      lineHeight: "100%",
    },
  },
}));

export const WalletCardBody = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 20,
  [theme.breakpoints.down("md")]: {
    // H3 (2026-07-05): tightened mobile gaps between the 3 rows
    // (address / total-processed / actions) to ~half so the wallet card
    // is significantly shorter — was ~180px tall on 390px viewport, now ~120px.
    gap: 8,
  },
}));

export const WalletCardBodyRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: "10px",
  [theme.breakpoints.down("md")]: {
    gap: "8px",
  },
}));

export const WalletCopyButton = styled(IconButton)(({ theme }) => ({
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
    width: "32px",
    height: "32px",
    padding: "6px",
  },
}));

export const WalletLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  "& img": {
    width: 16,
    height: 16,
    filter: theme.palette.mode === "dark"
      ? "brightness(0) saturate(100%) invert(70%)"
      : "none",
  },
  "& span": {
    fontSize: "15px",
    fontWeight: 500,
    color: theme.palette.text.secondary,
    lineHeight: "18px",
    fontFamily: "UrbanistMedium",
    [theme.breakpoints.down("md")]: {
      fontSize: "13px",
      lineHeight: "16px",
    },
  },
}));

export const WalletEditButton = styled(IconButton)(({ theme }) => ({
  width: 40,
  height: 40,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.text.primary}`,
  borderRadius: "6px",
  "&:hover": {
    backgroundColor: theme.palette.background.paper,
  },
  [theme.breakpoints.down("md")]: {
    width: 32,
    height: 32,
  },
}));

export const SetupWarnnigContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
  padding: theme.spacing("7px", 1.8),
  borderRadius: "7px",
  border: `1px solid ${theme.palette.border.main}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: theme.spacing(1.5),
}));
