/**
 * ProductCard — the storefront card renderer.
 *
 * Variants:
 *   • "regular"  — default grid card (16:10 cover), used for all products
 *                  when there's no featured product picked.
 *   • "featured" — 2-column wide card with taller cover + "Featured" ribbon.
 *                  Used for the top-selling item on desktop as a hero.
 *   • "compact"  — smaller card (kept for later / other pages).
 *
 * Overlays:
 *   • Type badge (Digital / Physical / Service) — top-right corner.
 *   • Trending ribbon — top-left when sold_count >= 25 (or explicit `trending`).
 *   • "N sold" chip — bottom-right of cover when sold_count > 0.
 *
 * Hover: cover zooms subtly and a "View" CTA slides up.
 */
import React from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  useTheme,
} from "@mui/material";
import type { ShopProduct } from "./types";
import { formatPrice } from "./types";

interface Props {
  product: ShopProduct;
  merchantHandle: string;
  variant?: "regular" | "featured" | "compact";
  isTrending?: boolean;
}

const TYPE_COLOR: Record<string, { light: string; dark: string; label: string }> = {
  digital: { light: "#2563EB", dark: "#93C5FD", label: "Digital" },
  physical: { light: "#B03A76", dark: "#F9A8D4", label: "Physical" },
  service: { light: "#5A6B00", dark: "#CCFF00", label: "Service" },
};

export default function ProductCard({
  product,
  merchantHandle,
  variant = "regular",
  isTrending = false,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  const typeStyle =
    TYPE_COLOR[String(product.product_type || "").toLowerCase()] || null;
  const typeChipColor = typeStyle
    ? isDark
      ? typeStyle.dark
      : typeStyle.light
    : isDark
      ? "rgba(255,255,255,0.6)"
      : "rgba(0,0,0,0.55)";

  const hasSold = (product.sold_count || 0) > 0;
  const showTrending = isTrending && (product.sold_count || 0) >= 25;

  const aspect = isFeatured ? "4/3" : isCompact ? "1/1" : "16/10";

  return (
    <Card
      data-testid={`shop-product-card-${product.product_id}`}
      data-variant={variant}
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        bgcolor: isDark ? "rgba(255,255,255,0.02)" : "background.paper",
        boxShadow: "none",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: isDark
            ? "0 12px 32px rgba(0,0,0,0.5)"
            : "0 12px 32px rgba(0,0,0,0.12)",
          borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
          "& .product-cover-img": {
            transform: "scale(1.05)",
          },
          "& .product-view-cta": {
            opacity: 1,
            transform: "translateY(0)",
          },
        },
      }}
    >
      <CardActionArea
        component={Link as any}
        href={`/${merchantHandle}/p/${product.slug}`}
        sx={{ display: "flex", flexDirection: "column", alignItems: "stretch", height: "100%" }}
      >
        {/* Cover with overlays */}
        <Box sx={{ position: "relative", overflow: "hidden", bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
          <Box sx={{ aspectRatio: aspect, position: "relative", overflow: "hidden" }}>
            {product.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="product-cover-img"
                src={product.cover_image_url}
                alt={product.title}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  transition: "transform 0.35s ease",
                }}
              />
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "text.disabled",
                  fontSize: 40,
                  background: isDark
                    ? "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
                    : "linear-gradient(135deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)",
                }}
                aria-label="No cover image"
              >
                {"\u25EB"}
              </Box>
            )}
          </Box>

          {/* Trending ribbon — top-left */}
          {showTrending && (
            <Box
              data-testid={`shop-ribbon-trending-${product.product_id}`}
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                bgcolor: isDark ? "rgba(204,255,0,0.95)" : "#5a6b00",
                color: isDark ? "#000" : "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              🔥 Trending
            </Box>
          )}

          {/* Featured ribbon */}
          {isFeatured && !showTrending && (
            <Box
              data-testid={`shop-ribbon-featured-${product.product_id}`}
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                bgcolor: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.85)",
                color: isDark ? "#000" : "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              ★ Featured
            </Box>
          )}

          {/* Type badge — top-right */}
          {typeStyle && (
            <Chip
              size="small"
              label={typeStyle.label}
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                bgcolor: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)",
                color: typeChipColor,
                fontWeight: 700,
                fontSize: 10.5,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                backdropFilter: "blur(6px)",
              }}
              data-testid={`shop-type-badge-${product.product_id}`}
            />
          )}

          {/* Sold-count chip — bottom-right */}
          {hasSold && (
            <Chip
              size="small"
              label={`${product.sold_count} sold`}
              sx={{
                position: "absolute",
                bottom: 12,
                right: 12,
                bgcolor: "rgba(0,0,0,0.7)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 11,
                backdropFilter: "blur(6px)",
              }}
              data-testid={`shop-sold-chip-${product.product_id}`}
            />
          )}

          {/* Hover "View" CTA */}
          <Box
            className="product-view-cta"
            sx={{
              position: "absolute",
              bottom: 12,
              left: 12,
              opacity: 0,
              transform: "translateY(6px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              bgcolor: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.85)",
              color: isDark ? "#000" : "#fff",
              fontSize: 12,
              fontWeight: 700,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            View →
          </Box>
        </Box>

        {/* Body */}
        <CardContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            p: { xs: 2, md: 2.5 },
          }}
        >
          <Typography
            component="h3"
            sx={{
              fontWeight: 700,
              fontSize: isFeatured ? { xs: "1.15rem", md: "1.35rem" } : "1rem",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
              minHeight: isFeatured ? "3rem" : "2.6em",
            }}
          >
            {product.title}
          </Typography>

          {product.subtitle && (
            <Typography
              variant="body2"
              sx={{
                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.45,
              }}
            >
              {product.subtitle}
            </Typography>
          )}

          <Box sx={{ mt: "auto", pt: 1.5, display: "flex", alignItems: "baseline", gap: 0.75 }}>
            {product.has_variants && (
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                  fontWeight: 500,
                }}
              >
                from
              </Typography>
            )}
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: isFeatured ? "1.5rem" : "1.15rem",
                fontVariantNumeric: "tabular-nums",
                color: isDark ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.92)",
                letterSpacing: "-0.01em",
              }}
              data-testid={`shop-price-${product.product_id}`}
            >
              {formatPrice(product.base_price_cents, product.currency)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
