import { Box, Button, Typography, TypographyProps } from "@mui/material";
import { keyframes, styled } from "@mui/material/styles";
import {
  BG0,
  BG1,
  BLUE,
  BLUE_BRIGHT,
  BLUE_GLOW,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  INK0,
  INK2,
  LINE,
  LINE2,
} from "./theme.v4";

export const riseIn = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const SectionV4 = styled(Box)({
  position: "relative",
  width: "100%",
  background: BG0,
  overflow: "hidden",
});

export const ShellV4 = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 1240,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  [theme.breakpoints.up("md")]: {
    paddingLeft: theme.spacing(5),
    paddingRight: theme.spacing(5),
  },
}));

// Small caps mono eyebrow with a blue tick square — institutional marker.
export const EyebrowV4 = styled(Typography)({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontFamily: FONT_MONO,
  fontSize: 11.5,
  fontWeight: 500,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: BLUE_BRIGHT,
  "&::before": {
    content: '""',
    width: 7,
    height: 7,
    background: BLUE,
    boxShadow: `0 0 12px ${BLUE_GLOW}`,
    flexShrink: 0,
  },
});

export const DisplayXL = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: "clamp(44px, 5.4vw, 84px)",
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  color: INK0,
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(38px, 10vw, 52px)",
  },
}));

export const DisplayL = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  fontSize: "clamp(32px, 3.6vw, 54px)",
  lineHeight: 1.06,
  letterSpacing: "-0.025em",
  color: INK0,
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(28px, 8vw, 38px)",
  },
}));

export const LeadV4 = styled(Typography)<TypographyProps>({
  fontFamily: FONT_BODY,
  fontSize: 17,
  lineHeight: 1.65,
  color: INK2,
});

export const PrimaryBtnV4 = styled(Button)({
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 15.5,
  textTransform: "none",
  color: "#FFFFFF",
  background: BLUE,
  borderRadius: 999,
  padding: "13px 28px",
  boxShadow: `0 0 0 0 ${BLUE_GLOW}`,
  transition: "background-color .22s ease, box-shadow .28s ease, transform .22s ease",
  "&:hover": {
    background: BLUE_BRIGHT,
    boxShadow: `0 8px 34px -6px ${BLUE_GLOW}`,
    transform: "translateY(-1px) scale(1.015)",
  },
});

export const GhostBtnV4 = styled(Button)({
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 15.5,
  textTransform: "none",
  color: INK0,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${LINE2}`,
  borderRadius: 999,
  padding: "12px 26px",
  transition: "border-color .22s ease, background-color .22s ease, transform .22s ease",
  "&:hover": {
    background: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.34)",
    transform: "translateY(-1px)",
  },
});

export const CardV4 = styled(Box)({
  position: "relative",
  background: BG1,
  border: `1px solid ${LINE}`,
  borderRadius: 16,
  transition: "transform .25s ease, border-color .25s ease, box-shadow .25s ease",
  "&:hover": {
    transform: "translateY(-4px)",
    borderColor: LINE2,
    boxShadow: "0 18px 44px -18px rgba(0,0,0,0.8)",
  },
});
