import React, { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { pageProps } from "@/utils/types";
import EscrowDetail from "@/Components/Page/Escrow/EscrowDetail";

/** /escrow/[id] — merchant escrow deal detail + role actions. */
const EscrowDealPage = ({ setPageName, setPageDescription }: pageProps) => {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Escrow deal");
    setPageDescription("");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return (
    <>
      <Head>
        <title>Escrow deal · Dynopay</title>
      </Head>
      {id ? <EscrowDetail id={String(id)} /> : null}
    </>
  );
};

export default EscrowDealPage;
