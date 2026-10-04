import { Request, Response, NextFunction } from "express";
import { apiLogger } from "../utils/loggers";
import { countHit, saveJson, remove as removeDurable, loadAllJson } from "../utils/durableState";

/**
 * Bot & Scanner Protection Middleware
 * 
 * Blocks requests matching known vulnerability scanner patterns (WordPress, phpMyAdmin,
 * CGI probes, etc.) and auto-blocks repeat offender IPs.
 * 
 * Returns 403 immediately without processing, saving server resources and reducing log noise.
 * 
 * Detected in Railway production logs:
 * - WordPress scanner from 169.150.203.202 probing wp-includes, xmlrpc.php, wlwmanifest.xml
 * - These return 404 but waste Express middleware pipeline cycles
 */

// ============================================
// Scanner Pattern Configuration
// ============================================

/** URL patterns that indicate vulnerability scanners / bots */
const SCANNER_PATH_PATTERNS: RegExp[] = [
  // WordPress / WP scanner patterns
  /\/wp-(?:admin|login|includes|content|json)/i,
  /\/wp-[a-z]+\.php/i,
  /\/xmlrpc\.php/i,
  /\/wlwmanifest\.xml/i,
  /\/wp-cron\.php/i,

  // PHP catch-all: This is a Node.js app — NO legitimate .php endpoints exist.
  // Blocks random .php probes (cilus.php, Geforce.php, fetch.php, *default.php, etc.)
  // that bypass the specific WordPress patterns above.
  /\.php(\?|$)/i,

  // PHP/CMS probes (kept for UA-based detection / logging clarity)
  /\/phpmyadmin/i,
  /\/pma\//i,
  /\/administrator/i,
  /\/cgi-bin\//i,
  /\/\.env/,
  /\/\.git/,
  /\/\.htaccess/,
  /\/\.htpasswd/,

  // Secrets / config-file sweeps (seen 2026-09 against /api/pay/creator/<file>):
  // dotfiles + well-known credential/config/build files. This is a Node API — none
  // of these are ever legitimate URL segments.
  /\/\.(?:boto|s3cfg|npmrc|amplifyrc|aws|ssh|dockerenv|bash_history|DS_Store)(?:\/|$)/i,
  /\/(?:credentials|credentials\.(?:json|ini)|auth\.json|secrets?\.(?:json|ya?ml|env))(?:\/|$)/i,
  /\/(?:config|settings|runtime-config|env-config|aws-exports|env)\.(?:js|json|ya?ml|env|txt)(?:\/|$)/i,
  /\/(?:env|phpinfo|dockerfile|database\.sql|docker-compose\.ya?ml|composer\.json|package\.json|sendgrid\.env|twilio\.json)(?:\/|$)/i,
  /\/appsettings(?:\.[a-z]+)?\.json(?:\/|$)/i,
  /\.(?:bak|old|orig|swp|sql|sqlite|sqlite3|pem|key)(?:\/|$)/i,

  // Common CMS paths
  /\/joomla/i,
  /\/drupal/i,
  /\/magento/i,
  /\/typo3/i,

  // Webshell / backdoor probes
  /\/shell\.(php|asp|jsp)/i,
  /\/c99\.php/i,
  /\/r57\.php/i,

  // Path traversal attempts
  /\.\.\//,
  /\/etc\/passwd/,
  /\/proc\/self/,

  // AI agent / MCP probes (automated API discovery)
  /^\/mcp$/i,
  /^\/sse$/i,
  /^\/.well-known\/mcp/i,
];

/** User-Agent patterns that indicate bots/scanners */
const SCANNER_UA_PATTERNS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /gobuster/i,
  /dirbuster/i,
  /wpscan/i,
  /nuclei/i,
  /httpx/i,
  /censys/i,
  /shodan/i,
];

// ============================================
// IP Tracking (in-memory, auto-expires)
// ============================================

interface IPRecord {
  hits: number;
  firstSeen: number;
  blocked: boolean;
}

/** Track scanner hits per IP: Map<ip, { hits, firstSeen, blocked }> */
const ipTracker = new Map<string, IPRecord>();

/** Number of scanner hits in WINDOW before auto-blocking */
const AUTO_BLOCK_THRESHOLD = 5;

/** Time window for counting hits (10 minutes) */
const TRACKING_WINDOW_MS = 10 * 60 * 1000;

/** How long an auto-blocked IP stays blocked (1 hour) */
const BLOCK_DURATION_MS = 60 * 60 * 1000;

/** Cleanup stale entries every 15 minutes */
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipTracker) {
    // Remove entries older than block duration (or tracking window if not blocked)
    const maxAge = record.blocked ? BLOCK_DURATION_MS : TRACKING_WINDOW_MS;
    if (now - record.firstSeen > maxAge) {
      ipTracker.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

// ── Durable blocklist (survives redeploys) ────────────────────────────────────
// The in-memory map is the hot path (zero Redis calls on normal requests). Hit
// counts and the 1h block are ALSO kept in Redis so a container restart does
// not hand every auto-blocked scanner a fresh start. Scanner hits are rare, so
// the one Redis round-trip on that 403 path is negligible.
const BLOCK_KEY_PREFIX = "bot:blocked:";
let blocklistHydrated = false;
let blocklistHydration: Promise<void> | null = null;

/**
 * Load still-active blocks from Redis into memory. Succeeds once; a failed
 * attempt (e.g. Redis not connected yet at import time) is retried on the next
 * call — server.ts invokes this right after connectRedis(), and the middleware
 * re-invokes it on the first request as a safety net.
 */
export const hydrateBlockedIps = (): Promise<void> => {
  if (blocklistHydrated) return Promise.resolve();
  if (!blocklistHydration) {
    blocklistHydration = (async () => {
      const saved = await loadAllJson<{ since: number; hits: number }>(BLOCK_KEY_PREFIX);
      if (saved === null) throw new Error("Redis unavailable");
      const now = Date.now();
      let restored = 0;
      for (const [ip, rec] of Object.entries(saved)) {
        if (now - rec.since >= BLOCK_DURATION_MS || ipTracker.get(ip)?.blocked) continue;
        ipTracker.set(ip, { hits: rec.hits, firstSeen: rec.since, blocked: true });
        restored++;
      }
      blocklistHydrated = true;
      if (restored > 0) apiLogger.info(`[BotProtection] Restored ${restored} auto-blocked IP(s) from Redis`);
    })()
      .catch((err) => {
        apiLogger.warn(`[BotProtection] blocklist hydration failed (will retry): ${(err as Error).message}`);
      })
      .finally(() => {
        blocklistHydration = null;
      });
  }
  return blocklistHydration;
};

// ============================================
// Middleware
// ============================================

/**
 * True for loopback + RFC1918 private + CGNAT/service-mesh (100.64.0.0/10, used
 * by DO App Platform / K8s) + link-local + IPv6 ULA/loopback. These are
 * first-party/internal source IPs and must NEVER be auto-blocked — a shared
 * internal IP getting swept into a scanner block silently 403s legit traffic
 * (this is what made public creator pages 404 in production).
 */
function isInternalIp(ip: string): boolean {
  if (!ip) return false;
  let a = ip.trim().toLowerCase();
  if (a === "localhost" || a === "unknown") return true;
  if (a.startsWith("::ffff:")) a = a.slice(7); // IPv4-mapped IPv6
  if (a === "::1") return true;                // IPv6 loopback
  if (a.startsWith("fe80:")) return true;      // IPv6 link-local
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // IPv6 ULA (fc00::/7)
  const m = a.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o1 = Number(m[1]), o2 = Number(m[2]);
  if (o1 === 127) return true;                          // 127.0.0.0/8 loopback
  if (o1 === 10) return true;                           // 10.0.0.0/8
  if (o1 === 192 && o2 === 168) return true;            // 192.168.0.0/16
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;  // 172.16.0.0/12
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true; // 100.64.0.0/10 CGNAT/mesh
  if (o1 === 169 && o2 === 254) return true;            // 169.254.0.0/16 link-local
  return false;
}

const botProtectionMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const path = req.originalUrl || req.url || "";
  const ua = (req.headers["user-agent"] || "") as string;

  // Skip for internal/health check paths (always allow)
  if (path === "/health" || path === "/api/health" || path.startsWith("/api/docs")) {
    return next();
  }

  // Skip for loopback + private/internal/service-mesh IPs (SSR self-fetch,
  // health checks, container egress). These are NEVER auto-blocked.
  if (isInternalIp(ip)) {
    // Still reject obvious scanner PATHS, but DON'T track/auto-block the IP.
    const pathMatch = SCANNER_PATH_PATTERNS.some(pattern => pattern.test(path));
    if (pathMatch) {
      res.status(403).json({ success: false, message: "Forbidden", statusCode: 403 });
      return;
    }
    return next();
  }

  // Safety net: make sure the Redis blocklist has been loaded (no-op once done).
  if (!blocklistHydrated) await hydrateBlockedIps();

  // Check 1: Is this IP already auto-blocked?
  const ipRecord = ipTracker.get(ip);
  if (ipRecord?.blocked) {
    // Check if block has expired
    if (Date.now() - ipRecord.firstSeen > BLOCK_DURATION_MS) {
      ipTracker.delete(ip); // Unblock
      void removeDurable(BLOCK_KEY_PREFIX + ip);
    } else {
      // Still blocked — silent 403 (don't even log to reduce noise)
      res.status(403).end();
      return;
    }
  }

  // Check 2: Does the URL match known scanner patterns?
  const pathMatch = SCANNER_PATH_PATTERNS.some(pattern => pattern.test(path));

  // Check 3: Does the User-Agent match known scanner tools?
  const uaMatch = SCANNER_UA_PATTERNS.some(pattern => pattern.test(ua));

  if (pathMatch || uaMatch) {
    // Record hit for IP tracking (memory + Redis so the count survives restarts)
    const record = await recordScannerHit(ip);

    // Log once per IP (first hit or when auto-blocked). Blocked probes are
    // expected traffic, not application errors — they are deliberately NOT
    // sent to the error monitor (they were cluttering the admin error digest).
    if (record.hits === 1 || record.hits === AUTO_BLOCK_THRESHOLD) {
      const action = record.blocked ? "🚫 AUTO-BLOCKED" : "⚠️ SCANNER DETECTED";
      apiLogger.warn(
        `${action}: ${req.method} ${path} [${ip}] UA: ${ua.substring(0, 80)} (hits: ${record.hits})`
      );
    }

    res.status(403).json({
      success: false,
      message: "Forbidden",
      statusCode: 403,
    });
    return;
  }

  next();
};

/**
 * Record a scanner hit for an IP and auto-block if threshold exceeded.
 * The hit count comes from Redis when available (shared across restarts and
 * instances); memory is the fallback and always mirrors the decision.
 */
async function recordScannerHit(ip: string): Promise<IPRecord> {
  const now = Date.now();
  const existing = ipTracker.get(ip);
  if (existing?.blocked) {
    existing.hits++;
    return existing;
  }

  const durableHits = await countHit(`bot:hits:${ip}`, Math.ceil(TRACKING_WINDOW_MS / 1000));
  let record: IPRecord;
  if (existing && now - existing.firstSeen <= TRACKING_WINDOW_MS) {
    existing.hits = durableHits ?? existing.hits + 1;
    record = existing;
  } else {
    record = { hits: durableHits ?? 1, firstSeen: now, blocked: false };
    ipTracker.set(ip, record);
  }

  // Auto-block after threshold
  if (record.hits >= AUTO_BLOCK_THRESHOLD && !record.blocked) {
    record.blocked = true;
    record.firstSeen = now; // Reset timer for block duration
    apiLogger.warn(
      `🚫 IP auto-blocked for 1h: ${ip} (${record.hits} scanner hits in ${TRACKING_WINDOW_MS / 60000}min)`
    );
    void saveJson(BLOCK_KEY_PREFIX + ip, { since: now, hits: record.hits }, Math.ceil(BLOCK_DURATION_MS / 1000));
  }
  return record;
}

/**
 * Get current bot protection stats (for admin/diagnostics).
 */
export const getBotProtectionStats = () => {
  let tracked = 0;
  let blocked = 0;
  const blockedIPs: string[] = [];

  for (const [ip, record] of ipTracker) {
    tracked++;
    if (record.blocked) {
      blocked++;
      blockedIPs.push(ip);
    }
  }

  return { tracked, blocked, blockedIPs };
};

export default botProtectionMiddleware;
