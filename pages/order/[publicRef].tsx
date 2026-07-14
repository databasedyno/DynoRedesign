/**
 * Order status page (public, bookmarkable).
 * Route: /order/[publicRef]
 * Shows payment status + digital delivery payloads (URL / download link /
 * license key) once payment is confirmed.
 */
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import {
  Box, Container, Typography, Stack, Chip, Divider, Alert, Button, LinearProgress,
} from "@mui/material";
import LaunchRounded from "@mui/icons-material/LaunchRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { NextPageWithLayout } from "@/pages/_app";

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
}
interface OrderPageProps { order: Order | null; siteUrl: string }

function formatPrice(cents: number, ccy: string): string {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${ccy}`; }
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  paid:     { label: "PAID",     bg: "#DCFCE7", fg: "#166534" },
  pending:  { label: "PENDING",  bg: "#FEF3C7", fg: "#92400E" },
  expired:  { label: "EXPIRED",  bg: "#E5E7EB", fg: "#4B5563" },
  underpaid:{ label: "UNDERPAID",bg: "#FDE68A", fg: "#78350F" },
  refunded: { label: "REFUNDED", bg: "#FEE2E2", fg: "#991B1B" },
  refund_requested: { label: "REFUND REQ", bg: "#FEE2E2", fg: "#991B1B" },
};

const OrderStatusPage: NextPageWithLayout<OrderPageProps> = ({ order: initialOrder, siteUrl }) => {
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [polling, setPolling] = useState<boolean>(initialOrder?.payment_status === "pending");
  const [copiedId, setCopiedId] = useState<number | null>(null);

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
          const o: Order = j?.data;
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
        <Alert severity="error" data-testid="order-not-found">Order not found.</Alert>
      </Container>
    );
  }

  const sc = STATUS_META[order.payment_status] || STATUS_META.pending;

  const copyText = (text: string, itemId: number) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(itemId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* no-op */ }
  };

  const renderDelivery = (item: OrderItem) => {
    if (order.payment_status !== "paid") {
      return (
        <Typography variant="caption" color="text.secondary">
          Payment pending — delivery unlocks once payment confirms.
        </Typography>
      );
    }
    const d = item.delivered_payload || {};
    const t = item.product_snapshot?.digital_delivery_type;
    if (t === "url" && d.access_url) {
      return (
        <Button
          size="small"
          variant="outlined"
          startIcon={<LaunchRounded />}
          onClick={() => window.open(d.access_url, "_blank", "noopener,noreferrer")}
          sx={{ textTransform: "none" }}
          data-testid={`order-item-access-${item.order_item_id}`}
        >
          Open access link
        </Button>
      );
    }
    if (t === "license_key" && d.license_key) {
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
            {copiedId === item.order_item_id ? "Copied!" : "Copy"}
          </Button>
        </Stack>
      );
    }
    if (t === "file" && Array.isArray(d.downloads)) {
      return (
        <Stack spacing={0.5}>
          {d.downloads.map((f: any, idx: number) => (
            <Button
              key={idx}
              size="small"
              variant="outlined"
              startIcon={<LaunchRounded />}
              onClick={() => window.open(f.url, "_blank", "noopener,noreferrer")}
              sx={{ textTransform: "none", alignSelf: "flex-start" }}
              data-testid={`order-item-download-${item.order_item_id}-${idx}`}
            >
              Download {f.filename}
            </Button>
          ))}
          {d.expires_at && (
            <Typography variant="caption" color="text.secondary">
              Links expire {new Date(d.expires_at).toLocaleString()}
            </Typography>
          )}
        </Stack>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary" data-testid={`order-item-delivered-${item.order_item_id}`}>
        Delivery in progress — check your email.
      </Typography>
    );
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
            <Typography variant="body2" color="text.secondary">Order</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-mono)" }} data-testid="order-ref">
              #{order.public_ref.slice(0, 8).toUpperCase()}
            </Typography>
          </Box>
          <Chip
            label={sc.label}
            sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700, fontSize: 14, height: 32, px: 1 }}
            data-testid="order-status-chip"
          />
        </Stack>

        {polling && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="order-polling">
            Waiting for payment confirmation — this page updates automatically.
            <LinearProgress sx={{ mt: 1 }} />
          </Alert>
        )}

        {order.payment_status === "paid" && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="order-paid-notice">
            Payment received! Your items are below.
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
              <Box sx={{ width: 72, height: 72, borderRadius: 1.5, bgcolor: "grey.100", overflow: "hidden", flexShrink: 0 }}>
                {it.product_snapshot?.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.product_snapshot.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{it.product_snapshot?.title || `Product #${it.product_id}`}</Typography>
                {it.variant_snapshot?.attributes?.title && (
                  <Typography variant="caption" color="text.secondary">{it.variant_snapshot.attributes.title}</Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Qty {it.quantity} · {formatPrice(it.unit_price_cents, order.currency)} each
                </Typography>
                <Box sx={{ mt: 1.5 }}>{renderDelivery(it)}</Box>
              </Box>
              <Typography sx={{ fontWeight: 700, minWidth: 96, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(it.line_total_cents, order.currency)}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontWeight: 700 }}>Total paid</Typography>
          <Typography sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }} data-testid="order-total">
            {formatPrice(order.total_cents, order.currency)}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Receipt sent to <b>{order.buyer_email}</b>
        </Typography>
      </Container>
    </>
  );
};

(OrderStatusPage as unknown as { layout: string }).layout = "home";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const ref = String(ctx.params?.publicRef || "");
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/api/order/${encodeURIComponent(ref)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return { props: { order: null, siteUrl: base } };
    const json = await r.json();
    return { props: { order: json?.data || null, siteUrl: base } };
  } catch {
    return { props: { order: null, siteUrl: base } };
  }
};

export default OrderStatusPage;
