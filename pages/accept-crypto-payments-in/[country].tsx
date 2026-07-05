import React, { memo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getAllCountrySlugs,
  getCountryContent,
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

const CountrySEOPage: React.FC<Props> = ({ content, canonicalUrl, relatedPages }) => {
  return (
    <SEOLandingPage
      content={content}
      canonicalUrl={canonicalUrl}
      relatedPages={relatedPages}
    />
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllCountrySlugs();
  return {
    paths: slugs.map((slug) => ({ params: { country: slug } })),
    fallback: false, // 8 pages — build them all at build time
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = String(params?.country || "");
  const content = getCountryContent(slug);
  if (!content) {
    return { notFound: true };
  }
  return {
    props: {
      content,
      canonicalUrl: `${SITE_ORIGIN}/accept-crypto-payments-in/${slug}`,
      relatedPages: getRelatedPages("country", slug, 3),
    },
  };
};

export default memo(CountrySEOPage);
