import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminTransactions from "@/Components/Page/Admin/Transactions";

const AdminTransactionsPage = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Transactions");
  }, [setPageName]);

  return <AdminTransactions />;
};

export default AdminTransactionsPage;
