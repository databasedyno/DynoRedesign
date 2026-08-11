import React from "react";
import Head from "next/head";
import PageUnavailable from "@/Components/Common/PageUnavailable";

const Error = ({ statusCode }: any) => {
  // One unified, on-brand "page unavailable" screen for every error/404 state.
  // (statusCode is still surfaced via <Head> / HTTP status for correctness & SEO.)
  return (
    <>
      <Head>
        <title>{statusCode === 404 ? "Page not available" : "Something went wrong"} · Dynopay</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageUnavailable />
    </>
  );
};

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

Error.layout = "none";

export default Error;
