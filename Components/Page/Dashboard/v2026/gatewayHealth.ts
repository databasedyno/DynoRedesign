import { API_ENDPOINTS } from "@/api/endpoints";
import useApiSWR from "@/hooks/useApiSWR";
import type { StatusTone } from "@/Components/UI/StatusDot";

export type GatewayStatus = "operational" | "degraded" | "outage" | "unknown";
export type GatewayCheckId = "payments" | "rates" | "webhooks" | "api";

export interface GatewayCheck {
  id: GatewayCheckId;
  status: GatewayStatus;
  latency_ms?: number;
  source?: string;
  updated_at?: string | null;
}

export interface GatewayHealth {
  overall: GatewayStatus;
  checks: GatewayCheck[];
  checked_at: string;
}

export const GATEWAY_TONE: Record<GatewayStatus, StatusTone> = {
  operational: "settled",
  degraded: "pending",
  outage: "failed",
  unknown: "neutral",
};

export const CHECK_ICON: Record<GatewayCheckId, string> = {
  payments: "lucide:coins",
  rates: "lucide:trending-up",
  webhooks: "lucide:webhook",
  api: "lucide:server",
};

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const checkLabel = (t: TFn, id: GatewayCheckId) =>
  ({
    payments: t("gateway.payments", { defaultValue: "Payments" }),
    rates: t("gateway.rates", { defaultValue: "Rates" }),
    webhooks: t("gateway.webhooks", { defaultValue: "Webhooks" }),
    api: t("gateway.api", { defaultValue: "API" }),
  })[id];

export const statusLabel = (t: TFn, s: GatewayStatus) =>
  ({
    operational: t("gateway.operational", { defaultValue: "Normal" }),
    degraded: t("gateway.degraded", { defaultValue: "Slow" }),
    outage: t("gateway.outage", { defaultValue: "Down" }),
    unknown: t("gateway.unknown", { defaultValue: "Checking" }),
  })[s];

export const overallLabel = (t: TFn, s: GatewayStatus) =>
  ({
    operational: t("gateway.allGood", { defaultValue: "All systems normal" }),
    degraded: t("gateway.someDegraded", { defaultValue: "Some services are slow" }),
    outage: t("gateway.disruption", { defaultValue: "Service disruption" }),
    unknown: t("gateway.checking", { defaultValue: "Checking status" }),
  })[s];

/** "just now" / "2m ago" / "1h ago" for the rates freshness hint. */
export const agoLabel = (t: TFn, iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return t("gateway.justNow", { defaultValue: "just now" });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("gateway.minutesAgo", { count: mins, defaultValue: "{{count}}m ago" });
  return t("gateway.hoursAgo", { count: Math.floor(mins / 60), defaultValue: "{{count}}h ago" });
};

export const useGatewayHealth = () =>
  useApiSWR<GatewayHealth | null>(API_ENDPOINTS.status.gateway, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 20_000,
    select: (raw) => (raw?.data as GatewayHealth) ?? null,
  });
