import { GetServerSideProps } from "next";
import { getAllSEOPagesIndex } from "@/utils/seoContent";
import { blogPosts } from "@/utils/blogData";

const SITE_URL = "https://dynopay.com";
const SUPPORTED_LANGS = ["en", "pt", "fr", "es", "de", "nl"];

interface SitemapEntry {
  path: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  lastmod?: string;
  /** Blog content is EN-only — skip the ?lang= hreflang alternates for it. */
  hreflang?: boolean;
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
  { path: "/blog",              changefreq: "weekly",   priority: 0.7 },
  { path: "/about",             changefreq: "monthly",  priority: 0.6 },
  { path: "/press",             changefreq: "yearly",   priority: 0.4 },
  { path: "/system-status",     changefreq: "daily",    priority: 0.6 },
  { path: "/terms-conditions",  changefreq: "yearly",   priority: 0.4 },
  { path: "/privacy-policy",    changefreq: "yearly",   priority: 0.4 },
  { path: "/aml-policy",        changefreq: "yearly",   priority: 0.4 },
];

/** English is the default (bare URL); every other language is served at ?lang=xx. */
const altHref = (loc: string, lang: string): string =>
  lang === "en" ? loc : `${loc}?lang=${lang}`;

function staticEntries(): SitemapEntry[] {
  const seoEntries: SitemapEntry[] = getAllSEOPagesIndex().map((p) => ({
    path: p.urlPath,
    // SEO pages regenerate offline every few weeks — "monthly" fits our cadence.
    changefreq: "monthly",
    priority: 0.7,
  }));
  const blogEntries: SitemapEntry[] = blogPosts.map((p) => ({
    path: `/blog/${p.slug}`,
    changefreq: "monthly",
    priority: 0.6,
    lastmod: p.publishedAt,
    hreflang: false,
  }));
  return [...PUBLIC_PAGES, ...seoEntries, ...blogEntries];
}

/**
 * One <url> per canonical page, with hreflang alternates pointing at the REAL
 * ?lang= variants (+ x-default) so Google can discover and index every
 * localized version. English is self-canonical at the bare URL.
 */
function renderUrl(entry: SitemapEntry, today: string): string {
  const loc = `${SITE_URL}${entry.path}`;
  const lastmod = entry.lastmod || today;
  const includeHreflang = entry.hreflang !== false;
  const hreflangs = includeHreflang
    ? SUPPORTED_LANGS.map(
        (lang) =>
          `    <xhtml:link rel="alternate" hreflang="${lang}" href="${altHref(loc, lang)}" />`
      ).join("\n")
    : "";
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${includeHreflang ? `
${hreflangs}
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />` : ""}
  </url>`;
}

function generateSitemap(entries: SitemapEntry[]): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const urls = entries.map((e) => renderUrl(e, today)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

/**
 * Pull every indexable storefront + live product from the backend (read-only)
 * and turn them into /{handle}/shop and /{handle}/p/{slug} sitemap entries.
 * Fails soft (returns []) so the sitemap always renders the static pages even
 * if the catalog feature is off or the backend is briefly unavailable.
 */
async function fetchStorefrontEntries(): Promise<SitemapEntry[]> {
  const base = (
    process.env.INTERNAL_API_URL ||
    process.env.INTERNAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    ""
  ).replace(/\/+$/, "");
  if (!base) return [];
  try {
    const r = await fetch(`${base}/api/shop-sitemap`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return [];
    const json = await r.json();
    const data = json?.data || {};
    const shops: Array<{ handle: string }> = Array.isArray(data.shops) ? data.shops : [];
    const products: Array<{ handle: string; slug: string; lastmod?: string | null }> =
      Array.isArray(data.products) ? data.products : [];

    const shopEntries: SitemapEntry[] = shops
      .filter((s) => s && s.handle)
      .map((s) => ({ path: `/${s.handle}/shop`, changefreq: "weekly", priority: 0.7 }));

    const productEntries: SitemapEntry[] = products
      .filter((p) => p && p.handle && p.slug)
      .map((p) => ({
        path: `/${p.handle}/p/${p.slug}`,
        changefreq: "weekly",
        priority: 0.6,
        lastmod: p.lastmod || undefined,
      }));

    return [...shopEntries, ...productEntries];
  } catch {
    return [];
  }
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const storefrontEntries = await fetchStorefrontEntries();
  const sitemap = generateSitemap([...staticEntries(), ...storefrontEntries]);

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
