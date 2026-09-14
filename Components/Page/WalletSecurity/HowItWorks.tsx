import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";

/** Plain-language explanation of the three protections, in the order they happen. */
const HowItWorks: React.FC<{ alertEmail?: string }> = ({ alertEmail }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;

  const steps = [
    { icon: "lucide:key-round", title: t("security.step1Title", { defaultValue: "You change a wallet" }), body: t("security.step1Body", { defaultValue: "Adding, editing or removing a payout address always asks for a one-time code sent to you first." }) },
    { icon: "lucide:mail", title: t("security.step2Title", { defaultValue: "We email you straight away" }), body: alertEmail ? t("security.step2BodyEmail", { email: alertEmail, defaultValue: "An alert goes to {{email}} with the old and new address and a one-tap “This wasn’t me” link. Alerts can’t be switched off." }) : t("security.step2Body", { defaultValue: "An alert goes to your account email with the old and new address and a one-tap “This wasn’t me” link. Alerts can’t be switched off." }) },
    { icon: "lucide:undo-2", title: t("security.step3Title", { defaultValue: "One tap undoes it" }), body: t("security.step3Body", { defaultValue: "If it wasn’t you, that link restores the previous address and locks further wallet changes until support confirms it’s really you." }) },
  ];

  return (
    <PanelCard title={t("security.howTitle", { defaultValue: "How your payouts are protected" })} showHeaderBorder={false}>
      <Box data-testid="wallet-security-how" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1.5, md: 2 } }}>
        {steps.map((s, i) => (
          <Box key={s.icon} sx={{ display: "flex", gap: 1.5, p: 2, borderRadius: "14px", border: `1px solid ${border}` }}>
            <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: indigo, backgroundColor: isDark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)" }}>
              <Icon name={s.icon} size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: muted }}>
                {t("security.stepN", { n: i + 1, defaultValue: "Step {{n}}" })}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 700, color: theme.palette.text.primary, mt: 0.25 }}>{s.title}</Typography>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: theme.palette.text.secondary, mt: 0.5, wordBreak: "break-word" }}>{s.body}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </PanelCard>
  );
};

export default HowItWorks;
