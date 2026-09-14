import express from "express";
import { apiLogger } from "../../utils/loggers";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { successResponseHelper } from "../../helper";
import monitoringService from "../../services/monitoringService";
import { TatumCircuitBreaker } from "../../utils/circuitBreaker";
import { getStatus as getWsStatus } from "../../services/binanceWebSocketService";
import { getBackgroundRateCacheStatus } from "../../helper/currencyConvert";

type CheckStatus = "operational" | "degraded" | "outage" | "unknown";

interface GatewayCheck {
  id: "payments" | "rates" | "webhooks" | "api";
  status: CheckStatus;
  latency_ms?: number;
  source?: string;
  updated_at?: string | null;
}

const CACHE_MS = 20_000;
const MONITOR_STALE_MS = 15 * 60_000;
const RATES_DEGRADED_MS = 15 * 60_000;
const RATES_OUTAGE_MS = 60 * 60_000;

let cached: { at: number; body: Record<string, unknown> } | null = null;

const monitorStatus = (row: { status: string; last_check: Date } | undefined): CheckStatus => {
  if (!row) return "unknown";
  if (Date.now() - new Date(row.last_check).getTime() > MONITOR_STALE_MS) return "unknown";
  return (["operational", "degraded", "outage"].includes(row.status) ? row.status : "unknown") as CheckStatus;
};

const worst = (a: CheckStatus, b: CheckStatus): CheckStatus => {
  const rank: Record<CheckStatus, number> = { unknown: 0, operational: 1, degraded: 2, outage: 3 };
  return rank[b] > rank[a] ? b : a;
};

const ratesCheck = (): GatewayCheck => {
  const ws = getWsStatus();
  if (ws.connected && ws.lastMessageAge >= 0 && ws.lastMessageAge < 120_000) {
    return { id: "rates", status: "operational", source: "binance", updated_at: new Date(Date.now() - ws.lastMessageAge).toISOString() };
  }
  const bg = getBackgroundRateCacheStatus();
  if (!bg) return { id: "rates", status: "unknown", source: "none", updated_at: null };
  const age = Date.now() - bg.at;
  const status: CheckStatus = age < RATES_DEGRADED_MS ? "operational" : age < RATES_OUTAGE_MS ? "degraded" : "outage";
  return { id: "rates", status, source: bg.provider.toLowerCase(), updated_at: new Date(bg.at).toISOString() };
};

/** GET /api/status/gateway — merchant-safe gateway health (payments · rates · webhooks · api). */
export const getGatewayHealth = async (_req: express.Request, res: express.Response) => {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return successResponseHelper(res, 200, "Gateway health retrieved", cached.body);
    }
    const rows = await monitoringService.getCurrentServiceStatus();
    const row = (id: string) => rows.find((r) => r.service_id === id);

    const breaker = TatumCircuitBreaker.getStats();
    let payments = monitorStatus(row("payment_processing"));
    if (!TatumCircuitBreaker.isOperational() || breaker.state === "HALF_OPEN") payments = worst(payments, "degraded");

    const api = row("api_gateway");
    const checks: GatewayCheck[] = [
      { id: "payments", status: payments },
      ratesCheck(),
      { id: "webhooks", status: monitorStatus(row("webhook_delivery")) },
      { id: "api", status: monitorStatus(api), latency_ms: api?.latency_ms ?? undefined },
    ];
    const overall = checks.reduce<CheckStatus>((acc, c) => worst(acc, c.status), "operational");

    const body = { overall, checks, checked_at: new Date().toISOString() };
    cached = { at: Date.now(), body };
    successResponseHelper(res, 200, "Gateway health retrieved", body);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default { getGatewayHealth };
