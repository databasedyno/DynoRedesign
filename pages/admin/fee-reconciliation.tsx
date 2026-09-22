import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminFeeReconciliation from "@/Components/Page/Admin/FeeReconciliation";

/** /admin/fee-reconciliation — charged network fee vs real on-chain gas, per payout. */
const AdminFeeReconciliationPage = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Fee Reconciliation");
    setPageDescription("Charged network fee vs real on-chain gas");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return <AdminFeeReconciliation />;
};

export default AdminFeeReconciliationPage;
