import { GetServerSideProps } from "next";
import { getAllSEOPagesIndex } from "@/utils/seoContent";

const SITE_URL = "https://dynopay.com";
const SUPPORTED_LANGS = ["en", "pt", "fr", "es", "de", "nl"];

interface SitemapEntry {
  path: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  lastmod?: string;
}

/**
 * All public, indexable pages.
 * Add new public pages here and they will appear in the sitemap automatically.
 * SEO-driven country + vertical landing pages are appended automatically from
 * the JSON files under /data/seo-pages via getAllSEOPagesIndex().
 */
const PUBLIC_PAGES: SitemapEntry[] = [
  { path: "/",                  changefreq: "weekly",   priority: 1.0 },
  { path: "/fees",              changefreq: "monthly",  priority: 0.8 },
  { path: "/documentation",     changefreq: "monthly",  priority: 0.8 },
  { path: "/system-status",     changefreq: "daily",    priority: 0.6 },
  { path: "/terms-conditions",  changefreq: "yearly",   priority: 0.4 },
  { path: "/privacy-policy",    changefreq: "yearly",   priority: 0.4 },
  { path: "/aml-policy",        changefreq: "yearly",   priority: 0.4 },
];

function buildAllEntries(): SitemapEntry[] {
  const seoEntries: SitemapEntry[] = getAllSEOPagesIndex().map((p) => ({
    path: p.urlPath,
    // SEO pages regenerate offline every few weeks — "monthly" fits our cadence.
    changefreq: "monthly",
    priority: 0.7,
  }));
  return [...PUBLIC_PAGES, ...seoEntries];
}

function generateSitemap(): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const allEntries = buildAllEntries();

  const urls = allEntries.map((entry) => {
    const loc = `${SITE_URL}${entry.path}`;

    // hreflang alternates for each supported language
    const hreflangs = SUPPORTED_LANGS.map(
      (lang) => `      <xhtml:link rel="alternate" hreflang="${lang}" href="${loc}" />`
    ).join("\n");

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
${hreflangs}
      <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const sitemap = generateSitemap();

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(sitemap);
  res.end();

  return { props: {} };
};

// Component is never rendered — getServerSideProps sends the XML response directly
export default function SitemapPage() {
  return null;
}
