import { Box, Typography, styled } from "@mui/material";
import { PANEL } from "@/Components/Page/Home/v8/kit";

/* v8 footer: always-dark near-black panel in both themes (matches the v8 dark bands). */
export const FooterWrapper = styled("footer")(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  marginTop: "auto",
  paddingTop: 88,
  // Reserve the fixed language-onboarding bar's footprint (--dp-lang-bar, 0px when hidden).
  paddingBottom: "calc(40px + var(--dp-lang-bar, 0px))",
  display: "flex",
  justifyContent: "center",
  backgroundColor: PANEL.bg,
  color: PANEL.ink,
  borderTop: `1px solid ${PANEL.line}`,

  [theme.breakpoints.down("md")]: {
    paddingTop: 56,
    paddingBottom: "calc(28px + var(--dp-lang-bar, 0px))",
    paddingLeft: 16,
    paddingRight: 16,
  },
}));

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
  gap: 10,
});

export const SocialItem = styled(Box)({
  width: 38,
  height: 38,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  background: PANEL.surface,
  border: `1px solid ${PANEL.line}`,
  transition: "background-color 200ms ease, border-color 200ms ease, transform 200ms ease",
  "& img": { opacity: 0.75, transition: "opacity 200ms ease" },
  "&:hover": {
    background: PANEL.goldSoft,
    borderColor: PANEL.gold,
    transform: "translateY(-2px)",
    "& img": { opacity: 1 },
  },
});

export const BottomSection = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: `1px solid ${PANEL.line}`,
  paddingTop: theme.spacing(3),

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 20,
  },
}));

export const CopyrightText = styled(Typography)({
  color: PANEL.ink3,
  fontSize: 13.5,
  fontFamily: "var(--font-body)",
});
