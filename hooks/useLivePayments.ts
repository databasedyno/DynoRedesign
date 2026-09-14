import { useEffect, useMemo, useRef, useState } from "react";
import axiosBaseApi from "@/axiosConfig";

/**
 * useLivePayments — polls the merchant's recent-transactions feed every 20s
 * and returns a deduplicated, chronologically-sorted list of the last N
 * confirmed payments. Newly-arrived transaction IDs are exposed via `newIds`
 * so the UI can flash them (Stripe-style activity strip).
 *
 * Why polling instead of SSE:
 *   The backend SSE endpoint `/api/events/stream` is auth-only via
 *   `Authorization: Bearer <token>` — but browser EventSource cannot send
 *   custom headers. Rather than degrade auth (token in query string), we
 *   poll the existing cache-friendly `/api/dashboard/recent-transactions`
 *   endpoint (60s Redis TTL) at 20s cadence. The endpoint returns instantly
 *   from cache so this is effectively free.
 *
 * The hook is idempotent: mounting/unmounting cleanly cancels timers, and
 * calls are aborted on unmount.
 */

export type LivePaymentItem = {
  transaction_id: string;
  id?: number | string;
  base_amount?: number;
  base_currency?: string; // ISO fiat code like "USD"
  crypto_currency?: string | null; // "BTC", "USDT", "USDC-TRC20"...
  status?: string;
  createdAt?: string;
  customer_name?: string | null;
  source?: string | null; // "payment_link" | "checkout" | "legacy_api"
};

const CONFIRMED_STATUSES = new Set([
  "successful",
  "success",
  "confirmed",
  "completed",
  "settled",
  "paid",
  "done",
]);

interface Options {
  limit?: number;
  intervalMs?: number;
  paused?: boolean; // pause polling (e.g. when tab hidden)
}

export function useLivePayments(opts: Options = {}) {
  const { limit = 10, intervalMs = 20000, paused = false } = opts;
  const [items, setItems] = useState<LivePaymentItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);
  const firstFetchRef = useRef<boolean>(true);

  const fetchOnce = useMemo(
    () =>
      async function fetchOnce() {
        try {
          const r = await axiosBaseApi.get(
            `/dashboard/recent-transactions?limit=${limit}`,
          );
          if (!mountedRef.current) return;
          const rows: LivePaymentItem[] =
            (r?.data?.data?.transactions as LivePaymentItem[]) ||
            (r?.data?.transactions as LivePaymentItem[]) ||
            [];

          // Keep only confirmed payments — the live feed is for "closed money",
          // pending / awaiting_confirmation items belong to the Pending row.
          const confirmed = rows.filter((row) => {
            const s = String(row?.status || "").toLowerCase();
            return CONFIRMED_STATUSES.has(s);
          });

          // Sort newest first (backend already does this but guard)
          confirmed.sort((a, b) => {
            const at = new Date(a.createdAt || 0).getTime();
            const bt = new Date(b.createdAt || 0).getTime();
            return bt - at;
          });

          const trimmed = confirmed.slice(0, limit);

          // Identify NEW transactions since last poll (skip on first fetch —
          // we don't want to flash every historical item on initial load).
          const seen = seenIdsRef.current;
          const arrivedNow = new Set<string>();
          if (!firstFetchRef.current) {
            for (const row of trimmed) {
              const id = String(row.transaction_id);
              if (!seen.has(id)) arrivedNow.add(id);
            }
          }
          for (const row of trimmed) {
            seenIdsRef.current.add(String(row.transaction_id));
          }
          firstFetchRef.current = false;

          setItems(trimmed);
          setNewIds(arrivedNow);
          setError(null);
          setLoading(false);

          // Clear the newIds flash after 3.5s so animations settle
          if (arrivedNow.size > 0) {
            setTimeout(() => {
              if (!mountedRef.current) return;
              setNewIds(new Set());
            }, 3500);
          }
        } catch (e: any) {
          if (!mountedRef.current) return;
          setError(e?.message || "Failed to load live payments");
          setLoading(false);
        }
      },
    [limit],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (paused) return;

    // Kick off initial fetch immediately
    fetchOnce();

    // Then re-poll on interval
    const tick = () => {
      if (!mountedRef.current) return;
      fetchOnce();
      timerRef.current = setTimeout(tick, intervalMs);
    };
    timerRef.current = setTimeout(tick, intervalMs);

    // Also refresh when tab regains focus (people love checking their business)
    const onVis = () => {
      if (document.visibilityState === "visible") fetchOnce();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchOnce, intervalMs, paused]);

  return { items, newIds, loading, error };
}
