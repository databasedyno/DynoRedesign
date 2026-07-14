/**
 * Merchant view of orders for a single product.
 * Route: /pay-links/products/[productId]/orders
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Box, Typography, Stack, Chip, LinearProgress, Alert, IconButton,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import PanelCard from "@/Components/UI/PanelCard";
import { pageProps } from "@/utils/types";
import axiosBaseApi from "@/axiosConfig";

interface OrderRow {
  order_id: number;
  public_ref: string;
  buyer_email: string;
  buyer_name?: string;
  total_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "#DCFCE7", fg: "#166534" },
  pending: { bg: "#FEF3C7", fg: "#92400E" },
  expired: { bg: "#E5E7EB", fg: "#4B5563" },
  refunded: { bg: "#FEE2E2", fg: "#991B1B" },
};

const ProductOrdersPage = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const productId = Number(router.query.productId);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Product orders");
    setPageDescription("Orders that include this product.");
    return () => { setPageName(""); setPageDescription(""); };
  }, [setPageName, setPageDescription]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <IconButton onClick={() => router.push("/pay-links/products")} data-testid="product-orders-back">
        <ArrowBackRounded />
      </IconButton>
    );
    return () => setPageAction(null);
  }, [setPageAction, router]);

  useEffect(() => {
    if (!Number.isFinite(productId)) return;
    setLoading(true);
    setError(null);
    axiosBaseApi
      .get(`products/${productId}/orders`)
      .then((r) => setRows(r.data?.data?.items || []))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load orders"))
      .finally(() => setLoading(false));
  }, [productId]);

  if (!Number.isFinite(productId)) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }} data-testid="product-orders">
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <LinearProgress data-testid="product-orders-loading" /> : (
        <PanelCard title="">
          {rows.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <Typography color="text.secondary" data-testid="product-orders-empty">No orders yet.</Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {rows.map((o) => {
                const sc = STATUS_COLORS[o.payment_status] || STATUS_COLORS.pending;
                return (
                  <Stack
                    key={o.order_id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ p: 1.5, border: "1px solid #E5E7EB", borderRadius: 1.5 }}
                    data-testid={`product-order-row-${o.order_id}`}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {o.buyer_name || o.buyer_email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "var(--font-mono)" }}>
                        {o.public_ref.slice(0, 12)}… · {new Date(o.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {(o.total_cents / 100).toFixed(2)} {o.currency}
                    </Typography>
                    <Chip
                      size="small"
                      label={o.payment_status.toUpperCase()}
                      sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700 }}
                      data-testid={`product-order-status-${o.order_id}`}
                    />
                    <IconButton
                      size="small"
                      onClick={() => window.open(`/order/${o.public_ref}`, "_blank")}
                      title="Open order"
                      data-testid={`product-order-open-${o.order_id}`}
                    >
                      <OpenInNewRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </PanelCard>
      )}
    </Box>
  );
};

export default ProductOrdersPage;
