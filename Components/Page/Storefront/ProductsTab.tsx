import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  Box, Typography, Stack, IconButton, Alert, TextField,
  MenuItem, Select, FormControl, InputLabel, useTheme,
} from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { MONO, Icon } from "@/styles/uiKit";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import LaunchRounded from "@mui/icons-material/LaunchRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import PanelCard from "@/Components/UI/PanelCard";
import { StatusDot } from "@/Components/UI/StatusDot";
import ProductImage from "@/Components/UI/ProductImage";
import CustomButton from "@/Components/UI/Buttons";
import axiosBaseApi from "@/axiosConfig";
import { useApiSWR } from "@/hooks/useApiSWR";
import SkeletonList from "@/Components/UI/SkeletonList";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import StorefrontPendingCard from "@/Components/Page/Storefront/StorefrontPendingCard";
import { toFixedStr } from "@/utils/money";
import ProductGridCard, { productStatusTone } from "./ProductGridCard";
import ProductDetailPanel from "./ProductDetailPanel";
import { ProductRow, ProductsView, PRODUCTS_VIEW_KEY, readProductsView } from "./productTypes";


/**
 * Storefront → Products.
 *
 * The former /pay-links/products list. Live products also appear inline on the
 * merchant's public page, so this tab sits next to Page and Share instead of
 * being a separate destination.
 */
const ProductsTab = () => {
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  // Plan 2.4 — grid ⇄ list (remembered per device) + slide-in detail panel.
  const [view, setView] = useState<ProductsView>("list");
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  useEffect(() => setView(readProductsView()), []);
  const changeView = (v: ProductsView) => {
    setView(v);
    try { window.localStorage.setItem(PRODUCTS_VIEW_KEY, v); } catch { /* private mode */ }
  };
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [merchantHandle, setMerchantHandle] = useState<string | null>(null);
  // Storefront-per-company: scope the catalog to the active company so
  // switching companies reloads that company's products (X-Company-Id header
  // is attached automatically by axiosConfig).
  const selectedCompanyId = useSelectedCompanyId();
  // Pre-migration: a non-primary company has no own catalog — don't show the
  // account's products (they belong to the primary company's storefront).
  const { profile: storefrontProfile } = useStorefrontProfile();

  const productsParams = new URLSearchParams();
  if (statusFilter !== "all") productsParams.set("status", statusFilter);
  if (categoryFilter !== "all") {
    productsParams.set("category", categoryFilter === "__uncategorized__" ? "" : categoryFilter);
  }
  if (q.trim()) productsParams.set("q", q.trim());
  const { data: productsResp, error: productsError, isLoading: productsLoading, mutate: mutateProducts } = useApiSWR<ProductRow[]>(
    [`products?${productsParams.toString()}`, selectedCompanyId],
    {
      select: (raw: any) => (raw?.data?.items || []) as ProductRow[],
      keepPreviousData: true,
    }
  );
  const items: ProductRow[] = productsResp || [];
  const loading = productsLoading && productsResp === undefined;
  const error = productsError ? ((productsError as any)?.response?.data?.message || "Failed to load products") : null;

  useEffect(() => {
    // Storefront-per-company: the "view shop" handle is the ACTIVE company's
    // (creator/profile resolves per-company when the flag is on, else account).
    axiosBaseApi
      .get("user/creator/profile")
      .then((r) => {
        const h = r.data?.data?.handle;
        setMerchantHandle(h ? String(h) : null);
      })
      .catch(() => {});
  }, [selectedCompanyId]);

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

  const openEditor = (p: ProductRow) => router.push(`/pay-links/products/${p.product_id}/edit`);
  const quickSell = (p: ProductRow) => router.push({ pathname: "/create-pay-link", query: { product_id: p.product_id, qty: 1 } });
  const publicUrlFor = (p: ProductRow | null) =>
    p && merchantHandle && typeof window !== "undefined" ? `${window.location.origin}/${merchantHandle}/p/${p.slug}` : null;
  const applySaved = (next: ProductRow) => {
    setPanelError(null);
    setSelected(next);
    mutateProducts((prev) => (prev || []).map((row) => (row.product_id === next.product_id ? { ...row, ...next } : row)), { revalidate: true });
  };

  if (storefrontProfile?.storefront_pending) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }} data-testid="products-list">
        <StorefrontPendingCard />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }} data-testid="products-list">
      {error && <Alert severity="error" data-testid="products-list-error">{error}</Alert>}

      <PanelCard
        title=""
        headerAction={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
            {merchantHandle && (
              <CustomButton
                label="View my page"
                variant="outlined"
                size="small"
                endIcon={<LaunchRounded sx={{ fontSize: 16 }} />}
                onClick={() => window.open(`/${merchantHandle}`, "_blank")}
                data-testid="products-view-shop-btn"
              />
            )}
            <CustomButton
              label="New product"
              variant="primary"
              size="small"
              endIcon={<AddRounded sx={{ fontSize: 18 }} />}
              onClick={() => router.push("/pay-links/products/new")}
              data-testid="products-new-btn"
            />
          </Stack>
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
            <InputLabel id="pflt">{t("products.statusLabel")}</InputLabel>
            <Select
              labelId="pflt"
              label={t("products.statusLabel")}
              value={statusFilter}
              onChange={(e) => setStatusFilter(String(e.target.value))}
              inputProps={{ "data-testid": "products-status-filter" }}
            >
              <MenuItem value="all">{t("products.statusAll", { defaultValue: "All" })}</MenuItem>
              <MenuItem value="draft">{t("products.status.draft")}</MenuItem>
              <MenuItem value="live">{t("products.status.live")}</MenuItem>
              <MenuItem value="archived">{t("products.status.archived")}</MenuItem>
            </Select>
          </FormControl>
          <Box role="radiogroup" aria-label={t("products.viewLabel", { defaultValue: "View" })} data-testid="products-view-toggle" sx={{ display: "inline-flex", alignSelf: { xs: "flex-end", sm: "auto" }, p: 0.4, gap: 0.4, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` }}>
            {(["grid", "list"] as ProductsView[]).map((v) => {
              const active = view === v;
              return (
                <Box key={v} component="button" type="button" role="radio" aria-checked={active} aria-label={t(`products.view.${v}`, { defaultValue: v })} data-testid={`products-view-${v}`} onClick={() => changeView(v)} sx={{ width: 34, height: 32, borderRadius: "8px", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: active ? "default" : "pointer", color: active ? "#fff" : theme.palette.text.secondary, backgroundColor: active ? (isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light) : "transparent", transition: "background-color 150ms ease, color 150ms ease", "&:hover": active ? {} : { backgroundColor: theme.palette.action.hover } }}>
                  <Icon name={v === "grid" ? "lucide:layout-grid" : "lucide:list"} size={16} />
                </Box>
              );
            })}
          </Box>
        </Stack>
      </PanelCard>

      {loading ? (
        <PanelCard title="">
          <SkeletonList rows={5} rowHeight={64} testId="products-list-loading" />
        </PanelCard>
      ) : (
        <PanelCard title="">
          {items.length === 0 ? (
            <Stack alignItems="center" spacing={1.25} sx={{ py: 6, textAlign: "center" }} data-testid="products-empty">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                  backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
                }}
              >
                <Icon name="package" size={26} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("products.emptyTitle", { defaultValue: "Sell your first product" })}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, lineHeight: 1.55 }}>
                {t("products.emptyBody", { defaultValue: "Create a digital product — it shows up on your page automatically and buyers pay in crypto." })}
              </Typography>
              <CustomButton
                label="Create your first product"
                variant="primary"
                onClick={() => router.push("/pay-links/products/new")}
                data-testid="products-empty-new-btn"
              />
            </Stack>
          ) : view === "grid" ? (
            <Box data-testid="products-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 } }}>
              {items.map((p) => (
                <ProductGridCard key={p.product_id} product={p} onOpen={setSelected} onEdit={openEditor} onQuickSell={quickSell} />
              ))}
            </Box>
          ) : (
            <Stack spacing={1} data-testid="products-list-rows">
              {items.map((p) => {
                return (
                  <Stack
                    key={p.product_id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    role="button"
                    tabIndex={0}
                    aria-label={p.title}
                    onClick={() => setSelected(p)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(p);
                      }
                    }}
                    sx={{ p: 1.5, border: `1px solid ${theme.palette.border.main}`, borderRadius: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 }, "& .MuiIconButton-root": { flexShrink: 0 } }}
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
                        <Box component="span" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                          {toFixedStr((p.base_price_cents / 100), 2)} {p.currency}
                        </Box>
                        {" · /"}{p.slug}
                      </Typography>
                    </Box>
                    <StatusDot
                      tone={productStatusTone(p.status)}
                      data-testid={`product-row-status-${p.product_id}`}
                      sx={{ display: { xs: "none", sm: "inline-flex" } }}
                    >
                      {t(`products.status.${p.status}`, { defaultValue: p.status })}
                    </StatusDot>
                    <Box onClick={(e: React.MouseEvent) => e.stopPropagation()} onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()} sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
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
                      // Move 3 (one story per sale): product sales now live in
                      // Transactions (source=product). The legacy per-product
                      // orders page stays reachable by URL for refund handling.
                      onClick={() => router.push("/transactions?source=orders")}
                      title="Sales"
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
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </PanelCard>
      )}

      {panelError && <Alert severity="error" onClose={() => setPanelError(null)} data-testid="products-panel-error">{panelError}</Alert>}
      <ProductDetailPanel
        open={!!selected}
        product={selected}
        publicUrl={publicUrlFor(selected)}
        onClose={() => setSelected(null)}
        onEdit={openEditor}
        onQuickSell={quickSell}
        onArchive={(p) => { setSelected(null); softDelete(p.product_id); }}
        onSaved={applySaved}
        onError={setPanelError}
      />
    </Box>
  );
};

export default ProductsTab;
