import React from "react";
import { Box, FormControl, MenuItem, Select, Skeleton, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { StatCard } from "@/Components/Page/Dashboard/v2026/styled";
import { money } from "@/Components/Page/Dashboard/v2026/command/format";
import { INVOICE_PERIODS, InvoicePeriod, PERIOD_LABEL_KEY } from "./invoicePeriods";
import type { PeriodSummary } from "./usePeriodSummary";

interface Props {
  period: InvoicePeriod;
  onPeriodChange: (p: InvoicePeriod) => void;
  data: PeriodSummary | null | undefined;
  loading: boolean;
  exporting: boolean;
  onExport: () => void;
}

/** Receipts & Tax header: period picker · collected · tax · fees · one-click export for that period. */
const PeriodTotals: React.FC<Props> = ({ period, onPeriodChange, data, loading, exporting, onExport }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const sym = data?.currency_symbol || "$";
  const cur = data?.currency || "USD";
  const empty = !loading && !!data && data.payments_count === 0 && data.receipts_count === 0;

  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" as const, color: muted };
  const valueSx = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" as const, fontSize: { xs: 24, md: 28 }, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, color: ink, minHeight: 32 };
  const captionSx = { fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.4 };

  const tiles = [
    {
      id: "collected",
      label: t("invoices.headerCollected", { defaultValue: "Collected" }),
      value: data ? money(data.collected, sym, cur) : "—",
      caption: data ? t("invoices.headerCollectedCaption", { count: data.payments_count, defaultValue: "{{count}} settled payments" }) : "",
      color: ink,
    },
    {
      id: "tax",
      label: t("invoices.headerTax", { defaultValue: "Tax collected" }),
      value: data ? money(data.tax_collected, sym, cur) : "—",
      caption: data
        ? data.taxed_orders > 0
          ? t("invoices.headerTaxCaption", { count: data.taxed_orders, defaultValue: "from {{count}} paid orders" })
          : t("invoices.headerTaxNone", { defaultValue: "No buyer tax charged in this period" })
        : "",
      color: positive,
    },
    {
      id: "fees",
      label: t("invoices.headerFees", { defaultValue: "Fees" }),
      value: data ? money(data.fees, sym, cur) : "—",
      caption: data ? t("invoices.headerFeesCaption", { count: data.receipts_count, defaultValue: "Dynopay fees deducted · {{count}} receipts" }) : "",
      color: ink,
    },
  ];

  return (
    <Box data-testid="invoices-period-totals" sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
          <Box sx={{ ...captionSx, fontWeight: 600 }}>{t("invoices.showingPeriod", { defaultValue: "Showing" })}</Box>
          <FormControl size="small">
            <Select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as InvoicePeriod)}
              data-testid="tax-period-select"
              inputProps={{ "aria-label": t("invoices.period") as string }}
              sx={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, minWidth: 150, height: 36, borderRadius: "10px" }}
            >
              {(INVOICE_PERIODS ?? []).map((p) => (
                <MenuItem key={p} value={p} data-testid={`tax-period-${p}`} sx={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>
                  {t(PERIOD_LABEL_KEY[p])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <CustomButton
          data-testid="invoices-export-period"
          label={exporting ? t("invoices.exporting", { defaultValue: "Exporting…" }) : t("invoices.exportPeriod", { defaultValue: "Export period (CSV)" })}
          startIcon={<Icon name="download" size={16} />}
          variant="secondary"
          size="small"
          disabled={exporting}
          onClick={onExport}
          sx={{ fontSize: 13 }}
        />
      </Box>

      <Box sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "repeat(3, 1fr)" }, gap: { xs: 1.5, md: 2 }, overflowX: { xs: "auto", md: "visible" }, scrollSnapType: { xs: "x mandatory", md: "none" }, mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 }, pb: { xs: 0.5, md: 0 }, "&::-webkit-scrollbar": { display: "none" } }}>
        {tiles.map((tile) => (
          <StatCard key={tile.id} data-testid={`invoices-tile-${tile.id}`} sx={{ gap: 1, flex: { xs: "0 0 78%", md: "unset" }, scrollSnapAlign: "start" }}>
            <Box sx={eyebrowSx}>{tile.label}</Box>
            <Box data-testid={`invoices-tile-${tile.id}-value`} sx={{ ...valueSx, color: tile.color }}>
              {loading && !data ? <Skeleton width={140} height={32} /> : tile.value}
            </Box>
            <Box sx={captionSx}>{loading && !data ? <Skeleton width="70%" height={16} /> : tile.caption}</Box>
          </StatCard>
        ))}
      </Box>

      {empty && (
        <Box data-testid="invoices-period-empty-hint" sx={{ display: "flex", alignItems: "center", gap: 1, ...captionSx }}>
          <Icon name="info" size={14} />
          {t("invoices.periodEmptyHint", { defaultValue: "Nothing settled in this period yet. Receipts and tax lines appear here automatically once a payment settles." })}
        </Box>
      )}
    </Box>
  );
};

export default PeriodTotals;
