/**
 * Central brand + design tokens — Dynopay 2026-09 rebrand (signal yellow / Bybit black).
 *
 * Palette: yellow (primary fills, brand text on dark) · Bybit black + neutral
 * graphite greys (dark grounds, mirrors constants/publicTheme PUB_DARK) · cool
 * light neutrals (PUB_LIGHT). Aqua survives ONLY as a micro-accent: the logo
 * spark and small "live" dots. Brown/cream tokens were retired 2026-09-24.
 *
 * `BRAND_ACCENT` is the signal gold used for solid fills (primary buttons,
 * active nav, selected states). Gold ALWAYS carries dark-brown text —
 * pair it with `BRAND_ON_ACCENT`, never white. Brand-tinted TEXT / icons /
 * thin borders use `brandFg(isDark)` (gold on dark, deep gold on light).
 */
export const BRAND_ACCENT = "#FFD100";
/** Pressed / hover gold. */
export const BRAND_ACCENT_DARK = "#F0C300";
/** Brand-tinted text on dark surfaces (gold). */
export const BRAND_ACCENT_LIGHT = "#FFD100";
/** Hover fill. */
export const BRAND_ACCENT_HOVER = "#F0C300";
/** Text / icon colour that sits ON a gold fill. */
export const BRAND_ON_ACCENT = "#121214";

/** Gold — `GOLD` on dark grounds, `GOLD_DEEP` for readable brand text on light (≈5.3:1 on cream). */
export const GOLD = "#FFD100";
export const GOLD_DEEP = "#8B5E00";
/** Aqua — micro-accent ONLY (logo spark, live dots). Never for links / focus / fills. */
export const AQUA = "#2BD4C4";
export const AQUA_DEEP = "#0F8F86";
/** Bybit black grounds (legacy names kept for imports). */
export const ESPRESSO = "#121214";
export const ESPRESSO_RAISED = "#222227";
/** Deepest layer / code-QR-address blocks. */
export const BLACK = "#0A0A0D";
/** Light neutrals. */
export const CREAM = "#F5F7FA";
export const CARD = "#FFFFFF";
export const HAIRLINE = "#E1E5EA";
/** Headings / body text on light surfaces. */
export const INK = "#121214";

/**
 * Theme-aware brand FOREGROUND colour — for brand-coloured TEXT / ICONS / thin
 * borders that sit on a surface. Gold on dark, deep gold on light (AA for text).
 * Never use bright gold for text on light surfaces.
 *
 * NOTE: Do NOT use this for solid button/pill BACKGROUNDS — those keep the full
 * `BRAND_ACCENT` gold in both modes (they pair with `BRAND_ON_ACCENT`).
 */
export const brandFg = (isDark: boolean): string => (isDark ? GOLD : GOLD_DEEP);

/** Hyperlink colour — dark brown on light (underlined), gold on dark. */
export const linkFg = (isDark: boolean): string => (isDark ? GOLD : INK);

/**
 * Returns the brand gold with an alpha channel appended as hex
 * (e.g. brandAlpha(0.1) -> "#FFD1001A"). `a` is clamped to [0, 1].
 */
export const brandAlpha = (a: number): string => {
  const clamped = Math.min(Math.max(a, 0), 1);
  const hex = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${BRAND_ACCENT}${hex}`;
};

/** Gold with alpha — glows, focus rings, soft tints. */
export const goldAlpha = (a: number): string => `rgba(255,209,0,${Math.min(Math.max(a, 0), 1)})`;
/** Deep gold with alpha — soft tints on light surfaces. */
export const goldDeepAlpha = (a: number): string => `rgba(139,94,0,${Math.min(Math.max(a, 0), 1)})`;
/** Aqua with alpha — live-dot halos only. */
export const aquaAlpha = (a: number): string => `rgba(43,212,196,${Math.min(Math.max(a, 0), 1)})`;

/**
 * Semantic status palette — single source of truth for success / error /
 * warning states across checkout, dashboards, and (mirrored server-side in
 * `backend/utils/brandTokens.ts`) transactional emails. Money semantics stay
 * conventional: green = received / up, red = failed / down.
 */
/** Paid / settled / success. */
export const SUCCESS_GREEN = "#12B76A";
export const SUCCESS_GREEN_DARK = "#05936A";
export const SUCCESS_GREEN_LIGHT = "#3FD98A";
/** Failed / declined / error. */
export const ERROR_RED = "#DC2626";
export const ERROR_RED_DARK = "#B91C1C";
export const ERROR_RED_LIGHT = "#FF6B6B";
/** Pending / warning. */
export const WARNING_AMBER = "#F59E0B";
export const WARNING_AMBER_DARK = "#B45309";
export const WARNING_AMBER_LIGHT = "#FBBF24";

/**
 * Dark-mode surface system — warm dark. Black canvas → dark-brown cards →
 * espresso raised → lighter espresso active. Gold fills + gold text accents.
 */
export const DARK = {
  canvas: "#131312",
  surface: "#1A1A19",
  raised: "#222221",
  active: "#2A2A28",
  border: "#2B2B29",
  borderStrong: "#3A3A37",
  text: "#F2F2F0",
  textSecondary: "#A3A3A0",
  textMuted: "#70706E",
  /** Solid fills (buttons, active nav) — pairs with `BRAND_ON_ACCENT`. */
  accent: BRAND_ACCENT,
  accentHover: BRAND_ACCENT_HOVER,
  /** Brand-tinted TEXT / icons on dark surfaces (gold). */
  accentText: GOLD,
  accentSoft: "rgba(255,209,0,0.12)",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  /** Info = calm blue on dark (status only). */
  info: "#60A5FA",
  /** Hairline light-tint borders. */
  hairline: "rgba(255,255,255,0.06)",
  hairlineStrong: "rgba(255,255,255,0.12)",
  /** Elevation shadows — soft + flat (the console relies on hairlines, not glow). */
  shadowSoft: "0 1px 2px rgba(0,0,0,0.40)",
  shadow: "0 8px 24px rgba(0,0,0,0.40)",
  cardShadow: "0 1px 2px rgba(0,0,0,0.40)",
  cardShadowHover: "0 4px 16px rgba(0,0,0,0.50)",
  /** Accent glow for focused inputs / primary CTAs (used sparingly). */
  glowAccent: "0 0 24px rgba(255,209,0,0.10)",
  glowAccentStrong: "0 0 20px rgba(255,209,0,0.28)",
  glowSuccess: "0 0 16px rgba(74,222,128,0.28)",
  focusRing: "0 0 0 3px rgba(255,209,0,0.35)",
  /** Gradients — hero / pulse surfaces only. */
  gradient: "linear-gradient(135deg, #FFD100 0%, #FFB300 100%)",
  gradientHover: "linear-gradient(135deg, #FFDA33 0%, #FFBE2E 100%)",
  gradientWarm: "linear-gradient(135deg, #F59E0B 0%, #F43F5E 100%)",
} as const;

/** Light-mode counterparts — warm off-white grounds, deep graphite text. */
export const LIGHT = {
  canvas: "#F9F9F8",
  surface: CARD,
  raised: "#F2F2F0",
  active: "#ECECEA",
  border: "#EAEAE7",
  borderStrong: "#DCDCD8",
  text: "#1A1A19",
  textSecondary: "#666664",
  textMuted: "#6B6B72",
  accent: BRAND_ACCENT,
  accentHover: BRAND_ACCENT_HOVER,
  accentSoft: "#FFF6CC",
  success: "#15803D",
  warning: "#B45309",
  error: "#B91C1C",
  /** Info = calm blue on light (status only). */
  info: "#1565C0",
  /** Hairline warm borders. */
  hairline: "rgba(0,0,0,0.06)",
  hairlineStrong: "rgba(0,0,0,0.12)",
  /** Elevation shadows — soft + flat. */
  shadowSoft: "0 1px 2px rgba(0,0,0,0.04)",
  shadow: "0 8px 24px rgba(0,0,0,0.08)",
  cardShadow: "0 1px 2px rgba(0,0,0,0.04)",
  cardShadowHover: "0 4px 16px rgba(0,0,0,0.08)",
  focusRing: "0 0 0 3px rgba(255,209,0,0.45)",
} as const;

/**
 * Canonical radius scale — Phase 3 standardization (2026-09).
 *   control = buttons / inputs / menus / small toggles (8px)
 *   card    = content cards, panels, tables, modals (12px)
 *   chip    = status badges / count chips (100px = fully rounded)
 *   pill    = timeframe pills / segmented toggles (9999px)
 */
export const RADIUS = { control: 8, card: 12, chip: 100, pill: 9999 } as const;

/** Canonical elevation scale (theme-aware helper). */
export const elevation = (isDark: boolean) => (isDark ? DARK : LIGHT);

/**
 * Restrained status system (console redesign) — a low-chroma DOT + label, not a
 * loud chip. One palette drives payment / payout / link / customer states.
 * `dot` is the mode-agnostic swatch; `text` is tuned per mode for AA contrast.
 */
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export const STATUS_PALETTE: Record<StatusTone, { dot: string; dark: string; light: string }> = {
  success: { dot: "#22C55E", dark: "#4ADE80", light: "#15803D" },
  warning: { dot: "#F59E0B", dark: "#FBBF24", light: "#B45309" },
  error: { dot: "#EF4444", dark: "#F87171", light: "#B91C1C" },
  info: { dot: "#3B82F6", dark: "#60A5FA", light: "#1565C0" },
  neutral: { dot: "#8A8A86", dark: "#A3A3A0", light: "#666664" },
};

/** Map a raw payment/payout/link status string to a status tone. */
export const statusTone = (raw?: string | null): StatusTone => {
  const s = (raw || "").toLowerCase();
  if (/(paid|settled|success|succeeded|completed|complete|active|confirmed|released|credited|delivered|sent|approved)/.test(s)) return "success";
  if (/(pending|processing|awaiting|waiting|in_progress|open|invited|queued|underpaid|partial|review)/.test(s)) return "warning";
  if (/(failed|declined|error|expired|cancelled|canceled|rejected|refunded|disputed|frozen|banned|overpaid)/.test(s)) return "error";
  if (/(draft|new|info|created|scheduled)/.test(s)) return "info";
  return "neutral";
};
