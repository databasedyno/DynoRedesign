import React, { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import useBrands, { BrandsRange } from "./useBrands";
import BrandsRangePresets from "./BrandsRangePresets";
import BrandsSummary from "./BrandsSummary";
import BrandCard from "./BrandCard";

/**
 * Brands — every brand on the account in one view. Top summary strip (settled
 * volume, payments, pending, needs-attention, brand count) + a range filter
 * (default 30D) + per-brand cards sorted by settled volume, each with a
 * "Manage" button that switches the active brand and opens its dashboard.
 */
const BrandsPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const router = useRouter();
  const { selectCompany } = useCompanyStore();

  const [range, setRange] = useState<BrandsRange>("30d");
  const { data, isLoading, error } = useBrands(range);
  const brands = data?.brands ?? [];
  const loading = isLoading && !data;

  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primary = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;

  const handleManage = (companyId: number) => {
    selectCompany(companyId);
    router.push("/dashboard");
  };

  return (
    <Box data-testid="brands-root" sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 } }}>
      <Box
        data-testid="brands-range-bar"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}
      >
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
          {t("brandsOverview.sortedBy", { defaultValue: "Sorted by settled volume" })}
        </Box>
        <BrandsRangePresets range={range} onChange={setRange} />
      </Box>

      <BrandsSummary data={data ?? null} loading={loading} />

      {error && !data ? (
        <Box data-testid="brands-error" sx={{ p: 3, textAlign: "center", color: muted, fontFamily: "var(--font-sans)", fontSize: 14 }}>
          {t("brandsOverview.errorLoad", { defaultValue: "Couldn't load your brands. Please try again." })}
        </Box>
      ) : loading ? (
        <Box data-testid="brands-loading" sx={{ p: 3, textAlign: "center", color: muted, fontFamily: "var(--font-sans)", fontSize: 14 }}>
          {t("brandsOverview.loading", { defaultValue: "Loading your brands…" })}
        </Box>
      ) : brands.length === 0 ? (
        <Box data-testid="brands-empty" sx={{ p: 4, textAlign: "center" }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 18, color: primary, mb: 1 }}>
            {t("brandsOverview.emptyTitle", { defaultValue: "No brands yet" })}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, color: muted }}>
            {t("brandsOverview.emptyDesc", { defaultValue: "Add a brand to start accepting crypto payments across your account." })}
          </Typography>
        </Box>
      ) : (
        <Box
          data-testid="brands-grid"
          sx={{ display: "grid", gap: { xs: 2, sm: 2.5 }, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "1fr 1fr 1fr" }, alignItems: "stretch" }}
        >
          {brands.map((b) => (
            <BrandCard key={b.company_id} brand={b} currency={data?.currency ?? "USD"} onManage={() => handleManage(b.company_id)} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default BrandsPage;
