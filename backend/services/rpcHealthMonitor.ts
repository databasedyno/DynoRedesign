/**
 * RPC Failover Health Monitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Periodically pings every EVM sweep RPC endpoint (the exact URLs used by
 * directEvmTransfer.getRpcUrls) and alerts the admin the moment an endpoint
 * goes dead — so we find out BEFORE a sweep silently fails.
 *
 * Alerting goes through errorMonitoringService.captureError:
 *   - one dead endpoint  → severity "high"     → immediate alert (deduped 1h/endpoint)
 *   - ALL endpoints dead  → severity "critical" → immediate alert + Slack/Discord
 * The per-fingerprint cooldown in errorMonitoringService means at most ONE email
 * per dead endpoint per hour (no flooding), and recovery is logged.
 *
 * Runs ONLY on the elected leader (scheduled from registerLeaderCronJobs in
 * server.ts), so it never fires from a secondary/preview instance.
 */
import { getRpcUrls } from "./merchantPool/directEvmTransfer";
import { captureError } from "./errorMonitoringService";
import { sendAlert } from "./slackAlertService";
import { cronLogger } from "../utils/loggers";
import { getTatumApiKey } from "../utils/tatumAuth";

type Chain = "ETH" | "POLYGON";
const CHAINS: Chain[] = ["ETH", "POLYGON"];
const EXPECTED_CHAIN_ID: Record<Chain, number> = { ETH: 1, POLYGON: 137 };
const PING_TIMEOUT_MS = Number(process.env.RPC_HEALTH_PING_TIMEOUT_MS || 10000);
// Number of CONSECUTIVE failed check cycles before we page the admin. A single
// transient blip (e.g. a brief Tatum slowdown / Cloudflare 524) must NOT alert —
// only a sustained outage should. Recovers instantly on the next healthy ping.
const FAILURE_THRESHOLD = Number(process.env.RPC_HEALTH_FAILURE_THRESHOLD || 2);

// Per-endpoint consecutive-failure streak + whether we've already alerted for the
// current outage, so we alert once when the streak crosses the threshold and log
// a recovery only if we had actually alerted.
const failStreak = new Map<string, number>();
const alerted = new Map<string, boolean>();

/** Test hook: clear all health state. */
export function resetRpcHealthState(): void {
  failStreak.clear();
  alerted.clear();
}

/** Current consecutive-failure streak for an endpoint. */
export function getFailStreak(url: string): number {
  return failStreak.get(url) || 0;
}

/**
 * Record a single check result for an endpoint and decide what to do. PURE w.r.t.
 * external side effects (only mutates the streak maps) so it is unit-testable.
 *   - ok=false → increment streak; `alert` becomes true ONLY on the check that
 *     first reaches FAILURE_THRESHOLD consecutive failures.
 *   - ok=true  → reset streak; `recovered` is true only if we had alerted.
 */
export function registerResult(url: string, ok: boolean): { alert: boolean; recovered: boolean } {
  if (ok) {
    const wasAlerted = alerted.get(url) === true;
    failStreak.set(url, 0);
    alerted.set(url, false);
    return { alert: false, recovered: wasAlerted };
  }
  const streak = (failStreak.get(url) || 0) + 1;
  failStreak.set(url, streak);
  if (streak >= FAILURE_THRESHOLD && !alerted.get(url)) {
    alerted.set(url, true);
    return { alert: true, recovered: false };
  }
  return { alert: false, recovered: false };
}

/** Hide any Tatum API key embedded in the RPC URL before logging/alerting. */
const redactUrl = (url: string): string =>
  url.replace(/(tatum\.io\/v3\/[a-z]+\/web3\/)[^/?\s]+/i, "$1***");

interface PingResult {
  url: string;
  ok: boolean;
  chainId?: number;
  error?: string;
}

async function pingRpc(chain: Chain, url: string, attempt = 1): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (url.includes("tatum.io")) {
      const key = getTatumApiKey();
      if (key) headers["x-api-key"] = key;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: controller.signal,
    });
    // A 5xx / Cloudflare 524 from the provider is usually transient — retry once.
    if (!res.ok) {
      if (res.status >= 500 && attempt < 2) {
        clearTimeout(timer);
        await new Promise((r) => setTimeout(r, 750));
        return pingRpc(chain, url, attempt + 1);
      }
      return { url, ok: false, error: `HTTP ${res.status}` };
    }
    const json: any = await res.json().catch(() => null);
    if (!json || json.error) return { url, ok: false, error: json?.error?.message || "invalid RPC response" };
    const chainId = typeof json.result === "string" ? parseInt(json.result, 16) : NaN;
    if (Number.isNaN(chainId)) return { url, ok: false, error: "no chainId in response" };
    if (chainId !== EXPECTED_CHAIN_ID[chain]) {
      return { url, ok: false, chainId, error: `wrong chainId ${chainId} (expected ${EXPECTED_CHAIN_ID[chain]})` };
    }
    return { url, ok: true, chainId };
  } catch (e: any) {
    const error = e?.name === "AbortError" ? "timeout" : e?.message || "network error";
    // One quick retry for a transient timeout / network blip before giving up.
    if (attempt < 2) {
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, 750));
      return pingRpc(chain, url, attempt + 1);
    }
    return { url, ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping all sweep RPC endpoints once and alert on failures.
 * Safe to call from a cron schedule; never throws.
 */
export async function checkRpcHealth(): Promise<void> {
  try {
    for (const chain of CHAINS) {
      const urls = getRpcUrls(chain);
      if (urls.length === 0) continue;

      const results = await Promise.all(urls.map((u) => pingRpc(chain, u)));
      const healthy = results.filter((r) => r.ok);

      for (const r of results) {
        const safe = redactUrl(r.url);
        const { alert, recovered } = registerResult(r.url, r.ok);
        if (r.ok) {
          if (recovered) {
            cronLogger.info(`[RPCHealth] ${chain} endpoint RECOVERED: ${safe}`);
          }
        } else {
          const streak = getFailStreak(r.url);
          cronLogger.warn(
            `[RPCHealth] ${chain} endpoint failing (${streak}/${FAILURE_THRESHOLD} consecutive): ${safe} (${r.error})`
          );
          // Only page the admin once the failure is SUSTAINED (crossed the
          // consecutive-failure threshold) — a single transient blip stays silent.
          if (alert) {
            captureError(new Error(`${chain} RPC endpoint unreachable: ${safe} — ${r.error}`), "blockchain", {
              severity: "high",
              extraContext: `RPC health check: ${chain} sweep endpoint down for ${streak} consecutive checks`,
            });
          }
        }
      }

      if (healthy.length === 0) {
        // Every endpoint failed this cycle. Only escalate to CRITICAL when the
        // outage is SUSTAINED across all endpoints (avoids a transient provider
        // blip — e.g. a Tatum Cloudflare 524 window — paging critical).
        const allSustainedDown = urls.every((u) => getFailStreak(u) >= FAILURE_THRESHOLD);
        cronLogger.error(
          `[RPCHealth] ${chain} has NO working RPC endpoints this cycle (${urls.length} checked)` +
            (allSustainedDown ? " — SUSTAINED, sweeps will fail" : " — transient, watching")
        );
        if (allSustainedDown) {
          captureError(
            new Error(`ALL ${chain} RPC endpoints are down (${urls.length} checked) — ${chain} sweeps will fail until one recovers`),
            "blockchain",
            { severity: "critical", extraContext: `RPC health check: every ${chain} endpoint failed ${FAILURE_THRESHOLD}+ consecutive checks` }
          );
          try {
            await sendAlert({
              title: `${chain} RPC OUTAGE`,
              message: `All ${urls.length} ${chain} RPC endpoints are unreachable — ${chain} sweeps will fail until an endpoint recovers.`,
              severity: "critical",
              fields: { Chain: chain, EndpointsChecked: String(urls.length) },
            });
          } catch {
            /* Slack/Discord is best-effort */
          }
        }
      } else {
        cronLogger.info(`[RPCHealth] ${chain}: ${healthy.length}/${urls.length} endpoints healthy`);
      }
    }
  } catch (e) {
    cronLogger.error(`[RPCHealth] check failed: ${(e as Error).message}`);
  }
}
