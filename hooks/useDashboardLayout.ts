import { useCallback, useEffect, useState } from "react";

/**
 * useDashboardLayout — persists the merchant's chosen dashboard layout so the
 * new 2026 command-center can be rolled out safely alongside the classic
 * two-column layout. Backed by localStorage; defaults to the new layout on
 * first visit (matches SSR so there is no hydration mismatch — the effect
 * reconciles from localStorage on mount).
 */
export type DashboardLayout = "v2026" | "classic";

const STORAGE_KEY = "dynopay_dashboard_layout";

export const useDashboardLayout = () => {
  const [layout, setLayoutState] = useState<DashboardLayout>("v2026");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "classic" || raw === "v2026") setLayoutState(raw);
    } catch {
      /* ignore privacy-mode / quota errors */
    }
    setHydrated(true);
  }, []);

  const setLayout = useCallback((next: DashboardLayout) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setLayoutState((prev) => {
      const next = prev === "v2026" ? "classic" : "v2026";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { layout, setLayout, toggle, hydrated };
};

export default useDashboardLayout;
