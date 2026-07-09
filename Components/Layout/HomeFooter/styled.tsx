import { Box, Typography, styled } from "@mui/material";

export const FooterWrapper = styled("footer")(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#0B0D17" : "#131520",
  marginTop: "auto",
  paddingTop: 64,
  paddingBottom: 64,
  display: "flex",
  justifyContent: "center",
  paddingLeft: 0,
  paddingRight: 0,

  [theme.breakpoints.down("md")]: {
    paddingBottom: 17,
    paddingLeft: 15,
    paddingRight: 15,
  },
}));

export const FooterContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  minHeight: 222,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),

  [theme.breakpoints.down("md")]: {
    minHeight: 390,
  },
}));

export const TopSection = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: 16,
});

export const LogoWrapper = styled(Box)({
  cursor: "pointer",
  display: "inline-flex",
});

export const ContentRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  gap: theme.spacing(6),

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

export const DescriptionText = styled(Typography)(({ theme }) => ({
  minWidth: 316,
  color: theme.palette.common.white,
  opacity: 0.6,
  fontSize: 14,
  maxWidth: 420,
  fontFamily: "var(--font-sans)",
  whiteSpace: "nowrap",

  [theme.breakpoints.down("md")]: {
    whiteSpace: "normal",
  },
}));

export const NavigationList = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: theme.spacing(3),

  [theme.breakpoints.down("lg")]: {
    gap: 27,
  },
}));

export const BottomSection = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
  paddingTop: theme.spacing(4),

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 28,
  },
}));

export const CopyrightText = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  opacity: 0.6,
  fontSize: 14,
  fontFamily: "var(--font-sans)",
}));

export const SocialsWrapper = styled(Box)({
  display: "flex",
  gap: 16,
});

export const SocialItem = styled(Box)({
  background: "rgba(255, 255, 255, 0.1)",
  padding: 10,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background 0.2s ease",

  "&:hover": {
    background: "rgba(255, 255, 255, 0.2)",
  },
});

export const Navigation = styled("nav")({
  color: "#FCFBF8",
  textDecoration: "underline",
  fontSize: 14,
  letterSpacing: 0,
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  lineHeight: "20px",
});
