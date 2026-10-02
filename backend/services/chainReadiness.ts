/**
 * Chain readiness — per-currency "will a payment settle end to end?" checklist for the admin console.
 *
 * For every supported currency it verifies: admin wallet configured, token contract (tokens), sweep config,
 * gas wallet (address + signing key in tbl_admin_fee_wallet + live balance vs thresholds), pool address
 * availability, XRP master activation / RLUSD trust line (tag-based chains) and the last successful settlement.
 * Live balances come from Tatum; results are cached in-process for CACHE_TTL_MS.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import tatumApi from "../apis/tatumApi";
import { adminFeeModel } from "../models";
import {
  MERCHANT_POOL_CRYPTO_TYPES,
  TOKEN_CHAINS,
  UTXO_CHAINS,
} from "../models/merchantPoolModels";
import {
  ADMIN_WALLETS,
  RLUSD_CONFIG,
  TOKEN_CONTRACTS,
  XRP_MASTER_ADDRESS,
  getSweepConfig,
  isTagBasedChain,
} from "./merchantPool/merchantPoolConfig";
import { FEE_WALLET_CONFIGS, computeStatus, impactLabel } from "./feeWalletMonitor";
import { adminLogger } from "../utils/loggers";

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export type GasLevel = "healthy" | "warning" | "critical" | "empty" | "unknown";

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
  overall: "ready" | "degraded" | "blocked";
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

const CACHE_TTL_MS = 60_000;
const SETTLEMENT_WINDOW_DAYS = 120;
const MIN_POOL_ADDRESSES = 2;
const XRP_RESERVE = 1.2;

const NETWORK_LABEL: Record<string, string> = {
  BTC: "Bitcoin", LTC: "Litecoin", DOGE: "Dogecoin", BCH: "Bitcoin Cash", ETH: "Ethereum", TRX: "Tron",
  SOL: "Solana", XRP: "XRP Ledger", RLUSD: "XRP Ledger", POLYGON: "Polygon", "USDT-TRC20": "Tron",
  "USDT-ERC20": "Ethereum", "USDC-ERC20": "Ethereum", "RLUSD-ERC20": "Ethereum", "USDT-POLYGON": "Polygon",
};

// Which gas wallet (FEE_WALLET_CONFIGS.id) a currency depends on for payouts/sweeps.
const GAS_WALLET_FOR_CURRENCY: Record<string, string> = {
  "USDT-TRC20": "TRX", "USDT-ERC20": "ETH", "USDC-ERC20": "ETH", "RLUSD-ERC20": "ETH",
  "USDT-POLYGON": "POLYGON", XRP: "XRP_MASTER", RLUSD: "XRP_MASTER",
};

let cache: { at: number; report: ChainReadinessReport } | null = null;

const familyOf = (c: string): CurrencyReadiness["family"] =>
  UTXO_CHAINS.includes(c) ? "utxo" : isTagBasedChain(c) ? "tag" : TOKEN_CHAINS.includes(c) ? "token" : "native";

async function fetchBalance(address: string, chain: string): Promise<number | null> {
  try {
    const r = (await tatumApi.getAddressBalance(address, chain, true)) as { balance?: string; total?: string } | null;
    const n = Number(r?.total ?? r?.balance);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    adminLogger.warn(`[ChainReadiness] balance lookup failed for ${chain} ${address}: ${(e as Error).message}`);
    return null;
  }
}

async function loadGasWallets(): Promise<GasWalletReadiness[]> {
  const feeRows = (await adminFeeModel.findAll({ attributes: ["wallet_type", "wallet_address", "privateKey"] })) as unknown as Array<{
    dataValues: { wallet_type: string; wallet_address: string; privateKey: string | null };
  }>;
  const keyByAddress = new Map(feeRows.map((r) => [String(r.dataValues.wallet_address).toLowerCase(), !!r.dataValues.privateKey]));

  return Promise.all(
    FEE_WALLET_CONFIGS.map(async (cfg) => {
      const balance = cfg.address ? await fetchBalance(cfg.address, cfg.chain) : null;
      const level: GasLevel = balance === null ? "unknown" : computeStatus(cfg, balance);
      const serves = Object.entries(GAS_WALLET_FOR_CURRENCY).filter(([, id]) => id === cfg.id).map(([c]) => c);
      return {
        id: cfg.id,
        symbol: cfg.displayName,
        role: cfg.role,
        address: cfg.address,
        env_key: cfg.envKey,
        balance,
        level,
        thresholds: { critical: cfg.criticalThreshold, warning: cfg.warningThreshold, healthy: cfg.healthyThreshold },
        top_up_needed: balance === null ? cfg.healthyThreshold : Math.max(0, cfg.healthyThreshold - balance),
        signing_key_in_db: keyByAddress.get(cfg.address.toLowerCase()) ?? false,
        serves,
        impact: level === "healthy" || level === "unknown" ? null : impactLabel(cfg, level),
      };
    })
  );
}

async function loadPoolCounts(): Promise<Record<string, CurrencyReadiness["pool"]>> {
  const rows = await sequelize.query<{ wallet_type: string; status: string; n: string }>(
    `SELECT wallet_type, status, COUNT(*)::text AS n FROM tbl_merchant_temp_address GROUP BY 1, 2`,
    { type: QueryTypes.SELECT }
  );
  const out: Record<string, CurrencyReadiness["pool"]> = {};
  for (const r of rows) {
    const p = (out[r.wallet_type] ||= { available: 0, pre_reserved: 0, in_use: 0 });
    if (r.status === "AVAILABLE") p.available += Number(r.n);
    else if (r.status === "PRE_RESERVED") p.pre_reserved += Number(r.n);
    else if (r.status === "IN_USE" || r.status === "RESERVED" || r.status === "PROCESSING") p.in_use += Number(r.n);
  }
  return out;
}

async function loadSettlements(): Promise<Record<string, CurrencyReadiness["settlements"]>> {
  const rows = await sequelize.query<{ crypto_currency: string; n: string; last_at: string | null }>(
    `SELECT crypto_currency, COUNT(*)::text AS n, MAX("createdAt") AS last_at
       FROM tbl_user_transaction
      WHERE payment_mode = 'CRYPTO' AND status IN ('successful', 'completed')
        AND outgoing_tx_hash IS NOT NULL
        AND "createdAt" > NOW() - INTERVAL '${SETTLEMENT_WINDOW_DAYS} days'
      GROUP BY 1`,
    { type: QueryTypes.SELECT }
  );
  const out: Record<string, CurrencyReadiness["settlements"]> = {};
  for (const r of rows) out[r.crypto_currency] = { count_120d: Number(r.n), last_at: r.last_at ? new Date(r.last_at).toISOString() : null };
  return out;
}

async function xrpMasterChecks(currency: string): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];
  if (!XRP_MASTER_ADDRESS) {
    return [{ key: "xrp_master", label: "XRP master wallet", status: "fail", detail: "XRP_MASTER_WALLET is not configured" }];
  }
  let activated = false;
  try { activated = await tatumApi.verifyXrpAccountActivated(XRP_MASTER_ADDRESS); } catch { activated = false; }
  checks.push({
    key: "xrp_master",
    label: "XRP master account activated",
    status: activated ? "ok" : "fail",
    detail: activated ? `${XRP_MASTER_ADDRESS} is active on the XRP Ledger` : `${XRP_MASTER_ADDRESS} is not activated (needs ≥ 1 XRP)`,
  });
  if (currency === "RLUSD") {
    let trust = false;
    try { trust = await tatumApi.verifyXrpTrustLine(XRP_MASTER_ADDRESS, RLUSD_CONFIG.issuer, RLUSD_CONFIG.currencyHex); } catch { trust = false; }
    checks.push({
      key: "rlusd_trustline",
      label: "RLUSD trust line on master",
      status: trust ? "ok" : "fail",
      detail: trust ? `Trust line to issuer ${RLUSD_CONFIG.issuer} present` : "No RLUSD trust line — incoming RLUSD would be rejected",
    });
  }
  return checks;
}

function gasChecks(currency: string, wallet: GasWalletReadiness | undefined): ReadinessCheck[] {
  if (!wallet) return [{ key: "gas_wallet", label: "Gas wallet", status: "fail", detail: "No gas wallet mapped for this currency" }];
  const checks: ReadinessCheck[] = [];
  const isMaster = wallet.id === "XRP_MASTER";
  if (!wallet.address) {
    checks.push({ key: "gas_wallet", label: isMaster ? "Master wallet" : "Gas wallet address", status: "fail", detail: `${wallet.env_key} is not configured` });
    return checks;
  }
  checks.push({
    key: "gas_key",
    label: isMaster ? "Master signing key" : "Gas wallet signing key",
    status: wallet.signing_key_in_db ? "ok" : "fail",
    detail: wallet.signing_key_in_db
      ? `Encrypted key present in tbl_admin_fee_wallet for ${wallet.address}`
      : `No tbl_admin_fee_wallet row with a private key for ${wallet.address} — ${isMaster ? "sweeps from the master" : "SmartGas funding"} cannot sign`,
  });
  const bal = wallet.balance;
  const status: CheckStatus = wallet.level === "healthy" ? "ok" : wallet.level === "warning" ? "warn" : wallet.level === "unknown" ? "warn" : "fail";
  const need = wallet.top_up_needed > 0 ? ` — send ${trim(wallet.top_up_needed)} ${wallet.symbol} to ${wallet.address}` : "";
  checks.push({
    key: "gas_balance",
    label: isMaster ? `Master balance (reserve ${XRP_RESERVE} XRP)` : `${wallet.symbol} gas balance`,
    status,
    detail: bal === null
      ? `Balance lookup failed (Tatum) — last alert thresholds: warn < ${wallet.thresholds.warning}, critical < ${wallet.thresholds.critical}`
      : `${trim(bal)} ${wallet.symbol} (${wallet.level}; healthy ≥ ${wallet.thresholds.healthy})${need}`,
  });
  return checks;
}

const trim = (n: number): string => Number(n.toFixed(6)).toString();

async function buildCurrency(
  currency: string,
  gasWallets: GasWalletReadiness[],
  pools: Record<string, CurrencyReadiness["pool"]>,
  settlements: Record<string, CurrencyReadiness["settlements"]>
): Promise<CurrencyReadiness> {
  const family = familyOf(currency);
  const checks: ReadinessCheck[] = [];
  const gasId = GAS_WALLET_FOR_CURRENCY[currency] || null;

  const admin = ADMIN_WALLETS[currency];
  checks.push({
    key: "admin_wallet",
    label: "Admin (fee collection) wallet",
    status: admin ? "ok" : "fail",
    detail: admin ? admin : "Not configured — fee sweeps have no destination",
  });

  if (family === "token" && !isTagBasedChain(currency)) {
    const contract = TOKEN_CONTRACTS[currency];
    checks.push({ key: "token_contract", label: "Token contract", status: contract ? "ok" : "fail", detail: contract || "Missing token contract address" });
  }

  const sweep = getSweepConfig(currency);
  checks.push({
    key: "sweep_config",
    label: "Fee sweep policy",
    status: "ok",
    detail: sweep.mode === "batch" ? "UTXO batch sweep" : `${sweep.mode}:${sweep.value}`,
  });

  if (gasId) {
    checks.push(...gasChecks(currency, gasWallets.find((g) => g.id === gasId)));
  } else {
    checks.push({
      key: "gas_wallet",
      label: "Gas",
      status: "info",
      detail: family === "utxo" ? "Network fee is taken from the swept amount — no gas wallet needed" : "Native coin pays its own gas — no gas wallet needed",
    });
  }

  if (family === "tag") {
    checks.push(...(await xrpMasterChecks(currency)));
  } else {
    const pool = pools[currency] || { available: 0, pre_reserved: 0, in_use: 0 };
    const ready = pool.available + pool.pre_reserved;
    checks.push({
      key: "pool",
      label: "Receiving addresses in pool",
      status: ready >= MIN_POOL_ADDRESSES ? "ok" : ready > 0 ? "warn" : "fail",
      detail: `${pool.available} available · ${pool.pre_reserved} pre-reserved · ${pool.in_use} in use`,
    });
  }

  const s = settlements[currency] || { count_120d: 0, last_at: null };
  checks.push({
    key: "settlements",
    label: `Settled payments (last ${SETTLEMENT_WINDOW_DAYS} days)`,
    status: s.count_120d > 0 ? "ok" : "warn",
    detail: s.count_120d > 0
      ? `${s.count_120d} settled · last ${new Date(s.last_at as string).toISOString().slice(0, 10)}`
      : "No settled payment in the window — path is configured but unproven in production",
  });

  const overall: CurrencyReadiness["overall"] = checks.some((c) => c.status === "fail")
    ? "blocked"
    : checks.some((c) => c.status === "warn") ? "degraded" : "ready";

  return {
    currency,
    family,
    network: NETWORK_LABEL[currency] || currency,
    gas_wallet_id: gasId,
    overall,
    checks,
    pool: pools[currency] || { available: 0, pre_reserved: 0, in_use: 0 },
    settlements: s,
  };
}

export async function getChainReadiness(opts: { refresh?: boolean } = {}): Promise<ChainReadinessReport> {
  if (!opts.refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.report, cached: true };
  }
  const [gasWallets, pools, settlements] = await Promise.all([loadGasWallets(), loadPoolCounts(), loadSettlements()]);
  const currencies: CurrencyReadiness[] = [];
  for (const c of MERCHANT_POOL_CRYPTO_TYPES) currencies.push(await buildCurrency(c, gasWallets, pools, settlements));

  const summary = currencies.reduce(
    (acc, c) => ({ ...acc, [c.overall]: acc[c.overall] + 1 }),
    { ready: 0, degraded: 0, blocked: 0 }
  );
  const report: ChainReadinessReport = { generated_at: new Date().toISOString(), cached: false, summary, gas_wallets: gasWallets, currencies };
  cache = { at: Date.now(), report };
  return report;
}
