/**
 * ShopClient — interactive client shell for /{handle}/shop.
 *
 * Server pre-renders the hero + full grid; this component adds:
 *   • Type + category filter (client-only, instant, no re-fetch)
 *   • Sort dropdown
 *   • Featured card promotion (top-selling product becomes the featured card)
 *   • Empty state when merchant has 0 products
 *
 * Kept as a client-only wrapper so the SSR page (shop.tsx) can stay lean
 * and rely on `getServerSideProps` for SEO + initial paint.
 */
"use client";

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Grid } from "@mui/material";
import ShopHero from "./ShopHero";
import ShopToolbar from "./ShopToolbar";
import ProductCard from "./ProductCard";
import ShopEmpty from "./ShopEmpty";
import MiniCart from "./MiniCart";
import type { ShopMerchant, ShopProduct, SortKey } from "./types";

interface Props {
  merchant: ShopMerchant;
  products: ShopProduct[];
  shopUrl: string;
  isOwner?: boolean;
}

const FEATURED_THRESHOLD = 25; // sold_count threshold to consider a product "featured-worthy"

export default function ShopClient({ merchant, products, shopUrl, isOwner }: Props) {
  const { t } = useTranslation("landing");
  const [type, setType] = useState<string>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("featured");
  const [query, setQuery] = useState("");

  // Filter first, sort after.
  const filtered: ShopProduct[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const pt = String(p.product_type || "").toLowerCase();
      const typeOK = type === "all" || pt === type;
      const catOK = !category || (p.category && String(p.category).trim() === category);
      const qOK = !q || `${p.title || ""} ${p.subtitle || ""} ${p.category || ""}`.toLowerCase().includes(q);
      return typeOK && catOK && qOK;
    });
  }, [products, type, category, query]);

  const sorted: ShopProduct[] = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "bestselling":
        arr.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
        break;
      case "newest":
        // We don't have createdAt in the public projection — approximate by product_id DESC.
        arr.sort((a, b) => (b.product_id || 0) - (a.product_id || 0));
        break;
      case "price_asc":
        arr.sort((a, b) => (a.base_price_cents || 0) - (b.base_price_cents || 0));
        break;
      case "price_desc":
        arr.sort((a, b) => (b.base_price_cents || 0) - (a.base_price_cents || 0));
        break;
      case "featured":
      default:
        // Featured = keep server order (createdAt DESC) but bubble items with sold_count
        // to the front slightly to reward proven products.
        arr.sort((a, b) => {
          const sa = a.sold_count || 0;
          const sb = b.sold_count || 0;
          if (sa >= FEATURED_THRESHOLD && sb < FEATURED_THRESHOLD) return -1;
          if (sb >= FEATURED_THRESHOLD && sa < FEATURED_THRESHOLD) return 1;
          return (b.product_id || 0) - (a.product_id || 0);
        });
        break;
    }
    return arr;
  }, [filtered, sort]);

  // Featured picks: top product if it has meaningful sales and we're on "featured" or "bestselling" sort.
  const canPromote = sort === "featured" || sort === "bestselling";
  const featured: ShopProduct | null =
    canPromote && sorted.length > 3 && (sorted[0].sold_count || 0) >= 1 ? sorted[0] : null;
  const rest: ShopProduct[] = featured ? sorted.slice(1) : sorted;

  return (
    <Box data-testid="shop-client">
      <ShopHero merchant={merchant} products={products} shopUrl={shopUrl} />

      {products.length === 0 ? (
        <ShopEmpty merchant={merchant} isOwner={isOwner} />
      ) : (
        <>
          <ShopToolbar
            products={products}
            activeType={type}
            onTypeChange={setType}
            activeCategory={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
            visibleCount={sorted.length}
            query={query}
            onQueryChange={setQuery}
          />

          {sorted.length === 0 ? (
            <Box
              data-testid="shop-no-matches"
              sx={{
                py: { xs: 6, md: 10 },
                textAlign: "center",
                color: "text.secondary",
                fontSize: "1.05rem",
              }}
            >
              {t("shop.noMatches", { defaultValue: "No products match this filter. Try clearing filters or picking another category." })}
            </Box>
          ) : (
            <Grid container spacing={{ xs: 2.5, md: 3 }} data-testid="shop-grid">
              {featured && (
                <Grid item xs={12} md={8} data-testid="shop-featured-slot">
                  <ProductCard
                    product={featured}
                    merchantHandle={merchant.handle}
                    accent={merchant.accent}
                    variant="featured"
                    isTrending={(featured.sold_count || 0) >= FEATURED_THRESHOLD}
                  />
                </Grid>
              )}

              {/* When a featured card exists on desktop, fill the remaining 1/3
                  slot with the next best product to keep the top row balanced.
                  On mobile this same card just flows as a regular grid item below. */}
              {featured && rest.length > 0 && (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  data-testid="shop-featured-companion"
                >
                  <ProductCard
                    product={rest[0]}
                    merchantHandle={merchant.handle}
                    accent={merchant.accent}
                    variant="regular"
                    isTrending={(rest[0].sold_count || 0) >= FEATURED_THRESHOLD}
                  />
                </Grid>
              )}

              {/* All remaining products flow as a standard grid. When we have
                  a featured card we've already surfaced rest[0], so start from index 1. */}
              {(featured ? rest.slice(1) : rest).map((p) => (
                <Grid key={p.product_id} item xs={12} sm={6} md={4} lg={featured ? 4 : 3}>
                  <ProductCard
                    product={p}
                    merchantHandle={merchant.handle}
                    accent={merchant.accent}
                    variant="regular"
                    isTrending={(p.sold_count || 0) >= FEATURED_THRESHOLD}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
      <MiniCart handle={merchant.handle} />
    </Box>
  );
}
