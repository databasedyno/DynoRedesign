import React, { useEffect } from "react";
import Head from "next/head";
import { pageProps } from "@/utils/types";
import EscrowDashboard from "@/Components/Page/Escrow/EscrowDashboard";

/**
 * /escrow — merchant Escrow dashboard (list + create). Uses the default
 * "client" app shell (sidebar/header) resolved in _app.tsx.
 */
const EscrowPage = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Escrow");
    setPageDescription("Hold crypto safely until a deal is done");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return (
    <>
      <Head>
        <title>Escrow · Dynopay</title>
      </Head>
      <EscrowDashboard />
    </>
  );
};

export default EscrowPage;
