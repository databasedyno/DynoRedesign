/**
 * MiniCart — a persistent, always-visible cart affordance for the storefront.
 *
 * Fixes the "I can't see my cart after adding" gap: a floating pill (bottom-
 * left, clear of the support-chat FAB at bottom-right) shows the live item
 * count and opens a slide-in drawer with line items, quantity controls and a
 * direct path to checkout. Reads/writes the shared CartContext, so quantity
 * edits here stay in sync with the full cart page.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  Badge, Box, Drawer, IconButton, Typography, Button, Divider, Slide, Skeleton,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { MIN_ORDER_CENTS } from "./types";
import { BRAND_ACCENT } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { toFixedStr } from "@/utils/money";

interface Props { handle: string }

/** Fired by product pages ("Buy now" / "View cart") to open the cart sheet
 *  in place — buyers keep their browsing position (stay-in-context pattern). */
export const OPEN_MINICART_EVENT = "dynopay:open-minicart";

interface Line {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  line_total_cents: number;
  unit_price_cents: number;
  product_snapshot?: { title?: string; cover_image_url?: string | null; hide_quantity?: boolean };
  variant_snapshot?: { title?: string } | null;
}

function fmt(cents: number, ccy: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format((cents || 0) / 100);
  } catch { return `${toFixedStr(((cents || 0) / 100), 2)} ${ccy}`; }
}

const MiniCart: React.FC<Props> = ({ handle }) => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // The server-validated item count for the CURRENT localStorage snapshot.
  // Null until the first successful /api/cart validation resolves.
  const [validatedCount, setValidatedCount] = useState<number | null>(null);
  const [validatedKey, setValidatedKey] = useState<string>("");

  const items = handle ? cart.getItems(handle) : [];
  const rawCount = handle ? cart.totalCount(handle) : 0;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const itemsKey = JSON.stringify(items);

  // Badge/FAB count: prefer the server-validated count (which excludes stale
  // items the backend drops — deleted/unpublished/out-of-stock — and clamps
  // one-off services to 1). Fall back to the raw localStorage count until the
  // first validation for this exact snapshot lands, or if it failed.
  const count = validatedKey === itemsKey && validatedCount != null ? validatedCount : rawCount;

  const refresh = useCallback(() => {
    if (!handle || items.length === 0) {
      setLines([]); setSubtotal(0); setValidatedCount(0); setValidatedKey(itemsKey);
      return;
    }
    setLoading(true);
    fetch(`${base}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_handle: handle,
        items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })),
      }),
    })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => {
        const d = j?.data;
        // Only trust — and reconcile against — a genuine success payload.
        // A transient 4xx/5xx must NEVER be treated as "cart is empty" and
        // wipe the buyer's cart.
        if (!ok || !d || !Array.isArray(d.normalized)) return;
        const normalized = d.normalized as Line[];
        setLines(normalized);
        setCurrency(d.currency || "USD");
        setSubtotal(Number(d.subtotal_cents) || 0);
        setValidatedCount(normalized.reduce((s, l) => s + Number(l.quantity || 0), 0));
        setValidatedKey(itemsKey);
        // Prune stale entries / clamp quantities in localStorage so the badge,
        // drawer and checkout all agree on one source of truth.
        cart.reconcile(handle, normalized as any);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, itemsKey, base]);

  // Validate whenever the cart changes (mount + every add/remove) so the badge
  // is always accurate, and re-validate when the drawer opens for fresh prices.
  useEffect(() => { refresh(); }, [refresh, open]);

  // External open trigger (product page "Buy now" / "View cart").
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_MINICART_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MINICART_EVENT, onOpen);
  }, []);

  if (count <= 0 && !open) return null;

  const stepper = (l: Line) => {
    const isSingle = !!l.product_snapshot?.hide_quantity;
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {!isSingle && (
          <IconButton
            size="small"
            data-testid="minicart-dec"
            onClick={() => cart.updateQuantity(handle, l.product_id as any, l.variant_id as any, l.quantity - 1)}
            sx={{ border: "1px solid rgba(0,0,0,0.12)", width: { xs: 44, md: 28 }, height: { xs: 44, md: 28 } }}
          ><Icon icon="mdi:minus" width={15} /></IconButton>
        )}
        <Typography sx={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="minicart-qty">
          {l.quantity}
        </Typography>
        {!isSingle && (
          <IconButton
            size="small"
            data-testid="minicart-inc"
            onClick={() => cart.updateQuantity(handle, l.product_id as any, l.variant_id as any, l.quantity + 1)}
            sx={{ border: "1px solid rgba(0,0,0,0.12)", width: { xs: 44, md: 28 }, height: { xs: 44, md: 28 } }}
          ><Icon icon="mdi:plus" width={15} /></IconButton>
        )}
      </Box>
    );
  };

  return (
    <>
      <Slide direction="up" in={count > 0} mountOnEnter unmountOnExit>
        <Box
          role="button"
          data-testid="minicart-fab"
          onClick={() => setOpen(true)}
          sx={{
            position: "fixed", zIndex: 1600,
            left: { xs: 16, md: 24 },
            bottom: { xs: "calc(var(--dp-lang-bar, 0px) + 88px)", md: "calc(var(--dp-lang-bar, 0px) + 24px)" },
            display: "flex", alignItems: "center", gap: 1,
            px: 2, py: 1.25, borderRadius: "999px", cursor: "pointer",
            backgroundColor: BRAND_ACCENT, color: "#fff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
            transition: "transform .18s ease, box-shadow .18s ease",
            "&:hover": { transform: "translateY(-2px)", boxShadow: "0 14px 36px rgba(0,0,0,0.34)" },
          }}
        >
          <Badge badgeContent={count} color="error" data-testid="minicart-badge"
            sx={{ "& .MuiBadge-badge": { fontWeight: 800 } }}>
            <Icon icon="mdi:cart-outline" width={22} />
          </Badge>
          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
            {t("checkout.store.viewCart", { defaultValue: "View cart" })}
          </Typography>
        </Box>
      </Slide>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 400 }, p: 0 }, "data-testid": "minicart-drawer" } as any}>
        <Box sx={{ p: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {t("checkout.store.yourCart", { defaultValue: "Your cart" })}
          </Typography>
          <IconButton onClick={() => setOpen(false)} data-testid="minicart-close" sx={{ minWidth: 44, minHeight: 44 }}><Icon icon="mdi:close" /></IconButton>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
          {loading && lines.length === 0 ? (
            <>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1.5 }} />)}</>
          ) : lines.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }} data-testid="minicart-empty">
              <Icon icon="mdi:cart-off" width={40} />
              <Typography sx={{ mt: 1 }}>{t("checkout.store.emptyCart", { defaultValue: "Your cart is empty." })}</Typography>
            </Box>
          ) : (
            lines.map((l) => (
              <Box key={`${l.product_id}-${l.variant_id || 0}`} data-testid="minicart-line"
                sx={{ display: "flex", gap: 1.5, py: 1.5, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: "hidden", flexShrink: 0, bgcolor: "rgba(0,0,0,0.05)" }}>
                  {l.product_snapshot?.cover_image_url && (
                    <Box component="img" src={l.product_snapshot.cover_image_url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }} noWrap>{l.product_snapshot?.title}</Typography>
                  {l.variant_snapshot?.title && (
                    <Typography variant="caption" color="text.secondary">{l.variant_snapshot.title}</Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.75 }}>
                    {stepper(l)}
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(l.line_total_cents, currency)}</Typography>
                  </Box>
                </Box>
                <IconButton size="small" data-testid="minicart-remove"
                  onClick={() => cart.removeItem(handle, l.product_id as any, l.variant_id as any)}
                  sx={{ alignSelf: "flex-start", color: "text.secondary", minWidth: { xs: 44, md: "auto" }, minHeight: { xs: 44, md: "auto" } }}>
                  <Icon icon="mdi:trash-can-outline" width={18} />
                </IconButton>
              </Box>
            ))
          )}
        </Box>

        {lines.length > 0 && (
          <Box sx={{ p: 2.5, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{t("checkout.store.subtotal", { defaultValue: "Subtotal" })}</Typography>
              <Typography sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }} data-testid="minicart-subtotal">{fmt(subtotal, currency)}</Typography>
            </Box>
            {/* D1: the $10 floor is shown here, not first at checkout */}
            {subtotal > 0 && subtotal < MIN_ORDER_CENTS && (
              <Typography variant="body2" data-testid="minicart-min-order" sx={{ mb: 1.5, color: "text.secondary", display: "flex", gap: 0.75, alignItems: "flex-start" }}>
                <Icon icon="mdi:information-outline" width={18} style={{ flexShrink: 0 }} />
                {t("checkout.store.minTotalAdd", { min: fmt(MIN_ORDER_CENTS, currency), more: fmt(MIN_ORDER_CENTS - subtotal, currency), defaultValue: `Minimum order is ${fmt(MIN_ORDER_CENTS, currency)} — add ${fmt(MIN_ORDER_CENTS - subtotal, currency)} more to check out.` })}
              </Typography>
            )}
            <Button fullWidth variant="contained" size="large" data-testid="minicart-checkout"
              disabled={subtotal > 0 && subtotal < MIN_ORDER_CENTS}
              onClick={() => { setOpen(false); router.push(`/${handle}/checkout`); }}
              sx={{ textTransform: "none", py: 1.4, fontWeight: 800, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: BRAND_ACCENT, filter: "brightness(1.05)" } }}>
              {t("checkout.store.pay", { defaultValue: "Pay with crypto →" })}
            </Button>
            <Button fullWidth variant="text" data-testid="minicart-viewfull"
              onClick={() => { setOpen(false); router.push(`/${handle}/cart`); }}
              sx={{ textTransform: "none", mt: 0.5, color: "text.secondary" }}>
              {t("checkout.store.viewFullCart", { defaultValue: "View full cart" })}
            </Button>
          </Box>
        )}
      </Drawer>
    </>
  );
};

export default MiniCart;
