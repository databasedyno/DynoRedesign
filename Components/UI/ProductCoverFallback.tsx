import React from "react";
import { Box } from "@mui/material";

/**
 * ProductCoverFallback — generated cover for products without an image (D3).
 * Deterministic gradient from the title + up to two initials, so a store
 * never shows a broken-looking "◫" glyph.
 */
interface Props {
  title: string;
  /** Merchant accent (hex) — used as the gradient base when present. */
  accent?: string | null;
  /** Font size of the initials; scales with the container. */
  fontSize?: number | string;
  "data-testid"?: string;
}

function hueFrom(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function coverInitials(title: string): string {
  const words = String(title || "").trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const clean = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (clean.length === 0) return "•";
  if (clean.length === 1) return clean[0].slice(0, 2).toUpperCase();
  return (clean[0][0] + clean[1][0]).toUpperCase();
}

const ProductCoverFallback: React.FC<Props> = ({ title, accent, fontSize = 40, ...rest }) => {
  const hue = hueFrom(title || "");
  const bg = accent
    ? `linear-gradient(135deg, ${accent} 0%, hsl(${hue}, 60%, 38%) 100%)`
    : `linear-gradient(135deg, hsl(${hue}, 62%, 46%) 0%, hsl(${(hue + 40) % 360}, 58%, 34%) 100%)`;
  return (
    <Box
      aria-hidden
      data-testid={rest["data-testid"] || "product-cover-fallback"}
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: "rgba(255,255,255,0.92)",
        fontWeight: 800,
        letterSpacing: "0.04em",
        fontSize,
        fontFamily: "var(--font-hero), var(--font-sans), sans-serif",
        textShadow: "0 2px 12px rgba(0,0,0,0.25)",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18) 0%, transparent 45%), radial-gradient(circle at 80% 85%, rgba(0,0,0,0.18) 0%, transparent 50%)",
        },
      }}
    >
      <Box component="span" sx={{ position: "relative", zIndex: 1 }}>{coverInitials(title)}</Box>
    </Box>
  );
};

export default ProductCoverFallback;
