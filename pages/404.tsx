import React from "react";
import Head from "next/head";
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
  return (
    <>
      <Head>
        <title>Page not available · Dynopay</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageUnavailable />
    </>
  );
};

NotFoundPage.layout = "none";

export default NotFoundPage;
