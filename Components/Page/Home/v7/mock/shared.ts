import { FONT_BODY, FONT_TECH } from "../../v3/theme.v3";
import { ON_YELLOW, YELLOW } from "@/constants/publicTheme";

/* Product mockups are always rendered in Bybit-black, regardless of page theme. */
export const GREEN = "#2EBD85";
export const M = {
  bg: "#0F1013",
  panel: "#16171B",
  panelAlt: "#1C1D22",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",
  ink: "#FFFFFF",
  ink2: "#ADB1B8",
  ink3: "#81858C",
  yellow: YELLOW,
  onYellow: ON_YELLOW,
} as const;

export const MERCHANT = "Northwind Studio";
export const REF = "INV-2026-0412";
export const AMOUNT_USD = "$148.00";
export const AMOUNT_COIN = "148.00 USDT";

/** Glossy black bezel — a thin gradient frame with a top highlight and deep shadow. */
export const glossFrameSx = {
  position: "relative" as const,
  borderRadius: "20px",
  p: "6px",
  background: "linear-gradient(180deg, #24252B 0%, #0D0D10 100%)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 60px 100px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.6)",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "20px",
    pointerEvents: "none",
    background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, transparent 48%)",
  },
};

export const screenSx = { position: "relative" as const, borderRadius: "14px", background: M.bg, border: `1px solid ${M.line}`, overflow: "hidden" as const };

export const labelSx = { fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: M.ink3, lineHeight: 1.4 };
export const monoSx = { fontFamily: FONT_TECH };
export const textSx = { fontFamily: FONT_BODY };

export const pillSx = (color: string) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  px: 1.1,
  py: 0.35,
  borderRadius: "999px",
  fontFamily: FONT_TECH,
  fontSize: 10.5,
  letterSpacing: "0.08em",
  fontWeight: 600,
  color,
  background: `${color}1F`,
  border: `1px solid ${color}55`,
  "&::before": { content: '""', width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` },
});

export const miniBtnSx = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.5,
  px: 1.5,
  py: 0.75,
  borderRadius: "8px",
  background: M.yellow,
  color: M.onYellow,
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 12.5,
  lineHeight: 1.4,
  whiteSpace: "nowrap" as const,
};
