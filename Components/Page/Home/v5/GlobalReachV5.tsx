import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH } from "../v3/theme.v3";
import { CountUp } from "../motion/CountUp";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { floor5, useLandingMetrics } from "./useLandingMetrics";

/** Global reach band — dark, with a dotted world map behind a live "countries served" count. */
const GlobalReachV5: React.FC = () => {
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const countries = m ? floor5(m.countries_served) : null;

  const chips = [
    { Icon: TranslateRoundedIcon, label: t("v5.global.langs") },
    { Icon: HubRoundedIcon, label: t("v5.global.chainsLabel") },
    { Icon: AccountBalanceWalletRoundedIcon, label: t("v5.global.walletLabel") },
  ];

  return (
    <Box component="section" data-testid="global-reach" sx={{ background: "#08080B", py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: "24px", md: "32px" },
            background: "#0B0F19",
            border: "1px solid rgba(255,255,255,0.10)",
            px: { xs: 3, md: 7 },
            py: { xs: 6, md: 9 },
          }}
        >
          {/* Dotted world map, faded into the band */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url(/landing/world-map-dark.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.5,
              maskImage: "radial-gradient(ellipse 90% 120% at 70% 40%, black 20%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 90% 120% at 70% 40%, black 20%, transparent 80%)",
              pointerEvents: "none",
            }}
          />
          <Box aria-hidden sx={{ position: "absolute", top: "-30%", left: "-8%", width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle, #4338CA 0%, #4338CA88 30%, transparent 70%)", opacity: 0.22, pointerEvents: "none" }} />

          <Stagger step={0.09} sx={{ position: "relative", zIndex: 1, maxWidth: 560 }}>
            <StaggerItem i={0} y={12}>
              <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#A5B4FC", mb: 2.5 }}>
                <PublicRoundedIcon sx={{ fontSize: 15 }} /> {t("v5.global.eyebrow")}
              </Typography>
            </StaggerItem>
            <StaggerItem i={1} y={16}>
              <Typography component="h2" className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 34, sm: 44, md: 56 }, letterSpacing: "-0.03em", lineHeight: 1.02, color: "#F5F5F5" }}>
                <CountUp to={countries} render={(n) => t("v5.global.headline", { countries: Math.round(n) })} placeholder={t("v5.global.headline", { countries: 30 })} />
              </Typography>
            </StaggerItem>
            <StaggerItem i={2} y={14}>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15.5, md: 17 }, lineHeight: 1.6, color: "rgba(255,255,255,0.66)", mt: 2.5, maxWidth: 480 }}>
                {t("v5.global.body")}
              </Typography>
            </StaggerItem>
            <StaggerItem i={3} y={14}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mt: 4 }}>
                {chips.map((c) => (
                  <Box key={c.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.75, py: 0.85, borderRadius: "999px", border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.86)" }}>
                    <c.Icon sx={{ fontSize: 16, color: "#A5B4FC" }} />
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600 }}>{c.label}</Typography>
                  </Box>
                ))}
              </Box>
            </StaggerItem>
          </Stagger>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(GlobalReachV5);
