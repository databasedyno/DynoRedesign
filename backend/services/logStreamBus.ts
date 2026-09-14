/**
 * Log Stream Bus — in-memory, real-time log fan-out for the Admin Live Console.
 *
 * A single winston transport (see utils/loggers.ts) pushes every structured log
 * record here; the admin SSE endpoint (routes/adminLogsRouter.ts) subscribes and
 * streams them to connected admins. A bounded ring buffer keeps the most recent
 * entries so a freshly-opened console backfills instead of starting empty.
 *
 * This module intentionally has NO app-side imports (only Node's `events`) so it
 * can be required by loggers.ts without creating an import cycle.
 */
import { EventEmitter } from "events";

export interface LogEntry {
  id: number;
  ts: string;
  level: string;
  service: string;
  message: string;
  meta?: string;
}

const RING_SIZE = 500;
const buffer: LogEntry[] = [];
let seq = 0;

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export const pushLog = (entry: Omit<LogEntry, "id">): void => {
  seq += 1;
  const full: LogEntry = { id: seq, ...entry };
  buffer.push(full);
  if (buffer.length > RING_SIZE) buffer.splice(0, buffer.length - RING_SIZE);
  emitter.emit("log", full);
};

export const getRecentLogs = (limit = 200): LogEntry[] =>
  buffer.slice(Math.max(0, buffer.length - limit));

export const getKnownServices = (): string[] =>
  Array.from(new Set(buffer.map((b) => b.service))).sort();

export const getLevelCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const b of buffer) counts[b.level] = (counts[b.level] || 0) + 1;
  return counts;
};

export const subscribeLogs = (cb: (entry: LogEntry) => void): (() => void) => {
  emitter.on("log", cb);
  return () => {
    emitter.off("log", cb);
  };
};

export default { pushLog, getRecentLogs, getKnownServices, getLevelCounts, subscribeLogs };
