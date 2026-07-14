/**
 * Checkout page (public).
 * Route: /{handle}/checkout
 * Collects buyer email + optional name; POST /api/checkout; redirects to
 * CleanCheckoutV2 at /pay?d=<payment_ref>.
 */
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Stack, TextField, Button, LinearProgress,
  Alert, Divider,
} from "@mui/material";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

const CheckoutPage: NextPageWithLayout = () => {
  const router = useRouter();
  const rawHandle = router.query.handle;
  const handle = typeof rawHandle === "string" ? rawHandle.toLowerCase() : "";
  const cart = useCart();
  const items = handle ? cart.getItems(handle) : [];

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [validating, setValidating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subtotalCents, setSubtotalCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const [lines, setLines] = useState<any[]>([]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    if (!handle) return;
    if (items.length === 0) {
      setLines([]); setSubtotalCents(0);
      return;
    }
    setValidating(true);
    setError(null);
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
        setLines(d.normalized || []);
        setSubtotalCents(Number(d.subtotal_cents) || 0);
        setCurrency(d.currency || "USD");
        setWarnings(Array.isArray(d.warnings) ? d.warnings : []);
      })
      .catch((e) => setError(e?.message || "Cart error"))
      .finally(() => setValidating(false));
  }, [handle, JSON.stringify(items), base]);

  const submit = async () => {
    setError(null);
    if (!emailValid) { setError("Enter a valid email address."); return; }
    if (lines.length === 0) { setError("Your cart is empty."); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${base}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_handle: handle,
          items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
          buyer: { email: email.trim(), name: name.trim() || undefined },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Checkout failed");
      const orderRef = j?.data?.order_public_ref;
      const paymentRef = j?.data?.payment_ref;
      if (!paymentRef) throw new Error("Missing payment reference");
      // Clear cart for this handle (order is now paid-pending on the server side)
      cart.clearCart(handle);
      // Stash the order ref so the buyer can find their order from success page fallback
      if (orderRef && typeof window !== "undefined") {
        try { window.sessionStorage.setItem("last_order_ref", orderRef); } catch {}
      }
      router.push(`/pay?d=${paymentRef}`);
    } catch (e: any) {
      setError(e?.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head><title>Checkout · @{handle} · Dynopay</title><meta name="robots" content="noindex" /></Head>
      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }} data-testid="checkout-page">
        <Typography variant="body2" sx={{ mb: 2 }}>
          <Link href={`/${handle}/cart`} style={{ color: "inherit" }}>← Back to cart</Link>
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>Checkout</Typography>

        {(validating || submitting) && <LinearProgress data-testid="checkout-loading" sx={{ mb: 2 }} />}
        {error && <Alert severity="error" sx={{ mb: 2 }} data-testid="checkout-error">{error}</Alert>}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="checkout-warnings">
            <Stack spacing={0.5}>
              {warnings.map((w, i) => <Typography key={i} variant="body2">{w}</Typography>)}
            </Stack>
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ "data-testid": "checkout-email-input" }}
            helperText="We'll send your receipt + download links here."
          />
          <TextField
            label="Name (optional)"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ "data-testid": "checkout-name-input" }}
          />
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Stack spacing={1} sx={{ mb: 2 }} data-testid="checkout-summary">
          {lines.map((l) => (
            <Stack direction="row" key={`${l.product_id}-${l.variant_id || 0}`} justifyContent="space-between">
              <Typography variant="body2">
                {l.product_snapshot?.title} × {l.quantity}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(l.line_total_cents, currency)}
              </Typography>
            </Stack>
          ))}
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontWeight: 700 }}>Total</Typography>
            <Typography sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }} data-testid="checkout-total">
              {formatPrice(subtotalCents, currency)}
            </Typography>
          </Stack>
        </Stack>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={submit}
          disabled={submitting || validating || !emailValid || lines.length === 0}
          sx={{ textTransform: "none", py: 1.5 }}
          data-testid="checkout-pay-btn"
        >
          Pay with crypto →
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
          Powered by Dynopay · Payment settles directly to the merchant's wallet
        </Typography>
      </Container>
    </>
  );
};

(CheckoutPage as unknown as { layout: string }).layout = "home";
export default CheckoutPage;
