import adminBaseApi from "@/axiosAdmin";

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export type GasLevel = "healthy" | "warning" | "critical" | "empty" | "unknown";
export type Overall = "ready" | "degraded" | "blocked";

export interface ReadinessCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface GasWalletReadiness {
  id: string;
  symbol: string;
  role: string;
  address: string;
  env_key: string;
  balance: number | null;
  level: GasLevel;
  thresholds: { critical: number; warning: number; healthy: number };
  top_up_needed: number;
  signing_key_in_db: boolean;
  serves: string[];
  impact: string | null;
}

export interface CurrencyReadiness {
  currency: string;
  family: "utxo" | "native" | "token" | "tag";
  network: string;
  gas_wallet_id: string | null;
  overall: Overall;
  checks: ReadinessCheck[];
  pool: { available: number; pre_reserved: number; in_use: number };
  settlements: { count_120d: number; last_at: string | null };
}

export interface ChainReadinessReport {
  generated_at: string;
  cached: boolean;
  summary: { ready: number; degraded: number; blocked: number };
  gas_wallets: GasWalletReadiness[];
  currencies: CurrencyReadiness[];
}

export const chainReadinessApi = {
  report: async (refresh = false): Promise<ChainReadinessReport> =>
    (await adminBaseApi.get("/admin/chain-readiness", { params: refresh ? { refresh: 1 } : {} })).data.data,
};
