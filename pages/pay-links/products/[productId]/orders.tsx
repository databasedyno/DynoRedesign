/**
 * Merchant view of orders for a single product.
 * Route: /pay-links/products/[productId]/orders
 *
 * Features (Phase 1):
 *  - List every order that includes this product
 *  - Filter by payment status
 *  - Refund flow (spec §7.6): two-step "Request refund" → "Mark refunded"
 *    both call POST /api/products/orders/:orderId/refund, differ by
 *    body.final. Restock toggle re-inserts stock when checked.
 */
import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import {
  Box, Typography, Stack, Chip, LinearProgress, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Checkbox, Button, Snackbar,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
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
  refund_requested: { bg: "#FEE2E2", fg: "#991B1B" },
  refunded: { bg: "#FEE2E2", fg: "#991B1B" },
};

const ProductOrdersPage = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const productId = Number(router.query.productId);
  // Orders list — SWR-backed (cached + deduped, keyed by product). The refund
  // flow calls `loadOrders()` to revalidate after a status change.
  const {
    data: ordersData,
    error: ordersErr,
    mutate: mutateOrders,
  } = useSWR<OrderRow[]>(
    Number.isFinite(productId) ? ["product-orders", productId] : null,
    (async ([, pid]: [string, number]) => {
      const r = await axiosBaseApi.get(`products/${pid}/orders`);
      return r.data?.data?.items || [];
    }) as any,
    { keepPreviousData: true },
  );
  const rows = ordersData ?? [];
  const loading =
    Number.isFinite(productId) && ordersData === undefined && !ordersErr;
  const error = ordersErr
    ? (ordersErr as any)?.response?.data?.message || "Failed to load orders"
    : null;
  const loadOrders = useCallback(() => mutateOrders(), [mutateOrders]);
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundRestock, setRefundRestock] = useState(true);
  const [refundFinal, setRefundFinal] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const openRefund = (order: OrderRow) => {
    // Default: paid → refund_requested (final=false, restock=true)
    // refund_requested → refunded (final=true, restock=false since already restocked)
    const isRequested = order.payment_status === "refund_requested";
    setRefundTarget(order);
    setRefundReason("");
    setRefundRestock(!isRequested); // only restock on first pass
    setRefundFinal(isRequested);    // second pass = mark final
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const resp = await axiosBaseApi.post(
        `products/orders/${refundTarget.order_id}/refund`,
        {
          reason: refundReason || undefined,
          restock: refundRestock,
          final: refundFinal,
        }
      );
      const nextStatus = resp?.data?.data?.payment_status || "refund_requested";
      setToast(
        nextStatus === "refunded"
          ? "Refund finalized. Buyer emailed."
          : "Refund requested. Confirm off-chain, then mark final."
      );
      setRefundTarget(null);
      loadOrders();
    } catch (e: any) {
      setToast(e?.response?.data?.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

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
                const canRefund =
                  o.payment_status === "paid" || o.payment_status === "refund_requested";
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
                      label={o.payment_status.replace(/_/g, " ").toUpperCase()}
                      sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700 }}
                      data-testid={`product-order-status-${o.order_id}`}
                    />
                    {canRefund && (
                      <IconButton
                        size="small"
                        onClick={() => openRefund(o)}
                        title={
                          o.payment_status === "refund_requested"
                            ? "Mark refund final"
                            : "Refund this order"
                        }
                        data-testid={`product-order-refund-${o.order_id}`}
                      >
                        <ReplayRounded fontSize="small" />
                      </IconButton>
                    )}
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

      {/* Refund dialog */}
      <Dialog
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        fullWidth
        maxWidth="sm"
        data-testid="refund-dialog"
      >
        <DialogTitle>
          {refundFinal ? "Mark refund final" : "Request refund"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              Crypto refunds are handled off-chain — you send the funds back
              from your own wallet. This flow only updates DynoPay's records
              and notifies the buyer.
            </Alert>
            <TextField
              label="Reason (shown to buyer)"
              multiline
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              inputProps={{ maxLength: 500, "data-testid": "refund-reason-input" }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={refundRestock}
                  onChange={(e) => setRefundRestock(e.target.checked)}
                  disabled={refundFinal && refundTarget?.payment_status === "refund_requested"}
                  data-testid="refund-restock-checkbox"
                />
              }
              label="Return items to stock"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={refundFinal}
                  onChange={(e) => setRefundFinal(e.target.checked)}
                  data-testid="refund-final-checkbox"
                />
              }
              label={
                refundTarget?.payment_status === "refund_requested"
                  ? "I've sent the crypto back — mark refund as final"
                  : "Skip 'requested' step and mark refund as final now"
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRefundTarget(null)}
            disabled={refunding}
            data-testid="refund-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={submitRefund}
            disabled={refunding}
            data-testid="refund-submit-btn"
          >
            {refunding
              ? "Working…"
              : refundFinal
                ? "Mark refunded"
                : "Request refund"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={toast || ""}
        data-testid="refund-toast"
      />
    </Box>
  );
};

export default ProductOrdersPage;
