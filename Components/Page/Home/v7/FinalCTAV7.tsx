import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Display, Eyebrow, FONT_BODY, PrimaryBtn, SecondaryBtn, goStart, useConsole } from "./kit";
import { PaidStack } from "./mock/PaidStack";

/** Section 9 — FINAL CTA ("How do I get started?"). */
const FinalCTAV7: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" id="get-started" data-testid="final-cta" sx={{ background: s.canvas, borderTop: `1px solid ${s.line}`, py: { xs: 8, md: 13 } }}>
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" },
          gap: { xs: 6, lg: 7 },
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: 560 }}>
          <Eyebrow sx={{ mb: 2.5 }}>{t("v7.finalCta.eyebrow")}</Eyebrow>
          <Display component="h2" sx={{ fontSize: "clamp(30px, 4vw, 46px)" }}>
            {t("v7.finalCta.headline")}
          </Display>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16, md: 17.5 }, lineHeight: 1.6, mt: 2.5, maxWidth: 500 }}>
            {t("v7.finalCta.body")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4 }}>
            <PrimaryBtn data-testid="final-primary-cta" onClick={() => goStart(router, "final")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {t("v7.finalCta.primary")}
            </PrimaryBtn>
            <SecondaryBtn data-testid="final-secondary-cta" href="/documentation">
              {t("v7.finalCta.secondary")}
            </SecondaryBtn>
          </Box>
        </Box>

        <Box sx={{ display: { xs: "none", lg: "flex" }, justifyContent: "flex-end" }}>
          <PaidStack />
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FinalCTAV7);
