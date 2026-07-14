/**
 * Public shop grid for a merchant. Buyers browse live products.
 * Route: /{handle}/shop
 * SSR for SEO — pulls from GET /api/shop/:handle.
 */
import React from "react";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import {
  Box, Container, Typography, Grid, Card, CardActionArea, CardContent, Avatar, Chip,
} from "@mui/material";
import { NextPageWithLayout } from "@/pages/_app";

interface Merchant { handle: string; name: string; avatar?: string | null; bio?: string | null }
interface Product {
  product_id: number; product_type: string; title: string; slug: string;
  subtitle?: string; base_price_cents: number; currency: string;
  cover_image_url?: string; has_variants?: boolean; sold_count?: number;
}
interface ShopPageProps { merchant: Merchant; products: Product[]; siteUrl: string }

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${ccy}`;
  }
}

const ShopPage: NextPageWithLayout<ShopPageProps> = ({ merchant, products, siteUrl }) => {
  const title = `${merchant.name} — Shop · Dynopay`;
  const description = merchant.bio || `Support ${merchant.name} — buy digital products with crypto.`;
  const url = `${siteUrl}/${merchant.handle}/shop`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
      </Head>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }} data-testid="shop-page">
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
          <Avatar
            src={merchant.avatar || undefined}
            alt={merchant.name}
            sx={{ width: 56, height: 56 }}
            data-testid="shop-merchant-avatar"
          >
            {merchant.name?.slice(0, 1)?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }} data-testid="shop-merchant-name">
              {merchant.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" data-testid="shop-merchant-handle">
              @{merchant.handle}
            </Typography>
          </Box>
        </Box>

        {products.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" data-testid="shop-empty">
              This shop is being set up. Check back soon!
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3} data-testid="shop-grid">
            {products.map((p) => (
              <Grid item xs={12} sm={6} md={4} key={p.product_id}>
                <Card
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
                  }}
                  data-testid={`shop-product-card-${p.product_id}`}
                >
                  <CardActionArea component={Link as any} href={`/${merchant.handle}/p/${p.slug}`}>
                    <Box sx={{ aspectRatio: "16/10", bgcolor: "grey.100", position: "relative" }}>
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.cover_image_url}
                          alt={p.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled", fontSize: 40 }}>◫</Box>
                      )}
                    </Box>
                    <CardContent>
                      <Typography sx={{ fontWeight: 600, minHeight: "1.5em", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                        {p.title}
                      </Typography>
                      {p.subtitle && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          {p.subtitle}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
                        <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {p.has_variants ? "from " : ""}{formatPrice(p.base_price_cents, p.currency)}
                        </Typography>
                        {(p.sold_count || 0) > 0 && (
                          <Chip size="small" label={`${p.sold_count} sold`} sx={{ ml: "auto" }} />
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </>
  );
};

// Public page — no merchant chrome
(ShopPage as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const handle = String(ctx.params?.handle || "").toLowerCase();
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return { notFound: true };
    const json = await r.json();
    const data = json?.data;
    if (!data?.merchant) return { notFound: true };
    return {
      props: {
        merchant: data.merchant,
        products: Array.isArray(data.products) ? data.products : [],
        siteUrl: base,
      },
    };
  } catch {
    return { notFound: true };
  }
};

export default ShopPage;
