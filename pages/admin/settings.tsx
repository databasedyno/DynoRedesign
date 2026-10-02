import React, { useEffect } from "react";
import { pageProps } from "@/utils/types";
import AdminPlatformSettings from "@/Components/Page/Admin/PlatformSettings";

/** /admin/settings — dashboard-managed platform configuration + kill switches. */
const AdminPlatformSettingsPage = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (!setPageName || !setPageDescription) return;
    setPageName("Platform Settings");
    setPageDescription("Manage fees, limits, risk controls and kill switches — changes apply live.");
    return () => {
      setPageName("");
      setPageDescription("");
    };
  }, [setPageName, setPageDescription]);

  return <AdminPlatformSettings />;
};

export default AdminPlatformSettingsPage;
