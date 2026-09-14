/**
 * Product detail page (public).
 * Route: /{handle}/p/{slug}
 * Buyer picks variant + qty, adds to cart, jumps to /{handle}/cart.
 */
import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ProductImage from "@/Components/UI/ProductImage";
import ProductCoverFallback from "@/Components/UI/ProductCoverFallback";
import { renderSimpleMarkdown } from "@/utils/simpleMarkdown";
import { MIN_ORDER_CENTS } from "@/Components/Page/Shop/types";
import PublicVerifiedBadge from "@/Components/UI/PublicVerifiedBadge";
import { GetServerSideProps } from "next";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { resolveMetaLang, shopSeoStrings } from "@/helpers/shopSeoMeta";
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
import { toFixedStr } from "@/utils/money";

interface Merchant { handle: string; name: string; avatar?: string | null; accent?: string | null }
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
interface DetailProps { merchant: Merchant; product: Product; variants: Variant[]; siteUrl: string; metaLang: string; verified?: boolean }

function formatPrice(cents: number, ccy: string, locale?: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(locale || "en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${toFixedStr(n, 2)} ${ccy}`; }
}

const ProductDetail: NextPageWithLayout<DetailProps> = ({ merchant, product, variants, siteUrl, metaLang, verified }) => {
  const cart = useCart();
  const router = useRouter();
  const { t, i18n } = useTranslation("landing");
  const locale = i18n.language;
  const fmt = (cents: number) => formatPrice(cents, product.currency, locale);
  // D9: gallery — cover first, then any extra images the merchant uploaded.
  const gallery = useMemo(() => {
    const imgs: Array<{ url: string; alt?: string }> = [];
    if (product.cover_image_url) imgs.push({ url: product.cover_image_url, alt: product.title });
    for (const g of product.gallery_images || []) if (g?.url && !imgs.some((i) => i.url === g.url)) imgs.push(g);
    return imgs;
  }, [product.cover_image_url, product.gallery_images, product.title]);
  const [activeImg, setActiveImg] = useState<number>(0);
  const descriptionHtml = useMemo(() => renderSimpleMarkdown(product.description_md || ""), [product.description_md]);
  const activeVariants = useMemo(() => (variants || []).filter((v) => v.is_active), [variants]);
  const [variantId, setVariantId] = useState<number | "">(activeVariants[0]?.variant_id || "");
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  const selectedVariant = useMemo(
    () => activeVariants.find((v) => v.variant_id === variantId) || null,
    [activeVariants, variantId]
  );

  const unitPriceCents = Number(
    product.has_variants ? selectedVariant?.price_cents || 0 : product.base_price_cents,
  ) || 0;

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

  // D6: "Buy now" is the highest-intent action — go straight to checkout.
  const buyNow = () => {
    addToCart();
    router.push(`/${merchant.handle}/checkout`);
  };

  // D1: the $10 order floor is surfaced HERE, not first at checkout.
  const belowMin = unitPriceCents > 0 && unitPriceCents * (product.hide_quantity ? 1 : quantity) < MIN_ORDER_CENTS;

  const title = `${product.title} — @${merchant.handle} · Dynopay`;
  const description = product.subtitle || product.description_md?.slice(0, 200) || shopSeoStrings(metaLang).productDesc.replace("{title}", product.title);
  // Verified-merchant marker in shared link previews.
  const socialTitle = verified ? `✅ ${title}` : title;
  const socialDescription = verified ? `${shopSeoStrings(metaLang).verifiedPrefix} · ${description}` : description;
  const url = `${siteUrl}/${merchant.handle}/p/${product.slug}`;
  // canonical: English is the single indexable version (no ?lang= hreflang cluster).
  const canonical = url;
  const cover = product.cover_image_url;
  const shownImg = gallery[activeImg] || gallery[0] || null;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={socialDescription} />
        <link key="canonical" rel="canonical" href={canonical} />
        <meta key="og:title" property="og:title" content={socialTitle} />
        <meta key="og:description" property="og:description" content={socialDescription} />
        <meta property="og:url" content={canonical} key="og:url" />
        {cover && <meta property="og:image" content={cover} />}
        <meta key="og:locale" property="og:locale" content={metaLang} />
        <meta key="twitter:title" name="twitter:title" content={socialTitle} />
        <meta key="twitter:description" name="twitter:description" content={socialDescription} />
        {cover && <meta name="twitter:image" content={cover} />}
      </Head>
      <Container maxWidth="lg" sx={{ pt: { xs: "88px", md: "112px" }, pb: { xs: 3, md: 5 } }} data-testid="product-detail">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 2, flexWrap: "wrap" }}>
          <Typography variant="body2">
            <Link href={`/${merchant.handle}/shop`} style={{ color: "inherit" }}>
              {t("shop.backToShop", { name: merchant.name, defaultValue: `← Back to ${merchant.name}’s shop` })}
            </Link>
          </Typography>
          <PublicVerifiedBadge handle={merchant.handle} size={15} ml={0} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 3, md: 5 } }}>
          <Box>
            <Box sx={{ position: "relative", bgcolor: "grey.100", aspectRatio: "1/1", borderRadius: 2, overflow: "hidden" }} data-testid="product-detail-image">
              {shownImg ? (
                <ProductImage src={shownImg.url} alt={shownImg.alt || product.title} sizes="(max-width: 900px) 90vw, 45vw" />
              ) : (
                <ProductCoverFallback title={product.title} accent={merchant.accent} fontSize={96} data-testid="product-detail-cover-fallback" />
              )}
            </Box>
            {/* D9: thumbnail strip when the merchant uploaded gallery images */}
            {gallery.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: "auto", pb: 0.5 }} data-testid="product-detail-gallery">
                {gallery.map((g, i) => (
                  <Box
                    key={g.url}
                    component="button"
                    type="button"
                    onClick={() => setActiveImg(i)}
                    aria-label={`${t("shop.galleryImage", { defaultValue: "Image" })} ${i + 1}`}
                    data-testid={`product-detail-thumb-${i}`}
                    sx={{
                      position: "relative", width: 64, height: 64, flexShrink: 0, p: 0, borderRadius: 1.5, overflow: "hidden", cursor: "pointer",
                      border: (th) => `2px solid ${i === activeImg ? th.palette.primary.main : th.palette.divider}`,
                      bgcolor: "grey.100",
                    }}
                  >
                    <ProductImage src={g.url} alt={g.alt || ""} sizes="64px" />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} data-testid="product-detail-title">
              {product.title}
            </Typography>
            {product.subtitle && (
              <Typography variant="body1" color="text.secondary">{product.subtitle}</Typography>
            )}
            <Typography component="p" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: { xs: "1.75rem", md: "2.25rem" }, lineHeight: 1.1, letterSpacing: "-0.02em" }} data-testid="product-detail-price">
              {product.has_variants && !selectedVariant ? `${t("shop.fromPrice", { defaultValue: "from" })} ` : ""}
              {fmt(unitPriceCents)}
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
                      {(v.attributes?.title || t("shop.variantFallback", { id: v.variant_id, defaultValue: `Variant ${v.variant_id}` }))} · {fmt(v.price_cents)}
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

            {belowMin && (
              <Alert severity="info" icon={<Icon icon="mdi:cart-plus" width={20} />} data-testid="product-detail-min-order">
                {t("shop.minOrderNotice", {
                  min: fmt(MIN_ORDER_CENTS),
                  defaultValue: `Minimum order is ${fmt(MIN_ORDER_CENTS)} — add this to your cart and combine it with other items to check out.`,
                })}
              </Alert>
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
                disabled={!canAdd || belowMin}
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
                {/* D5: rendered (sanitized) markdown instead of a raw <pre> block */}
                <Box
                  data-testid="product-detail-description"
                  className="product-description"
                  sx={{
                    fontSize: "0.95rem", lineHeight: 1.65, color: "text.primary",
                    "& p": { m: 0, mb: 1.25 }, "& p:last-child": { mb: 0 },
                    "& ul, & ol": { pl: 2.5, mb: 1.25 }, "& li": { mb: 0.5 },
                    "& h3, & h4, & h5, & h6": { fontWeight: 700, mt: 2, mb: 0.75, lineHeight: 1.3 },
                    "& h3": { fontSize: "1.15rem" }, "& h4": { fontSize: "1.05rem" },
                    "& a": { color: "primary.main", textDecoration: "underline" },
                    "& code": { fontFamily: "var(--font-tech), monospace", fontSize: "0.9em", px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: "action.hover" },
                    "& blockquote": { m: 0, mb: 1.25, pl: 2, borderLeft: "3px solid", borderColor: "divider", color: "text.secondary" },
                    "& hr": { border: 0, borderTop: "1px solid", borderColor: "divider", my: 2 },
                  }}
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
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
        product: data.product,
        variants: Array.isArray(data.variants) ? data.variants : [],
        siteUrl,
        metaLang,
        verified,
      },
    };
  } catch (e) {
    console.error(`[SSR /[handle]/p/[slug]] "${handle}/${slug}" render failed:`, e);
    return { notFound: true };
  }
};

export default ProductDetail;
