/**
 * ProductQuickSell — session 49 round 3 (option "b" — quick-sell dropdown)
 *
 * A compact "Import from Store" section shown at the top of the pay-link
 * create form (for link_type='standard' only). The merchant can pick one of
 * their LIVE products to auto-fill amount + currency + description + image
 * on the payment link. This is a UI shortcut ONLY — the payment link stored
 * server-side has NO product FK; it's a plain standard link with pre-filled
 * fields. If the store product changes later, this link is unaffected
 * (snapshot at creation time — see confirmed spec in session 49 round 3).
 *
 * Behaviour after selection: all fields remain fully editable (merchant can
 * override any auto-filled value before creating the link).
 *
 * Excluded from edit mode and from donation link_type.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { toFixedStr } from "@/utils/money";

// Product row shape returned by GET /api/product/products (subset we need)
interface ProductSummary {
  product_id: number | string;
  title: string;
  subtitle?: string | null;
  description_md?: string | null;
  base_price_cents: number;
  currency: string;
  cover_image_url?: string | null;
  status: string;
  product_type: string;
  slug: string;
  /** Sequelize returns this — flag for whether the picker should load variants. */
  has_variants?: boolean;
  category?: string | null;
}

/** Variant shape returned by GET /api/products/:id. Only the fields we render. */
export interface ProductVariant {
  variant_id: number | string;
  sku?: string | null;
  attributes?: Record<string, string | number> | null;
  price_cents: number;
  stock_count?: number | null;
  is_active: boolean;
  image_url?: string | null;
}

export interface PickedProduct {
  product_id: number | string;
  title: string;
  amount: string;      // decimal string, ready for the amount input
  currency: string;
  description: string; // truncated to 500 chars (matches server validation)
  cover_image_url: string | null;
  product_type: string;
  /** Variants returned alongside the product (only populated when has_variants=true). */
  variants?: ProductVariant[];
  /** Currently selected variant_id (only meaningful when variants is non-empty). */
  selected_variant_id?: number | string | null;
  /** Optional quantity multiplier — used when deep-linked via ?qty=N. Default 1. */
  qty?: number;
}

interface ProductQuickSellProps {
  /** Currently picked product (controlled). null = nothing picked. */
  picked: PickedProduct | null;
  onPick: (p: PickedProduct) => void;
  onClear: () => void;
  /**
   * Called when the user changes the selected variant after picking. The
   * parent should update the amount field to reflect the new variant's price
   * (multiplied by qty when set). Not called on initial pick — the auto-fill
   * is handled by onPick.
   */
  onVariantChange?: (variantId: number | string, amount: string) => void;
  /** Hide the whole section (edit mode / non-standard link kinds). */
  disabled?: boolean;
  isMobile?: boolean;
}

// Strip markdown formatting to plain text for the description autofill.
// Small, no-deps. Handles the common cases: headers, bold, italic, links, code.
const mdToPlain = (md: string | null | undefined): string => {
  if (!md) return "";
  return md
    .replace(/```[\s\S]*?```/g, "")           // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")      // image markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // link markdown → text
    .replace(/^#{1,6}\s+/gm, "")                // headers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")         // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")            // italic
    .replace(/^>\s+/gm, "")                     // blockquote
    .replace(/^[\-*+]\s+/gm, "• ")              // list bullets
    .replace(/\n{3,}/g, "\n\n")                 // collapse blank lines
    .trim();
};

const formatMoney = (cents: number, currency: string): string => {
  const amt = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amt);
  } catch {
    return `${toFixedStr(amt, 2)} ${currency}`;
  }
};

const ProductQuickSell: React.FC<ProductQuickSellProps> = ({
  picked,
  onPick,
  onClear,
  onVariantChange,
  disabled,
  isMobile,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [query, setQuery] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosBaseApi.get(API_ENDPOINTS.products.list, {
        params: { status: "live", limit: 100 },
      });
      const items = res?.data?.data?.items || [];
      setProducts(items);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to load products";
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pickerOpen && products.length === 0 && !loading) {
      fetchProducts();
    }
  }, [pickerOpen, products.length, loading, fetchProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = [p.title, p.subtitle, p.category, p.product_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [products, query]);

  const handleSelect = useCallback(
    async (p: ProductSummary) => {
      // If this product has variants, fetch them so we can show the sub-dropdown.
      // Otherwise just auto-fill from the base price and finish immediately.
      let variants: ProductVariant[] | undefined;
      let selectedVariantId: number | string | null = null;
      let amountCents = Number(p.base_price_cents) || 0;

      if (p.has_variants) {
        try {
          const res = await axiosBaseApi.get(API_ENDPOINTS.products.byId(p.product_id));
          const raw: ProductVariant[] = res?.data?.data?.variants || [];
          variants = raw
            .filter((v) => v.is_active !== false)
            .sort((a, b) => Number(a.price_cents) - Number(b.price_cents));
          if (variants.length > 0) {
            // Default to the cheapest variant so the amount is sensible on pick.
            const v0 = variants[0];
            selectedVariantId = v0.variant_id;
            amountCents = Number(v0.price_cents) || 0;
          }
        } catch (e) {
          // Non-fatal — fall back to base_price and no variant selector shown.
          // (Common cause: product has has_variants=true but zero rows exist.)
          console.warn("[ProductQuickSell] Failed to load variants:", e);
        }
      }

      const amountDec = toFixedStr((amountCents / 100), 2);
      const desc = mdToPlain(p.description_md || p.subtitle || "").slice(0, 500);
      onPick({
        product_id: p.product_id,
        title: p.title,
        amount: amountDec,
        currency: p.currency || "USD",
        description: desc || p.title,
        cover_image_url: p.cover_image_url || null,
        product_type: p.product_type,
        variants,
        selected_variant_id: selectedVariantId,
      });
      setPickerOpen(false);
      setQuery("");
    },
    [onPick]
  );

  // Variant sub-dropdown handler — recompute the amount using variant price × qty.
  const handleVariantChange = useCallback(
    (variantId: number | string) => {
      if (!picked || !picked.variants) return;
      const v = picked.variants.find((x) => String(x.variant_id) === String(variantId));
      if (!v) return;
      const qty = Math.max(1, Number(picked.qty) || 1);
      const amountDec = toFixedStr(((Number(v.price_cents) || 0) * qty / 100), 2);
      if (onVariantChange) {
        onVariantChange(variantId, amountDec);
      }
    },
    [picked, onVariantChange]
  );

  // Format a variant's human label from attribute map + optional stock hint.
  // Example: "L / Black — $25.00" or "Standard — $10.00 (5 left)"
  const variantLabel = useCallback(
    (v: ProductVariant, currency: string): string => {
      const attrs = v.attributes || {};
      const attrParts = Object.values(attrs)
        .filter((x) => x !== null && x !== undefined && x !== "")
        .map((x) => String(x));
      const label = attrParts.length > 0 ? attrParts.join(" / ") : v.sku || "Default";
      const price = formatMoney(Number(v.price_cents) || 0, currency);
      const stockHint =
        v.stock_count !== null && v.stock_count !== undefined && Number(v.stock_count) <= 5
          ? ` (${v.stock_count} left)`
          : "";
      return `${label} — ${price}${stockHint}`;
    },
    []
  );

  if (disabled) return null;

  const accent = "#10B981"; // matches donation accent — subtle "shortcut" hint
  const borderColor = theme.palette.border?.main || (isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)");

  // ── Selected state ────────────────────────────────────────────────
  if (picked) {
    const showVariantSelect = Array.isArray(picked.variants) && picked.variants.length > 0;
    return (
      <Box
        data-testid="product-quick-sell-selected"
        mb={2}
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          p: isMobile ? "10px 12px" : "12px 14px",
          borderRadius: "12px",
          border: `1.5px solid ${accent}`,
          backgroundColor: isDark ? `${accent}1F` : `${accent}0D`,
        }}
      >
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {picked.cover_image_url ? (
            <Box
              component="img"
              src={picked.cover_image_url}
              alt=""
              sx={{
                width: 44,
                height: 44,
                borderRadius: "8px",
                objectFit: "cover",
                flexShrink: 0,
                backgroundColor: theme.palette.action.hover,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "8px",
                flexShrink: 0,
                backgroundColor: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Icon icon="mdi:package-variant-closed" width={22} />
            </Box>
          )}
          <Box flex={1} minWidth={0}>
            <Typography
              fontSize={13}
              fontWeight={700}
              color={theme.palette.text.primary}
              fontFamily="var(--font-sans)"
              noWrap
              title={picked.title}
            >
              {picked.title}
              {picked.qty && picked.qty > 1 ? (
                <Typography
                  component="span"
                  sx={{
                    ml: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    color: accent,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  × {picked.qty}
                </Typography>
              ) : null}
            </Typography>
            <Typography
              fontSize={12}
              color={theme.palette.text.secondary}
              fontFamily="var(--font-sans)"
              lineHeight={1.4}
              mt={0.25}
            >
              {t("productQuickSell.selectedHint", {
                defaultValue: "Amount & description auto-filled — you can still edit them below.",
              })}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            startIcon={<Icon icon="mdi:swap-horizontal" width={16} />}
            onClick={() => setPickerOpen(true)}
            sx={{
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              textTransform: "none",
              fontSize: 12,
              minWidth: 0,
              px: 1,
            }}
          >
            {t("productQuickSell.change", { defaultValue: "Change" })}
          </Button>
          <IconButton
            size="small"
            onClick={onClear}
            aria-label={t("productQuickSell.remove", { defaultValue: "Remove product" }) as string}
            sx={{ color: theme.palette.text.secondary }}
          >
            <Icon icon="mdi:close" width={18} />
          </IconButton>
        </Box>

        {/* Variant sub-dropdown — shown only when the picked product had
            has_variants=true AND we successfully loaded ≥1 active variant. */}
        {showVariantSelect && (
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, pl: 0.25 }}
            data-testid="product-quick-sell-variant-row"
          >
            <Typography
              fontSize={12}
              fontWeight={600}
              color={theme.palette.text.secondary}
              fontFamily="var(--font-sans)"
              sx={{ minWidth: 60 }}
            >
              {t("productQuickSell.variantLabel", { defaultValue: "Variant" })}
            </Typography>
            <Select
              size="small"
              value={String(picked.selected_variant_id || (picked.variants && picked.variants[0]?.variant_id) || "")}
              onChange={(e) => handleVariantChange(e.target.value)}
              data-testid="product-quick-sell-variant-select"
              fullWidth
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                backgroundColor: theme.palette.background.paper,
              }}
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 320 },
                },
              }}
            >
              {picked.variants!.map((v) => (
                <MenuItem
                  key={v.variant_id}
                  value={String(v.variant_id)}
                  disabled={v.stock_count !== null && v.stock_count !== undefined && Number(v.stock_count) === 0}
                  data-testid={`product-quick-sell-variant-option-${v.variant_id}`}
                  sx={{ fontFamily: "var(--font-sans)", fontSize: 13 }}
                >
                  {variantLabel(v, picked.currency)}
                  {v.stock_count !== null && v.stock_count !== undefined && Number(v.stock_count) === 0
                    ? " — sold out"
                    : ""}
                </MenuItem>
              ))}
            </Select>
          </Box>
        )}
        {pickerOpen && (
          <PickerDialog
            open
            onClose={() => setPickerOpen(false)}
            products={filtered}
            loading={loading}
            error={error}
            query={query}
            onQueryChange={setQuery}
            onSelect={handleSelect}
            t={t}
            theme={theme}
            currentId={picked.product_id}
          />
        )}
      </Box>
    );
  }

  // ── Empty state ────────────────────────────────────────────────
  return (
    <Box
      data-testid="product-quick-sell-empty"
      mb={2}
      sx={{
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        p: isMobile ? "10px 12px" : "12px 14px",
        borderRadius: "12px",
        border: `1.5px dashed ${borderColor}`,
        backgroundColor: "transparent",
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "8px",
          flexShrink: 0,
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.palette.text.secondary,
        }}
      >
        <Icon icon="mdi:store-outline" width={20} />
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography
          fontSize={13}
          fontWeight={700}
          color={theme.palette.text.primary}
          fontFamily="var(--font-sans)"
        >
          {t("productQuickSell.title", { defaultValue: "Sell a product from your store" })}
        </Typography>
        <Typography
          fontSize={12}
          color={theme.palette.text.secondary}
          fontFamily="var(--font-sans)"
          lineHeight={1.4}
          mt={0.25}
        >
          {t("productQuickSell.hint", {
            defaultValue: "Auto-fills amount, currency, description & image — or just fill in manually below.",
          })}
        </Typography>
      </Box>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setPickerOpen(true)}
        data-testid="product-quick-sell-open"
        startIcon={<Icon icon="mdi:magnify" width={16} />}
        sx={{
          color: theme.palette.text.primary,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          textTransform: "none",
          borderColor: borderColor,
          minHeight: { xs: 44, sm: "auto" },
          "&:hover": { borderColor: accent, backgroundColor: `${accent}0D` },
        }}
      >
        {t("productQuickSell.pick", { defaultValue: "Pick product" })}
      </Button>
      {pickerOpen && (
        <PickerDialog
          open
          onClose={() => setPickerOpen(false)}
          products={filtered}
          loading={loading}
          error={error}
          query={query}
          onQueryChange={setQuery}
          onSelect={handleSelect}
          t={t}
          theme={theme}
        />
      )}
    </Box>
  );
};

// ── Inline picker dialog ─────────────────────────────────────────────
interface PickerDialogProps {
  open: boolean;
  onClose: () => void;
  products: ProductSummary[];
  loading: boolean;
  error: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (p: ProductSummary) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
  theme: any;
  currentId?: number | string;
}

const PickerDialog: React.FC<PickerDialogProps> = ({
  open,
  onClose,
  products,
  loading,
  error,
  query,
  onQueryChange,
  onSelect,
  t,
  theme,
  currentId,
}) => {
  const isDark = theme.palette.mode === "dark";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "12px",
          maxHeight: "80vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1,
        }}
      >
        <Icon icon="mdi:store-outline" width={20} />
        {t("productQuickSell.dialogTitle", { defaultValue: "Pick a product from your store" })}
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: "auto" }}
          aria-label={t("productQuickSell.close", { defaultValue: "Close" }) as string}
        >
          <Icon icon="mdi:close" width={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            autoFocus
            placeholder={t("productQuickSell.searchPlaceholder", { defaultValue: "Search by name…" }) as string}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            data-testid="product-quick-sell-search"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon icon="mdi:magnify" width={18} />
                </InputAdornment>
              ),
              sx: { fontFamily: "var(--font-sans)", fontSize: 14 },
            }}
          />
        </Box>
        <Divider />

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Icon icon="mdi:alert-circle-outline" width={24} color={theme.palette.error.main} />
            <Typography
              fontSize={13}
              fontFamily="var(--font-sans)"
              color={theme.palette.error.main}
              mt={1}
            >
              {error}
            </Typography>
          </Box>
        )}

        {!loading && !error && products.length === 0 && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Icon
              icon="mdi:package-variant-remove"
              width={32}
              color={theme.palette.text.secondary}
            />
            <Typography
              fontSize={14}
              fontWeight={600}
              color={theme.palette.text.primary}
              fontFamily="var(--font-sans)"
              mt={1.5}
            >
              {query
                ? t("productQuickSell.noResults", { defaultValue: "No products match your search" })
                : t("productQuickSell.noneLive", { defaultValue: "No live products yet" })}
            </Typography>
            <Typography
              fontSize={12}
              color={theme.palette.text.secondary}
              fontFamily="var(--font-sans)"
              mt={0.5}
            >
              {t("productQuickSell.noneHint", {
                defaultValue: "Publish products in Store → Products, then come back to pick one.",
              })}
            </Typography>
          </Box>
        )}

        {!loading && !error && products.length > 0 && (
          <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
            {products.map((p) => {
              const isCurrent = String(p.product_id) === String(currentId);
              return (
                <Box
                  key={p.product_id}
                  role="button"
                  tabIndex={0}
                  data-testid={`product-quick-sell-item-${p.product_id}`}
                  onClick={() => onSelect(p)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(p);
                    }
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.5,
                    cursor: "pointer",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    "&:last-child": { borderBottom: "none" },
                    backgroundColor: isCurrent
                      ? isDark
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(16, 185, 129, 0.08)"
                      : "transparent",
                    "&:hover": {
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    },
                  }}
                >
                  {p.cover_image_url ? (
                    <Box
                      component="img"
                      src={p.cover_image_url}
                      alt=""
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "8px",
                        objectFit: "cover",
                        flexShrink: 0,
                        backgroundColor: theme.palette.action.hover,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "8px",
                        flexShrink: 0,
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      <Icon icon="mdi:package-variant-closed" width={22} />
                    </Box>
                  )}
                  <Box flex={1} minWidth={0}>
                    <Typography
                      fontSize={13.5}
                      fontWeight={700}
                      color={theme.palette.text.primary}
                      fontFamily="var(--font-sans)"
                      noWrap
                    >
                      {p.title}
                      {isCurrent && (
                        <Typography
                          component="span"
                          sx={{
                            ml: 1,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#10B981",
                            fontFamily: "var(--font-sans)",
                          }}
                        >
                          {t("productQuickSell.currentBadge", { defaultValue: "· current" })}
                        </Typography>
                      )}
                    </Typography>
                    {p.subtitle && (
                      <Typography
                        fontSize={12}
                        color={theme.palette.text.secondary}
                        fontFamily="var(--font-sans)"
                        noWrap
                      >
                        {p.subtitle}
                      </Typography>
                    )}
                    <Typography
                      fontSize={11.5}
                      color={theme.palette.text.secondary}
                      fontFamily="var(--font-sans)"
                      mt={0.25}
                    >
                      {p.product_type}
                    </Typography>
                  </Box>
                  <Typography
                    fontSize={14}
                    fontWeight={700}
                    color={theme.palette.text.primary}
                    fontFamily="var(--font-sans)"
                  >
                    {formatMoney(Number(p.base_price_cents) || 0, p.currency || "USD")}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductQuickSell;
