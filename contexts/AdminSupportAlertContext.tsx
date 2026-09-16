import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  useAdminSupportStream,
  SupportEscalationEvent,
} from "@/Components/Page/Admin/SupportInbox/useAdminSupportStream";

interface AdminSupportAlertValue {
  unseen: number;
  markSeen: () => void;
}

const AdminSupportAlertContext = createContext<AdminSupportAlertValue>({
  unseen: 0,
  markSeen: () => {},
});

export const useAdminSupportAlerts = (): AdminSupportAlertValue =>
  useContext(AdminSupportAlertContext);

/**
 * Panel-wide realtime support-escalation alerts for admins. Mounted once in the
 * Admin layout. Fires a toast the moment a visitor clicks "Talk to a human" and
 * keeps an unseen count that the sidebar Support Inbox badge reads. The count
 * clears when the admin opens the Support Inbox.
 */
export const AdminSupportAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const [unseen, setUnseen] = useState(0);

  const onEscalation = useCallback(
    (e: SupportEscalationEvent) => {
      const who = e.contact_email
        ? e.contact_email
        : e.session_id
          ? `Visitor ${String(e.session_id).slice(0, 8)}`
          : "A visitor";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: `${who} asked to talk to a human — new support escalation`,
          severity: "warning",
        },
      });
      if (router.pathname !== "/admin/support") setUnseen((n) => n + 1);
    },
    [dispatch, router.pathname]
  );

  useAdminSupportStream(onEscalation);

  useEffect(() => {
    if (router.pathname === "/admin/support") setUnseen(0);
  }, [router.pathname]);

  const markSeen = useCallback(() => setUnseen(0), []);

  return (
    <AdminSupportAlertContext.Provider value={{ unseen, markSeen }}>
      {children}
    </AdminSupportAlertContext.Provider>
  );
};
