import React, { memo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getAllVerticalSlugs,
  getVerticalContent,
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

const VerticalSEOPage: React.FC<Props> = ({ content, canonicalUrl, relatedPages }) => {
  return (
    <SEOLandingPage
      content={content}
      canonicalUrl={canonicalUrl}
      relatedPages={relatedPages}
    />
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllVerticalSlugs();
  if (slugs.length === 0) {
    // Fail the build loudly — a missing data/seo-pages dir silently shipped
    // zero pages (production 404s) when the Dockerfile omitted COPY data/.
    throw new Error(
      "SEO build error: data/seo-pages/verticals is missing or empty — check Dockerfile COPY data/ ./data/"
    );
  }
  return {
    paths: slugs.map((slug) => ({ params: { vertical: slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = String(params?.vertical || "");
  const content = getVerticalContent(slug);
  if (!content) {
    return { notFound: true };
  }
  return {
    props: {
      content,
      canonicalUrl: `${SITE_ORIGIN}/for/${slug}`,
      relatedPages: getRelatedPages("vertical", slug, 3),
    },
  };
};

export default memo(VerticalSEOPage);
