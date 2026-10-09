import { SD_GOLD, SD_GOLD_DARK, SD_GOLD_GLOW, SD_INK, SD_BORDER } from "./sdTheme";

// minHeight 44 = comfortable touch target (Apple HIG / Material) on every deal
// action button + the mobile sticky CTA, which the UX audit flagged at 24–32px.
export const primaryBtn = { textTransform: "none", fontWeight: 900, borderRadius: 99, minHeight: 44, color: SD_INK, backgroundColor: SD_GOLD, boxShadow: `0 8px 20px ${SD_GOLD_GLOW}`, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;
export const ghostBtn = { textTransform: "none", fontWeight: 700, borderRadius: 99, minHeight: 44 } as const;
export const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` } as const;
