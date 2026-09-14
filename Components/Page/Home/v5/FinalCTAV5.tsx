import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { HeadlineXL } from "../v3/styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, SecondaryBtn, goStart } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** One final ask: Start free · Try a live checkout · Talk to us. */
const FinalCTAV5: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="final-cta" sx={{ background: s.bg, pt: { xs: 3, md: 5 }, pb: { xs: 14, md: 20 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Stagger step={0.1} sx={{ display: "grid" }}>
        <StaggerItem i={0} y={28}>
        <Box sx={{ position: "relative", overflow: "hidden", borderRadius: { xs: "24px", md: "32px" }, background: "#0A0A0A", px: { xs: 3, md: 8 }, py: { xs: 8, md: 12 }, textAlign: "center", border: "1px solid rgba(255,255,255,0.10)" }}>
          <Box aria-hidden sx={{ position: "absolute", top: "-40%", left: "-10%", width: 780, height: 780, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}99 30%, transparent 70%)`, opacity: 0.2, pointerEvents: "none" }} />
          <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <StaggerItem i={1} y={12}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", mb: 3, fontWeight: 500 }}>{t("v5.final.eyebrow")}</Typography>
            </StaggerItem>
            <StaggerItem i={2} y={18}>
            <HeadlineXL component="h2" sx={{ color: "#F5F5F5", fontSize: { xs: 36, sm: 52, md: 68 }, mb: 3 }}>
              {t("v5.final.headline1")}
              <br />
              <Box component="span" sx={{ color: "#A5B4FC" }}>{t("v5.final.headline2")}</Box>
            </HeadlineXL>
            </StaggerItem>
            <StaggerItem i={3} y={14}>
            <Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.68)", fontSize: { xs: 16, md: 18 }, maxWidth: 520, mx: "auto", mb: 4.5, lineHeight: 1.55 }}>{t("v5.final.body")}</Typography>
            </StaggerItem>
            <StaggerItem i={4} y={14}>
            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1.5 }}>
              <PrimaryBtn data-testid="final-start" onClick={() => goStart(router, "final_cta")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>{t("v5.hero.primary")}</PrimaryBtn>
              <SecondaryBtn onDark data-testid="final-demo" href="/pay/demo">{t("v5.hero.secondary")}</SecondaryBtn>
              <SecondaryBtn onDark data-testid="final-talk" href="mailto:hi@dynopay.com?subject=Dynopay%20enquiry">{t("v5.final.talk")}</SecondaryBtn>
            </Box>
            </StaggerItem>
          </Box>
        </Box>
        </StaggerItem>
        </Stagger>
      </Box>
    </Box>
  );
};

export default memo(FinalCTAV5);
