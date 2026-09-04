import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { FONT_BODY, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * PainSolutionV3 — "the old way is broken" pain -> solution narrative (2026-08).
 *
 * Mid-page framing moment (benchmarked vs BlockBee's "frustrated by slow
 * transactions?" section). Each card pairs a real merchant pain with the exact
 * DynoPay capability that removes it. Copy is limited to features that exist
 * today (auto-convert, non-custodial, on-chain finality, hosted checkout + API).
 * Frontend-only, additive; all strings come from the `landing` namespace.
 */
const PainSolutionV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;

  const ROWS = [
    { pain: t("v3.pain.p1"), fix: t("v3.pain.f1") },
    { pain: t("v3.pain.p2"), fix: t("v3.pain.f2") },
    { pain: t("v3.pain.p3"), fix: t("v3.pain.f3") },
    { pain: t("v3.pain.p4"), fix: t("v3.pain.f4") },
  ];

  return (
    <Box component="section" data-testid="pain-solution" sx={{ background: s.bg, py: { xs: 10, md: 18 } }}>
      <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 5, md: 8 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.pain.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.pain.headline")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.pain.body")}
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: 3 } }}>
          {ROWS.map((row, i) => (
            <Reveal
              key={i}
              delay={i * 0.06}
            >
              <Box
                sx={{
                  height: "100%",
                  background: s.surface,
                  border: `1px solid ${s.line}`,
                  borderRadius: "20px",
                  p: { xs: 3, md: 3.5 },
                }}
              >
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 2.25 }}>
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: "8px",
                      display: "grid",
                      placeItems: "center",
                      background: s.dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)",
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 16, color: s.ink3 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.5, color: s.ink3 }}>
                    {row.pain}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: "8px",
                      display: "grid",
                      placeItems: "center",
                      background: s.dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.10)",
                    }}
                  >
                    <CheckRoundedIcon sx={{ fontSize: 16, color: accent }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: s.ink }}>
                    {row.fix}
                  </Typography>
                </Box>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(PainSolutionV3);
