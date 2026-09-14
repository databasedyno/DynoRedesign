import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminMerchants from "@/Components/Page/Admin/Merchants";

const AdminMerchantsPage = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Merchants");
  }, [setPageName]);

  return <AdminMerchants />;
};

export default AdminMerchantsPage;
