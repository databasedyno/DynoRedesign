/**
 * Product detail page (public).
 * Route: /{handle}/p/{slug}
 * Buyer picks variant + qty, adds to cart, jumps to /{handle}/cart.
 */
import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import ProductImage from "@/Components/UI/ProductImage";
import { GetServerSideProps } from "next";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { resolveMetaLang, shopSeoStrings, SEO_SUPPORTED } from "@/helpers/shopSeoMeta";
import {
  Box, Container, Typography, Stack, Chip, TextField, IconButton, Divider,
  MenuItem, Select, FormControl, InputLabel, Button, Alert,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import { Icon } from "@iconify/react";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";
import MiniCart, { OPEN_MINICART_EVENT } from "@/Components/Page/Shop/MiniCart";

interface Merchant { handle: string; name: string; avatar?: string | null }
interface Product {
  product_id: number; product_type: string; title: string; slug: string;
  subtitle?: string; description_md?: string;
  base_price_cents: number; currency: string;
  cover_image_url?: string; gallery_images?: Array<{ url: string; alt?: string }>;
  has_variants?: boolean; base_stock?: number | null; sold_count?: number;
  hide_quantity?: boolean;
}
interface Variant {
  variant_id: number; attributes?: any; price_cents: number;
  stock_count: number | null; image_url?: string; is_active: boolean;
}
interface DetailProps { merchant: Merchant; product: Product; variants: Variant[]; siteUrl: string; metaLang: string }

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

const ProductDetail: NextPageWithLayout<DetailProps> = ({ merchant, product, variants, siteUrl, metaLang }) => {
  const cart = useCart();
  const { t } = useTranslation("landing");
  const activeVariants = useMemo(() => (variants || []).filter((v) => v.is_active), [variants]);
  const [variantId, setVariantId] = useState<number | "">(activeVariants[0]?.variant_id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  const selectedVariant = useMemo(
    () => activeVariants.find((v) => v.variant_id === variantId) || null,
    [activeVariants, variantId]
  );

  const unitPriceCents = product.has_variants
    ? selectedVariant?.price_cents || 0
    : product.base_price_cents;

  const stockLeft = product.has_variants
    ? selectedVariant?.stock_count
    : product.base_stock;

  const canAdd =
    (!product.has_variants || selectedVariant) &&
    unitPriceCents > 0 &&
    (stockLeft == null || stockLeft > 0);

  const addToCart = () => {
    cart.addItem(merchant.handle, {
      product_id: product.product_id,
      variant_id: selectedVariant?.variant_id ?? null,
      quantity: product.hide_quantity ? 1 : quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const buyNow = () => {
    addToCart();
    // Stay-in-context (public-surfaces pass): open the cart SHEET over the
    // product instead of page-hopping to /{handle}/cart. The cart page keeps
    // working for old URLs and the sheet's "View full cart" link.
    setTimeout(() => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_MINICART_EVENT));
    }, 150);
  };

  const title = `${product.title} — @${merchant.handle} · Dynopay`;
  const description = product.subtitle || product.description_md?.slice(0, 200) || shopSeoStrings(metaLang).productDesc.replace("{title}", product.title);
  const url = `${siteUrl}/${merchant.handle}/p/${product.slug}`;
  // hreflang / canonical: English default = bare URL; other locales = ?lang=xx.
  const altHref = (lng: string) => (lng === "en" ? url : `${url}?lang=${lng}`);
  const canonical = altHref(metaLang);
  const cover = product.cover_image_url;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link key="canonical" rel="canonical" href={canonical} />
        {/* hreflang alternates — keys match _app's cluster so these override it */}
        {SEO_SUPPORTED.map((lng) => (
          <link key={lng} rel="alternate" hrefLang={lng} href={altHref(lng)} />
        ))}
        <link key="x-default" rel="alternate" hrefLang="x-default" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} key="og:url" />
        {cover && <meta property="og:image" content={cover} />}
        <meta key="og:locale" property="og:locale" content={metaLang} />
      </Head>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="product-detail">
        <Typography variant="body2" sx={{ mb: 2 }}>
          <Link href={`/${merchant.handle}/shop`} style={{ color: "inherit" }}>
            {t("shop.backToShop", { name: merchant.name, defaultValue: `← Back to ${merchant.name}’s shop` })}
          </Link>
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 3, md: 5 } }}>
          <Box sx={{ position: "relative", bgcolor: "grey.100", aspectRatio: "1/1", borderRadius: 2, overflow: "hidden" }} data-testid="product-detail-image">
            {cover ? (
              <ProductImage src={cover} alt={product.title} sizes="(max-width: 900px) 90vw, 45vw" />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled", fontSize: 80 }}>◫</Box>
            )}
          </Box>

          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} data-testid="product-detail-title">
              {product.title}
            </Typography>
            {product.subtitle && (
              <Typography variant="body1" color="text.secondary">{product.subtitle}</Typography>
            )}
            <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }} data-testid="product-detail-price">
              {product.has_variants && !selectedVariant ? `${t("shop.fromPrice", { defaultValue: "from" })} ` : ""}
              {formatPrice(unitPriceCents, product.currency)}
            </Typography>
            {(product.sold_count || 0) > 0 && (
              <Chip size="small" label={t("shop.soldCount", { count: product.sold_count, defaultValue: `${product.sold_count} sold` })} sx={{ alignSelf: "flex-start" }} />
            )}

            {product.has_variants && activeVariants.length > 0 && (
              <FormControl fullWidth>
                <InputLabel id="vsel">{t("shop.chooseOption", { defaultValue: "Choose an option" })}</InputLabel>
                <Select
                  labelId="vsel"
                  label={t("shop.chooseOption", { defaultValue: "Choose an option" })}
                  value={variantId}
                  onChange={(e) => setVariantId(Number(e.target.value))}
                  inputProps={{ "data-testid": "product-detail-variant-select" }}
                >
                  {activeVariants.map((v) => (
                    <MenuItem key={v.variant_id} value={v.variant_id} data-testid={`product-detail-variant-opt-${v.variant_id}`}>
                      {(v.attributes?.title || t("shop.variantFallback", { id: v.variant_id, defaultValue: `Variant ${v.variant_id}` }))} · {formatPrice(v.price_cents, product.currency)}
                      {v.stock_count != null && ` · ${t("shop.stockLeft", { count: v.stock_count, defaultValue: `${v.stock_count} left` })}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Quantity selector — hidden for one-off "service" products (#2c),
                e.g. "Talk to a Developer", where a quantity makes no sense. */}
            {product.hide_quantity ? (
              <Chip
                size="small"
                variant="outlined"
                icon={<Icon icon="mdi:account-wrench-outline" width={16} />}
                label={t("shop.oneOffService", { defaultValue: "One-off service" })}
                data-testid="product-detail-service-badge"
                sx={{ alignSelf: "flex-start" }}
              />
            ) : (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2">{t("shop.quantity", { defaultValue: "Quantity" })}</Typography>
                <IconButton onClick={() => setQuantity((q) => Math.max(1, q - 1))} data-testid="product-detail-qty-dec" sx={{ width: 44, height: 44 }}>
                  <RemoveRounded fontSize="small" />
                </IconButton>
                <TextField
                  size="small"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  inputProps={{ "data-testid": "product-detail-qty-input", inputMode: "numeric", style: { textAlign: "center", width: 40, minHeight: 28 } }}
                />
                <IconButton onClick={() => setQuantity((q) => q + 1)} data-testid="product-detail-qty-inc" sx={{ width: 44, height: 44 }}>
                  <AddRounded fontSize="small" />
                </IconButton>
                {stockLeft != null && (
                  <Typography variant="caption" color="text.secondary">
                    {t("shop.stockLeft", { count: stockLeft, defaultValue: `${stockLeft} left` })}
                  </Typography>
                )}
              </Stack>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ShoppingCartRounded />}
                onClick={addToCart}
                disabled={!canAdd}
                data-testid="product-detail-add-to-cart"
                sx={{ textTransform: "none", py: 1.25 }}
              >
                {t("shop.addToCart", { defaultValue: "Add to cart" })}
              </Button>
              <Button
                variant="contained"
                onClick={buyNow}
                disabled={!canAdd}
                data-testid="product-detail-buy-now"
                sx={{ textTransform: "none", py: 1.25, flex: 1 }}
              >
                {t("shop.buyNow", { defaultValue: "Buy now" })}
              </Button>
            </Stack>

            {added && (
              <Alert severity="success" data-testid="product-detail-added">
                {t("shop.addedToCart", { defaultValue: "Added to cart." })}{" "}
                <Box
                  component="button"
                  type="button"
                  data-testid="product-detail-view-cart"
                  onClick={() => window.dispatchEvent(new CustomEvent(OPEN_MINICART_EVENT))}
                  sx={{ background: "none", border: "none", p: 0, cursor: "pointer", font: "inherit", color: "inherit", textDecoration: "underline", fontWeight: 700 }}
                >
                  {t("shop.viewCartArrow", { defaultValue: "View cart →" })}
                </Box>
              </Alert>
            )}
            {product.description_md && (
              <>
                <Divider sx={{ mt: 2 }} />
                <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                  {product.description_md}
                </Typography>
              </>
            )}
          </Stack>
        </Box>
      </Container>
      <MiniCart handle={merchant.handle} />
    </>
  );
};

(ProductDetail as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const handle = String(ctx.params?.handle || "").toLowerCase();
  const slug = String(ctx.params?.slug || "").toLowerCase();
  // SSR fetch base — internal loopback first (bypasses Cloudflare + bot-block).
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  // Public URL for the client — never the internal loopback base.
  const siteUrl = getCreatorBaseUrl() || (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  let creatorHost = "";
  try { creatorHost = siteUrl ? new URL(siteUrl).host.toLowerCase() : ""; } catch { creatorHost = ""; }
  const reqHost = String(ctx.req.headers["x-forwarded-host"] || ctx.req.headers.host || "").split(",")[0].trim().toLowerCase();
  try {
    const r = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}/products/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      console.error(`[SSR /[handle]/p/[slug]] product fetch "${handle}/${slug}" -> HTTP ${r.status} (base=${base})`);
      return { notFound: true };
    }
    const json = await r.json();
    const data = json?.data;
    if (!data?.product) return { notFound: true };
    if (process.env.NODE_ENV === "production" && creatorHost && reqHost && reqHost !== creatorHost) {
      return { redirect: { destination: `${siteUrl}${ctx.resolvedUrl}`, permanent: true } };
    }
    // Localized SEO meta from an explicit signal only (?lang= or dp_lang cookie).
    const metaLang = resolveMetaLang(ctx.query as Record<string, unknown>, ctx.req.headers.cookie);
    const queryLang = String((ctx.query as { lang?: unknown })?.lang || "").split("-")[0].toLowerCase();
    // Shared edge cache stays for the English default / URL-keyed ?lang=; a
    // cookie-driven non-English render is private so it can't poison the cache.
    if (metaLang === "en" || queryLang === metaLang) {
      ctx.res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
    } else {
      ctx.res.setHeader("Cache-Control", "private, no-store");
    }
    return {
      props: {
        merchant: data.merchant,
        product: data.product,
        variants: Array.isArray(data.variants) ? data.variants : [],
        siteUrl,
        metaLang,
      },
    };
  } catch (e) {
    console.error(`[SSR /[handle]/p/[slug]] "${handle}/${slug}" render failed:`, e);
    return { notFound: true };
  }
};

export default ProductDetail;
