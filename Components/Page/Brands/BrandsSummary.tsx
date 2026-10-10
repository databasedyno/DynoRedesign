import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { formatCurrency } from "@/utils/currencyFormat";
import { BrandsData } from "./useBrands";
import FxAsOfLabel from "@/Components/UI/FxAsOfLabel";


/** Top summary strip — account-wide totals across every accessible brand. */
const BrandsSummary: React.FC<{ data: BrandsData | null; loading: boolean }> = ({ data, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primary = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const surface = isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light;
  const warn = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;

  const cur = data?.currency ?? "USD";
  const s = data?.summary;
  const attention = s?.attention_count ?? 0;

  const tiles = [
    { key: "brands", label: t("brandsOverview.sumBrands", { defaultValue: "Brands" }), value: String(s?.brand_count ?? 0) },
    { key: "settled", label: t("brandsOverview.sumSettled", { defaultValue: "Settled volume" }), value: formatCurrency(s?.settled_amount ?? 0, cur) },
    { key: "payments", label: t("brandsOverview.sumPayments", { defaultValue: "Payments" }), value: String(s?.payments_count ?? 0) },
    { key: "pending", label: t("brandsOverview.sumPending", { defaultValue: "Pending" }), value: formatCurrency(s?.pending_amount ?? 0, cur) },
    { key: "attention", label: t("brandsOverview.sumAttention", { defaultValue: "Needs attention" }), value: String(attention), warn: attention > 0 },
  ];

  return (
    <Box
      data-testid="brands-summary"
      sx={{
        display: "grid",
        gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" },
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: `1px solid ${border}`,
        bgcolor: surface,
        opacity: loading ? 0.6 : 1,
        transition: "opacity 150ms ease",
      }}
    >
      {tiles.map((tile) => (
        <Box key={tile.key} data-testid={`brands-sum-${tile.key}`}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, mb: 0.5 }}>{tile.label}</Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-mono, var(--font-sans))",
              fontWeight: 700,
              fontSize: { xs: 18, sm: 20 },
              color: tile.warn ? warn : primary,
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {tile.value}
          </Typography>
          {tile.key === "settled" && <FxAsOfLabel fx={data?.fx} testId="brands-fx-as-of" sx={{ mt: 0.5 }} />}
        </Box>
      ))}
    </Box>
  );
};

export default BrandsSummary;
