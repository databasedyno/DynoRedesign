/**
 * Slack/Discord Alert Service
 * 
 * Sends instant alerts to Slack or Discord webhooks for critical events.
 * Falls back gracefully if webhook URL not configured.
 */
import { raw as envRaw } from "../utils/config";
import axios from "axios";
import { apiLogger } from "../utils/loggers";

const SLACK_WEBHOOK_URL = envRaw("SLACK_WEBHOOK_URL");
const DISCORD_WEBHOOK_URL = envRaw("DISCORD_WEBHOOK_URL");
const ALERT_CHANNEL = envRaw("ALERT_CHANNEL") || "#dynopay-alerts";
const APP_ENV = envRaw("NODE_ENV") || "development";

interface AlertPayload {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  fields?: Record<string, string>;
  error?: Error;
}

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "#2196F3",
  warning: "#FF9800",
  critical: "#F44336",
};

/**
 * Send alert to Slack
 */
const sendSlackAlert = async (payload: AlertPayload): Promise<boolean> => {
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const fields = payload.fields
      ? Object.entries(payload.fields).map(([k, v]) => ({ title: k, value: v, short: true }))
      : [];

    if (payload.error) {
      fields.push({ title: "Error", value: `\`${payload.error.message}\``, short: false });
    }

    await axios.post(SLACK_WEBHOOK_URL, {
      channel: ALERT_CHANNEL,
      username: "Dynopay Alert",
      icon_emoji: SEVERITY_EMOJI[payload.severity] || "ℹ️",
      attachments: [
        {
          color: SEVERITY_COLOR[payload.severity],
          title: `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
          text: payload.message,
          fields,
          footer: `Dynopay | ${APP_ENV}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }, { timeout: 5000 });

    return true;
  } catch (err) {
    apiLogger.error("[SlackAlert] Failed to send:", (err as Error).message);
    return false;
  }
};

/**
 * Send alert to Discord
 */
const sendDiscordAlert = async (payload: AlertPayload): Promise<boolean> => {
  if (!DISCORD_WEBHOOK_URL) return false;

  try {
    const fields = payload.fields
      ? Object.entries(payload.fields).map(([k, v]) => ({ name: k, value: v, inline: true }))
      : [];

    if (payload.error) {
      fields.push({ name: "Error", value: `\`${payload.error.message}\``, inline: false });
    }

    await axios.post(DISCORD_WEBHOOK_URL, {
      username: "Dynopay Alert",
      embeds: [
        {
          title: `${SEVERITY_EMOJI[payload.severity]} ${payload.title}`,
          description: payload.message,
          color: parseInt(SEVERITY_COLOR[payload.severity].replace("#", ""), 16),
          fields,
          footer: { text: `Dynopay | ${APP_ENV}` },
          timestamp: new Date().toISOString(),
        },
      ],
    }, { timeout: 5000 });

    return true;
  } catch (err) {
    apiLogger.error("[DiscordAlert] Failed to send:", (err as Error).message);
    return false;
  }
};

/**
 * Send alert to all configured channels
 */
export const sendAlert = async (payload: AlertPayload): Promise<{ slack: boolean; discord: boolean }> => {
  const [slack, discord] = await Promise.all([
    sendSlackAlert(payload),
    sendDiscordAlert(payload),
  ]);
  return { slack, discord };
};

// ── Convenience Methods ──────────────────────────────────────────────────────

export const alertPaymentFailure = async (txId: string, reason: string, amount?: number): Promise<void> => {
  await sendAlert({
    title: "Payment Failure",
    message: `Payment processing failed`,
    severity: "critical",
    fields: {
      "Transaction ID": txId,
      "Reason": reason,
      ...(amount ? { "Amount": `$${amount}` } : {}),
    },
  });
};

export const alertServiceDown = async (serviceName: string, error?: Error): Promise<void> => {
  await sendAlert({
    title: `Service Down: ${serviceName}`,
    message: `${serviceName} is not responding`,
    severity: "critical",
    fields: { Service: serviceName },
    error,
  });
};

export const alertHighErrorRate = async (errorCount: number, timeWindow: string): Promise<void> => {
  await sendAlert({
    title: "High Error Rate",
    message: `${errorCount} errors detected in the last ${timeWindow}`,
    severity: "warning",
    fields: {
      "Error Count": String(errorCount),
      "Time Window": timeWindow,
    },
  });
};

export const alertSecurityEvent = async (event: string, details: Record<string, string>): Promise<void> => {
  await sendAlert({
    title: `Security: ${event}`,
    message: `Security event detected: ${event}`,
    severity: "critical",
    fields: details,
  });
};

// ── Rate Limiting & Deduplication ────────────────────────────────────────────
const alertHistory = new Map<string, { count: number; firstSeen: number; lastSent: number }>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ALERTS_PER_WINDOW = 3; // max identical alerts per window

/**
 * Generate a dedup key from alert payload
 */
const dedupKey = (payload: AlertPayload): string =>
  `${payload.severity}:${payload.title}:${payload.message}`.substring(0, 200);

/**
 * Check if alert should be suppressed (dedup + rate limit)
 */
const shouldSuppress = (payload: AlertPayload): boolean => {
  const key = dedupKey(payload);
  const now = Date.now();
  const entry = alertHistory.get(key);

  if (!entry || now - entry.firstSeen > DEDUP_WINDOW_MS) {
    alertHistory.set(key, { count: 1, firstSeen: now, lastSent: now });
    return false;
  }

  entry.count++;
  if (entry.count <= MAX_ALERTS_PER_WINDOW) {
    entry.lastSent = now;
    return false;
  }

  return true; // suppress
};

/**
 * Periodically clean stale dedup entries (every 10 min)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of alertHistory) {
    if (now - entry.firstSeen > DEDUP_WINDOW_MS * 2) {
      alertHistory.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Send alert with retry (exponential backoff, max 2 retries)
 */
const sendWithRetry = async (
  fn: (payload: AlertPayload) => Promise<boolean>,
  payload: AlertPayload,
  retries = 2
): Promise<boolean> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await fn(payload);
    if (result) return true;
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return false;
};

/**
 * Send alert to all configured channels (with dedup + retry)
 */
export const sendAlertSafe = async (payload: AlertPayload): Promise<{ slack: boolean; discord: boolean; suppressed: boolean }> => {
  if (shouldSuppress(payload)) {
    apiLogger.warn(`[Alert] Suppressed duplicate: ${payload.title}`);
    return { slack: false, discord: false, suppressed: true };
  }

  const [slack, discord] = await Promise.all([
    sendWithRetry(sendSlackAlert, payload),
    sendWithRetry(sendDiscordAlert, payload),
  ]);
  return { slack, discord, suppressed: false };
};

export const isConfigured = (): { slack: boolean; discord: boolean } => ({
  slack: !!SLACK_WEBHOOK_URL,
  discord: !!DISCORD_WEBHOOK_URL,
});

/**
 * Get alert service health status
 */
export const getHealth = () => ({
  configured: isConfigured(),
  environment: APP_ENV,
  dedup_window_seconds: DEDUP_WINDOW_MS / 1000,
  max_alerts_per_window: MAX_ALERTS_PER_WINDOW,
  active_dedup_entries: alertHistory.size,
  channel: ALERT_CHANNEL,
});

export default {
  sendAlert,
  sendAlertSafe,
  alertPaymentFailure,
  alertServiceDown,
  alertHighErrorRate,
  alertSecurityEvent,
  isConfigured,
  getHealth,
};
