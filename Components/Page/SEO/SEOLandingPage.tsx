import React, { memo } from "react";
import Head from "next/head";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useTranslation } from "react-i18next";
import {
  EyebrowV8,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  PrimaryBtn,
  SecondaryBtn,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import StatBandV8 from "@/Components/Page/Home/v8/StatBandV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import type { SEOPageContent, SEOPageIndexEntry } from "@/utils/seoContent";
import { useVerticalAccent, type Vertical } from "@/Components/UI/_shared";
import SEOHeroMock from "./SEOHeroMock";
import { SEOFaqV8, SEOFeatures, SEOIntro, SEORelated, SEOSteps } from "./SEOSectionsV8";

/**
 * Slug → Vertical map for `/for/{slug}` pages (drives the "For creators" eyebrow).
 * Other slugs fall back to the generic "Industries" label.
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

/** Splits a headline so its closing phrase (last two 4+ letter words) gets the gold gradient. */
const splitTail = (text: string): [string, string] => {
  const words = text.trim().split(/\s+/);
  let i = words.length;
  let content = 0;
  while (i > 0 && content < 2 && words.length - i < 4) {
    i -= 1;
    if (words[i].replace(/[^A-Za-z0-9\u00C0-\u024F]/g, "").length >= 4) content += 1;
  }
  return [words.slice(0, i).join(" "), words.slice(i).join(" ")];
};

const SEOLandingPage: React.FC<Props> = ({ content, canonicalUrl, relatedPages = [], localeAlternates }) => {
  const { t } = useTranslation('landing');
  const s = useConsole();

  const verticalOverride: Vertical | undefined =
    content._kind === "vertical"
      ? SEO_SLUG_TO_VERTICAL[content._slug || ""]
      : undefined;
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
  const ogImageUrl = `${SITE_ORIGIN}/og/${content._kind}-${content._slug}.png?v=2`;

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

      <Box sx={{ width: "100%", background: s.canvas }}>
        <SEOHero content={content} eyebrow={heroEyebrow} breadcrumbLabel={breadcrumbLabel} signupHref={signupHref} />
        <StatBandV8 />
        {content.intro_paragraph ? <SEOIntro name={content._display_name} text={content.intro_paragraph} /> : null}
        <SEOFeatures features={content.features} />
        <SEOSteps steps={content.how_it_works} />
        <SEOFaqV8 faqs={content.faqs} />
        {relatedPages.length > 0 ? <SEORelated pages={relatedPages} /> : null}
        <CtaBandV8
          testId="seo-final-cta"
          badge={t("seo.ctaBadge")}
          title={content.cta_headline}
          body={content.cta_body}
          primaryLabel={t("createFreeAccount")}
          primaryHref={signupHref}
          secondaryLabel={t("v5.hero.secondary")}
          secondaryHref="/pay/demo"
        />
      </Box>
    </>
  );
};

interface HeroProps {
  content: SEOPageContent;
  eyebrow: string;
  breadcrumbLabel: string;
  signupHref: string;
}

const SEOHero: React.FC<HeroProps> = ({ content, eyebrow, breadcrumbLabel, signupHref }) => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  const [lead, tail] = splitTail(content.h1);
  const trust = [t("footerNav.trust.nonCustodial"), t("footerNav.trust.noChargebacks"), t("footerNav.trust.chains")];
  return (
    <Box component="section" data-testid="seo-hero" sx={{ position: "relative", background: s.canvas, overflow: "hidden", pt: { xs: 10, md: 13 }, pb: { xs: 8, md: 12 } }}>
      <Box aria-hidden sx={{ position: "absolute", top: -140, right: -120, width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,209,0,0.14), transparent 62%)", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1200, mx: "auto", px: { xs: 3, md: 6 }, display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }, gap: { xs: 7, lg: 8 }, alignItems: "center" }}>
        <Box sx={{ maxWidth: 580, minWidth: 0 }}>
          <Box component="nav" aria-label="Breadcrumb" data-testid="seo-breadcrumbs" sx={{ mb: 3 }}>
            <Typography sx={{ fontFamily: FONT_MONO, color: s.ink3, fontSize: 12, letterSpacing: "0.04em" }}>
              <Box component="a" href="/" sx={{ color: "inherit", textDecoration: "none", transition: "color 160ms ease", "&:hover": { color: s.ink } }}>
                {t("seo.home")}
              </Box>
              {" / "}
              <Box component="span">{breadcrumbLabel}</Box>
              {" / "}
              <Box component="span" sx={{ color: s.ink, fontWeight: 600 }}>{content._display_name}</Box>
            </Typography>
          </Box>
          <EyebrowV8 sx={{ mb: 2.5 }}>{eyebrow}</EyebrowV8>
          <Typography component="h1" data-testid="seo-hero-title" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "clamp(32px, 4.6vw, 54px)", lineHeight: 1.06, letterSpacing: "-0.03em", color: s.ink, overflowWrap: "break-word" }}>
            {lead ? `${lead} ` : null}
            <GradientText>{tail}</GradientText>
          </Typography>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.62, mt: 3, maxWidth: 520 }}>
            {content.subheading}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4.5 }}>
            <PrimaryBtn data-testid="seo-hero-cta" href={signupHref} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
              {t("createFreeAccount")}
            </PrimaryBtn>
            <SecondaryBtn data-testid="seo-hero-fees" href="/fees" sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
              {t("v3.nav.pricing")}
            </SecondaryBtn>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mt: 4 }}>
            {trust.map((x) => (
              <Box key={x} sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
                <Icon icon="mdi:check-circle" width={16} height={16} color={s.accent} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>{x}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <SEOHeroMock content={content} />
      </Box>
    </Box>
  );
};

export default memo(SEOLandingPage);
