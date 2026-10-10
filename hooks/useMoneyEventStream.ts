import { useEffect, useRef } from "react";

const MONEY_EVENTS = new Set(["money_update", "payment_update"]);

/**
 * Listens to the merchant SSE stream (/api/events/stream) and calls `onMoneyEvent`
 * when a payment or brand-currency change lands. Uses fetch streaming because
 * EventSource cannot send the Bearer token. Reconnects with backoff; stops on 401.
 */
export function useMoneyEventStream(onMoneyEvent: () => void, enabled = true) {
  const cbRef = useRef(onMoneyEvent);
  cbRef.current = onMoneyEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof fetch === "undefined") return;
    let stopped = false;
    let ctrl: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

    const connect = async () => {
      const token = localStorage.getItem("token");
      if (stopped || !token) return;
      ctrl = new AbortController();
      try {
        const res = await fetch(`${base}/api/events/stream?channels=payments,notifications`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: ctrl.signal,
          cache: "no-store",
        });
        // Expired token: wait ~60s for the axios refresh flow, then retry.
        if (res.status === 401 || res.status === 403) attempt = 5;
        if (!res.ok || !res.body) throw new Error(`sse ${res.status}`);
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() || "";
          for (const frame of frames) {
            const ev = /^event: (.+)$/m.exec(frame)?.[1]?.trim();
            if (ev && MONEY_EVENTS.has(ev)) cbRef.current();
          }
        }
      } catch {
        /* network drop / abort — fall through to reconnect */
      }
      if (stopped) return;
      attempt += 1;
      retryTimer = setTimeout(connect, Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5)));
    };

    void connect();
    return () => {
      stopped = true;
      ctrl?.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled]);
}

export default useMoneyEventStream;
