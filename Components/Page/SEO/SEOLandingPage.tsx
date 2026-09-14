import React, { memo } from "react";
import Head from "next/head";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn, cardSx } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
import { FramedImage, PhoneFrame } from "@/Components/Page/Home/v5/DeviceFrame";

import type { SEOPageContent, SEOPageIndexEntry } from "@/utils/seoContent";
import { BRAND_ACCENT } from "@/constants/theme";
import SEOIllustration from "./SEOIllustration";
import { useTranslation } from 'react-i18next';
import { useVerticalAccent, type Vertical } from "@/Components/UI/_shared";

/**
 * Slug → Vertical map for `/for/{slug}` pages. Only these four verticals get
 * a per-audience accent applied; country pages (`/accept-crypto-payments-in/*`)
 * and any future slugs fall back to the default indigo merchant tint.
 */
const SEO_SLUG_TO_VERTICAL: Record<string, Vertical> = {
  merchants: "merchants",
  merchant: "merchants",
  fundraisers: "fundraisers",
  fundraiser: "fundraisers",
  donation: "fundraisers",
  crowdfunding: "fundraisers",
  creators: "creators",
  creator: "creators",
  developers: "developers",
  developer: "developers",
  api: "developers",
};

interface Props {
  content: SEOPageContent;
  /** Absolute URL of this page (without trailing slash), used for canonical + JSON-LD */
  canonicalUrl: string;
  /** Cross-link targets (3 pages of the opposite kind) — for SEO crawl depth */
  relatedPages?: SEOPageIndexEntry[];
  /** When set (bare URL, no ?lang), emit per-locale hreflang alternates. */
  localeAlternates?: string;
}

const SITE_ORIGIN = "https://dynopay.com";
const SIGNUP_PATH = "/auth/register";
const SEO_HREFLANGS = ["en", "pt", "fr", "es", "de", "nl"];

const breadcrumbLabelFor = (kind: SEOPageContent["_kind"], t: (k: string) => string) =>
  kind === "country" ? t('seo.countries') : t('seo.industries');

/** Colours `part` inside `title` (mirrors the old HomeSectionTitle highlight behaviour). */
const highlight = (title: string, part: string, color: string): React.ReactNode => {
  if (!part || !title.includes(part)) return title;
  const [before, ...rest] = title.split(part);
  return (
    <>
      {before}
      <Box component="span" sx={{ color }}>{part}</Box>
      {rest.join(part)}
    </>
  );
};

const SEOLandingPage: React.FC<Props> = ({ content, canonicalUrl, relatedPages = [], localeAlternates }) => {
  const { t } = useTranslation('landing');
  const s = useAurora();
  const accentInk = s.dark ? "#818CF8" : BRAND_ACCENT;

  // ─── Vertical-specific accent (design audit 2026-08-05, Phase 4) ────
  // /for/{slug} pages inherit the accent of the matching vertical so a
  // creator lands on a volt-lime hero, a fundraiser on violet, and a
  // developer on obsidian-with-volt. Country pages fall through to the
  // default merchant indigo. The `override` arg on useVerticalAccent()
  // means the route heuristic can't misfire here.
  const verticalOverride: Vertical | undefined =
    content._kind === "vertical"
      ? SEO_SLUG_TO_VERTICAL[content._slug || ""]
      : undefined;
  // Kept for the eyebrow label ("For creators"); colours now come from the shared aurora system.
  const accent = useVerticalAccent(verticalOverride);
  const heroEyebrow =
    content._kind === "vertical" && verticalOverride
      ? `For ${accent.vertical}`
      : content._kind === "comparison"
        ? `${content._display_name} · ${t('seo.compareEyebrow')}`
        : breadcrumbLabelFor(content._kind, t);

  // Attribute every signup click coming from these pages so we can measure
  // conversion downstream (query param arrives in the register funnel).
  const signupHref = `${SIGNUP_PATH}?src=seo&page=${encodeURIComponent(content._slug)}&kind=${content._kind}`;

  // Pre-rendered branded share image (public/og/, built by
  // scripts/generate-og-images.py). Absolute URL required by OG scrapers.
  const ogImageUrl = `${SITE_ORIGIN}/og/${content._kind}-${content._slug}.png`;

  const breadcrumbLabel = breadcrumbLabelFor(content._kind, t);
  const breadcrumbParentPath =
    content._kind === "country" ? "/accept-crypto-payments-in" : "/for";

  // ── JSON-LD structured data ───────────────────────────────────────────────
  const jsonLdWebPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: content.meta_title,
    description: content.meta_description,
    url: canonicalUrl,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "Dynopay",
      url: SITE_ORIGIN,
    },
    about: {
      "@type": "Organization",
      name: "Dynopay",
      url: SITE_ORIGIN,
      description:
        "Non-custodial crypto commerce platform. Sell products, collect tips, run crowdfunding campaigns, and accept BTC, ETH, USDT and 12+ assets directly to your wallet.",
    },
  };

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_ORIGIN,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: breadcrumbLabel,
        item: `${SITE_ORIGIN}${breadcrumbParentPath}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: content._display_name,
        item: canonicalUrl,
      },
    ],
  };

  // Product/Offer schema so Google can show price + product rich results for
  // these audience/country landing pages (mirrors the /fees Service+Offer and the
  // home SoftwareApplication). Free to start, per-transaction pricing — no
  // fabricated ratings/reviews (against Google's structured-data policy).
  const jsonLdProduct = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Dynopay Crypto Payment Gateway",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: canonicalUrl,
    description: content.meta_description,
    provider: { "@type": "Organization", name: "Dynopay", url: SITE_ORIGIN },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description:
        "Free to start — pay only per successful transaction. Fees from 1.5% down to 0.5% by volume, first payment free.",
    },
  };

  return (
    <>
      <Head>
        <title>{content.meta_title}</title>
        <meta name="description" content={content.meta_description} />
        {/* `key="canonical"` overrides the fallback canonical in `_app.tsx`
             so search engines see the slug-specific URL. */}
        <link key="canonical" rel="canonical" href={canonicalUrl} />
        {/* Real per-locale hreflang alternates (verticals are fully translated). */}
        {localeAlternates &&
          SEO_HREFLANGS.map((l) => (
            <link
              key={`alt-${l}`}
              rel="alternate"
              hrefLang={l}
              href={l === "en" ? localeAlternates : `${localeAlternates}?lang=${l}`}
            />
          ))}
        {localeAlternates && (
          <link key="x-default" rel="alternate" hrefLang="x-default" href={localeAlternates} />
        )}

        {/* OpenGraph */}
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:title" property="og:title" content={content.meta_title} />
        <meta key="og:description" property="og:description" content={content.meta_description} />
        <meta key="og:url" property="og:url" content={canonicalUrl} />
        <meta key="og:site_name" property="og:site_name" content="Dynopay" />
        <meta key="og:image" property="og:image" content={ogImageUrl} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta property="og:image:alt" content={content.meta_title} />

        {/* Twitter */}
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={content.meta_title} />
        <meta key="twitter:description" name="twitter:description" content={content.meta_description} />
        <meta key="twitter:image" name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content={content.meta_title} />

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebPage) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }}
        />
      </Head>

      <PublicPageHero
        testId="seo-hero"
        eyebrow={heroEyebrow}
        title={content.h1}
        body={content.subheading}
        topSlot={
          <Box component="nav" aria-label="Breadcrumb" data-testid="seo-breadcrumbs">
            <Typography sx={{ fontFamily: FONT_TECH, color: s.ink3, fontSize: 12.5, letterSpacing: "0.04em" }}>
              <Box component="a" href="/" sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: s.ink } }}>
                {t('seo.home')}
              </Box>
              {" / "}
              <Box component="span" sx={{ color: "inherit" }}>{breadcrumbLabel}</Box>
              {" / "}
              <Box component="span" sx={{ color: s.ink, fontWeight: 600 }}>{content._display_name}</Box>
            </Typography>
          </Box>
        }
        actions={
          <>
            <PrimaryBtn data-testid="seo-hero-cta" href={signupHref} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {content.cta_headline}
            </PrimaryBtn>
            <SecondaryBtn data-testid="seo-hero-fees" href="/fees">
              {t('v3.nav.pricing')}
            </SecondaryBtn>
          </>
        }
        aside={
          <Box data-testid="seo-hero-illustration" sx={{ display: { xs: "none", md: "flex" }, justifyContent: "flex-end", pr: { md: 4 } }}>
            <Box sx={{ position: "relative" }}>
              <PhoneFrame testId="seo-hero-phone" width={250}>
                <FramedImage src={`/landing/products/checkout-phone-${s.dark ? "dark" : "light"}.webp`} alt={t('v5.hero.secondary')} position="top center" />
              </PhoneFrame>
              <Box sx={{ position: "absolute", left: -56, bottom: 36, p: 1.5, borderRadius: "24px", background: s.surface, border: `1px solid ${s.line}`, boxShadow: s.dark ? "0 24px 48px -28px rgba(0,0,0,0.9)" : "0 24px 48px -28px rgba(10,10,10,0.35)" }}>
                <SEOIllustration slug={content._slug || ""} kind={content._kind} flag={content._flag} size={88} hero />
              </Box>
            </Box>
          </Box>
        }
      />

      {/* ── Intro (hand-authored, previously unused) ───────────────────── */}
      {content.intro_paragraph ? (
        <Section alt testId="seo-intro" narrow sx={{ py: { xs: 7, md: 10 } }}>
          <Stagger step={0.1} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" }, gap: { xs: 2, md: 6 }, alignItems: "start" }}>
            <StaggerItem i={0} y={12}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: accentInk, fontWeight: 500 }}>
                {t('seo.introEyebrow')}
              </Typography>
            </StaggerItem>
            <StaggerItem i={1} y={14}>
              <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.6, color: s.ink2, letterSpacing: "-0.005em" }}>
                {content.intro_paragraph}
              </Typography>
            </StaggerItem>
          </Stagger>
        </Section>
      ) : null}

      {/* ── Features grid ─────────────────────────────────────────────── */}
      <Section testId="seo-features">
        <SectionHead eyebrow={t('seo.whyDynopayBadge')} headline={highlight(t('seo.whyDynopayTitle'), t('seo.whyDynopayHighlight'), accentInk)} body={t('seo.whyDynopaySubtitle')} />
        <Stagger step={0.07} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 2 }}>
          {content.features.map((f, idx) => (
            <StaggerItem key={idx} i={idx} y={16}>
              <Box data-testid={`seo-feature-${idx}`} sx={{ ...cardSx(s), height: "100%", p: { xs: 2.75, md: 3.25 }, display: "flex", flexDirection: "column" }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accentInk, fontFamily: FONT_TECH, fontWeight: 700, fontSize: 15, mb: 2 }}>
                  {String(idx + 1).padStart(2, "0")}
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontSize: { xs: 17, md: 18.5 }, fontWeight: 700, color: s.ink, mb: 1, lineHeight: 1.3, letterSpacing: "-0.015em" }}>
                  {f.title}
                </Typography>
                <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>
                  {f.description}
                </Typography>
              </Box>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <Section alt testId="seo-how-it-works" narrow>
        <SectionHead eyebrow={t('seo.howItWorksBadge')} headline={highlight(t('seo.howItWorksTitle'), t('seo.howItWorksHighlight'), accentInk)} body={t('seo.howItWorksSubtitle')} />
        <Stagger step={0.08} component="ol" sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {content.how_it_works.map((step, idx) => (
            <StaggerItem key={idx} i={idx} y={14}>
              <Box component="li" data-testid={`seo-step-${idx}`} sx={{ ...cardSx(s, { hover: false }), display: "flex", gap: 2.5, alignItems: "flex-start", p: { xs: 2.5, md: 3 } }}>
                <Box sx={{ flexShrink: 0, display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "50%", bgcolor: BRAND_ACCENT, color: "#fff", fontFamily: FONT_TECH, fontWeight: 700, fontSize: 14 }}>
                  {idx + 1}
                </Box>
                <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16.5 }, lineHeight: 1.6, color: s.ink, pt: 0.5 }}>
                  {step}
                </Typography>
              </Box>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <Section testId="seo-faq" narrow>
        <SectionHead eyebrow={t('seo.faqBadge')} headline={highlight(t('seo.faqTitle'), t('seo.faqHighlight'), accentInk)} body={t('seo.faqSubtitle')} />
        <Stagger step={0.05} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {content.faqs.map((faq, idx) => (
            <StaggerItem key={idx} i={idx} y={12}>
              <Accordion
                disableGutters
                elevation={0}
                sx={{
                  ...cardSx(s, { hover: false }),
                  "&:before": { display: "none" },
                  "&.Mui-expanded": { margin: 0, borderColor: `${BRAND_ACCENT}55` },
                  "&:first-of-type, &:last-of-type": { borderRadius: "18px" },
                }}
              >
                <AccordionSummary
                  data-testid={`seo-faq-${idx}`}
                  expandIcon={<ExpandMoreIcon sx={{ color: s.ink }} />}
                  sx={{ px: { xs: 2.5, md: 3 }, py: 0.5, "& .MuiAccordionSummary-content": { my: 2 } }}
                >
                  <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontSize: { xs: 16, md: 17.5 }, fontWeight: 700, color: s.ink, m: 0, letterSpacing: "-0.01em" }}>
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails data-testid={`seo-faq-answer-${idx}`} sx={{ px: { xs: 2.5, md: 3 }, pt: 0, pb: 3 }}>
                  <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.7, color: s.ink2 }}>
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── Related pages (cross-link for SEO crawl depth) ─────────────── */}
      {relatedPages.length > 0 ? (
        <Section alt testId="seo-related-pages">
          <Box component="div" aria-labelledby="seo-related-pages-heading">
            <SectionHead eyebrow={t('seo.exploreMoreBadge')} headline={<span id="seo-related-pages-heading">{highlight(t('seo.exploreMoreTitle'), t('seo.whyDynopayHighlight'), accentInk)}</span>} body={t('seo.exploreMoreSubtitle')} />
            <Stagger step={0.07} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 2 }}>
              {relatedPages.map((rp, idx) => (
                <StaggerItem key={rp.slug} i={idx} y={16}>
                  <Link href={rp.urlPath} passHref legacyBehavior>
                    <Box
                      component="a"
                      data-testid={`seo-related-link-${rp.kind}-${rp.slug}`}
                      sx={{ ...cardSx(s), display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.5, height: "100%", p: { xs: 2.5, md: 3 }, textDecoration: "none" }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                        <SEOIllustration slug={rp.slug} kind={rp.kind} flag={rp.flag} size={44} />
                        <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontSize: { xs: 16, md: 17.5 }, fontWeight: 700, color: s.ink, m: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                          {rp.kind === "country"
                            ? t('seo.relatedCountry', { name: rp.displayName })
                            : t('seo.relatedVertical', { name: rp.displayName })}
                        </Typography>
                      </Box>
                      <Typography component="span" sx={{ fontFamily: FONT_BODY, fontSize: 14, color: accentInk, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.5, mt: "auto" }}>
                        {t('readTheGuide')}
                        <ArrowForwardIcon sx={{ fontSize: 16 }} />
                      </Typography>
                    </Box>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </Box>
        </Section>
      ) : null}

      {/* ── Final CTA (shared band, page-specific copy) ────────────────── */}
      <PublicFinalCta
        attributionRef={`seo_${content._kind}_${content._slug}`}
        testId="seo-final-cta"
        title={content.cta_headline}
        body={content.cta_body}
        actions={
          <>
            <PrimaryBtn data-testid="seo-cta-signup" href={signupHref} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {t('createFreeAccount')}
            </PrimaryBtn>
            <SecondaryBtn onDark data-testid="seo-cta-demo" href="/pay/demo">
              {t('v5.hero.secondary')}
            </SecondaryBtn>
          </>
        }
      />
    </>
  );
};

export default memo(SEOLandingPage);
