import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/** The 3-step flow + reward split, as one quiet numbered list. */
const ReferralHowItWorks: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  const steps = [
    { title: t("step1Title"), desc: t("step1Desc") },
    { title: t("step2Title"), desc: t("step2Desc") },
    { title: t("step3Title"), desc: t("step3Desc") },
  ];
  return (
    <Box data-testid="referral-how-it-works" component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1.5, md: 2.5 } }}>
      {steps.map((s, i) => (
        <Box component="li" key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          <Box sx={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", border: `1px solid ${theme.palette.border.main}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, color: theme.palette.text.primary }}>
            {i + 1}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.35 }}>{s.title}</Typography>
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.45, mt: 0.25 }}>{s.desc}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default ReferralHowItWorks;
