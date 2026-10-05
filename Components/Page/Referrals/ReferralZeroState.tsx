import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import ReferralHowItWorks from "./ReferralHowItWorks";

/** Zero referrals: ONE empty state (what happens next) instead of ~10 zero values. */
const ReferralZeroState: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  return (
    <Box data-testid="referrals-zero-state" sx={{ mb: 4, p: { xs: 2.5, md: 4 }, borderRadius: "14px", border: `1px dashed ${theme.palette.border.main}`, bgcolor: theme.palette.background.paper, display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.action.hover, color: theme.palette.text.primary }}>
          <Icon name="user-plus" size={20} />
        </Box>
        <Box>
          <Typography component="h2" sx={{ m: 0, fontSize: { xs: 16, md: 18 }, fontWeight: 700, color: theme.palette.text.primary }}>
            {t("zero.title", { defaultValue: "No referrals yet" })}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 14, color: theme.palette.text.secondary, maxWidth: 620, lineHeight: 1.5 }}>
            {t("zero.body", { defaultValue: "Share your link above. When a merchant signs up with it, you'll see them here — with your earnings and cash-out options." })}
          </Typography>
        </Box>
      </Box>
      <ReferralHowItWorks />
    </Box>
  );
};

export default ReferralZeroState;
