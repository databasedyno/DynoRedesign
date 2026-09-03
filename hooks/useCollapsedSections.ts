import { useCallback, useState } from "react";

/**
 * Per-device memory of which sidebar groups the merchant folded away.
 * Storage: `sidebar_sections_collapsed` = JSON array of section keys.
 * Default (nothing stored) = every group expanded.
 */
const STORAGE_KEY = "sidebar_sections_collapsed";

const read = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
};

const persist = (next: Set<string>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
  } catch {
    /* storage unavailable — in-memory only */
  }
};

export const useCollapsedSections = () => {
  const [collapsed, setCollapsed] = useState<Set<string>>(read);

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const expand = useCallback((key: string) => {
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      persist(next);
      return next;
    });
  }, []);

  return { isSectionCollapsed: (key: string) => collapsed.has(key), toggle, expand };
};
