import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import Head from "next/head";
import { blogPosts, getBlogCover } from "@/utils/blogData";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from 'react-i18next';
import { brandFg } from "@/constants/theme";
import { AuroraInk } from "@/Components/Page/Home/v3/styled.v3";
import { useAurora } from "@/Components/Page/Home/v3/theme.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, cardSx } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
// HomeHeader is rendered by HomeLayout in _app.tsx

const categoryColors: Record<string, string> = {
  "Integration Guide": "#5865F2",
  "Business Strategy": "#10B981",
  "Cost Analysis": "#F59E0B",
  "Developer Guide": "#7C3AED",
};

const BlogPage = () => {
  const { t } = useTranslation('landing');
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";
  const s = useAurora();

  // ── Category filter (QA PUB-007 #2: category label was not clickable) ──
  // Users can now filter the blog by category. Default = "All".
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const categories = React.useMemo(
    () => Array.from(new Set(blogPosts.map((p) => p.category))),
    []
  );
  const visiblePosts = React.useMemo(
    () =>
      selectedCategory
        ? blogPosts.filter((p) => p.category === selectedCategory)
        : blogPosts,
    [selectedCategory]
  );

  return (
    <>
      <Head>
        <title>{t('blogIndex.metaTitle')}</title>
        <meta name="description" content={t('blogIndex.metaDescription')} />
        <meta key="og:title" property="og:title" content={t('blogIndex.metaTitle')} />
        <meta key="og:description" property="og:description" content={t('blogIndex.metaDescription')} />
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:url" property="og:url" content="https://dynopay.com/blog" />
        <link key="canonical" rel="canonical" href="https://dynopay.com/blog" />
      </Head>

      {/* HomeHeader is rendered by HomeLayout */}

      <PublicPageHero
        testId="blog-hero"
        compact
        eyebrow={t('blogIndex.eyebrow')}
        title={
          <>
            {t('blogIndex.heroTitleLead')} <AuroraInk>{t('blogIndex.heroTitleAccent')}</AuroraInk>
          </>
        }
        body={t('blogSubtitle')}
      />

      <Section testId="blog-index" sx={{ pt: { xs: 2, md: 3 }, minHeight: "60vh" }}>
        {/* Category filter — clickable chips (QA PUB-007 #2) */}
        <Box
          data-testid="blog-category-filters"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.25,
            mb: isMobile ? 4 : 6,
          }}
        >
          {[null, ...categories].map((cat) => {
            const label = cat === null ? t("blogIndex.allCategories", { defaultValue: "All" }) : cat;
            const isActive = selectedCategory === cat;
            const chipColor = cat ? categoryColors[cat] || brandFg(isDark) : brandFg(isDark);
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
                  py: 0.75,
                  borderRadius: "999px",
                  fontFamily: "var(--font-tech), monospace",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: isActive ? "#fff" : chipColor,
                  bgcolor: isActive ? chipColor : `${chipColor}15`,
                  border: `1px solid ${isActive ? chipColor : `${chipColor}30`}`,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: isActive ? chipColor : `${chipColor}25`,
                  },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>

        {/* Blog grid */}
        <Stagger step={0.06} component="div" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: 3 } }}>
          {visiblePosts.map((post, pi) => {
            const catColor = categoryColors[post.category] || brandFg(isDark);
            return (
              <StaggerItem key={post.slug} i={pi} y={18}>
                <Box
                  data-testid={`blog-card-${post.slug}`}
                  onClick={() => router.push(`/blog/${post.slug}`)}
                  sx={{
                    ...cardSx(s),
                    cursor: "pointer",
                    p: isMobile ? 2.5 : 3.5,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    "&:hover img": { transform: "scale(1.03)" },
                  }}
                >
                  {/* Cover — same branded card that renders when the post is shared */}
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
                      sx={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.5s ease",
                      }}
                    />
                  </Box>

                  {/* Category + Read time */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box
                      component="span"
                      role="button"
                      tabIndex={0}
                      data-testid={`blog-card-category-${post.slug}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory(post.category);
                      }}
                      sx={{
                        px: 1.5,
                        py: 0.4,
                        borderRadius: "8px",
                        bgcolor: `${catColor}15`,
                        border: `1px solid ${catColor}30`,
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                        "&:hover": { bgcolor: `${catColor}25` },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "11px",
                          fontFamily: "var(--font-tech), monospace",
                          fontWeight: 500,
                          color: catColor,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {post.category}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {post.readTime}
                    </Typography>
                  </Box>

                  {/* Title */}
                  <Typography
                    sx={{
                      fontSize: isMobile ? "18px" : "22px",
                      fontFamily: "var(--font-hero), var(--font-sans)",
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      lineHeight: 1.3,
                      mb: 1.5,
                    }}
                  >
                    {post.title}
                  </Typography>

                  {/* Excerpt */}
                  <Typography
                    sx={{
                      fontSize: isMobile ? "13px" : "14px",
                      fontFamily: "var(--font-sans)",
                      color: theme.palette.text.secondary,
                      lineHeight: 1.6,
                      mb: 3,
                      flex: 1,
                    }}
                  >
                    {post.excerpt}
                  </Typography>

                  {/* Footer */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          bgcolor: `${catColor}20`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontFamily: "var(--font-hero), var(--font-sans)",
                          color: catColor,
                        }}
                      >
                        {post.author.name.charAt(0)}
                      </Box>
                      <Box>
                        <Typography
                          sx={{
                            fontSize: "12px",
                            fontFamily: "var(--font-hero), var(--font-sans)",
                            color: theme.palette.text.primary,
                            lineHeight: 1.2,
                          }}
                        >
                          {post.author.name}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "11px",
                            fontFamily: "var(--font-sans)",
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {new Date(post.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "13px",
                        fontFamily: "var(--font-hero), var(--font-sans)",
                        color: brandFg(isDark),
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      {t("readTheGuide")} &rarr;
                    </Typography>
                  </Box>
                </Box>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Section>

      <PublicFinalCta attributionRef="blog_final" />
    </>
  );
};

export default BlogPage;
