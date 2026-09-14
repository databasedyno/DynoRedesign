import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CoinChips from "@/Components/UI/CoinChips";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { toFixedStr } from "@/utils/money";

interface Props {
  brandName: string;
  logoUrl?: string | null;
  description: string;
  amount: string;
  currency: string;
  coins: string[];
}

export const formatPreviewAmount = (value: string, currency: string): string | null => {
  const n = parseFloat(value);
  if (!isFinite(n) || n <= 0) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${toFixedStr(n, 2)}`;
  }
};

/** Phone-framed mock of the hosted checkout that updates live as the merchant types. */
const CheckoutPreview: React.FC<Props> = ({ brandName, logoUrl, description, amount, currency, coins }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const money = formatPreviewAmount(amount, currency);
  const brand = brandName.trim() || "Your brand";
  const initial = brand.charAt(0).toUpperCase();

  return (
    <Box data-testid="gs-checkout-preview" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light, boxShadow: `0 0 0 3px ${isDark ? "rgba(63,217,138,0.18)" : "rgba(5,147,106,0.14)"}` }} />
        {t("gs.previewEyebrow", { defaultValue: "Live preview" })}
      </Box>

      <Box
        sx={{
          width: "100%",
          maxWidth: 320,
          borderRadius: "30px",
          p: "10px",
          backgroundColor: isDark ? "#0E0F15" : "#121319",
          boxShadow: isDark ? "0 30px 60px -30px rgba(0,0,0,0.9)" : "0 30px 60px -30px rgba(10,10,15,0.45)",
        }}
      >
        <Box sx={{ borderRadius: "22px", overflow: "hidden", backgroundColor: isDark ? "#16171F" : "#FFFFFF", border: `1px solid ${border}` }}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
            <Box sx={{ width: 64, height: 5, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.12)" }} />
          </Box>
          <Box sx={{ px: 2.25, pt: 2.5, pb: 2.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              {logoUrl ? (
                <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36, borderRadius: "10px", objectFit: "cover", border: `1px solid ${border}` }} />
              ) : (
                <Box sx={{ width: 36, height: 36, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 15, color: "#FFFFFF", backgroundColor: indigo }}>
                  {initial}
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Box data-testid="gs-preview-brand" sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t("gs.previewPayTo", { brand, defaultValue: "Pay {{brand}}" })}
                </Box>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11, color: muted }}>
                  <Icon name="lock" size={11} />
                  {t("gs.previewSecured", { defaultValue: "Secured by Dynopay" })}
                </Box>
              </Box>
            </Box>

            <Box data-testid="gs-preview-description" sx={{ mt: 2.5, fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: description.trim() ? ink : muted, lineHeight: 1.4, wordBreak: "break-word" }}>
              {description.trim() || t("gs.previewDescPlaceholder", { defaultValue: "What is this payment for?" })}
            </Box>
            <Box data-testid="gs-preview-amount" sx={{ mt: 0.5, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: money ? ink : muted }}>
              {money || `${currency} 0.00`}
            </Box>

            <Box sx={{ mt: 2.25, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: muted }}>
              {t("gs.previewPayWith", { defaultValue: "Pay with" })}
            </Box>
            <Box data-testid="gs-preview-coins" sx={{ mt: 0.75, minHeight: 26 }}>
              {coins.length ? (
                <CoinChips value={coins} max={4} />
              ) : (
                <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
                  {t("gs.previewNoCoins", { defaultValue: "Coins from your payout wallets appear here" })}
                </Box>
              )}
            </Box>

            <Box sx={{ mt: 2.25, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "#FFFFFF", backgroundColor: indigo }}>
              <Icon name="zap" size={15} />
              {t("gs.previewButton", { defaultValue: "Pay with crypto" })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CheckoutPreview;
