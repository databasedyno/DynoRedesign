/**
 * Error Monitoring Service
 * ========================
 * Captures errors from all backend sources, deduplicates them,
 * and sends digest emails to admin every 15 minutes.
 * Critical errors (uncaught exceptions, unhandled rejections) trigger immediate alerts.
 *
 * Integration points:
 * - Express global error handler
 * - Email sending catch blocks
 * - Cron job error handlers
 * - process.on('uncaughtException') / process.on('unhandledRejection')
 * - Webhook processing errors
 */

import { raw as envRaw } from "../utils/config";
import crypto from "crypto";
import { cronLogger } from "../utils/loggers";

// Lazy-loaded Redis functions (avoids circular dependency at import time)
let _redisGet: ((key: string) => Promise<any>) | null = null;
let _redisSet: ((key: string, value: any) => Promise<void>) | null = null;
let _redisDel: ((key: string) => Promise<void>) | null = null;

const getRedisClient = async () => {
  if (!_redisGet) {
    const mod = await import("../utils/redisInstance");
    _redisGet = mod.getRedisItem;
    _redisSet = mod.setRedisItem;
    _redisDel = mod.deleteRedisItem;
  }
  return { get: _redisGet!, set: _redisSet!, del: _redisDel! };
};

const REDIS_ERROR_BUFFER_KEY = "dynopay:error-monitor:buffer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ErrorComponent =
  | "email"
  | "cron"
  | "api"
  | "webhook"
  | "database"
  | "redis"
  | "blockchain"
  | "payment"
  | "auth"
  | "system"
  | "uncaught"
  | "unhandled-rejection";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

interface ErrorEntry {
  message: string;
  component: ErrorComponent;
  severity: ErrorSeverity;
  code?: string;
  statusCode?: number;
  responseBody?: string;
  stackTrace?: string;
  requestContext?: string; // e.g. "POST /api/v1/payment/create"
  extraContext?: string;   // additional reproduction info
  timestamp: Date;
  fingerprint: string;
}

interface GroupedError {
  fingerprint: string;
  message: string;
  component: ErrorComponent;
  severity: ErrorSeverity;
  code?: string;
  statusCode?: number;
  responseBody?: string;
  stackTrace?: string;
  requestContext?: string;
  extraContext?: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ─── Configuration ───────────────────────────────────────────────────────────

// Session 74: widened from 15 min → 60 min to stop admin-inbox spam once the
// display_currency schema-drift SQL error was fixed. The digest was firing at
// 4/hr × 24 = 96 emails/day just from repeating errors. 60 min keeps signal
// (still fast enough to notice new prod issues) while capping worst-case at
// 24 emails/day — dial higher if still too noisy.
const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
const MAX_BUFFER_SIZE = 500;                // prevent memory bloat
const MAX_STACK_LENGTH = 1500;              // truncate stack traces
const MAX_RESPONSE_LENGTH = 500;            // truncate response bodies
const MAX_ERRORS_IN_EMAIL = 25;             // max distinct errors per digest

// ─── Error Buffer ────────────────────────────────────────────────────────────

let errorBuffer: ErrorEntry[] = [];
let digestTimer: ReturnType<typeof setInterval> | null = null;
let lastDigestSent: Date | null = null;
let totalErrorsCaptured = 0;
let totalDigestsSent = 0;

// Lazy-loaded mail transporter (avoids circular dependency at import time)
let _mailTransporter: ((opts: { to: string; name: string; subject: string; body: string }) => Promise<unknown>) | null = null;

const getMailTransporter = async () => {
  if (!_mailTransporter) {
    const mod = await import("../utils/mailTransporter");
    _mailTransporter = mod.default;
  }
  return _mailTransporter;
};

// ─── Fingerprinting ──────────────────────────────────────────────────────────

/**
 * Create a stable fingerprint for deduplication.
 * Same error message + component = same fingerprint (regardless of timestamp/context).
 */
const createFingerprint = (message: string, component: string, code?: string): string => {
  // Normalize: strip numbers/IDs that change per occurrence
  const normalized = message
    .replace(/\b[0-9a-f]{8,}\b/gi, "<ID>")   // hex IDs
    .replace(/\b\d{4,}\b/g, "<NUM>")          // long numbers
    .replace(/at .+:\d+:\d+/g, "<STACK>")     // stack locations
    .substring(0, 200);

  return crypto
    .createHash("md5")
    .update(`${component}:${code || ""}:${normalized}`)
    .digest("hex")
    .substring(0, 12);
};

// ─── Error Extraction ────────────────────────────────────────────────────────

/**
 * Safely extract structured details from any error type (Axios, native, etc.)
 */
const extractErrorDetails = (error: unknown): {
  message: string;
  code?: string;
  statusCode?: number;
  responseBody?: string;
  stackTrace?: string;
} => {
  if (!error) return { message: "Unknown error (null/undefined)" };

  if (error instanceof Error) {
    const axiosErr = error as {
      code?: string;
      response?: { status?: number; statusText?: string; data?: unknown };
      config?: { method?: string; url?: string };
    };

    let responseBody: string | undefined;
    if (axiosErr.response?.data) {
      responseBody =
        typeof axiosErr.response.data === "string"
          ? axiosErr.response.data.substring(0, MAX_RESPONSE_LENGTH)
          : JSON.stringify(axiosErr.response.data).substring(0, MAX_RESPONSE_LENGTH);
    }

    return {
      message: error.message,
      code: axiosErr.code,
      statusCode: axiosErr.response?.status,
      responseBody,
      stackTrace: error.stack?.substring(0, MAX_STACK_LENGTH),
    };
  }

  if (typeof error === "string") {
    return { message: error.substring(0, 500) };
  }

  return { message: JSON.stringify(error).substring(0, 500) };
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Capture an error into the monitoring buffer.
 * Call this from any catch block, middleware, or error handler.
 *
 * @param error - The error object (Error, AxiosError, string, etc.)
 * @param component - Where the error originated
 * @param options - Additional context for reproduction
 */

// ─── Immediate-alert de-duplication ──────────────────────────────────────────
// Without this, EVERY high/critical error sends its own real-time email, so a
// burst of the same recurring error (e.g. repeated RPC/payment failures) floods
// the admin inbox. We now send at most ONE immediate alert per unique error
// fingerprint within a cooldown window. The error is still buffered for the
// 15-minute digest, so nothing is lost — duplicates just roll up there.
// Session 74: widened from 1h → 6h per unique fingerprint. Combined with the
// hourly digest above, one recurring error now generates at most:
//   - 1 immediate alert per 6h  (=4/day)
//   - 1 digest entry per hour   (=24/day, if error keeps recurring)
// Down from the pre-fix rate of ~120/day per recurring error class.
const IMMEDIATE_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours per unique fingerprint
const lastImmediateAlertAt = new Map<string, number>();

const shouldSendImmediate = (fingerprint: string): boolean => {
  const now = Date.now();
  const last = lastImmediateAlertAt.get(fingerprint) || 0;
  if (now - last < IMMEDIATE_ALERT_COOLDOWN_MS) return false;
  lastImmediateAlertAt.set(fingerprint, now);
  // Bound memory: prune expired entries once the map grows large
  if (lastImmediateAlertAt.size > 500) {
    for (const [fp, ts] of lastImmediateAlertAt) {
      if (now - ts > IMMEDIATE_ALERT_COOLDOWN_MS) lastImmediateAlertAt.delete(fp);
    }
  }
  return true;
};

export const captureError = (
  error: unknown,
  component: ErrorComponent,
  options: {
    severity?: ErrorSeverity;
    requestContext?: string;
    extraContext?: string;
  } = {}
): void => {
  try {
    const details = extractErrorDetails(error);
    const severity = options.severity || inferSeverity(component, details.statusCode);

    // Consolidated logging — one line per captured error replaces scattered console.log/console.error calls
    const logParts: string[] = [`[${component.toUpperCase()}]`, details.message];
    if (details.code) logParts.push(`code=${details.code}`);
    if (details.statusCode) logParts.push(`status=${details.statusCode}`);
    if (options.extraContext) logParts.push(`ctx=${options.extraContext}`);
    if (details.responseBody) logParts.push(`body=${details.responseBody.substring(0, 200)}`);
    const logLine = logParts.join(" | ");
    if (severity === "critical" || severity === "high") {
      cronLogger.error(`[ErrorMonitor] ${logLine}`);
    } else {
      cronLogger.warn(`[ErrorMonitor] ${logLine}`);
    }

    const entry: ErrorEntry = {
      message: details.message,
      component,
      severity,
      code: details.code,
      statusCode: details.statusCode,
      responseBody: details.responseBody,
      stackTrace: details.stackTrace,
      requestContext: options.requestContext,
      extraContext: options.extraContext,
      timestamp: new Date(),
      fingerprint: createFingerprint(details.message, component, details.code),
    };

    // Add to buffer (capped)
    if (errorBuffer.length < MAX_BUFFER_SIZE) {
      errorBuffer.push(entry);
    }
    totalErrorsCaptured++;

    // Persist buffer to Redis (survives restarts)
    persistBufferToRedis().catch(() => {}); // fire-and-forget

    // Immediate alert for critical or high errors.
    // Guard: if we're currently trying to send an immediate alert and THIS
    // error is from the email layer, do NOT re-enter — otherwise a Brevo
    // outage cascades into an infinite loop (captureError → sendImmediateAlert
    // → mailTransporter → captureError → ...). The error is still buffered
    // for the next 15-min digest.
    if (severity === "critical" || severity === "high") {
      if (immediateAlertInFlight && component === "email") {
        cronLogger.warn(
          `[ErrorMonitor] Suppressing nested email immediate-alert (provider outage suspected) — error buffered for digest`
        );
      } else if (!shouldSendImmediate(entry.fingerprint)) {
        // Same error already alerted within the cooldown window — skip the
        // duplicate real-time email; it still rolls up in the 15-min digest.
        cronLogger.warn(
          `[ErrorMonitor] Immediate alert throttled (duplicate within cooldown) — buffered for digest: ${entry.message.substring(0, 80)}`
        );
      } else {
        sendImmediateAlert(entry).catch((e) => {
          cronLogger.error(`[ErrorMonitor] Failed to send immediate alert: ${(e as Error).message}`);
        });
      }
    }
  } catch (captureErr) {
    // Never let monitoring itself crash the app
    cronLogger.error(`[ErrorMonitor] captureError failed: ${(captureErr as Error).message}`);
  }
};

/**
 * Infer severity from component type and HTTP status.
 *
 * NOTE: For component==='email', we deliberately NEVER escalate to 'high' on
 * 5xx status codes. Upstream mail-provider (Brevo/SMTP) 5xx responses are
 * transient and must not trigger an immediate-alert email — doing so would
 * recursively retry email through the same failing provider.
 * Email failures are always captured at 'medium' so they roll up in the 15-min
 * digest instead of the real-time alert path.
 */
const inferSeverity = (component: ErrorComponent, statusCode?: number): ErrorSeverity => {
  if (component === "uncaught" || component === "unhandled-rejection") return "critical";
  if (component === "email") return "medium"; // MUST be before the generic 5xx escalation
  if (component === "database" || component === "redis") return "high";
  if (statusCode && statusCode >= 500) return "high";
  if (component === "payment" || component === "blockchain") return "high";
  if (component === "cron") return "medium";
  return "low";
};

// ─── Redis Persistence ───────────────────────────────────────────────────────

/**
 * Persist the current error buffer to Redis (survives restarts).
 */
const persistBufferToRedis = async (): Promise<void> => {
  try {
    const redis = await getRedisClient();
    // Serialize entries (Date objects → ISO strings)
    const serialized = errorBuffer.map(e => ({ ...e, timestamp: e.timestamp.toISOString ? (e.timestamp as Date).toISOString() : String(e.timestamp) }));
    await redis.set(REDIS_ERROR_BUFFER_KEY, serialized);
  } catch {
    // Silently fail — Redis might not be connected yet at startup
  }
};

/**
 * Restore error buffer from Redis (called on startup).
 */
const restoreBufferFromRedis = async (): Promise<void> => {
  try {
    const redis = await getRedisClient();
    const stored = await redis.get(REDIS_ERROR_BUFFER_KEY);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      // Deserialize: ISO strings → Date objects
      const restored: ErrorEntry[] = stored.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
      // Merge with any already-buffered errors (avoid duplicates by fingerprint+timestamp)
      const existingFingerprints = new Set(errorBuffer.map(e => e.fingerprint + e.timestamp.toISOString()));
      for (const entry of restored) {
        const key = entry.fingerprint + entry.timestamp.toISOString();
        if (!existingFingerprints.has(key) && errorBuffer.length < MAX_BUFFER_SIZE) {
          errorBuffer.push(entry);
          existingFingerprints.add(key);
        }
      }
      cronLogger.info(`[ErrorMonitor] ♻️ Restored ${restored.length} errors from Redis (total buffer: ${errorBuffer.length})`);
    }
  } catch {
    // Silently fail — Redis might not be available
  }
};

/**
 * Clear Redis error buffer after successful digest send.
 */
const clearRedisBuffer = async (): Promise<void> => {
  try {
    const redis = await getRedisClient();
    await redis.del(REDIS_ERROR_BUFFER_KEY);
  } catch {
    // Silently fail
  }
};

// ─── Digest Logic ────────────────────────────────────────────────────────────

/**
 * Group buffered errors by fingerprint.
 */
const buildDigest = (): GroupedError[] => {
  const groups = new Map<string, GroupedError>();

  for (const entry of errorBuffer) {
    const existing = groups.get(entry.fingerprint);
    if (existing) {
      existing.count++;
      if (entry.timestamp > existing.lastSeen) {
        existing.lastSeen = entry.timestamp;
        // Update with latest context
        if (entry.requestContext) existing.requestContext = entry.requestContext;
        if (entry.extraContext) existing.extraContext = entry.extraContext;
      }
    } else {
      groups.set(entry.fingerprint, {
        fingerprint: entry.fingerprint,
        message: entry.message,
        component: entry.component,
        severity: entry.severity,
        code: entry.code,
        statusCode: entry.statusCode,
        responseBody: entry.responseBody,
        stackTrace: entry.stackTrace,
        requestContext: entry.requestContext,
        extraContext: entry.extraContext,
        count: 1,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
      });
    }
  }

  // Sort by severity (critical first), then count (most frequent first)
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return Array.from(groups.values())
    .sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      return sevDiff !== 0 ? sevDiff : b.count - a.count;
    })
    .slice(0, MAX_ERRORS_IN_EMAIL);
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#6b7280",
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: "🔴 CRITICAL",
  high: "🟠 HIGH",
  medium: "🟡 MEDIUM",
  low: "⚪ LOW",
};

const formatDigestEmail = (errors: GroupedError[], totalRaw: number): string => {
  const criticalCount = errors.filter((e) => e.severity === "critical").length;
  const highCount = errors.filter((e) => e.severity === "high").length;

  const errorRows = errors
    .map((err) => {
      const color = SEVERITY_COLORS[err.severity] || "#6b7280";
      const badge = SEVERITY_BADGES[err.severity] || "⚪";
      const timeRange =
        err.count > 1
          ? `${err.firstSeen.toISOString().replace("T", " ").substring(0, 19)} → ${err.lastSeen.toISOString().replace("T", " ").substring(0, 19)}`
          : err.firstSeen.toISOString().replace("T", " ").substring(0, 19);

      let details = "";
      if (err.code) details += `<strong>Code:</strong> ${err.code}<br/>`;
      if (err.statusCode) details += `<strong>HTTP Status:</strong> ${err.statusCode}<br/>`;
      if (err.requestContext) details += `<strong>Request:</strong> ${escapeHtml(err.requestContext)}<br/>`;
      if (err.responseBody) details += `<strong>Response:</strong> <code>${escapeHtml(err.responseBody)}</code><br/>`;
      if (err.extraContext) details += `<strong>Context:</strong> ${escapeHtml(err.extraContext)}<br/>`;
      if (err.stackTrace) {
        const shortStack = err.stackTrace.split("\n").slice(0, 5).join("\n");
        details += `<strong>Stack:</strong><pre style="font-size:11px;background:#f1f5f9;padding:8px;border-radius:4px;overflow-x:auto;max-width:100%;">${escapeHtml(shortStack)}</pre>`;
      }

      return `
        <tr>
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="margin-bottom:8px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${color};">${badge}</span>
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;color:#374151;background:#f3f4f6;margin-left:4px;">${err.component.toUpperCase()}</span>
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;color:#6b7280;background:#f9fafb;margin-left:4px;">×${err.count}</span>
            </div>
            <div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:6px;word-break:break-word;">${escapeHtml(err.message.substring(0, 300))}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">${timeRange}</div>
            ${details ? `<div style="font-size:13px;color:#4b5563;line-height:1.5;">${details}</div>` : ""}
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Fingerprint: ${err.fingerprint}</div>
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:20px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1034a6 0%,#0d2570 100%);padding:24px 32px;">
            <table width="100%"><tr>
              <td><span style="color:#fff;font-size:20px;font-weight:700;">🚨 Dynopay Error Digest</span></td>
              <td align="right"><span style="color:rgba(255,255,255,0.7);font-size:13px;">${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC</span></td>
            </tr></table>
          </td>
        </tr>
        <!-- Summary Bar -->
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
            <table width="100%"><tr>
              <td style="font-size:14px;color:#374151;">
                <strong>${totalRaw}</strong> total errors | <strong>${errors.length}</strong> unique
                ${criticalCount > 0 ? ` | <span style="color:#dc2626;font-weight:600;">${criticalCount} critical</span>` : ""}
                ${highCount > 0 ? ` | <span style="color:#ea580c;font-weight:600;">${highCount} high</span>` : ""}
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Error List -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${errorRows}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
            Dynopay Error Monitor — Digest sent hourly when errors exist<br/>
            Server: ${envRaw("SERVER_URL") || "unknown"} | PID: ${process.pid}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const formatImmediateAlertEmail = (entry: ErrorEntry): string => {
  const color = SEVERITY_COLORS[entry.severity] || "#dc2626";
  const badge = SEVERITY_BADGES[entry.severity] || "🔴";

  let details = "";
  if (entry.code) details += `<p><strong>Error Code:</strong> ${entry.code}</p>`;
  if (entry.statusCode) details += `<p><strong>HTTP Status:</strong> ${entry.statusCode}</p>`;
  if (entry.requestContext) details += `<p><strong>Request:</strong> ${escapeHtml(entry.requestContext)}</p>`;
  if (entry.responseBody) details += `<p><strong>Response Body:</strong></p><pre style="font-size:12px;background:#f1f5f9;padding:12px;border-radius:4px;overflow-x:auto;">${escapeHtml(entry.responseBody)}</pre>`;
  if (entry.extraContext) details += `<p><strong>Additional Context:</strong> ${escapeHtml(entry.extraContext)}</p>`;
  if (entry.stackTrace) {
    details += `<p><strong>Stack Trace:</strong></p><pre style="font-size:11px;background:#fef2f2;padding:12px;border-radius:4px;overflow-x:auto;color:#991b1b;">${escapeHtml(entry.stackTrace)}</pre>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:20px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:24px 32px;">
            <span style="color:#fff;font-size:20px;font-weight:700;">🔴 CRITICAL ERROR — Dynopay</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:14px;color:#374151;line-height:1.6;">
            <div style="margin-bottom:16px;">
              <span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;color:#fff;background:${color};">${badge}</span>
              <span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:500;color:#374151;background:#f3f4f6;margin-left:4px;">${entry.component.toUpperCase()}</span>
            </div>
            <h2 style="font-size:18px;color:#1f2937;margin:0 0 16px;word-break:break-word;">${escapeHtml(entry.message.substring(0, 500))}</h2>
            <p style="color:#6b7280;font-size:13px;">Occurred at: ${entry.timestamp.toISOString().replace("T", " ").substring(0, 19)} UTC</p>
            ${details}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="font-size:13px;color:#9ca3af;">This alert was sent immediately because it is a <strong>${entry.severity}</strong> severity error. A digest of all recent errors will follow in the next hourly cycle.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#fef2f2;border-top:1px solid #fecaca;font-size:12px;color:#991b1b;text-align:center;">
            Dynopay Error Monitor — Immediate Alert | Server: ${envRaw("SERVER_URL") || "unknown"} | PID: ${process.pid}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

// ─── Email Sending ───────────────────────────────────────────────────────────

const getAdminEmail = (): string | null => {
  return envRaw("ADMIN_EMAIL") || null;
};

/**
 * Send the periodic digest email (called by cron).
 */
export const sendErrorDigest = async (): Promise<void> => {
  if (errorBuffer.length === 0) return;

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    cronLogger.info("[ErrorMonitor] No ADMIN_EMAIL configured, skipping digest");
    errorBuffer = [];
    return;
  }

  try {
    const totalRaw = errorBuffer.length;
    const digest = buildDigest();
    if (digest.length === 0) {
      errorBuffer = [];
      return;
    }

    const criticalCount = digest.filter((e) => e.severity === "critical").length;
    const highCount = digest.filter((e) => e.severity === "high").length;

    let subjectParts: string[] = [];
    if (criticalCount > 0) subjectParts.push(`${criticalCount} critical`);
    if (highCount > 0) subjectParts.push(`${highCount} high`);
    const severitySummary = subjectParts.length > 0 ? ` (${subjectParts.join(", ")})` : "";

    const subject = `🚨 Dynopay Error Digest — ${totalRaw} error${totalRaw !== 1 ? "s" : ""} in last 60 min${severitySummary}`;
    const htmlBody = formatDigestEmail(digest, totalRaw);

    const transporter = await getMailTransporter();
    immediateAlertInFlight = true;
    try {
      await transporter({
        to: adminEmail,
        name: "Dynopay Admin",
        subject,
        body: htmlBody,
      });
    } finally {
      immediateAlertInFlight = false;
    }

    cronLogger.info(`[ErrorMonitor] ✅ Digest sent to ${adminEmail}: ${totalRaw} errors, ${digest.length} unique`);
    lastDigestSent = new Date();
    totalDigestsSent++;

    // Clear buffer after successful send (both in-memory and Redis)
    errorBuffer = [];
    await clearRedisBuffer();
  } catch (sendErr) {
    // Don't capture this in the error monitor (avoid infinite loop)
    cronLogger.error(`[ErrorMonitor] ❌ Failed to send digest: ${(sendErr as Error).message}`);
    // Keep buffer so next cycle can retry, but cap it
    if (errorBuffer.length > MAX_BUFFER_SIZE) {
      errorBuffer = errorBuffer.slice(-MAX_BUFFER_SIZE);
    }
  }
};

/**
 * Re-entrancy guard for sendImmediateAlert.
 *
 * sendImmediateAlert uses mailTransporter, and mailTransporter calls
 * captureError('email', ...) on Brevo failure. Without this guard, a Brevo
 * outage causes infinite recursion: captureError → sendImmediateAlert →
 * mailTransporter → captureError → ...
 *
 * While an immediate alert is in-flight, any additional 'email'-component
 * errors are still recorded in the buffer (for the 15-min digest) but do NOT
 * trigger another immediate-alert attempt.
 */
let immediateAlertInFlight = false;

/**
 * Send immediate alert for critical errors.
 */
const sendImmediateAlert = async (entry: ErrorEntry): Promise<void> => {
  const adminEmail = getAdminEmail();

  // Send to Slack/Discord (non-blocking)
  try {
    const { sendAlert } = await import("./slackAlertService");
    await sendAlert({
      title: `${entry.component.toUpperCase()} Error`,
      message: entry.message.substring(0, 200),
      severity: entry.severity === "critical" ? "critical" : "warning",
      fields: {
        Component: entry.component,
        Severity: entry.severity,
        ...(entry.code ? { Code: entry.code } : {}),
        ...(entry.statusCode ? { "HTTP Status": String(entry.statusCode) } : {}),
        ...(entry.extraContext ? { Context: entry.extraContext } : {}),
      },
    });
  } catch (slackErr) {
    cronLogger.error(`[ErrorMonitor] Slack/Discord alert failed: ${(slackErr as Error).message}`);
  }

  if (!adminEmail) return;

  try {
    const subject = `🔴 CRITICAL: ${entry.component.toUpperCase()} error — ${entry.message.substring(0, 80)}`;
    const htmlBody = formatImmediateAlertEmail(entry);

    const transporter = await getMailTransporter();
    immediateAlertInFlight = true;
    try {
      await transporter({
        to: adminEmail,
        name: "Dynopay Admin",
        subject,
        body: htmlBody,
      });
    } finally {
      immediateAlertInFlight = false;
    }

    cronLogger.info(`[ErrorMonitor] 🔴 Immediate alert sent to ${adminEmail}: ${entry.message.substring(0, 100)}`);
  } catch (sendErr) {
    cronLogger.error(`[ErrorMonitor] ❌ Failed to send immediate alert: ${(sendErr as Error).message}`);
  }
};

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Start the error monitoring digest timer.
 * Call this once during server startup.
 * Restores any buffered errors from Redis (survives restarts).
 */
export const startErrorMonitoring = (): void => {
  if (digestTimer) {
    clearInterval(digestTimer);
  }

  // Restore errors from previous run (Redis-backed buffer)
  restoreBufferFromRedis().then(() => {
    // If there are restored errors, send a digest sooner (2 min delay to let server fully start)
    if (errorBuffer.length > 0) {
      cronLogger.info(`[ErrorMonitor] 📬 Found ${errorBuffer.length} buffered errors from previous run — will send digest in 2 min`);
      setTimeout(() => {
        sendErrorDigest().catch((e) => {
          cronLogger.error(`[ErrorMonitor] Startup digest error: ${(e as Error).message}`);
        });
      }, 2 * 60 * 1000); // 2 minutes — give server time to fully initialize
    }
  }).catch(() => {});

  digestTimer = setInterval(() => {
    sendErrorDigest().catch((e) => {
      cronLogger.error(`[ErrorMonitor] Digest timer error: ${(e as Error).message}`);
    });
  }, DIGEST_INTERVAL_MS);

  cronLogger.info(`[ErrorMonitor] ✅ Started — digest every 60 min to ${getAdminEmail() || "NO EMAIL CONFIGURED"}`);
};

/**
 * Stop monitoring (for graceful shutdown).
 */
export const stopErrorMonitoring = (): void => {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
  }
};

/**
 * Get monitoring stats (for diagnostics endpoint).
 */
export const getMonitoringStats = () => ({
  bufferedErrors: errorBuffer.length,
  totalErrorsCaptured,
  totalDigestsSent,
  lastDigestSent: lastDigestSent?.toISOString() || null,
  adminEmail: getAdminEmail() ? `${getAdminEmail()!.substring(0, 3)}...` : null,
  digestIntervalMs: DIGEST_INTERVAL_MS,
  bufferCapacity: `${errorBuffer.length}/${MAX_BUFFER_SIZE}`,
});

/**
 * Flush buffer and send digest immediately (for admin diagnostics).
 */
export const flushErrorDigest = async (): Promise<{ sent: boolean; errorCount: number; uniqueCount: number }> => {
  const errorCount = errorBuffer.length;
  if (errorCount === 0) {
    return { sent: false, errorCount: 0, uniqueCount: 0 };
  }

  const digest = buildDigest();
  await sendErrorDigest();

  return { sent: true, errorCount, uniqueCount: digest.length };
};
