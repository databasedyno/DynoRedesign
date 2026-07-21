/**
 * Product detail page (public).
 * Route: /{handle}/p/{slug}
 * Buyer picks variant + qty, adds to cart, jumps to /{handle}/cart.
 */
import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import ProductImage from "@/Components/UI/ProductImage";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Stack, Chip, TextField, IconButton, Divider,
  MenuItem, Select, FormControl, InputLabel, Button, Alert,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";

interface Merchant { handle: string; name: string; avatar?: string | null }
interface Product {
  product_id: number; product_type: string; title: string; slug: string;
  subtitle?: string; description_md?: string;
  base_price_cents: number; currency: string;
  cover_image_url?: string; gallery_images?: Array<{ url: string; alt?: string }>;
  has_variants?: boolean; base_stock?: number | null; sold_count?: number;
}
interface Variant {
  variant_id: number; attributes?: any; price_cents: number;
  stock_count: number | null; image_url?: string; is_active: boolean;
}
interface DetailProps { merchant: Merchant; product: Product; variants: Variant[]; siteUrl: string }

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

const ProductDetail: NextPageWithLayout<DetailProps> = ({ merchant, product, variants, siteUrl }) => {
  const router = useRouter();
  const cart = useCart();
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
      quantity,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const buyNow = () => {
    addToCart();
    setTimeout(() => router.push(`/${merchant.handle}/cart`), 200);
  };

  const title = `${product.title} — @${merchant.handle} · Dynopay`;
  const description = product.subtitle || product.description_md?.slice(0, 200) || `Buy ${product.title} with crypto.`;
  const url = `${siteUrl}/${merchant.handle}/p/${product.slug}`;
  const cover = product.cover_image_url;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {cover && <meta property="og:image" content={cover} />}
      </Head>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="product-detail">
        <Typography variant="body2" sx={{ mb: 2 }}>
          <Link href={`/${merchant.handle}/shop`} style={{ color: "inherit" }}>
            ← Back to {merchant.name}'s shop
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
              {product.has_variants && !selectedVariant ? "from " : ""}
              {formatPrice(unitPriceCents, product.currency)}
            </Typography>
            {(product.sold_count || 0) > 0 && (
              <Chip size="small" label={`${product.sold_count} sold`} sx={{ alignSelf: "flex-start" }} />
            )}

            {product.has_variants && activeVariants.length > 0 && (
              <FormControl fullWidth>
                <InputLabel id="vsel">Choose an option</InputLabel>
                <Select
                  labelId="vsel"
                  label="Choose an option"
                  value={variantId}
                  onChange={(e) => setVariantId(Number(e.target.value))}
                  inputProps={{ "data-testid": "product-detail-variant-select" }}
                >
                  {activeVariants.map((v) => (
                    <MenuItem key={v.variant_id} value={v.variant_id} data-testid={`product-detail-variant-opt-${v.variant_id}`}>
                      {(v.attributes?.title || `Variant ${v.variant_id}`)} · {formatPrice(v.price_cents, product.currency)}
                      {v.stock_count != null && ` · ${v.stock_count} left`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">Quantity</Typography>
              <IconButton size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))} data-testid="product-detail-qty-dec">
                <RemoveRounded fontSize="small" />
              </IconButton>
              <TextField
                size="small"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                inputProps={{ "data-testid": "product-detail-qty-input", style: { textAlign: "center", width: 40 } }}
              />
              <IconButton size="small" onClick={() => setQuantity((q) => q + 1)} data-testid="product-detail-qty-inc">
                <AddRounded fontSize="small" />
              </IconButton>
              {stockLeft != null && (
                <Typography variant="caption" color="text.secondary">
                  {stockLeft} left
                </Typography>
              )}
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ShoppingCartRounded />}
                onClick={addToCart}
                disabled={!canAdd}
                data-testid="product-detail-add-to-cart"
                sx={{ textTransform: "none", py: 1.25 }}
              >
                Add to cart
              </Button>
              <Button
                variant="contained"
                onClick={buyNow}
                disabled={!canAdd}
                data-testid="product-detail-buy-now"
                sx={{ textTransform: "none", py: 1.25, flex: 1 }}
              >
                Buy now
              </Button>
            </Stack>

            {added && (
              <Alert severity="success" data-testid="product-detail-added">
                Added to cart. <Link href={`/${merchant.handle}/cart`}>View cart →</Link>
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
    </>
  );
};

(ProductDetail as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const handle = String(ctx.params?.handle || "").toLowerCase();
  const slug = String(ctx.params?.slug || "").toLowerCase();
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}/products/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return { notFound: true };
    const json = await r.json();
    const data = json?.data;
    if (!data?.product) return { notFound: true };
    return {
      props: {
        merchant: data.merchant,
        product: data.product,
        variants: Array.isArray(data.variants) ? data.variants : [],
        siteUrl: base,
      },
    };
  } catch {
    return { notFound: true };
  }
};

export default ProductDetail;
