import React, { memo } from "react";
import { Box } from "@mui/material";

// ─── Vertical SVG illustrations ───────────────────────────────────────────
// Compact, on-brand illustrations per vertical. All use currentColor so the
// stroke inherits from the parent's `sx.color` — theme (light/dark) aware.

const IconEcommerce: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 12h8l4 30h30l6-22H20" />
    <circle cx="24" cy="52" r="3.5" fill="currentColor" stroke="none" />
    <circle cx="46" cy="52" r="3.5" fill="currentColor" stroke="none" />
    <path d="M28 24l4 4 8-8" opacity="0.5" />
  </svg>
);

const IconSaas: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 44a10 10 0 010-20 12 12 0 0123.6-3.2A9 9 0 0148 44H16z" />
    <path d="M26 34l4 4 8-10" opacity="0.55" />
  </svg>
);

const IconFreelancers: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="10" y="14" width="44" height="28" rx="3" />
    <path d="M6 46h52l-4 6H10z" />
    <path d="M22 24h20M22 32h14" opacity="0.55" />
  </svg>
);

const IconGaming: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 22h36a8 8 0 018 8v6a8 8 0 01-15.2 3.4L38 34H26l-4.8 5.4A8 8 0 016 36v-6a8 8 0 018-8z" />
    <path d="M18 30h6M21 27v6" opacity="0.7" />
    <circle cx="44" cy="30" r="2" fill="currentColor" stroke="none" />
    <circle cx="50" cy="34" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const IconRemittance: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="32" cy="32" r="22" />
    <path d="M10 32h44M32 10a30 30 0 010 44M32 10a30 30 0 000 44" opacity="0.5" />
    <path d="M22 24l4-4 4 4M42 40l-4 4-4-4" strokeWidth="3" />
  </svg>
);

const IconDigitalDownloads: React.FC = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M32 8v30" />
    <path d="M20 30l12 12 12-12" />
    <path d="M10 46v6a4 4 0 004 4h36a4 4 0 004-4v-6" />
  </svg>
);

const VERTICAL_ICON_MAP: Record<string, React.FC> = {
  ecommerce: IconEcommerce,
  saas: IconSaas,
  freelancers: IconFreelancers,
  gaming: IconGaming,
  remittance: IconRemittance,
  "digital-downloads": IconDigitalDownloads,
};

// ─── Deterministic gradient per slug ──────────────────────────────────────
// Verticals get a brand-appropriate hand-picked gradient (green for money,
// purple for SaaS, etc.). Countries get a hash-rotation across the same pool
// so all 8 look distinct.
const GRADIENTS: readonly [string, string][] = [
  ["#6366F1", "#8B5CF6"], // indigo → violet
  ["#0EA5E9", "#22D3EE"], // sky → cyan
  ["#10B981", "#34D399"], // emerald
  ["#F59E0B", "#F97316"], // amber → orange
  ["#EC4899", "#F43F5E"], // pink → rose
  ["#8B5CF6", "#EC4899"], // violet → pink
  ["#14B8A6", "#0EA5E9"], // teal → sky
  ["#F97316", "#EF4444"], // orange → red
] as const;

/**
 * Brand-appropriate vertical gradients — chosen so the visual immediately
 * hints at the vertical (green = money, purple = SaaS/cloud, etc.).
 */
const VERTICAL_GRADIENT_MAP: Record<string, [string, string]> = {
  ecommerce: ["#6366F1", "#8B5CF6"],           // indigo → violet (shopping cart)
  saas: ["#8B5CF6", "#A855F7"],                // violet → purple (cloud / SaaS)
  freelancers: ["#0EA5E9", "#22D3EE"],         // sky → cyan (professional / laptop)
  gaming: ["#EC4899", "#F43F5E"],              // pink → rose (vibrant gaming)
  remittance: ["#10B981", "#34D399"],          // emerald (money / cross-border)
  "digital-downloads": ["#F59E0B", "#F97316"], // amber → orange (downloads / energy)
};

function _slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _gradientFor(slug: string, kind: "country" | "vertical" | "comparison"): [string, string] {
  // Verticals get a hand-picked brand gradient; fall back to hash rotation if
  // we ever add a vertical without a mapped entry.
  if (kind === "vertical") {
    const mapped = VERTICAL_GRADIENT_MAP[slug];
    if (mapped) return mapped;
  }
  return GRADIENTS[_slugHash(slug) % GRADIENTS.length];
}

// ─── Public component ──────────────────────────────────────────────────────

export interface SEOIllustrationProps {
  slug: string;
  kind: "country" | "vertical" | "comparison";
  /** Country flag emoji — used as the visual anchor for country cards. */
  flag?: string | null;
  /** Card diameter (defaults to 56 for cards, use ~180 for hero). */
  size?: number;
  /** Adds subtle inner pattern noise for the hero variant. */
  hero?: boolean;
  /** Optional MUI sx passthrough. */
  sx?: React.CSSProperties;
}

const SEOIllustration: React.FC<SEOIllustrationProps> = ({
  slug,
  kind,
  flag,
  size = 56,
  hero = false,
  sx,
}) => {
  const [c1, c2] = _gradientFor(slug, kind);
  const isVertical = kind === "vertical";
  const IconComponent = isVertical
    ? VERTICAL_ICON_MAP[slug] || IconSaas
    : null;

  return (
    <Box
      data-testid={`seo-illustration-${kind}-${slug}`}
      sx={{
        position: "relative",
        width: size,
        height: size,
        minWidth: size,
        borderRadius: hero ? "24px" : "16px",
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: hero
          ? `0 20px 40px -12px ${c1}55`
          : `0 6px 14px -4px ${c1}55`,
        flexShrink: 0,
        ...(sx as any),
      }}
    >
      {/* Subtle decorative circles (glass-morphism look) */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-25%",
          right: "-25%",
          width: "70%",
          height: "70%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-20%",
          left: "-15%",
          width: "55%",
          height: "55%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
        }}
      />

      {/* Content: flag emoji (country) or SVG icon (vertical) */}
      {isVertical && IconComponent ? (
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            color: "#fff",
            width: size * 0.6,
            height: size * 0.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconComponent />
        </Box>
      ) : (
        <Box
          component="span"
          aria-hidden
          sx={{
            position: "relative",
            zIndex: 1,
            fontSize: size * 0.55,
            lineHeight: 1,
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.25))",
          }}
        >
          {flag || slug.charAt(0).toUpperCase()}
        </Box>
      )}
    </Box>
  );
};

export default memo(SEOIllustration);
