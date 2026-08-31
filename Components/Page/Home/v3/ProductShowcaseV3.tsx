import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

/**
 * ProductShowcaseV3 — real product visuals (2026-08).
 *
 * Uses genuine screenshots of the live public checkout (/pay/demo) and the
 * payment-success state (/pay/success-demo), captured into
 * public/assets/landing. No stock art, no fabricated UI, and — for privacy —
 * no real merchant dashboard data. Phone-framed to read as "this is the actual
 * experience your customer gets".
 */
const PHONES = [
  { src: "/assets/landing/checkout.png", capKey: "cap1", subKey: "sub1" },
  { src: "/assets/landing/success.png", capKey: "cap2", subKey: "sub2" },
];

const ProductShowcaseV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");

  return (
    <Box component="section" data-testid="product-showcase" sx={{ background: s.bg, py: { xs: 10, md: 18 } }}>
      <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 6, md: 9 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.showcase.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.showcase.headline")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.showcase.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: { xs: 6, md: 10 },
          }}
        >
          {PHONES.map((p, i) => (
            <motion.div
              key={p.src}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: "100%", maxWidth: 296 }}
            >
              <Box sx={{ width: "100%", maxWidth: 296, mx: "auto" }}>
                <Box
                  sx={{
                    p: "10px",
                    borderRadius: "42px",
                    background: s.dark
                      ? "linear-gradient(180deg,#1c1c22,#0b0b0f)"
                      : "linear-gradient(180deg,#2b2b33,#111114)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 44px 90px -34px rgba(0,0,0,0.5)",
                  }}
                >
                  <Box
                    component="img"
                    src={p.src}
                    alt={t(p.capKey === "cap1" ? "v3.showcase.cap1" : "v3.showcase.cap2")}
                    loading="lazy"
                    sx={{ display: "block", width: "100%", height: "auto", borderRadius: "32px" }}
                  />
                </Box>
                <Box sx={{ textAlign: "center", mt: 3 }}>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: s.ink, mb: 0.5 }}>
                    {t(`v3.showcase.${p.capKey}`)}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: s.ink2, maxWidth: 260, mx: "auto" }}>
                    {t(`v3.showcase.${p.subKey}`)}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProductShowcaseV3);
