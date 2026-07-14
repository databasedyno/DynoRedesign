/**
 * Merchant product catalog — list view.
 * Route: /pay-links/products
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Box, Typography, Stack, Chip, IconButton, LinearProgress, Alert, TextField,
  MenuItem, Select, FormControl, InputLabel,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import LaunchRounded from "@mui/icons-material/LaunchRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { pageProps } from "@/utils/types";
import axiosBaseApi from "@/axiosConfig";

interface ProductRow {
  product_id: number;
  title: string;
  slug: string;
  status: "draft" | "live" | "archived";
  base_price_cents: number;
  currency: string;
  cover_image_url?: string;
  sold_count?: number;
  createdAt?: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  live: { bg: "#DCFCE7", fg: "#166534" },
  draft: { bg: "#FEF3C7", fg: "#92400E" },
  archived: { bg: "#E5E7EB", fg: "#4B5563" },
};

const ProductsList = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [hasUncategorized, setHasUncategorized] = useState(false);
  const [q, setQ] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [merchantHandle, setMerchantHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Products");
    setPageDescription("Sell digital goods with instant crypto payouts.");
    return () => { setPageName(""); setPageDescription(""); };
  }, [setPageName, setPageDescription]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography
          component="a"
          href="/transactions?source=product"
          onClick={(e) => {
            e.preventDefault();
            router.push("/transactions?source=product");
          }}
          data-testid="products-view-orders-link"
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            color: (t: any) => t.palette.text.primary,
            textDecoration: "none",
            cursor: "pointer",
            display: { xs: "none", sm: "inline" },
            "&:hover": { textDecoration: "underline" },
          }}
        >
          View product orders →
        </Typography>
        <CustomButton
          label="New product"
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: 18 }} />}
          onClick={() => router.push("/pay-links/products/new")}
          data-testid="products-new-btn"
        />
      </Stack>
    );
    return () => setPageAction(null);
  }, [setPageAction, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") {
      params.set("category", categoryFilter === "__uncategorized__" ? "" : categoryFilter);
    }
    if (q.trim()) params.set("q", q.trim());
    axiosBaseApi
      .get(`products?${params.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.data?.data?.items || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.message || "Failed to load products");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [statusFilter, categoryFilter, q]);

  // Best-effort fetch of merchant's distinct categories for the filter dropdown
  useEffect(() => {
    let cancelled = false;
    axiosBaseApi
      .get("products/categories")
      .then((r) => {
        if (cancelled) return;
        setCategories(r.data?.data?.categories || []);
        setHasUncategorized(Boolean(r.data?.data?.has_uncategorized));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Best-effort fetch of merchant handle for a "View shop" quick-link
  useEffect(() => {
    axiosBaseApi
      .get("user/profile")
      .then((r) => {
        const h = r.data?.data?.handle || r.data?.data?.user?.handle;
        if (h) setMerchantHandle(String(h));
      })
      .catch(() => {});
  }, []);

  const softDelete = async (id: number) => {
    if (!window.confirm("Archive this product?")) return;
    try {
      await axiosBaseApi.delete(`products/${id}`);
      setItems((prev) => prev.map((p) => p.product_id === id ? { ...p, status: "archived" } : p));
    } catch (e: any) {
      alert(e?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }} data-testid="products-list">
      {error && <Alert severity="error" data-testid="products-list-error">{error}</Alert>}

      <PanelCard
        title=""
        headerAction={
          merchantHandle && (
            <CustomButton
              label="View my shop"
              variant="outlined"
              size="small"
              endIcon={<LaunchRounded sx={{ fontSize: 16 }} />}
              onClick={() => window.open(`/${merchantHandle}/shop`, "_blank")}
              data-testid="products-view-shop-btn"
            />
          )
        }
        headerActionLayout="inline"
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ "data-testid": "products-search-input" }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="pflt">Status</InputLabel>
            <Select
              labelId="pflt"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(String(e.target.value))}
              inputProps={{ "data-testid": "products-status-filter" }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="live">Live</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </PanelCard>

      {loading ? <LinearProgress data-testid="products-list-loading" /> : (
        <PanelCard title="">
          {items.length === 0 ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
              <Typography variant="h6" data-testid="products-empty">No products yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first digital product — buyers pay in crypto, deliverables go out automatically.
              </Typography>
              <CustomButton
                label="Create a product"
                variant="primary"
                onClick={() => router.push("/pay-links/products/new")}
                data-testid="products-empty-new-btn"
              />
            </Stack>
          ) : (
            <Stack spacing={1} data-testid="products-list-rows">
              {items.map((p) => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.draft;
                return (
                  <Stack
                    key={p.product_id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ p: 1.5, border: "1px solid #E5E7EB", borderRadius: 1.5, "&:hover": { bgcolor: "action.hover" } }}
                    data-testid={`product-row-${p.product_id}`}
                  >
                    <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: "grey.100", overflow: "hidden", flexShrink: 0 }}>
                      {p.cover_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                        {p.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(p.base_price_cents / 100).toFixed(2)} {p.currency} · /{p.slug}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={p.status.toUpperCase()}
                      sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700 }}
                      data-testid={`product-row-status-${p.product_id}`}
                    />
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/pay-links/products/${p.product_id}/edit`)}
                      title="Edit"
                      data-testid={`product-row-edit-${p.product_id}`}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                    {p.status === "live" && (
                      <IconButton
                        size="small"
                        onClick={() =>
                          router.push({
                            pathname: "/create-pay-link",
                            query: { product_id: p.product_id, qty: 1 },
                          })
                        }
                        title="Quick sell — create a payment link pre-filled with this product"
                        data-testid={`product-row-quicksell-${p.product_id}`}
                        sx={{
                          color: "#10B981",
                          "&:hover": { bgcolor: "rgba(16, 185, 129, 0.08)" },
                        }}
                      >
                        <BoltRounded fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/pay-links/products/${p.product_id}/orders`)}
                      title="Orders"
                      data-testid={`product-row-orders-${p.product_id}`}
                    >
                      <ReceiptLongRounded fontSize="small" />
                    </IconButton>
                    {merchantHandle && p.status === "live" && (
                      <IconButton
                        size="small"
                        onClick={() => window.open(`/${merchantHandle}/p/${p.slug}`, "_blank")}
                        title="Open public page"
                        data-testid={`product-row-open-${p.product_id}`}
                      >
                        <LaunchRounded fontSize="small" />
                      </IconButton>
                    )}
                    {p.status !== "archived" && (
                      <IconButton
                        size="small"
                        onClick={() => softDelete(p.product_id)}
                        title="Archive"
                        data-testid={`product-row-delete-${p.product_id}`}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    )}
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

export default ProductsList;
