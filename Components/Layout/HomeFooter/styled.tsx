import { Box, Typography, styled } from "@mui/material";
import { BRAND_ACCENT } from "@/constants/theme";

const INDIGO = BRAND_ACCENT;

export const FooterWrapper = styled("footer")(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    overflow: "hidden",
    marginTop: "auto",
    paddingTop: 72,
    // Reserve the fixed language-onboarding bar's footprint (--dp-lang-bar,
    // 0px when hidden) so the bar never overlaps the footer's bottom row /
    // language control. The bar's upward dropdown (zIndex 1600) already clears it.
    paddingBottom: "calc(40px + var(--dp-lang-bar, 0px))",
    display: "flex",
    justifyContent: "center",
    backgroundColor: dark ? "#0B0F19" : "#F6F6F8",
    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`,

    // Subtle indigo bloom at the top edge (dark mode only) to echo the header.
    "&::before": dark
      ? {
          content: '""',
          position: "absolute",
          top: -150,
          left: "50%",
          transform: "translateX(-50%)",
          width: 720,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(79,70,229,0.18), transparent)",
          pointerEvents: "none",
        }
      : {},

    [theme.breakpoints.down("md")]: {
      paddingTop: 48,
      paddingBottom: "calc(28px + var(--dp-lang-bar, 0px))",
      paddingLeft: 16,
      paddingRight: 16,
    },
  };
});

export const FooterContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 1280,
  display: "flex",
  flexDirection: "column",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

export const LogoWrapper = styled(Box)({
  cursor: "pointer",
  display: "inline-flex",
});

export const SocialsWrapper = styled(Box)({
  display: "flex",
  gap: 12,
});

export const SocialItem = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)",
    border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
    transition: "all 0.2s ease",
    // Source icons are white; recolour to dark on the light footer.
    "& img": {
      filter: dark ? "none" : "brightness(0) saturate(100%) opacity(0.62)",
      transition: "filter 0.2s ease",
    },
    "&:hover": {
      background: dark ? "rgba(79,70,229,0.22)" : "rgba(79,70,229,0.10)",
      borderColor: INDIGO,
      transform: "translateY(-2px)",
      "& img": { filter: dark ? "none" : "brightness(0) saturate(100%) opacity(0.9)" },
    },
  };
});

export const BottomSection = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`,
    paddingTop: theme.spacing(3),

    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 20,
    },
  };
});

export const CopyrightText = styled(Typography)(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.5)" : "#71717A",
  fontSize: 13.5,
  fontFamily: "var(--font-body)",
}));
