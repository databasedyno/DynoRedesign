import React from "react";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import {
  EyebrowV8,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  PANEL,
  Reveal,
  SectionHeadV8,
  SectionV8,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import type { SEOFaq, SEOFeature, SEOPageIndexEntry } from "@/utils/seoContent";
import SEOIllustration from "./SEOIllustration";

/* Body sections of the v8 /for/* + /compare/* landing template. */

/** Wraps `part` of a translated title in the gold gradient (no-op if absent). */
export const hl = (title: string, part: string): React.ReactNode => {
  const i = part ? title.indexOf(part) : -1;
  if (i < 0) return title;
  return (
    <>
      {title.slice(0, i)}
      <GradientText>{part}</GradientText>
      {title.slice(i + part.length)}
    </>
  );
};

export const SEOIntro: React.FC<{ name: string; text: string }> = ({ name, text }) => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  return (
    <SectionV8 testId="seo-intro" sx={{ py: { xs: 8, md: 12 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "300px minmax(0,1fr)" }, gap: { xs: 3, md: 8 }, alignItems: "start" }}>
        <Reveal>
          <EyebrowV8 sx={{ mb: 2 }}>{t("seo.introEyebrow")}</EyebrowV8>
          <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 26, md: 32 }, lineHeight: 1.12, letterSpacing: "-0.025em", color: s.ink }}>
            {name}
          </Typography>
        </Reveal>
        <Reveal delay={0.08}>
          <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 17, md: 20 }, lineHeight: 1.65, color: s.ink2, pl: { md: 4 }, borderLeft: { md: `2px solid ${s.accentSoft}` } }}>
            {text}
          </Typography>
        </Reveal>
      </Box>
    </SectionV8>
  );
};

export const SEOFeatures: React.FC<{ features: SEOFeature[] }> = ({ features }) => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  const cols = features.length === 4 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
  return (
    <SectionV8 testId="seo-features" sx={{ background: s.surface }}>
      <SectionHeadV8 center eyebrow={t("seo.whyDynopayBadge")} title={hl(t("seo.whyDynopayTitle"), t("seo.whyDynopayHighlight"))} lead={t("seo.whyDynopaySubtitle")} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: cols }, gap: { xs: 2.5, md: 3 } }}>
        {features.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.08}>
            <Box
              data-testid={`seo-feature-${i}`}
              sx={{
                height: "100%",
                p: { xs: 3, md: 3.75 },
                borderRadius: "18px",
                border: `1px solid ${s.line}`,
                background: s.canvas,
                transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
                "&:hover": { transform: "translateY(-4px)", borderColor: s.lineStrong, boxShadow: s.dark ? "0 24px 48px -28px rgba(0,0,0,0.9)" : "0 24px 48px -28px rgba(10,10,10,0.25)" },
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15 }}>
                {String(i + 1).padStart(2, "0")}
              </Box>
              <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 18, md: 19.5 }, letterSpacing: "-0.01em", lineHeight: 1.3, color: s.ink, mb: 1.25 }}>
                {f.title}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: s.ink2 }}>{f.description}</Typography>
            </Box>
          </Reveal>
        ))}
      </Box>
    </SectionV8>
  );
};

export const SEOSteps: React.FC<{ steps: string[] }> = ({ steps }) => {
  const { t } = useTranslation("landing");
  return (
    <SectionV8 dark glow testId="seo-how-it-works">
      <SectionHeadV8 dark center eyebrow={t("seo.howItWorksBadge")} title={hl(t("seo.howItWorksTitle"), t("seo.howItWorksHighlight"))} lead={t("seo.howItWorksSubtitle")} />
      <Box component="ol" sx={{ listStyle: "none", p: 0, m: 0, position: "relative", display: "grid", gridTemplateColumns: { xs: "1fr", md: `repeat(${steps.length}, 1fr)` }, gap: { xs: 2, md: 3 } }}>
        <Box aria-hidden sx={{ display: { xs: "none", md: "block" }, position: "absolute", top: 60, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,209,0,0.4), transparent)" }} />
        {steps.map((step, i) => (
          <Box component="li" key={i} data-testid={`seo-step-${i}`} sx={{ position: "relative" }}>
            <Reveal delay={i * 0.1} sx={{ height: "100%" }}>
              <Box sx={{ height: "100%", p: { xs: 3, md: 3.5 }, borderRadius: "18px", border: `1px solid ${PANEL.line}`, background: "rgba(18,18,16,0.72)", backdropFilter: "blur(14px)" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "16px", display: "grid", placeItems: "center", background: PANEL.goldSoft, border: "1px solid rgba(255,209,0,0.35)", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 18, color: PANEL.gold }}>
                  {String(i + 1).padStart(2, "0")}
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: PANEL.ink3, mt: 3 }}>
                  {t("seo.stepLabel")} {i + 1}
                </Typography>
                <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.6, color: PANEL.ink, mt: 1 }}>
                  {step}
                </Typography>
              </Box>
            </Reveal>
          </Box>
        ))}
      </Box>
    </SectionV8>
  );
};

export const SEOFaqV8: React.FC<{ faqs: SEOFaq[] }> = ({ faqs }) => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  return (
    <SectionV8 testId="seo-faq">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,0.85fr) minmax(0,1.15fr)" }, gap: { xs: 2, md: 8 }, alignItems: "start" }}>
        <SectionHeadV8 eyebrow={t("seo.faqBadge")} title={hl(t("seo.faqTitle"), t("seo.faqHighlight"))} lead={t("seo.faqSubtitle")} sx={{ position: { md: "sticky" }, top: { md: 110 } }} />
        <Box sx={{ borderTop: `1px solid ${s.line}` }}>
          {faqs.map((faq, i) => (
            <Accordion
              key={i}
              disableGutters
              elevation={0}
              sx={{ background: "transparent", borderBottom: `1px solid ${s.line}`, borderRadius: "0 !important", "&:before": { display: "none" } }}
            >
              <AccordionSummary
                data-testid={`seo-faq-${i}`}
                expandIcon={<Icon icon="mdi:plus" width={22} height={22} color={s.accent} />}
                sx={{
                  px: 0,
                  "& .MuiAccordionSummary-content": { my: 2.5, mr: 2 },
                  "& .MuiAccordionSummary-expandIconWrapper": { transition: "transform 220ms ease" },
                  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": { transform: "rotate(45deg)" },
                  "&:hover h3": { color: s.accent },
                }}
              >
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 16.5, md: 18 }, fontWeight: 600, color: s.ink, m: 0, letterSpacing: "-0.01em", transition: "color 160ms ease" }}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails data-testid={`seo-faq-answer-${i}`} sx={{ px: 0, pt: 0, pb: 3 }}>
                <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.7, color: s.ink2, maxWidth: 640 }}>
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>
    </SectionV8>
  );
};

export const SEORelated: React.FC<{ pages: SEOPageIndexEntry[] }> = ({ pages }) => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  return (
    <SectionV8 testId="seo-related-pages" sx={{ background: s.surface }}>
      <Box aria-labelledby="seo-related-pages-heading">
        <SectionHeadV8 eyebrow={t("seo.exploreMoreBadge")} title={<span id="seo-related-pages-heading">{hl(t("seo.exploreMoreTitle"), t("seo.whyDynopayHighlight"))}</span>} lead={t("seo.exploreMoreSubtitle")} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
          {pages.map((rp, i) => (
            <Reveal key={rp.slug} delay={i * 0.08}>
              <Box
                component={Link}
                href={rp.urlPath}
                data-testid={`seo-related-link-${rp.kind}-${rp.slug}`}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                  p: { xs: 2.75, md: 3 },
                  borderRadius: "18px",
                  border: `1px solid ${s.line}`,
                  background: s.canvas,
                  textDecoration: "none",
                  transition: "transform 220ms ease, border-color 220ms ease",
                  "&:hover": { transform: "translateY(-3px)", borderColor: s.accent },
                  "&:hover .seo-rel-arrow": { transform: "translateX(4px)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                  <SEOIllustration slug={rp.slug} kind={rp.kind} flag={rp.flag} size={44} />
                  <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 16.5, md: 17.5 }, fontWeight: 700, color: s.ink, m: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                    {rp.kind === "country" ? t("seo.relatedCountry", { name: rp.displayName }) : t("seo.relatedVertical", { name: rp.displayName })}
                  </Typography>
                </Box>
                <Typography component="span" sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.accent, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.75, mt: "auto" }}>
                  {t("readTheGuide")}
                  <Icon className="seo-rel-arrow" icon="mdi:arrow-right" width={16} height={16} style={{ transition: "transform 200ms ease" }} />
                </Typography>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Box>
    </SectionV8>
  );
};
