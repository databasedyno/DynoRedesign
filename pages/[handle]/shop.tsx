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
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { Container } from "@mui/material";
import { NextPageWithLayout } from "@/pages/_app";
import { ShopClient } from "@/Components/Page/Shop";
import type { ShopMerchant, ShopProduct } from "@/Components/Page/Shop/types";
import MerchantTrustRow from "@/Components/UI/MerchantTrustRow";
import { resolveMetaLang, shopSeoStrings } from "@/helpers/shopSeoMeta";
import { toFixedStr } from "@/utils/money";

interface ShopPageProps {
  merchant: ShopMerchant;
  products: ShopProduct[];
  siteUrl: string;
  metaLang: string;
  verified?: boolean;
}

const ShopPage: NextPageWithLayout<ShopPageProps> = ({ merchant, products, siteUrl, metaLang, verified }) => {
  const seo = shopSeoStrings(metaLang);
  const title = `${merchant.name} — ${seo.shopSuffix} · Dynopay`;
  const description =
    merchant.bio ||
    seo.shopDesc.replace("{name}", merchant.name);
  // "Verified Everywhere" — a verified marker in shared link previews so buyers
  // can spot a KYC-verified seller at a glance (✅ in the social title + a
  // localized "Verified merchant ·" prefix in the description).
  const socialTitle = verified ? `✅ ${title}` : title;
  const socialDescription = verified ? `${seo.verifiedPrefix} · ${description}` : description;
  const url = `${siteUrl}/${merchant.handle}/shop`;
  const ogImage =
    merchant.avatar || `${siteUrl}/og/default-shop.png`;
  // canonical: English is the single indexable version. Non-English is a
  // client-side ?lang= translation, not a distinct URL — so no hreflang cluster.
  const canonical = url;

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
          price: toFixedStr(((p.base_price_cents || 0) / 100), 2),
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
        <meta name="description" content={socialDescription} />
        <link key="canonical" rel="canonical" href={canonical} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta key="og:title" property="og:title" content={socialTitle} />
        <meta key="og:description" property="og:description" content={socialDescription} />
        <meta property="og:url" content={canonical} key="og:url" />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="Dynopay" />
        <meta key="og:locale" property="og:locale" content={metaLang} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={socialTitle} />
        <meta key="twitter:description" name="twitter:description" content={socialDescription} />
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
        {/* Trust row — buyer reassurance at the foot of the storefront. */}
        <MerchantTrustRow handle={merchant.handle} sx={{ mt: { xs: 5, md: 7 } }} />
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
  // SSR fetch base — hit the backend over an internal loopback URL so the
  // request bypasses Cloudflare + the bot-protection auto-block that silently
  // 403s public self-fetches. Falls back to the public URL if none is set.
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  // Public URL shown to the client — NEVER the internal loopback base.
  const siteUrl = getCreatorBaseUrl() || (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  // Shop lives only on the creator domain (dynopay.com) in production.
  let creatorHost = "";
  try { creatorHost = siteUrl ? new URL(siteUrl).host.toLowerCase() : ""; } catch { creatorHost = ""; }
  const reqHost = String(ctx.req.headers["x-forwarded-host"] || ctx.req.headers.host || "").split(",")[0].trim().toLowerCase();
  try {
    const r = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      console.error(`[SSR /[handle]/shop] shop fetch "${handle}" -> HTTP ${r.status} (base=${base})`);
      return { notFound: true };
    }
    const json = await r.json();
    const data = json?.data;
    if (!data?.merchant) return { notFound: true };
    if (process.env.NODE_ENV === "production" && creatorHost && reqHost && reqHost !== creatorHost) {
      return { redirect: { destination: `${siteUrl}${ctx.resolvedUrl}`, permanent: true } };
    }
    // Localized SEO meta from an explicit signal only (?lang= or dp_lang cookie).
    const metaLang = resolveMetaLang(ctx.query as Record<string, unknown>, ctx.req.headers.cookie);
    const queryLang = String((ctx.query as { lang?: unknown })?.lang || "").split("-")[0].toLowerCase();
    // Shared edge cache is safe for the English default or a URL-keyed ?lang=;
    // a cookie-driven non-English render is kept private so it can't poison the
    // shared cache for the next (default-language) visitor.
    if (metaLang === "en" || queryLang === metaLang) {
      ctx.res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
    } else {
      ctx.res.setHeader("Cache-Control", "private, no-store");
    }
    // Verified-merchant marker for shared link previews (best-effort, non-fatal).
    let verified = false;
    try {
      const vr = await fetch(
        `${base}/api/public/merchant-verification?handle=${encodeURIComponent(handle)}`,
        { headers: { Accept: "application/json" } }
      );
      if (vr.ok) {
        const vj = await vr.json();
        verified = Boolean(vj?.data?.verified);
      }
    } catch { /* ignore — just no verified marker */ }
    return {
      props: {
        merchant: data.merchant,
        products: Array.isArray(data.products) ? data.products : [],
        siteUrl,
        metaLang,
        verified,
      },
    };
  } catch (e) {
    console.error(`[SSR /[handle]/shop] "${handle}" render failed:`, e);
    return { notFound: true };
  }
};

export default ShopPage;
