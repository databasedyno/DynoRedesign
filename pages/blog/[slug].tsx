import React from "react";
import { Box, Typography, Divider, IconButton, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import Head from "next/head";
import { getBlogPost, blogPosts, getBlogCover } from "@/utils/blogData";
import useIsMobile from "@/hooks/useIsMobile";
import type { GetStaticPaths, GetStaticProps } from "next";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { useTranslation } from "react-i18next";
import { formatDateI18n } from "@/utils/formatDate";
import CodeCopyButton from "@/Components/UI/CodeCopyButton";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, useConsole } from "@/Components/Page/Home/v8/kit";

const CATEGORY_COLORS: Record<string, string> = {
  "Integration Guide": "#5865F2",
  "Business Strategy": "#10B981",
  "Cost Analysis": "#E08A00",
  "Developer Guide": "#C79A00",
};

interface BlogPostPageProps {
  slug: string;
}

const BlogPostPage = ({ slug }: BlogPostPageProps) => {
  const { t } = useTranslation("landing");
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const s = useConsole();
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <Box sx={{ pt: 20, textAlign: "center", minHeight: "100vh" }}>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, color: s.ink }}>
          {t("blogPostNotFound")}
        </Typography>
        <Typography
          onClick={() => router.push("/blog")}
          sx={{ mt: 2, cursor: "pointer", color: s.accent, fontFamily: FONT_BODY, "&:hover": { textDecoration: "underline" } }}
        >
          &larr; Back to blog
        </Typography>
      </Box>
    );
  }

  const catColor = CATEGORY_COLORS[post.category] || s.accent;
  const codeBg = s.dark ? "#1E2030" : "#F1F1EE";
  const linkColor = s.dark ? "#8FA2FF" : "#5865F2";

  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://dynopay.com/blog/${post.slug}`;
  const shareText = `${post.title} — Dynopay Blog`;

  const shareLinks = [
    {
      name: "X (Twitter)",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "LinkedIn",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Facebook",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "WhatsApp",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    },
  ];

  const ShareButtons = () => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontFamily: FONT_MONO, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3, mr: 0.5 }}>
        {t("blogShare", { defaultValue: "Share" })}
      </Typography>
      {shareLinks.map((link) => (
        <Tooltip key={link.name} title={link.name} arrow>
          <IconButton
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{
              width: 36,
              height: 36,
              color: s.ink2,
              border: `1px solid ${s.line}`,
              borderRadius: "10px",
              transition: "color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease",
              "&:hover": { color: s.accent, borderColor: s.accent, bgcolor: s.accentSoft, transform: "translateY(-1px)" },
            }}
          >
            {link.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );

  const inline = (text: string) =>
    sanitizeHtml(
      text
        .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${s.ink};font-weight:700">$1</strong>`)
        .replace(/\[(.*?)\]\((.*?)\)/g, `<a href="$2" style="color:${linkColor};text-decoration:none;font-weight:600">$1</a>`)
        .replace(/`(.*?)`/g, `<code style="background:${codeBg};padding:1px 6px;border-radius:5px;font-size:13px;font-family:var(--font-tech),monospace">$1</code>`)
        .replace(/\\"(.*?)\\"/g, '"$1"'),
    );

  // Lightweight markdown renderer (headings, lists, tables, code, paragraphs).
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let codeKey = 0;
    let inTable = false;
    let tableRows: string[][] = [];
    let tableKey = 0;

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(2);
        elements.push(
          <Box key={`table-${tableKey++}`} sx={{ overflowX: "auto", my: 3, borderRadius: "12px", border: `1px solid ${s.line}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "13px" : "14px", fontFamily: FONT_BODY }}>
              <thead>
                <tr style={{ background: s.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                  {headerRow.map((cell, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: s.ink, borderBottom: `1px solid ${s.line}` }}>
                      {cell.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: "10px 16px", color: s.ink2, borderBottom: `1px solid ${s.line}` }}>
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>,
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inTable) flushTable();
        if (inCodeBlock) {
          elements.push(
            <Box
              key={`code-${codeKey++}`}
              data-testid="blog-code-block"
              sx={{ position: "relative", my: 2.5, borderRadius: "12px", bgcolor: "#0B0B0A", border: "1px solid rgba(255,255,255,0.12)", overflow: "auto" }}
            >
              <CodeCopyButton text={codeLines.join("\n")} />
              <pre style={{ padding: "20px 72px 20px 16px", margin: 0, fontSize: "13.5px", lineHeight: 1.65, color: "#CDD6F4", fontFamily: "var(--font-tech), monospace" }}>
                {codeLines.join("\n")}
              </pre>
            </Box>,
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (line.trim().startsWith("|")) {
        inTable = true;
        const cells = line.split("|").filter((c) => c.trim() !== "");
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (line.trim() === "") continue;

      if (line.startsWith("## ")) {
        elements.push(
          <Typography key={`h2-${i}`} component="h2" sx={{ mt: 5, mb: 2, fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.ink, fontSize: { xs: 22, md: 28 }, lineHeight: 1.2, letterSpacing: "-0.02em", borderLeft: `3px solid ${s.accent}`, pl: 2 }}>
            {line.replace("## ", "")}
          </Typography>,
        );
        continue;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <Typography key={`h3-${i}`} component="h3" sx={{ mt: 4, mb: 1.5, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.ink, fontSize: { xs: 18, md: 22 }, lineHeight: 1.3 }}>
            {line.replace("### ", "")}
          </Typography>,
        );
        continue;
      }

      if (line.startsWith("- ")) {
        const text = line.replace("- ", "");
        elements.push(
          <Box key={`li-${i}`} sx={{ display: "flex", gap: 1.5, mb: 1, pl: 1 }}>
            <Box sx={{ width: 6, height: 6, minWidth: 6, borderRadius: "50%", bgcolor: s.accent, mt: 1.1 }} />
            <Typography sx={{ fontSize: isMobile ? 15 : 16.5, fontFamily: FONT_BODY, color: s.ink2, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: inline(text) }} />
          </Box>,
        );
        continue;
      }

      const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
      if (numberedMatch) {
        elements.push(
          <Box key={`ol-${i}`} sx={{ display: "flex", gap: 1.5, mb: 1, pl: 1 }}>
            <Typography sx={{ fontSize: 15, fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.accent, minWidth: 20 }}>{numberedMatch[1]}.</Typography>
            <Typography sx={{ fontSize: isMobile ? 15 : 16.5, fontFamily: FONT_BODY, color: s.ink2, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: inline(numberedMatch[2]) }} />
          </Box>,
        );
        continue;
      }

      elements.push(
        <Typography key={`p-${i}`} sx={{ fontSize: isMobile ? 15 : 16.5, fontFamily: FONT_BODY, color: s.ink2, lineHeight: 1.8, mb: 2 }} dangerouslySetInnerHTML={{ __html: inline(line) }} />,
      );
    }

    if (inTable) flushTable();
    return elements;
  };

  return (
    <>
      <Head>
        <title>{`${post.title} · Dynopay`}</title>
        <meta name="description" content={post.excerpt} />
        <meta key="og:title" property="og:title" content={post.title} />
        <meta key="og:description" property="og:description" content={post.excerpt} />
        <meta key="og:type" property="og:type" content="article" />
        <meta key="og:url" property="og:url" content={`https://dynopay.com/blog/${post.slug}`} />
        <meta key="og:image" property="og:image" content={`https://dynopay.com/og/blog-${post.slug}.png?v=4`} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta property="og:image:alt" content={post.title} />
        <meta key="twitter:image" name="twitter:image" content={`https://dynopay.com/og/blog-${post.slug}.png?v=4`} />
        <meta key="twitter:title" name="twitter:title" content={post.title} />
        <meta key="twitter:description" name="twitter:description" content={post.excerpt} />
        <meta property="article:published_time" content={post.publishedAt} />
        <link key="canonical" rel="canonical" href={`https://dynopay.com/blog/${post.slug}`} />
        <link rel="preload" as="image" href={getBlogCover(post)} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.title,
              description: post.excerpt,
              datePublished: post.publishedAt,
              dateModified: post.publishedAt,
              author: { "@type": "Organization", name: post.author?.name || "Dynopay", url: "https://dynopay.com" },
              publisher: { "@type": "Organization", name: "Dynopay", logo: { "@type": "ImageObject", url: "https://dynopay.com/favicon-512.png" } },
              image: [`https://dynopay.com/og/blog-${post.slug}.png?v=4`],
              mainEntityOfPage: `https://dynopay.com/blog/${post.slug}`,
            }),
          }}
        />
      </Head>

      <Box data-testid="blog-article-page" sx={{ background: s.canvas }}>
        <Box sx={{ pt: isMobile ? 6 : 9, pb: isMobile ? 6 : 10, px: isMobile ? 2 : 4, width: "100%", maxWidth: 820, mx: "auto" }}>
          <Box
            component="a"
            onClick={() => router.push("/blog")}
            sx={{ cursor: "pointer", fontSize: 14, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.accent, mb: 4, display: "inline-flex", alignItems: "center", gap: 0.5, "& .arr": { transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1)" }, "&:hover .arr": { transform: "translateX(-3px)" } }}
          >
            <span className="arr">&larr;</span> {t("blogBackToBlog", { defaultValue: "Back to blog" })}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
            <Box sx={{ px: 1.25, py: 0.4, borderRadius: "999px", bgcolor: `${catColor}16`, border: `1px solid ${catColor}33` }}>
              <Typography sx={{ fontSize: 10.5, fontFamily: FONT_MONO, fontWeight: 600, color: catColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {post.category}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, fontFamily: FONT_BODY, color: s.ink3 }}>{post.readTime}</Typography>
            <Typography sx={{ fontSize: 12.5, fontFamily: FONT_BODY, color: s.ink3 }}>
              {formatDateI18n(post.publishedAt, { month: "long", day: "numeric", year: "numeric" })}
            </Typography>
          </Box>

          <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: s.ink, fontSize: { xs: 30, md: 46 }, lineHeight: 1.08, letterSpacing: "-0.03em", mb: 2.5 }}>
            {post.title}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: `${catColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontFamily: FONT_DISPLAY, fontWeight: 700, color: catColor }}>
              {post.author.name.charAt(0)}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontFamily: FONT_DISPLAY, fontWeight: 600, color: s.ink, lineHeight: 1.3 }}>{post.author.name}</Typography>
              <Typography sx={{ fontSize: 12.5, fontFamily: FONT_BODY, color: s.ink3 }}>{post.author.role}</Typography>
            </Box>
          </Box>

          <Box sx={{ borderRadius: "20px", overflow: "hidden", aspectRatio: "1200 / 630", mb: 4, bgcolor: "#050720", border: `1px solid ${s.line}`, boxShadow: s.dark ? "0 24px 64px rgba(0,0,0,0.45)" : "0 24px 64px rgba(10,10,10,0.10)" }}>
            <Box component="img" data-testid="blog-post-cover" src={getBlogCover(post)} alt={post.title} width={1200} height={630} decoding="async" sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
          </Box>

          <Box sx={{ mt: 3, mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <ShareButtons />
          </Box>

          <Divider sx={{ mb: 4, borderColor: s.line }} />

          <Box>{renderContent(post.content)}</Box>

          <Divider sx={{ my: 5, borderColor: s.line }} />

          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <ShareButtons />
          </Box>
        </Box>

        <CtaBandV8
          testId="blog-article-cta"
          badge={t("v8.final.badge", { defaultValue: "Live in minutes · no credit card" })}
          title={t("blogReadyCta", { defaultValue: "Ready to accept crypto?" })}
          body={t("blogReadyCtaBody", { defaultValue: "Start accepting crypto payments today — non-custodial, zero chargebacks, and your first payment on us." })}
          primaryLabel={t("v3.hero.primaryCta", { defaultValue: "Start free" })}
          primaryRef="blog_article"
          secondaryLabel={t("documentation", { defaultValue: "Read the docs" })}
          secondaryHref="/documentation"
        />
      </Box>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = blogPosts.map((post) => ({ params: { slug: post.slug } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<BlogPostPageProps> = async ({ params }) => {
  return { props: { slug: params?.slug as string } };
};

export default BlogPostPage;
