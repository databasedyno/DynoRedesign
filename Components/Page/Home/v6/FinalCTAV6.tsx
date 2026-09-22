import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

const CARDS = [
  { id: "pricing", Icon: SellRoundedIcon, href: "/fees" },
  { id: "build", Icon: TerminalRoundedIcon, href: "/documentation" },
] as const;

/** §2.3-13 Final CTA — headline + two cards (See pricing · Start building), Stripe's closing pattern. */
const FinalCTAV6: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="final-cta" sx={{ background: s.bg, pt: { xs: 3, md: 5 }, pb: { xs: 12, md: 18 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Stagger step={0.1} sx={{ display: "grid" }}>
          <StaggerItem i={0} y={28}>
            <Box sx={{ position: "relative", overflow: "hidden", borderRadius: { xs: "24px", md: "32px" }, background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.10)", px: { xs: 3, md: 7 }, py: { xs: 6, md: 9 } }}>
              <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: "url(/landing/cta-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.5, pointerEvents: "none" }} />
              <Box aria-hidden sx={{ position: "absolute", top: "-40%", left: "-10%", width: 780, height: 780, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}99 30%, transparent 70%)`, opacity: 0.22, pointerEvents: "none" }} />
              <Box sx={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" }, gap: { xs: 5, md: 8 }, alignItems: "center" }}>
                <Box>
                  <StaggerItem i={1} y={12}><Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", mb: 2.5 }}>{t("v5.final.eyebrow")}</Typography></StaggerItem>
                  <StaggerItem i={2} y={18}>
                    <Typography component="h2" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 34, sm: 44, md: 56 }, lineHeight: 1, letterSpacing: "-0.035em", color: "#F5F5F5", mb: 2.5 }}>
                      {t("v5.final.headline1")} <Box component="span" sx={{ color: "#FFD100" }}>{t("v5.final.headline2")}</Box>
                    </Typography>
                  </StaggerItem>
                  <StaggerItem i={3} y={14}><Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.7)", fontSize: { xs: 16, md: 17.5 }, maxWidth: 480, mb: 4, lineHeight: 1.55 }}>{t("v5.final.body")}</Typography></StaggerItem>
                  <StaggerItem i={4} y={14}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                      <PrimaryBtn data-testid="final-start" onClick={() => goStart(router, "final_cta")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ background: "#fff", color: "#0A0A0A", boxShadow: "none", "&:hover": { background: "#E4E4E7", boxShadow: "none", transform: "translateY(-1px)" } }}>{t("v6.hero.primary")}</PrimaryBtn>
                      <SecondaryBtn onDark data-testid="final-demo" href="/pay/demo">{t("v5.hero.secondary")}</SecondaryBtn>
                    </Box>
                  </StaggerItem>
                </Box>
                <Box sx={{ display: "grid", gap: 1.5 }}>
                  {CARDS.map((c, i) => (
                    <StaggerItem key={c.id} i={3 + i} y={16}>
                      <Box component="a" href={c.href} data-testid={`final-card-${c.id}`} sx={{ display: "flex", gap: 2, alignItems: "flex-start", textDecoration: "none", borderRadius: "20px", p: { xs: 2.5, md: 3 }, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", transition: "transform 260ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease, border-color 200ms ease", "&:hover": { transform: "translateY(-3px)", background: "rgba(255,255,255,0.09)", borderColor: "rgba(255,209,0,0.55)" }, "&:hover .fc-arrow": { transform: "translate(2px,-2px)" }, "&:focus-visible": { outline: "2px solid #FFD100", outlineOffset: 3 } }}>
                        <Box sx={{ width: 42, height: 42, borderRadius: "12px", display: "grid", placeItems: "center", background: "rgba(255,209,0,0.16)", color: "#FFD100", flexShrink: 0 }}><c.Icon sx={{ fontSize: 21 }} /></Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: "#F5F5F5" }}>{t(`v6.final.${c.id}T`)}</Typography>
                            <ArrowOutwardRoundedIcon className="fc-arrow" sx={{ fontSize: 18, color: "#FFD100", transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }} />
                          </Box>
                          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.68)", mt: 0.75 }}>{t(`v6.final.${c.id}D`)}</Typography>
                        </Box>
                      </Box>
                    </StaggerItem>
                  ))}
                </Box>
              </Box>
            </Box>
          </StaggerItem>
        </Stagger>
      </Box>
    </Box>
  );
};

export default memo(FinalCTAV6);
