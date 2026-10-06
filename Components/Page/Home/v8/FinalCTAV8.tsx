import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, GradientText, GRID_BG, PANEL, PANEL_GLOW, PrimaryBtn, Reveal, goStart } from "./kit";

/* ============================================================================
 * FinalCTAV8 — the closing conversion moment. A near-black panel with a gold
 * glow + grid floor, a confident headline, and the primary Start-free action.
 * ========================================================================== */

const FinalCTAV8: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");

  return (
    <Box component="section" data-testid="final-cta" sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 10, md: 16 } }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, pointerEvents: "none" }} />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRID_BG,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent 72%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent 72%)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <Reveal sx={{ position: "relative", zIndex: 1, maxWidth: 820, mx: "auto", px: { xs: 3, md: 6 }, textAlign: "center" }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.6,
            mb: 3.5,
            borderRadius: "999px",
            border: `1px solid ${PANEL.lineStrong}`,
            background: PANEL.surface,
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green }} />
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.04em", color: PANEL.ink2 }}>
            {t("v8.final.badge", { defaultValue: "Live in minutes · no credit card" })}
          </Typography>
        </Box>

        <Typography
          component="h2"
          sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 36, md: 60 }, lineHeight: 1.03, letterSpacing: "-0.03em", color: PANEL.ink }}
        >
          {t("v8.final.title1", { defaultValue: "Start accepting crypto" })}
          <br />
          <GradientText>{t("v8.final.title2", { defaultValue: "today." })}</GradientText>
        </Typography>

        <Typography sx={{ fontFamily: FONT_BODY, color: PANEL.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.6, mt: 3, maxWidth: 560, mx: "auto" }}>
          {t("v8.final.lead", { defaultValue: "Join the businesses and creators getting paid their way — non-custodial, zero chargebacks, and your first payment on us." })}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 5 }}>
          <PrimaryBtn
            data-testid="final-primary-cta"
            onClick={() => goStart(router, "final")}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            sx={{ px: 3.5, py: 1.6, fontSize: 16.5 }}
          >
            {t("v8.final.primary", { defaultValue: "Start free" })}
          </PrimaryBtn>
          <Box
            component="a"
            href="/fees"
            data-testid="final-secondary-cta"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 3.5,
              py: 1.6,
              borderRadius: "10px",
              border: `1px solid ${PANEL.lineStrong}`,
              color: PANEL.ink,
              textDecoration: "none",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 16.5,
              transition: "background-color 160ms ease, border-color 160ms ease",
              "&:hover": { background: "rgba(255,255,255,0.05)", borderColor: PANEL.ink3 },
            }}
          >
            {t("v8.final.secondary", { defaultValue: "See pricing" })}
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: { xs: 2, md: 3 }, mt: 4 }}>
          {[
            t("v8.final.t1", { defaultValue: "No setup fees" }),
            t("v8.final.t2", { defaultValue: "No lock-in" }),
            t("v8.final.t3", { defaultValue: "Cancel anytime" }),
          ].map((x) => (
            <Box key={x} sx={{ display: "inline-flex", alignItems: "center", gap: 0.7 }}>
              <Icon icon="mdi:check-circle" width={15} height={15} color={PANEL.gold} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: PANEL.ink2 }}>{x}</Typography>
            </Box>
          ))}
        </Box>
      </Reveal>
    </Box>
  );
};

export default memo(FinalCTAV8);
