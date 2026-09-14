import React, { useEffect, useRef, useState } from "react";
import { Box, Drawer, IconButton, TextField, Typography, useTheme } from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import CopyInline from "@/Components/UX/CopyInline";
import ProductImage from "@/Components/UI/ProductImage";
import { StatusDot } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { downloadQrPng } from "@/helpers/downloadQrPng";
import { toFixedStr } from "@/utils/money";
import { productStatusTone } from "./ProductGridCard";
import type { ProductRow } from "./productTypes";

interface Props {
  open: boolean;
  product: ProductRow | null;
  publicUrl: string | null;
  onClose: () => void;
  onEdit: (p: ProductRow) => void;
  onQuickSell: (p: ProductRow) => void;
  onArchive: (p: ProductRow) => void;
  onSaved: (next: ProductRow) => void;
  onError: (message: string) => void;
}

/** Slide-in detail panel (plan 2.4): image · price · status · stock · share/QR, plus quick edit without leaving the list. */
const ProductDetailPanel: React.FC<Props> = ({ open, product: p, publicUrl, onClose, onEdit, onQuickSell, onArchive, onSaved, onError }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("common");
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: muted };
  const iconBtnSx = { border: `1px solid ${border}`, borderRadius: "12px", minWidth: 42, minHeight: 42, color: ink, "&:hover": { backgroundColor: theme.palette.action.hover } };

  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState<null | "fields" | "status">(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p) return;
    setPrice(toFixedStr(p.base_price_cents / 100, 2));
    setStock(p.base_stock === null || p.base_stock === undefined ? "" : String(p.base_stock));
  }, [p?.product_id, p?.base_price_cents, p?.base_stock]);

  if (!p) return null;

  const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
  const stockNum = stock.trim() === "" ? null : Number(stock);
  const priceValid = Number.isFinite(priceCents) && priceCents >= 0;
  const stockValid = stockNum === null || (Number.isInteger(stockNum) && stockNum >= 0);
  const dirty = priceValid && stockValid && (priceCents !== p.base_price_cents || stockNum !== (p.base_stock ?? null));

  const saveFields = async () => {
    if (!dirty) return;
    setSaving("fields");
    try {
      const res = await axiosBaseApi.patch(`products/${p.product_id}`, { base_price_cents: priceCents, base_stock: stockNum });
      onSaved({ ...p, ...(res.data?.data?.product || {}), base_price_cents: priceCents, base_stock: stockNum });
    } catch (e: any) {
      onError(e?.response?.data?.message || t("products.saveFailed", { defaultValue: "Couldn't save changes." }));
    } finally {
      setSaving(null);
    }
  };

  const setStatus = async (next: ProductRow["status"]) => {
    if (next === p.status) return;
    setSaving("status");
    try {
      if (next === "live") await axiosBaseApi.post(`products/${p.product_id}/publish`);
      else if (next === "archived") await axiosBaseApi.post(`products/${p.product_id}/archive`);
      else await axiosBaseApi.patch(`products/${p.product_id}`, { status: "draft" });
      onSaved({ ...p, status: next });
    } catch (e: any) {
      const problems = e?.response?.data?.data?.problems;
      onError(Array.isArray(problems) && problems.length ? problems.join(" · ") : e?.response?.data?.message || t("products.saveFailed", { defaultValue: "Couldn't save changes." }));
    } finally {
      setSaving(null);
    }
  };

  const statusOptions: ProductRow["status"][] = ["draft", "live", "archived"];
  const typeLabel = t(`products.type.${p.product_type || "digital"}`, { defaultValue: p.product_type || "digital" });

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      keepMounted={false}
      transitionDuration={{ enter: 260, exit: 200 }}
      PaperProps={{
        "data-testid": "product-detail-panel",
        sx: isMobile
          ? { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92dvh", bgcolor: theme.palette.background.paper, backgroundImage: "none", display: "flex", flexDirection: "column" }
          : { width: { sm: 460, md: 500 }, maxWidth: "100%", bgcolor: theme.palette.background.paper, borderLeft: `1px solid ${border}`, backgroundImage: "none", display: "flex", flexDirection: "column" },
      } as any}
      BackdropProps={{ sx: { backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(10,10,15,0.35)", backdropFilter: "blur(2px)" } }}
    >
      {isMobile && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1.25 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(10,10,15,0.14)" }} />
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: theme.spacing(2, 2, 1.5, 2.5), borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={eyebrowSx}>{typeLabel}</Box>
          <Typography component="h2" data-testid="product-detail-title" sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {p.title}
          </Typography>
        </Box>
        <Box sx={{ pt: 0.5 }} data-testid="product-detail-status" data-status={p.status}>
          <StatusDot tone={productStatusTone(p.status)}>{t(`products.status.${p.status}`, { defaultValue: p.status })}</StatusDot>
        </Box>
        <IconButton onClick={onClose} data-testid="product-detail-close" aria-label={t("close", { defaultValue: "Close" })} size="small" sx={{ color: muted, mt: -0.25 }}>
          <Icon name="x" size={18} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: isMobile ? 2 : 2.5, display: "grid", gap: 2.5, alignContent: "start" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 2, alignItems: "start" }}>
          <Box sx={{ position: "relative", width: 112, height: 112, borderRadius: "14px", overflow: "hidden", backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)", border: `1px solid ${border}` }}>
            <ProductImage src={p.cover_image_url} alt="" sizes="112px" />
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Box data-testid="product-detail-price" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: ink, lineHeight: 1.1 }}>
              {toFixedStr(p.base_price_cents / 100, 2)} <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: muted }}>{p.currency}</Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {[
                { k: "stock", label: t("products.stock", { defaultValue: "Stock" }), v: p.has_variants ? t("products.perVariant", { defaultValue: "Per variant" }) : p.base_stock === null || p.base_stock === undefined ? t("products.unlimited", { defaultValue: "Unlimited" }) : String(p.base_stock) },
                { k: "sold", label: t("products.sold", { defaultValue: "Sold" }), v: String(p.sold_count ?? 0) },
              ].map((s) => (
                <Box key={s.k} data-testid={`product-detail-${s.k}`} sx={{ p: 1.25, borderRadius: "12px", border: `1px solid ${border}` }}>
                  <Box sx={eyebrowSx}>{s.label}</Box>
                  <Box sx={{ mt: 0.25, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 15, fontWeight: 700, color: ink }}>{s.v}</Box>
                </Box>
              ))}
            </Box>
            {p.category && <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>{t("products.category", { defaultValue: "Category" })}: {p.category}</Typography>}
          </Box>
        </Box>

        {publicUrl && p.status === "live" ? (
          <Box data-testid="product-detail-share">
            <Box sx={eyebrowSx}>{t("products.shareTitle", { defaultValue: "Share" })}</Box>
            <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "104px 1fr" }, gap: 1.5, alignItems: "start" }}>
              <Box ref={qrRef} sx={{ p: 0.75, borderRadius: "12px", backgroundColor: "#FFF", border: `1px solid ${border}`, lineHeight: 0, width: 104, justifySelf: { xs: "center", sm: "start" } }}>
                <QRCodeCanvas value={publicUrl} size={88} level="M" />
              </Box>
              <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, border: `1px solid ${border}`, borderRadius: "12px", pl: 1.5, pr: 0.5, py: 0.5, minWidth: 0 }}>
                  <Box data-testid="product-detail-url" sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{publicUrl.replace(/^https?:\/\//, "")}</Box>
                  <CopyInline value={publicUrl} size={15} testId="product-detail-copy" copyLabel={t("copy", { defaultValue: "Copy" })} sx={{ minWidth: 36, minHeight: 36 }} />
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <IconButton onClick={() => window.open(publicUrl, "_blank", "noopener")} data-testid="product-detail-open" aria-label={t("products.openPage", { defaultValue: "Open public page" })} sx={iconBtnSx}><Icon name="external-link" size={16} /></IconButton>
                  <IconButton onClick={() => downloadQrPng(qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null, { caption: publicUrl.replace(/^https?:\/\//, ""), filename: `dynopay-${p.slug}.png` })} data-testid="product-detail-qr-download" aria-label={t("products.downloadQr", { defaultValue: "Download QR" })} sx={iconBtnSx}><Icon name="download" size={16} /></IconButton>
                  <IconButton onClick={() => onQuickSell(p)} data-testid="product-detail-quicksell" aria-label={t("products.quickSell", { defaultValue: "Quick sell" })} sx={{ ...iconBtnSx, color: "#10B981" }}><Icon name="zap" size={16} /></IconButton>
                </Box>
              </Box>
            </Box>
          </Box>
        ) : (
          <Typography data-testid="product-detail-share-hint" sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
            {p.status === "live" ? t("products.claimHandleHint", { defaultValue: "Claim your page handle to get a shareable product link." }) : t("products.publishHint", { defaultValue: "Publish this product to get a shareable link and QR code." })}
          </Typography>
        )}

        <Box data-testid="product-detail-quick-edit">
          <Box sx={eyebrowSx}>{t("products.quickEdit", { defaultValue: "Quick edit" })}</Box>
          <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
            <TextField size="small" label={`${t("products.price", { defaultValue: "Price" })} (${p.currency})`} value={price} onChange={(e) => setPrice(e.target.value)} error={!priceValid} inputProps={{ inputMode: "decimal", "data-testid": "product-detail-price-input" }} />
            <TextField size="small" label={t("products.stock", { defaultValue: "Stock" })} placeholder={t("products.unlimited", { defaultValue: "Unlimited" })} value={stock} onChange={(e) => setStock(e.target.value)} error={!stockValid} disabled={!!p.has_variants} inputProps={{ inputMode: "numeric", "data-testid": "product-detail-stock-input" }} />
          </Box>
          <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box role="radiogroup" aria-label={t("products.statusLabel", { defaultValue: "Status" })} sx={{ display: "inline-flex", p: 0.4, gap: 0.4, borderRadius: 999, border: `1px solid ${border}` }}>
              {statusOptions.map((s) => {
                const active = p.status === s;
                return (
                  <Box key={s} component="button" type="button" role="radio" aria-checked={active} disabled={!!saving} data-testid={`product-detail-status-${s}`} onClick={() => setStatus(s)} sx={{ height: 30, px: 1.5, borderRadius: 999, border: 0, cursor: active ? "default" : "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : theme.palette.text.primary, backgroundColor: active ? indigo : "transparent", transition: "background-color 150ms ease", "&:hover": active ? {} : { backgroundColor: theme.palette.action.hover } }}>
                    {t(`products.status.${s}`, { defaultValue: s })}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ ml: "auto" }}>
              <CustomButton label={t("products.saveQuick", { defaultValue: "Save" })} variant="primary" size="small" disabled={!dirty} loading={saving === "fields"} onClick={saveFields} data-testid="product-detail-save" />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, display: "flex", gap: 1, p: isMobile ? 2 : 2.5, pb: isMobile ? "calc(16px + env(safe-area-inset-bottom))" : 2.5, borderTop: `1px solid ${border}` }}>
        <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 44 } }}>
          <CustomButton label={t("products.editFull", { defaultValue: "Edit product" })} variant="primary" startIcon={<Icon name="pencil" size={15} />} onClick={() => onEdit(p)} data-testid="product-detail-edit" />
        </Box>
        {p.status !== "archived" && (
          <IconButton onClick={() => onArchive(p)} data-testid="product-detail-archive" aria-label={t("products.archive", { defaultValue: "Archive" })} sx={{ ...iconBtnSx, minHeight: 44, minWidth: 44 }}>
            <Icon name="trash-2" size={16} />
          </IconButton>
        )}
      </Box>
    </Drawer>
  );
};

export default ProductDetailPanel;
