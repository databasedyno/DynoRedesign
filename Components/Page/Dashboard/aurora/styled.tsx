// Aurora dashboard primitives (2026-07-18) — shared building blocks for
// the redesigned /dashboard overview. Tokens sync with theme.v3.ts.
import { Box, Typography, styled } from "@mui/material";

export const CORAL = "#FF5B49";
export const CORAL_DEEP = "#E33F2E";
export const VIOLET = "#7C5CFF";
export const SKY = "#4FD1FF";
export const VOLT = "#CCFF00";
export const VOLT_INK = "#5A6B00";
export const AURORA_GRADIENT =
  "linear-gradient(135deg, #FF5B49 0%, #7C5CFF 55%, #4FD1FF 100%)";
export const AURORA_GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(255,91,73,0.14) 0%, rgba(124,92,255,0.14) 55%, rgba(79,209,255,0.14) 100%)";

// Base surface card. Uses 1px hairline border + subtle hover lift.
export const SurfaceCard = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    borderRadius: 20,
    padding: 24,
    background: dark ? "#15151B" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)"}`,
    transition:
      "border-color 220ms ease, box-shadow 240ms ease, transform 240ms ease",
    [theme.breakpoints.down("sm")]: {
      padding: 18,
      borderRadius: 16,
    },
  };
});

// Mono eyebrow label — "LIVE · ACTIVITY", "30-DAY NET VOLUME", etc.
export const Eyebrow = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-tech)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : "#71717A",
  lineHeight: 1.4,
}));

// Big Unbounded aurora-gradient number. Fluid: 40-88px depending on viewport.
export const HeroNumber = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-hero)",
  fontWeight: 700,
  fontSize: "clamp(40px, 8vw, 72px)",
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  // Aurora gradient text
  background: AURORA_GRADIENT,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(36px, 12vw, 48px)",
  },
}));

// Section title in Unbounded — for card titles inside SurfaceCards.
export const CardTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-hero)",
  fontSize: 20,
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
}));

// Body text
export const Body = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-body)",
  fontSize: 14.5,
  lineHeight: 1.55,
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.72)" : "#3F3F46",
}));

// Small mono label (chip / metadata)
export const MonoLabel = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-tech)",
  fontSize: 12,
  fontWeight: 500,
  color: theme.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : "#71717A",
  letterSpacing: "0.02em",
}));

// Delta chip — positive (volt) / negative (coral) / neutral (mono)
interface DeltaChipProps {
  variant?: "positive" | "negative" | "neutral";
}
export const DeltaChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant",
})<DeltaChipProps>(({ theme, variant = "neutral" }) => {
  const dark = theme.palette.mode === "dark";
  const map = {
    positive: {
      bg: "rgba(204,255,0,0.14)",
      color: dark ? VOLT : VOLT_INK,
      border: "rgba(204,255,0,0.28)",
    },
    negative: {
      bg: "rgba(255,91,73,0.12)",
      color: CORAL,
      border: "rgba(255,91,73,0.28)",
    },
    neutral: {
      bg: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.04)",
      color: dark ? "rgba(255,255,255,0.7)" : "#3F3F46",
      border: dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)",
    },
  };
  const style = map[variant];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 9px",
    borderRadius: 999,
    background: style.bg,
    color: style.color,
    border: `1px solid ${style.border}`,
    fontFamily: "var(--font-tech)",
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "0.01em",
  };
});

// Coral CTA chip used across attention cards
export const CoralChip = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 999,
  background: CORAL,
  color: "#FFFFFF",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(255,91,73,0.28)",
  transition: "transform 180ms ease, box-shadow 220ms ease, background 200ms ease",
  minHeight: 36,
  "&:hover": {
    background: CORAL_DEEP,
    transform: "translateY(-1px)",
    boxShadow: "0 8px 18px rgba(255,91,73,0.36)",
  },
});

// Volt-lime ghost link used for "See all →" style secondary actions
export const VoltLink = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: theme.palette.mode === "dark" ? VOLT : VOLT_INK,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.005em",
  transition: "opacity 200ms ease, transform 200ms ease",
  "&:hover": {
    opacity: 0.85,
    transform: "translateX(2px)",
  },
}));

// Status pill for transaction rows. Volt=settled, sky=confirming, mono=pending, coral=failed.
interface StatusPillProps {
  variant?: "settled" | "pending" | "confirming" | "failed";
}
export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant",
})<StatusPillProps>(({ theme, variant = "pending" }) => {
  const dark = theme.palette.mode === "dark";
  const map: Record<string, { bg: string; color: string; dot: string; border: string }> = {
    settled: {
      bg: "rgba(204,255,0,0.14)",
      color: dark ? VOLT : VOLT_INK,
      dot: VOLT,
      border: "rgba(204,255,0,0.28)",
    },
    confirming: {
      bg: "rgba(79,209,255,0.14)",
      color: dark ? SKY : "#0C6E8A",
      dot: SKY,
      border: "rgba(79,209,255,0.28)",
    },
    pending: {
      bg: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.04)",
      color: dark ? "rgba(255,255,255,0.7)" : "#3F3F46",
      dot: dark ? "rgba(255,255,255,0.5)" : "#71717A",
      border: dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)",
    },
    failed: {
      bg: "rgba(255,91,73,0.12)",
      color: CORAL,
      dot: CORAL,
      border: "rgba(255,91,73,0.28)",
    },
  };
  const s = map[variant];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 999,
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
    fontFamily: "var(--font-tech)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    lineHeight: 1.3,
    "& .dot": {
      width: 5,
      height: 5,
      borderRadius: 999,
      background: s.dot,
    },
  };
});

// Coin badge with aurora ring — 32px circle for tx row icons.
export const CoinBadge = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: theme.palette.mode === "dark" ? "#1D1D24" : "#F3EFEA",
  border: "1.5px solid transparent",
  backgroundClip: "padding-box",
  position: "relative",
  flexShrink: 0,
  fontFamily: "var(--font-tech)",
  fontSize: 12,
  fontWeight: 600,
  color: theme.palette.mode === "dark" ? "#F5F5F5" : "#0A0A0A",
  overflow: "hidden",

  "&::before": {
    content: '""',
    position: "absolute",
    inset: -1.5,
    borderRadius: "50%",
    padding: 1.5,
    background: AURORA_GRADIENT,
    WebkitMask:
      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    pointerEvents: "none",
  },
}));
