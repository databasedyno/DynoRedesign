import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminAnalytics from "@/Components/Page/Admin/Analytics";

const AdminAnalyticsPage = ({ setPageName }: pageProps) => {
  useEffect(() => {
    setPageName("Activation & Drop-off");
  }, [setPageName]);

  return <AdminAnalytics />;
};

export default AdminAnalyticsPage;
