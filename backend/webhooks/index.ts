import { raw as envRaw } from "../utils/config";
import express from "express";
import { publishCheckoutStatus } from "../services/checkoutStreamService";
import crypto from "crypto";
import { hmacSha256Hex, timingSafeCompare } from "../utils/hmac";
import { verifyFlutterwaveHash } from "../utils/webhookSignature";
import { apiLogger, webhookLogs} from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { getRedisItem, setRedisItem, setRedisTTL, setRedisItemWithTTL } from "../utils/redisInstance";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "../services/pendingPaymentService";
import { QueryTypes } from "sequelize";
import { getCompanyBaseCurrency, convertToFiat } from "../utils/currencyUtils";
import { ADMIN_WALLETS, FEE_WALLETS, isTagBasedChain, getCryptoRedisKey, XRP_MASTER_ADDRESS } from "../services/merchantPool/merchantPoolConfig";
import tatumApi from "../apis/tatumApi";
import { merchantTempAddressModel } from "../models";
import { enqueueWebhook } from "../services/webhookQueue";
import { toRedisStatus, PaymentState } from "../services/paymentStateMachine";
import { isEventSubscribed, isOptInWebhookEvent } from "../services/webhookEvents";
import { resolveWebhookTargets } from "./webhookTargets";
import { assertSafeOutboundUrl } from "../utils/outboundUrlGuard";
import { postWithSafeRedirects } from "../utils/webhookRedirect";
import { toNumber } from "../utils/money";

// Build a set of all admin/fee wallet addresses for fast lookup (lowercase for case-insensitive match)
const INTERNAL_WALLETS = new Set(
  [...Object.values(ADMIN_WALLETS), ...Object.values(FEE_WALLETS)]
    .filter(Boolean)
    .map(addr => addr.toLowerCase())
);

// System-level default webhook signing secret (used when merchant hasn't configured their own)
const DYNOPAY_DEFAULT_WEBHOOK_SECRET = envRaw("DYNOPAY_WEBHOOK_SECRET") || 'dynopay-webhook-default-v1';

// Maximum consecutive 404 failures before auto-disabling a webhook URL
const MAX_CONSECUTIVE_404_FAILURES = 5;
// TTL for the disabled-URL Redis key (24 hours)
const WEBHOOK_DISABLE_TTL_SECONDS = 86400;
// Per-attempt HTTP timeout (ms) for outbound merchant webhook delivery.
// Configurable via env so a slow-but-healthy merchant endpoint doesn't
// spuriously time out (default bumped 15s -> 20s; floor 5s).
const WEBHOOK_DELIVERY_TIMEOUT_MS = Math.max(5000, Number(envRaw("WEBHOOK_DELIVERY_TIMEOUT_MS")) || 20000);

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * @param payload - The webhook payload object
 * @param secret - The webhook secret key
 * @returns Hex-encoded HMAC signature
 */
const generateWebhookSignature = (payload: unknown, secret: string): string => {
  return hmacSha256Hex(payload as string | object, secret);
};

/**
 * Verify webhook signature (for merchants to use on their end)
 * @param payload - The received payload string
 * @param signature - The signature from X-DynoPay-Signature header
 * @param secret - The webhook secret
 * @returns boolean - true if signature is valid
 */
export const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  return timingSafeCompare(signature, hmacSha256Hex(payload, secret), "hex");
};

/**
 * Log webhook delivery to database for history/dashboard
 */
const logWebhookDelivery = async (
  companyId: number,
  webhookUrl: string,
  eventType: string,
  webhookId: string,
  payload: unknown,
  status: 'success' | 'failed',
  responseStatus: number | null,
  responseTimeMs: number,
  errorMessage: string | null,
  retryCount: number
): Promise<void> => {
  try {
    const sequelize = require('../utils/dbInstance').default;
    await sequelize.query(
      `INSERT INTO tbl_webhook_delivery_log 
       (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, error_message, retry_count, created_at, completed_at)
       VALUES (:companyId, :webhookUrl, :eventType, :webhookId, :payload, :status, :responseStatus, :responseTimeMs, :errorMessage, :retryCount, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      {
        replacements: {
          companyId,
          webhookUrl,
          eventType,
          webhookId,
          payload: JSON.stringify(payload),
          status,
          responseStatus,
          responseTimeMs,
          errorMessage,
          retryCount,
        },
        type: QueryTypes.INSERT,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    webhookLogs.error(`[logWebhookDelivery] Failed to log webhook: ${errorMsg}`);
  }
};

/**
 * Call merchant's webhook URL with payment event
 * Merchants can configure webhook_url when creating payment links
 * 
 * Webhook Headers:
 * - Content-Type: application/json
 * - X-DynoPay-Event: payment.pending | payment.confirmed
 * - X-DynoPay-Signature: HMAC-SHA256 signature (only if webhook_secret is configured)
 * - X-DynoPay-Timestamp: Unix timestamp of when webhook was sent
 * 
 * Note: webhook_secret is OPTIONAL. If not configured, X-DynoPay-Signature will not be included.
 */
interface WebhookResult {
  success: boolean;
  error?: string;
  url?: string;
}

const callMerchantWebhook = async (customerData: Record<string, unknown>, eventData: Record<string, unknown>): Promise<WebhookResult> => {
  try {
    const sequelize = require('../utils/dbInstance').default;
    const companyId = customerData?.company_id;
    const eventName = String(eventData?.event || "");

    // Company webhook state. IMPORTANT: webhook_disabled no longer kills ALL
    // delivery — it only SUPPRESSES the company-configured URL (manual pause or
    // circuit breaker). Per-request / payment-link URLs are delivered additively
    // regardless (the core bug fix: a dead company endpoint no longer silences
    // valid per-request webhooks).
    let companyWebhookDisabled = false;
    if (companyId) {
      try {
        const [companyGuard] = await sequelize.query(
          `SELECT webhook_disabled, webhook_events FROM tbl_company WHERE company_id = :cid LIMIT 1`,
          { replacements: { cid: companyId }, type: QueryTypes.SELECT }
        );
        companyWebhookDisabled = companyGuard?.webhook_disabled === true;
        // Tier-1 item #2: opt-in events only reach merchants who subscribed.
        // Legacy (always-on) events pass through untouched.
        if (!isEventSubscribed(companyGuard?.webhook_events, eventName)) {
          webhookLogs.info(`[callMerchantWebhook] ⏭️ Skipping ${eventName} — company_id=${companyId} has not subscribed to it`);
          return { success: true };
        }
      } catch (guardErr) {
        // Non-fatal — if the read fails, proceed with delivery.
        webhookLogs.warn(`[callMerchantWebhook] company webhook state read failed for company_id=${companyId}: ${(guardErr as Error).message}`);
      }
    } else if (isOptInWebhookEvent(eventName)) {
      // Fail closed: an opt-in event with no company cannot be checked.
      webhookLogs.info(`[callMerchantWebhook] ⏭️ Skipping ${eventName} — no company_id to verify subscription`);
      return { success: true };
    }

    // Resolve the ADDITIVE, de-duplicated list of delivery targets.
    const targets = await resolveWebhookTargets(customerData, companyId as (number | string | null), companyWebhookDisabled);

    if (targets.length === 0) {
      webhookLogs.info("[callMerchantWebhook] No webhook/callback URL configured (per-request, payment_link, company or API key), skipping");
      return { success: true }; // No webhook configured is not an error
    }

    // Enrich event data with fiat equivalent in the merchant's preferred currency
    const enrichedEventData = { ...eventData };
    if (eventData.amount && eventData.currency && companyId) {
      try {
        const preferredCurrency = await getCompanyBaseCurrency(companyId as string | number);
        const cryptoAmount = Number(eventData.amount);
        if (cryptoAmount > 0 && preferredCurrency) {
          const fiatResult = await convertToFiat(String(eventData.currency), preferredCurrency, cryptoAmount);
          if (fiatResult.amount > 0) {
            enrichedEventData.base_amount = toNumber(fiatResult.amount, 2);
            enrichedEventData.base_currency = preferredCurrency;
            enrichedEventData.exchange_rate = fiatResult.rate;
          }
        }
      } catch (convErr) {
        // Non-blocking — send webhook without fiat enrichment
        webhookLogs.warn(`[callMerchantWebhook] Fiat enrichment failed:`, convErr);
      }
    }
    // Preserve any base_amount/base_currency already set by the caller
    if (eventData.base_amount) enrichedEventData.base_amount = eventData.base_amount;
    if (eventData.base_currency) enrichedEventData.base_currency = eventData.base_currency;

    // Deliver to every distinct target. A failure on one URL never blocks the others.
    const results: WebhookResult[] = [];
    for (const tgt of targets) {
      // SSRF guard: merchant URLs must resolve to public hosts (blocks metadata,
      // loopback, RFC1918 and *.internal targets). Permanent skip — never retried.
      try {
        await assertSafeOutboundUrl(tgt.url);
      } catch (guardErr) {
        const errorMsg = guardErr instanceof Error ? guardErr.message : String(guardErr);
        webhookLogs.error(`[callMerchantWebhook] ❌ Skipping ${tgt.source} ${tgt.type}: ${errorMsg}`);
        results.push({ success: false, error: errorMsg, url: tgt.url });
        continue;
      }
      webhookLogs.info(`[callMerchantWebhook] → ${tgt.source} ${tgt.type} target: ${tgt.url}`);
      results.push(
        await callUrlWithPayload(tgt.url, enrichedEventData, tgt.secret, companyId ? Number(companyId) : null, tgt.type, tgt.isCompanyUrl)
      );
    }

    // Aggregate. Success if ANY target delivered — this stops the outbox relay
    // from retry-storming (which would double-deliver to the healthy endpoints).
    // If every target failed, surface the first error: a permanent skip
    // (disabled/localhost/unreachable) is left alone by the relay; a transient
    // error triggers a retry of the batch (all failed anyway → no duplicates).
    if (results.some(r => r.success)) return { success: true };
    const firstErr = results.find(r => !r.success);
    return { success: false, error: firstErr?.error || "webhook delivery failed", url: firstErr?.url };

  } catch (error: unknown) {
    // Log but don't throw - webhook failure shouldn't block payment processing
    const errorMsg = error instanceof Error ? error.message : String(error);
    webhookLogs.error(`[callMerchantWebhook] Failed to send webhook: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
};

/**
 * Persist a "your webhook URL redirects" notice for the merchant dashboard and
 * email them ONCE (throttled) so they update their endpoint to the final URL.
 * Only fires for the company-configured URL (not per-link URLs). Best-effort —
 * never throws into the delivery path.
 */
const recordWebhookRedirectNotice = async (
  companyId: number,
  originalUrl: string,
  finalUrl: string,
  status: number,
): Promise<void> => {
  try {
    const noticeKey = `webhook-redirect-notice:${companyId}`;
    const existing = await getRedisItem(noticeKey);
    const isNewTarget = !existing || existing.originalUrl !== originalUrl || existing.finalUrl !== finalUrl;

    // Dashboard banner data — 30-day TTL, refreshed on every redirected delivery.
    await setRedisItemWithTTL(
      noticeKey,
      {
        originalUrl,
        finalUrl,
        status,
        detectedAt: isNewTarget ? new Date().toISOString() : existing.detectedAt,
        lastSeenAt: new Date().toISOString(),
      },
      30 * 24 * 60 * 60,
    );

    if (!isNewTarget) return; // already warned about this exact url -> target

    // Email the merchant once per (url -> target) pair, throttled 7 days.
    const emailKey = `webhook-redirect-email:${companyId}:${crypto.createHash('sha256').update(originalUrl + '|' + finalUrl).digest('hex').substring(0, 24)}`;
    const throttled = await getRedisItem(emailKey);
    if (throttled) return;
    await setRedisItemWithTTL(emailKey, { at: new Date().toISOString() }, 7 * 24 * 60 * 60);

    try {
      const sequelize = require('../utils/dbInstance').default;
      const [ownerRows] = await sequelize.query(
        `SELECT u.name, c.company_name, u.language
           FROM tbl_user u
           JOIN tbl_company c ON c.user_id = u.user_id
          WHERE c.company_id = :cid LIMIT 1`,
        { replacements: { cid: companyId }, type: QueryTypes.SELECT },
      );
      const owner = ownerRows as { name?: string; company_name?: string; language?: string } | undefined;
      const { resolveCompanyRecipients } = await import("../utils/notificationRecipients");
      const recipients = await resolveCompanyRecipients(Number(companyId), "config");
      if (recipients.length > 0) {
        const emailSvc = require('../services/emailService');
        const sendFn = emailSvc.sendWebhookRedirectEmail || emailSvc.default?.sendWebhookRedirectEmail;
        if (typeof sendFn === 'function') {
          for (const r of recipients) {
            await sendFn(
              r.email,
              r.name || owner?.name || 'Merchant',
              owner?.company_name || 'your company',
              originalUrl,
              finalUrl,
              status,
              owner?.language,
            );
          }
          webhookLogs.info(`[callMerchantWebhook] 📧 Sent webhook-redirect notice to ${recipients.length} recipient(s) for company_id=${companyId}`);
        }
      }
    } catch (mailErr) {
      webhookLogs.warn(`[callMerchantWebhook] Failed to send webhook-redirect email: ${(mailErr as Error).message}`);
    }
  } catch (e) {
    webhookLogs.warn(`[recordWebhookRedirectNotice] non-fatal: ${(e as Error).message}`);
  }
};

/**
 * Helper function to call a URL with webhook payload
 */
const callUrlWithPayload = async (
  url: string, 
  eventData: Record<string, unknown>, 
  webhookSecret: string | null, 
  companyId: number | null,
  urlType: 'webhook' | 'callback',
  isCompanyUrl: boolean = false
): Promise<WebhookResult> => {
  try {
    if (!url) return { success: true };

    // BUG-1 FIX: Check if this URL has been auto-disabled due to consecutive 404s
    const disabledKey = `webhook-disabled:${url}`;
    try {
      const disabledEntry = await getRedisItem(disabledKey);
      if (disabledEntry && disabledEntry.disabled) {
        webhookLogs.warn(`[callMerchantWebhook] ⏭️ Skipping ${urlType} to ${url} — auto-disabled after ${disabledEntry.failCount} consecutive 404s (disabled at ${disabledEntry.disabledAt})`);
        return { success: false, error: `URL auto-disabled after ${disabledEntry.failCount} consecutive 404 failures`, url };
      }
    } catch (_e) { /* Redis read failure — proceed to send */ }
    
    // Add metadata to payload
    const timestamp = Math.floor(Date.now() / 1000);
    const webhookPayload = {
      ...eventData,
      webhook_id: crypto.randomUUID(),
      sent_at: new Date().toISOString(),
      created_at: eventData.created_at || new Date().toISOString(), // BUG-C FIX: Always include created_at
    };
    
    // BUG-A FIX: Always send signature header.
    // Use merchant's webhook_secret if configured, otherwise use system default.
    const signingSecret = webhookSecret || DYNOPAY_DEFAULT_WEBHOOK_SECRET;
    const signaturePayload = { ...webhookPayload, timestamp };
    
    // Build headers — signature is ALWAYS included
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-DynoPay-Event': String(eventData.event || ''),
      'X-DynoPay-Timestamp': timestamp.toString(),
      'X-DynoPay-Webhook-Id': String(webhookPayload.webhook_id),
      'X-DynoPay-Type': urlType, // 'webhook' or 'callback'
      'X-DynoPay-Signature': generateWebhookSignature(signaturePayload, signingSecret),
      'User-Agent': 'Dynopay-Webhook/1.0',
    };
    
    webhookLogs.info(`[callMerchantWebhook] Sending ${urlType} ${eventData.event} to ${url}`);
    webhookLogs.info(`[callMerchantWebhook] Signature included: true (${webhookSecret ? 'merchant secret' : 'system default'})`);
    // Log payload for debugging (truncate large payloads)
    const payloadStr = JSON.stringify(webhookPayload);
    webhookLogs.info(`[callMerchantWebhook] Payload (${payloadStr.length} bytes): ${payloadStr.substring(0, 500)}${payloadStr.length > 500 ? '...' : ''}`);
    
    // Send webhook with timeout and retry
    const maxRetries = 3;
    let lastError: Error | null = null;
    let finalResponseStatus: number | null = null;
    let totalRetries = 0;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { response, finalUrl, redirectChain } = await postWithSafeRedirects(url, webhookPayload, headers);

        const responseTimeMs = Date.now() - startTime;
        finalResponseStatus = response.status;
        const wasRedirected = redirectChain.length > 0;

        if (wasRedirected) {
          webhookLogs.warn(`[callMerchantWebhook] ↪️ ${urlType} to ${url} followed ${redirectChain.length} redirect(s) → ${finalUrl}`);
          // Warn the merchant (dashboard banner + one-off email) for their CONFIGURED url only.
          if (isCompanyUrl && companyId) {
            await recordWebhookRedirectNotice(companyId, url, finalUrl, response.status).catch(() => {});
          }
        }

        webhookLogs.info(`[callMerchantWebhook] ✅ ${urlType} sent successfully, status: ${response.status}${wasRedirected ? ` (after redirect → ${finalUrl})` : ""}`);
        
        // BUG-1 FIX: Reset consecutive failure counter in Redis on success
        const failKey = `webhook-404-failures:${url}`;
        try {
          await setRedisItemWithTTL(failKey, { count: 0, resetAt: new Date().toISOString() }, 3600);
        } catch (_e) { /* Non-critical — Redis write failure */ }
        
        // Log successful delivery
        if (companyId) {
          await logWebhookDelivery(
            companyId,
            url,
            String(eventData.event || ''),
            webhookPayload.webhook_id,
            webhookPayload,
            'success',
            response.status,
            responseTimeMs,
            wasRedirected
              ? `Delivered after following redirect → ${finalUrl}. Update your webhook URL to this address to remove the extra hop.`
              : null,
            totalRetries
          );
        }
        
        return { success: true, url }; // Success
        
      } catch (err: unknown) {
        const error = err as { response?: { status?: number; data?: unknown }; message?: string; code?: string };
        lastError = error as Error;
        totalRetries = attempt;
        finalResponseStatus = error.response?.status || null;
        
        // Capture response body for debugging
        const responseBody = error.response?.data;
        const responseBodyStr = responseBody 
          ? (typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody))
          : null;
        
        // Build descriptive error message
        let errorMessage = error.code === 'ECONNREFUSED' 
          ? `Connection refused - server at ${url} is not reachable`
          : error.code === 'ETIMEDOUT'
          ? `Connection timed out - server at ${url} did not respond`
          : error.message || 'Unknown error';
        
        // Permanent redirect problems (SSRF-blocked target, no/invalid Location,
        // redirect loop) are raised by postWithSafeRedirects with noRetry=true —
        // retrying is pointless and would just re-hit the same broken hop.
        if ((error as { noRetry?: boolean }).noRetry) {
          webhookLogs.error(`[callMerchantWebhook] ❌ ${urlType} to ${url} not retrying (redirect problem): ${errorMessage}`);
          break;
        }
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (finalResponseStatus && finalResponseStatus >= 400 && finalResponseStatus < 500 && finalResponseStatus !== 429) {
          webhookLogs.error(`[callMerchantWebhook] ❌ Client error ${finalResponseStatus}, not retrying: ${errorMessage}`);
          if (responseBodyStr) {
            webhookLogs.error(`[callMerchantWebhook] ❌ Response body: ${responseBodyStr.substring(0, 500)}`);
          }
          // BUG-1 FIX: Track consecutive 404 failures in Redis and auto-disable after threshold
          if (finalResponseStatus === 404) {
            try {
              const failKey = `webhook-404-failures:${url}`;
              const existing = await getRedisItem(failKey);
              const prevCount = (existing && typeof existing.count === 'number') ? existing.count : 0;
              const newCount = prevCount + 1;
              await setRedisItemWithTTL(failKey, { count: newCount, lastFailedAt: new Date().toISOString(), url }, 86400);

              if (newCount >= MAX_CONSECUTIVE_404_FAILURES) {
                // Auto-disable this URL (Redis - fast path for concurrent workers)
                const disabledKey = `webhook-disabled:${url}`;
                await setRedisItemWithTTL(disabledKey, {
                  disabled: true,
                  failCount: newCount,
                  disabledAt: new Date().toISOString(),
                  companyId,
                  reason: `${newCount} consecutive 404 responses`,
                }, WEBHOOK_DISABLE_TTL_SECONDS);

                webhookLogs.error(
                  `[callMerchantWebhook] 🚫 AUTO-DISABLED: Webhook URL "${url}" disabled after ${newCount} consecutive 404s. ` +
                  `Company ${companyId} will NOT receive ${urlType} notifications until the URL is fixed. ` +
                  `URL will be re-enabled automatically in 24 hours or when merchant updates their webhook URL.`
                );

                // Session 49: Persist to DB so the guard at the top of
                // callMerchantWebhook picks it up (and dashboard can surface it),
                // then email the merchant so they know their endpoint is broken.
                // SCOPED: only the COMPANY-configured URL trips the company-wide
                // flag. A failing per-request/link URL relies on the per-URL
                // Redis breaker above and must never disable the whole company.
                if (companyId && isCompanyUrl) {
                  try {
                    const sequelize = require('../utils/dbInstance').default;
                    const [existing] = await sequelize.query(
                      `SELECT webhook_disabled FROM tbl_company WHERE company_id = :cid LIMIT 1`,
                      { replacements: { cid: companyId }, type: QueryTypes.SELECT }
                    );
                    if (existing && !existing.webhook_disabled) {
                      const disableReason = `Auto-disabled: ${newCount} consecutive HTTP 404 responses from ${url.substring(0, 200)}`;
                      await sequelize.query(
                        `UPDATE tbl_company
                            SET webhook_disabled = TRUE,
                                webhook_disabled_at = CURRENT_TIMESTAMP,
                                webhook_disabled_reason = :reason
                          WHERE company_id = :cid`,
                        { replacements: { cid: companyId, reason: disableReason } }
                      );
                      webhookLogs.error(`[callMerchantWebhook] 🚨 Set tbl_company.webhook_disabled=TRUE for company_id=${companyId}`);

                      // Send merchant alert email (best-effort, non-blocking).
                      // Routed through the central recipient resolver (0018): the
                      // company notification address + any active team member
                      // holding manage_company_settings, de-duplicated case-
                      // insensitively (a solo merchant still gets exactly one email).
                      try {
                        const [ownerRows] = await sequelize.query(
                          `SELECT u.name, c.company_name, u.language
                             FROM tbl_user u
                             JOIN tbl_company c ON c.user_id = u.user_id
                            WHERE c.company_id = :cid LIMIT 1`,
                          { replacements: { cid: companyId }, type: QueryTypes.SELECT }
                        );
                        const owner = ownerRows as { name?: string; company_name?: string; language?: string } | undefined;
                        const { resolveCompanyRecipients } = await import("../utils/notificationRecipients");
                        const recipients = await resolveCompanyRecipients(Number(companyId), "config");
                        if (recipients.length > 0) {
                          const emailSvc = require('../services/emailService');
                          const sendFn = emailSvc.sendWebhookDisabledEmail || emailSvc.default?.sendWebhookDisabledEmail;
                          if (typeof sendFn === 'function') {
                            for (const r of recipients) {
                              await sendFn(
                                r.email,
                                r.name || owner?.name || 'Merchant',
                                owner?.company_name || 'your company',
                                url,
                                String(eventData.event || urlType),
                                `HTTP 404 — endpoint returned Not Found for ${newCount} consecutive attempts`,
                                newCount,
                                owner?.language
                              );
                            }
                            webhookLogs.info(`[callMerchantWebhook] 📧 Sent webhook-disabled alert to ${recipients.length} recipient(s): ${recipients.map(r => r.email).join(', ')}`);
                          }
                        }
                      } catch (mailErr) {
                        webhookLogs.warn(`[callMerchantWebhook] Failed to send webhook-disabled email: ${(mailErr as Error).message}`);
                      }
                    }
                  } catch (dbErr) {
                    webhookLogs.warn(`[callMerchantWebhook] Failed to persist webhook_disabled on tbl_company: ${(dbErr as Error).message}`);
                  }
                }
              } else {
                webhookLogs.error(
                  `[callMerchantWebhook] 🚨 ALERT: Webhook URL "${url}" returned 404 (${newCount}/${MAX_CONSECUTIVE_404_FAILURES} before auto-disable). ` +
                  `Company ${companyId} should update their webhook URL.`
                );
              }
            } catch (trackErr) {
              webhookLogs.error(`[callMerchantWebhook] Failed to track 404 failure: ${(trackErr as Error).message}`);
            }
          }
          // Include response body in error message for caller
          if (responseBodyStr) {
            errorMessage = `${errorMessage} - Server response: ${responseBodyStr.substring(0, 200)}`;
          }
          break;
        }
        
        if (attempt < maxRetries) {
          const base = 1000 * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
          const delay = base + Math.floor(Math.random() * 500); // + jitter (avoids retry thundering-herd)
          webhookLogs.warn(`[callMerchantWebhook] ⚠️ Attempt ${attempt} failed, retrying in ${delay}ms: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed - log the failure
    const responseTimeMs = Date.now() - startTime;
    const finalErrorMessage = lastError?.message || 'Unknown error';
    webhookLogs.error(`[callMerchantWebhook] ❌ ${urlType} failed after ${maxRetries} attempts: ${finalErrorMessage}`);
    
    if (companyId) {
      await logWebhookDelivery(
        companyId,
        url,
        eventData.event as string,
        webhookPayload.webhook_id,
        webhookPayload,
        'failed',
        finalResponseStatus,
        responseTimeMs,
        finalErrorMessage,
        totalRetries
      );
    }
    
    return { success: false, error: finalErrorMessage, url };
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    webhookLogs.error(`[callMerchantWebhook] Error in callUrlWithPayload: ${err.message}`);
    return { success: false, error: err.message || 'Unknown error', url };
  }
};

const flutterwaveWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Centralized inbound verifier — plain shared-secret equality on `verif-hash`.
    // Reject unauthenticated callbacks immediately (401 + return) so we never
    // process an unsigned payload or double-write the response.
    const signature = req.headers["verif-hash"];
    if (!verifyFlutterwaveHash(signature)) {
      res.status(401).end();
      return;
    }
    const payload: IWebHook = req.body;
    const txRef = payload.txRef.includes("customer")
      ? payload.txRef
      : "flw-txt-" + payload.txRef;
    const items = await getRedisItem(txRef);
    webhookLogs.info("here==========>", payload.id, payload.status, items);
    await setRedisItem(txRef, {
      ...items,
      id: payload.id,
      status: payload.status,
    });

    webhookLogs.info("IWebHook=============>", payload);
    res.status(200).end();
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { from: "flutterwave_webhook" }, new Error(e));
    // Guard against ERR_HTTP_HEADERS_SENT if a response was already sent above.
    if (!res.headersSent) res.status(500).end();
  }
};
const tatumWebHook = async (req: express.Request, res: express.Response) => {
  const payload: ITatumWebHook = req.body;
  let address = payload.address;
  let items;
  items = await getRedisItem("crypto-" + address);
  if (Object.keys(items).length < 1) {
    address = payload.counterAddress;
    items = await getRedisItem("crypto-" + address);
  }
  webhookLogs.info("items===========>", items, payload);
  let newPayload;
  if (Object.keys(items).length > 0) {
    if (
      Number(items.amount) >= Number(payload.amount) ||
      Number(payload.amount) > 0
    ) {
      newPayload = {
        ...items,
        status: toRedisStatus(PaymentState.PAYOUT_COMPLETE),
      };
      webhookLogs.info("here payload");
    } else {
      newPayload = {
        ...items,
        status: toRedisStatus(PaymentState.FAILED),
        message: "your amount is less then required amount!",
      };
    }

    if (!items?.txId && Number(payload.amount) > 0) {
      // NOTE: Pending notification is handled by tatumCryptoWebHook to avoid duplicates.
      // Only update Redis state here.
      await setRedisItem("crypto-" + address, {
        ...newPayload,
        txId: payload.txId,
        receivedAmount: payload.amount,
      });
    }
  }
  res.status(200).end();
};

/**
 * tatumCryptoWebHook — QUEUE-BASED (thin handler)
 * 
 * This handler immediately ACKs the Tatum webhook (200) and enqueues the payload
 * for asynchronous processing by the BullMQ worker. This ensures:
 * 1. No webhooks are lost during server processing time
 * 2. Tatum doesn't retry-storm due to slow responses
 * 3. If the server crashes mid-processing, the job survives in Redis
 */
const tatumCryptoWebHook = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const payload: ITatumWebHook = req.body;

    // Extract company info from query params (BlockBee style)
    const queryCompanyId = req.query.company_id ? Number(req.query.company_id) : undefined;
    const queryUserId = req.query.user_id ? Number(req.query.user_id) : undefined;
    const queryAddressId = req.query.address_id ? Number(req.query.address_id) : undefined;

    webhookLogs.info("[tatumCryptoWebHook] Received webhook, enqueuing:", {
      address: payload.address,
      amount: payload.amount,
      txId: payload.txId,
      asset: payload.asset,
    });

    // Live checkout: the buyer's tab learns "payment detected" the moment the
    // chain watcher reports the tx (before verification/settlement runs).
    if (payload.txId && payload.address) {
      publishCheckoutStatus(payload.address, "pending", { txId: payload.txId, asset: payload.asset });
    }

    // Basic validation before enqueue
    if (!payload.txId) {
      webhookLogs.warn("[tatumCryptoWebHook] Missing txId, ignoring");
      return res.status(200).end();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PERF: Parallelize ALL 3 Redis dedup reads in a single round-trip
    // Previously: receiver dedup GET (~150ms) → SET (~150ms) → parallel processed+outgoing (~150ms) = ~450ms
    // Now: single Promise.all for all 3 GETs (~150ms) + fire-and-forget SET = ~150ms total
    // ═══════════════════════════════════════════════════════════════════════
    const receiverDedupKey = `recv-dedup-${payload.txId}`;
    const processedTxKey = `processed-tx-${payload.txId}`;
    const outgoingTxKey = `outgoing-tx-${payload.txId}`;

    const [alreadyReceived, alreadyProcessed, isOutgoingTx] = await Promise.all([
      getRedisItem(receiverDedupKey),
      getRedisItem(processedTxKey),
      getRedisItem(outgoingTxKey),
    ]);

    // Receiver-level dedup: reject duplicate Tatum webhooks arriving within milliseconds
    if (alreadyReceived && Object.keys(alreadyReceived).length > 0) {
      webhookLogs.info(`[tatumCryptoWebHook] Duplicate webhook at receiver level, skipping: ${payload.txId}`);
      return res.status(200).end();
    }

    // PERF: Fire-and-forget dedup SET — doesn't need to complete before enqueue
    // The parallel GET already passed, so this is purely for future duplicate protection
    // TTL 300s (5 min) to prevent duplicate webhooks from re-triggering settlement gas funding
    setRedisItemWithTTL(receiverDedupKey, { received: Date.now() }, 300)
      .catch(() => { /* non-critical: dedup is best-effort, worker has its own dedup */ });

    // Quick duplicate check (fast-path reject, worker also checks)
    if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
      webhookLogs.info("[tatumCryptoWebHook] Already processed, skipping:", payload.txId);
      return res.status(200).end();
    }

    // Skip webhooks for our own outgoing transactions (settlement/sweep TXs)
    if (isOutgoingTx && Object.keys(isOutgoingTx).length > 0) {
      webhookLogs.info(`[tatumCryptoWebHook] Outgoing TX detected (${isOutgoingTx.type || 'unknown'}), skipping: ${payload.txId}`);
      return res.status(200).end();
    }

    // ── EARLY SPAM FILTER: Reject obviously unknown/scam token assets ─────
    // This is a lightweight pre-queue check. Full validation happens in the worker.
    // We only check if the asset is in our known list — if not, skip enqueuing entirely.
    if (payload.asset) {
      const { TATUM_ASSET_TO_CURRENCY, CONTRACT_ADDRESS_TO_CURRENCY } = require("../services/webhookProcessor");
      const assetUpper = payload.asset.toUpperCase().trim();
      const assetLower = payload.asset.toLowerCase().trim();
      // FIX (2026-04-10): Also check contract address map. Tatum can send ERC-20 contract
      // addresses (e.g., "0xdac17f958d2ee523a2206206994597c13d831ec7" for USDT) as the asset.
      if (!TATUM_ASSET_TO_CURRENCY[assetUpper] && !CONTRACT_ADDRESS_TO_CURRENCY[assetLower]) {
        webhookLogs.warn(`[tatumCryptoWebHook] ⛔ SPAM TOKEN REJECTED at receiver: unknown asset "${payload.asset}" — not enqueuing`, {
          address: payload.address,
          txId: payload.txId,
          amount: payload.amount,
          asset: payload.asset,
        });
        return res.status(200).end();
      }
    }

    // ── RELIABILITY: Queue backpressure check ─────────────────────────────
    // Reject new webhooks when the system is overwhelmed to prevent cascading failures
    try {
      const { checkQueueBackpressure } = require("../services/paymentReliability");
      const backpressure = await checkQueueBackpressure();
      if (!backpressure.accept) {
        webhookLogs.error(`[tatumCryptoWebHook] ⛔ BACKPRESSURE: Rejecting webhook — ${backpressure.reason}`);
        // Return 503 to trigger Tatum retry (they'll back off and retry later)
        return res.status(503).json({ error: "Service temporarily overloaded", retryAfter: 30 });
      }
    } catch (_bpErr) {
      // Non-blocking — if backpressure check fails, allow the webhook
    }

    // Enqueue for async processing by BullMQ worker
    await enqueueWebhook({
      payload: {
        address: payload.address,
        counterAddress: payload.counterAddress,
        amount: payload.amount,
        txId: payload.txId,
        asset: payload.asset,
      },
      queryParams: {
        company_id: queryCompanyId,
        user_id: queryUserId,
        address_id: queryAddressId,
      },
      receivedAt: new Date().toISOString(),
      source: "webhook",
    });

    // ACK immediately — processing happens asynchronously
    return res.status(200).end();
  } catch (error) {
    webhookLogs.error("[tatumCryptoWebHook] Error enqueuing webhook:", error);
    // Still return 200 to prevent Tatum retries (the raw payload is logged)
    return res.status(200).end();
  }
};


export { flutterwaveWebHook, tatumWebHook, tatumCryptoWebHook, callMerchantWebhook };
