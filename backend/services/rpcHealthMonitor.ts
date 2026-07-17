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

type Chain = "ETH" | "POLYGON";
const CHAINS: Chain[] = ["ETH", "POLYGON"];
const EXPECTED_CHAIN_ID: Record<Chain, number> = { ETH: 1, POLYGON: 137 };
const PING_TIMEOUT_MS = 8000;

// Track last-known state so we can log recoveries (does not gate alerts —
// captureError's own cooldown handles de-duplication).
const endpointDown = new Map<string, boolean>();

/** Hide any Tatum API key embedded in the RPC URL before logging/alerting. */
const redactUrl = (url: string): string =>
  url.replace(/(tatum\.io\/v3\/[a-z]+\/web3\/)[^/?\s]+/i, "$1***");

interface PingResult {
  url: string;
  ok: boolean;
  chainId?: number;
  error?: string;
}

async function pingRpc(chain: Chain, url: string): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (url.includes("tatum.io")) {
      const key = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";
      if (key) headers["x-api-key"] = key;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) return { url, ok: false, error: `HTTP ${res.status}` };
    const json: any = await res.json().catch(() => null);
    if (!json || json.error) return { url, ok: false, error: json?.error?.message || "invalid RPC response" };
    const chainId = typeof json.result === "string" ? parseInt(json.result, 16) : NaN;
    if (Number.isNaN(chainId)) return { url, ok: false, error: "no chainId in response" };
    if (chainId !== EXPECTED_CHAIN_ID[chain]) {
      return { url, ok: false, chainId, error: `wrong chainId ${chainId} (expected ${EXPECTED_CHAIN_ID[chain]})` };
    }
    return { url, ok: true, chainId };
  } catch (e: any) {
    return { url, ok: false, error: e?.name === "AbortError" ? "timeout" : e?.message || "network error" };
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
      const dead = results.filter((r) => !r.ok);

      for (const d of dead) {
        const safe = redactUrl(d.url);
        cronLogger.warn(`[RPCHealth] ${chain} endpoint DOWN: ${safe} (${d.error})`);
        endpointDown.set(d.url, true);
        // "high" → immediate alert, de-duplicated per unique message (per endpoint) for 1h.
        captureError(new Error(`${chain} RPC endpoint unreachable: ${safe} — ${d.error}`), "blockchain", {
          severity: "high",
          extraContext: `RPC health check: ${chain} sweep endpoint is down`,
        });
      }

      for (const h of healthy) {
        if (endpointDown.get(h.url)) {
          cronLogger.info(`[RPCHealth] ${chain} endpoint RECOVERED: ${redactUrl(h.url)}`);
          endpointDown.set(h.url, false);
        }
      }

      if (healthy.length === 0) {
        cronLogger.error(`[RPCHealth] ${chain} has NO working RPC endpoints (${urls.length} checked) — sweeps will fail`);
        captureError(
          new Error(`ALL ${chain} RPC endpoints are down (${urls.length} checked) — ${chain} sweeps will fail until one recovers`),
          "blockchain",
          { severity: "critical", extraContext: `RPC health check: every ${chain} endpoint failed` }
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
      } else {
        cronLogger.info(`[RPCHealth] ${chain}: ${healthy.length}/${urls.length} endpoints healthy`);
      }
    }
  } catch (e) {
    cronLogger.error(`[RPCHealth] check failed: ${(e as Error).message}`);
  }
}
