import React from "react";
import { Box, Typography, useTheme, Grid } from "@mui/material";
import { useRouter } from "next/router";
import Head from "next/head";
import { blogPosts } from "@/utils/blogData";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from 'react-i18next';
import {
  AuroraInk,
  Body,
  Eyebrow,
  HeadlineL,
  SectionShell,
} from "@/Components/Page/Home/v3/styled.v3";
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

  return (
    <>
      <Head>
        <title>Blog — Crypto commerce insights · Dynopay</title>
        <meta
          name="description"
          content="Guides and strategies for selling, tipping, and fundraising in crypto — reduce fees, settle to stablecoins, and grow with cryptocurrency payments."
        />
        <meta property="og:title" content="Blog — Crypto commerce insights · Dynopay" />
        <meta
          property="og:description"
          content="Guides, strategies, and insights for merchants accepting cryptocurrency payments."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://dynopay.com/blog" />
      </Head>

      {/* HomeHeader is rendered by HomeLayout */}

      <SectionShell
        sx={{
          pt: isMobile ? 12 : 16,
          pb: isMobile ? 6 : 10,
          px: isMobile ? 2 : 4,
          minHeight: "100vh",
        }}
      >
        {/* Header — v3 typography sweep */}
        <Box sx={{ textAlign: "center", mb: isMobile ? 5 : 8 }}>
          <Eyebrow sx={{ mb: 2, display: "inline-block" }}>Blog</Eyebrow>
          <HeadlineL sx={{ mb: 2 }}>
            Crypto Payment <AuroraInk>Insights</AuroraInk>
          </HeadlineL>
          <Body sx={{ maxWidth: 600, mx: "auto" }}>
            {t('blogSubtitle')}
          </Body>
        </Box>

        {/* Blog grid */}
        <Grid container spacing={isMobile ? 2 : 3}>
          {blogPosts.map((post) => {
            const catColor = categoryColors[post.category] || theme.palette.primary.main;
            return (
              <Grid item xs={12} md={6} key={post.slug}>
                <Box
                  onClick={() => router.push(`/blog/${post.slug}`)}
                  sx={{
                    cursor: "pointer",
                    p: isMobile ? 2.5 : 3.5,
                    borderRadius: "20px",
                    bgcolor: isDark ? "rgba(255,255,255,0.025)" : "#FAFAFA",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: isDark ? "rgba(129,140,248,0.30)" : "rgba(79,70,229,0.18)",
                      boxShadow: isDark
                        ? "0 16px 48px rgba(0,0,0,0.4)"
                        : "0 16px 48px rgba(10,10,10,0.08)",
                    },
                  }}
                >
                  {/* Category + Read time */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.4,
                        borderRadius: "8px",
                        bgcolor: `${catColor}15`,
                        border: `1px solid ${catColor}30`,
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
                        color: theme.palette.primary.main,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      Read more &rarr;
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </SectionShell>
    </>
  );
};

export default BlogPage;
