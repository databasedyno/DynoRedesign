import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";

/** Settings › Profile & Security → pointer to the Wallet security page (plan 3.4 entry point). */
const WalletSecurityLink = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("walletScreen");
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  return (
    <PanelCard showHeaderBorder={false}>
      <Box data-testid="profile-wallet-security-link" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: indigo, backgroundColor: isDark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)" }}>
          <Icon name="shield-check" size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
            {t("security.pageTitle", { defaultValue: "Wallet security" })}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, mt: 0.25 }}>
            {t("security.profileLinkBody", { defaultValue: "See how your payout wallets are protected, every change made to them, and sign out of other devices." })}
          </Typography>
        </Box>
        <CustomButton label={t("security.profileLinkCta", { defaultValue: "View" })} variant="outlined" size="small" endIcon={<Icon name="arrow-right" size={15} />} onClick={() => router.push("/wallet/security")} data-testid="profile-wallet-security-cta" />
      </Box>
    </PanelCard>
  );
};

export default WalletSecurityLink;
