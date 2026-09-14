import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminOverview from "@/Components/Page/Admin/Overview";

const AdminHome = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Overview");
  }, [setPageName]);

  return <AdminOverview />;
};

export default AdminHome;
