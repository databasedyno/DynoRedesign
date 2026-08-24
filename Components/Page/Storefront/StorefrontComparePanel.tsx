import React from "react";
import { useApiSWR } from "@/hooks/useApiSWR";
import { Box, Typography, Skeleton, useTheme } from "@mui/material";
import { Icon as Iconify } from "@iconify/react";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import Sparkline from "@/Components/UI/Sparkline";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { brandFg } from "@/constants/theme";

const MONO = 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, monospace';

interface SplitRow {
  company_id: number;
  company_name: string | null;
  handle: string | null;
  is_primary: boolean;
  views_30d: number;
  /** 30-day daily-views bucket, oldest → newest (Redis-backed, best-effort). */
  views_daily?: number[];
  tips_count_30d: number;
  tips_amount_30d: number;
  sales_count_30d: number;
  sales_amount_30d: number;
}

interface SplitData {
  window_days: number;
  currency: string;
  companies: SplitRow[];
}

/**
 * "Compare storefronts" — one row per company: views · tips · sales · revenue
 * over the last 30 days. Only rendered for multi-company accounts.
 */
const StorefrontComparePanel: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const isDark = theme.palette.mode === "dark";
  const { companyList, selectedCompanyId } = useCompanyStore();
  const { data } = useApiSWR<SplitData | null>(
    "user/creator/analytics/split",
    {
      enabled: companyList.length > 1,
      select: (raw: any) => (raw?.data ?? null) as SplitData | null,
    },
  );

  if (companyList.length <= 1) return null;

  const fmtMoney = (n: number) => {
    try {
      return n.toLocaleString(undefined, {
        style: "currency",
        currency: data?.currency || "USD",
        maximumFractionDigits: 2,
      });
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const HEAD_SX = {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: theme.palette.text.secondary,
  };
  const NUM_SX = {
    fontFamily: MONO,
    fontSize: 13.5,
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontVariantNumeric: "tabular-nums" as const,
    textAlign: "right" as const,
  };
  // Grid: Company · Views (with sparkline) · Tips · Sales · Revenue
  // The sparkline lives inside the Views cell so nothing else has to move.
  const GRID = "minmax(160px, 1.4fr) minmax(160px, 1.1fr) 0.9fr 0.9fr 0.9fr";

  return (
    <Box sx={{ mt: 3 }} data-testid="storefront-compare-panel">
      <PanelCard
        title={t("storefront.compare.title", { defaultValue: "Compare storefronts" })}
        subTitle={t("storefront.compare.subtitle", { defaultValue: "Views, tips and product sales per company — last 30 days." })}
      >
        {!data ? (
          <Skeleton
            variant="rounded"
            height={96}
            sx={{ borderRadius: "12px" }}
            data-testid="storefront-compare-loading"
          />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 620 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: GRID, gap: 1.5, px: 1.5, pb: 1 }}>
                <Typography sx={HEAD_SX}>{t("storefront.compare.colCompany", { defaultValue: "Company" })}</Typography>
                <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>{t("storefront.compare.colViews", { defaultValue: "Views · 30d trend" })}</Typography>
                <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>{t("storefront.compare.colTips", { defaultValue: "Tips" })}</Typography>
                <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>{t("storefront.compare.colSales", { defaultValue: "Sales" })}</Typography>
                <Typography sx={{ ...HEAD_SX, textAlign: "right" }}>{t("storefront.compare.colRevenue", { defaultValue: "Revenue" })}</Typography>
              </Box>
              {data.companies.map((row) => {
                const isSelected = Number(row.company_id) === Number(selectedCompanyId);
                const revenue = (row.tips_amount_30d || 0) + (row.sales_amount_30d || 0);
                return (
                  <Box
                    key={row.company_id}
                    data-testid={`storefront-compare-row-${row.company_id}`}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: GRID,
                      gap: 1.5,
                      alignItems: "center",
                      px: 1.5,
                      py: 1.25,
                      borderRadius: "10px",
                      border: `1px solid ${isSelected ? brandFg(isDark) : theme.palette.divider}`,
                      backgroundColor: isSelected ? theme.palette.action.hover : "transparent",
                      mb: 0.75,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: theme.palette.text.primary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row.company_name || t("storefront.compare.companyN", { defaultValue: "Company {{n}}", n: row.company_id })}
                        </Typography>
                        {isSelected && (
                          <Iconify icon="mdi:check-circle" width={14} color={brandFg(isDark)} />
                        )}
                      </Box>
                      <Typography
                        sx={{
                          fontFamily: MONO,
                          fontSize: 11.5,
                          color: theme.palette.text.secondary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.handle ? `@${row.handle}` : t("storefront.compare.noStorefront", { defaultValue: "No storefront yet" })}
                      </Typography>
                    </Box>
                    {/* Views + inline 30-day sparkline */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <Sparkline
                        points={row.views_daily}
                        width={80}
                        height={26}
                        color={isSelected ? brandFg(isDark) : undefined}
                        data-testid={`storefront-compare-sparkline-${row.company_id}`}
                        noDataLabel={t("storefront.noData", { defaultValue: "no data" })}
                        ariaLabel={`${row.company_name || "Company"} — 30 day views trend, total ${row.views_30d}`}
                      />
                      <Typography sx={{ ...NUM_SX, minWidth: 40 }}>
                        {row.views_30d.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={NUM_SX}>{fmtMoney(row.tips_amount_30d)}</Typography>
                      <Typography sx={{ fontFamily: MONO, fontSize: 11, color: theme.palette.text.secondary }}>
                        {t("storefront.tipCount", { count: row.tips_count_30d, defaultValue: `${row.tips_count_30d} tips` })}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={NUM_SX}>{fmtMoney(row.sales_amount_30d)}</Typography>
                      <Typography sx={{ fontFamily: MONO, fontSize: 11, color: theme.palette.text.secondary }}>
                        {t("storefront.orderCount", { count: row.sales_count_30d, defaultValue: `${row.sales_count_30d} orders` })}
                      </Typography>
                    </Box>
                    <Typography sx={{ ...NUM_SX, fontWeight: 800 }}>{fmtMoney(revenue)}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </PanelCard>
    </Box>
  );
};

export default StorefrontComparePanel;
