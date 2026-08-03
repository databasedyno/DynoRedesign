import { useCallback, useEffect, useState } from "react";

/**
 * useSidebarCollapsed — persisted "expanded" vs "collapsed" state for the
 * left-nav sidebar. Collapsed = icons only (~72px wide) so power users on
 * small laptops get more horizontal room for wide tables (transactions,
 * customers, invoices).
 *
 * Storage key: `sidebar_collapsed` — values: "1" (collapsed) | "0" (expanded).
 * Sibling event channel: `dynopay:sidebar-collapse-change` so the Client
 * layout wrapper and the Sidebar component stay in sync without one
 * needing to pass a prop down through half the tree.
 */

const STORAGE_KEY = "sidebar_collapsed";
const EVENT_NAME = "dynopay:sidebar-collapse-change";

const readInitial = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const useSidebarCollapsed = (): {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
} => {
  const [collapsed, setCollapsedState] = useState<boolean>(readInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ value: boolean }>).detail;
      if (typeof detail?.value === "boolean") setCollapsedState(detail.value);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setCollapsedState(e.newValue === "1");
    };
    window.addEventListener(EVENT_NAME, onEvent as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onEvent as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { value: next } }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return { collapsed, setCollapsed, toggleCollapsed };
};

export default useSidebarCollapsed;
