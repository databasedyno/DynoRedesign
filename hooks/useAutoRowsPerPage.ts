import { useCallback, useEffect, useState } from "react";

/**
 * Page size that fills the viewport (blueprint §8.4 / UX audit S13 "rows-per-page defaults to
 * the viewport"): short laptops 10 · ≥ 900px tall 15 · ≥ 1080px tall 25 · ≥ 1400px tall 50.
 */
export const autoRowsForHeight = (h: number): number => (h >= 1400 ? 50 : h >= 1080 ? 25 : h >= 900 ? 15 : 10);

/** Menu for <RowsPerPageSelector menuItems> — always contains every auto value. */
export const ROWS_PER_PAGE_OPTIONS = [10, 15, 25, 50].map((v) => ({ value: v, label: v }));

const keyOf = (list: string) => `dp_rows_per_page:${list}`;

/**
 * Default rows-per-page from the viewport height; an explicit choice is remembered per list
 * (localStorage). `ready` stays false until mounted so server-paged lists don't fetch twice
 * (once with the SSR fallback, once with the real value).
 */
export default function useAutoRowsPerPage(list: string, fallback = 10) {
  const [rows, setRowsState] = useState(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let next = autoRowsForHeight(window.innerHeight);
    try {
      const saved = Number(window.localStorage.getItem(keyOf(list)));
      if (Number.isFinite(saved) && saved > 0) next = saved;
    } catch {
      /* private mode — fall back to the auto value */
    }
    setRowsState(next);
    setReady(true);
  }, [list]);

  const setRows = useCallback(
    (n: number) => {
      setRowsState(n);
      try {
        window.localStorage.setItem(keyOf(list), String(n));
      } catch {
        /* ignore */
      }
    },
    [list],
  );

  return { rows, setRows, ready };
}
