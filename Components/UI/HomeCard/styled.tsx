import { getBrowser } from "@/hooks/useDevice";
import { Box, Card, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { BRAND_ACCENT, brandFg } from "@/constants/theme";

interface StyledCardProps {
  height?: number | string;
  width?: number | string;
}

// HomeCard
export const StyledCard = styled(Card)(({ theme }) => {
  const { isDesktopSafari } =
    typeof window !== "undefined" ? getBrowser() : { isDesktopSafari: false };
  const isDark = theme.palette.mode === "dark";

  const bgColor = isDark ? "#141625" : "#FFFFFF";
  const glowColor = isDark
    ? "rgba(106,123,255,0.25)"
    : "rgba(0,4,255,0.3)";
  const fadeTo = isDark ? "#141625" : "#FFFFFF";

  return {
    backgroundColor: bgColor,
    border: `1px solid ${theme.palette.border?.main || (isDark ? "#2A2D42" : "#E7E8EF")}`,
    boxShadow: "none !important",
    borderRadius: "20px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",

    "&::before": {
      content: '""',
      position: "absolute",
      bottom: 0,
      top: isDesktopSafari ? "180px" : "220px",
      width: "100%",
      height: "120%",
      background: isDesktopSafari
        ? `radial-gradient(ellipse at bottom, ${glowColor} 0%, ${fadeTo} 70%)`
        : `radial-gradient(at center bottom, ${isDark ? "#6A7BFF3D" : `${BRAND_ACCENT}4D`}, ${fadeTo})`,
      filter: isDesktopSafari ? "blur(140px)" : "blur(100px)",
      opacity: isDesktopSafari ? 0.7 : 0.5,
      zIndex: 0,
      pointerEvents: "none",
    },

    "& > *": {
      position: "relative",
      zIndex: 1,
    },

    [theme.breakpoints.down("md")]: {
      height: "auto",
    },
  };
});

export const CardBody = styled(Box)(() => ({
  flex: 1,
}));

export const GoLiveCount = styled(Typography)(({ theme }) => ({
  fontSize: "48px",
  fontWeight: 500,
  lineHeight: "48px",
  letterSpacing: 0,
  fontFamily: "var(--font-sans)",
  color: brandFg(theme.palette.mode === "dark"),
  opacity: 0.2,
}));

export const FeatureTitle = styled(Typography)(({ theme }) => ({
  fontSize: "18px",
  fontWeight: 500,
  lineHeight: "28px",
  letterSpacing: 0,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
}));

export const GoLiveDescription = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

export const FeatureIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  minHeight: "48px",
  minWidth: "48px",
  borderRadius: "16px",
  background: theme.palette.background.default,
  color: theme.palette.mode === "dark" ? "#A5B4FC" : BRAND_ACCENT,
  "& img, & svg": {
    filter: theme.palette.mode === "dark" ? "brightness(1.8) saturate(1.2)" : "none",
  },
}));

export const WhyChooseUsCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  textAlign: "center",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  minWidth: "328px",
  minHeight: "218px",
  padding: "25px",
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#E7E8EF")}`,
  boxShadow: "none !important",
  borderRadius: "20px",
  margin: "0 auto",
  [theme.breakpoints.up("md")]: {
    minWidth: "294px",
    maxWidth: "294px",
    minHeight: "218px",
    maxHeight: "218px",
  },
}));

export const WhyChooseDynoPayTitle = styled(Typography)(({ theme }) => ({
  fontSize: "18px",
  fontWeight: 500,
  lineHeight: "28px",
  fontStyle: "semibold",
  letterSpacing: 0,
  textAlign: "center",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
}));

export const WhyChooseDynoPayDescription = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  textAlign: "center",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

export const WhyChooseDynoPayIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "56px",
  height: "56px",
  minHeight: "56px",
  minWidth: "56px",
  borderRadius: "20px",
  background: theme.palette.mode === "dark" ? "rgba(106,123,255,0.1)" : `${BRAND_ACCENT}1A`,
  color: theme.palette.mode === "dark" ? "#A5B4FC" : BRAND_ACCENT,
  "& img, & svg": {
    filter: theme.palette.mode === "dark" ? "brightness(1.8) saturate(1.2)" : "none",
  },
}));

export const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2.5, 2.5, 0, 2.5),
  gap: theme.spacing(2),
  position: "relative",
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(2, 2, 0, 2),
  },
}));

export const HeaderContent = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flex: 1,
});

export const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "15px",
  },
}));

export const HeaderIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: theme.palette.grey[100],
  color: theme.palette.text.secondary,
  "& svg": {
    fontSize: "20px",
  },
}));

export const CardFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#E9ECF2")}`,
  gap: theme.spacing(1.5),
}));

export const HeaderSubTitle = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
}));

export const SuccessChip = styled(Box)(({ theme }) => ({
  backgroundColor: "#22C55E1A",
  height: "50px",
  width: "100%",
  border: "1px solid",
  borderColor: "#22C55E33",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
}));

export const TypographyTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontFamily: "OutfitSemiBold",
  lineHeight: "24px",
  letterSpacing: 0,
  color: theme.palette.text.primary,
}));

export const TypographyDescription = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  color: theme.palette.text.secondary,
}));

export const TypographyTime = styled(Typography)(({ theme }) => ({
  fontSize: "12px",
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  lineHeight: "16px",
  letterSpacing: 0,
  color: theme.palette.text.secondary,
}));
