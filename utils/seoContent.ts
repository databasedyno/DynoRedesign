/**
 * SEO landing-page content loader.
 *
 * Reads the JSON files produced offline by `scripts/generate-seo-pages.py`
 * (via Claude Sonnet 4.5 through the Emergent Universal Key) and exposes
 * them to Next.js pages at build time via `getStaticProps` /
 * `getStaticPaths`. No LLM calls at runtime.
 *
 * File layout:
 *   /app/data/seo-pages/countries/{slug}.json
 *   /app/data/seo-pages/verticals/{slug}.json
 */

import fs from "fs";
import path from "path";

export interface SEOFeature {
  title: string;
  description: string;
}

export interface SEOFaq {
  question: string;
  answer: string;
}

export interface SEOPageContent {
  meta_title: string;
  meta_description: string;
  h1: string;
  subheading: string;
  intro_paragraph: string;
  features: SEOFeature[];
  how_it_works: string[];
  faqs: SEOFaq[];
  cta_headline: string;
  cta_body: string;
  _generated_at: string;
  _model: string;
  _kind: "country" | "vertical";
  _slug: string;
  _display_name: string;
  _currency?: string;
  _flag?: string;
}

const DATA_ROOT = path.join(process.cwd(), "data", "seo-pages");
const COUNTRIES_DIR = path.join(DATA_ROOT, "countries");
const VERTICALS_DIR = path.join(DATA_ROOT, "verticals");

function _listSlugs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function _readOne(dir: string, slug: string): SEOPageContent | null {
  const p = path.join(dir, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as SEOPageContent;
  } catch {
    return null;
  }
}

export function getAllCountrySlugs(): string[] {
  return _listSlugs(COUNTRIES_DIR);
}

export function getAllVerticalSlugs(): string[] {
  return _listSlugs(VERTICALS_DIR);
}

export function getCountryContent(slug: string): SEOPageContent | null {
  return _readOne(COUNTRIES_DIR, slug);
}

export function getVerticalContent(slug: string): SEOPageContent | null {
  return _readOne(VERTICALS_DIR, slug);
}

/** Compact record used by the sitemap to list every SEO page. */
export interface SEOPageIndexEntry {
  slug: string;
  displayName: string;
  kind: "country" | "vertical";
  urlPath: string;
}

export function getAllSEOPagesIndex(): SEOPageIndexEntry[] {
  const out: SEOPageIndexEntry[] = [];
  for (const slug of getAllCountrySlugs()) {
    const c = getCountryContent(slug);
    if (c) {
      out.push({
        slug,
        displayName: c._display_name,
        kind: "country",
        urlPath: `/accept-crypto-payments-in/${slug}`,
      });
    }
  }
  for (const slug of getAllVerticalSlugs()) {
    const v = getVerticalContent(slug);
    if (v) {
      out.push({
        slug,
        displayName: v._display_name,
        kind: "vertical",
        urlPath: `/for/${slug}`,
      });
    }
  }
  return out;
}
