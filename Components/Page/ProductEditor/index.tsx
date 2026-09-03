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
  Chip, Alert, Snackbar, useTheme,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { useRouter } from "next/router";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import ImageCropperDialog from "@/Components/UI/ImageCropperDialog";
import { isCroppableImage } from "@/Components/UI/ImageCropperDialog/cropImage";
import axiosBaseApi from "@/axiosConfig";
import { PRICING_CURRENCIES } from "@/utils/pricingCurrencies";
import { API_ENDPOINTS } from "@/api/endpoints";
import { toFixedStr } from "@/utils/money";

const CURRENCY_OPTS = PRICING_CURRENCIES;
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
  image_url?: string | null;
}

interface GalleryItem {
  url: string;
  alt?: string;
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
  gallery_images?: GalleryItem[];
  has_variants?: boolean;
  hide_quantity?: boolean;
  base_stock?: number | null;
  digital_delivery_type?: "url" | "file" | "license_key" | null;
  digital_delivery_payload?: any;
  tax_category?: "digital" | "physical" | "service" | "exempt";
  apply_tax_override?: boolean | null;
}

// Backend cap = 10 items (see sanitizeGallery in productController.ts)
const MAX_GALLERY_ITEMS = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB, matches uploadImage multer limit
const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";

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

  // Image-upload state (cover + gallery + per-variant). Uses the shared
  // /api/pay/uploadCampaignImage endpoint (multer, 10 MB max, jpg/png/gif/
  // webp/svg) which returns an absolute URL served via /api/static/images/.
  const [coverUploading, setCoverUploading] = useState<boolean>(false);
  const coverImgInputRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState<boolean>(false);
  const galleryImgInputRef = useRef<HTMLInputElement>(null);
  const [galleryAltDraft, setGalleryAltDraft] = useState<string>("");
  const [galleryUrlDraft, setGalleryUrlDraft] = useState<string>("");
  const [variantImgUploadIdx, setVariantImgUploadIdx] = useState<number | null>(null);
  const variantImgInputRef = useRef<HTMLInputElement>(null);
  const [variantImgTargetIdx, setVariantImgTargetIdx] = useState<number | null>(null);

  // Crop & zoom step — mirrors the profile-photo / company-logo flow so
  // product imagery is framed consistently before it uploads. `cropTarget`
  // remembers which upload the cropped file belongs to.
  type CropTarget = { kind: "cover" } | { kind: "gallery" } | { kind: "variant"; idx: number };
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  // Local form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<"url" | "file" | "license_key">("url");
  const [accessUrl, setAccessUrl] = useState<string>("");
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [baseStock, setBaseStock] = useState<string>("");
  const [taxCategory, setTaxCategory] = useState<"digital" | "physical" | "service" | "exempt">("digital");
  const [applyTaxOverride, setApplyTaxOverride] = useState<"inherit" | "on" | "off">("inherit");
  const [hideQuantity, setHideQuantity] = useState<boolean>(false);

  // Merchant-level tax default (Settings → Tax) — surfaced here so the
  // "Inherit merchant default" option shows what buyers are actually charged,
  // and so the "at checkout" preview matches the storefront exactly.
  const [merchantTax, setMerchantTax] = useState<{ applyTax: boolean; country: string | null; loaded: boolean }>(
    { applyTax: false, country: null, loaded: false }
  );

  useEffect(() => {
    let mounted = true;
    axiosBaseApi
      .get("user/tax-settings")
      .then((r) => {
        const d = r.data?.data || {};
        if (!mounted) return;
        setMerchantTax({ applyTax: !!d.default_apply_tax, country: d.merchant_country_code || null, loaded: true });
      })
      .catch(() => {
        if (mounted) setMerchantTax((p) => ({ ...p, loaded: true }));
      });
    return () => {
      mounted = false;
    };
  }, []);

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
            image_url: v.image_url || null,
          }))
        );
        setTitle(p.title || "");
        setSubtitle(p.subtitle || "");
        setDescription(p.description_md || "");
        setPriceDollars(((p.base_price_cents || 0) / 100).toString());
        setCurrency(p.currency || "USD");
        setCoverUrl(p.cover_image_url || "");
        setGallery(
          Array.isArray(p.gallery_images)
            ? p.gallery_images
                .filter((g) => g && typeof g.url === "string" && g.url.trim())
                .map((g) => ({ url: String(g.url), alt: g.alt ? String(g.alt) : undefined }))
            : []
        );
        setDeliveryType((p.digital_delivery_type as any) || "url");
        setAccessUrl(p.digital_delivery_payload?.access_url || "");
        setHasVariants(!!p.has_variants);
        setBaseStock(p.base_stock == null ? "" : String(p.base_stock));
        setTaxCategory((p.tax_category as any) || "digital");
        setHideQuantity(!!p.hide_quantity);
        setApplyTaxOverride(
          p.apply_tax_override === true
            ? "on"
            : p.apply_tax_override === false
            ? "off"
            : "inherit"
        );
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
    const cleanGallery = gallery
      .filter((g) => g && typeof g.url === "string" && g.url.trim())
      .map((g) => ({
        url: g.url.trim().slice(0, 512),
        alt: g.alt ? g.alt.trim().slice(0, 240) : undefined,
      }))
      .slice(0, MAX_GALLERY_ITEMS);
    const payload: any = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description_md: description || undefined,
      base_price_cents: priceCents,
      currency,
      cover_image_url: coverUrl.trim() || undefined,
      gallery_images: cleanGallery,
      product_type: "digital",
      has_variants: hasVariants,
      base_stock: hasVariants
        ? null
        : baseStock === ""
        ? null
        : Math.max(0, Math.floor(Number(baseStock) || 0)),
      digital_delivery_type: deliveryType,
      tax_category: taxCategory,
      apply_tax_override:
        applyTaxOverride === "on" ? true : applyTaxOverride === "off" ? false : null,
      hide_quantity: hideQuantity,
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
    const err = validate();
    if (err) { setToast({ text: err, kind: "err" }); return; }
    setPublishing(true);
    try {
      let target = product;
      // New / unsaved product: create it first, then publish — one click, no
      // "save the draft first" dead-end.
      if (!target) {
        const cr = await axiosBaseApi.post("products", buildPayload());
        target = cr.data?.data?.product as ProductRow;
      } else {
        await axiosBaseApi.patch(`products/${target.product_id}`, buildPayload());
      }
      const r = await axiosBaseApi.post(`products/${target.product_id}/publish`);
      setProduct(r.data?.data?.product);
      setToast({ text: "Published — your product is live.", kind: "ok" });
      // Just created? Move the URL onto the saved product so refreshes / further
      // edits target the right record.
      if (mode === "new") {
        router.replace(`/pay-links/products/${target.product_id}/edit`);
      }
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

  // ── Image upload helper (cover / gallery / variant) ──────────────────
  // Uses /api/pay/uploadCampaignImage — the shared image-upload endpoint
  // (multer, 10 MB max, jpg/png/gif/webp/svg). Returns absolute URL served
  // via /api/static/images. Draft doesn't need to be saved first because
  // this endpoint only needs auth (not product_id).
  const uploadImageFile = async (file: File): Promise<string | null> => {
    if (!file) return null;
    if (file.size > MAX_IMAGE_BYTES) {
      setToast({ text: "Image is too large (max 10 MB).", kind: "err" });
      return null;
    }
    if (!file.type.startsWith("image/")) {
      setToast({ text: "Only image files are allowed.", kind: "err" });
      return null;
    }
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await axiosBaseApi.post(API_ENDPOINTS.pay.uploadCampaignImage, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url: string | undefined = r?.data?.data?.url;
      if (!url) throw new Error("No URL returned from upload.");
      return url;
    } catch (err: any) {
      setToast({
        text: err?.response?.data?.message || err?.message || "Image upload failed.",
        kind: "err",
      });
      return null;
    }
  };

  const doCoverUpload = async (file: File) => {
    setCoverUploading(true);
    const url = await uploadImageFile(file);
    setCoverUploading(false);
    if (url) {
      setCoverUrl(url);
      setToast({ text: "Cover image uploaded.", kind: "ok" });
    }
  };

  const onCoverImgChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (coverImgInputRef.current) coverImgInputRef.current.value = "";
    if (!file) return;
    // Crop & zoom step first (sharp, well-framed covers). SVG/GIF/HEIC
    // bypass the cropper and upload untouched, like the avatar/logo flow.
    if (isCroppableImage(file.type)) {
      setCropTarget({ kind: "cover" });
      setCropFile(file);
      setCropSrc(URL.createObjectURL(file));
      return;
    }
    void doCoverUpload(file);
  };

  const doGalleryUpload = async (file: File) => {
    setGalleryUploading(true);
    const url = await uploadImageFile(file);
    setGalleryUploading(false);
    if (url) {
      setGallery((prev) => [
        ...prev,
        { url, alt: galleryAltDraft.trim() || undefined },
      ].slice(0, MAX_GALLERY_ITEMS));
      setGalleryAltDraft("");
      setToast({ text: "Gallery image added.", kind: "ok" });
    }
  };

  const onGalleryImgChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (galleryImgInputRef.current) galleryImgInputRef.current.value = "";
    if (!file) return;
    if (gallery.length >= MAX_GALLERY_ITEMS) {
      setToast({ text: `Gallery is full (max ${MAX_GALLERY_ITEMS} images).`, kind: "err" });
      return;
    }
    if (isCroppableImage(file.type)) {
      setCropTarget({ kind: "gallery" });
      setCropFile(file);
      setCropSrc(URL.createObjectURL(file));
      return;
    }
    void doGalleryUpload(file);
  };

  const addGalleryFromUrl = () => {
    const url = galleryUrlDraft.trim();
    if (!url) {
      setToast({ text: "Enter an image URL.", kind: "err" });
      return;
    }
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      setToast({ text: "URL must start with http(s):// or /", kind: "err" });
      return;
    }
    if (url.length > 512) {
      setToast({ text: "URL is too long (max 512 chars).", kind: "err" });
      return;
    }
    if (gallery.some((g) => g.url === url)) {
      setToast({ text: "That image is already in the gallery.", kind: "err" });
      return;
    }
    if (gallery.length >= MAX_GALLERY_ITEMS) {
      setToast({ text: `Gallery is full (max ${MAX_GALLERY_ITEMS} images).`, kind: "err" });
      return;
    }
    setGallery((prev) => [
      ...prev,
      { url, alt: galleryAltDraft.trim() || undefined },
    ]);
    setGalleryUrlDraft("");
    setGalleryAltDraft("");
  };

  const removeGalleryAt = (idx: number) => {
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  };

  const onVariantImgClick = (idx: number) => {
    setVariantImgTargetIdx(idx);
    // trigger the shared variant image file input
    setTimeout(() => variantImgInputRef.current?.click(), 0);
  };

  const doVariantUpload = async (file: File, idx: number) => {
    setVariantImgUploadIdx(idx);
    const url = await uploadImageFile(file);
    setVariantImgUploadIdx(null);
    if (!url) return;
    setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, image_url: url } : x)));
    // If the row already exists on the server, persist immediately so the
    // uploaded image survives page reloads even without hitting Save.
    const row = variants[idx];
    if (product && row?.variant_id) {
      try {
        await axiosBaseApi.patch(
          `products/${product.product_id}/variants/${row.variant_id}`,
          { image_url: url }
        );
      } catch (err: any) {
        setToast({
          text: err?.response?.data?.message || "Failed to save variant image.",
          kind: "err",
        });
        return;
      }
    }
    setToast({ text: "Variant image uploaded.", kind: "ok" });
  };

  const onVariantImgChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = variantImgTargetIdx;
    if (variantImgInputRef.current) variantImgInputRef.current.value = "";
    setVariantImgTargetIdx(null);
    if (!file || idx == null) return;
    if (isCroppableImage(file.type)) {
      setCropTarget({ kind: "variant", idx });
      setCropFile(file);
      setCropSrc(URL.createObjectURL(file));
      return;
    }
    void doVariantUpload(file, idx);
  };

  // ── Crop dialog plumbing (cover / gallery / variant) ──────────────────
  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropFile(null);
    setCropTarget(null);
  };

  const handleCropApply = (file: File) => {
    const target = cropTarget;
    closeCropper();
    if (!target) return;
    if (target.kind === "cover") void doCoverUpload(file);
    else if (target.kind === "gallery") void doGalleryUpload(file);
    else void doVariantUpload(file, target.idx);
  };

  // Aspect per surface: covers/gallery frame as 4:3 landscape; variant
  // thumbnails are square (they render small next to the option name).
  const cropAspect = cropTarget?.kind === "variant" ? 1 : 4 / 3;

  const removeVariantImage = async (idx: number) => {
    const row = variants[idx];
    setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, image_url: null } : x)));
    if (product && row?.variant_id) {
      try {
        await axiosBaseApi.patch(
          `products/${product.product_id}/variants/${row.variant_id}`,
          { image_url: null }
        );
      } catch (err: any) {
        setToast({
          text: err?.response?.data?.message || "Failed to clear variant image.",
          kind: "err",
        });
      }
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
          image_url: row.image_url ?? null,
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

  // Effective tax behavior for THIS product at checkout — mirrors the backend
  // cartController resolution (exempt always wins; else per-product override
  // beats the merchant default). Drives the "at checkout" preview below.
  const taxIsExempt = taxCategory === "exempt";
  const taxEffectiveOn = taxIsExempt
    ? false
    : applyTaxOverride === "on"
    ? true
    : applyTaxOverride === "off"
    ? false
    : merchantTax.applyTax;
  const taxInheritsOffDefault =
    !taxIsExempt && applyTaxOverride === "inherit" && merchantTax.loaded && !merchantTax.applyTax;

  return (
    <Stack spacing={2} data-testid="product-editor">
      {toast && (
        <Snackbar
          open
          autoHideDuration={4000}
          onClose={(_e, reason) => { if (reason !== "clickaway") setToast(null); }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ zIndex: (th) => th.zIndex.modal + 2 }}
        >
          <Alert
            severity={toast.kind === "ok" ? "success" : "error"}
            variant="filled"
            onClose={() => setToast(null)}
            data-testid="product-editor-toast"
            sx={{ width: "100%", boxShadow: 6 }}
          >
            {toast.text}
          </Alert>
        </Snackbar>
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
          {/* Cover image: URL field + Upload button + preview */}
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Cover image
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
              <TextField
                label="Image URL (optional, https://…)"
                fullWidth
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                inputProps={{ "data-testid": "product-cover-input", maxLength: 512 }}
                sx={{ flex: 1 }}
              />
              <input
                ref={coverImgInputRef}
                type="file"
                hidden
                accept={IMAGE_ACCEPT}
                onChange={onCoverImgChosen}
                data-testid="product-cover-file-input"
              />
              <CustomButton
                label={coverUploading ? "Uploading…" : "Upload image"}
                variant="outlined"
                startIcon={<CloudUploadRounded />}
                onClick={() => coverImgInputRef.current?.click()}
                disabled={coverUploading}
                loading={coverUploading}
                data-testid="product-cover-upload-btn"
              />
              {coverUrl && (
                <IconButton
                  size="small"
                  aria-label="Remove cover image"
                  onClick={() => setCoverUrl("")}
                  data-testid="product-cover-clear-btn"
                  sx={{ alignSelf: { sm: "center" } }}
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              )}
            </Stack>
            {coverUrl && (
              <Box
                sx={{
                  mt: 1,
                  width: 160,
                  height: 100,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  border: `1px solid ${theme.palette.divider}`,
                  background: theme.palette.action.hover,
                }}
                data-testid="product-cover-preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary merchant-provided cover URL, not domain-whitelisted */}
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              JPG, PNG, GIF, WebP or SVG. Max 10 MB. Uploaded images are served over the app CDN.
            </Typography>
          </Stack>

          {/* Photo gallery — max MAX_GALLERY_ITEMS additional images shown on the product page */}
          <Stack spacing={1} data-testid="product-gallery-section">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Photo gallery (optional)
              </Typography>
              <Chip
                size="small"
                label={`${gallery.length}/${MAX_GALLERY_ITEMS}`}
                data-testid="product-gallery-count"
              />
            </Stack>
            {gallery.length > 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(4, 1fr)", md: "repeat(5, 1fr)" },
                  gap: 1,
                }}
                data-testid="product-gallery-grid"
              >
                {gallery.map((g, idx) => (
                  <Box
                    key={`${g.url}-${idx}`}
                    sx={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      border: `1px solid ${theme.palette.divider}`,
                      background: theme.palette.action.hover,
                    }}
                    data-testid={`product-gallery-item-${idx}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.url}
                      alt={g.alt || `Gallery image ${idx + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeGalleryAt(idx)}
                      data-testid={`product-gallery-remove-${idx}`}
                      aria-label="Remove gallery image"
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        background: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        "&:hover": { background: "rgba(0,0,0,0.75)" },
                      }}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {gallery.length < MAX_GALLERY_ITEMS && (
              <Stack spacing={1} sx={{ p: 1.5, border: `1px dashed ${theme.palette.divider}`, borderRadius: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Image URL"
                    placeholder="https://…"
                    fullWidth
                    size="small"
                    value={galleryUrlDraft}
                    onChange={(e) => setGalleryUrlDraft(e.target.value)}
                    inputProps={{ "data-testid": "product-gallery-url-input", maxLength: 512 }}
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    label="Alt text (optional)"
                    placeholder="Describe the image"
                    fullWidth
                    size="small"
                    value={galleryAltDraft}
                    onChange={(e) => setGalleryAltDraft(e.target.value)}
                    inputProps={{ "data-testid": "product-gallery-alt-input", maxLength: 240 }}
                    sx={{ flex: 2 }}
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <CustomButton
                    label="Add from URL"
                    variant="outlined"
                    size="small"
                    startIcon={<AddRounded />}
                    onClick={addGalleryFromUrl}
                    disabled={galleryUploading}
                    data-testid="product-gallery-add-url-btn"
                  />
                  <input
                    ref={galleryImgInputRef}
                    type="file"
                    hidden
                    accept={IMAGE_ACCEPT}
                    onChange={onGalleryImgChosen}
                    data-testid="product-gallery-file-input"
                  />
                  <CustomButton
                    label={galleryUploading ? "Uploading…" : "Upload from device"}
                    variant="outlined"
                    size="small"
                    startIcon={<CloudUploadRounded />}
                    onClick={() => galleryImgInputRef.current?.click()}
                    disabled={galleryUploading}
                    loading={galleryUploading}
                    data-testid="product-gallery-upload-btn"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Max 10 MB per image, up to {MAX_GALLERY_ITEMS} images total.
                </Typography>
              </Stack>
            )}
          </Stack>

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
                      {toFixedStr((a.size_bytes / 1024), 1)} KB
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

      <PanelCard title="Tax & VAT">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary" data-testid="product-tax-intro">
            Choose whether buyers are charged tax on this product. This is exactly what shows on your storefront checkout.
          </Typography>

          {/* Primary decision — charge tax or not */}
          <FormControl fullWidth>
            <InputLabel id="tax-override-label">Charge tax on this product</InputLabel>
            <Select
              labelId="tax-override-label"
              label="Charge tax on this product"
              value={applyTaxOverride}
              onChange={(e) => setApplyTaxOverride(String(e.target.value) as any)}
              inputProps={{ "data-testid": "product-tax-override-select" }}
              disabled={taxCategory === "exempt"}
            >
              <MenuItem value="inherit" data-testid="product-tax-override-opt-inherit">
                {merchantTax.loaded
                  ? `Inherit store default (currently: ${merchantTax.applyTax ? "charging tax" : "no tax"})`
                  : "Inherit store default"}
              </MenuItem>
              <MenuItem value="on" data-testid="product-tax-override-opt-on">Always charge tax</MenuItem>
              <MenuItem value="off" data-testid="product-tax-override-opt-off">Never charge tax</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {taxCategory === "exempt"
                ? "Overrides don't apply to tax-exempt products."
                : "Overrides your store-wide default (Settings → Tax) for this product only."}
            </Typography>
          </FormControl>

          {/* Tax category — jurisdiction rules */}
          <FormControl fullWidth>
            <InputLabel id="tax-category-label">Tax category</InputLabel>
            <Select
              labelId="tax-category-label"
              label="Tax category"
              value={taxCategory}
              onChange={(e) => setTaxCategory(String(e.target.value) as any)}
              inputProps={{ "data-testid": "product-tax-category-select" }}
            >
              <MenuItem value="digital" data-testid="product-tax-category-opt-digital">Digital goods / services</MenuItem>
              <MenuItem value="physical" data-testid="product-tax-category-opt-physical">Physical goods</MenuItem>
              <MenuItem value="service" data-testid="product-tax-category-opt-service">Service</MenuItem>
              <MenuItem value="exempt" data-testid="product-tax-category-opt-exempt">Tax exempt</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {taxCategory === "exempt"
                ? "This product is always sold tax-free, regardless of your tax settings."
                : taxCategory === "physical"
                ? "Physical goods use the buyer's shipping-address country for the tax jurisdiction."
                : "Digital goods / services use the buyer's detected location for the tax jurisdiction."}
            </Typography>
          </FormControl>

          {/* Effective preview — what the buyer actually sees at checkout */}
          <Box
            data-testid="product-tax-effective"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              p: 1.5,
              borderRadius: "10px",
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: taxEffectiveOn
                ? (theme.palette.mode === "dark" ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)")
                : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
            }}
          >
            <ReceiptLongRounded sx={{ fontSize: 18, color: "text.secondary", mt: "1px" }} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", display: "block" }}>
                At checkout
              </Typography>
              <Typography variant="body2" sx={{ color: "text.primary", mt: 0.25 }} data-testid="product-tax-effective-text">
                {taxIsExempt
                  ? "Tax-exempt — this product is always sold tax-free."
                  : taxEffectiveOn
                  ? `Buyers are charged VAT/tax based on their ${taxCategory === "physical" ? "shipping-address country" : "location"}.`
                  : "No tax is added — buyers pay exactly the listed price."}
              </Typography>
            </Box>
          </Box>

          {/* Discoverability nudge — inheriting a store default that is OFF */}
          {taxInheritsOffDefault && (
            <Alert severity="info" data-testid="product-tax-default-hint" sx={{ borderRadius: "10px" }}>
              Your store default is currently <strong>No tax</strong>. Turn it on for all checkouts in Settings → Tax,
              or set this product to <strong>Always charge tax</strong>.
            </Alert>
          )}

          <Typography
            variant="body2"
            data-testid="product-tax-settings-link"
            onClick={() => router.push("/settings?section=tax")}
            sx={{
              color: "primary.main",
              fontWeight: 600,
              cursor: "pointer",
              width: "fit-content",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Manage your store-wide tax default in Settings → Tax →
          </Typography>
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
          {/* Shared hidden file input reused for whichever variant row triggered the upload */}
          <input
            ref={variantImgInputRef}
            type="file"
            hidden
            accept={IMAGE_ACCEPT}
            onChange={onVariantImgChosen}
            data-testid="product-variant-file-input"
          />
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

          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch
              checked={hideQuantity}
              onChange={(e) => setHideQuantity(e.target.checked)}
              inputProps={{ "aria-label": "One-off service", ...({ "data-testid": "product-hide-quantity-toggle" } as any) }}
            />
            <Typography variant="body2" color="text.secondary">
              One-off service (hide the quantity selector). Turn on for products like “Talk to a Developer” where a quantity makes no sense — buyers purchase it once.
            </Typography>
          </Stack>

          {hasVariants && variants.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No variants yet. Click “Add variant” to create one.
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
              {/* Variant image thumbnail + upload */}
              <Stack alignItems="center" spacing={0.5} sx={{ width: 68 }} data-testid={`product-variant-image-${idx}`}>
                {v.image_url ? (
                  <Box
                    sx={{
                      position: "relative",
                      width: 56,
                      height: 56,
                      borderRadius: 1,
                      overflow: "hidden",
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.image_url}
                      alt={`${v.title} image`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => removeVariantImage(idx)}
                      aria-label="Remove variant image"
                      data-testid={`product-variant-image-remove-${idx}`}
                      sx={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        background: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        p: "2px",
                      }}
                    >
                      <DeleteOutlineRounded sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1,
                      border: `1px dashed ${theme.palette.divider}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: theme.palette.text.disabled,
                    }}
                  >
                    <CloudUploadRounded sx={{ fontSize: 20 }} />
                  </Box>
                )}
                <CustomButton
                  label={variantImgUploadIdx === idx ? "…" : v.image_url ? "Change" : "Add"}
                  variant="outlined"
                  size="small"
                  onClick={() => onVariantImgClick(idx)}
                  disabled={variantImgUploadIdx !== null}
                  data-testid={`product-variant-image-upload-${idx}`}
                  sx={{ minWidth: 0, px: 0.5, fontSize: 11 }}
                />
              </Stack>
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end" data-dyno-anchor="cta">
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

      {cropSrc && (
        <ImageCropperDialog
          open
          imageSrc={cropSrc}
          sourceFile={cropFile}
          cropShape="rect"
          aspect={cropAspect}
          title="Adjust image"
          onCancel={closeCropper}
          onApply={(file) => handleCropApply(file)}
        />
      )}
    </Stack>
  );
};

export default ProductEditor;
