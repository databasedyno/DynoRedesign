import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import ProductCoverFallback from "@/Components/UI/ProductCoverFallback";
import { readableOn } from "@/constants/creatorTheme";
import { toFixedStr } from "@/utils/money";

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const HERO = "var(--font-hero), var(--font-sans)";

export interface CreatorShopProduct {
  product_id: number;
  title: string;
  slug: string;
  subtitle?: string | null;
  base_price_cents: number;
  currency: string;
  cover_image_url?: string | null;
  product_type?: string;
  sold_count?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const price = (cents: number, currency: string): string => {
  const cur = (currency || "USD").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[cur];
  const value = toFixedStr((Number(cents || 0) / 100), 2);
  return symbol ? `${symbol}${value}` : `${value} ${cur}`;
};

const TYPE_LABEL: Record<string, string> = { digital: "Digital", physical: "Physical", service: "Service" };

const MAX_VISIBLE = 6;

/**
 * Products on the public page.
 *
 * A merchant shares ONE link, so their shop cannot live at a separate URL that
 * visitors never discover. This section surfaces their live products inline,
 * below the tip/support area, and only links out to the full shop when there
 * are more than fit here.
 */
const CreatorShopSection: React.FC<{
  handle: string;
  products: CreatorShopProduct[];
  accent: string;
}> = ({ handle, products, accent }) => {
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const border = theme.palette.divider;
  const surface = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.78)";
  const accentText = isDark ? accent : (readableOn(accent) === "#FFFFFF" ? accent : darken(accent, 0.38));

  if (!products || products.length === 0) return null;
  const visible = products.slice(0, MAX_VISIBLE);
  const single = visible.length === 1;

  return (
    <Box data-testid="creator-shop-section">
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1.75 }}>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
          }}
        >
          {t("creator.shopSection.label", { count: products.length, defaultValue: `Shop · ${products.length} ${products.length === 1 ? "item" : "items"}` })}
        </Typography>
        <Box
          component="a"
          href={`/${handle}/shop`}
          data-testid="creator-shop-view-all"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 700,
            color: accentText,
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {products.length > MAX_VISIBLE
            ? t("creator.shopSection.viewAll", { defaultValue: "View all →" })
            : t("creator.shopSection.openShop", { defaultValue: "Open shop →" })}
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: single ? "1fr" : { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
        }}
      >
        {visible.map((p) => {
          const typeKey = String(p.product_type || "").toLowerCase();
          const typeLabel = TYPE_LABEL[typeKey]
            ? t(`shop.type${typeKey.charAt(0).toUpperCase()}${typeKey.slice(1)}`, { defaultValue: TYPE_LABEL[typeKey] })
            : "";
          return (
            <Box
              key={p.product_id}
              component="a"
              href={`/${handle}/p/${p.slug}`}
              data-testid={`creator-shop-product-${p.product_id}`}
              sx={{
                display: "flex",
                flexDirection: single ? { xs: "column", sm: "row" } : "column",
                borderRadius: "22px",
                border: `1px solid ${border}`,
                backgroundColor: surface,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                overflow: "hidden",
                textDecoration: "none",
                transition: "border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
                "&:hover": {
                  borderColor: alpha(accent, 0.6),
                  transform: "translateY(-3px)",
                  boxShadow: isDark ? "0 22px 48px rgba(0,0,0,0.5)" : `0 22px 48px ${alpha(accent, 0.16)}`,
                  "& .creator-shop-cover": { transform: "scale(1.04)" },
                  "& .creator-shop-buy": { backgroundColor: accent, color: readableOn(accent), borderColor: accent },
                },
                "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2 },
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  aspectRatio: single ? { xs: "16 / 9", sm: "auto" } : "16 / 10",
                  width: single ? { xs: "100%", sm: "46%" } : "100%",
                  minHeight: single ? { sm: 220 } : undefined,
                  flexShrink: 0,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: alpha(accent, isDark ? 0.12 : 0.1),
                }}
              >
                {p.cover_image_url ? (
                  <Box
                    component="img"
                    className="creator-shop-cover"
                    src={p.cover_image_url}
                    alt={p.title}
                    loading="lazy"
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "transform 420ms cubic-bezier(0.22,1,0.36,1)" }}
                  />
                ) : (
                  <Box className="creator-shop-cover" sx={{ position: "absolute", inset: 0, transition: "transform 420ms cubic-bezier(0.22,1,0.36,1)" }}>
                    <ProductCoverFallback title={p.title} accent={accent} fontSize={single ? 48 : 34} />
                  </Box>
                )}
                {typeLabel && (
                  <Box
                    sx={{
                      position: "absolute", top: 12, left: 12,
                      px: 1.1, py: 0.4, borderRadius: "999px",
                      fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "#FFFFFF", backgroundColor: "rgba(10,10,13,0.62)",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    {typeLabel}
                  </Box>
                )}
                {(p.sold_count || 0) > 0 && (
                  <Box
                    sx={{
                      position: "absolute", bottom: 12, left: 12,
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      px: 1.1, py: 0.4, borderRadius: "999px",
                      fontSize: 11, fontWeight: 700, color: "#FFFFFF", backgroundColor: "rgba(10,10,13,0.62)",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    <Icon icon="mdi:fire" width={13} color="#FFB300" />
                    {t("shop.soldCount", { count: p.sold_count, defaultValue: `${p.sold_count} sold` })}
                  </Box>
                )}
              </Box>

              <Box sx={{ p: single ? { xs: 2, sm: 3 } : 2, display: "flex", flexDirection: "column", gap: 0.75, flex: 1, minWidth: 0, justifyContent: single ? "center" : "flex-start" }}>
                <Typography
                  sx={{
                    fontFamily: HERO,
                    fontSize: single ? { xs: 18, sm: 20 } : 15.5,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.25,
                    color: theme.palette.text.primary,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.title}
                </Typography>
                {p.subtitle && (
                  <Typography
                    sx={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: theme.palette.text.secondary,
                      display: "-webkit-box",
                      WebkitLineClamp: single ? 3 : 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.subtitle}
                  </Typography>
                )}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: "auto", pt: 1.25 }}>
                  <Typography sx={{ fontFamily: MONO, fontSize: single ? 20 : 16, fontWeight: 800, letterSpacing: "-0.02em", color: theme.palette.text.primary }}>
                    {price(p.base_price_cents, p.currency)}
                  </Typography>
                  <Box
                    className="creator-shop-buy"
                    sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      px: 1.5, minHeight: 36, borderRadius: "999px",
                      border: `1px solid ${alpha(accent, 0.5)}`,
                      fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                      color: accentText,
                      transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
                    }}
                  >
                    {t("creator.shopSection.buy", { defaultValue: "Buy →" })}
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default CreatorShopSection;
