import React, { useEffect } from "react";
import Head from "next/head";
import { pageProps } from "@/utils/types";
import AdminEscrow from "@/Components/Page/Admin/Escrow";

/** /admin/escrow — super-admin escrow oversight (deals + dispute queue + resolve). */
const AdminEscrowPage = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Escrow");
    setPageDescription("Deals, disputes & settlement");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return (
    <>
      <Head>
        <title>Escrow · Admin · Dynopay</title>
      </Head>
      <AdminEscrow />
    </>
  );
};

export default AdminEscrowPage;
