import React, { memo } from "react";
import type { GetServerSideProps } from "next";
import { useTranslation } from "react-i18next";
import SEOLandingPage from "@/Components/Page/SEO/SEOLandingPage";
import {
  getVerticalContentAllLangs,
  getRelatedPages,
  type SEOPageContent,
  type SEOPageIndexEntry,
} from "@/utils/seoContent";

const SITE_ORIGIN = "https://dynopay.com";

interface Props {
  contents: Record<string, SEOPageContent>;
  canonicalBase: string;
  relatedPages: SEOPageIndexEntry[];
}

const VerticalSEOPage: React.FC<Props> = ({ contents, canonicalBase, relatedPages }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language || "en";
  const content = contents[lang] || contents.en;
  const canonicalUrl = lang !== "en" ? `${canonicalBase}?lang=${lang}` : canonicalBase;
  return (
    <SEOLandingPage
      content={content}
      canonicalUrl={canonicalUrl}
      localeAlternates={canonicalBase}
      relatedPages={relatedPages}
    />
  );
};

// SSR (not SSG) so the ?lang= locale renders server-side with the correct
// <html lang>, self-canonical and hreflang. Public page → CDN-cached via _app.
export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const slug = String(params?.vertical || "");
  const contents = getVerticalContentAllLangs(slug);
  if (!contents) {
    return { notFound: true };
  }
  return {
    props: {
      contents,
      canonicalBase: `${SITE_ORIGIN}/for/${slug}`,
      relatedPages: getRelatedPages("vertical", slug, 3),
    },
  };
};

export default memo(VerticalSEOPage);
