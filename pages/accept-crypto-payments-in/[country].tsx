import React, { memo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getAllCountrySlugs,
  getCountryContent,
  type SEOPageContent,
} from "@/utils/seoContent";

const SITE_ORIGIN = "https://dynopay.com";

interface Props {
  content: SEOPageContent;
  canonicalUrl: string;
}

const CountrySEOPage: React.FC<Props> = ({ content, canonicalUrl }) => {
  return <SEOLandingPage content={content} canonicalUrl={canonicalUrl} />;
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
    },
  };
};

export default memo(CountrySEOPage);
