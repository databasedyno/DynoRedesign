import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminLiveConsole from "@/Components/Page/Admin/LiveConsole";

const AdminLiveConsolePage = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Live Console");
  }, [setPageName]);

  return <AdminLiveConsole />;
};

export default AdminLiveConsolePage;
