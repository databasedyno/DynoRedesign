import axios, { AxiosResponse } from "axios";
import { assertSafeOutboundUrl } from "./outboundUrlGuard";

/**
 * Safe, SSRF-aware POST that follows HTTP redirects MANUALLY.
 *
 * Why manual? axios' built-in `maxRedirects` would follow a 3xx BEFORE we can
 * re-validate the new target, letting a merchant endpoint (or a compromised
 * one) 30x us straight at cloud metadata / an internal host — defeating the
 * SSRF check we ran on the original URL.
 *
 * The bug this fixes: a legitimate merchant endpoint 308-redirected to its
 * `www` host. With `maxRedirects: 0` axios treated the 3xx as a hard failure,
 * so delivery "failed" and 158 webhooks silently never arrived. We now follow
 * the redirect after re-running `assertSafeOutboundUrl` on every hop, so the
 * delivery succeeds while staying SSRF-safe.
 *
 * 4xx/5xx still throw (default axios behaviour) so the caller's existing
 * retry / no-retry logic is unchanged. Permanent redirect problems
 * (SSRF-blocked target, missing/invalid Location, redirect loop) are thrown
 * with `noRetry = true` so the caller can stop immediately.
 */

export const MAX_WEBHOOK_REDIRECT_HOPS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_TIMEOUT_MS = Math.max(5000, Number(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS) || 20000);

export interface RedirectAwarePost {
  response: AxiosResponse;
  finalUrl: string;
  redirectChain: string[];
}

/** Error carrying the response status + a noRetry hint the caller understands. */
export interface WebhookDeliveryError extends Error {
  response?: { status: number };
  noRetry?: boolean;
}

/** Build a permanent (noRetry) redirect error the caller's catch block reads. */
const redirectError = (message: string, status: number): WebhookDeliveryError => {
  const err = new Error(message) as WebhookDeliveryError;
  err.response = { status };
  err.noRetry = true;
  return err;
};

export const postWithSafeRedirects = async (
  startUrl: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<RedirectAwarePost> => {
  let currentUrl = startUrl;
  const redirectChain: string[] = [];

  for (let hop = 0; hop <= MAX_WEBHOOK_REDIRECT_HOPS; hop++) {
    const response = await axios.post(currentUrl, body, {
      timeout: timeoutMs,
      headers,
      maxRedirects: 0, // we follow manually (below) so we can re-run the SSRF guard on each hop
      maxContentLength: 1024 * 1024,
      // Accept 3xx so we can inspect Location; 4xx/5xx still throw → unchanged retry/no-retry logic.
      validateStatus: (s) => s < 400,
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: currentUrl, redirectChain };
    }

    // ---- redirect: resolve + re-validate the target before following it ----
    const rawLocation = (response.headers?.location ?? response.headers?.Location) as string | undefined;
    if (!rawLocation) {
      throw redirectError(`Webhook endpoint returned HTTP ${response.status} but no Location header to follow`, response.status);
    }

    let nextUrl: string;
    try {
      nextUrl = new URL(rawLocation, currentUrl).toString();
    } catch {
      throw redirectError(`Webhook endpoint redirected (HTTP ${response.status}) to an invalid Location: "${rawLocation}"`, response.status);
    }

    try {
      await assertSafeOutboundUrl(nextUrl); // SSRF re-check on the redirect target — the whole point of following manually
    } catch (guardErr) {
      const msg = guardErr instanceof Error ? guardErr.message : String(guardErr);
      throw redirectError(`Webhook redirect target blocked by security guard: ${msg}`, response.status);
    }

    redirectChain.push(nextUrl);
    currentUrl = nextUrl;
  }

  throw redirectError(`Webhook endpoint exceeded the ${MAX_WEBHOOK_REDIRECT_HOPS}-redirect limit (possible redirect loop)`, 508);
};
