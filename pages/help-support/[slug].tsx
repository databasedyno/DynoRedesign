import { pageProps, } from "@/utils/types";
import { HelpArticle } from "@/pages/help-support/index";
import { Box, Typography, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetServerSideProps } from "next";
import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { TextDecoration } from "@/Components/Page/HelpAndSupport/styled";
import BackArrow from "@/assets/Icons/BackArrow.svg";
import Image from "next/image";
import axiosBaseApi from "@/axiosConfig";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { BRAND_ACCENT } from "@/constants/theme";
import { API_ENDPOINTS } from "@/api/endpoints";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import GettingStartedWithDynopay from "@/Components/Page/HelpAndSupport/Slugs/getting-started-with-dynopay";
import HelpArticleBody from "@/Components/Page/HelpAndSupport/HelpArticleBody";

const SITE_URL = "https://dynopay.com";

interface KBArticleDetail {
  article_id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category_name?: string;
  reading_time_minutes?: number;
  helpful_count?: number;
  not_helpful_count?: number;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

/** Rich, hand-authored article bodies keyed by slug (server-rendered for SEO). */
const RICH_ARTICLES: Record<string, React.ComponentType<{ data: HelpArticle }>> = {
  "getting-started-with-dynopay": GettingStartedWithDynopay,
};

interface HelpDetailProps extends pageProps {
  /** DB-backed article when the knowledge base has one for this slug. */
  article: KBArticleDetail | null;
  /** Static fallback (title + description) for the published help-center list. */
  stub: HelpArticle | null;
}

/** Plain-text meta description from a DB article (excerpt → stripped content). */
const dbMetaDescription = (article: KBArticleDetail): string => {
  const raw = article.excerpt || article.content || "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};

const HelpDetail = ({ article, stub, setPageName, setPageDescription }: HelpDetailProps) => {
  const isMobile = useIsMobile("md");
  const { t, i18n } = useTranslation("helpAndSupport");
  const router = useRouter();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("helpAndSupportTitle"));
      setPageDescription(t("helpAndSupportDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  const slug = article?.slug || stub?.slug || "";
  const title = article?.title || (stub ? t(`articles.${slug}.title`, { defaultValue: stub.title }) : "Help Article");
  const metaDescription = article
    ? dbMetaDescription(article)
    : stub
      ? t(`articles.${slug}.description`, { defaultValue: stub.description })
      : "Dynopay knowledge base — guides for crypto payments, products, tips, and account setup.";
  const canonicalBase = `${SITE_URL}/help-support/${slug}`;
  const lang = i18n.language;
  const canonicalUrl = lang && lang !== "en" ? `${canonicalBase}?lang=${lang}` : canonicalBase;
  const LOCALES = ["en", "pt", "fr", "es", "de", "nl"];

  const handleFeedback = async (isHelpful: boolean) => {
    if (!article?.article_id || feedbackSubmitted) return;
    try {
      await axiosBaseApi.post(API_ENDPOINTS.kb.articleFeedback(article.article_id), {
        is_helpful: isHelpful,
      });
      setFeedbackSubmitted(true);
    } catch {
      // Silently fail
    }
  };

  const head = (
    <Head>
      <title>{`${title} · Dynopay Help Center`}</title>
      <meta name="description" content={metaDescription} />
      <link key="canonical" rel="canonical" href={canonicalUrl} />
      {LOCALES.map((l) => (
        <link key={`alt-${l}`} rel="alternate" hrefLang={l} href={l === "en" ? canonicalBase : `${canonicalBase}?lang=${l}`} />
      ))}
      <link key="x-default" rel="alternate" hrefLang="x-default" href={canonicalBase} />
      <meta key="og:type" property="og:type" content="article" />
      <meta key="og:title" property="og:title" content={`${title} · Dynopay Help Center`} />
      <meta key="og:description" property="og:description" content={metaDescription} />
      <meta key="og:url" property="og:url" content={canonicalUrl} />
      <meta key="twitter:title" name="twitter:title" content={`${title} · Dynopay Help Center`} />
      <meta key="twitter:description" name="twitter:description" content={metaDescription} />
    </Head>
  );

  // ── 1. Static hand-authored article (fully server-rendered) ──
  if (!article && stub) {
    const Bespoke = RICH_ARTICLES[slug];
    return (
      <>
        {head}
        <Box sx={{ flex: 1, display: "flex", minHeight: 0, pt: { xs: 2, md: 3.5 }, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" }, ...(Bespoke ? {} : { pb: { xs: "12px", md: "20px" }, overflowY: "auto" }) }}>
          {Bespoke ? <Bespoke data={stub} /> : <HelpArticleBody slug={slug} title={title} />}
        </Box>
      </>
    );
  }

  const backButton = (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
      onClick={() => router.push("/help-support")}
    >
      <Image src={BackArrow} alt="Back" width={16} height={16} />
      <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
        {t("backToHelpSupport")}
      </Typography>
    </Box>
  );

  // ── 2. DB-backed article (sanitized HTML body + feedback) ──
  if (article) {
    return (
      <>
        {head}
        <Box sx={{ flex: 1, display: "flex", minHeight: 0, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" } }}>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {backButton}
              <TextDecoration {...({ component: "h1" } as { component: string })} style={{ fontSize: isMobile ? "20px" : "28px", color: theme.palette.text.primary, lineHeight: 1.3, margin: 0 }}>
                {article.title}
              </TextDecoration>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                {article.category_name && (
                  <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: BRAND_ACCENT, backgroundColor: "rgba(0, 4, 255, 0.08)", px: 1.5, py: 0.5, borderRadius: "4px" }}>
                    {article.category_name}
                  </Typography>
                )}
                {article.reading_time_minutes && (
                  <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                    {article.reading_time_minutes} min read
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.border.main}`,
                  borderRadius: "14px",
                  padding: isMobile ? "16px" : "32px",
                  "& h1, & h2, & h3": { fontFamily: "var(--font-sans)", color: theme.palette.text.primary, marginTop: "24px", marginBottom: "12px" },
                  "& h2": { fontSize: isMobile ? "18px" : "22px" },
                  "& h3": { fontSize: isMobile ? "16px" : "18px" },
                  "& p": { fontFamily: "var(--font-sans)", fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary, lineHeight: 1.7, marginBottom: "12px" },
                  "& ul, & ol": { paddingLeft: "24px", marginBottom: "12px" },
                  "& li": { fontFamily: "var(--font-sans)", fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary, lineHeight: 1.7, marginBottom: "6px" },
                  "& a": { color: BRAND_ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } },
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
              />
              <Box sx={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.border.main}`, borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {feedbackSubmitted ? (
                  <Typography sx={{ fontSize: "15px", fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{t("feedbackThanks")}</Typography>
                ) : (
                  <>
                    <Typography sx={{ fontSize: "15px", fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{t("wasArticleHelpful")}</Typography>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Button onClick={() => handleFeedback(true)} startIcon={<ThumbUpIcon />} sx={{ border: `1px solid ${theme.palette.border.main}`, borderRadius: "8px", color: theme.palette.text.primary, textTransform: "none", fontFamily: "var(--font-sans)", px: 3, "&:hover": { backgroundColor: "rgba(0, 200, 83, 0.08)", borderColor: "#00C853" } }}>Yes</Button>
                      <Button onClick={() => handleFeedback(false)} startIcon={<ThumbDownIcon />} sx={{ border: `1px solid ${theme.palette.border.main}`, borderRadius: "8px", color: theme.palette.text.primary, textTransform: "none", fontFamily: "var(--font-sans)", px: 3, "&:hover": { backgroundColor: "rgba(255, 0, 0, 0.08)", borderColor: "#FF0000" } }}>No</Button>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </>
    );
  }

  // ── 3. Static stub (title + description) — server-rendered so it is indexable ──
  return (
    <>
      {head}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" } }}>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px", maxWidth: "728px" }}>
          {backButton}
          <TextDecoration {...({ component: "h1" } as { component: string })} style={{ fontSize: isMobile ? "20px" : "28px", color: theme.palette.text.primary, lineHeight: 1.3, margin: 0 }}>
            {title}
          </TextDecoration>
          <Box sx={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.border.main}`, borderRadius: "14px", padding: isMobile ? "16px" : "32px" }}>
            <Typography component="p" sx={{ fontFamily: "var(--font-sans)", fontSize: isMobile ? "14px" : "16px", color: theme.palette.text.primary, lineHeight: 1.7 }}>
              {stub?.description}
            </Typography>
            <Typography component="p" sx={{ mt: 2, fontFamily: "var(--font-sans)", fontSize: isMobile ? "13px" : "15px", color: theme.palette.text.secondary, lineHeight: 1.7 }}>
              {t("articleStubMore", { defaultValue: "Need a hand with this topic? Our support team is available in the dashboard and at support@dynopay.com." })}
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  );
};

/**
 * SSR so crawlers get the real title, body and canonical in the initial HTML
 * (previously the article was fetched client-side and the server sent a spinner).
 * Content source order: knowledge-base DB → hand-authored static article →
 * published-list stub. An unknown slug returns 404 so we never index an empty shell.
 */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = String(ctx.params?.slug || "");
  const stub = (HelpAndSupportData as HelpArticle[]).find((a) => a.slug === slug) || null;

  const base = (
    process.env.INTERNAL_API_URL ||
    process.env.INTERNAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    ""
  ).replace(/\/+$/, "");

  // Prefer a published DB article when one exists (auto-upgrades thin stubs).
  if (base && slug) {
    try {
      const r = await fetch(`${base}/api${API_ENDPOINTS.kb.article(slug)}`, {
        headers: { Accept: "application/json" },
      });
      if (r.ok) {
        const json = await r.json();
        const article = json?.data?.article as KBArticleDetail | undefined;
        if (article?.slug) {
          ctx.res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
          return { props: { article, stub } };
        }
      }
    } catch {
      // fall through to static content
    }
  }

  // Static content path — only for slugs that are part of the published list.
  if (!stub) return { notFound: true };
  ctx.res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return { props: { article: null, stub } };
};

export default HelpDetail;
