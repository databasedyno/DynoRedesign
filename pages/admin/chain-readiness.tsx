import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminChainReadiness from "@/Components/Page/Admin/ChainReadiness";

/** /admin/chain-readiness — per-currency end-to-end settlement readiness + gas wallet funding. */
const AdminChainReadinessPage = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Chain Readiness");
    setPageDescription("Can every supported coin be received and settled right now?");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return <AdminChainReadiness />;
};

export default AdminChainReadinessPage;
