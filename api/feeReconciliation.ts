import adminBaseApi from "@/axiosAdmin";

export interface FeeAuditRow {
  audit_id: number;
  pool_tx_id: number | null;
  transaction_id: number | string | null;
  company_id: number | null;
  wallet_type: string;
  gas_token: string;
  payout_tx_hash: string | null;
  explorer_url: string | null;
  payout_amount: number | null;
  estimated_gas_native: number | null;
  gas_funded_native: number | null;
  charged_fee_asset: number;
  charged_fee_usd: number;
  actual_gas_native: number | null;
  actual_gas_usd: number | null;
  variance_usd: number | null;
  verdict: "over" | "under" | "ok" | "pending" | "unavailable" | string;
  source: string | null;
  actual_source: string | null;
  status: "reconciled" | "pending" | "unavailable" | string;
  settled_at: string;
  reconciled_at: string | null;
}

export interface FeeChainSummary {
  payouts: number;
  reconciled: number;
  charged_usd: number;
  actual_usd: number;
  variance_usd: number;
  gas_token: string;
  gas_funded_native: number;
  actual_gas_native: number;
}

export interface FeeReconciliation {
  summary: {
    payouts: number;
    reconciled: number;
    pending: number;
    unavailable: number;
    charged_usd: number;
    actual_usd: number;
    variance_usd: number;
    over: number;
    under: number;
    ok: number;
    by_chain: Record<string, FeeChainSummary>;
  };
  page: number;
  limit: number;
  total: number;
  rows: FeeAuditRow[];
}

export interface FeeReconciliationQuery {
  from?: string;
  to?: string;
  chain?: string;
  status?: string;
  verdict?: string;
  page?: number;
  limit?: number;
}

export interface CrumbSweepReport {
  startedAt: string;
  finishedAt?: string;
  dryRun: boolean;
  walletType: string;
  adminWallet: string;
  scanned: number;
  scanErrors: number;
  holders: Array<{ id: number; address: string; status: string; usdt: number; trx: number; dbFee: number }>;
  gas: { estimateTrx: number; estimateUsd: number; trxUsd: number; source: string };
  thresholdUsd: number;
  swept: Array<{ id: number; address: string; amount: number; txId: string; gasUsedTrx: number | null }>;
  skipped: Array<{ id: number; address: string; usdt: number; reason: string }>;
  reclaimed: Array<{ id: number; address: string; amount: number; txId: string }>;
  reconciled: { zeroed: number; corrected: number };
  totals: { sweptUsdt: number; reclaimedTrx: number; strandedUsdt: number; strandedTrx: number };
  errors: string[];
}

const unwrap = <T,>(res: { data: { data: T } }): T => res.data.data;

export const feeReconciliationApi = {
  report: async (q: FeeReconciliationQuery): Promise<FeeReconciliation> => unwrap(await adminBaseApi.get("/admin/fee-reconciliation", { params: q })),
  reconcile: async (limit = 100): Promise<{ reconciled: number; pending: number; unavailable: number }> => unwrap(await adminBaseApi.post("/admin/fee-reconciliation/reconcile", { limit })),
  backfill: async (days = 90): Promise<{ days: number; scanned: number; inserted: number; reconciled: number; pending: number; unavailable: number }> => unwrap(await adminBaseApi.post("/admin/fee-reconciliation/backfill", { days })),
  crumbReport: async (): Promise<{ running: boolean; report: CrumbSweepReport | null }> => unwrap(await adminBaseApi.get("/admin/pool/crumbs-report")),
  startCrumbSweep: async (dryRun: boolean): Promise<{ started: boolean; dry_run: boolean }> => unwrap(await adminBaseApi.post("/admin/pool/consolidate-crumbs", { dry_run: dryRun })),
};
