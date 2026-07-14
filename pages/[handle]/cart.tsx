/**
 * Cart page (public).
 * Route: /{handle}/cart
 * Reads localStorage cart, posts to /api/cart for revalidation,
 * displays normalized cart + link to checkout.
 */
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Stack, IconButton, Button, LinearProgress,
  Alert, Divider,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";

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

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

const CartPage: NextPageWithLayout = () => {
  const router = useRouter();
  const rawHandle = router.query.handle;
  const handle = typeof rawHandle === "string" ? rawHandle.toLowerCase() : "";
  const cart = useCart();
  const items = handle ? cart.getItems(handle) : [];

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [normalized, setNormalized] = useState<NormalizedLine[]>([]);
  const [subtotalCents, setSubtotalCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");

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
        if (!r.ok) throw new Error(j?.message || "Cart validation failed");
        return j;
      })
      .then((j) => {
        const d = j?.data || {};
        setNormalized(d.normalized || []);
        setSubtotalCents(Number(d.subtotal_cents) || 0);
        setCurrency(d.currency || "USD");
        setWarnings(Array.isArray(d.warnings) ? d.warnings : []);
      })
      .catch((e) => setError(e?.message || "Failed to load cart"))
      .finally(() => setLoading(false));
    // Re-run when local items change (stringify for equality)
  }, [handle, JSON.stringify(items)]);

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
      <Head><title>Cart · @{handle} · Dynopay</title><meta name="robots" content="noindex" /></Head>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }} data-testid="cart-page">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>Your cart</Typography>
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
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <Typography color="text.secondary" data-testid="cart-empty">Your cart is empty.</Typography>
            <Link href={`/${handle}/shop`}>← Continue shopping</Link>
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
                  <Box sx={{ width: 72, height: 72, borderRadius: 1.5, bgcolor: "grey.100", overflow: "hidden", flexShrink: 0 }}>
                    {l.product_snapshot.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.product_snapshot.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{l.product_snapshot.title}</Typography>
                    {l.variant_snapshot?.attributes?.title && (
                      <Typography variant="caption" color="text.secondary">{l.variant_snapshot.attributes.title}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {formatPrice(l.unit_price_cents, currency)} each
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton size="small" onClick={() => updateQty(l, -1)} data-testid={`cart-line-dec-${l.product_id}`}>
                      <RemoveRounded fontSize="small" />
                    </IconButton>
                    <Typography sx={{ minWidth: 24, textAlign: "center" }} data-testid={`cart-line-qty-${l.product_id}`}>
                      {l.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => updateQty(l, +1)} data-testid={`cart-line-inc-${l.product_id}`}>
                      <AddRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography sx={{ fontWeight: 700, minWidth: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {formatPrice(l.line_total_cents, currency)}
                  </Typography>
                  <IconButton size="small" onClick={() => removeLine(l)} data-testid={`cart-line-remove-${l.product_id}`}>
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 3 }} />
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="cart-subtotal">
                  {formatPrice(subtotalCents, currency)}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                component={Link as any}
                href={`/${handle}/shop`}
                sx={{ textTransform: "none" }}
                data-testid="cart-continue-btn"
              >
                Continue shopping
              </Button>
              <Button
                variant="contained"
                onClick={() => router.push(`/${handle}/checkout`)}
                disabled={subtotalCents <= 0}
                sx={{ textTransform: "none" }}
                data-testid="cart-checkout-btn"
              >
                Checkout
              </Button>
            </Stack>
          </>
        )}
      </Container>
    </>
  );
};

(CartPage as unknown as { layout: string }).layout = "home";
export default CartPage;
