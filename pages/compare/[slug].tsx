import React, { memo } from "react";
import type { GetServerSideProps } from "next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getComparisonContent,
  getRelatedPages,
  type SEOPageContent,
  type SEOPageIndexEntry,
} from "@/utils/seoContent";

const SITE_ORIGIN = "https://dynopay.com";

interface Props {
  content: SEOPageContent;
  canonicalUrl: string;
  relatedPages: SEOPageIndexEntry[];
}

/**
 * Competitor "alternative / vs" landing pages at /compare/{slug}
 * (e.g. /compare/coingate, /compare/coinpayments). EN-only, self-canonical.
 * Reuses SEOLandingPage so FAQ + breadcrumb JSON-LD, canonical, OG and the
 * shared design come for free; related links point at the /for/* verticals.
 */
const CompareSEOPage: React.FC<Props> = ({ content, canonicalUrl, relatedPages }) => {
  return (
    <SEOLandingPage content={content} canonicalUrl={canonicalUrl} relatedPages={relatedPages} />
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const slug = String(params?.slug || "");
  const content = getComparisonContent(slug);
  if (!content) {
    return { notFound: true };
  }
  return {
    props: {
      content,
      canonicalUrl: `${SITE_ORIGIN}/compare/${slug}`,
      // Passing "country" selects opposite-kind (vertical) related links so
      // each comparison page cross-links to real /for/* hubs for crawl depth.
      relatedPages: getRelatedPages("country", slug, 3),
    },
  };
};

export default memo(CompareSEOPage);
