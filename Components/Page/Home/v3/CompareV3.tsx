import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * CompareV3 — generic "why us vs the alternatives" moment (2026-08).
 *
 * Deliberately NOT naming competitors (brand/legal risk; most payment brands
 * avoid it). Compares DynoPay to a generic "typical crypto processor" on the
 * differentiators we can substantiate today. The DynoPay column is highlighted;
 * every row maps to a shipped capability.
 */
const CompareV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const dynoTint = s.dark ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.055)";

  const ROWS = [1, 2, 3, 4, 5, 6].map((n) => ({
    feature: t(`v3.compare.r${n}f`),
    dyno: t(`v3.compare.r${n}a`),
    other: t(`v3.compare.r${n}b`),
  }));

  const colFrames = { xs: "1fr", md: "1.15fr 1.35fr 1.35fr" } as const;

  return (
    <Box component="section" data-testid="compare" sx={{ background: s.bgAlt, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 5, md: 8 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.compare.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.compare.headline")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.compare.body")}
          </Typography>
        </Box>

        <Reveal>
          <Box
            sx={{
              background: s.surface,
              border: `1px solid ${s.line}`,
              borderRadius: "22px",
              overflow: "hidden",
            }}
          >
            {/* Header row (desktop only) */}
            <Box
              sx={{
                display: { xs: "none", md: "grid" },
                gridTemplateColumns: colFrames,
                alignItems: "center",
                px: 3.5,
                py: 2,
                borderBottom: `1px solid ${s.line}`,
              }}
            >
              <Box />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 20, height: 20, borderRadius: "6px", background: accent, display: "grid", placeItems: "center" }}>
                  <CheckRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
                </Box>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: 15, color: s.ink }}>
                  {t("v3.compare.colDyno")}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 15, color: s.ink3 }}>
                {t("v3.compare.colOther")}
              </Typography>
            </Box>

            {ROWS.map((row, i) => (
              <Box
                key={i}
                sx={{
                  display: "grid",
                  gridTemplateColumns: colFrames,
                  alignItems: { xs: "stretch", md: "center" },
                  columnGap: 2,
                  rowGap: 1,
                  px: { xs: 2.5, md: 3.5 },
                  py: { xs: 2.5, md: 2.25 },
                  borderTop: i === 0 ? "none" : `1px solid ${s.line}`,
                }}
              >
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15, color: s.ink, mb: { xs: 0.5, md: 0 } }}>
                  {row.feature}
                </Typography>

                {/* DynoPay cell (highlighted) */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    background: dynoTint,
                    borderRadius: "12px",
                    px: { xs: 1.5, md: 1.75 },
                    py: { xs: 1.25, md: 1.1 },
                  }}
                >
                  <CheckRoundedIcon sx={{ fontSize: 18, color: accent, mt: "1px", flexShrink: 0 }} />
                  <Box>
                    <Typography component="span" sx={{ display: { xs: "block", md: "none" }, fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, mb: 0.25 }}>
                      {t("v3.compare.colDyno")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, color: s.ink }}>
                      {row.dyno}
                    </Typography>
                  </Box>
                </Box>

                {/* Typical processor cell */}
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: { xs: 1.5, md: 1.75 }, py: { xs: 1.25, md: 1.1 } }}>
                  <RemoveRoundedIcon sx={{ fontSize: 18, color: s.ink3, mt: "1px", flexShrink: 0 }} />
                  <Box>
                    <Typography component="span" sx={{ display: { xs: "block", md: "none" }, fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, mb: 0.25 }}>
                      {t("v3.compare.colOther")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.45, color: s.ink2 }}>
                      {row.other}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 2, textAlign: "center" }}>
            {t("v3.compare.note")}
          </Typography>
        </Reveal>
      </Box>
    </Box>
  );
};

export default memo(CompareV3);
