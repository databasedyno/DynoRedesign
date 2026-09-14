import NotificationPage from "@/Components/Page/Notification/NotificationPage";
import { pageProps } from "@/utils/types";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

const Notifications = ({ setPageName, setPageDescription }: pageProps) => {
  const namespaces = ["notifications", "common"];
  const { t } = useTranslation(namespaces);
  const tNotifications = useCallback(
    (key: string) => t(key, { ns: "notifications" }),
    [t],
  );
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tNotifications("notifications"));
      setPageDescription(tNotifications("notificationsDescription"));
    }
  }, [setPageName, setPageDescription, tNotifications]);

  return <>{<NotificationPage />}</>;
};

export default Notifications;
