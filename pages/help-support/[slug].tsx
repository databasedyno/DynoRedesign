import { pageProps } from "@/utils/types";
import { HelpArticle } from "@/pages/help-support/index";
import { Box, Typography, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetServerSideProps } from "next";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { API_ENDPOINTS } from "@/api/endpoints";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import GettingStartedWithDynopay from "@/Components/Page/HelpAndSupport/Slugs/getting-started-with-dynopay";
import HelpArticleBody from "@/Components/Page/HelpAndSupport/HelpArticleBody";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, useConsole } from "@/Components/Page/Home/v8/kit";

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
  article: KBArticleDetail | null;
  stub: HelpArticle | null;
}

const dbMetaDescription = (article: KBArticleDetail): string => {
  const raw = article.excerpt || article.content || "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};

const HelpDetail = ({ article, stub, setPageName, setPageDescription }: HelpDetailProps) => {
  const isMobile = useIsMobile("md");
  const { t, i18n } = useTranslation("helpAndSupport");
  const router = useRouter();
  const s = useConsole();
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
    if (feedbackSubmitted) return;
    try {
      if (article?.article_id) {
        await axiosBaseApi.post(API_ENDPOINTS.kb.articleFeedback(article.article_id), { is_helpful: isHelpful });
      } else if (slug) {
        await axiosBaseApi.post(API_ENDPOINTS.kb.articleFeedbackBySlug(slug), { is_helpful: isHelpful });
      } else {
        return;
      }
      setFeedbackSubmitted(true);
    } catch {
      // Silently fail
    }
  };

  const feedbackBtnSx = {
    border: `1px solid ${s.line}`,
    borderRadius: "10px",
    color: s.ink,
    textTransform: "none" as const,
    fontFamily: FONT_BODY,
    fontWeight: 600,
    px: 3,
    transition: "background-color 0.18s ease, border-color 0.18s ease",
  };

  const feedbackBox = (
    <Box sx={{ backgroundColor: s.surface, border: `1px solid ${s.line}`, borderRadius: "16px", padding: "22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {feedbackSubmitted ? (
        <Typography sx={{ fontSize: 15, fontFamily: FONT_BODY, color: s.ink }}>{t("feedbackThanks")}</Typography>
      ) : (
        <>
          <Typography sx={{ fontSize: 15, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.ink }}>{t("wasArticleHelpful")}</Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button data-testid="help-feedback-yes" onClick={() => handleFeedback(true)} startIcon={<ThumbUpIcon sx={{ fontSize: 18 }} />} sx={{ ...feedbackBtnSx, "&:hover": { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "#22C55E" } }}>Yes</Button>
            <Button data-testid="help-feedback-no" onClick={() => handleFeedback(false)} startIcon={<ThumbDownIcon sx={{ fontSize: 18 }} />} sx={{ ...feedbackBtnSx, "&:hover": { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "#EF4444" } }}>No</Button>
          </Box>
        </>
      )}
    </Box>
  );

  const head = (
    <Head>
      <title>{t("helpArticle_titleTemplate", { ns: "pageTitles", title, defaultValue: `${title} · Dynopay Help Center` })}</title>
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

  const backButton = (
    <Box
      component="a"
      data-testid="help-article-back"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, cursor: "pointer", color: s.accent, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, "& .arr": { transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1)" }, "&:hover .arr": { transform: "translateX(-3px)" } }}
      onClick={() => router.push("/help-support")}
    >
      <span className="arr">&larr;</span> {t("backToHelpSupport")}
    </Box>
  );

  // ── 1. Static hand-authored article (fully server-rendered) ──
  if (!article && stub) {
    const Bespoke = RICH_ARTICLES[slug];
    return (
      <>
        {head}
        <Box data-testid="help-article-page" sx={{ background: s.canvas, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, width: "100%", overflowY: "auto" }}>
          <Box sx={{ display: "flex", pt: { xs: 3, md: 5 }, width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" } }}>
            {Bespoke ? <Bespoke data={stub} /> : <HelpArticleBody slug={slug} title={title} />}
          </Box>
          <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto", px: { xs: "16px", md: "20px" }, pb: { xs: "24px", md: "40px" }, mt: 3 }}>
            <Box sx={{ maxWidth: 728 }}>{feedbackBox}</Box>
          </Box>
        </Box>
      </>
    );
  }

  // ── 2. DB-backed article (sanitized HTML body + feedback) ──
  if (article) {
    return (
      <>
        {head}
        <Box data-testid="help-article-page" sx={{ background: s.canvas }}>
          <Box sx={{ width: "100%", maxWidth: 820, mx: "auto", px: { xs: "16px", md: "20px" }, pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 9 }, display: "flex", flexDirection: "column", gap: "20px" }}>
            {backButton}
            <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.ink, fontSize: { xs: 26, md: 38 }, lineHeight: 1.12, letterSpacing: "-0.028em", margin: 0 }}>
              {article.title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              {article.category_name && (
                <Typography sx={{ fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: s.accent, backgroundColor: s.accentSoft, px: 1.25, py: 0.4, borderRadius: "999px" }}>
                  {article.category_name}
                </Typography>
              )}
              {article.reading_time_minutes ? (
                <Typography sx={{ fontSize: 12.5, fontFamily: FONT_BODY, color: s.ink3 }}>{article.reading_time_minutes} min read</Typography>
              ) : null}
            </Box>
            <Box
              sx={{
                backgroundColor: s.surface,
                border: `1px solid ${s.line}`,
                borderRadius: "16px",
                padding: isMobile ? "18px" : "32px",
                "& h1, & h2, & h3": { fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.ink, marginTop: "24px", marginBottom: "12px" },
                "& h2": { fontSize: isMobile ? "19px" : "24px" },
                "& h3": { fontSize: isMobile ? "16px" : "19px" },
                "& p": { fontFamily: FONT_BODY, fontSize: isMobile ? "14.5px" : "16.5px", color: s.ink2, lineHeight: 1.75, marginBottom: "14px" },
                "& ul, & ol": { paddingLeft: "22px", marginBottom: "14px" },
                "& li": { fontFamily: FONT_BODY, fontSize: isMobile ? "14.5px" : "16.5px", color: s.ink2, lineHeight: 1.75, marginBottom: "8px" },
                "& a": { color: s.accent, fontWeight: 600, textDecoration: "underline", textDecorationColor: `${s.accent}99`, "&:hover": { textDecorationColor: s.accent } },
                "& code": { background: s.dark ? "#1E2030" : "#F1F1EE", padding: "1px 6px", borderRadius: "5px", fontSize: "13.5px", fontFamily: "var(--font-tech), monospace" },
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
            />
            {feedbackBox}
          </Box>
        </Box>
      </>
    );
  }

  // ── 3. Static stub (title + description) — server-rendered so it is indexable ──
  return (
    <>
      {head}
      <Box data-testid="help-article-page" sx={{ background: s.canvas }}>
        <Box sx={{ width: "100%", maxWidth: 820, mx: "auto", px: { xs: "16px", md: "20px" }, pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 9 }, display: "flex", flexDirection: "column", gap: "20px" }}>
          {backButton}
          <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.ink, fontSize: { xs: 26, md: 38 }, lineHeight: 1.12, letterSpacing: "-0.028em", margin: 0 }}>
            {title}
          </Typography>
          <Box sx={{ backgroundColor: s.surface, border: `1px solid ${s.line}`, borderRadius: "16px", padding: isMobile ? "18px" : "32px" }}>
            <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: isMobile ? 15 : 16.5, color: s.ink, lineHeight: 1.75 }}>
              {stub?.description}
            </Typography>
            <Typography component="p" sx={{ mt: 2, fontFamily: FONT_BODY, fontSize: isMobile ? 14 : 15.5, color: s.ink2, lineHeight: 1.75 }}>
              {t("articleStubMore", { defaultValue: "Need a hand with this topic? Our support team is one tap away — just open the chat from any page and we'll help you out." })}
            </Typography>
          </Box>
          {feedbackBox}
        </Box>
      </Box>
    </>
  );
};

/**
 * SSR so crawlers get the real title, body and canonical in the initial HTML.
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

  if (base && slug) {
    try {
      const r = await fetch(`${base}/api${API_ENDPOINTS.kb.article(slug)}`, { headers: { Accept: "application/json" } });
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

  if (!stub) return { notFound: true };
  ctx.res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return { props: { article: null, stub } };
};

export default HelpDetail;
