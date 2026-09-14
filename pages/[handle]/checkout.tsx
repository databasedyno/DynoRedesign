/**
 * Checkout page (public).
 * Route: /{handle}/checkout
 * Collects buyer email (required) + optional name; POST /api/checkout; then
 * mounts the inline crypto checkout ON THIS PAGE (same UX as the creator tip
 * flow). "Change amount" returns to the cart; the cart is only cleared once
 * the payment is confirmed.
 */
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  Box, Container, Typography, Stack, TextField, Button, LinearProgress,
  Alert, Collapse, useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { NextPageWithLayout } from "@/pages/_app";
import { useCart } from "@/contexts/CartContext";
import InlineTipCheckout from "@/Components/Page/Creator/InlineTipCheckout";
import { PanelShell } from "@/Components/Page/Pay3Components/checkout/checkoutPrimitives";
import { CheckoutOrderSummary, CheckoutBrandHeader } from "@/Components/Page/Shop/CheckoutOrderSummary";
import { MIN_ORDER_CENTS, formatPrice as fmtPrice } from "@/Components/Page/Shop/types";

// Platform floor: minimum order total is $10 (matches tips / donations).
const MIN_TOTAL_CENTS = MIN_ORDER_CENTS;

const CheckoutPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation("landing");
  const formatPrice = (cents: number, ccy: string) => fmtPrice(cents, ccy, i18n.language);
  // D4: brand continuity — merchant name / avatar / accent on the money step.
  const [merchant, setMerchant] = useState<{ name: string; avatar?: string | null; accent?: string | null } | null>(null);
  const [showVat, setShowVat] = useState<boolean>(false);
  const rawHandle = router.query.handle;
  const handle = typeof rawHandle === "string" ? rawHandle.toLowerCase() : "";
  const cart = useCart();
  const items = handle ? cart.getItems(handle) : [];
  const itemsKey = JSON.stringify(items);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [validating, setValidating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subtotalCents, setSubtotalCents] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const [lines, setLines] = useState<any[]>([]);
  const [vatId, setVatId] = useState("");
  const [quote, setQuote] = useState<any | null>(null);
  // Inline payment — the store checkout stays ON THIS PAGE (same UX as the
  // creator tip flow) instead of redirecting to /pay.
  const [payRef, setPayRef] = useState<string | null>(null);
  const [orderPublicRef, setOrderPublicRef] = useState<string | null>(null);
  // The cart hydrates from localStorage after mount — wait a beat before
  // declaring it empty so buyers with items never see the empty state flash.
  const [cartReady, setCartReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setCartReady(true), 150); return () => clearTimeout(id); }, []);
  const cartEmpty = cartReady && items.length === 0 && !payRef;

  // Refresh persistence: /{handle}/checkout?pay=<ref> re-opens the inline
  // payment AND restores the order number (stashed at submit) so the order
  // reference stays visible on this page after a reload.
  useEffect(() => {
    const qp = router.query.pay;
    if (typeof qp === "string" && qp && !payRef) setPayRef(qp);
    if (typeof qp === "string" && qp && !orderPublicRef && typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage.getItem("last_order_ref");
        if (saved) setOrderPublicRef(saved);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.pay]);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }, []);

  // Email is REQUIRED on the store — buyers need a receipt / download links,
  // and (when no name is given) the confirmation email is addressed to it.
  const emailValid = useMemo(() => {
    const v = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [email]);
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    fetch(`${base}/api/shop/${encodeURIComponent(handle)}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.data?.merchant) setMerchant(j.data.merchant); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [handle, base]);

  const totalCents = Number(quote?.total_cents ?? subtotalCents) || 0;
  const belowMin = lines.length > 0 && totalCents > 0 && totalCents < MIN_TOTAL_CENTS;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, itemsKey, base]);

  // Session 57: live tax preview — recompute on cart or VAT-ID change (debounced).
  useEffect(() => {
    if (!handle || items.length === 0) {
      setQuote(null);
      return;
    }
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
          customer_vat_id: vatId.trim() || undefined,
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
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, itemsKey, base, vatId, timezone]);

  const submit = async () => {
    setError(null);
    if (!emailValid) { setError(t("checkout.store.emailRequired", { defaultValue: "Email is required so we can send your receipt." })); return; }
    if (lines.length === 0) { setError(t("checkout.store.emptyCart", { defaultValue: "Your cart is empty." })); return; }
    if (belowMin) { setError(t("checkout.store.minTotal", { min: formatPrice(MIN_TOTAL_CENTS, currency), defaultValue: `Minimum order total is ${formatPrice(MIN_TOTAL_CENTS, currency)}.` })); return; }
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
          customer_vat_id: vatId.trim() || undefined,
          timezone,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Checkout failed");
      const orderRef = j?.data?.order_public_ref;
      const paymentRef = j?.data?.payment_ref;
      if (!paymentRef) throw new Error("Missing payment reference");
      // Stash the order ref so it survives a refresh + lets the success page
      // find the order. The cart is NOT cleared until payment is confirmed,
      // so "Change amount" can return to the cart with items intact.
      if (orderRef && typeof window !== "undefined") {
        try { window.sessionStorage.setItem("last_order_ref", orderRef); } catch {}
      }
      // Stay on this page — mount the inline crypto checkout (same UX as tips).
      setOrderPublicRef(orderRef || null);
      setPayRef(paymentRef);
      router.replace(
        { pathname: `/${handle}/checkout`, query: { pay: paymentRef } },
        undefined,
        { shallow: true }
      );
    } catch (e: any) {
      setError(e?.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  const orderLabel = orderPublicRef
    ? `${t("checkout.store.orderPrefix", { defaultValue: "Order" })} ${orderPublicRef.slice(0, 8).toUpperCase()}`
    : `@${handle}`;

  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const border = isDark ? "#1F2D47" : "#E2E8F0";
  const muted = isDark ? "#94A3B8" : "#64748B";

  const summaryNode = (
    <CheckoutOrderSummary
      handle={handle}
      merchant={merchant}
      lines={lines}
      quote={quote}
      currency={currency}
      subtotalCents={subtotalCents}
      totalCents={totalCents}
      formatPrice={formatPrice}
    />
  );

  return (
    <>
      <Head><title>{`Checkout · @${handle} · Dynopay`}</title><meta name="robots" content="noindex" /></Head>
      <Container maxWidth="lg" disableGutters sx={{ pt: { xs: "64px", md: "88px" }, pb: { xs: 3, md: 5 }, px: { xs: 0, sm: 3 } }} data-testid="checkout-page">
        {cartEmpty ? (
          <Container maxWidth="sm" sx={{ pt: 3 }}>
            <Box sx={{ mb: 3 }}>
              <CheckoutBrandHeader handle={handle} merchant={merchant} />
            </Box>
            <Stack spacing={2.5} alignItems="center" sx={{ py: 6, textAlign: "center" }} data-testid="checkout-empty-state">
              <Box sx={{ width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover", color: "text.secondary" }}>
                <ShoppingBagOutlined sx={{ fontSize: 34 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 17 }} data-testid="checkout-empty-title">
                  {t("cart.store.empty", { defaultValue: "Your cart is empty." })}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
                  {t("checkout.store.emptyHint", { defaultValue: "Add something from the shop and come back to check out." })}
                </Typography>
              </Box>
              <Button
                variant="contained"
                component={Link as any}
                href={`/${handle}/shop`}
                startIcon={<StorefrontRounded />}
                sx={{ textTransform: "none", borderRadius: 999, px: 3.5, py: 1.1, fontWeight: 700 }}
                data-testid="checkout-empty-browse-btn"
              >
                {t("cart.store.browseShop", { defaultValue: "Browse the shop" })}
              </Button>
            </Stack>
          </Container>
        ) : (
        <PanelShell
          isDark={isDark}
          border={border}
          muted={muted}
          summary={summaryNode}
          summaryBar={{
            label: merchant?.name || `@${handle}`,
            amount: formatPrice(totalCents, quote?.currency || currency),
            toggleLabel: t("checkout.orderSummary", { defaultValue: "Order summary" }),
          }}
          outerSx={{ minHeight: "auto", px: 0, py: 0 }}
        >
        {!payRef && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <Link href={`/${handle}/cart`} style={{ color: "inherit" }} data-testid="checkout-back-to-cart">
              {t("checkout.store.backToCart", { defaultValue: "← Back to cart" })}
            </Link>
          </Typography>
        )}

        {payRef ? (
          <Box data-testid="checkout-inline-pay">
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, letterSpacing: "-0.01em" }} data-testid="checkout-complete-title">
              {t("checkout.store.completeTitle", { defaultValue: "Complete your payment" })}
            </Typography>
            {orderPublicRef && (
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }} data-testid="checkout-order-number">
                {orderLabel}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("checkout.store.completeSubtitle", { defaultValue: "Pay with crypto below. This page updates automatically once your payment is confirmed." })}
            </Typography>
            <InlineTipCheckout
              d={payRef}
              handle={handle}
              creatorName={`@${handle}`}
              style="support"
              siteUrl={typeof window !== "undefined" ? window.location.origin : ""}
              mode="link"
              targetLabel={orderLabel}
              collectReceiptEmail={false}
              successHref={orderPublicRef ? `/order/${encodeURIComponent(orderPublicRef)}` : undefined}
              successLabel={t("checkout.store.viewOrder", { defaultValue: "View your order & downloads" })}
              onConfirmed={() => cart.clearCart(handle)}
              onCancel={() => router.push(`/${handle}/cart`)}
              onNewTip={() => router.push(`/${handle}/shop`)}
            />
          </Box>
        ) : (
        <>
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
            label={t("checkout.store.emailLabel", { defaultValue: "Email for receipt & updates" })}
            type="email"
            required
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={email.trim().length > 0 && !emailValid}
            inputProps={{ "data-testid": "checkout-email-input" }}
            helperText={t("checkout.store.emailHelp", { defaultValue: "We'll email your receipt and any download links here." })}
          />
          <TextField
            label={t("checkout.store.nameLabel", { defaultValue: "Name (optional)" })}
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ "data-testid": "checkout-name-input" }}
          />
          {/* D4: VAT ID only matters for business buyers — keep it behind a toggle */}
          <Box>
            <Box
              component="button"
              type="button"
              onClick={() => setShowVat((v) => !v)}
              data-testid="checkout-vat-toggle"
              sx={{ background: "none", border: "none", p: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.secondary", fontSize: 13.5, fontWeight: 600, minHeight: 44 }}
            >
              <Icon icon={showVat || vatId ? "mdi:chevron-down" : "mdi:chevron-right"} width={18} />
              {t("checkout.store.businessPurchase", { defaultValue: "Business purchase? Add a VAT ID" })}
            </Box>
            <Collapse in={showVat || !!vatId}>
              <TextField
                label={t("checkout.store.vatLabel", { defaultValue: "VAT ID (optional)" })}
                fullWidth
                sx={{ mt: 1.5 }}
                value={vatId}
                onChange={(e) => setVatId(e.target.value.toUpperCase())}
                inputProps={{ "data-testid": "checkout-vat-input" }}
                placeholder="e.g. DE123456789"
                helperText={
                  quote?.reverse_charge
                    ? t("checkout.store.vatValid")
                    : vatId.trim() && quote && quote.customer_vat_id_valid === false
                    ? t("checkout.store.vatInvalid")
                    : t("checkout.store.vatHint")
                }
              />
            </Collapse>
          </Box>
        </Stack>

        {belowMin && (
          <Alert severity="info" sx={{ mt: 2 }} data-testid="checkout-min-total">
            {t("checkout.store.minTotal", { min: formatPrice(MIN_TOTAL_CENTS, currency), defaultValue: `Minimum order total is ${formatPrice(MIN_TOTAL_CENTS, currency)}.` })}
          </Alert>
        )}

        <Box sx={{ mt: "auto", pt: 3 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={submit}
            disabled={submitting || validating || !emailValid || lines.length === 0 || belowMin}
            sx={{ textTransform: "none", py: 1.5, borderRadius: 999, fontWeight: 700 }}
            data-testid="checkout-pay-btn"
          >
            {t("checkout.store.pay", { defaultValue: "Pay with crypto →" })}
          </Button>
        </Box>
        </>
        )}
        </PanelShell>
        )}
      </Container>
    </>
  );
};

(CheckoutPage as unknown as { layout: string }).layout = "home";
export default CheckoutPage;
