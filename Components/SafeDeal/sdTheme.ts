/**
 * SafeDeal (safedeal.sh) brand tokens — a YELLOW + BLACK identity, kept fully
 * separate from Dynopay's shared `BRAND_ACCENT` (Aurora Indigo). NOTHING here is
 * imported by Dynopay surfaces; this file is the single source of truth for the
 * SafeDeal look so the two brands never bleed into each other.
 *
 * Contrast notes: black ink text on SD_GOLD and SD_GOLD on black both clear
 * WCAG AA for large/bold UI text. White text on gold is NOT used (fails AA) —
 * gold buttons always pair with black (SD_INK) text.
 */

/* ---- Gold accent ---- */
export const SD_GOLD = "#FFC61A"; // primary golden-yellow accent
export const SD_GOLD_DARK = "#E5A500"; // hover / pressed
export const SD_GOLD_DEEP = "#B77E00"; // strong border / gold text on light (AA)
export const SD_GOLD_SOFT = "#FFF3CE"; // soft tint background on light surfaces
export const SD_GOLD_GLOW = "rgba(255,198,26,0.30)";

/* ---- Ink (black-dominant) ---- */
export const SD_INK = "#0A0A0B"; // near-black hero / dark canvas
export const SD_INK_SOFT = "#141417"; // raised dark surface (cards on ink)
export const SD_INK_RAISED = "#1C1C21"; // nested dark surface / inputs
export const SD_INK_LINE = "rgba(255,255,255,0.10)"; // hairline border on ink
export const SD_INK_MUTED = "rgba(255,255,255,0.72)"; // muted text on ink (AA)

/* ---- Light surfaces ---- */
export const SD_PAGE = "#FAFAF6"; // warm off-white page background
export const SD_CARD = "#FFFFFF";
export const SD_BORDER = "#ECE9E1"; // warm hairline on light
export const SD_TEXT = "#0A0A0B";
export const SD_TEXT_MUTED = "#6B6B72";

/* ---- Status (kept semantic, tuned to sit on ink or light) ---- */
export const SD_OK = "#12B76A";
export const SD_OK_SOFT = "#6EE7B7";

/** SD_GOLD with an alpha channel appended as hex, e.g. goldAlpha(0.12). */
export const goldAlpha = (a: number): string => {
  const c = Math.min(Math.max(a, 0), 1);
  const hex = Math.round(c * 255).toString(16).padStart(2, "0");
  return `${SD_GOLD}${hex}`;
};

/* ---- Reusable MUI sx tokens ---- */
export const sdPrimaryBtn = {
  textTransform: "none",
  fontWeight: 900,
  borderRadius: 99,
  color: SD_INK,
  backgroundColor: SD_GOLD,
  boxShadow: `0 10px 24px ${SD_GOLD_GLOW}`,
  "&:hover": { backgroundColor: SD_GOLD_DARK, boxShadow: `0 12px 28px ${SD_GOLD_GLOW}` },
} as const;

export const sdGhostBtnDark = {
  textTransform: "none",
  fontWeight: 800,
  borderRadius: 99,
  color: "#fff",
  borderColor: "rgba(255,255,255,0.28)",
  "&:hover": { borderColor: SD_GOLD, backgroundColor: "rgba(255,255,255,0.06)" },
} as const;

export const sdGhostBtnLight = {
  textTransform: "none",
  fontWeight: 800,
  borderRadius: 99,
  color: SD_INK,
  borderColor: SD_BORDER,
  "&:hover": { borderColor: SD_GOLD_DEEP, backgroundColor: SD_GOLD_SOFT },
} as const;

export const sdCard = {
  p: { xs: 2, md: 2.5 },
  borderRadius: 3,
  backgroundColor: SD_CARD,
  border: `1px solid ${SD_BORDER}`,
} as const;

/**
 * Canonical positioning line. SafeDeal owns escrow, custody, disputes and
 * payouts; Dynopay is named ONLY as the payment processor.
 */
export const POWERED_BY_LINE = "Payments processed by Dynopay";
