/**
 * Storefront checkout — order summary (left panel ≥1024px / collapsible bar
 * body below). Merchant branding, line items with thumbnails, tax/total rows,
 * fee disclosure and the trust row. Pure/presentational.
 */
import React from "react";
import { Box, Typography, Stack, Divider, Avatar } from "@mui/material";
import { useTranslation } from "react-i18next";
import PublicVerifiedBadge from "@/Components/UI/PublicVerifiedBadge";
import MerchantTrustRow from "@/Components/UI/MerchantTrustRow";
import ProductImage from "@/Components/UI/ProductImage";
import ProductCoverFallback from "@/Components/UI/ProductCoverFallback";

export interface CheckoutMerchant {
  name: string;
  avatar?: string | null;
  accent?: string | null;
}

export const CheckoutBrandHeader: React.FC<{
  handle: string;
  merchant: CheckoutMerchant | null;
}> = ({ handle, merchant }) => {
  const { t } = useTranslation("landing");
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }} data-testid="checkout-brand-header">
      <Avatar
        src={merchant?.avatar || undefined}
        alt=""
        sx={{ width: 44, height: 44, bgcolor: merchant?.accent || "primary.main", fontWeight: 800 }}
      >
        {(merchant?.name || handle).slice(0, 1).toUpperCase()}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" sx={{ display: "block", lineHeight: 1.2, color: "text.secondary", letterSpacing: "0.08em" }}>
          {t("checkout.store.title", { defaultValue: "Checkout" })}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", md: "1.5rem" }, lineHeight: 1.2, letterSpacing: "-0.02em" }} data-testid="checkout-merchant-name">
            {merchant?.name || `@${handle}`}
          </Typography>
          <PublicVerifiedBadge handle={handle} showLabel size={16} ml={0} />
        </Box>
      </Box>
    </Box>
  );
};

export const CheckoutOrderSummary: React.FC<{
  handle: string;
  merchant: CheckoutMerchant | null;
  lines: any[];
  quote: any | null;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  formatPrice: (cents: number, ccy: string) => string;
}> = ({ handle, merchant, lines, quote, currency, subtotalCents, totalCents, formatPrice }) => {
  const { t } = useTranslation("landing");
  const ccy = quote?.currency || currency;
  return (
    <>
      <CheckoutBrandHeader handle={handle} merchant={merchant} />

      <Stack spacing={1} sx={{ mt: 3 }} data-testid="checkout-summary">
        {lines.map((l) => (
          <Stack direction="row" key={`${l.product_id}-${l.variant_id || 0}`} alignItems="center" spacing={1.5} data-testid="checkout-line">
            <Box sx={{ position: "relative", width: 44, height: 44, borderRadius: 1.5, overflow: "hidden", flexShrink: 0, bgcolor: "action.hover" }}>
              {l.product_snapshot?.cover_image_url
                ? <ProductImage src={l.product_snapshot.cover_image_url} alt="" sizes="44px" />
                : <ProductCoverFallback title={l.product_snapshot?.title || ""} accent={merchant?.accent} fontSize={14} />}
            </Box>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              {l.product_snapshot?.title} × {l.quantity}
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatPrice(l.line_total_cents, currency)}
            </Typography>
          </Stack>
        ))}
        <Divider sx={{ my: 1 }} />
        {quote?.apply_tax && (Number(quote?.tax_cents) > 0 || quote?.reverse_charge) && (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">{t("checkout.store.subtotal")}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="checkout-subtotal">
                {formatPrice(Number(quote?.subtotal_cents ?? subtotalCents), ccy)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                {quote?.reverse_charge
                  ? `${quote?.tax_label || t("checkout.store.vatFallback")} — ${t("checkout.store.reverseChargeSuffix")}`
                  : `${quote?.tax_label || t("checkout.store.vatFallback")}${quote?.tax_rate != null ? ` (${Number(quote?.tax_rate)}%)` : ""}${quote?.tax_inclusive ? ` · ${t("checkout.store.inclSuffix")}` : ""}`}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="checkout-tax">
                {formatPrice(quote?.reverse_charge ? 0 : Number(quote?.tax_cents) || 0, ccy)}
              </Typography>
            </Stack>
          </>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography sx={{ fontWeight: 700 }}>{t("checkout.store.totalLabel")}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} data-testid="checkout-total">
            {formatPrice(totalCents, ccy)}
          </Typography>
        </Stack>
        {quote?.reverse_charge && (
          <Typography variant="caption" color="text.secondary" data-testid="checkout-reverse-charge-notice">
            {t("checkout.store.reverseChargeNotice")}
          </Typography>
        )}
      </Stack>

      <Box sx={{ mt: "auto", pt: 3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} data-testid="checkout-fee-note">
          {t("checkout.store.feeNote", { defaultValue: "No extra charges — the merchant covers the processing fee. Your wallet's own network fee is separate." })}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {t("checkout.store.poweredBy", { defaultValue: "Powered by Dynopay · Payment settles directly to the merchant’s wallet" })}
        </Typography>
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
          <MerchantTrustRow handle={handle} justify="flex-start" />
        </Box>
      </Box>
    </>
  );
};

export default CheckoutOrderSummary;
