import { BRAND_ACCENT } from "./theme";

/**
 * Shared Creator-theme primitives.
 *
 * Single source of truth for the accent + gradient presets and the
 * `buildCoverBackground` renderer. Previously the gradient map + cover-render
 * logic was copy-pasted across CreatorThemePicker, CreatorProfile (public page)
 * and CreatorLivePreview (editor mirror) — this consolidates them so a preset
 * change updates every surface at once.
 */

export type CoverStyle = "solid" | "gradient" | "image" | "pattern";

export interface CreatorTheme {
  accentColor: string | null; // null = default Aurora Indigo (Dynopay brand)
  coverStyle: CoverStyle | null;
  coverGradient: string | null; // preset key OR "#RRGGBB,#RRGGBB"
}

// Accent presets — 6 swatches + custom
export const ACCENT_PRESETS: Array<{ key: string; hex: string; label: string }> = [
  { key: "lime", hex: "#CCFF00", label: "Lime" },
  { key: "electric", hex: "#00E5FF", label: "Electric" },
  { key: "magenta", hex: "#FF3D9A", label: "Magenta" },
  { key: "sunset", hex: "#FF7A45", label: "Sunset" },
  { key: "purple", hex: "#8B5CF6", label: "Purple" },
  { key: "teal", hex: "#0FCFA0", label: "Teal" },
];

// Gradient presets — key + CSS stops (for preview + rendered on public page)
export const GRADIENT_PRESETS: Array<{ key: string; label: string; stops: string }> = [
  { key: "sunset", label: "Sunset", stops: "#FF7A45 0%, #FF3D9A 100%" },
  { key: "ocean", label: "Ocean", stops: "#00E5FF 0%, #7C3AED 100%" },
  { key: "forest", label: "Forest", stops: "#0FCFA0 0%, #14532D 100%" },
  { key: "twilight", label: "Twilight", stops: "#4C1D95 0%, #0EA5E9 100%" },
  { key: "midnight", label: "Midnight", stops: "#0F172A 0%, #6366F1 100%" },
  { key: "candy", label: "Candy", stops: "#FCD34D 0%, #FF3D9A 100%" },
];

/**
 * `presetKey -> "stopA, stopB"` derived from GRADIENT_PRESETS. Used by the
 * public page + live preview which resolve gradient stops directly (they apply
 * their own scrims, so they don't call buildCoverBackground for images).
 */
export const GRADIENT_STOPS: Record<string, string> = GRADIENT_PRESETS.reduce(
  (acc, g) => {
    acc[g.key] = g.stops;
    return acc;
  },
  {} as Record<string, string>,
);

/** Returns a CSS background string for a given cover style + accent + gradient. */
export const buildCoverBackground = (theme: CreatorTheme, coverImageUrl?: string | null): string => {
  const accent = theme.accentColor || BRAND_ACCENT;
  const style = theme.coverStyle || "solid";
  if (style === "solid") {
    return `linear-gradient(135deg, ${accent}22 0%, ${accent}66 100%)`;
  }
  if (style === "gradient") {
    const stops = GRADIENT_STOPS[theme.coverGradient || "sunset"];
    if (stops) return `linear-gradient(135deg, ${stops})`;
    // Custom "hex1,hex2"
    if (theme.coverGradient && /^#[0-9a-f]{6},#[0-9a-f]{6}$/i.test(theme.coverGradient)) {
      const [a, b] = theme.coverGradient.split(",");
      return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
    }
    return `linear-gradient(135deg, ${accent} 0%, #0A0A0B 100%)`;
  }
  if (style === "image" && coverImageUrl) {
    return `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url(${coverImageUrl}) center/cover no-repeat`;
  }
  if (style === "pattern") {
    // Subtle dot-grid pattern on accent tint
    return `${accent}18 radial-gradient(${accent}44 1px, transparent 1px) 0 0/16px 16px`;
  }
  return `linear-gradient(135deg, ${accent}22 0%, ${accent}66 100%)`;
};
