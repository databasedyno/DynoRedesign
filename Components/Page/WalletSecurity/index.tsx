import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import useTokenData from "@/hooks/useTokenData";
import useWalletSecurity from "./useWalletSecurity";
import ProtectionLevelCard from "./ProtectionLevelCard";
import HowItWorks from "./HowItWorks";
import WalletChangeHistory from "./WalletChangeHistory";
import DevicesCard from "./DevicesCard";

/** /wallet/security — plan 3.4: explanation, protection level, change history, sign-out-everywhere, alerts. */
const WalletSecurityPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  const tokenData = useTokenData();
  const { level, loading, twoFaOn, frozen, freeze, sessions, activity } = useWalletSecurity();
  const negative = isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light;

  return (
    <Box data-testid="wallet-security-page" sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.5 }, px: { xs: 2, md: 0 }, pb: { xs: 12, md: 4 } }}>
      {frozen && (
        <Box
          role="alert"
          data-testid="wallet-security-frozen-banner"
          sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 2, borderRadius: "14px", border: `1px solid ${isDark ? "rgba(255,107,107,0.35)" : "rgba(217,45,32,0.3)"}`, backgroundColor: isDark ? CB_TOKENS.semantic.negative.glowDark : CB_TOKENS.semantic.negative.glowLight }}
        >
          <Icon name="lock" size={20} style={{ color: negative, flexShrink: 0, marginTop: 2 }} />
          <Box>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 700, color: theme.palette.text.primary }}>
              {t("security.frozenTitle", { defaultValue: "Wallet changes are locked" })}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, mt: 0.25 }}>
              {t("security.frozenBody", { defaultValue: "You (or someone with your email) reported a wallet change as not yours, so we restored the previous address and froze edits. Contact support to unlock." })}
            </Typography>
          </Box>
        </Box>
      )}

      <ProtectionLevelCard level={level} loading={loading} twoFaOn={twoFaOn} frozenSince={freeze.data?.since} />
      <HowItWorks alertEmail={tokenData?.email} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 2.5 }, alignItems: "start" }}>
        <WalletChangeHistory rows={activity.data} loading={activity.isLoading && !activity.data} />
        <DevicesCard sessions={sessions.data} loading={sessions.isLoading && !sessions.data} onChanged={() => sessions.mutate()} />
      </Box>
    </Box>
  );
};

export default WalletSecurityPage;
