/**
 * Cart page (public).
 * Route: /{handle}/cart
 * Reads localStorage cart, posts to /api/cart for revalidation,
 * displays normalized cart + link to checkout.
 */
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import ProductImage from "@/Components/UI/ProductImage";
import ProductCoverFallback from "@/Components/UI/ProductCoverFallback";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Stack, IconButton, Button, LinearProgress,
  Alert, Divider,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";
import { useTranslation } from "react-i18next";
import { toFixedStr } from "@/utils/money";
import { MIN_ORDER_CENTS } from "@/Components/Page/Shop/types";

interface NormalizedLine {
  product_id: number;
  variant_id: number | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  product_snapshot: {
    title: string; slug: string; cover_image_url?: string;
    product_type: string; digital_delivery_type?: string;
  };
  variant_snapshot?: any;
}

function formatPrice(cents: number, ccy: string, locale?: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat(locale || "en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${toFixedStr(n, 2)} ${ccy}`; }
}

const CartPage: NextPageWithLayout = () => {
  const router = useRouter();
  const rawHandle = router.query.handle;
  const handle = typeof rawHandle === "string" ? rawHandle.toLowerCase() : "";
  const cart = useCart();
  const items = handle ? cart.getItems(handle) : [];
  const itemsKey = JSON.stringify(items);
  const { t, i18n } = useTranslation("landing");
  const fmtP = (cents: number, ccy: string): string => formatPrice(cents, ccy, i18n.language);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [normalized, setNormalized] = useState<NormalizedLine[]>([]);
  const [subtotalCents, setSubtotalCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const [quote, setQuote] = useState<any | null>(null);
  const timezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!handle || items.length === 0) {
      setNormalized([]);
      setSubtotalCents(0);
      return;
    }
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    setLoading(true);
    setError(null);
    setWarnings([]);
    fetch(`${base}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_handle: handle,
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.message || t("cart.store.validationError", { defaultValue: "Cart validation failed" }));
        return j;
      })
      .then((j) => {
        const d = j?.data || {};
        setNormalized(d.normalized || []);
        setSubtotalCents(Number(d.subtotal_cents) || 0);
        setCurrency(d.currency || "USD");
        setWarnings(Array.isArray(d.warnings) ? d.warnings : []);
      })
      .catch((e) => setError(e?.message || t("cart.store.loadError", { defaultValue: "Failed to load cart" })))
      .finally(() => setLoading(false));
    // Re-run when local items change (itemsKey is the stringified items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, itemsKey, t]);

  // Session 57: estimated tax preview (based on buyer's timezone jurisdiction).
  useEffect(() => {
    if (!handle || items.length === 0) {
      setQuote(null);
      return;
    }
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    let cancelled = false;
    const tid = setTimeout(() => {
      fetch(`${base}/api/cart/quote-tax`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_handle: handle,
          items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
          timezone,
        }),
      })
        .then(async (r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!cancelled) setQuote(j?.data || null);
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, itemsKey, timezone]);

  const updateQty = (line: NormalizedLine, delta: number) => {
    const next = Math.max(0, (line.quantity || 0) + delta);
    if (next === 0) {
      cart.removeItem(handle, line.product_id, line.variant_id);
    } else {
      cart.updateQuantity(handle, line.product_id, line.variant_id, next);
    }
  };

  const removeLine = (line: NormalizedLine) => {
    cart.removeItem(handle, line.product_id, line.variant_id);
  };

  return (
    <>
      <Head><title>{`${t("cart.store.pageTitle", { defaultValue: "Cart" })} · @${handle} · Dynopay`}</title><meta name="robots" content="noindex" /></Head>
      <Container maxWidth="md" sx={{ pt: { xs: "88px", md: "112px" }, pb: { xs: 3, md: 5 } }} data-testid="cart-page">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>{t("cart.store.title", { defaultValue: "Your cart" })}</Typography>
        {loading && <LinearProgress data-testid="cart-loading" />}
        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="cart-error">{error}</Alert>}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="cart-warnings">
            <Stack spacing={0.5}>
              {warnings.map((w, i) => <Typography key={i} variant="body2">{w}</Typography>)}
            </Stack>
          </Alert>
        )}

        {normalized.length === 0 && !loading ? (
          <Stack spacing={2.5} alignItems="center" sx={{ py: 8 }} data-testid="cart-empty-state">
            <Box
              sx={{
                width: 72, height: 72, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "action.hover", color: "text.secondary",
              }}
            >
              <ShoppingBagOutlined sx={{ fontSize: 34 }} />
            </Box>
            <Typography color="text.secondary" sx={{ fontSize: 16 }} data-testid="cart-empty">
              {t("cart.store.empty", { defaultValue: "Your cart is empty." })}
            </Typography>
            <Button
              variant="contained"
              component={Link as any}
              href={`/${handle}/shop`}
              startIcon={<StorefrontRounded />}
              sx={{ textTransform: "none", borderRadius: 999, px: 3.5, py: 1.1, fontWeight: 700 }}
              data-testid="cart-empty-browse-btn"
            >
              {t("cart.store.browseShop", { defaultValue: "Browse the shop" })}
            </Button>
          </Stack>
        ) : (
          <>
            <Stack spacing={1.5} data-testid="cart-lines">
              {normalized.map((l) => (
                <Stack
                  key={`${l.product_id}-${l.variant_id || 0}`}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ sm: "center" }}
                  sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
                  data-testid={`cart-line-${l.product_id}-${l.variant_id || 0}`}
                >
                  <Box sx={{ position: "relative", width: 72, height: 72, borderRadius: 1.5, bgcolor: "grey.100", overflow: "hidden", flexShrink: 0 }}>
                    {l.product_snapshot.cover_image_url
                      ? <ProductImage src={l.product_snapshot.cover_image_url} alt="" sizes="72px" />
                      : <ProductCoverFallback title={l.product_snapshot.title || ""} fontSize={18} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{l.product_snapshot.title}</Typography>
                    {l.variant_snapshot?.attributes?.title && (
                      <Typography variant="caption" color="text.secondary">{l.variant_snapshot.attributes.title}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {t("cart.store.unitEach", { price: fmtP(l.unit_price_cents, currency), defaultValue: "{{price}} each" })}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton size="small" onClick={() => updateQty(l, -1)} data-testid={`cart-line-dec-${l.product_id}`} sx={{ width: { xs: 44, md: 34 }, height: { xs: 44, md: 34 } }}>
                      <RemoveRounded fontSize="small" />
                    </IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: "center" }} data-testid={`cart-line-qty-${l.product_id}`}>
                      {l.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => updateQty(l, +1)} data-testid={`cart-line-inc-${l.product_id}`} sx={{ width: { xs: 44, md: 34 }, height: { xs: 44, md: 34 } }}>
                      <AddRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography sx={{ fontWeight: 700, minWidth: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtP(l.line_total_cents, currency)}
                  </Typography>
                  <IconButton size="small" onClick={() => removeLine(l)} data-testid={`cart-line-remove-${l.product_id}`} sx={{ width: { xs: 44, md: 34 }, height: { xs: 44, md: 34 } }}>
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 3 }} />
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">{t("cart.store.subtotal", { defaultValue: "Subtotal" })}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="cart-subtotal">
                  {fmtP(subtotalCents, currency)}
                </Typography>
                {quote?.apply_tax && Number(quote?.tax_cents) > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }} data-testid="cart-est-tax">
                      {t("cart.store.estTax", {
                        label: quote?.tax_label || t("checkout.store.vatFallback", { defaultValue: "VAT" }),
                        rate: quote?.tax_rate != null ? ` (${Number(quote?.tax_rate)}%)` : "",
                        amount: fmtP(Number(quote?.tax_cents) || 0, quote?.currency || currency),
                        defaultValue: "+ est. {{label}}{{rate}}: {{amount}}",
                      })}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }} data-testid="cart-est-total">
                      {t("cart.store.estTotal", {
                        amount: fmtP(Number(quote?.total_cents ?? subtotalCents), quote?.currency || currency),
                        defaultValue: "Est. total: {{amount}}",
                      })}
                    </Typography>
                  </>
                )}
              </Box>
              <Button
                variant="outlined"
                component={Link as any}
                href={`/${handle}/shop`}
                sx={{ textTransform: "none" }}
                data-testid="cart-continue-btn"
              >
                {t("cart.store.continueShopping", { defaultValue: "Continue shopping" })}
              </Button>
              <Button
                variant="contained"
                onClick={() => router.push(`/${handle}/checkout`)}
                disabled={subtotalCents <= 0 || subtotalCents < MIN_ORDER_CENTS}
                sx={{ textTransform: "none" }}
                data-testid="cart-checkout-btn"
              >
                {t("cart.store.checkout", { defaultValue: "Checkout" })}
              </Button>
            </Stack>
            {/* D1: the $10 floor is shown here, not first at checkout */}
            {subtotalCents > 0 && subtotalCents < MIN_ORDER_CENTS && (
              <Alert severity="info" sx={{ mt: 2 }} data-testid="cart-min-order">
                {t("checkout.store.minTotalAdd", { min: fmtP(MIN_ORDER_CENTS, currency), more: fmtP(MIN_ORDER_CENTS - subtotalCents, currency), defaultValue: `Minimum order is ${fmtP(MIN_ORDER_CENTS, currency)} — add ${fmtP(MIN_ORDER_CENTS - subtotalCents, currency)} more to check out.` })}
              </Alert>
            )}
          </>
        )}
      </Container>
    </>
  );
};

(CartPage as unknown as { layout: string }).layout = "home";
export default CartPage;
