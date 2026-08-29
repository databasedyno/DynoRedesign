import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { BG0, FONT_MONO, INK3, LINE } from "./theme.v4";
import { DisplayXL, GhostBtnV4, LeadV4, PrimaryBtnV4, ShellV4 } from "./styled.v4";

const FinalCTAV4: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" sx={{ position: "relative", background: BG0, overflow: "hidden" }}>
      <Box aria-hidden sx={{
        position: "absolute", left: "50%", bottom: "-42%", transform: "translateX(-50%)",
        width: { xs: 620, md: 1100 }, height: { xs: 420, md: 640 }, borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(0,82,255,0.28), transparent 72%)",
        filter: "blur(30px)", pointerEvents: "none",
      }} />
      <Box aria-hidden sx={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.45,
        backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(ellipse 60% 70% at 50% 100%, black 8%, transparent 74%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 100%, black 8%, transparent 74%)",
      }} />

      <ShellV4 sx={{ py: { xs: 12, md: 18 }, textAlign: "center" }}>
        <DisplayXL component="h2" sx={{ mb: 3, mx: "auto", maxWidth: 860 }}>
          {t("v4.cta.title")}
        </DisplayXL>
        <LeadV4 sx={{ mx: "auto", maxWidth: 480, mb: 5, fontSize: { xs: 16, md: 18 } }}>
          {t("v4.cta.sub")}
        </LeadV4>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <PrimaryBtnV4
            data-testid="final-cta-primary"
            onClick={() => router.push("/auth/register?ref=final_v4")}
            endIcon={<ArrowForwardRounded sx={{ fontSize: 18 }} />}
            sx={{ px: 4, py: 1.75, fontSize: 16.5 }}
          >
            {t("v4.cta.primary")}
          </PrimaryBtnV4>
          <GhostBtnV4 data-testid="final-cta-secondary" onClick={() => router.push("/documentation")}>
            {t("v4.cta.secondary")}
          </GhostBtnV4>
        </Box>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.12em", color: INK3, textTransform: "uppercase" }}>
          {t("v4.cta.ticks")}
        </Typography>
      </ShellV4>
    </Box>
  );
};

export default memo(FinalCTAV4);
