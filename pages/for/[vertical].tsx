import React, { memo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getAllVerticalSlugs,
  getVerticalContent,
  type SEOPageContent,
} from "@/utils/seoContent";

const SITE_ORIGIN = "https://dynopay.com";

interface Props {
  content: SEOPageContent;
  canonicalUrl: string;
}

const VerticalSEOPage: React.FC<Props> = ({ content, canonicalUrl }) => {
  return <SEOLandingPage content={content} canonicalUrl={canonicalUrl} />;
};

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllVerticalSlugs();
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
    },
  };
};

export default memo(VerticalSEOPage);
