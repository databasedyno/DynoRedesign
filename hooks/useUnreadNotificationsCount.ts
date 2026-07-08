/**
 * useUnreadNotificationsCount — small helper that polls the
 * /notifications/unread-count endpoint every 60s so the sidebar badge and
 * mobile-nav badge stay reasonably fresh without hammering the API.
 *
 * The count is company-scoped. If the user has no company selected, we return 0
 * (nothing to badge against).
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";

const POLL_INTERVAL_MS = 60_000;

export function useUnreadNotificationsCount(): number {
  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId,
  );
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchCount = () => {
      const params: Record<string, any> = {};
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      axiosBaseApi
        .get("/notifications/unread-count", { params })
        .then((res) => {
          if (cancelled) return;
          const n = Number(res?.data?.data?.unread_count || 0);
          setCount(Number.isFinite(n) && n >= 0 ? n : 0);
        })
        .catch(() => {
          /* silent — badge just won't refresh */
        });
    };

    fetchCount();
    timer = setInterval(fetchCount, POLL_INTERVAL_MS);

    // Refresh when the tab regains focus (users often check notifications on
    // return from other tabs).
    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedCompanyId]);

  return count;
}
