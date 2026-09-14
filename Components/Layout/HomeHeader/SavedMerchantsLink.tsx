import Link from "next/link";
import type { ElementType } from "react";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import { useTranslation } from "react-i18next";
import useSavedMerchants from "@/hooks/useSavedMerchants";
import { MobileSubItem, SearchButton } from "./styled";
import { Box, Typography } from "@mui/material";

// Header entry to /saved — only rendered once the buyer has saved a merchant.
export const SavedMerchantsHeaderLink = () => {
  const { t } = useTranslation("landing");
  const { items, hydrated } = useSavedMerchants();
  if (!hydrated || items.length === 0) return null;
  const LinkButton = SearchButton as unknown as ElementType;
  return (
    <LinkButton
      component={Link}
      href="/saved"
      disableRipple
      aria-label={t("saved.headerLink", { defaultValue: "Saved merchants" })}
      data-testid="header-saved-merchants"
      data-count={items.length}
    >
      <FavoriteRounded />
      <span className="kbd">{items.length}</span>
    </LinkButton>
  );
};

export const SavedMerchantsMobileItem = ({ onNavigate }: { onNavigate: () => void }) => {
  const { t } = useTranslation("landing");
  const { items, hydrated } = useSavedMerchants();
  if (!hydrated || items.length === 0) return null;
  return (
    <MobileSubItem component={Link} href="/saved" data-testid="mobile-saved-merchants" onClick={onNavigate}>
      <Box className="msub-icon"><FavoriteRounded /></Box>
      <Typography className="msub-title">
        {t("saved.headerLink", { defaultValue: "Saved merchants" })} · {items.length}
      </Typography>
    </MobileSubItem>
  );
};
