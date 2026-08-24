/**
 * SSH SOCKS5 Tunnel Manager
 *
 * Manages the lifecycle of an SSH SOCKS5 tunnel used to proxy Binance API
 * requests from US-based deployments.
 *
 * Features:
 *   - Auto-starts the tunnel on init (when configured)
 *   - Periodic health checks via TCP probe to the local SOCKS port
 *   - Auto-reconnect with exponential back-off (30s → 60s → 120s → cap 300s)
 *   - Re-triggers Binance access detection when tunnel is restored
 *   - Graceful shutdown on SIGTERM / SIGINT
 *   - Exposes health diagnostics for admin endpoints
 */

import { raw as envRaw } from "../utils/config";
import { spawn, ChildProcess } from "child_process";
import net from "net";
import { cronLogger } from "../utils/loggers";
import { detectBinanceAccess } from "./binanceService";

// ── Configuration (from environment) ────────────────────────────────────────

const SSH_HOST = envRaw("SSH_TUNNEL_HOST") || "";
const SSH_USER = envRaw("SSH_TUNNEL_USER") || "root";
const SSH_PASS = envRaw("SSH_TUNNEL_PASS") || "";
const SSH_PORT = parseInt(envRaw("SSH_TUNNEL_PORT") || "22", 10);
const LOCAL_PORT = parseInt(envRaw("SSH_TUNNEL_LOCAL_PORT") || "1080", 10);

const HEALTH_CHECK_INTERVAL_MS = 30_000;     // Check every 30 seconds
const BASE_RECONNECT_DELAY_MS  = 30_000;     // Initial back-off
const MAX_RECONNECT_DELAY_MS   = 300_000;    // Cap at 5 minutes
const TCP_PROBE_TIMEOUT_MS     = 5_000;      // Timeout for SOCKS port probe

// ── State ───────────────────────────────────────────────────────────────────

let sshProcess: ChildProcess | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let tunnelUp = false;
let lastHealthCheck: Date | null = null;
let startCount = 0;
let enabled = false;

// ── Public API ──────────────────────────────────────────────────────────────

export interface TunnelStatus {
  enabled: boolean;
  tunnelUp: boolean;
  localPort: number;
  sshHost: string;
  pid: number | null;
  consecutiveFailures: number;
  startCount: number;
  lastHealthCheck: string | null;
}

/** Start the tunnel manager. No-op if SSH_TUNNEL_HOST is not configured. */
export const startTunnelManager = (): void => {
  if (!SSH_HOST) {
    cronLogger.info("[SSHTunnel] SSH_TUNNEL_HOST not configured — tunnel manager disabled.");
    return;
  }
  if (!SSH_PASS) {
    cronLogger.warn("[SSHTunnel] SSH_TUNNEL_PASS not set — cannot start tunnel.");
    return;
  }

  // Verify sshpass is available before entering the connect/retry loop
  try {
    const { execSync } = require("child_process");
    execSync("which sshpass", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    cronLogger.warn("[SSHTunnel] sshpass not found on PATH — tunnel manager disabled. Install sshpass to enable.");
    return;
  }

  enabled = true;
  cronLogger.info(`[SSHTunnel] Manager starting (host=${SSH_HOST}, localPort=${LOCAL_PORT}).`);

  // Kill any lingering SSH tunnel on the same port (from a previous crash)
  killExistingTunnel();

  // Initial connection
  spawnTunnel();

  // Periodic health check
  healthTimer = setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);

  // Graceful shutdown hooks
  const shutdown = () => stopTunnelManager();
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
};

/** Stop the tunnel and all timers. */
export const stopTunnelManager = (): void => {
  enabled = false;
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  killSshProcess();
  cronLogger.info("[SSHTunnel] Manager stopped.");
};

/** Get current tunnel diagnostics. */
export const getTunnelStatus = (): TunnelStatus => ({
  enabled,
  tunnelUp,
  localPort: LOCAL_PORT,
  sshHost: SSH_HOST || "(not configured)",
  pid: sshProcess?.pid ?? null,
  consecutiveFailures,
  startCount,
  lastHealthCheck: lastHealthCheck?.toISOString() ?? null,
});

// ── Internals ───────────────────────────────────────────────────────────────

/** Spawn the SSH tunnel subprocess via sshpass. */
const spawnTunnel = (): void => {
  if (sshProcess) killSshProcess();

  startCount++;
  cronLogger.info(`[SSHTunnel] Spawning tunnel (attempt #${startCount})...`);

  // sshpass -p <pass> ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60
  //   -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o ConnectTimeout=10
  //   -D <localPort> -N -p <sshPort> <user>@<host>
  //
  // Note: We do NOT use -f (background) because we want Node to own the child
  // process so we can detect when it exits.

  sshProcess = spawn("sshpass", [
    "-p", SSH_PASS,
    "ssh",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=60",
    "-o", "ServerAliveCountMax=3",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ConnectTimeout=10",
    "-D", String(LOCAL_PORT),
    "-N",
    "-p", String(SSH_PORT),
    `${SSH_USER}@${SSH_HOST}`,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  sshProcess.stdout?.on("data", (data: Buffer) => {
    cronLogger.debug(`[SSHTunnel:stdout] ${data.toString().trim()}`);
  });

  sshProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    // SSH prints the banner / warnings to stderr; only log non-empty lines
    if (msg) cronLogger.warn(`[SSHTunnel:stderr] ${msg}`);
  });

  sshProcess.on("exit", (code, signal) => {
    cronLogger.warn(`[SSHTunnel] Process exited (code=${code}, signal=${signal}).`);
    sshProcess = null;
    tunnelUp = false;

    if (enabled) scheduleReconnect();
  });

  sshProcess.on("error", (err) => {
    cronLogger.error(`[SSHTunnel] Spawn error: ${err.message}`);
    sshProcess = null;
    tunnelUp = false;

    if (enabled) scheduleReconnect();
  });

  // Give SSH a moment to bind the port, then verify
  setTimeout(() => probePort().then(ok => {
    if (ok) {
      tunnelUp = true;
      consecutiveFailures = 0;
      cronLogger.info(`[SSHTunnel] Tunnel UP on port ${LOCAL_PORT}.`);
      // Re-trigger Binance proxy detection now that tunnel is available
      detectBinanceAccess().catch(() => {});
    }
  }), 3000);
};

/** Kill the current SSH child process. */
const killSshProcess = (): void => {
  if (!sshProcess) return;
  try {
    sshProcess.kill("SIGTERM");
  } catch {
    // Already dead
  }
  sshProcess = null;
  tunnelUp = false;
};

/** Kill any pre-existing SSH tunnel listening on LOCAL_PORT (from a previous run). */
const killExistingTunnel = (): void => {
  try {
    const { execSync } = require("child_process");
    // Find PIDs listening on the SOCKS port and kill them
    const output = execSync(
      `lsof -ti tcp:${LOCAL_PORT} 2>/dev/null || true`,
      { encoding: "utf-8" }
    ).trim();
    if (output) {
      const pids = output.split("\n").filter(Boolean);
      for (const pid of pids) {
        try { process.kill(parseInt(pid, 10), "SIGTERM"); } catch { /* ignore */ }
      }
      cronLogger.info(`[SSHTunnel] Killed ${pids.length} stale process(es) on port ${LOCAL_PORT}.`);
    }
  } catch {
    // lsof may not be available; not fatal
  }
};

/** TCP probe: can we connect to the SOCKS port? */
const probePort = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(TCP_PROBE_TIMEOUT_MS);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.once("error", ()  => { sock.destroy(); resolve(false); });
    sock.connect(LOCAL_PORT, "127.0.0.1");
  });
};

/** Periodic health check. */
const healthCheck = async (): Promise<void> => {
  if (!enabled) return;
  lastHealthCheck = new Date();

  const ok = await probePort();
  if (ok) {
    if (!tunnelUp) {
      // Tunnel came back (maybe from the bash script or manual restart)
      tunnelUp = true;
      consecutiveFailures = 0;
      cronLogger.info("[SSHTunnel] Health check: tunnel recovered (external).");
      detectBinanceAccess().catch(() => {});
    }
  } else {
    tunnelUp = false;
    consecutiveFailures++;
    cronLogger.warn(`[SSHTunnel] Health check FAILED (consecutive=${consecutiveFailures}).`);

    // If the SSH process is gone, schedule a reconnect
    if (!sshProcess && !reconnectTimeout) {
      scheduleReconnect();
    }
  }
};

/** Schedule a reconnect with exponential back-off. */
const scheduleReconnect = (): void => {
  if (reconnectTimeout) return; // Already scheduled

  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, Math.min(consecutiveFailures - 1, 5)),
    MAX_RECONNECT_DELAY_MS
  );
  cronLogger.info(`[SSHTunnel] Scheduling reconnect in ${(delay / 1000).toFixed(0)}s...`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (enabled) spawnTunnel();
  }, delay);
};
