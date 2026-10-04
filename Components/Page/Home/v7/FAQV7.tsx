import React, { memo, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { FONT_BODY, FONT_DISPLAY, GOLD, Section, SectionHead, useConsole } from "./kit";

/** Section 8 — FAQ ("What if…?") — four highest-intent questions + FAQPage JSON-LD. */
const FAQ_IDS = ["cost", "speed", "custody", "coins"];

const FAQV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState<string | null>("cost");
  const FAQS = FAQ_IDS.map((id) => ({ id, q: t(`v7.faq.${id}.q`), a: t(`v7.faq.${id}.a`) }));
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });

  return (
    <Section id="faq" testId="faq" alt>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1.2fr" }, gap: { xs: 4, lg: 7 }, alignItems: "start" }}>
        <SectionHead eyebrow={t("v7.faq.eyebrow")} title={t("v7.faq.headline")} testId="faq-head" sx={{ mb: 0 }} />

        <Box sx={{ border: `1px solid ${s.line}`, borderRadius: "14px", background: s.canvas, overflow: "hidden" }}>
          {FAQS.map((f, i) => {
            const isOpen = open === f.id;
            return (
              <Box key={f.id} sx={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${s.line}` : "none" }}>
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
                    px: { xs: 2.5, md: 3 },
                    py: { xs: 2.25, md: 2.5 },
                    cursor: "pointer",
                    transition: "background-color 160ms ease",
                    "&:hover": { background: s.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" },
                    "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: -2 },
                  }}
                >
                  <Typography component="span" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 15.5, md: 17 }, letterSpacing: "-0.01em", color: s.ink, textAlign: "left" }}>
                    {f.q}
                  </Typography>
                  <Box sx={{ color: s.ink3, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {isOpen ? <RemoveIcon sx={{ fontSize: 20 }} /> : <AddIcon sx={{ fontSize: 20 }} />}
                  </Box>
                </Box>
                <Collapse in={isOpen} timeout={240} easing="cubic-bezier(0.16,1,0.3,1)">
                  <Box sx={{ px: { xs: 2.5, md: 3 }, pb: { xs: 2.5, md: 3 } }}>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2, lineHeight: 1.65, maxWidth: 640 }}>{f.a}</Typography>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Section>
  );
};

export default memo(FAQV7);
