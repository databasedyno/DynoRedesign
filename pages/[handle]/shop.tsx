/**
 * Public shop grid for a merchant. Buyers browse live products.
 *
 * Route: /{handle}/shop
 * SSR for SEO — pulls from GET /api/shop/:handle.
 *
 * Phase A (session 50 UX overhaul) — this page is now a thin SSR wrapper
 * over `Components/Page/Shop/ShopClient` which owns the interactive shell
 * (hero + toolbar + featured card + grid + empty state). All merchant-branded
 * UX + SEO markup lives here in the wrapper; grid interactivity lives in
 * the child client component.
 */
import React from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";
import { Container } from "@mui/material";
import { NextPageWithLayout } from "@/pages/_app";
import { ShopClient } from "@/Components/Page/Shop";
import type { ShopMerchant, ShopProduct } from "@/Components/Page/Shop/types";

interface ShopPageProps {
  merchant: ShopMerchant;
  products: ShopProduct[];
  siteUrl: string;
}

const ShopPage: NextPageWithLayout<ShopPageProps> = ({ merchant, products, siteUrl }) => {
  const title = `${merchant.name} — Shop · Dynopay`;
  const description =
    merchant.bio ||
    `Support ${merchant.name} — buy digital products, back campaigns, and tip in crypto. Direct to their wallet.`;
  const url = `${siteUrl}/${merchant.handle}/shop`;
  const ogImage =
    merchant.avatar || `${siteUrl}/og/default-shop.png`;

  // ── SEO JSON-LD ──
  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: merchant.name,
    url,
    image: merchant.avatar || undefined,
    description,
    ...(merchant.handle
      ? {
          identifier: `@${merchant.handle}`,
        }
      : {}),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 24).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.title,
        url: `${siteUrl}/${merchant.handle}/p/${p.slug}`,
        image: p.cover_image_url || undefined,
        description: p.subtitle || undefined,
        offers: {
          "@type": "Offer",
          price: ((p.base_price_cents || 0) / 100).toFixed(2),
          priceCurrency: (p.currency || "USD").toUpperCase(),
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="Dynopay" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* Structured data */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
        />
        {products.length > 0 && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
          />
        )}
      </Head>

      <Container
        maxWidth="lg"
        sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 6, md: 8 } }}
        data-testid="shop-page"
      >
        <ShopClient
          merchant={merchant}
          products={products}
          shopUrl={url}
        />
      </Container>
    </>
  );
};

// Public page — no merchant chrome
(ShopPage as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Feature flag (spec §13): kill-switch for the entire Product Catalog surface.
  // When NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG=false, /{handle}/shop returns 404.
  if (
    String(process.env.NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG ?? "true").toLowerCase() === "false"
  ) {
    return { notFound: true };
  }
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
