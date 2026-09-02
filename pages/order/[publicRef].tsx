/**
 * Order status page (public, bookmarkable).
 * Route: /order/[publicRef]
 * Shows payment status + digital delivery payloads (URL / download link /
 * license key) once payment is confirmed.
 *
 * Session 82 (2026-07-28): full i18n coverage across 6 languages
 * (see `landing.json` → `order.*`). Design already inherits from the
 * `layout: "home"` shell which now uses aurora indigo.
 */
import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import ProductImage from "@/Components/UI/ProductImage";
import PublicVerifiedBadge from "@/Components/UI/PublicVerifiedBadge";
import MerchantTrustRow from "@/Components/UI/MerchantTrustRow";
import { formatDateTimeI18n } from "@/utils/formatDate";
import { GetServerSideProps } from "next";
import {
  Box, Container, Typography, Stack, Chip, Divider, Alert, Button, LinearProgress,
} from "@mui/material";
import LaunchRounded from "@mui/icons-material/LaunchRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { NextPageWithLayout } from "@/pages/_app";
import copyToClipboard from "@/helpers/copyToClipboard";

interface OrderItem {
  order_item_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  product_snapshot: any;
  variant_snapshot?: any;
  fulfillment_status: string;
  delivered_payload?: any;
}
interface Order {
  order_id: number;
  public_ref: string;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  paid_at?: string | null;
  createdAt: string;
  buyer_email: string;
  buyer_name?: string;
  items: OrderItem[];
  // Session 57: tax breakdown
  shipping_cents?: number;
  tax_cents?: number;
  tax_rate?: number | string;
  tax_label?: string | null;
  tax_country_code?: string | null;
  customer_vat_id?: string | null;
  reverse_charge?: boolean;
  tax_inclusive?: boolean;
  // Populated server-side when the merchant profile is joined onto the
  // order (see SSR handler line 479+). Optional so unhydrated orders still
  // conform.
  merchant?: Merchant | null;
}
interface Merchant { handle?: string; name?: string; vat_id?: string | null }
interface OrderPageProps { order: Order | null; siteUrl: string }

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

// Status meta colors — labels are computed inside the component from i18n.
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  paid:     { bg: "#DCFCE7", fg: "#166534" },
  pending:  { bg: "#FEF3C7", fg: "#92400E" },
  expired:  { bg: "#E5E7EB", fg: "#4B5563" },
  underpaid:{ bg: "#FDE68A", fg: "#78350F" },
  refunded: { bg: "#FEE2E2", fg: "#991B1B" },
  refund_requested: { bg: "#FEE2E2", fg: "#991B1B" },
};

const OrderStatusPage: NextPageWithLayout<OrderPageProps> = ({ order: initialOrder, siteUrl }) => {
  const { t } = useTranslation("landing");
  const STATUS_LABELS: Record<string, string> = {
    paid: t("order.status.paid"),
    pending: t("order.status.pending"),
    expired: t("order.status.expired"),
    underpaid: t("order.status.underpaid"),
    refunded: t("order.status.refunded"),
    refund_requested: t("order.status.refundRequested"),
  };
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [polling, setPolling] = useState<boolean>(initialOrder?.payment_status === "pending");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [resending, setResending] = useState<boolean>(false);
  const [resendMsg, setResendMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Gate locale/timezone-dependent date rendering to the client to avoid SSR
  // hydration mismatches (server runs in UTC/Node ICU, client in the user's locale).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // SSR + first client paint: deterministic UTC string (identical on both sides).
  // After mount: the user's local formatted time. The swap happens post-hydration.
  const formatExpiry = (ms: number) =>
    mounted
      ? formatDateTimeI18n(ms, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : `${new Date(ms).toLocaleString("en-US", { timeZone: "UTC", hour12: true })} UTC`;

  // Poll while pending — max 20 minutes at 6s
  useEffect(() => {
    if (!order || order.payment_status !== "pending") { setPolling(false); return; }
    setPolling(true);
    let cancelled = false;
    let tries = 0;
    const maxTries = 200;
    const tick = async () => {
      tries += 1;
      if (cancelled || tries > maxTries) return;
      try {
        const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
        const r = await fetch(`${base}/api/order/${encodeURIComponent(order.public_ref)}`);
        if (r.ok) {
          const j = await r.json();
          const raw = j?.data;
          const o: Order = raw && raw.order
            ? { ...raw.order, items: raw.items || raw.order.items || [], merchant: raw.merchant || null }
            : raw;
          if (o && !cancelled) {
            setOrder(o);
            if (o.payment_status !== "pending") { setPolling(false); return; }
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(tick, 6000);
    };
    setTimeout(tick, 6000);
    return () => { cancelled = true; };
  }, [order?.public_ref]);

  if (!order) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" data-testid="order-not-found">{t("order.notFound")}</Alert>
      </Container>
    );
  }

  const sc = STATUS_COLORS[order.payment_status] || STATUS_COLORS.pending;
  const scLabel = STATUS_LABELS[order.payment_status] || STATUS_LABELS.pending;

  const copyText = (text: string, itemId: number) => {
    if (!text) return;
    try {
      copyToClipboard(text);
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* no-op */ }
  };

  const renderDelivery = (item: OrderItem) => {
    if (order.payment_status !== "paid") {
      return (
        <Typography variant="caption" color="text.secondary">
          {t("order.item.deliveryPending")}
        </Typography>
      );
    }
    const d = item.delivered_payload || {};
    const deliveryType = item.product_snapshot?.digital_delivery_type;
    if (deliveryType === "url" && d.access_url) {
      return (
        <Button
          size="small"
          variant="outlined"
          startIcon={<LaunchRounded />}
          onClick={() => window.open(d.access_url, "_blank", "noopener,noreferrer")}
          sx={{ textTransform: "none" }}
          data-testid={`order-item-access-${item.order_item_id}`}
        >
          {t("order.item.openAccess")}
        </Button>
      );
    }
    if (deliveryType === "license_key" && d.license_key) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ px: 1, py: 0.5, bgcolor: "grey.100", borderRadius: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {d.license_key}
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyRounded />}
            onClick={() => copyText(d.license_key, item.order_item_id)}
            sx={{ textTransform: "none" }}
            data-testid={`order-item-copy-key-${item.order_item_id}`}
          >
            {copiedId === item.order_item_id ? t("order.item.copied") : t("order.item.copy")}
          </Button>
        </Stack>
      );
    }
    if (deliveryType === "file") {
      // Backend `orderFulfillmentService` writes `asset_deliveries` (canonical).
      // Older / manual seeds may use `downloads`. Support both shapes.
      const raw: any[] = Array.isArray(d.asset_deliveries)
        ? d.asset_deliveries
        : Array.isArray(d.downloads)
        ? d.downloads
        : [];
      if (raw.length > 0) {
        const files = raw.map((a: any) => ({
          url: a.download_url || a.url,
          filename: a.filename || a.name || "Download",
          expires_at: a.expires_at || null,
        })).filter((f: any) => f.url);
        // Earliest expiry across all links (they're minted with the same TTL,
        // but we take the min to be safe).
        const expiresAt = files
          .map((f) => (f.expires_at ? Date.parse(f.expires_at) : NaN))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b)[0];
        const expired = expiresAt ? Date.now() > expiresAt : false;
        return (
          <Stack spacing={0.75}>
            {files.map((f, idx) => (
              <Button
                key={idx}
                size="small"
                variant="outlined"
                startIcon={<DownloadRounded />}
                onClick={() => window.open(f.url, "_blank", "noopener,noreferrer")}
                disabled={expired}
                sx={{ textTransform: "none", alignSelf: "flex-start" }}
                data-testid={`order-item-download-${item.order_item_id}-${idx}`}
              >
                {expired
                  ? t("order.item.downloadExpired", { filename: f.filename })
                  : t("order.item.download", { filename: f.filename })}
              </Button>
            ))}
            {expiresAt && !expired && (
              <Typography variant="caption" color="text.secondary" data-testid={`order-item-expires-${item.order_item_id}`} suppressHydrationWarning>
                {t("order.item.linksExpireOn", { when: formatExpiry(expiresAt) })}
              </Typography>
            )}
            {expired && (
              <Typography variant="caption" color="warning.main" data-testid={`order-item-expired-${item.order_item_id}`}>
                {t("order.item.linksExpiredCta")}
              </Typography>
            )}
          </Stack>
        );
      }
    }
    if (deliveryType === "service" && d.calendar_url) {
      return (
        <Button
          size="small"
          variant="outlined"
          startIcon={<LaunchRounded />}
          onClick={() => window.open(d.calendar_url, "_blank", "noopener,noreferrer")}
          sx={{ textTransform: "none" }}
          data-testid={`order-item-calendar-${item.order_item_id}`}
        >
          {t("order.item.bookSession")}
        </Button>
      );
    }
    if (d.note) {
      return (
        <Typography variant="caption" color="text.secondary" data-testid={`order-item-note-${item.order_item_id}`}>
          {d.note}
        </Typography>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary" data-testid={`order-item-delivered-${item.order_item_id}`}>
        {t("order.item.deliveryInProgress")}
      </Typography>
    );
  };

  // Whether any line item has downloadable files (asset_deliveries).
  const hasFileDeliveries =
    order.payment_status === "paid" &&
    Array.isArray(order.items) &&
    order.items.some((it) => {
      const dp = (it as any).delivered_payload || {};
      return (
        (Array.isArray(dp.asset_deliveries) && dp.asset_deliveries.length > 0) ||
        (Array.isArray(dp.downloads) && dp.downloads.length > 0)
      );
    });

  const handleResendLinks = async () => {
    if (!order || resending) return;
    setResending(true);
    setResendMsg(null);
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
      const r = await fetch(
        `${base}/api/order/${encodeURIComponent(order.public_ref)}/resend-download`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setResendMsg({ kind: "err", text: j?.message || t("order.resend.err") });
      } else {
        // Refetch the order to pull refreshed asset_deliveries
        try {
          const rr = await fetch(`${base}/api/order/${encodeURIComponent(order.public_ref)}`);
          if (rr.ok) {
            const jj = await rr.json();
            const raw = jj?.data;
            const o: Order = raw && raw.order
              ? { ...raw.order, items: raw.items || raw.order.items || [], merchant: raw.merchant || null }
              : raw;
            if (o) setOrder(o);
          }
        } catch { /* ignore */ }
        setResendMsg({ kind: "ok", text: t("order.resend.ok") });
      }
    } catch (e: any) {
      setResendMsg({ kind: "err", text: e?.message || t("order.resend.err") });
    } finally {
      setResending(false);
      setTimeout(() => setResendMsg(null), 5000);
    }
  };

  return (
    <>
      <Head>
        <title>Order {order.public_ref.slice(0, 8).toUpperCase()} · Dynopay</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }} data-testid="order-page">
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">{t("order.label")}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-mono)" }} data-testid="order-ref">
              #{order.public_ref.slice(0, 8).toUpperCase()}
            </Typography>
          </Box>
          <Chip
            label={scLabel}
            sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700, fontSize: 14, height: 32, px: 1 }}
            data-testid="order-status-chip"
          />
        </Stack>

        {/* Sold-by line with identity-verified badge — buyer-trust signal on
            the receipt when the merchant behind this order is KYC-verified. */}
        {order.merchant?.name && (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 2, mt: -1.5, flexWrap: "wrap" }}
            data-testid="order-merchant"
          >
            <Typography variant="body2" color="text.secondary">
              {t("order.soldBy", { defaultValue: "Sold by" })} <b>{order.merchant.name}</b>
            </Typography>
            <PublicVerifiedBadge
              handle={order.merchant.handle}
              orderId={order.public_ref}
              size={15}
              ml={0}
            />
          </Box>
        )}

        {/* Public-surfaces clarity pass: one plain-English line answering
            "what is happening with my money?" for every status. */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, mt: -1.5 }}
          data-testid="order-human-status"
        >
          {t(`order.human.${order.payment_status}`, {
            defaultValue: t("order.human.pending", {
              defaultValue:
                "Waiting for your payment to confirm on the network — usually 5–15 minutes. This page updates by itself.",
            }),
          })}
        </Typography>

        {polling && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="order-polling">
            {t("order.polling")}
            <LinearProgress sx={{ mt: 1 }} />
          </Alert>
        )}

        {order.payment_status === "paid" && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="order-paid-notice">
            {t("order.paidNotice")}
          </Alert>
        )}

        <Stack spacing={2} data-testid="order-items">
          {order.items.map((it) => (
            <Stack
              key={it.order_item_id}
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ sm: "flex-start" }}
              sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
              data-testid={`order-item-${it.order_item_id}`}
            >
              <Box sx={{ position: "relative", width: 72, height: 72, borderRadius: 1.5, bgcolor: "grey.100", overflow: "hidden", flexShrink: 0 }}>
                <ProductImage src={it.product_snapshot?.cover_image_url} alt="" sizes="72px" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{it.product_snapshot?.title || `Product #${it.product_id}`}</Typography>
                {it.variant_snapshot?.attributes?.title && (
                  <Typography variant="caption" color="text.secondary">{it.variant_snapshot.attributes.title}</Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {t("order.item.qty")} {it.quantity} · {formatPrice(it.unit_price_cents, order.currency)} {t("order.item.each")}
                </Typography>
                <Box sx={{ mt: 1.5 }}>{renderDelivery(it)}</Box>
              </Box>
              <Typography sx={{ fontWeight: 700, minWidth: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(it.line_total_cents, order.currency)}
              </Typography>
            </Stack>
          ))}
        </Stack>

        {hasFileDeliveries && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            sx={{ mt: 2 }}
            data-testid="order-resend-links-row"
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshRounded />}
              onClick={handleResendLinks}
              disabled={resending}
              sx={{ textTransform: "none" }}
              data-testid="order-resend-links-btn"
            >
              {resending ? t("order.resend.sending") : t("order.resend.button")}
            </Button>
            {resendMsg && (
              <Typography
                variant="caption"
                color={resendMsg.kind === "ok" ? "success.main" : "error.main"}
                data-testid="order-resend-links-msg"
              >
                {resendMsg.text}
              </Typography>
            )}
            {!resendMsg && (
              <Typography variant="caption" color="text.secondary">
                {t("order.resend.hint")}
              </Typography>
            )}
          </Stack>
        )}

        <Divider sx={{ my: 3 }} />
        <Stack spacing={1}>
          {(Number(order.tax_cents) > 0 || order.reverse_charge || Number(order.shipping_cents) > 0) && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t("order.totals.subtotal")}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="order-subtotal">
                {formatPrice(order.subtotal_cents, order.currency)}
              </Typography>
            </Stack>
          )}
          {Number(order.shipping_cents) > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t("order.totals.shipping")}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(Number(order.shipping_cents), order.currency)}
              </Typography>
            </Stack>
          )}
          {order.reverse_charge ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {`${order.tax_label || t("order.tax.vat")} — ${t("order.tax.reverseCharge")}`}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="order-tax">
                {formatPrice(0, order.currency)}
              </Typography>
            </Stack>
          ) : Number(order.tax_cents) > 0 ? (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {`${order.tax_label || t("order.tax.vat")}${order.tax_rate != null ? ` (${Number(order.tax_rate)}%)` : ""}${order.tax_inclusive ? " · incl." : ""}`}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="order-tax">
                {formatPrice(Number(order.tax_cents), order.currency)}
              </Typography>
            </Stack>
          ) : null}
          <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
            <Typography sx={{ fontWeight: 700 }}>{t("order.totals.totalPaid")}</Typography>
            <Typography sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }} data-testid="order-total">
              {formatPrice(order.total_cents, order.currency)}
            </Typography>
          </Stack>
        </Stack>

        {order.reverse_charge && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }} data-testid="order-reverse-charge-notice">
            {t("order.tax.reverseChargeNotice")}
          </Typography>
        )}
        {(order.customer_vat_id || order.merchant?.vat_id) && (
          <Stack spacing={0.25} sx={{ mt: 1.5 }}>
            {order.merchant?.vat_id && (
              <Typography variant="caption" color="text.secondary">
                {t("order.tax.merchantVatId")} <b>{order.merchant.vat_id}</b>
              </Typography>
            )}
            {order.customer_vat_id && (
              <Typography variant="caption" color="text.secondary">
                {t("order.tax.customerVatId")} <b>{order.customer_vat_id}</b>
              </Typography>
            )}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          {t("order.receiptSentTo")} <b>{order.buyer_email}</b>
        </Typography>

        {/* "What to do if something looks wrong" — merchant contact, plain words. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
          data-testid="order-help-line"
        >
          {t("order.helpLine", {
            defaultValue:
              "Something looks wrong? Contact {{merchant}} and mention order #{{ref}}.",
            merchant: order.merchant?.name || t("order.helpLineSeller", { defaultValue: "the seller" }),
            ref: order.public_ref.slice(0, 8).toUpperCase(),
          })}
          {order.merchant?.handle && (
            <>
              {" "}
              <Box
                component="a"
                href={`/${order.merchant.handle}`}
                sx={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}
                data-testid="order-help-merchant-link"
              >
                {t("order.helpLineLink", { defaultValue: "Visit their page" })}
              </Box>
            </>
          )}
        </Typography>

        {/* Trust row — same "secured by Dynopay · Verified merchant" reassurance
            buyers see at checkout, now on the post-purchase receipt too. */}
        <MerchantTrustRow
          handle={order.merchant?.handle}
          orderId={order.public_ref}
          sx={{ mt: 4 }}
        />
      </Container>
    </>
  );
};

(OrderStatusPage as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const ref = String(ctx.params?.publicRef || "");
  // SSR fetch base: prefer INTERNAL_API_URL (preview keeps NEXT_PUBLIC_BASE_URL
  // empty for relative browser calls; server-side needs an absolute URL).
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  // Public URL for the client — never the internal loopback base.
  const siteUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "") || base;
  try {
    const r = await fetch(`${base}/api/order/${encodeURIComponent(ref)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      console.error(`[SSR /order/[publicRef]] order fetch "${ref}" -> HTTP ${r.status} (base=${base})`);
      return { props: { order: null, siteUrl } };
    }
    const json = await r.json();
    const raw = json?.data || null;
    // Normalize: backend returns { order, items, merchant }; older/demo shapes
    // return a flat order. Support both so the receipt always renders.
    const normalized = raw
      ? raw.order
        ? { ...raw.order, items: raw.items || raw.order.items || [], merchant: raw.merchant || null }
        : raw
      : null;
    return { props: { order: normalized, siteUrl } };
  } catch (e) {
    console.error(`[SSR /order/[publicRef]] "${ref}" render failed:`, e);
    return { props: { order: null, siteUrl } };
  }
};

export default OrderStatusPage;
