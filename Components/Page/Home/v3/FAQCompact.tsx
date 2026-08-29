import React, { memo, useState } from "react";
import { Box, Typography, Collapse } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

const FAQCompact: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState<number | null>(0);

  const FAQS: { q: string; a: string }[] = [
    { q: t("v3.faq.q1"), a: t("v3.faq.a1") },
    { q: t("v3.faq.q2"), a: t("v3.faq.a2") },
    { q: t("v3.faq.q3"), a: t("v3.faq.a3") },
    { q: t("v3.faq.q4"), a: t("v3.faq.a4") },
    { q: t("v3.faq.q5"), a: t("v3.faq.a5") },
    { q: t("v3.faq.q6"), a: t("v3.faq.a6") },
  ];

  // FAQPage rich-result schema — mirrors the visible Q&A exactly (SSR renders EN).
  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  return (
    <Box component="section" sx={{ background: s.bgAlt, py: { xs: 14, md: 24 } }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ mb: { xs: 7, md: 11 }, textAlign: "center" }}>
          <Eyebrow tone="coral" sx={{ mb: 2 }}>{t("v3.faq.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink }}>{t("v3.faq.headline")}</HeadlineL>
        </Box>

        <Box sx={{ border: `1px solid ${s.line}`, borderRadius: "20px", background: s.surface, overflow: "hidden" }}>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Box
                key={i}
                sx={{
                  borderBottom: i < FAQS.length - 1 ? `1px solid ${s.line}` : "none",
                }}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(isOpen ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(isOpen ? null : i);
                    }
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: { xs: 2.5, md: 3.5 },
                    py: { xs: 2.25, md: 2.75 },
                    gap: 2,
                    cursor: "pointer",
                    transition: "background .2s ease",
                    "&:hover": { background: s.bgAlt },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 16, md: 18 }, letterSpacing: "-0.01em", color: s.ink }}>
                    {f.q}
                  </Typography>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      minWidth: 34,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isOpen ? BRAND_ACCENT : s.bgAlt,
                      color: isOpen ? "#fff" : s.ink,
                      transition: "background .25s ease, transform .25s ease",
                    }}
                  >
                    {isOpen ? <RemoveIcon sx={{ fontSize: 18 }} /> : <AddIcon sx={{ fontSize: 18 }} />}
                  </Box>
                </Box>
                <Collapse in={isOpen}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, color: s.ink2, lineHeight: 1.65, px: { xs: 2.5, md: 3.5 }, pb: { xs: 3, md: 3.5 }, pt: 0.5, maxWidth: 760 }}>
                    {f.a}
                  </Typography>
                </Collapse>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ textAlign: "center", mt: 3.5 }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: s.ink3, letterSpacing: "0.08em" }}>
            {t("v3.faq.stillCurious")} ·{" "}
            <Box component="a" href="/help-support" sx={{ color: s.ink, fontWeight: 600, textDecoration: "none", borderBottom: `1px dashed ${s.lineStrong}`, "&:hover": { color: BRAND_ACCENT, borderColor: BRAND_ACCENT } }}>
              {t("v3.faq.askUs")}
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FAQCompact);
