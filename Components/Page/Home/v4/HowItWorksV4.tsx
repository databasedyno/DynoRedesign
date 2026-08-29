import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import IntegrationInstructionsRoundedIcon from "@mui/icons-material/IntegrationInstructionsRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import {
  BG0, BLUE, BLUE_BRIGHT, FONT_BODY, FONT_DISPLAY, FONT_MONO, INK0, INK2, INK3, LINE,
} from "./theme.v4";
import { CardV4, DisplayL, EyebrowV4, LeadV4, PrimaryBtnV4, ShellV4 } from "./styled.v4";

const STEPS = [
  { n: "01", icon: IntegrationInstructionsRoundedIcon, tKey: "s1" },
  { n: "02", icon: QrCode2RoundedIcon, tKey: "s2" },
  { n: "03", icon: AccountBalanceWalletRoundedIcon, tKey: "s3" },
] as const;

const HowItWorksV4: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" sx={{ background: BG0 }}>
      <ShellV4 sx={{ py: { xs: 10, md: 15 } }}>
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
          gap: { xs: 3, md: 10 }, alignItems: "end", mb: { xs: 6, md: 9 },
        }}>
          <Box>
            <EyebrowV4 sx={{ mb: 2.5 }}>{t("v4.how.eyebrow")}</EyebrowV4>
            <DisplayL component="h2">{t("v4.how.title")}</DisplayL>
          </Box>
          <LeadV4 sx={{ maxWidth: 380 }}>{t("v4.how.sub")}</LeadV4>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5, mb: 6 }}>
          {STEPS.map((step, i) => {
            const IconCmp = step.icon;
            return (
              <CardV4 key={step.n} data-testid={`how-step-${i + 1}`} sx={{ p: { xs: 3, md: 3.75 }, overflow: "hidden" }}>
                <Box aria-hidden sx={{
                  position: "absolute", top: 14, right: 20, fontFamily: FONT_DISPLAY,
                  fontWeight: 700, fontSize: 68, lineHeight: 1, color: "rgba(255,255,255,0.05)",
                }}>
                  {step.n}
                </Box>
                <Box sx={{ height: 3, width: 44, background: BLUE, mb: 3.5, borderRadius: 2, boxShadow: "0 0 14px rgba(0,82,255,0.5)" }} />
                <Box sx={{
                  width: 44, height: 44, borderRadius: "12px", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "rgba(0,82,255,0.1)", border: `1px solid rgba(0,82,255,0.3)`, mb: 2.5,
                }}>
                  <IconCmp sx={{ fontSize: 22, color: BLUE_BRIGHT }} />
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: INK3, mb: 1 }}>
                  {t("v4.how.step")} {step.n}
                </Typography>
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 21, color: INK0, mb: 1.25 }}>
                  {t(`v4.how.${step.tKey}t`)}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: INK2 }}>
                  {t(`v4.how.${step.tKey}d`)}
                </Typography>
              </CardV4>
            );
          })}
        </Box>

        <PrimaryBtnV4
          data-testid="howitworks-cta"
          onClick={() => router.push("/auth/register?ref=how_v4")}
          endIcon={<ArrowForwardRounded sx={{ fontSize: 18 }} />}
        >
          {t("v4.how.cta")}
        </PrimaryBtnV4>
      </ShellV4>
    </Box>
  );
};

export default memo(HowItWorksV4);
