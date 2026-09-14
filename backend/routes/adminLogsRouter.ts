/**
 * Admin Live Console router — Phase 3.
 *
 * GET /api/admin/logs/stream  (admin) — SSE stream of live backend logs +
 *                                        a periodic system "health pulse".
 * GET /api/admin/logs/health  (admin) — one-shot health snapshot (JSON).
 *
 * Auth is Bearer-token via adminAuthMiddleware. The browser client uses fetch()
 * streaming (not EventSource) so the Authorization header can be sent — see
 * Components/Page/Admin/LiveConsole/useAdminLogStream.ts.
 */
import express from "express";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware";
import {
  getRecentLogs,
  getKnownServices,
  getLevelCounts,
  subscribeLogs,
} from "../services/logStreamBus";
import { getSSEStats } from "../services/sseService";
import sequelize from "../utils/dbInstance";
import { redis } from "../utils/redisInstance";

const adminLogsRouter = express.Router();

// Number of admins currently watching the console (surfaced in the health pulse).
let consoleClients = 0;

// Dependency health (DB + Redis) is comparatively expensive, so refresh it at
// most every DEP_TTL ms and reuse the cached verdict between pulses.
const DEP_TTL = 15000;
let depCache: { db: string; redis: string; at: number } = { db: "unknown", redis: "unknown", at: 0 };

const refreshDeps = async (): Promise<{ db: string; redis: string }> => {
  const now = Date.now();
  if (now - depCache.at < DEP_TTL) return { db: depCache.db, redis: depCache.redis };

  let db = "down";
  try {
    await Promise.race([
      sequelize.authenticate(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    db = "up";
  } catch {
    db = "down";
  }

  let redisStatus = "down";
  try {
    redisStatus = (redis as unknown as { isReady?: boolean })?.isReady ? "up" : "down";
  } catch {
    redisStatus = "down";
  }

  depCache = { db, redis: redisStatus, at: now };
  return { db, redis: redisStatus };
};

const buildHealth = async () => {
  const mem = process.memoryUsage();
  const deps = await refreshDeps();
  const sse = getSSEStats();
  return {
    status: "ok",
    ts: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    memory: {
      rss_mb: Number((mem.rss / 1048576).toFixed(1)),
      heap_used_mb: Number((mem.heapUsed / 1048576).toFixed(1)),
      heap_total_mb: Number((mem.heapTotal / 1048576).toFixed(1)),
    },
    node: process.version,
    pid: process.pid,
    db: deps.db,
    redis: deps.redis,
    sse_clients: sse.total_clients,
    console_clients: consoleClients,
    level_counts: getLevelCounts(),
  };
};

adminLogsRouter.get("/health", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  const health = await buildHealth();
  res.status(200).json({ status: "success", message: "System health", data: health });
});

adminLogsRouter.get("/stream", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  consoleClients += 1;

  const send = (event: string, data: unknown) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* client gone — cleanup handles removal */
    }
  };

  // Handshake + backfill so a fresh console isn't empty.
  send("connected", { services: getKnownServices(), ts: new Date().toISOString() });
  send("backfill", { logs: getRecentLogs(200) });

  const unsubscribe = subscribeLogs((entry) => send("log", entry));

  const pulse = async () => send("health", await buildHealth());
  await pulse();
  const healthTimer = setInterval(pulse, 5000);
  const heartbeat = setInterval(() => {
    try {
      res.write(`:hb\n\n`);
    } catch {
      /* client gone */
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(healthTimer);
    clearInterval(heartbeat);
    unsubscribe();
    consoleClients = Math.max(0, consoleClients - 1);
  };

  req.on("close", cleanup);
});

export default adminLogsRouter;
