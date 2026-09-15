import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import useTokenData from "@/hooks/useTokenData";
import UpdatePassword from "@/Components/Page/Profile/UpdatePassword";
import TwoFactorAuth from "@/Components/Page/Profile/TwoFactorAuth";
import ActiveSessions from "@/Components/Page/Profile/ActiveSessions";
import TrustedDevices from "@/Components/Page/Profile/TrustedDevices";
import LoginActivity from "@/Components/Page/Profile/LoginActivity";
import useWalletSecurity from "@/Components/Page/WalletSecurity/useWalletSecurity";
import ProtectionLevelCard from "@/Components/Page/WalletSecurity/ProtectionLevelCard";
import HowItWorks from "@/Components/Page/WalletSecurity/HowItWorks";
import WalletChangeHistory from "@/Components/Page/WalletSecurity/WalletChangeHistory";

const Group: React.FC<{ title: string; testId: string; children: React.ReactNode }> = ({ title, testId, children }) => {
  const theme = useTheme();
  return (
    <Box data-testid={testId} sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, md: 2 } }}>
      <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: theme.palette.text.secondary }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
};

/** Settings → Security: sign-in protection, payout-wallet protection (former /wallet/security) and devices. */
const SecuritySection: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["walletScreen", "common"]);
  const tokenData = useTokenData();
  const { level, loading, twoFaOn, frozen, freeze, activity } = useWalletSecurity();
  const negative = isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light;

  return (
    <Box data-testid="settings-security" sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 } }}>
      {frozen && (
        <Box
          role="alert"
          data-testid="wallet-security-frozen-banner"
          sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 2, borderRadius: "14px", border: `1px solid ${isDark ? "rgba(255,107,107,0.35)" : "rgba(217,45,32,0.3)"}`, backgroundColor: isDark ? CB_TOKENS.semantic.negative.glowDark : CB_TOKENS.semantic.negative.glowLight }}
        >
          <Icon name="lock" size={20} style={{ color: negative, flexShrink: 0, marginTop: 2 }} />
          <Box>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 700, color: theme.palette.text.primary }}>
              {t("walletScreen:security.frozenTitle", { defaultValue: "Payout address changes are locked" })}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, mt: 0.25 }}>
              {t("walletScreen:security.frozenBody", { defaultValue: "You (or someone with your email) reported a payout address change as not yours, so we restored the previous address and froze edits. Contact support to unlock." })}
            </Typography>
          </Box>
        </Box>
      )}

      <Group title={t("common:settingsPage.securitySignIn", { defaultValue: "Signing in" })} testId="settings-security-signin">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 1.5, md: 2.5 }, alignItems: "start" }}>
          <TwoFactorAuth />
          <UpdatePassword />
        </Box>
      </Group>

      <Group title={t("common:settingsPage.securityWallets", { defaultValue: "Payout addresses" })} testId="settings-security-wallets">
        <ProtectionLevelCard level={level} loading={loading} twoFaOn={twoFaOn} frozenSince={freeze.data?.since} />
        <HowItWorks alertEmail={tokenData?.email} />
        <WalletChangeHistory rows={activity.data} loading={activity.isLoading && !activity.data} />
      </Group>

      <Group title={t("common:settingsPage.securityDevices", { defaultValue: "Devices & activity" })} testId="settings-security-devices">
        <ActiveSessions />
        <TrustedDevices />
        <LoginActivity />
      </Group>
    </Box>
  );
};

export default SecuritySection;
