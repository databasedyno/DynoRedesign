import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { formatWithSeparators, getCurrencySymbolFromFormat } from "@/utils/currencyFormat";

export interface ProductDraft {
  title: string;
  subtitle: string;
  description: string;
  priceDollars: string;
  currency: string;
  coverUrl: string;
  hideQuantity: boolean;
  isActive: boolean;
  variantCount: number;
}

/** Phone-frame preview of the public product page — mirrors /[handle]/p/[slug] while the merchant types. */
const ProductLivePreview = ({ draft, brandName }: { draft: ProductDraft; brandName?: string | null }) => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const border = theme.palette.divider;
  const price = Number(draft.priceDollars);
  const priceLabel = Number.isFinite(price) && draft.priceDollars.trim() !== ""
    ? `${getCurrencySymbolFromFormat(draft.currency)}${formatWithSeparators(price, draft.currency)}`
    : `${getCurrencySymbolFromFormat(draft.currency)}0.00`;
  const title = draft.title.trim() || t("productEditor.preview.titlePlaceholder", { defaultValue: "Your product title" });
  const desc = draft.description.trim();

  return (
    <Box data-testid="product-live-preview" sx={{ position: { lg: "sticky" }, top: { lg: 96 } }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.palette.text.secondary, mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.18)" }} />
        {t("productEditor.preview.label", { defaultValue: "Live preview" })}
      </Typography>
      <Box sx={{ width: "100%", maxWidth: 320, mx: { xs: "auto", lg: 0 }, borderRadius: "28px", border: `8px solid ${dark ? "#1F2430" : "#111827"}`, bgcolor: theme.palette.background.paper, overflow: "hidden", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.45)" }}>
        <Box sx={{ height: 18, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Box sx={{ width: 64, height: 5, borderRadius: 3, bgcolor: dark ? "#2A3040" : "#E5E7EB" }} />
        </Box>
        <Box sx={{ px: 1.75, pb: 2 }}>
          <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, mb: 1 }} noWrap>
            {brandName || "Your brand"} · {t("productEditor.preview.crumb", { defaultValue: "Shop" })}
          </Typography>
          <Box data-testid="product-live-preview-cover" sx={{ aspectRatio: "4 / 3", borderRadius: "14px", overflow: "hidden", border: `1px solid ${border}`, bgcolor: dark ? "rgba(255,255,255,0.04)" : "#F3F4F6", display: "grid", placeItems: "center" }}>
            {draft.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <Icon icon="mdi:image-outline" width={34} color={theme.palette.text.disabled} />
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}>
            <Box component="span" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", px: 0.9, py: 0.25, borderRadius: "999px", border: `1px solid ${border}`, color: theme.palette.text.secondary }} data-testid="product-live-preview-type">
              {t("productEditor.preview.digital", { defaultValue: "Digital" })}
            </Box>
            {!draft.isActive && (
              <Box component="span" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", px: 0.9, py: 0.25, borderRadius: "999px", bgcolor: dark ? "rgba(251,191,36,0.15)" : "#FEF3C7", color: dark ? "#FCD34D" : "#92400E" }} data-testid="product-live-preview-draft">
                {t("productEditor.preview.draft", { defaultValue: "Draft" })}
              </Box>
            )}
          </Box>
          <Typography data-testid="product-live-preview-title" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25, mt: 0.9, color: draft.title.trim() ? theme.palette.text.primary : theme.palette.text.secondary, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {title}
          </Typography>
          {draft.subtitle.trim() && (
            <Typography data-testid="product-live-preview-subtitle" sx={{ fontSize: 12.5, color: theme.palette.text.secondary, mt: 0.35 }} noWrap>{draft.subtitle.trim()}</Typography>
          )}
          <Typography data-testid="product-live-preview-price" sx={{ fontWeight: 800, fontSize: 22, mt: 1, fontVariantNumeric: "tabular-nums" }}>
            {priceLabel}
            {draft.variantCount > 1 && <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: theme.palette.text.secondary, ml: 0.75 }}>{t("productEditor.preview.fromVariants", { count: draft.variantCount, defaultValue: `${draft.variantCount} options` })}</Box>}
          </Typography>
          {desc && (
            <Typography data-testid="product-live-preview-desc" sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.5, mt: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>
              {desc}
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 0.75, mt: 1.75 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "10px", border: `1px solid ${border}`, display: "grid", placeItems: "center", color: theme.palette.text.secondary }}>
              <Icon icon="mdi:cart-outline" width={18} />
            </Box>
            <Box sx={{ flex: 1, height: 40, borderRadius: "10px", bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13.5 }}>
              {t("productEditor.preview.buyNow", { defaultValue: "Buy now" })}
            </Box>
          </Box>
          <Typography sx={{ fontSize: 10.5, color: theme.palette.text.secondary, textAlign: "center", mt: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
            <Icon icon="mdi:lock-outline" width={11} />
            {t("productEditor.preview.secured", { defaultValue: "Secured by Dynopay · pay with crypto" })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ProductLivePreview;
