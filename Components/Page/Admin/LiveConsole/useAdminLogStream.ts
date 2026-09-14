import { useCallback, useEffect, useRef, useState } from "react";

export interface LogEntry {
  id: number;
  ts: string;
  level: string;
  service: string;
  message: string;
  meta?: string;
}

export interface HealthSnapshot {
  status: string;
  ts: string;
  uptime_seconds: number;
  memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
  node: string;
  pid: number;
  db: string;
  redis: string;
  sse_clients: number;
  console_clients: number;
  level_counts: Record<string, number>;
}

export type ConnState = "connecting" | "live" | "reconnecting" | "offline";

const MAX_LOGS = 2000;
const API_BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

/**
 * Streams the admin log SSE endpoint via fetch() (so the Bearer token rides in
 * the Authorization header — EventSource can't do that). Buffers bursts and
 * flushes to React state at ~5fps, supports pause (buffer without rendering)
 * and auto-reconnect with a fixed backoff.
 */
export function useAdminLogStream(paused: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [pendingCount, setPendingCount] = useState(0);

  const bufRef = useRef<LogEntry[]>([]);
  const syncedLenRef = useRef(0);
  const pausedRef = useRef(paused);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const flushNow = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    syncedLenRef.current = bufRef.current.length;
    setLogs(bufRef.current.slice(-MAX_LOGS));
    setPendingCount(0);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (pausedRef.current) {
      setPendingCount(bufRef.current.length - syncedLenRef.current);
      return;
    }
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flushNow, 200);
  }, [flushNow]);

  const addLogs = useCallback(
    (entries: LogEntry[]) => {
      const buf = bufRef.current;
      for (const e of entries) buf.push(e);
      if (buf.length > MAX_LOGS) {
        const removed = buf.length - MAX_LOGS;
        buf.splice(0, removed);
        syncedLenRef.current = Math.max(0, syncedLenRef.current - removed);
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const handleFrame = useCallback(
    (frame: string) => {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith(":")) return; // heartbeat comment
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
      }
      if (!dataLines.length) return;
      let payload: any;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        return;
      }
      if (event === "log" && payload && typeof payload === "object") {
        addLogs([payload as LogEntry]);
      } else if (event === "backfill" && Array.isArray(payload?.logs)) {
        addLogs(payload.logs as LogEntry[]);
      } else if (event === "health" && payload && typeof payload === "object") {
        setHealth(payload as HealthSnapshot);
      }
    },
    [addLogs]
  );

  const connect = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    const ac = new AbortController();
    abortRef.current = ac;
    setConnState((s) => (s === "offline" || s === "reconnecting" ? "reconnecting" : "connecting"));

    fetch(`${API_BASE}/api/admin/logs/stream`, {
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        setConnState("live");
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
        setConnState("reconnecting");
        retryRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 2500);
      });
  }, [handleFrame]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) flushNow();
  }, [paused, flushNow]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (retryRef.current) clearTimeout(retryRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [connect]);

  const clear = useCallback(() => {
    bufRef.current = [];
    syncedLenRef.current = 0;
    setLogs([]);
    setPendingCount(0);
  }, []);

  const reconnect = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (retryRef.current) clearTimeout(retryRef.current);
    connect();
  }, [connect]);

  return { logs, health, connState, pendingCount, clear, reconnect };
}
