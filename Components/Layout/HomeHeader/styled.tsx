import { MenuRounded } from "@mui/icons-material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  styled,
  Typography,
} from "@mui/material";

export const FixedHeader = styled("header")(({ theme }) => ({
  position: "fixed",
  // top shifts down by the sticky promo bar height (set via a CSS var by
  // StickyPromoBar). When the promo bar is dismissed or absent, --dyno-promo-h
  // is 0px so the header sits flush against the viewport top.
  top: "var(--dyno-promo-h, 0px)",
  left: 0,
  right: 0,
  zIndex: 1400,
  backgroundColor: theme.palette.background.paper,
  transition: "transform 0.3s ease-in-out, top 0.25s ease, background-color 0.3s ease",
  width: "100%",
}));

export const HeaderContainer = styled(Box)(({ theme }) => ({
  height: 68,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: theme.palette.background.paper,
  maxWidth: 1280,
  margin: "0 auto",

  [theme.breakpoints.down("md")]: {
    padding: "0 16px",
  },

  ".logo": {
    cursor: "pointer",
    userSelect: "none",
    [theme.breakpoints.down("md")]: {
      width: "100px",
      height: "auto",
    },
  },
}));

export const HeaderDivider = styled(Divider)(({ theme }) => ({
  borderColor: theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#E7E8EF"),
}));

export const ClickableLogo = styled(Button)({
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
  outline: "none",
  border: "none",
  background: "transparent",
  padding: 0,
});

export const LeftGroup = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "100px",
});

export const RightGroup = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "12px",
});

export const NavLinks = styled("nav")(({ theme }) => ({
  display: "flex",
  gap: 32,
  letterSpacing: "0px",
  fontFamily: "var(--font-sans)",
  alignItems: "center",
  justifyContent: "space-between",

  "@media (max-width: 1025px)": {
    display: "none",
  },

  button: {
    textTransform: "none",
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: "24px",
    letterSpacing: "0px",
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.secondary,
    padding: "6px 4px",

    "&:hover": {
      background: "transparent",
      color: theme.palette.primary.main,
    },
  },
}));

export const Actions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "14px",

  ".signin": {
    textTransform: "none",
    fontSize: "15px",
    fontWeight: 500,
    color: theme.palette.text.primary,
    lineHeight: "22px",
    fontFamily: "var(--font-sans)",
    whiteSpace: "nowrap",

    "&:hover": {
      background: "transparent",
      color: theme.palette.primary.main,
    },
  },
}));

export const DesktopLanguageWrapper = styled(Box)({
  marginRight: "8px",
  display: "flex",
  alignItems: "center",
  "& .MuiButtonBase-root, & .MuiInputBase-root, & .MuiOutlinedInput-root": {},
});

export const MobileLanguageWrapper = styled(Box)({
  display: "none",
  alignItems: "center",

  "@media (max-width: 899px)": {
    display: "flex",
  },
});

export const MobileMenuButton = styled(IconButton)(() => ({
  display: "none",
  padding: "5px 0px 0px 0px",

  "@media (max-width: 1025px)": {
    display: "block",
  },
}));

export const MenuOpenIcon = styled(MenuRounded)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 24,
}));

export const MenuCloseIcon = styled(CloseRoundedIcon)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: 24,
}));

export const MobileMenuDrawer = styled(Drawer)(({ theme }) => ({
  display: "none",
  zIndex: 1200,

  "& .MuiDrawer-paper": {
    top: "64px !important",
    height: "calc(100vh - 64px) !important",
    width: "100%",
    maxWidth: "320px",
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    border: "none !important",
  },

  "& .MuiBackdrop-root": {
    backgroundColor: theme.palette.mode === "dark" ? "#0B0D17CC" : "#FFFFFFCC",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },

  "@media (max-width: 1025px)": {
    display: "block",
  },
}));

export const MobileDrawer = styled(Box)(({ theme }) => ({
  height: "100%",
  backgroundColor: theme.palette.mode === "dark" ? "#0B0D17" : "transparent",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}));

export const MobileNavContent = styled(Box)({
  marginTop: "51px",
  padding: "0 16px",
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "36.29px",
  alignItems: "flex-end",
});

export const MobileNavItem = styled(Typography)(({ theme }) => ({
  fontSize: "16.5px",
  fontWeight: 500,
  lineHeight: "24px",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  cursor: "pointer",
  transition: "color 0.2s ease",
  textAlign: "right",
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
  outline: "none",
  border: "none",
  background: "transparent",
  padding: 0,
}));

export const StyledSignInButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  fontSize: "16px",
  fontWeight: 500,
  lineHeight: "24px",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  whiteSpace: "nowrap",
  padding: "6px 4px",

  "&:hover": {
    background: "transparent",
    color: theme.palette.primary.main,
  },
}));

export const StyledGetStartedButton = styled(Box)({
  borderRadius: 8,
  minWidth: 98,
});
