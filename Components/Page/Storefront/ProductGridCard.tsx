import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import ProductImage from "@/Components/UI/ProductImage";
import { StatusDot } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { toFixedStr } from "@/utils/money";
import type { ProductRow } from "./productTypes";

interface Props {
  product: ProductRow;
  onOpen: (p: ProductRow) => void;
  onEdit: (p: ProductRow) => void;
  onQuickSell: (p: ProductRow) => void;
}

export const productStatusTone = (s: ProductRow["status"]) => (s === "live" ? "settled" : s === "draft" ? "pending" : "neutral");

/** Grid tile (plan 2.4): cover, title, price, status; hover reveals edit / quick-sell. Whole tile opens the detail panel. */
const ProductGridCard: React.FC<Props> = ({ product: p, onOpen, onEdit, onQuickSell }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const actionSx = { width: 34, height: 34, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${border}`, backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, cursor: "pointer", "&:hover": { borderColor: indigo, color: indigo } };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={p.title}
      data-testid={`product-card-${p.product_id}`}
      onClick={() => onOpen(p)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(p);
        }
      }}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: "16px",
        border: `1px solid ${border}`,
        backgroundColor: theme.palette.background.paper,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 150ms ease, transform 180ms ease, box-shadow 180ms ease",
        "&:hover, &:focus-within": { borderColor: indigo, boxShadow: isDark ? "0 12px 30px -18px rgba(0,0,0,0.8)" : "0 12px 30px -18px rgba(10,10,15,0.35)" },
        "&:hover .product-card-actions, &:focus-within .product-card-actions": { opacity: 1, transform: "translateY(0)" },
        "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
        "@media (prefers-reduced-motion: no-preference)": { "&:hover": { transform: "translateY(-2px)" } },
      }}
    >
      <Box sx={{ position: "relative", aspectRatio: "4 / 3", backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" }}>
        <ProductImage src={p.cover_image_url} alt="" sizes="(max-width: 600px) 50vw, 260px" />
        <Box sx={{ position: "absolute", top: 10, left: 10 }} data-testid={`product-card-status-${p.product_id}`}>
          <StatusDot tone={productStatusTone(p.status)} sx={{ backgroundColor: theme.palette.background.paper, px: 1, py: 0.25, borderRadius: 999 }}>
            {t(`products.status.${p.status}`, { defaultValue: p.status })}
          </StatusDot>
        </Box>
        <Box className="product-card-actions" sx={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 0.75, opacity: { xs: 1, md: 0 }, transform: { xs: "none", md: "translateY(4px)" }, transition: "opacity 150ms ease, transform 150ms ease" }}>
          <Box component="button" type="button" aria-label={t("products.edit", { defaultValue: "Edit" })} data-testid={`product-card-edit-${p.product_id}`} onClick={(e: React.MouseEvent) => { stop(e); onEdit(p); }} sx={actionSx}>
            <Icon name="pencil" size={15} />
          </Box>
          {p.status === "live" && (
            <Box component="button" type="button" aria-label={t("products.quickSell", { defaultValue: "Quick sell" })} data-testid={`product-card-quicksell-${p.product_id}`} onClick={(e: React.MouseEvent) => { stop(e); onQuickSell(p); }} sx={{ ...actionSx, color: "#10B981" }}>
              <Icon name="zap" size={15} />
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={{ p: 1.5, display: "grid", gap: 0.35 }}>
        <Typography noWrap sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>{p.title}</Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
          <Typography sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
            {toFixedStr(p.base_price_cents / 100, 2)} <Box component="span" sx={{ fontSize: 11.5, color: muted }}>{p.currency}</Box>
          </Typography>
          {typeof p.sold_count === "number" && p.sold_count > 0 && (
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted, whiteSpace: "nowrap" }}>
              {t("products.soldCount", { count: p.sold_count, defaultValue: "{{count}} sold" })}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ProductGridCard;
