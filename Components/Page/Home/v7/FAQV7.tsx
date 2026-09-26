import React, { memo, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { FONT_BODY, FONT_HERO, useAurora, BRAND_ACCENT } from "../v3/theme.v3";
import { Section, SectionHead } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 8 of 9 — FAQ (answers: "What if…?") — four highest-intent questions. */
const FAQ_IDS = ["cost", "speed", "custody", "coins"];

const FAQV7: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState<string | null>("cost");
  const FAQS = FAQ_IDS.map((id) => ({ id, q: t(`v7.faq.${id}.q`), a: t(`v7.faq.${id}.a`) }));
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });

  return (
    <Section id="faq" testId="faq" alt narrow>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SectionHead center eyebrow={t("v7.faq.eyebrow")} headline={t("v7.faq.headline")} maxWidth={680} testId="faq-head" />
      <Stagger step={0.05} sx={{ maxWidth: 820, mx: "auto", border: `1px solid ${s.line}`, borderRadius: "20px", background: s.surface, overflow: "hidden" }}>
        {FAQS.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <StaggerItem key={f.id} i={i} y={10}>
              <Box sx={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${s.line}` : "none" }}>
                <Box
                  component="button"
                  type="button"
                  aria-expanded={isOpen}
                  data-testid={`faq-${f.id}`}
                  onClick={() => setOpen(isOpen ? null : f.id)}
                  sx={{
                    all: "unset",
                    boxSizing: "border-box",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    px: { xs: 2.5, md: 3.5 },
                    py: { xs: 2.1, md: 2.5 },
                    cursor: "pointer",
                    transition: "background-color 160ms ease",
                    "&:hover": { background: s.bgAlt },
                    "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: -2 },
                  }}
                >
                  <Typography component="span" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 15.5, md: 17 }, letterSpacing: "-0.01em", color: s.ink, textAlign: "left" }}>
                    {f.q}
                  </Typography>
                  <Box sx={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: isOpen ? s.accent : s.bgAlt, color: isOpen ? "#121214" : s.ink, transition: "background-color 200ms ease" }}>
                    {isOpen ? <RemoveIcon sx={{ fontSize: 17 }} /> : <AddIcon sx={{ fontSize: 17 }} />}
                  </Box>
                </Box>
                <Collapse in={isOpen} timeout={260} easing="cubic-bezier(0.16,1,0.3,1)">
                  <Box sx={{ px: { xs: 2.5, md: 3.5 }, pb: { xs: 2.75, md: 3.25 } }}>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink2, lineHeight: 1.65, maxWidth: 760 }}>{f.a}</Typography>
                  </Box>
                </Collapse>
              </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
};

export default memo(FAQV7);
