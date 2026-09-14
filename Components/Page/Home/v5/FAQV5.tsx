import React, { memo, useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

const IDS = ["cost", "funds", "speed", "crypto", "wallet", "buyers", "donations", "refunds", "wrongAmount", "legal", "myCountry", "countries", "referral"] as const;

const FAQV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState<string | null>("cost");
  const faqs = IDS.map((id) => ({ id, q: t(`v5.faq.${id}.q`), a: t(`v5.faq.${id}.a`) }));
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });

  return (
    <Section id="faq" testId="faq" narrow>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SectionHead eyebrow={t("v5.faq.eyebrow")} headline={t("v5.faq.headline")} />
      <Stagger step={0.04} sx={{ border: `1px solid ${s.line}`, borderRadius: "20px", background: s.surface, overflow: "hidden" }}>
        {faqs.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <StaggerItem key={f.id} i={i} y={10}>
            <Box sx={{ borderBottom: i < faqs.length - 1 ? `1px solid ${s.line}` : "none" }}>
              <Box
                component="button"
                type="button"
                aria-expanded={isOpen}
                data-testid={`faq-${f.id}`}
                onClick={() => setOpen(isOpen ? null : f.id)}
                sx={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, px: { xs: 2.5, md: 3.5 }, py: { xs: 2.1, md: 2.5 }, cursor: "pointer", transition: "background-color 160ms ease", "&:hover": { background: s.bgAlt }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: -2 } }}
              >
                <Typography component="span" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 15.5, md: 17 }, letterSpacing: "-0.01em", color: s.ink, textAlign: "left" }}>{f.q}</Typography>
                <Box sx={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: isOpen ? BRAND_ACCENT : s.bgAlt, color: isOpen ? "#fff" : s.ink, transition: "background-color 200ms ease, transform 260ms cubic-bezier(0.16,1,0.3,1)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  {isOpen ? <RemoveIcon sx={{ fontSize: 17 }} /> : <AddIcon sx={{ fontSize: 17 }} />}
                </Box>
              </Box>
              <Collapse in={isOpen} timeout={260} easing="cubic-bezier(0.16,1,0.3,1)">
                <Box sx={{ px: { xs: 2.5, md: 3.5 }, pb: { xs: 2.75, md: 3.25 } }}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink2, lineHeight: 1.65, maxWidth: 760 }}>{f.a}</Typography>
                  {f.id === "donations" && (
                    <Box component="a" href="/pay/donation-demo" data-testid="faq-donations-demo" sx={{ display: "inline-block", mt: 1.5, fontFamily: FONT_TECH, fontSize: 13.5, fontWeight: 700, color: BRAND_ACCENT, textDecoration: "none", borderBottom: "1px solid transparent", transition: "border-color 160ms ease", "&:hover": { borderColor: BRAND_ACCENT } }}>{t("v5.products.donations.cta")} →</Box>
                  )}
                </Box>
              </Collapse>
            </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
      <Typography sx={{ mt: 3, fontFamily: FONT_TECH, fontSize: 13, color: s.ink3, letterSpacing: "0.06em" }}>
        {t("v5.faq.still")} ·{" "}
        <Box component="a" href="/help-support" data-testid="faq-ask" sx={{ color: s.ink, fontWeight: 600, textDecoration: "none", borderBottom: `1px dashed ${s.lineStrong}`, "&:hover": { color: BRAND_ACCENT, borderColor: BRAND_ACCENT } }}>{t("v5.faq.ask")}</Box>
      </Typography>
    </Section>
  );
};

export default memo(FAQV5);
