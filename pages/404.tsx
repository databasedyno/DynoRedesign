import React from "react";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import PageUnavailable from "@/Components/Common/PageUnavailable";
import type { NextPageWithLayout } from "@/pages/_app";

/**
 * Custom 404 — rendered for unmatched URLs AND for any page that returns
 * `{ notFound: true }` from getServerSideProps (unpublished creator pages,
 * disabled product storefronts, missing products, etc). Uses the shared,
 * on-brand PageUnavailable screen. `layout = "none"` keeps it free of the
 * merchant app / auth chrome.
 */
const NotFoundPage: NextPageWithLayout = () => {
  const { t } = useTranslation("pageTitles");
  return (
    <>
      <Head>
        <title>{t("notFound_title", { defaultValue: "Page not available · Dynopay" })}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageUnavailable />
    </>
  );
};

NotFoundPage.layout = "none";

export default NotFoundPage;
