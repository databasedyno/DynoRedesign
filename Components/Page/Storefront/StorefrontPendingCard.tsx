import React from "react";
import { useTranslation, Trans } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon as Iconify } from "@iconify/react";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";

/**
 * Shown on the Storefront tabs when the SELECTED company doesn't own the
 * account's shared storefront (pre per-company-storefront migration). Prevents
 * a brand-new company from silently presenting the first company's URL, stats
 * and catalog as its own.
 */
const StorefrontPendingCard: React.FC = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const { profile } = useStorefrontProfile();
  const { companyList, selectedCompanyId, selectCompany } = useCompanyStore();
  const current = companyList.find(
    (c: any) => Number(c.company_id) === Number(selectedCompanyId),
  );
  const primaryId = Number(profile?.primary_company_id);
  const primary = companyList.find((c: any) => Number(c.company_id) === primaryId);
  const currentName = (current?.company_name as string) || "This company";
  const primaryName = (primary?.company_name as string) || "your primary company";
  const accountHandle = (profile?.account_handle as string) || "";

  return (
    <PanelCard title="">
      <Box data-testid="storefront-pending" sx={{ textAlign: "center", py: 6, px: 3 }}>
        <Iconify
          icon="mdi:storefront-plus-outline"
          width={34}
          color={theme.palette.text.secondary}
        />
        <Typography sx={{ fontSize: 17, fontWeight: 700, mt: 1.25 }}>
          {t("storefront.pending.title", { company: currentName, defaultValue: "{{company}} doesn't have its own storefront yet" })}
        </Typography>
        <Typography
          sx={{
            fontSize: 13.5,
            color: theme.palette.text.secondary,
            mt: 0.75,
            mb: 2.5,
            maxWidth: 480,
            mx: "auto",
            lineHeight: 1.55,
          }}
        >
          <Trans
            t={t}
            i18nKey={accountHandle ? "storefront.pending.bodyHandle" : "storefront.pending.body"}
            values={{ handle: accountHandle, primary: primaryName }}
            components={{ b: <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }} /> }}
            defaults={accountHandle
              ? "Your account currently has one shared storefront (<b>@{{handle}}</b>) and it belongs to {{primary}}. Separate storefronts for each company are coming soon — switch to {{primary}} to edit the live page."
              : "Your account currently has one shared storefront and it belongs to {{primary}}. Separate storefronts for each company are coming soon — switch to {{primary}} to edit the live page."}
          />
        </Typography>
        {Number.isFinite(primaryId) && primary ? (
          <CustomButton
            label={t("storefront.pending.switchTo", { primary: primaryName, defaultValue: "Switch to {{primary}}" })}
            variant="primary"
            size="medium"
            data-testid="storefront-pending-switch-btn"
            onClick={() => selectCompany(primaryId)}
          />
        ) : null}
      </Box>
    </PanelCard>
  );
};

export default StorefrontPendingCard;
