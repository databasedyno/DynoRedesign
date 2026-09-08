import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import SupportInbox from "@/Components/Page/Admin/SupportInbox";

const AdminSupportPage = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Support Inbox");
  }, [setPageName]);

  return <SupportInbox />;
};

export default AdminSupportPage;
