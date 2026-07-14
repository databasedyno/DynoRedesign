/**
 * ProductEditor — shared merchant editor for creating/editing a digital
 * product. Phase 1 keeps it lean: title, subtitle, description, price,
 * currency, cover image URL, digital delivery (file upload / URL /
 * license keys), and basic variants (title + price + stock).
 *
 * Uses axiosBaseApi so it inherits auth (JWT) + refresh-token behavior.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Typography, TextField, MenuItem, Select, FormControl,
  InputLabel, Switch, Stack, IconButton, Divider, LinearProgress,
  Chip, Alert, useTheme,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import { useRouter } from "next/router";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import axiosBaseApi from "@/axiosConfig";

const CURRENCY_OPTS = ["USD", "EUR", "GBP", "AUD", "CAD", "INR"];
const DELIVERY_OPTS: Array<{ v: "url" | "file" | "license_key"; label: string; hint: string }> = [
  { v: "url", label: "Access URL", hint: "Deliver a link (Notion, Google Drive, private site) on payment." },
  { v: "file", label: "File download", hint: "Upload your file(s). Buyer gets signed download links." },
  { v: "license_key", label: "License keys", hint: "Paste one key per line. One key is issued per purchase." },
];

interface Variant {
  variant_id?: number;
  title: string;
  price_cents: number;
  stock_count: number | null;
  is_active: boolean;
}

interface ProductRow {
  product_id: number;
  merchant_user_id: number;
  title: string;
  subtitle?: string;
  description_md?: string;
  slug: string;
  status: "draft" | "live" | "archived";
  base_price_cents: number;
  currency: string;
  cover_image_url?: string;
  has_variants?: boolean;
  base_stock?: number | null;
  digital_delivery_type?: "url" | "file" | "license_key" | null;
  digital_delivery_payload?: any;
}

interface Asset {
  asset_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface ProductEditorProps {
  mode: "new" | "edit";
  productId?: number;
}

const ProductEditor: React.FC<ProductEditorProps> = ({ mode, productId }) => {
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState<boolean>(mode === "edit");
  const [saving, setSaving] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [licenseKeysText, setLicenseKeysText] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<"url" | "file" | "license_key">("url");
  const [accessUrl, setAccessUrl] = useState<string>("");
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [baseStock, setBaseStock] = useState<string>("");

  useEffect(() => {
    if (mode !== "edit" || !productId) return;
    setLoading(true);
    axiosBaseApi
      .get(`products/${productId}`)
      .then((r) => {
        const d = r.data?.data || {};
        const p: ProductRow = d.product;
        setProduct(p);
        setAssets(d.assets || []);
        setVariants(
          (d.variants || []).map((v: any) => ({
            variant_id: v.variant_id,
            title: v.attributes?.title || v.sku || "Variant",
            price_cents: Number(v.price_cents) || 0,
            stock_count: v.stock_count == null ? null : Number(v.stock_count),
            is_active: v.is_active !== false,
          }))
        );
        setTitle(p.title || "");
        setSubtitle(p.subtitle || "");
        setDescription(p.description_md || "");
        setPriceDollars(((p.base_price_cents || 0) / 100).toString());
        setCurrency(p.currency || "USD");
        setCoverUrl(p.cover_image_url || "");
        setDeliveryType((p.digital_delivery_type as any) || "url");
        setAccessUrl(p.digital_delivery_payload?.access_url || "");
        setHasVariants(!!p.has_variants);
        setBaseStock(p.base_stock == null ? "" : String(p.base_stock));
        if (Array.isArray(p.digital_delivery_payload?.keys)) {
          setLicenseKeysText(p.digital_delivery_payload.keys.join("\n"));
        }
      })
      .catch((e) => {
        setToast({ text: e?.response?.data?.message || "Failed to load product", kind: "err" });
      })
      .finally(() => setLoading(false));
  }, [mode, productId]);

  const priceCents = useMemo(() => {
    const n = Number(priceDollars);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }, [priceDollars]);

  const buildPayload = () => {
    const payload: any = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description_md: description || undefined,
      base_price_cents: priceCents,
      currency,
      cover_image_url: coverUrl.trim() || undefined,
      product_type: "digital",
      has_variants: hasVariants,
      base_stock: hasVariants
        ? null
        : baseStock === ""
        ? null
        : Math.max(0, Math.floor(Number(baseStock) || 0)),
      digital_delivery_type: deliveryType,
    };
    if (deliveryType === "url") {
      payload.digital_delivery_payload = { access_url: accessUrl.trim() };
    } else if (deliveryType === "license_key") {
      const keys = licenseKeysText
        .split(/\r?\n/)
        .map((k) => k.trim())
        .filter(Boolean);
      payload.digital_delivery_payload = { keys };
    }
    return payload;
  };

  const validate = (): string | null => {
    if (!title.trim() || title.trim().length < 2) return "Title is required.";
    if (!hasVariants && priceCents <= 0) return "Price must be greater than 0.";
    if (deliveryType === "url" && !accessUrl.trim()) return "Enter the access URL.";
    return null;
  };

  const saveDraft = async () => {
    const err = validate();
    if (err) { setToast({ text: err, kind: "err" }); return; }
    setSaving(true);
    try {
      if (mode === "new" || !product) {
        const r = await axiosBaseApi.post("products", buildPayload());
        const newP: ProductRow = r.data?.data?.product;
        setToast({ text: "Product created.", kind: "ok" });
        router.replace(`/pay-links/products/${newP.product_id}/edit`);
      } else {
        await axiosBaseApi.patch(`products/${product.product_id}`, buildPayload());
        setToast({ text: "Saved.", kind: "ok" });
      }
    } catch (e: any) {
      setToast({ text: e?.response?.data?.message || "Save failed.", kind: "err" });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!product) { setToast({ text: "Save the draft first.", kind: "err" }); return; }
    const err = validate();
    if (err) { setToast({ text: err, kind: "err" }); return; }
    setPublishing(true);
    try {
      await axiosBaseApi.patch(`products/${product.product_id}`, buildPayload());
      const r = await axiosBaseApi.post(`products/${product.product_id}/publish`);
      setProduct(r.data?.data?.product);
      setToast({ text: "Published — your product is live.", kind: "ok" });
    } catch (e: any) {
      setToast({ text: e?.response?.data?.message || "Publish failed.", kind: "err" });
    } finally {
      setPublishing(false);
    }
  };

  const archive = async () => {
    if (!product) return;
    if (!window.confirm("Archive this product? Buyers won't be able to see it.")) return;
    try {
      await axiosBaseApi.post(`products/${product.product_id}/archive`);
      setProduct({ ...product, status: "archived" });
      setToast({ text: "Archived.", kind: "ok" });
    } catch (e: any) {
      setToast({ text: e?.response?.data?.message || "Archive failed.", kind: "err" });
    }
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await axiosBaseApi.post(
        `products/${product.product_id}/assets`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const asset = r.data?.data?.asset;
      if (asset) setAssets((prev) => [...prev, asset]);
      setToast({ text: "File uploaded.", kind: "ok" });
    } catch (err: any) {
      setToast({ text: err?.response?.data?.message || "Upload failed.", kind: "err" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAsset = async (assetId: number) => {
    if (!product) return;
    if (!window.confirm("Remove this file?")) return;
    try {
      await axiosBaseApi.delete(`products/${product.product_id}/assets/${assetId}`);
      setAssets((prev) => prev.filter((a) => a.asset_id !== assetId));
    } catch (err: any) {
      setToast({ text: err?.response?.data?.message || "Delete failed.", kind: "err" });
    }
  };

  // Variants — server round-trip per row (simpler than local batch)
  const addVariantRow = async () => {
    if (!product) { setToast({ text: "Save the draft first.", kind: "err" }); return; }
    try {
      const r = await axiosBaseApi.post(`products/${product.product_id}/variants`, {
        attributes: { title: `Variant ${variants.length + 1}` },
        price_cents: priceCents || 500,
        stock_count: null,
        is_active: true,
      });
      const v = r.data?.data?.variant;
      setVariants((prev) => [
        ...prev,
        {
          variant_id: v.variant_id,
          title: v.attributes?.title || "Variant",
          price_cents: Number(v.price_cents) || 0,
          stock_count: v.stock_count == null ? null : Number(v.stock_count),
          is_active: v.is_active !== false,
        },
      ]);
      setHasVariants(true);
    } catch (e: any) {
      setToast({ text: e?.response?.data?.message || "Add variant failed.", kind: "err" });
    }
  };

  const saveVariant = async (row: Variant) => {
    if (!product || !row.variant_id) return;
    try {
      await axiosBaseApi.patch(
        `products/${product.product_id}/variants/${row.variant_id}`,
        {
          attributes: { title: row.title },
          price_cents: Number(row.price_cents) || 0,
          stock_count: row.stock_count,
          is_active: row.is_active,
        }
      );
      setToast({ text: "Variant saved.", kind: "ok" });
    } catch (e: any) {
      setToast({ text: e?.response?.data?.message || "Variant save failed.", kind: "err" });
    }
  };

  const deleteVariant = async (row: Variant, idx: number) => {
    if (!product) return;
    if (row.variant_id) {
      try {
        await axiosBaseApi.delete(
          `products/${product.product_id}/variants/${row.variant_id}`
        );
      } catch (e: any) {
        setToast({ text: e?.response?.data?.message || "Delete failed.", kind: "err" });
        return;
      }
    }
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <LinearProgress data-testid="product-editor-loading" />;

  const isLive = product?.status === "live";
  const isArchived = product?.status === "archived";
  const publicPreviewHref = product
    ? `/${(typeof window !== "undefined" ? "" : "")}` +
      // The public preview URL uses the merchant's handle, which we don't
      // fetch here. Route through /pay-links/products so the merchant can
      // click through from the list.
      `pay-links/products/${product.product_id}/edit`
    : "#";

  return (
    <Stack spacing={2} data-testid="product-editor">
      {toast && (
        <Alert
          severity={toast.kind === "ok" ? "success" : "error"}
          onClose={() => setToast(null)}
          data-testid="product-editor-toast"
        >
          {toast.text}
        </Alert>
      )}

      <PanelCard title={mode === "new" ? "New product" : `Edit product`}>
        <Stack spacing={2}>
          {product && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                data-testid="product-status-chip"
                label={product.status.toUpperCase()}
                sx={{
                  bgcolor: isLive ? "success.light" : isArchived ? "grey.300" : "warning.light",
                  color: isLive ? "success.dark" : isArchived ? "text.secondary" : "warning.dark",
                  fontWeight: 600,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Slug: <b>{product.slug}</b>
              </Typography>
            </Stack>
          )}

          <TextField
            label="Product title"
            fullWidth value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ "data-testid": "product-title-input", maxLength: 160 }}
          />
          <TextField
            label="Subtitle (optional)"
            fullWidth value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            inputProps={{ "data-testid": "product-subtitle-input", maxLength: 240 }}
          />
          <TextField
            label="Description (Markdown supported)"
            fullWidth multiline minRows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            inputProps={{ "data-testid": "product-description-input" }}
          />
          <TextField
            label="Cover image URL (optional, https://…)"
            fullWidth value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            inputProps={{ "data-testid": "product-cover-input" }}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={hasVariants ? "Base price (informational, variants override)" : "Price"}
              type="number"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              inputProps={{ "data-testid": "product-price-input", step: "0.01", min: 0 }}
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel id="ccy-label">Currency</InputLabel>
              <Select
                labelId="ccy-label"
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(String(e.target.value))}
                inputProps={{ "data-testid": "product-currency-select" }}
              >
                {CURRENCY_OPTS.map((c) => (
                  <MenuItem key={c} value={c} data-testid={`product-currency-opt-${c}`}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {!hasVariants && (
              <TextField
                label="Stock (blank = unlimited)"
                type="number"
                value={baseStock}
                onChange={(e) => setBaseStock(e.target.value)}
                inputProps={{ "data-testid": "product-stock-input", min: 0 }}
                sx={{ width: 200 }}
              />
            )}
          </Stack>
        </Stack>
      </PanelCard>

      <PanelCard title="Digital delivery">
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="delivery-label">Delivery method</InputLabel>
            <Select
              labelId="delivery-label"
              label="Delivery method"
              value={deliveryType}
              onChange={(e) => setDeliveryType(String(e.target.value) as any)}
              inputProps={{ "data-testid": "product-delivery-select" }}
            >
              {DELIVERY_OPTS.map((d) => (
                <MenuItem key={d.v} value={d.v} data-testid={`product-delivery-opt-${d.v}`}>
                  {d.label}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {DELIVERY_OPTS.find((d) => d.v === deliveryType)?.hint}
            </Typography>
          </FormControl>

          {deliveryType === "url" && (
            <TextField
              label="Access URL"
              placeholder="https://your-drive-or-notion-link"
              fullWidth
              value={accessUrl}
              onChange={(e) => setAccessUrl(e.target.value)}
              inputProps={{ "data-testid": "product-access-url-input" }}
            />
          )}

          {deliveryType === "license_key" && (
            <TextField
              label="License keys (one per line)"
              multiline minRows={4}
              fullWidth
              value={licenseKeysText}
              onChange={(e) => setLicenseKeysText(e.target.value)}
              inputProps={{ "data-testid": "product-license-keys-input" }}
            />
          )}

          {deliveryType === "file" && (
            <Stack spacing={1}>
              <Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={onFileChosen}
                  data-testid="product-file-input"
                />
                <CustomButton
                  label={uploading ? "Uploading…" : "Upload a file"}
                  variant="outlined"
                  startIcon={<CloudUploadRounded />}
                  onClick={onUploadClick}
                  disabled={!product || uploading}
                  loading={uploading}
                  data-testid="product-file-upload-btn"
                />
                {!product && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Save the draft first, then you can upload files.
                  </Typography>
                )}
              </Box>
              <Stack spacing={0.5}>
                {assets.map((a) => (
                  <Stack
                    key={a.asset_id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}
                    data-testid={`product-asset-row-${a.asset_id}`}
                  >
                    <Typography sx={{ flex: 1, fontFamily: "var(--font-mono)" }}>
                      {a.filename}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(a.size_bytes / 1024).toFixed(1)} KB
                    </Typography>
                    <IconButton size="small" onClick={() => removeAsset(a.asset_id)} data-testid={`product-asset-remove-${a.asset_id}`}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </PanelCard>

      <PanelCard
        title="Variants (optional)"
        headerAction={
          product && (
            <CustomButton
              label="Add variant"
              variant="outlined"
              size="small"
              startIcon={<AddRounded />}
              onClick={addVariantRow}
              data-testid="product-variant-add-btn"
            />
          )
        }
        headerActionLayout="inline"
      >
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
              inputProps={{ "aria-label": "Enable variants", ...({ "data-testid": "product-has-variants-toggle" } as any) }}
            />
            <Typography variant="body2" color="text.secondary">
              Enable variants (e.g. different sizes / tiers). When on, each variant has its own price + stock.
            </Typography>
          </Stack>

          {hasVariants && variants.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No variants yet. Click "Add variant" to create one.
            </Typography>
          )}
          {hasVariants && variants.map((v, idx) => (
            <Stack
              key={v.variant_id || `new-${idx}`}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              sx={{ p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}
              data-testid={`product-variant-row-${idx}`}
            >
              <TextField
                label="Title"
                value={v.title}
                onChange={(e) => setVariants((p) => p.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                onBlur={() => saveVariant(variants[idx])}
                size="small"
                sx={{ flex: 2 }}
                inputProps={{ "data-testid": `product-variant-title-${idx}` }}
              />
              <TextField
                label="Price (¢)"
                type="number"
                value={v.price_cents}
                onChange={(e) => setVariants((p) => p.map((x, i) => i === idx ? { ...x, price_cents: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x))}
                onBlur={() => saveVariant(variants[idx])}
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ "data-testid": `product-variant-price-${idx}` }}
              />
              <TextField
                label="Stock"
                type="number"
                value={v.stock_count == null ? "" : String(v.stock_count)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setVariants((p) => p.map((x, i) => i === idx ? { ...x, stock_count: raw === "" ? null : Math.max(0, Math.floor(Number(raw) || 0)) } : x));
                }}
                onBlur={() => saveVariant(variants[idx])}
                size="small"
                sx={{ flex: 1 }}
                placeholder="∞"
                inputProps={{ "data-testid": `product-variant-stock-${idx}` }}
              />
              <IconButton
                size="small"
                onClick={() => deleteVariant(v, idx)}
                data-testid={`product-variant-delete-${idx}`}
                aria-label="Delete variant"
              >
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </PanelCard>

      <Divider />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
        <CustomButton
          label="Save draft"
          variant="outlined"
          onClick={saveDraft}
          loading={saving}
          disabled={saving || publishing}
          data-testid="product-save-btn"
        />
        <CustomButton
          label={isLive ? "Update live product" : "Publish"}
          variant="primary"
          onClick={publish}
          loading={publishing}
          disabled={saving || publishing || !product}
          data-testid="product-publish-btn"
        />
        {product && (
          <CustomButton
            label="Archive"
            variant="secondary"
            onClick={archive}
            disabled={saving || publishing || isArchived}
            data-testid="product-archive-btn"
          />
        )}
      </Stack>
    </Stack>
  );
};

export default ProductEditor;
