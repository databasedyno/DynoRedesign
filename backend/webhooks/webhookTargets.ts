/**
 * Additive webhook target resolution.
 *
 * Historically callMerchantWebhook used a FIRST-MATCH-WINS cascade
 * (per-request URL → payment-link → company → API key) and a company-wide kill
 * switch (tbl_company.webhook_disabled) that skipped ALL delivery. That meant a
 * single dead company endpoint silently killed valid per-request webhooks too.
 *
 * This module resolves the ADDITIVE set of delivery targets for one event:
 *   • the per-request URL (from the payment's Redis session, or persisted on
 *     tbl_user_transaction as a durable fallback),
 *   • the payment-link URL/callback (per-link config),
 *   • the company URL (or the active API-key URL as a company-level fallback).
 *
 * Every distinct URL receives the event (de-duplicated so the same URL is never
 * hit twice). The company URL is suppressed only while the company webhook is
 * disabled (manual pause or circuit breaker) — per-request/link URLs are always
 * delivered. `isCompanyUrl` lets the delivery layer scope the company-wide
 * auto-disable to the company URL only.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { webhookLogs } from "../utils/loggers";

export interface WebhookTarget {
  url: string;
  secret: string | null;
  type: "webhook" | "callback";
  source: "per_request" | "payment_link" | "company" | "api_key";
  /** True only for the company-configured URL — scopes the company-wide auto-disable flag. */
  isCompanyUrl: boolean;
}

/** Normalise for dedup: trim, drop trailing slashes, case-insensitive. */
const normalizeUrl = (u: string): string => u.trim().replace(/\/+$/, "").toLowerCase();

export async function resolveWebhookTargets(
  customerData: Record<string, unknown>,
  companyId: number | string | null | undefined,
  companyWebhookDisabled: boolean,
): Promise<WebhookTarget[]> {
  // 1. Per-request routing carried on the payment (Redis session).
  let perReqWebhook = (customerData?.webhook_url as string) || null;
  let perReqCallback = (customerData?.callback_url as string) || null;
  let perReqSecret = (customerData?.webhook_secret as string) || null;

  // 1b. Durable fallback (Scenario A): if the Redis session dropped the routing,
  //     recover it from the persisted copy on tbl_user_transaction.
  if (!perReqWebhook && !perReqCallback) {
    const txRef = customerData?.user_tx_id || customerData?.id || null;
    if (txRef) {
      try {
        const rows = (await sequelize.query(
          `SELECT webhook_url, callback_url, webhook_secret FROM tbl_user_transaction WHERE id = :id LIMIT 1`,
          { replacements: { id: txRef }, type: QueryTypes.SELECT },
        )) as Array<{ webhook_url?: string; callback_url?: string; webhook_secret?: string }>;
        const row = rows?.[0];
        if (row) {
          perReqWebhook = perReqWebhook || row.webhook_url || null;
          perReqCallback = perReqCallback || row.callback_url || null;
          perReqSecret = perReqSecret || row.webhook_secret || null;
          if (perReqWebhook || perReqCallback) {
            webhookLogs.info(`[resolveWebhookTargets] recovered per-request routing from tbl_user_transaction (id=${txRef})`);
          }
        }
      } catch (e) {
        webhookLogs.warn(`[resolveWebhookTargets] tbl_user_transaction fallback read failed for id=${txRef}: ${(e as Error).message}`);
      }
    }
  }

  // 2. Payment-link routing (per-link config).
  let linkWebhook: string | null = null;
  let linkCallback: string | null = null;
  const linkId = customerData?.link_id || customerData?.payment_link_id;
  if (linkId) {
    try {
      const rows = (await sequelize.query(
        `SELECT webhook_url, callback_url FROM tbl_payment_link WHERE link_id = :linkId LIMIT 1`,
        { replacements: { linkId }, type: QueryTypes.SELECT },
      )) as Array<{ webhook_url?: string; callback_url?: string }>;
      linkWebhook = rows?.[0]?.webhook_url || null;
      linkCallback = rows?.[0]?.callback_url || null;
    } catch (e) {
      webhookLogs.warn(`[resolveWebhookTargets] payment-link read failed for link_id=${linkId}: ${(e as Error).message}`);
    }
  }

  // 3. Company-level routing (company URL, or active API-key URL as fallback).
  let companyWebhook: string | null = null;
  let companySecret: string | null = null;
  if (companyId) {
    try {
      const rows = (await sequelize.query(
        `SELECT webhook_url, webhook_secret FROM tbl_company WHERE company_id = :companyId LIMIT 1`,
        { replacements: { companyId }, type: QueryTypes.SELECT },
      )) as Array<{ webhook_url?: string; webhook_secret?: string }>;
      companyWebhook = rows?.[0]?.webhook_url || null;
      companySecret = rows?.[0]?.webhook_secret || null;

      if (!companyWebhook) {
        const apiRows = (await sequelize.query(
          `SELECT webhook_url, webhook_secret FROM tbl_api WHERE company_id = :companyId AND status = 'active' ORDER BY api_id DESC LIMIT 1`,
          { replacements: { companyId }, type: QueryTypes.SELECT },
        )) as Array<{ webhook_url?: string; webhook_secret?: string }>;
        if (apiRows?.[0]?.webhook_url) {
          companyWebhook = apiRows[0].webhook_url;
          if (!companySecret) companySecret = apiRows[0].webhook_secret || null;
        }
      }
    } catch (e) {
      webhookLogs.warn(`[resolveWebhookTargets] company/API webhook read failed for company_id=${companyId}: ${(e as Error).message}`);
    }
  }

  // 4. Build the additive, de-duplicated list.
  const targets: WebhookTarget[] = [];
  const seen = new Set<string>();
  const add = (
    url: string | null,
    secret: string | null,
    type: WebhookTarget["type"],
    source: WebhookTarget["source"],
    isCompanyUrl: boolean,
  ): void => {
    if (!url) return;
    const key = normalizeUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ url: url.trim(), secret, type, source, isCompanyUrl });
  };

  // Per-request first — its secret wins on any URL collision.
  add(perReqWebhook, perReqSecret, "webhook", "per_request", false);
  add(perReqCallback, perReqSecret, "callback", "per_request", false);
  // Payment-link routing (links carry no secret of their own → company/per-request secret).
  add(linkWebhook, perReqSecret || companySecret, "webhook", "payment_link", false);
  add(linkCallback, perReqSecret || companySecret, "callback", "payment_link", false);
  // Company routing — suppressed while the company webhook is disabled.
  if (!companyWebhookDisabled) {
    add(companyWebhook, companySecret, "webhook", "company", true);
  } else if (companyWebhook) {
    webhookLogs.info(`[resolveWebhookTargets] company webhook suppressed (disabled) for company_id=${companyId}; per-request/link targets unaffected`);
  }

  return targets;
}

export default { resolveWebhookTargets };
