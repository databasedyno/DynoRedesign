import { useEffect, useRef } from "react";

/**
 * useRefetchOnVisible — run a refetch when the user returns to the tab.
 *
 * Fixes "stale until hard refresh" on screens that fetch once in a mount
 * `useEffect` (admin console, webhook settings, …) and therefore never
 * reload when the tab is re-focused. Listens to BOTH window `focus` and
 * `document.visibilitychange` (tab switch within the same window), throttled
 * so the two events — and rapid focus flaps — never double-fire or hammer the
 * backend. The initial fetch stays the component's own job; this only covers
 * the "came back to the tab" case.
 *
 * SWR screens get the same behaviour from the global <SWRConfig> in _app.tsx
 * (revalidateOnFocus); this hook is the equivalent for manual fetchers.
 */
export function useRefetchOnVisible(
  refetch: () => void,
  options: { throttleMs?: number; enabled?: boolean } = {},
): void {
  const { throttleMs = 5000, enabled = true } = options;
  const cbRef = useRef(refetch);
  cbRef.current = refetch;
  const lastRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRef.current < throttleMs) return;
      lastRef.current = now;
      cbRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, throttleMs]);
}

export default useRefetchOnVisible;
