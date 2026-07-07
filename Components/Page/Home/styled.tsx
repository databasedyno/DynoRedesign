import { Box } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

// HomePage
export const HomeWrapper = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    // paddingTop = header height (65 desktop / 76 mobile) + sticky promo bar height
    // (set via --dyno-promo-h by StickyPromoBar). When the promo bar is dismissed
    // or absent, --dyno-promo-h resolves to 0px and layout is unchanged.
    paddingTop: "calc(65px + var(--dyno-promo-h, 0px))",
    [theme.breakpoints.down("md")]: {
      paddingTop: "calc(76px + var(--dyno-promo-h, 0px))",
    },
    // Bento hero glow — a soft cyber-lime aurora anchored to the top of the page.
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(1280px, 130vw)",
      height: 640,
      pointerEvents: "none",
      zIndex: 0,
      background: isDark
        ? "radial-gradient(60% 60% at 50% 0%, rgba(204,255,0,0.11) 0%, rgba(204,255,0,0.035) 42%, transparent 72%)"
        : "radial-gradient(60% 55% at 50% 0%, rgba(204,255,0,0.20) 0%, rgba(10,10,10,0.03) 46%, transparent 74%)",
    },
  };
});

export const HomeContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

export const HomeFullWidthContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  width: "100%",
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  backgroundColor: alpha(theme.palette.background.default, 0.3),
}));

// HeroSection
export const Root = styled(Box)(() => ({
  width: "100%",
}));

export const TopSection = styled(Box)(({ theme }) => ({
  paddingTop: "32px",
  zIndex: 20,
  [theme.breakpoints.up("sm")]: {
    paddingTop: "48px",
  },
  [theme.breakpoints.up("md")]: {
    paddingTop: "72px",
  },
  [theme.breakpoints.up("lg")]: {
    paddingTop: "88px",
  },
}));

export const TitleArea = styled(Box)(() => ({
  position: "relative",
}));

export const ButtonsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 24,
  justifyContent: "center",
  zIndex: 10,
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    gap: theme.spacing(2),
  },
}));
