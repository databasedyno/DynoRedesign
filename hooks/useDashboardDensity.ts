import { useCallback, useEffect, useState } from "react";

/**
 * useDashboardDensity — persisted "compact" vs "spacious" density preference.
 *
 * Widgets on the dashboard (currently RecentTransactionsWidget, room for
 * more) can pack more rows on screen when merchants set density = "compact".
 * Preference is per-browser (localStorage), matches the existing
 * `dash_wallets_compact` pattern already used by DashboardLeftSection.
 *
 * Storage key: `dashboard_density_mode` — values: "compact" | "spacious".
 */

export type DashboardDensity = "compact" | "spacious";

const STORAGE_KEY = "dashboard_density_mode";
const DEFAULT_DENSITY: DashboardDensity = "spacious";
const EVENT_NAME = "dynopay:dashboard-density-change";

const readInitial = (): DashboardDensity => {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "spacious") return raw;
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  return DEFAULT_DENSITY;
};

export const useDashboardDensity = (): {
  density: DashboardDensity;
  isCompact: boolean;
  setDensity: (next: DashboardDensity) => void;
  toggleDensity: () => void;
} => {
  const [density, setDensityState] = useState<DashboardDensity>(readInitial);

  // Sync across widgets on the same page: any widget that flips the toggle
  // dispatches a window event, all subscribers pick it up. Also handles the
  // native `storage` event so open tabs stay in sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ value: DashboardDensity }>).detail;
      if (detail?.value === "compact" || detail?.value === "spacious") {
        setDensityState(detail.value);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "compact" || e.newValue === "spacious") {
        setDensityState(e.newValue);
      }
    };
    window.addEventListener(EVENT_NAME, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setDensity = useCallback((next: DashboardDensity) => {
    setDensityState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
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

  const toggleDensity = useCallback(() => {
    setDensity(density === "compact" ? "spacious" : "compact");
  }, [density, setDensity]);

  return { density, isCompact: density === "compact", setDensity, toggleDensity };
};

export default useDashboardDensity;
