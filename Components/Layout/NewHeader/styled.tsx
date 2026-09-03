import { styled } from "@mui/material";

export const HeaderContainer = styled("div")(({ theme }) => ({
  height: "100%",
  top: 0,
  zIndex: 999,
  width: "100%",
  boxShadow: "none",
  background: "transparent",
  display: "flex",
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    gap: "4px",
  },
}));

export const LogoContainer = styled("div")(({ theme }) => ({
  height: "100%",
  width: "clamp(265px, 18vw, 324px)",
  background: theme.palette.background.paper,
  display: "flex",
  alignItems: "center",
  justifyContent: "start",
  padding: "9px 24px 8px ",
  borderRadius: "14px",
  outline: "1px solid ",
  outlineColor: theme?.palette?.border?.main,

  [theme.breakpoints.down("lg")]: {
    display: "none"
  },

  ".logo": {
    cursor: "pointer",
    userSelect: "none",
  },
}));

export const MainContainer = styled("div")(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  background: theme.palette.background.paper,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderRadius: "10px",
  gap: "10px",
  padding: "8px",
  outline: "1px solid",
  outlineColor: theme?.palette?.border?.main,

  [theme.breakpoints.down("md")]: {
    padding: "8px 10px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "6px 3px",
    gap: "4px",
  },
}));

export const RightSection = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "2px",
  },
}));

export const RequiredKYC = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "9px 12px",
  borderRadius: "6px",
  border: "1px solid",
  cursor: "pointer",
  background: theme.palette.background.paper,
  color: theme?.palette?.border?.main,
}));

export const RequiredKYCText = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  paddingLeft: "4px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  fontSize: "15px",
  lineHeight: "1.2",
  letterSpacing: "0",
  fontFamily: "var(--font-sans)",
}));
