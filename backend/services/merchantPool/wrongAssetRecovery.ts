/**
 * Wrong-asset deposit recovery.
 *
 * A buyer is quoted a NATIVE coin (TRX / ETH / POLYGON) but sends a TOKEN that lives on the
 * same chain (USDT-TRC20 / USDT-ERC20 / USDC-ERC20 / USDT-POLYGON) to the pool address.
 * The pool only watches the address for its own coin, so the deposit is never detected
 * and the funds sit on-chain forever. This module:
 *   1. reads the token balance straight from the contract (works for never-activated
 *      Tron accounts, where Tatum reports "account not found" → 0),
 *   2. reconstructs the payment context (like detectOrphanPayments) with the coin that was
 *      ACTUALLY received and runs the normal settlement pipeline (cryptoVerification), which
 *      funds gas from the fee wallet, forwards the token to the brand's saved wallet for that
 *      coin, charges the normal platform fee, updates the transaction, emails + webhooks,
 *   3. sweeps the retained token fee to the admin wallet once it is worth the gas.
 */
import axios from "axios";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import { raw as envRaw } from "../../utils/config";
import { merchantTempAddressModel, merchantPoolTransactionModel, merchantPoolSweepModel, customerTransactionModel, userTransactionModel } from "../../models";
import { cronLogger } from "../../utils/loggers";
import tatumApi from "../../apis/tatumApi";
import * as keyCustody from "../keyCustody/keyCustodyService";
import { getRedisItem, setRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { convertToUSD } from "../../utils/currencyUtils";
import { getErrorMessage } from "../../helper";
import { ADMIN_WALLETS, TOKEN_CONTRACTS, getMinSweepUSD, Op } from "./merchantPoolConfig";
import { fundGasIfNeeded } from "./merchantPoolSweep";
import { directEvmSweep, getRpcUrls, isDirectEvmSupported } from "./directEvmTransfer";
import { calculateDynamicTRC20Fee } from "../tronEnergyService";
import { sub, toFixedStr, toNumber } from "../../utils/money";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

export const WRONG_ASSET_TOKENS: Record<string, string[]> = {
  TRX: ["USDT-TRC20"],
  ETH: ["USDT-ERC20", "USDC-ERC20"],
  POLYGON: ["USDT-POLYGON"],
};

const TRONGRID_API = envRaw("TRONGRID_API_URL") || "https://api.trongrid.io";
const TRONGRID_HEADERS = envRaw("TRONGRID_API_KEY") ? { "TRON-PRO-API-KEY": envRaw("TRONGRID_API_KEY") as string } : {};
const MIN_NEW_DEPOSIT = 0.5; // token units (all supported tokens are USD stablecoins)
const RECOVERABLE_STATUSES = ["AVAILABLE", "PRE_RESERVED"];
const ZERO_CACHE_TTL = 6 * 3600;

// TronGrid public tier is rate-limited (429) — space calls out and back off on 429.
let lastTronCallAt = 0;
const tronGrid = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    const wait = lastTronCallAt + 400 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastTronCallAt = Date.now();
    try {
      return await fn();
    } catch (e: any) {
      if (e?.response?.status === 429 && attempt < 4) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      throw e;
    }
  }
};

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "event Transfer(address indexed from, address indexed to, uint256 value)"];

const evmChainOf = (token: string): "ETH" | "POLYGON" => (token.endsWith("POLYGON") ? "POLYGON" : "ETH");

const evmProviders = (token: string): ethers.JsonRpcProvider[] => {
  const chain = evmChainOf(token);
  const network = ethers.Network.from(chain === "POLYGON" ? 137 : 1);
  return getRpcUrls(chain).map((url) => new ethers.JsonRpcProvider(url, network, { staticNetwork: network }));
};

/** Token balance read directly from the contract (no indexer / account-activation dependency). */
export const tokenBalanceOnChain = async (address: string, token: string): Promise<number> => {
  const contract = TOKEN_CONTRACTS[token];
  if (!contract) throw new Error(`No contract configured for ${token}`);
  if (token.includes("TRC20")) {
    const hex = TronWeb.address.toHex(address); // 41 + 20 bytes
    const res = await tronGrid(() => axios.post(
      `${TRONGRID_API}/wallet/triggerconstantcontract`,
      { owner_address: address, contract_address: contract, function_selector: "balanceOf(address)", parameter: hex.slice(2).padStart(64, "0"), visible: true },
      { timeout: 15000, headers: TRONGRID_HEADERS }
    ));
    const cr = res.data?.constant_result?.[0];
    if (!res.data?.result?.result || !cr) throw new Error(`balanceOf failed for ${address}: ${JSON.stringify(res.data?.result || res.data)}`);
    return Number(BigInt("0x" + cr)) / 1e6;
  }
  let lastErr: unknown;
  for (const provider of evmProviders(token)) {
    try {
      const c = new ethers.Contract(contract, ERC20_ABI, provider);
      const raw: bigint = await c.balanceOf(address);
      return Number(raw) / 1e6;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`EVM balanceOf failed for ${address}: ${getErrorMessage(lastErr)}`);
};

interface IncomingTx { txId: string; amount: number; timestamp: number }

/** Newest-first incoming token transfers; Tatum first, then chain-native fallbacks. */
export const tokenIncomingTxs = async (address: string, token: string): Promise<IncomingTx[]> => {
  let txs: IncomingTx[] = [];
  try {
    txs = await tatumApi.getIncomingTransactions(address, token, 20);
  } catch (e) {
    cronLogger.warn(`[WrongAsset] Tatum incoming txs failed for ${address}/${token}: ${getErrorMessage(e)}`);
  }
  if (txs.length === 0 && token.includes("TRC20")) {
    const res = await tronGrid(() => axios.get(`${TRONGRID_API}/v1/accounts/${address}/transactions/trc20`, {
      params: { only_to: true, contract_address: TOKEN_CONTRACTS[token], limit: 20 },
      timeout: 15000,
      headers: TRONGRID_HEADERS,
    }));
    txs = (res.data?.data || [])
      .filter((t: any) => t?.to === address && t?.type === "Transfer" && Number(t?.value) > 0)
      .map((t: any) => ({ txId: t.transaction_id, amount: Number(t.value) / 1e6, timestamp: Number(t.block_timestamp) || Date.now() }));
  }
  if (txs.length === 0 && !token.includes("TRC20")) {
    for (const provider of evmProviders(token)) {
      try {
        const latest = await provider.getBlockNumber();
        const c = new ethers.Contract(TOKEN_CONTRACTS[token], ERC20_ABI, provider);
        const filter = c.filters.Transfer(null, address);
        const logs = await c.queryFilter(filter, Math.max(0, latest - 200_000), latest);
        txs = logs
          .map((l: any) => ({ txId: l.transactionHash, amount: Number(l.args?.[2] ?? 0) / 1e6, timestamp: Date.now(), block: l.blockNumber }))
          .filter((t) => t.amount > 0);
        break;
      } catch (e) {
        cronLogger.warn(`[WrongAsset] EVM Transfer-log scan failed (${getErrorMessage(e)}), trying next RPC`);
      }
    }
  }
  return txs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

/** Token fee still parked on the address = recorded token fees − recorded token fee sweeps. */
const retainedTokenFee = async (tempAddressId: number, token: string): Promise<number> => {
  const [row] = (await sequelize.query(
    `SELECT COALESCE((SELECT SUM(admin_fee_amount) FROM tbl_merchant_pool_transaction
                        WHERE temp_address_id = :id AND wallet_type = :token AND status = 'completed'), 0)
          - COALESCE((SELECT SUM(amount_swept) FROM tbl_merchant_pool_sweep
                        WHERE temp_address_id = :id AND wallet_type = :token AND status = 'completed'), 0) AS retained`,
    { replacements: { id: tempAddressId, token }, type: QueryTypes.SELECT }
  )) as Array<{ retained: string }>;
  return Math.max(0, toNumber(Number(row?.retained || 0), 6));
};

const alreadySettled = async (txId: string): Promise<boolean> => {
  const existing = await customerTransactionModel.findOne({ where: { transaction_reference: txId, status: { [Op.in]: ["successful", "completed"] } }, attributes: ["transaction_id"] });
  return !!existing;
};

export interface WrongAssetCandidate {
  temp_address_id: number;
  address: string;
  address_coin: string;
  token: string;
  balance: number;
  retained_fee: number;
  new_deposit: number;
  usd: number;
  status: string;
  payment_id: string | null;
  company_id: number | null;
  owner_user_id: number;
  tx_id?: string | null;
  action: "recover" | "sweep_fee" | "skip";
  reason?: string;
}

export interface WrongAssetResult {
  dryRun: boolean;
  scanned: number;
  candidates: WrongAssetCandidate[];
  recovered: number;
  feeSwept: number;
  errors: string[];
}

/** Forward a retained token fee from the pool address to the admin wallet for that token. */
const sweepTokenFee = async (row: any, token: string, amount: number): Promise<string> => {
  const address = row.dataValues.wallet_address as string;
  const adminWallet = ADMIN_WALLETS[token];
  if (!adminWallet) throw new Error(`No admin wallet configured for ${token}`);
  const gas = await fundGasIfNeeded(row, token, amount, adminWallet);
  if (gas.funded && gas.txId) await tatumApi.waitForTransactionConfirmation(gas.txId, token.includes("TRC20") ? "TRX" : evmChainOf(token), token.includes("TRC20") ? 20000 : 120000).catch(() => null);
  const sendAmount = toNumber(amount, 6, "down");
  const txId = await keyCustody.withPrivateKey(
    row.dataValues.private_key,
    envRaw("TEMP_KEY_ID"),
    { purpose: "wrong_asset_fee_sweep", actor: "worker", walletType: token, walletAddress: address },
    async (privateKey) => {
      if (isDirectEvmSupported(token)) {
        const r = await directEvmSweep({ fromAddress: address, toAddress: adminWallet, privateKey, walletType: token, amount: sendAmount });
        return r.txHash;
      }
      const dyn = await calculateDynamicTRC20Fee(address, adminWallet, TOKEN_CONTRACTS[token]).catch(() => null);
      const r = await tatumApi.assetToOtherAddress({
        currency: token,
        fromAddress: address,
        toAddress: adminWallet,
        privateKey,
        amount: sendAmount,
        fee: dyn ? { fast: dyn.fast } : null,
        _contractAddress: TOKEN_CONTRACTS[token],
      } as any);
      if (!r?.txId) throw new Error("Token fee sweep returned no txId");
      return r.txId as string;
    }
  );
  await setRedisItemWithTTL(`outgoing-tx-${txId}`, { type: "wrong-asset-fee-sweep", fromAddress: address, toAddress: adminWallet, amount: sendAmount, currency: token, markedAt: new Date().toISOString() }, 7200).catch(() => {});
  await merchantPoolSweepModel.create({
    temp_address_id: row.dataValues.temp_address_id,
    owner_user_id: row.dataValues.owner_user_id,
    wallet_type: token,
    amount_swept: sendAmount,
    gas_funded: gas.amount || 0,
    gas_used: 0,
    sweep_tx_id: txId,
    gas_funding_tx_id: gas.txId || null,
    admin_wallet: adminWallet,
    status: "completed",
  });
  return txId;
};

const recoverOne = async (row: any, token: string, newDeposit: number, tx: IncomingTx): Promise<{ ok: boolean; message: string }> => {
  const address = row.dataValues.wallet_address as string;
  const tempAddressId = Number(row.dataValues.temp_address_id);
  const ownerId = Number(row.dataValues.owner_user_id);
  const prevAdminBalance = row.dataValues.admin_fee_balance;

  let ctx: Record<string, any> | null = null;
  try { ctx = row.dataValues.last_payment_context ? JSON.parse(row.dataValues.last_payment_context) : null; } catch { ctx = null; }
  if (!ctx && row.dataValues.current_payment_id) ctx = { payment_id: row.dataValues.current_payment_id, company_id: row.dataValues.current_company_id };

  const paymentId = String(ctx?.payment_id || `wrong-asset-${address}-${Date.now()}`);
  const companyId = ctx?.company_id ? Number(ctx.company_id) : null;
  const customerRef = String(ctx?.ref || `wrong-asset-customer-${paymentId}`);
  const cryptoKey = `wrong-asset:${token}:${address}`;

  const redisPayload = {
    mode: "CRYPTO",
    amount: newDeposit,
    receivedAmount: newDeposit,
    originalExpectedAmount: newDeposit,
    status: "processing",
    currency: token,
    payment_id: paymentId,
    unique_tx_id: paymentId,
    temp_id: tempAddressId,
    is_merchant_pool: "true",
    adm_id: ownerId,
    company_id: companyId,
    fee_payer: String(ctx?.fee_payer || "company"),
    base_currency: String(ctx?.base_currency || "USD"),
    base_amount: ctx?.base_amount ?? null,
    txId: tx.txId,
    ref: customerRef,
    wrong_asset: "true",
    expected_currency: row.dataValues.wallet_type,
    expected_crypto_amount: ctx?.expected_amount ?? null,
    processedByWrongAssetRecovery: "true",
    recoveredAt: new Date().toISOString(),
    ...(ctx?.webhook_url && { webhook_url: ctx.webhook_url }),
    ...(ctx?.callback_url && { callback_url: ctx.callback_url }),
    ...(ctx?.link_id && { link_id: ctx.link_id }),
  };
  const customerData = {
    adm_id: Number(ctx?.adm_id || ownerId),
    company_id: companyId,
    base_currency: String(ctx?.base_currency || "USD"),
    customer_name: ctx?.customer_name || null,
    customer_email: ctx?.customer_email || null,
    webhook_url: ctx?.webhook_url || null,
    callback_url: ctx?.callback_url || null,
    link_id: ctx?.link_id || null,
    payment_id: paymentId,
  };
  await setRedisItem(cryptoKey, redisPayload);
  await setRedisItem(customerRef, customerData);
  await setRedisItem(`processed-tx-${tx.txId}`, { address, amount: newDeposit, processedAt: new Date().toISOString(), processedBy: "wrongAssetRecovery" });

  cronLogger.info(`[WrongAsset] 🚑 Recovering ${newDeposit} ${token} on ${row.dataValues.wallet_type} address ${address} (payment ${paymentId}, company ${companyId ?? "unknown"}, tx ${tx.txId})`);
  const { cryptoVerification } = require("../../controller/payment/settlement/chainVerification");
  let verification: any;
  try {
    verification = await cryptoVerification(address, true, cryptoKey);
  } catch (e: any) {
    if (e?.paymentStatus === "incomplete") verification = { status: 200, paymentStatus: "incomplete" };
    else throw e;
  }
  const ok = verification?.duplicate || verification?.status === 200 || ["completed", "complete", "incomplete"].includes(String(verification?.paymentStatus));
  if (!ok) return { ok: false, message: `cryptoVerification returned ${JSON.stringify(verification)}` };

  // releaseAddress() booked the TOKEN fee into this NATIVE address' admin_fee_balance — undo that
  // (the native sweep must not think TRX/ETH is waiting). The token fee is tracked via
  // tbl_merchant_pool_transaction and swept by sweepTokenFee() once it is worth the gas.
  await row.update({ admin_fee_balance: prevAdminBalance }).catch(() => {});
  await userTransactionModel.update(
    { transaction_details: `Credited funds into wallet · Wrong-asset recovery: buyer sent ${token} to a ${row.dataValues.wallet_type} address — forwarded to the ${token} payout wallet` },
    { where: { id: paymentId } }
  ).catch(() => {});
  return { ok: true, message: `settled ${newDeposit} ${token} for payment ${paymentId}` };
};

/**
 * Scan native-coin pool addresses for token deposits and settle them.
 * `dryRun` only reports what would happen (no Redis/DB/chain writes).
 */
export const recoverWrongAssetDeposits = async (opts: { dryRun?: boolean; onlyAddress?: string; force?: boolean } = {}): Promise<WrongAssetResult> => {
  const dryRun = opts.dryRun === true;
  const result: WrongAssetResult = { dryRun, scanned: 0, candidates: [], recovered: 0, feeSwept: 0, errors: [] };
  const where: Record<string, unknown> = { wallet_type: { [Op.in]: Object.keys(WRONG_ASSET_TOKENS) } };
  if (opts.onlyAddress) where.wallet_address = opts.onlyAddress;
  const rows = await merchantTempAddressModel.findAll({ where, order: [["temp_address_id", "ASC"]] });
  cronLogger.info(`[WrongAsset] 🔍 Scanning ${rows.length} native-coin pool addresses for token deposits${dryRun ? " (dry-run)" : ""}`);

  for (const row of rows) {
    const address = row.dataValues.wallet_address as string;
    const coin = row.dataValues.wallet_type as string;
    for (const token of WRONG_ASSET_TOKENS[coin] || []) {
      result.scanned++;
      const zeroKey = `wrong-asset:zero:${token}:${address}`;
      try {
        if (!opts.force && !opts.onlyAddress && (await getRedisItem(zeroKey).catch(() => null))) continue;
        const balance = await tokenBalanceOnChain(address, token);
        if (balance <= 0) {
          if (!dryRun) await setRedisItemWithTTL(zeroKey, "1", ZERO_CACHE_TTL).catch(() => {});
          continue;
        }
        const retained = await retainedTokenFee(Number(row.dataValues.temp_address_id), token);
        const newDeposit = toNumber(sub(balance, retained), 6);
        let ctx: any = null;
        try { ctx = row.dataValues.last_payment_context ? JSON.parse(row.dataValues.last_payment_context) : null; } catch { /* ignore */ }
        const cand: WrongAssetCandidate = {
          temp_address_id: Number(row.dataValues.temp_address_id),
          address, address_coin: coin, token, balance, retained_fee: retained, new_deposit: newDeposit,
          usd: await convertToUSD(token, Math.max(newDeposit, 0)).catch(() => newDeposit),
          status: row.dataValues.status,
          payment_id: ctx?.payment_id || row.dataValues.current_payment_id || null,
          company_id: ctx?.company_id ? Number(ctx.company_id) : row.dataValues.current_company_id ? Number(row.dataValues.current_company_id) : null,
          owner_user_id: Number(row.dataValues.owner_user_id),
          action: "skip",
        };

        if (newDeposit >= MIN_NEW_DEPOSIT) {
          if (!RECOVERABLE_STATUSES.includes(row.dataValues.status)) {
            cand.reason = `address is ${row.dataValues.status} (busy) — retry next run`;
            result.candidates.push(cand);
            continue;
          }
          const txs = await tokenIncomingTxs(address, token);
          const tx = txs[0];
          if (!tx) {
            cand.reason = "balance confirmed on-chain but no incoming transfer found yet — retry next run";
            result.candidates.push(cand);
            continue;
          }
          cand.tx_id = tx.txId;
          if (await alreadySettled(tx.txId)) {
            cand.reason = `tx ${tx.txId} already settled`;
            result.candidates.push(cand);
            continue;
          }
          const conf = await tatumApi.getTransactionConfirmations(tx.txId, token).catch(() => ({ confirmed: Date.now() - (tx.timestamp || 0) > 10 * 60 * 1000, confirmations: 0, required: 0 }));
          if (!conf.confirmed) {
            cand.reason = `tx not yet confirmed (${conf.confirmations}/${conf.required})`;
            result.candidates.push(cand);
            continue;
          }
          cand.action = "recover";
          result.candidates.push(cand);
          if (dryRun) continue;
          const r = await recoverOne(row, token, newDeposit, tx);
          if (r.ok) {
            result.recovered++;
            cronLogger.info(`[WrongAsset] ✅ ${r.message}`);
          } else {
            result.errors.push(`${address}/${token}: ${r.message}`);
            cronLogger.error(`[WrongAsset] ❌ ${address}/${token}: ${r.message}`);
          }
          continue;
        }

        // Only our own retained fee is left on the address — sweep it when worth the gas.
        const retainedUsd = await convertToUSD(token, retained).catch(() => retained);
        if (retained > 0 && retainedUsd >= getMinSweepUSD(token) && RECOVERABLE_STATUSES.includes(row.dataValues.status)) {
          cand.action = "sweep_fee";
          result.candidates.push(cand);
          if (dryRun) continue;
          const txId = await sweepTokenFee(row, token, Math.min(retained, balance));
          result.feeSwept++;
          cronLogger.info(`[WrongAsset] 🧹 Swept ${toFixedStr(Math.min(retained, balance), 6)} ${token} fee from ${address} → admin (tx ${txId})`);
        } else if (retained > 0) {
          cand.reason = `retained fee $${toFixedStr(retainedUsd, 2)} below sweep minimum $${getMinSweepUSD(token)}`;
          result.candidates.push(cand);
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        result.errors.push(`${address}/${token}: ${msg}`);
        cronLogger.error(`[WrongAsset] ❌ ${address}/${token}: ${msg}`);
      }
    }
  }

  cronLogger.info(`[WrongAsset] Scan complete — checked ${result.scanned}, candidates ${result.candidates.length}, recovered ${result.recovered}, fee sweeps ${result.feeSwept}, errors ${result.errors.length}`);
  return result;
};

export default { recoverWrongAssetDeposits, tokenBalanceOnChain, tokenIncomingTxs, WRONG_ASSET_TOKENS };
