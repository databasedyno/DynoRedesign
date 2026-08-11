/**
 * Merchant product catalog — list view.
 * Route: /pay-links/products
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Box, Typography, Stack, Chip, IconButton, LinearProgress, Alert, TextField,
  MenuItem, Select, FormControl, InputLabel, useTheme,
} from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import LaunchRounded from "@mui/icons-material/LaunchRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import PanelCard from "@/Components/UI/PanelCard";
import ProductImage from "@/Components/UI/ProductImage";
import CustomButton from "@/Components/UI/Buttons";
import { pageProps } from "@/utils/types";
import axiosBaseApi from "@/axiosConfig";
import useSWR from "swr";
import SkeletonList from "@/Components/UI/SkeletonList";

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

// Theme-aware semantic status colours (aligned with Transactions / Pay Links):
// live = green, draft = amber, archived = neutral grey.
const statusChipColors = (status: string, isDark: boolean): { bg: string; fg: string } => {
  const S = CB_TOKENS.semantic;
  const semantic: Record<string, typeof S.positive> = {
    live: S.positive,
    draft: S.warning,
  };
  const s = semantic[status];
  if (!s) {
    return {
      bg: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)",
      fg: isDark ? "rgba(255,255,255,0.72)" : "rgba(10,10,15,0.60)",
    };
  }
  return { bg: isDark ? s.glowDark : s.glowLight, fg: isDark ? s.dark : s.light };
};

const ProductsList = ({ setPageName, setPageDescription, setPageAction }: pageProps) => {
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [merchantHandle, setMerchantHandle] = useState<string | null>(null);

  const { data: productsResp, error: productsError, isLoading: productsLoading, mutate: mutateProducts } = useSWR(
    ["products-list", statusFilter, categoryFilter, q],
    async ([, status, category, search]: [string, string, string, string]) => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (category !== "all") {
        params.set("category", category === "__uncategorized__" ? "" : category);
      }
      if (search.trim()) params.set("q", search.trim());
      const r = await axiosBaseApi.get(`products?${params.toString()}`);
      return (r.data?.data?.items || []) as ProductRow[];
    },
    { keepPreviousData: true }
  );
  const items: ProductRow[] = productsResp || [];
  const loading = productsLoading && productsResp === undefined;
  const error = productsError ? (productsError?.response?.data?.message || "Failed to load products") : null;

  const { data: categoriesResp } = useSWR("products/categories", async (url: string) => {
    const r = await axiosBaseApi.get(url);
    return { categories: r.data?.data?.categories || [], hasUncategorized: Boolean(r.data?.data?.has_uncategorized) };
  });
  const categories: string[] = categoriesResp?.categories || [];
  const hasUncategorized: boolean = categoriesResp?.hasUncategorized || false;

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
      mutateProducts(
        (prev) => (prev || []).map((p) => p.product_id === id ? { ...p, status: "archived" } : p),
        { revalidate: false }
      );
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

      {loading ? (
        <PanelCard title="">
          <SkeletonList rows={5} rowHeight={64} testId="products-list-loading" />
        </PanelCard>
      ) : (
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
                const sc = statusChipColors(p.status, isDark);
                return (
                  <Stack
                    key={p.product_id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ p: 1.5, border: `1px solid ${theme.palette.border.main}`, borderRadius: 1.5, "&:hover": { bgcolor: "action.hover" } }}
                    data-testid={`product-row-${p.product_id}`}
                  >
                    <Box sx={{ position: "relative", width: 48, height: 48, borderRadius: 1, bgcolor: isDark ? "rgba(255,255,255,0.06)" : "grey.100", overflow: "hidden", flexShrink: 0 }}>
                      <ProductImage src={p.cover_image_url} alt="" sizes="48px" />
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
                      sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700, border: `1px solid ${sc.fg}33` }}
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
