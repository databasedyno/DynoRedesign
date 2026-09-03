import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { toFixedStr } from "@/utils/money";

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const border = theme.palette.divider;
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  if (!products || products.length === 0) return null;
  const visible = products.slice(0, MAX_VISIBLE);

  return (
    <Box data-testid="creator-shop-section" sx={{ mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
        }}
      >
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
          Shop · {products.length} {products.length === 1 ? "item" : "items"}
        </Typography>
        {products.length > MAX_VISIBLE && (
          <Box
            component="a"
            href={`/${handle}/shop`}
            data-testid="creator-shop-view-all"
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              fontWeight: 700,
              color: accent,
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View all →
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          // A lone product looks stranded at half width — give it the full row.
          gridTemplateColumns:
            visible.length === 1 ? "1fr" : { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
        }}
      >
        {visible.map((p) => (
          <Box
            key={p.product_id}
            component="a"
            href={`/${handle}/p/${p.slug}`}
            data-testid={`creator-shop-product-${p.product_id}`}
            sx={{
              display: "flex",
              flexDirection: "column",
              borderRadius: "16px",
              border: `1px solid ${border}`,
              backgroundColor: surface,
              overflow: "hidden",
              textDecoration: "none",
              transition: "border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                borderColor: accent,
                transform: "translateY(-2px)",
              },
            }}
          >
            <Box
              sx={{
                position: "relative",
                aspectRatio: "16 / 9",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: alpha(accent, isDark ? 0.12 : 0.1),
              }}
            >
              {p.cover_image_url ? (
                <Box
                  component="img"
                  src={p.cover_image_url}
                  alt={p.title}
                  loading="lazy"
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Icon
                  icon="mdi:package-variant-closed"
                  width={26}
                  color={isDark ? accent : "#0A0A0B"}
                />
              )}
            </Box>
            <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.title}
              </Typography>
              {p.subtitle && (
                <Typography
                  sx={{
                    fontSize: 12.5,
                    color: theme.palette.text.secondary,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.subtitle}
                </Typography>
              )}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  mt: 0.25,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: MONO,
                    fontSize: 14,
                    fontWeight: 800,
                    color: theme.palette.text.primary,
                  }}
                >
                  {price(p.base_price_cents, p.currency)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: accent,
                  }}
                >
                  Buy →
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default CreatorShopSection;
