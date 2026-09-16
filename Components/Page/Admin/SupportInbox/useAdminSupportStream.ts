import { useCallback, useEffect, useRef } from "react";

export interface SupportEscalationEvent {
  session_id: string;
  contact_email: string | null;
  note: string | null;
  user_id: number | null;
  at: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

/**
 * Streams the admin support-escalation SSE endpoint via fetch() (so the admin
 * Bearer token rides in the Authorization header — EventSource can't do that).
 * Calls `onEscalation` for every live `escalation` event and auto-reconnects.
 * The callback is stored in a ref so changing it never forces a reconnect.
 */
export function useAdminSupportStream(onEscalation: (e: SupportEscalationEvent) => void) {
  const cbRef = useRef(onEscalation);
  cbRef.current = onEscalation;

  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const handleFrame = useCallback((frame: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith(":")) return; // heartbeat comment
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    if (event !== "escalation" || !dataLines.length) return;
    try {
      const payload = JSON.parse(dataLines.join("\n"));
      if (payload && typeof payload === "object") cbRef.current(payload as SupportEscalationEvent);
    } catch {
      /* ignore malformed frame */
    }
  }, []);

  const connect = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) return;
    const ac = new AbortController();
    abortRef.current = ac;

    fetch(`${API_BASE}/api/admin/support/stream`, {
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let streaming = true;
        while (streaming) {
          const { value, done } = await reader.read();
          if (done) {
            streaming = false;
            break;
          }
          text += decoder.decode(value, { stream: true });
          let idx = text.indexOf("\n\n");
          while (idx !== -1) {
            const frame = text.slice(0, idx);
            text = text.slice(idx + 2);
            handleFrame(frame);
            idx = text.indexOf("\n\n");
          }
        }
        throw new Error("stream-ended");
      })
      .catch(() => {
        if (ac.signal.aborted || !mountedRef.current) return;
        retryRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      });
  }, [handleFrame]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);
}
