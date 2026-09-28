/**
 * Product detail page (public).
 * Route: /{handle}/p/{slug}
 * Buyer picks variant + qty, adds to cart, jumps to /{handle}/cart.
 *
 * Layout: media gallery (left) + sticky glass buy-box (right) on desktop;
 * gallery → buy-box → description → "More from {merchant}" on mobile.
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
import type { ShopProduct } from "@/Components/Page/Shop/types";
import ProductCard from "@/Components/Page/Shop/ProductCard";
import PublicVerifiedBadge from "@/Components/UI/PublicVerifiedBadge";
import { GetServerSideProps } from "next";
import { getCreatorBaseUrl } from "@/helpers/creatorUrl";
import { resolveMetaLang, shopSeoStrings } from "@/helpers/shopSeoMeta";
import { ssrFetchHeaders } from "@/helpers/ssrFetchHeaders";
import {
  Box, Container, Typography, Stack, Chip, TextField, IconButton,
  MenuItem, Select, FormControl, InputLabel, Button, Alert, Avatar, useTheme,
} from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import { Icon } from "@iconify/react";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";
import MiniCart, { OPEN_MINICART_EVENT } from "@/Components/Page/Shop/MiniCart";
import { toFixedStr } from "@/utils/money";
import { BRAND_ACCENT, BRAND_ON_ACCENT, brandFg } from "@/constants/theme";
import { GRAIN_URL, RISE_KEYFRAMES, readableOn, rise } from "@/constants/creatorTheme";

interface Merchant {
  handle: string; name: string; avatar?: string | null; accent?: string | null;
  cover_image?: string | null;
  theme?: { accent_color?: string | null; cover_style?: string | null; cover_gradient?: string | null } | null;
}
interface Product {
  product_id: number; product_type: string; title: string; slug: string;
  subtitle?: string; description_md?: string;
  base_price_cents: number; currency: string;
  cover_image_url?: string; gallery_images?: Array<{ url: string; alt?: string }>;
  has_variants?: boolean; base_stock?: number | null; sold_count?: number;
  hide_quantity?: boolean; category?: string | null;
}
interface Variant {
  variant_id: number; attributes?: any; price_cents: number;
  stock_count: number | null; image_url?: string; is_active: boolean;
}
interface DetailProps { merchant: Merchant; product: Product; variants: Variant[]; related: ShopProduct[]; siteUrl: string; metaLang: string; verified?: boolean }

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const HERO = "var(--font-hero), var(--font-sans)";
const TYPE_LABEL: Record<string, string> = { digital: "Digital", physical: "Physical", service: "Service" };
const TYPE_ICON: Record<string, string> = { digital: "mdi:download-outline", physical: "mdi:package-variant-closed", service: "mdi:account-wrench-outline" };

function formatPrice(cents: number, ccy: string, locale?: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(locale || "en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${toFixedStr(n, 2)} ${ccy}`; }
}

const ProductDetail: NextPageWithLayout<DetailProps> = ({ merchant, product, variants, related = [], siteUrl, metaLang, verified }) => {
  const cart = useCart();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("landing");
  const locale = i18n.language;
  const fmt = (cents: number) => formatPrice(cents, product.currency, locale);
  const accent = merchant.theme?.accent_color || merchant.accent || BRAND_ACCENT;
  const accentText = isDark ? accent : (readableOn(accent) === "#FFFFFF" ? accent : darken(accent, 0.38));
  const GRAD = `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #FFB300 100%)`;
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
  const typeKey = String(product.product_type || "").toLowerCase();
  const typeLabel = TYPE_LABEL[typeKey]
    ? t(`shop.type${typeKey.charAt(0).toUpperCase()}${typeKey.slice(1)}`, { defaultValue: TYPE_LABEL[typeKey] })
    : "";

  const glass = {
    borderRadius: "28px",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.06)"}`,
    background: isDark
      ? "linear-gradient(180deg, rgba(24,24,31,0.88) 0%, rgba(18,18,22,0.84) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.86) 100%)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: isDark
      ? "0 28px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
      : `0 28px 70px ${alpha(accent, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.95)`,
  };

  const trustItems = [
    { icon: "mdi:lightning-bolt", label: t("shop.trust.instant", { defaultValue: "Instant crypto checkout — no account needed" }) },
    { icon: "mdi:shield-check-outline", label: t("shop.trust.nonCustodial", { defaultValue: `Paid straight to ${merchant.name} — Dynopay never holds funds`, name: merchant.name }) },
    { icon: "mdi:receipt-text-outline", label: t("shop.trust.receipt", { defaultValue: "Receipt & order page delivered by email" }) },
  ];

  const qtyBtnSx = {
    width: 44, height: 44, borderRadius: "12px",
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
    transition: "border-color 140ms ease, background-color 140ms ease",
    "&:hover": { borderColor: accent, backgroundColor: alpha(accent, 0.08) },
  };

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
      <Box sx={{ position: "relative", overflow: "hidden", ...RISE_KEYFRAMES }}>
        <Box
          aria-hidden
          sx={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `radial-gradient(55% 32% at 30% 0%, ${alpha(accent, isDark ? 0.22 : 0.13)} 0%, transparent 70%), radial-gradient(34% 26% at 92% 62%, ${alpha("#0EA5E9", isDark ? 0.08 : 0.05)} 0%, transparent 70%)`,
          }}
        />
        <Container component="main" maxWidth="lg" sx={{ position: "relative", pt: { xs: "88px", md: "108px" }, pb: { xs: 16, md: 10 } }} data-testid="product-detail">
          {/* Merchant strip: back to shop + brand chip */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: { xs: 2.5, md: 3.5 }, flexWrap: "wrap", ...rise(0) }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              <Link href={`/${merchant.handle}/shop`} style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36 }} data-testid="product-detail-back-to-shop">
                <Icon icon="mdi:arrow-left" width={16} />
                {t("shop.backToShop", { name: merchant.name, defaultValue: `Back to ${merchant.name}’s shop` }).replace(/^←\s*/, "")}
              </Link>
            </Typography>
            <Box
              component={Link}
              href={`/${merchant.handle}`}
              data-testid="product-detail-merchant-chip"
              sx={{
                display: "inline-flex", alignItems: "center", gap: 1, pl: 0.5, pr: 1.5, minHeight: 40, borderRadius: "999px",
                border: `1px solid ${theme.palette.divider}`, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
                textDecoration: "none", color: theme.palette.text.primary,
                transition: "border-color 140ms ease, transform 140ms ease",
                "&:hover": { borderColor: accent, transform: "translateY(-1px)" },
              }}
            >
              <Avatar src={merchant.avatar || undefined} alt={merchant.name} sx={{ width: 30, height: 30, fontSize: 14, fontWeight: 800, bgcolor: accent, color: readableOn(accent), border: `2px solid ${alpha(accent, 0.5)}` }}>
                {(merchant.name || merchant.handle || "?").slice(0, 1).toUpperCase()}
              </Avatar>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>{merchant.name}</Typography>
              <PublicVerifiedBadge handle={merchant.handle} size={16} ml={0} />
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: { xs: 3, md: 5 },
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(360px, 0.95fr)" },
              gridTemplateAreas: { xs: '"gallery" "buybox" "description"', md: '"gallery buybox" "description buybox"' },
              alignItems: "start",
            }}
          >
            {/* ── Gallery ── */}
            <Box sx={{ gridArea: "gallery", ...rise(60) }}>
              <Box
                sx={{
                  position: "relative", aspectRatio: "1/1", borderRadius: { xs: "22px", md: "28px" }, overflow: "hidden",
                  bgcolor: alpha(accent, isDark ? 0.12 : 0.1),
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.06)"}`,
                  boxShadow: isDark ? "0 30px 70px rgba(0,0,0,0.5)" : `0 30px 70px ${alpha(accent, 0.14)}`,
                }}
                data-testid="product-detail-image"
              >
                {shownImg ? (
                  <ProductImage src={shownImg.url} alt={shownImg.alt || product.title} sizes="(max-width: 900px) 90vw, 45vw" />
                ) : (
                  <ProductCoverFallback title={product.title} accent={merchant.accent} fontSize={96} data-testid="product-detail-cover-fallback" />
                )}
                <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }} />
                {typeLabel && (
                  <Box sx={{ position: "absolute", top: 16, left: 16, display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, minHeight: 30, borderRadius: "999px", fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFFFFF", bgcolor: "rgba(10,10,13,0.62)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                    <Icon icon={TYPE_ICON[typeKey] || "mdi:tag-outline"} width={13} />
                    {typeLabel}
                  </Box>
                )}
              </Box>
              {/* D9: thumbnail strip when the merchant uploaded gallery images */}
              {gallery.length > 1 && (
                <Stack direction="row" spacing={1.25} sx={{ mt: 1.75, overflowX: "auto", pb: 0.5 }} data-testid="product-detail-gallery">
                  {gallery.map((g, i) => (
                    <Box
                      key={g.url}
                      component="button"
                      type="button"
                      onClick={() => setActiveImg(i)}
                      aria-label={`${t("shop.galleryImage", { defaultValue: "Image" })} ${i + 1}`}
                      data-testid={`product-detail-thumb-${i}`}
                      sx={{
                        position: "relative", width: 72, height: 72, flexShrink: 0, p: 0, borderRadius: "14px", overflow: "hidden", cursor: "pointer",
                        border: `2px solid ${i === activeImg ? accent : theme.palette.divider}`,
                        bgcolor: alpha(accent, 0.08),
                        opacity: i === activeImg ? 1 : 0.75,
                        transition: "border-color 140ms ease, opacity 140ms ease, transform 140ms ease",
                        "&:hover": { opacity: 1, transform: "translateY(-1px)" },
                      }}
                    >
                      <ProductImage src={g.url} alt={g.alt || ""} sizes="72px" />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            {/* ── Buy box (sticky on desktop) ── */}
            <Box sx={{ gridArea: "buybox", position: { md: "sticky" }, top: { md: 100 }, ...rise(120) }}>
              <Box sx={{ ...glass, p: { xs: 2.5, md: 3.5 }, position: "relative", overflow: "hidden" }}>
                <Box aria-hidden sx={{ position: "absolute", top: -140, right: -100, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(accent, isDark ? 0.22 : 0.16)} 0%, transparent 70%)`, pointerEvents: "none" }} />
                <Stack spacing={2} sx={{ position: "relative" }}>
                  {(product.category || (product.sold_count || 0) > 0) && (
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {product.category && (
                        <Chip size="small" label={product.category} sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", bgcolor: alpha(accent, isDark ? 0.14 : 0.1), color: accentText, border: `1px solid ${alpha(accent, 0.3)}` }} data-testid="product-detail-category" />
                      )}
                      {(product.sold_count || 0) > 0 && (
                        <Chip size="small" icon={<Icon icon="mdi:fire" width={14} color="#FFB300" />} label={t("shop.soldCount", { count: product.sold_count, defaultValue: `${product.sold_count} sold` })} sx={{ fontWeight: 700, bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(18,18,20,0.04)" }} />
                      )}
                    </Box>
                  )}
                  <Typography component="h1" sx={{ fontFamily: HERO, fontWeight: 800, fontSize: { xs: "1.6rem", md: "2rem" }, lineHeight: 1.15, letterSpacing: "-0.03em", color: theme.palette.text.primary, overflowWrap: "anywhere" }} data-testid="product-detail-title">
                    {product.title}
                  </Typography>
                  {product.subtitle && (
                    <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: theme.palette.text.secondary, mt: "-6px !important" }}>{product.subtitle}</Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                    <Typography component="p" sx={{ fontFamily: MONO, fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: { xs: "2rem", md: "2.5rem" }, lineHeight: 1, letterSpacing: "-0.03em" }} data-testid="product-detail-price">
                      {product.has_variants && !selectedVariant ? `${t("shop.fromPrice", { defaultValue: "from" })} ` : ""}
                      {fmt(unitPriceCents)}
                    </Typography>
                    <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {product.currency}
                    </Typography>
                  </Box>

                  {product.has_variants && activeVariants.length > 0 && (
                    <FormControl fullWidth>
                      <InputLabel id="vsel">{t("shop.chooseOption", { defaultValue: "Choose an option" })}</InputLabel>
                      <Select
                        labelId="vsel"
                        label={t("shop.chooseOption", { defaultValue: "Choose an option" })}
                        value={variantId}
                        onChange={(e) => setVariantId(Number(e.target.value))}
                        inputProps={{ "data-testid": "product-detail-variant-select" }}
                        sx={{ borderRadius: "14px", minHeight: 52 }}
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
                      sx={{ alignSelf: "flex-start", fontWeight: 600, borderColor: alpha(accent, 0.4) }}
                    />
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.secondary, minWidth: 64 }}>{t("shop.quantity", { defaultValue: "Quantity" })}</Typography>
                      <IconButton onClick={() => setQuantity((q) => Math.max(1, q - 1))} data-testid="product-detail-qty-dec" aria-label="Decrease quantity" sx={qtyBtnSx}>
                        <RemoveRounded fontSize="small" />
                      </IconButton>
                      <TextField
                        size="small"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        inputProps={{ "data-testid": "product-detail-qty-input", inputMode: "numeric", style: { textAlign: "center", width: 44, minHeight: 28, fontFamily: MONO, fontWeight: 700 } }}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px", minHeight: 44 } }}
                      />
                      <IconButton onClick={() => setQuantity((q) => q + 1)} data-testid="product-detail-qty-inc" aria-label="Increase quantity" sx={qtyBtnSx}>
                        <AddRounded fontSize="small" />
                      </IconButton>
                      {stockLeft != null && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
                          {t("shop.stockLeft", { count: stockLeft, defaultValue: `${stockLeft} left` })}
                        </Typography>
                      )}
                    </Stack>
                  )}

                  {belowMin && (
                    <Alert severity="info" icon={<Icon icon="mdi:cart-plus" width={20} />} data-testid="product-detail-min-order" sx={{ borderRadius: "14px" }}>
                      {t("shop.minOrderNotice", {
                        min: fmt(MIN_ORDER_CENTS),
                        defaultValue: `Minimum order is ${fmt(MIN_ORDER_CENTS)} — add this to your cart and combine it with other items to check out.`,
                      })}
                    </Alert>
                  )}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Button
                      variant="outlined"
                      startIcon={<ShoppingCartRounded />}
                      onClick={addToCart}
                      disabled={!canAdd}
                      data-testid="product-detail-add-to-cart"
                      sx={{ textTransform: "none", minHeight: 54, borderRadius: "16px", fontWeight: 700, fontSize: 15, px: 2.5, color: theme.palette.text.primary, borderColor: alpha(accent, 0.6), transition: "background-color 140ms ease, border-color 140ms ease", "&:hover": { borderColor: accent, backgroundColor: alpha(accent, 0.08) } }}
                    >
                      {t("shop.addToCart", { defaultValue: "Add to cart" })}
                    </Button>
                    <Button
                      variant="contained"
                      disableElevation
                      onClick={buyNow}
                      disabled={!canAdd || belowMin}
                      data-testid="product-detail-buy-now"
                      endIcon={<Icon icon="mdi:arrow-right" width={18} />}
                      sx={{
                        textTransform: "none", minHeight: 54, borderRadius: "16px", flex: 1, fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em",
                        background: GRAD, color: BRAND_ON_ACCENT, boxShadow: "0 14px 34px rgba(255,179,0,0.36)",
                        transition: "transform 140ms ease, box-shadow 140ms ease, filter 140ms ease",
                        "&:hover": { background: GRAD, filter: "brightness(1.06)", transform: "translateY(-1px)", boxShadow: "0 18px 42px rgba(255,179,0,0.46)" },
                        "&:active": { transform: "translateY(0) scale(0.99)" },
                        "&.Mui-disabled": { background: GRAD, opacity: 0.45, color: BRAND_ON_ACCENT, boxShadow: "none" },
                      }}
                    >
                      {t("shop.buyNow", { defaultValue: "Buy now" })}
                    </Button>
                  </Stack>

                  {added && (
                    <Alert severity="success" data-testid="product-detail-added" sx={{ borderRadius: "14px" }}>
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

                  {/* Trust strip */}
                  <Box data-testid="product-detail-trust" sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    {trustItems.map((item) => (
                      <Box key={item.icon} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(accent, isDark ? 0.14 : 0.1), color: accentText }}>
                          <Icon icon={item.icon} width={16} />
                        </Box>
                        <Typography sx={{ fontSize: 12.5, lineHeight: 1.45, color: theme.palette.text.secondary }}>{item.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              </Box>
            </Box>

            {/* ── Description ── */}
            {product.description_md && (
              <Box sx={{ gridArea: "description", ...rise(180) }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: 1.5 }}>
                  {t("shop.aboutProduct", { defaultValue: "About this product" })}
                </Typography>
                {/* D5: rendered (sanitized) markdown instead of a raw <pre> block */}
                <Box
                  data-testid="product-detail-description"
                  className="product-description"
                  sx={{
                    fontSize: "1rem", lineHeight: 1.7, color: "text.primary",
                    "& p": { m: 0, mb: 1.5 }, "& p:last-child": { mb: 0 },
                    "& ul, & ol": { pl: 2.5, mb: 1.5 }, "& li": { mb: 0.5 },
                    "& h3, & h4, & h5, & h6": { fontFamily: HERO, fontWeight: 700, mt: 2.5, mb: 0.75, lineHeight: 1.3, letterSpacing: "-0.02em" },
                    "& h3": { fontSize: "1.2rem" }, "& h4": { fontSize: "1.05rem" },
                    "& a": { color: brandFg(isDark), textDecoration: "underline" },
                    "& code": { fontFamily: MONO, fontSize: "0.9em", px: 0.6, py: 0.1, borderRadius: 0.75, bgcolor: "action.hover" },
                    "& blockquote": { m: 0, mb: 1.5, pl: 2, borderLeft: `3px solid ${alpha(accent, 0.6)}`, color: "text.secondary" },
                    "& hr": { border: 0, borderTop: "1px solid", borderColor: "divider", my: 2.5 },
                  }}
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </Box>
            )}
          </Box>

          {/* ── More from this merchant ── */}
          {related.length > 0 && (
            <Box data-testid="product-detail-related" sx={{ mt: { xs: 6, md: 9 }, ...rise(240) }}>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 2.5 }}>
                <Typography component="h2" sx={{ fontFamily: HERO, fontWeight: 800, fontSize: { xs: "1.25rem", md: "1.5rem" }, letterSpacing: "-0.02em" }}>
                  {t("shop.moreFrom", { name: merchant.name, defaultValue: `More from ${merchant.name}` })}
                </Typography>
                <Box component={Link} href={`/${merchant.handle}/shop`} data-testid="product-detail-related-all" sx={{ fontSize: 13.5, fontWeight: 700, color: accentText, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" } }}>
                  {t("creator.shopSection.viewAll", { defaultValue: "View all →" })}
                </Box>
              </Box>
              <Box sx={{ display: "grid", gap: { xs: 2, md: 3 }, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" } }}>
                {related.map((p) => (
                  <ProductCard key={p.product_id} product={p} merchantHandle={merchant.handle} accent={accent} variant="regular" />
                ))}
              </Box>
            </Box>
          )}
        </Container>
      </Box>

      {/* Phone sticky buy bar — price + Buy now pinned above the fold on small screens (Wave 6 D2). */}
      {canAdd && (
        <Box
          data-testid="product-sticky-buy-bar"
          sx={{
            position: "fixed", left: 0, right: 0, bottom: "var(--dp-lang-bar, 0px)", zIndex: 1250,
            display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5,
            px: 2, pt: 1.25, pb: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
            bgcolor: isDark ? "rgba(12,12,14,0.94)" : "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${theme.palette.divider}`, boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.2 }} noWrap>{product.title}</Typography>
            <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 19, fontVariantNumeric: "tabular-nums", lineHeight: 1.2, letterSpacing: "-0.02em" }} data-testid="product-sticky-price">
              {fmt(unitPriceCents * (product.hide_quantity ? 1 : quantity))}
            </Typography>
          </Box>
          <IconButton onClick={addToCart} aria-label={t("shop.addToCart", { defaultValue: "Add to cart" })} data-testid="product-sticky-add-to-cart" sx={{ width: 48, height: 48, border: `1px solid ${theme.palette.divider}`, borderRadius: "14px" }}>
            <ShoppingCartRounded fontSize="small" />
          </IconButton>
          <Button
            variant="contained"
            disableElevation
            onClick={buyNow}
            disabled={belowMin}
            data-testid="product-sticky-buy-now"
            sx={{ textTransform: "none", minHeight: 48, px: 3, borderRadius: "14px", fontWeight: 800, whiteSpace: "nowrap", background: GRAD, color: BRAND_ON_ACCENT, "&:hover": { background: GRAD, filter: "brightness(1.05)" }, "&.Mui-disabled": { background: GRAD, opacity: 0.45, color: BRAND_ON_ACCENT } }}
          >
            {t("shop.buyNow", { defaultValue: "Buy now" })}
          </Button>
        </Box>
      )}
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
  const headers = ssrFetchHeaders(ctx.req);
  try {
    const r = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}/products/${encodeURIComponent(slug)}`, { headers });
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
    // Verified-merchant marker + "More from" rail — both best-effort, non-fatal.
    let verified = false;
    let related: ShopProduct[] = [];
    const [vr, sr] = await Promise.all([
      fetch(`${base}/api/public/merchant-verification?handle=${encodeURIComponent(handle)}`, { headers }).catch(() => null),
      fetch(`${base}/api/shop/${encodeURIComponent(handle)}`, { headers }).catch(() => null),
    ]);
    try {
      if (vr && vr.ok) {
        const vj = await vr.json();
        verified = Boolean(vj?.data?.verified);
      }
    } catch { /* ignore — just no verified marker */ }
    try {
      if (sr && sr.ok) {
        const sj = await sr.json();
        const list = Array.isArray(sj?.data?.products) ? (sj.data.products as ShopProduct[]) : [];
        related = list.filter((p) => p.slug !== data.product.slug).slice(0, 3);
      }
    } catch { /* ignore — rail is optional */ }
    return {
      props: {
        merchant: data.merchant,
        product: data.product,
        variants: Array.isArray(data.variants) ? data.variants : [],
        related,
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
