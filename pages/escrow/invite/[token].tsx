import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { NextPageWithLayout } from "@/pages/_app";
import EscrowInvite from "@/Components/Page/Escrow/Public/EscrowInvite";

/**
 * /escrow/invite/[token] — PUBLIC counterparty page (no DynoPay account needed).
 * Uses the "none" layout: no app chrome, but still inside the Theme / i18n /
 * Redux providers from _app.tsx.
 */
const EscrowInvitePage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = router.query;
  return (
    <>
      <Head>
        <title>Escrow invitation · Dynopay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      {token ? <EscrowInvite token={String(token)} /> : null}
    </>
  );
};

EscrowInvitePage.layout = "none";

export default EscrowInvitePage;
