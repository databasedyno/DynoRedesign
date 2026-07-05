import React, { memo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Box, Button, Grid, Typography, useTheme } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import HomeCard from "@/Components/UI/HomeCard";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import useIsMobile from "@/hooks/useIsMobile";
import { useThemeMode } from "@/contexts/ThemeContext";
import type { SEOPageContent } from "@/utils/seoContent";

interface Props {
  content: SEOPageContent;
  /** Absolute URL of this page (without trailing slash), used for canonical + JSON-LD */
  canonicalUrl: string;
}

const SITE_ORIGIN = "https://dynopay.com";
const SIGNUP_PATH = "/auth/register";

const SEOLandingPage: React.FC<Props> = ({ content, canonicalUrl }) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const router = useRouter();

  // Attribute every signup click coming from these pages so we can measure
  // conversion downstream (query param arrives in the register funnel).
  const signupHref = `${SIGNUP_PATH}?src=seo&page=${encodeURIComponent(content._slug)}&kind=${content._kind}`;

  const breadcrumbLabel =
    content._kind === "country" ? "Countries" : "Industries";
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
      name: "DynoPay",
      url: SITE_ORIGIN,
    },
    about: {
      "@type": "Organization",
      name: "DynoPay",
      url: SITE_ORIGIN,
      description:
        "Non-custodial cryptocurrency payment gateway. Accept BTC, ETH, USDT and 12+ assets directly to your wallet.",
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

  return (
    <>
      <Head>
        <title>{content.meta_title}</title>
        <meta name="description" content={content.meta_description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* OpenGraph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={content.meta_title} />
        <meta property="og:description" content={content.meta_description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="DynoPay" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.meta_title} />
        <meta name="twitter:description" content={content.meta_description} />

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
      </Head>

      {/* ── Breadcrumbs (semantic, visible) ────────────────────────────── */}
      <Box
        component="nav"
        aria-label="Breadcrumb"
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pt: { xs: 3, md: 4 },
          pb: 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary, fontSize: 14 }}
        >
          <Box
            component="a"
            href="/"
            sx={{ color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            Home
          </Box>
          {" / "}
          <Box
            component="span"
            sx={{ color: "inherit" }}
          >
            {breadcrumbLabel}
          </Box>
          {" / "}
          <Box component="span" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {content._display_name}
          </Box>
        </Typography>
      </Box>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pt: { xs: 3, md: 5 },
          pb: { xs: 5, md: 7 },
          textAlign: "center",
        }}
      >
        {content._flag ? (
          <Typography
            component="div"
            sx={{ fontSize: { xs: 56, md: 72 }, lineHeight: 1, mb: 2 }}
            aria-hidden="true"
          >
            {content._flag}
          </Typography>
        ) : null}

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 32, md: 52 },
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: theme.palette.text.primary,
            maxWidth: 900,
            mx: "auto",
            mb: 2,
          }}
        >
          {content.h1}
        </Typography>

        <Typography
          component="p"
          sx={{
            fontSize: { xs: 16, md: 20 },
            lineHeight: 1.5,
            color: theme.palette.text.secondary,
            maxWidth: 720,
            mx: "auto",
            mb: { xs: 4, md: 5 },
          }}
        >
          {content.subheading}
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href={signupHref} passHref legacyBehavior>
            <Button
              component="a"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                fontSize: 16,
                px: { xs: 3, md: 4 },
                py: 1.5,
                borderRadius: 2,
                "&:hover": { bgcolor: theme.palette.primary.dark },
              }}
            >
              {content.cta_headline}
            </Button>
          </Link>
          <Link href="/fees" passHref legacyBehavior>
            <Button
              component="a"
              variant="outlined"
              sx={{
                borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                color: theme.palette.text.primary,
                textTransform: "none",
                fontWeight: 600,
                fontSize: 16,
                px: { xs: 3, md: 4 },
                py: 1.5,
                borderRadius: 2,
              }}
            >
              See fees
            </Button>
          </Link>
        </Box>
      </Box>

      {/* ── Intro paragraph ───────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 900,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pb: { xs: 5, md: 7 },
        }}
      >
        <Typography
          component="p"
          sx={{
            fontSize: { xs: 16, md: 18 },
            lineHeight: 1.7,
            color: theme.palette.text.primary,
            textAlign: "center",
          }}
        >
          {content.intro_paragraph}
        </Typography>
      </Box>

      {/* ── Features grid ─────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 5, md: 7 },
        }}
      >
        <HomeSectionTitle
          type="small"
          badgeText="Why DynoPay"
          title="Everything you need to "
          highlightText="start accepting crypto"
          subtitle="Non-custodial by design. You keep the wallet, we handle the checkout."
          headingAs="h2"
          sx={{ maxWidth: "100%" }}
        />

        <Box sx={{ pt: { xs: 4, md: 6 } }}>
          <Grid container spacing={{ xs: 3, md: 4 }}>
            {content.features.map((f, idx) => (
              <Grid item xs={12} md={4} key={idx} display="flex" justifyContent="center">
                <HomeCard
                  height={isMobile ? "auto" : 260}
                  width={isMobile ? "100%" : 395}
                  bodySx={{ padding: { xs: 3, md: 4 } }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                    }}
                  >
                    <Typography
                      component="div"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: isDark ? "rgba(120,120,220,0.15)" : "rgba(85,86,239,0.10)",
                        color: theme.palette.primary.main,
                        fontWeight: 700,
                        fontSize: 18,
                        mb: 2,
                      }}
                    >
                      {idx + 1}
                    </Typography>
                    <Typography
                      component="h3"
                      sx={{
                        fontSize: { xs: 18, md: 20 },
                        fontWeight: 700,
                        color: theme.palette.text.primary,
                        mb: 1.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {f.title}
                    </Typography>
                    <Typography
                      component="p"
                      sx={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {f.description}
                    </Typography>
                  </Box>
                </HomeCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 900,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 5, md: 7 },
        }}
      >
        <HomeSectionTitle
          type="small"
          badgeText="How it works"
          title="Live in "
          highlightText="under 10 minutes"
          subtitle="No engineers required. If you can copy-paste a wallet address, you can accept crypto."
          headingAs="h2"
          sx={{ maxWidth: "100%" }}
        />

        <Box
          component="ol"
          sx={{
            listStyle: "none",
            counterReset: "step",
            p: 0,
            m: 0,
            mt: { xs: 4, md: 6 },
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {content.how_it_works.map((step, idx) => (
            <Box
              component="li"
              key={idx}
              sx={{
                display: "flex",
                gap: 2.5,
                alignItems: "flex-start",
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: theme.palette.primary.main,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {idx + 1}
              </Box>
              <Typography
                component="p"
                sx={{
                  fontSize: { xs: 15, md: 17 },
                  lineHeight: 1.6,
                  color: theme.palette.text.primary,
                  pt: 0.5,
                }}
              >
                {step}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 900,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 5, md: 7 },
        }}
      >
        <HomeSectionTitle
          type="small"
          badgeText="FAQ"
          title="Frequently "
          highlightText="asked questions"
          subtitle="Everything merchants ask before signing up."
          headingAs="h2"
          sx={{ maxWidth: "100%" }}
        />

        <Box sx={{ mt: { xs: 3, md: 5 } }}>
          {content.faqs.map((faq, idx) => (
            <Accordion
              key={idx}
              disableGutters
              elevation={0}
              sx={{
                bgcolor: "transparent",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                borderRadius: 3,
                mb: 2,
                "&:before": { display: "none" },
                "&.Mui-expanded": { margin: "0 0 16px 0" },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: theme.palette.text.primary }} />}
                sx={{
                  px: { xs: 2.5, md: 3 },
                  py: 1,
                  "& .MuiAccordionSummary-content": {
                    my: 2,
                  },
                }}
              >
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: 16, md: 17 },
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    m: 0,
                  }}
                >
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 2.5, md: 3 }, pt: 0, pb: 3 }}>
                <Typography
                  component="p"
                  sx={{
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: theme.palette.text.secondary,
                  }}
                >
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          maxWidth: 1000,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 6, md: 10 },
        }}
      >
        <Box
          sx={{
            textAlign: "center",
            p: { xs: 4, md: 7 },
            borderRadius: 4,
            background: isDark
              ? "linear-gradient(135deg, rgba(85,86,239,0.15) 0%, rgba(120,80,220,0.10) 100%)"
              : "linear-gradient(135deg, rgba(85,86,239,0.08) 0%, rgba(120,80,220,0.05) 100%)",
            border: `1px solid ${isDark ? "rgba(120,120,220,0.25)" : "rgba(85,86,239,0.15)"}`,
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: 26, md: 38 },
              fontWeight: 700,
              color: theme.palette.text.primary,
              mb: 2,
              lineHeight: 1.2,
            }}
          >
            {content.cta_headline}
          </Typography>
          <Typography
            component="p"
            sx={{
              fontSize: { xs: 15, md: 17 },
              lineHeight: 1.6,
              color: theme.palette.text.secondary,
              maxWidth: 620,
              mx: "auto",
              mb: { xs: 3, md: 4 },
            }}
          >
            {content.cta_body}
          </Typography>
          <Link href={signupHref} passHref legacyBehavior>
            <Button
              component="a"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                fontSize: { xs: 15, md: 17 },
                px: { xs: 3, md: 5 },
                py: { xs: 1.5, md: 2 },
                borderRadius: 2,
                "&:hover": { bgcolor: theme.palette.primary.dark },
              }}
            >
              Create your free account
            </Button>
          </Link>
        </Box>
      </Box>
    </>
  );
};

export default memo(SEOLandingPage);
