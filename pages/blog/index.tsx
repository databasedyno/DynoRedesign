import React from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import Head from "next/head";
import { blogPosts, getBlogCover } from "@/utils/blogData";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { formatDateI18n } from "@/utils/formatDate";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import { SectionV8, GradientText, FONT_BODY, FONT_DISPLAY, FONT_MONO, useConsole } from "@/Components/Page/Home/v8/kit";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";

// Signature per-category accents (readable on both the light canvas tint and the
// near-black dark theme). The ACTIVE chip always flips to the brand gold.
const CATEGORY_COLORS: Record<string, string> = {
  "Integration Guide": "#5865F2",
  "Business Strategy": "#10B981",
  "Cost Analysis": "#E08A00",
  "Developer Guide": "#C79A00",
};

const GOLD = "#FFD100";

const BlogPage = () => {
  const { t } = useTranslation("landing");
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const s = useConsole();

  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const categories = React.useMemo(
    () => Array.from(new Set(blogPosts.map((p) => p.category))),
    [],
  );
  const visiblePosts = React.useMemo(
    () => (selectedCategory ? blogPosts.filter((p) => p.category === selectedCategory) : blogPosts),
    [selectedCategory],
  );

  return (
    <>
      <Head>
        <title>{t("blogIndex.metaTitle")}</title>
        <meta name="description" content={t("blogIndex.metaDescription")} />
        <meta key="og:title" property="og:title" content={t("blogIndex.metaTitle")} />
        <meta key="og:description" property="og:description" content={t("blogIndex.metaDescription")} />
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:url" property="og:url" content="https://dynopay.com/blog" />
        <link key="canonical" rel="canonical" href="https://dynopay.com/blog" />
      </Head>

      <PageHeroV8
        testId="blog-hero"
        eyebrow={t("blogIndex.eyebrow")}
        title={
          <>
            {t("blogIndex.heroTitleLead")} <GradientText>{t("blogIndex.heroTitleAccent")}</GradientText>
          </>
        }
        body={t("blogSubtitle")}
      />

      <SectionV8 testId="blog-index" sx={{ pt: { xs: 1, md: 2 }, pb: { xs: 8, md: 12 } }}>
        {/* Category filter — clickable chips */}
        <Box
          data-testid="blog-category-filters"
          sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: { xs: 4, md: 6 } }}
        >
          {[null, ...categories].map((cat) => {
            const label = cat === null ? t("blogIndex.allCategories", { defaultValue: "All" }) : cat;
            const isActive = selectedCategory === cat;
            const c = cat ? CATEGORY_COLORS[cat] || s.accent : s.ink2;
            return (
              <Box
                key={label}
                component="button"
                type="button"
                data-testid={`blog-category-filter-${cat === null ? "all" : cat.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => setSelectedCategory(cat)}
                sx={{
                  cursor: "pointer",
                  px: 2,
                  py: 0.9,
                  borderRadius: "999px",
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: isActive ? "#1A1A19" : c,
                  bgcolor: isActive ? GOLD : `${cat ? c : s.ink2}14`,
                  border: `1px solid ${isActive ? GOLD : `${cat ? c : s.ink2}40`}`,
                  transition: "background-color 180ms ease, color 180ms ease, border-color 180ms ease",
                  "&:hover": { bgcolor: isActive ? GOLD : `${cat ? c : s.ink2}26`, borderColor: isActive ? GOLD : c },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>

        {/* Blog grid */}
        <Stagger
          step={0.06}
          component="div"
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2.5, md: 3 } }}
        >
          {visiblePosts.map((post, pi) => {
            const catColor = CATEGORY_COLORS[post.category] || s.accent;
            return (
              <StaggerItem key={post.slug} i={pi} y={18}>
                <Box
                  data-testid={`blog-card-${post.slug}`}
                  onClick={() => router.push(`/blog/${post.slug}`)}
                  sx={{
                    bgcolor: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "16px",
                    cursor: "pointer",
                    p: isMobile ? 2.5 : 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1), border-color 220ms ease, box-shadow 220ms ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: GOLD,
                      boxShadow: s.dark ? "0 16px 40px rgba(0,0,0,0.45)" : "0 16px 40px rgba(17,18,20,0.10)",
                    },
                    "&:hover img": { transform: "scale(1.04)" },
                  }}
                >
                  <Box
                    sx={{
                      borderRadius: "12px",
                      overflow: "hidden",
                      aspectRatio: "1200 / 630",
                      mb: 2.5,
                      bgcolor: "#050720",
                      border: `1px solid ${s.line}`,
                    }}
                  >
                    <Box
                      component="img"
                      data-testid={`blog-card-cover-${post.slug}`}
                      src={getBlogCover(post)}
                      alt={post.title}
                      width={1200}
                      height={630}
                      loading="lazy"
                      decoding="async"
                      sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s cubic-bezier(0.2,0.8,0.2,1)" }}
                    />
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box
                      component="span"
                      role="button"
                      tabIndex={0}
                      data-testid={`blog-card-category-${post.slug}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedCategory(post.category); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSelectedCategory(post.category); } }}
                      sx={{
                        px: 1.25,
                        py: 0.4,
                        borderRadius: "999px",
                        bgcolor: `${catColor}16`,
                        border: `1px solid ${catColor}33`,
                        cursor: "pointer",
                        transition: "background-color 180ms ease",
                        "&:hover": { bgcolor: `${catColor}26` },
                      }}
                    >
                      <Typography sx={{ fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 600, color: catColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {post.category}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontFamily: FONT_BODY, color: s.ink3 }}>{post.readTime}</Typography>
                  </Box>

                  <Typography
                    sx={{ fontSize: isMobile ? 19 : 22, fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.ink, lineHeight: 1.25, letterSpacing: "-0.015em", mb: 1.5 }}
                  >
                    {post.title}
                  </Typography>

                  <Typography sx={{ fontSize: isMobile ? 13.5 : 14.5, fontFamily: FONT_BODY, color: s.ink2, lineHeight: 1.6, mb: 3, flex: 1 }}>
                    {post.excerpt}
                  </Typography>

                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: `${catColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: FONT_DISPLAY, fontWeight: 700, color: catColor }}
                      >
                        {post.author.name.charAt(0)}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 12.5, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.ink, lineHeight: 1.2 }}>
                          {post.author.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontFamily: FONT_BODY, color: s.ink3 }}>
                          {formatDateI18n(post.publishedAt, { month: "short", day: "numeric", year: "numeric" })}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: 13, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.accent, display: "flex", alignItems: "center", gap: 0.5 }}>
                      {t("readTheGuide")} &rarr;
                    </Typography>
                  </Box>
                </Box>
              </StaggerItem>
            );
          })}
        </Stagger>
      </SectionV8>

      <CtaBandV8
        testId="blog-final-cta"
        badge={t("v8.final.badge", { defaultValue: "Live in minutes · no credit card" })}
        title={t("blogReadyCta", { defaultValue: "Ready to accept crypto?" })}
        body={t("blogReadyCtaBody", { defaultValue: "Start accepting crypto payments today — non-custodial, zero chargebacks, and your first payment on us." })}
        primaryLabel={t("v3.hero.primaryCta", { defaultValue: "Start free" })}
        primaryRef="blog_final"
        secondaryLabel={t("documentation", { defaultValue: "Read the docs" })}
        secondaryHref="/documentation"
      />
    </>
  );
};

export default BlogPage;
