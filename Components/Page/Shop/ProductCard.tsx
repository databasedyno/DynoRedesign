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
 * Hover: cover zooms subtly, the card lifts with an accent glow and the
 * "Buy →" pill fills with the merchant accent.
 */
import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Box, Card, CardActionArea, CardContent, Typography, useTheme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import type { ShopProduct } from "./types";
import { formatPrice, MIN_ORDER_CENTS } from "./types";
import ProductCoverFallback from "@/Components/UI/ProductCoverFallback";
import { BRAND_ACCENT } from "@/constants/theme";
import { readableOn } from "@/constants/creatorTheme";

interface Props {
  product: ShopProduct;
  merchantHandle: string;
  variant?: "regular" | "featured" | "compact";
  isTrending?: boolean;
  /** Merchant accent — tints the generated cover for image-less products. */
  accent?: string | null;
}

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const HERO = "var(--font-hero), var(--font-sans)";

const TYPE_LABEL: Record<string, string> = { digital: "Digital", physical: "Physical", service: "Service" };
const TYPE_ICON: Record<string, string> = { digital: "mdi:download-outline", physical: "mdi:package-variant-closed", service: "mdi:account-wrench-outline" };

export default function ProductCard({
  product,
  merchantHandle,
  variant = "regular",
  isTrending = false,
  accent,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("landing");
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";
  const belowMin = (product.base_price_cents || 0) > 0 && (product.base_price_cents || 0) < MIN_ORDER_CENTS;
  const ac = accent || BRAND_ACCENT;
  const accentText = isDark ? ac : (readableOn(ac) === "#FFFFFF" ? ac : darken(ac, 0.38));

  const typeKey = String(product.product_type || "").toLowerCase();
  const typeLabel = TYPE_LABEL[typeKey]
    ? t(`shop.type${typeKey.charAt(0).toUpperCase()}${typeKey.slice(1)}`, { defaultValue: TYPE_LABEL[typeKey] })
    : "";

  const hasSold = (product.sold_count || 0) > 0;
  const showTrending = isTrending && (product.sold_count || 0) >= 25;

  const aspect = isFeatured ? "4/3" : isCompact ? "1/1" : "16/10";

  const overlayPill = {
    position: "absolute" as const,
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    px: 1.1,
    minHeight: 26,
    borderRadius: "999px",
    fontFamily: MONO,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#FFFFFF",
    bgcolor: "rgba(10,10,13,0.62)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  return (
    <Card
      data-testid={`shop-product-card-${product.product_id}`}
      data-variant={variant}
      sx={{
        borderRadius: "22px",
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.06)"}`,
        background: isDark ? "rgba(24,24,31,0.72)" : "rgba(255,255,255,0.86)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.03) inset" : "0 1px 2px rgba(18,18,20,0.04)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: isDark
            ? `0 22px 50px rgba(0,0,0,0.55), 0 0 0 1px ${alpha(ac, 0.4)}`
            : `0 22px 50px ${alpha(ac, 0.18)}, 0 0 0 1px ${alpha(ac, 0.35)}`,
          borderColor: alpha(ac, 0.5),
          "& .product-cover-img": { transform: "scale(1.05)" },
          "& .product-view-cta": { opacity: 1, transform: "translateY(0)" },
          "& .product-buy-pill": { backgroundColor: ac, color: readableOn(ac), borderColor: ac },
        },
        "&:focus-within": { boxShadow: `0 0 0 3px ${alpha(ac, 0.35)}` },
      }}
    >
      <CardActionArea
        component={Link as any}
        href={`/${merchantHandle}/p/${product.slug}`}
        sx={{ display: "flex", flexDirection: "column", alignItems: "stretch", height: "100%" }}
      >
        {/* Cover with overlays */}
        <Box sx={{ position: "relative", overflow: "hidden", bgcolor: alpha(ac, isDark ? 0.1 : 0.08) }}>
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
                  transition: "transform 420ms cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            ) : (
              <Box className="product-cover-img" sx={{ position: "absolute", inset: 0, transition: "transform 420ms cubic-bezier(0.22,1,0.36,1)" }}>
                <ProductCoverFallback
                  title={product.title}
                  accent={accent}
                  fontSize={isFeatured ? 56 : isCompact ? 28 : 40}
                  data-testid={`shop-cover-fallback-${product.product_id}`}
                />
              </Box>
            )}
          </Box>

          {/* Trending ribbon — top-left */}
          {showTrending && (
            <Box data-testid={`shop-ribbon-trending-${product.product_id}`} sx={{ ...overlayPill, top: 12, left: 12, bgcolor: "rgba(180,83,9,0.92)", border: "none" }}>
              <Icon icon="mdi:fire" width={13} color="#FFD100" />
              {t("shop.trending", { defaultValue: "Trending" })}
            </Box>
          )}

          {/* Featured ribbon */}
          {isFeatured && !showTrending && (
            <Box data-testid={`shop-ribbon-featured-${product.product_id}`} sx={{ ...overlayPill, top: 12, left: 12, bgcolor: BRAND_ACCENT, color: "#121214", border: "none" }}>
              <Icon icon="mdi:star" width={13} />
              {t("shop.featured", { defaultValue: "Featured" })}
            </Box>
          )}

          {/* Type badge — top-right */}
          {typeLabel && (
            <Box data-testid={`shop-type-badge-${product.product_id}`} sx={{ ...overlayPill, top: 12, right: 12 }}>
              <Icon icon={TYPE_ICON[typeKey] || "mdi:tag-outline"} width={12} />
              {typeLabel}
            </Box>
          )}

          {/* Sold-count chip — bottom-right */}
          {hasSold && (
            <Box data-testid={`shop-sold-chip-${product.product_id}`} sx={{ ...overlayPill, bottom: 12, right: 12, textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-sans)", fontSize: 11.5 }}>
              {t("shop.soldCount", { count: product.sold_count, defaultValue: `${product.sold_count} sold` })}
            </Box>
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
              transition: "opacity 200ms ease, transform 200ms ease",
              bgcolor: "rgba(255,255,255,0.95)",
              color: "#121214",
              fontSize: 12,
              fontWeight: 700,
              px: 1.5,
              minHeight: 30,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              pointerEvents: "none",
            }}
            aria-hidden
          >
            {t("shop.view", { defaultValue: "View" })} →
          </Box>
        </Box>

        {/* Body */}
        <CardContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            p: { xs: 2, md: 2.5 },
            "&:last-child": { pb: { xs: 2, md: 2.5 } },
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontFamily: HERO,
              fontWeight: 700,
              fontSize: isFeatured ? { xs: "1.2rem", md: "1.45rem" } : "1.02rem",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              color: theme.palette.text.primary,
              minHeight: isFeatured ? "3rem" : "2.55em",
            }}
          >
            {product.title}
          </Typography>

          {product.subtitle && (
            <Typography
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                display: "-webkit-box",
                WebkitLineClamp: isFeatured ? 3 : 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.5,
                fontSize: 13.5,
              }}
            >
              {product.subtitle}
            </Typography>
          )}

          <Box sx={{ mt: "auto", pt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, minWidth: 0 }}>
              {product.has_variants && (
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                  {t("shop.fromPrice", { defaultValue: "from" })}
                </Typography>
              )}
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: isFeatured ? "1.55rem" : "1.15rem",
                  fontVariantNumeric: "tabular-nums",
                  color: theme.palette.text.primary,
                  letterSpacing: "-0.02em",
                }}
                data-testid={`shop-price-${product.product_id}`}
              >
                {formatPrice(product.base_price_cents, product.currency, i18n.language)}
              </Typography>
            </Box>
            <Box
              className="product-buy-pill"
              aria-hidden
              sx={{
                display: "inline-flex",
                alignItems: "center",
                px: 1.4,
                minHeight: 34,
                borderRadius: "999px",
                border: `1px solid ${alpha(ac, 0.5)}`,
                fontSize: 12.5,
                fontWeight: 700,
                color: accentText,
                flexShrink: 0,
                transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
              }}
            >
              {t("shop.buy", { defaultValue: "Buy" })} →
            </Box>
          </Box>
          {belowMin && (
            <Typography
              variant="caption"
              data-testid={`shop-min-order-hint-${product.product_id}`}
              sx={{ color: theme.palette.text.secondary, lineHeight: 1.35 }}
            >
              {t("shop.minOrderHint", { min: formatPrice(MIN_ORDER_CENTS, product.currency, i18n.language), defaultValue: `Min. order ${formatPrice(MIN_ORDER_CENTS, product.currency, i18n.language)} — combine with other items` })}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
