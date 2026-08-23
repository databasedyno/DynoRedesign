import { Request, Response, NextFunction } from "express";
import { apiLogger } from "../utils/loggers";
import { captureError } from "../services/errorMonitoringService";

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
}, CLEANUP_INTERVAL_MS);

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

const botProtectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

  // Check 1: Is this IP already auto-blocked?
  const ipRecord = ipTracker.get(ip);
  if (ipRecord?.blocked) {
    // Check if block has expired
    if (Date.now() - ipRecord.firstSeen > BLOCK_DURATION_MS) {
      ipTracker.delete(ip); // Unblock
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
    // Record hit for IP tracking
    recordScannerHit(ip, path, ua);

    // Log once per IP (first hit or when auto-blocked)
    const record = ipTracker.get(ip)!;
    if (record.hits === 1 || record.hits === AUTO_BLOCK_THRESHOLD) {
      const action = record.blocked ? "🚫 AUTO-BLOCKED" : "⚠️ SCANNER DETECTED";
      apiLogger.warn(
        `${action}: ${req.method} ${path} [${ip}] UA: ${ua.substring(0, 80)} (hits: ${record.hits})`
      );
    }

    // Track in error monitoring (low severity)
    if (record.hits <= 2) {
      captureError(new Error(`Scanner probe: ${path}`), "api", {
        severity: "low",
        requestContext: `${req.method} ${path}`,
        extraContext: `IP: ${ip} | UA: ${ua.substring(0, 80)} | Hits: ${record.hits}`,
      });
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
 */
function recordScannerHit(ip: string, path: string, ua: string): void {
  const now = Date.now();
  const existing = ipTracker.get(ip);

  if (existing) {
    // Reset if outside tracking window
    if (now - existing.firstSeen > TRACKING_WINDOW_MS && !existing.blocked) {
      ipTracker.set(ip, { hits: 1, firstSeen: now, blocked: false });
    } else {
      existing.hits++;
      // Auto-block after threshold
      if (existing.hits >= AUTO_BLOCK_THRESHOLD && !existing.blocked) {
        existing.blocked = true;
        existing.firstSeen = now; // Reset timer for block duration
        apiLogger.warn(
          `🚫 IP auto-blocked for 1h: ${ip} (${existing.hits} scanner hits in ${TRACKING_WINDOW_MS / 60000}min)`
        );
      }
    }
  } else {
    ipTracker.set(ip, { hits: 1, firstSeen: now, blocked: false });
  }
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
