/**
 * Webhook Processor
 * 
 * Contains the core business logic extracted from tatumCryptoWebHook.
 * This is called by the BullMQ worker, NOT directly by the webhook endpoint.
 * 
 * Responsibilities:
 * - Duplicate detection (processed-tx Redis key)
 * - Atomic lock to prevent race conditions
 * - BCH CashAddr normalization
 * - Tag-based chain handling (XRP/RLUSD)
 * - Internal wallet filtering
 * - Underpayment / overpayment logic
 * - Crash recovery for stale "processing" payments
 * - cryptoVerification with retry
 * - Merchant webhook delivery
 */

import { getRedisItem, setRedisItem, setRedisTTL, acquireLock, releaseLock, deleteRedisItem } from "../utils/redisInstance";
import { webhookLogs } from "../utils/loggers";
import { log } from "../utils/loggers";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "./pendingPaymentService";
import { ADMIN_WALLETS, FEE_WALLETS, isTagBasedChain, getCryptoRedisKey, XRP_MASTER_ADDRESS } from "./merchantPool/merchantPoolConfig";
import tatumApi from "../apis/tatumApi";
import { deliverMerchantWebhook } from "./outbox/merchantWebhookOutbox";
import { WebhookJobData } from "./webhookQueue";
import { validateTransition, parseState, PaymentState } from "./paymentStateMachine";
import { publishCheckoutStatus } from "./checkoutStreamService";
import { Op } from "sequelize";
import { toBaseUnits, toFixedStr } from "../utils/money";

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET VALIDATION — Prevent spam/scam token webhooks from corrupting payments
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps Tatum webhook `asset` names → Dynopay internal currency codes.
 * Tatum sends the native chain name for native tokens and specific asset
 * names for ERC-20/TRC-20/TRC-10 tokens.
 *
 * NOTE: This ONLY includes assets Dynopay actually supports. Any asset NOT
 * in this map is treated as unknown (potential spam/scam token).
 */
const TATUM_ASSET_TO_CURRENCY: Record<string, string[]> = {
  // Native chains — ONLY native currency, NOT tokens on that chain.
  // Gas funding (e.g., TRON arriving at USDT-TRC20 address) is handled
  // separately by GAS_TOKEN_FOR_CURRENCY below.
  // 
  // ⚠️ CRITICAL: Do NOT add token currencies here (e.g., USDT-TRC20 under TRON).
  //    A native TRON webhook (asset="TRON") means TRX was transferred, NOT USDT.
  //    Adding USDT-TRC20 here would cause dust TRX transactions (gas change, spam)
  //    to be misidentified as USDT payments — leading to $0 merchant emails and
  //    corrupted payment records. See incident 2026-03-25.
  BTC:        ["BTC"],
  ETH:        ["ETH"],                   // Native ETH only — NOT ERC-20 tokens
  TRON:       ["TRX"],                   // Native TRX only — NOT TRC-20 tokens
  LTC:        ["LTC"],
  DOGE:       ["DOGE"],
  BCH:        ["BCH"],
  XRP:        ["XRP"],                   // Native XRP only — NOT RLUSD token
  MATIC:      ["POLYGON"],               // Native MATIC only — NOT Polygon tokens
  BNB:        ["BSC"],
  SOL:        ["SOL"],

  // ERC-20 tokens (Tatum reports these as specific asset names)
  USDT:       ["USDT-ERC20"],
  USDC:       ["USDC-ERC20"],
  RLUSD:      ["RLUSD", "RLUSD-ERC20"],

  // TRC-20 tokens
  USDT_TRON:  ["USDT-TRC20"],

  // Polygon tokens
  USDT_MATIC: ["USDT-POLYGON"],
};

/**
 * FIX (2026-04-10): ERC-20/TRC-20 contract addresses → Dynopay currency.
 * Tatum sometimes sends the raw contract address as the `asset` field instead
 * of a human-readable name. Without this mapping, legitimate USDT-ERC20 payments
 * were rejected as "SPAM TOKEN" (incident: payment 509b5aaf, $33 USDT-ERC20).
 *
 * Keys are LOWERCASE contract addresses for case-insensitive matching.
 */
const CONTRACT_ADDRESS_TO_CURRENCY: Record<string, { currencies: string[]; tatumAsset: string }> = {
  // Ethereum ERC-20
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { currencies: ["USDT-ERC20"],  tatumAsset: "USDT" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { currencies: ["USDC-ERC20"],  tatumAsset: "USDC" },
  // TRON TRC-20
  "tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t":         { currencies: ["USDT-TRC20"], tatumAsset: "USDT_TRON" },
  // Polygon ERC-20
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": { currencies: ["USDT-POLYGON"], tatumAsset: "USDT_MATIC" },
};

/**
 * Gas tokens for each chain — used to identify gas-funding webhooks that
 * arrive on token addresses (e.g., TRON gas funding for USDT-TRC20 addresses).
 * These are not spam; they are SmartGas system transactions and should be
 * silently skipped (not processed as payments).
 */
const GAS_TOKEN_FOR_CURRENCY: Record<string, string> = {
  "USDT-TRC20":   "TRON",
  "USDT-ERC20":   "ETH",
  "USDC-ERC20":   "ETH",
  "RLUSD-ERC20":  "ETH",
  "USDT-POLYGON": "MATIC",
};

/**
 * Validate whether a Tatum webhook asset is compatible with the expected
 * Dynopay currency for an address.
 *
 * Returns:
 *   { valid: true, isGasFunding: false }  — Legitimate payment, process normally
 *   { valid: true, isGasFunding: true }   — Gas funding TX, skip payment processing
 *   { valid: false }                      — Unknown/spam token, reject
 */
function validateWebhookAsset(
  webhookAsset: string,
  expectedCurrency: string,
): { valid: boolean; isGasFunding: boolean; reason?: string } {
  if (!webhookAsset || !expectedCurrency) {
    return { valid: true, isGasFunding: false }; // Can't validate, allow through
  }

  const assetUpper = webhookAsset.toUpperCase().trim();
  const assetLower = webhookAsset.toLowerCase().trim();

  // 1. Check if the asset is a known Tatum asset name (e.g., "BTC", "USDT", "TRON")
  const compatibleCurrencies = TATUM_ASSET_TO_CURRENCY[assetUpper];

  if (compatibleCurrencies) {
    // 1a. Direct match: asset maps to the expected currency
    if (compatibleCurrencies.includes(expectedCurrency)) {
      return { valid: true, isGasFunding: false };
    }

    // 1b. Gas funding: asset is the native gas token for the expected currency's chain
    //     e.g., TRON arriving for USDT-TRC20 address = SmartGas funding
    const expectedGasToken = GAS_TOKEN_FOR_CURRENCY[expectedCurrency];
    if (expectedGasToken && assetUpper === expectedGasToken) {
      return { valid: true, isGasFunding: true };
    }

    // 1c. Known asset but wrong chain (e.g., ETH arriving for USDT-TRC20)
    return {
      valid: false,
      isGasFunding: false,
      reason: `Asset "${webhookAsset}" is valid but incompatible with expected currency "${expectedCurrency}" (compatible: ${compatibleCurrencies.join(", ")})`,
    };
  }

  // 2. FIX (2026-04-10): Check if asset is an ERC-20/TRC-20 contract address.
  //    Tatum sometimes sends the raw contract address (e.g., "0xdac17f958d2ee523a2206206994597c13d831ec7")
  //    instead of the human-readable name ("USDT"). This is legitimate for token transfers.
  const contractMatch = CONTRACT_ADDRESS_TO_CURRENCY[assetLower];
  if (contractMatch) {
    if (contractMatch.currencies.includes(expectedCurrency)) {
      return { valid: true, isGasFunding: false };
    }
    // Contract address is known but for a different currency
    return {
      valid: false,
      isGasFunding: false,
      reason: `Contract "${webhookAsset}" maps to ${contractMatch.currencies.join("/")} but expected "${expectedCurrency}"`,
    };
  }

  // 3. Reverse lookup: asset might be an internal Dynopay currency name (e.g., "USDT-TRC20")
  //    This happens when reconciliation re-queues using the internal currency format.
  for (const [tatumAsset, currencies] of Object.entries(TATUM_ASSET_TO_CURRENCY)) {
    if (currencies.includes(assetUpper) || currencies.includes(webhookAsset)) {
      if (assetUpper === expectedCurrency.toUpperCase() || currencies.includes(expectedCurrency)) {
        return { valid: true, isGasFunding: false };
      }
    }
  }

  // 4. Unknown asset — not in our supported list
  //    This catches spam/scam tokens like "ha138com", random TRC10 airdrops, etc.
  return {
    valid: false,
    isGasFunding: false,
    reason: `Unknown/unsupported asset "${webhookAsset}" — not a recognized Dynopay currency (possible spam/scam token)`,
  };
}

// ── Soft-enforcement helper ──────────────────────────────────────────────────
// Calls validateTransition() before every status change. Logs warnings for
// invalid transitions but NEVER throws — the payment flow always continues.
function softValidate(
  currentStatusRaw: string | undefined,
  newStatusRaw: string,
  paymentId: string,
  context: string,
): void {
  const currentState = parseState(currentStatusRaw);
  const nextState = parseState(newStatusRaw);

  if (!currentState || !nextState) {
    webhookLogs.warn(
      `[StateMachine] Unparseable status in ${context}: ` +
      `"${currentStatusRaw}" → "${newStatusRaw}" (payment ${paymentId})`
    );
    return;
  }

  validateTransition(currentState, nextState, paymentId, context);
}

// Build a set of all admin/fee wallet addresses for fast lookup (lowercase for case-insensitive match)
const INTERNAL_WALLETS = new Set(
  [...Object.values(ADMIN_WALLETS), ...Object.values(FEE_WALLETS)]
    .filter(Boolean)
    .map((addr) => addr.toLowerCase())
);

// Hard failures that should NOT be retried
// NOTE: "403" removed — Tatum returns 403 for temporary gas-related "Insufficient funds" on ERC-20 transfers.
// These are retryable when gas funding TX is in-flight. "401" kept (auth errors are permanent).
const NON_RETRYABLE_ERRORS = [
  "invalid address", "invalid private key",
  "nonce too low", "already known", "bad request",
  "400", "401", "404",
];

// Errors that look non-retryable but ARE retryable when caused by gas funding race conditions.
// e.g. Tatum's "Insufficient funds send transaction from account 0x... -> available balance is 0"
// during eth.tx.preparation means ETH gas hasn't arrived yet — temporary, not permanent.
const GAS_RACE_RETRYABLE_PATTERNS = [
  "eth.tx.preparation",
  "insufficient funds send transaction",
  "available balance is 0, required balance",
];

const isRetryable = (error: Error): boolean => {
  const message = error.message?.toLowerCase() || "";

  // Gas race condition errors are ALWAYS retryable (gas TX may still be confirming)
  if (GAS_RACE_RETRYABLE_PATTERNS.some((p) => message.includes(p.toLowerCase()))) {
    return true;
  }

  // "insufficient balance" is non-retryable UNLESS it's a gas race condition (handled above)
  if (message.includes("insufficient balance")) {
    return false;
  }

  return !NON_RETRYABLE_ERRORS.some((pattern) => message.includes(pattern.toLowerCase()));
};

/**
 * Detect whether an incoming Tatum webhook actually describes one of OUR OWN outgoing
 * transactions (a merchant payout, gas-funding transfer, or fee sweep) rather than a real
 * customer payment.
 *
 * Why this exists: Tatum can (re-)deliver a webhook for a transaction WE sent — e.g. a merchant
 * payout where funds move from a pool deposit address → the merchant's wallet. From the merchant
 * wallet's perspective that looks like an INCOMING transfer (address = merchant wallet,
 * counterAddress = our pool address). If reconciliation re-queues such a (previously failed)
 * webhook, the processor would otherwise treat it as a brand-new payment and fire a spurious
 * "payment pending" email — and, if a live payment session existed, risk double-processing.
 *
 * Detects OUR OWN outgoing transactions (merchant payouts / gas funding / sweeps) that a
 * Tatum ADDRESS_EVENT subscription may report back to us — we broadcast them, so they must
 * NOT be treated as new incoming customer payments. If we don't filter these, a stale/replayed
 * webhook, the processor would otherwise treat it as a brand-new payment and fire a spurious
 * "payment pending" email — and, if a live payment session existed, risk double-processing.
 *
 * Detection strategy — match `payload.txId` against transactions we ourselves broadcast:
 *   (A) `merchant_tx_id` in tbl_merchant_pool_transaction — outgoing merchant settlements
 *   (B) `gas_funding_tx_id` in tbl_merchant_pool_transaction — fee wallet → pool gas top-ups
 *   (C) `sweep_tx_id`  or `gas_funding_tx_id` in tbl_merchant_pool_sweep — admin fee sweeps
 *
 * NOTE on the previous "counterAddress-as-sender" heuristic: Tatum's ADDRESS_EVENT payload
 * DOES NOT reliably use `counterAddress` for the sender. Empirically, for ERC-20 INCOMING
 * transfers, Tatum sends `address = sender` and `counterAddress = our subscribed receiver`.
 * The old heuristic then found OUR receiving pool address in tbl_merchant_temp_address and
 * incorrectly flagged legitimate customer payments as "our own outgoing", silently dropping
 * them (see commit 61cc2422 fix). The tx-hash-based approach above is 100% accurate — we
 * ALWAYS persist our outgoing hashes before/immediately after broadcast, so any webhook
 * about a tx we sent will match. If persistence fails for some reason, the downstream
 * "no Redis session" branch already correctly ignores the unknown tx.
 *
 * Returns a short reason string when it IS our own outgoing tx, otherwise null.
 * Callers MUST fail-open (treat errors as "not ours") so a genuine payment is never dropped.
 */
async function isOwnOutgoingTransaction(payload: WebhookJobData["payload"]): Promise<string | null> {
  if (!payload.txId) return null;

  const { merchantPoolTransactionModel, merchantPoolSweepModel } = await import("../models");

  // (A + B) Match against outgoing settlement / gas-funding txs
  const knownPoolTx = await merchantPoolTransactionModel.findOne({
    where: { [Op.or]: [{ merchant_tx_id: payload.txId }, { gas_funding_tx_id: payload.txId }] },
    attributes: ["pool_tx_id", "merchant_tx_id", "gas_funding_tx_id"],
  });
  if (knownPoolTx) {
    const anyRow = knownPoolTx as unknown as { merchant_tx_id: string | null; gas_funding_tx_id: string | null };
    if (anyRow.merchant_tx_id === payload.txId) return "known_merchant_settlement";
    if (anyRow.gas_funding_tx_id === payload.txId) return "known_gas_funding";
    return "known_settlement_tx";
  }

  // (C) Match against admin fee sweeps
  const knownSweepTx = await merchantPoolSweepModel.findOne({
    where: { [Op.or]: [{ sweep_tx_id: payload.txId }, { gas_funding_tx_id: payload.txId }] },
    attributes: ["sweep_id"],
  });
  if (knownSweepTx) return "known_admin_sweep";

  return null;
}

/**
 * Process a Tatum webhook job.
 * This is the full processing pipeline — called from the BullMQ worker.
 */
export async function processWebhookJob(data: WebhookJobData): Promise<void> {
  const payload = data.payload;
  const queryCompanyId = data.queryParams.company_id || null;
  const queryUserId = data.queryParams.user_id || null;
  const queryAddressId = data.queryParams.address_id || null;

  webhookLogs.info("[WebhookProcessor] Processing webhook:", {
    address: payload.address,
    amount: payload.amount,
    currency: (payload as Record<string, unknown>).currency || payload.asset,
    txId: payload.txId,
    source: data.source,
  });
  // Direct console.log backup — ensures Railway captures critical payment processing events
  // even if Winston buffers during high-load periods (e.g., concurrent cron lock noise)
  log(`[WebhookProcessor] 🔄 Processing: addr=${payload.address}, amount=${payload.amount}, asset=${payload.asset || (payload as any).currency}, tx=${payload.txId}`);

  // ── 1. Duplicate detection ────────────────────────────────────────────────
  // Skip dedup for reconciliation source — these are explicitly re-queued failed
  // payments that NEED re-processing. The dedup key may have been set during a
  // previous attempt that "completed" without actually settling.
  const processedTxKey = `processed-tx-${payload.txId}`;
  if (payload.source !== 'reconciliation') {
    const alreadyProcessed = await getRedisItem(processedTxKey);
    if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
      webhookLogs.info("[WebhookProcessor] Transaction already processed, skipping:", payload.txId);
      return;
    }
  } else {
    // Clear stale dedup key so settlement can proceed
    await deleteRedisItem(processedTxKey);
    webhookLogs.info("[WebhookProcessor] Reconciliation source — cleared dedup key for retry:", payload.txId);
  }

  // ── 2. Atomic lock to prevent race conditions ─────────────────────────────
  const lockAcquired = await acquireLock(`tatum-webhook-${payload.txId}`, 300, 1, 50);
  if (!lockAcquired) {
    webhookLogs.info("[WebhookProcessor] Already being processed by another worker, skipping:", payload.txId);
    return;
  }
  webhookLogs.info("[WebhookProcessor] Acquired processing lock for tx:", payload.txId);

  try {
    // ── 3. Internal wallet filter ─────────────────────────────────────────────
    const counterAddr = (payload.counterAddress || "").toLowerCase();
    if (counterAddr && INTERNAL_WALLETS.has(counterAddr)) {
      webhookLogs.info(`[WebhookProcessor] Ignoring internal transfer to admin wallet: ${payload.counterAddress}`);
      await setRedisItem(processedTxKey, { processed: true, type: "internal_sweep", timestamp: new Date().toISOString() });
      await setRedisTTL(processedTxKey, 86400);
      return;
    }

    // ── 3b. Ignore OUR OWN outgoing transactions (merchant payouts / gas funding / sweeps) ────
    // A stale or previously-failed Tatum webhook for a transaction WE sent (e.g. a merchant
    // payout: pool address → merchant wallet) can be re-delivered / reconciled and misread as a
    // brand-new INCOMING payment, producing a spurious "payment pending" email (and, if a live
    // session existed, risking double-processing). Detect and skip these. Fail-open on error so a
    // genuine customer payment is never dropped.
    try {
      const ownOutgoing = await isOwnOutgoingTransaction(payload);
      if (ownOutgoing) {
        webhookLogs.info(`[WebhookProcessor] Ignoring our own outgoing tx (${ownOutgoing}): txId=${payload.txId} from=${payload.counterAddress} to=${payload.address}`);
        await setRedisItem(processedTxKey, { processed: true, type: `own_outgoing_${ownOutgoing}`, timestamp: new Date().toISOString() });
        await setRedisTTL(processedTxKey, 86400);
        return;
      }
    } catch (err) {
      webhookLogs.warn(`[WebhookProcessor] own-outgoing check failed (continuing with normal processing): ${(err as Error).message}`);
    }

    // ── 4. Address resolution (BCH + tag-based chains) ────────────────────────
    let address = payload.address;
    let items = await getRedisItem("crypto-" + address);

    // BCH CashAddr normalization
    if ((!items || Object.keys(items).length === 0) && address && !address.startsWith("bitcoincash:")) {
      const bchFullAddr = `bitcoincash:${address}`;
      const bchItems = await getRedisItem("crypto-" + bchFullAddr);
      if (bchItems && Object.keys(bchItems).length > 0) {
        webhookLogs.info(`[WebhookProcessor] BCH CashAddr resolved: ${address} → ${bchFullAddr}`);
        address = bchFullAddr;
        items = bchItems;
      }
    }

    // Tag-based chain handling (XRP, RLUSD)
    let resolvedDestinationTag: number | null = null;
    const isMasterAddress = address?.toLowerCase() === XRP_MASTER_ADDRESS?.toLowerCase();

    if (isMasterAddress || (!items || Object.keys(items).length === 0)) {
      if (isMasterAddress && payload.txId) {
        webhookLogs.info(`[WebhookProcessor] Master address detected, fetching destination tag from tx ${payload.txId}...`);
        resolvedDestinationTag = await tatumApi.getXrpDestinationTag(payload.txId);

        if (resolvedDestinationTag !== null) {
          const tagRedisKey = getCryptoRedisKey(address, resolvedDestinationTag);
          webhookLogs.info(`[WebhookProcessor] Destination tag: ${resolvedDestinationTag}, Redis key: ${tagRedisKey}`);
          items = await getRedisItem(tagRedisKey);
        } else {
          webhookLogs.error(`[WebhookProcessor] TAGLESS XRP PAYMENT — TX: ${payload.txId}, Amount: ${payload.amount}`);
        }
      }
    }

    // Fallback to counterAddress
    if (!items || Object.keys(items).length === 0) {
      webhookLogs.info("[WebhookProcessor] No Redis data for primary address, checking counterAddress");
      address = payload.counterAddress;
      items = await getRedisItem("crypto-" + address);

      // BCH normalization for counterAddress
      if ((!items || Object.keys(items).length === 0) && address && !address.startsWith("bitcoincash:")) {
        const bchFullAddr = `bitcoincash:${address}`;
        const bchItems = await getRedisItem("crypto-" + bchFullAddr);
        if (bchItems && Object.keys(bchItems).length > 0) {
          address = bchFullAddr;
          items = bchItems;
        }
      }

      // counterAddress as master address
      if ((!items || Object.keys(items).length === 0) && address?.toLowerCase() === XRP_MASTER_ADDRESS?.toLowerCase() && payload.txId) {
        if (resolvedDestinationTag === null) {
          resolvedDestinationTag = await tatumApi.getXrpDestinationTag(payload.txId);
        }
        if (resolvedDestinationTag !== null) {
          const tagRedisKey = getCryptoRedisKey(address, resolvedDestinationTag);
          items = await getRedisItem(tagRedisKey);
        }
      }
    }

    if (!items || Object.keys(items).length === 0) {
      webhookLogs.info("[WebhookProcessor] No Redis data found, ignoring webhook");
      // Mark as processed so reconciliation doesn't re-queue this TX on every restart
      await setRedisItem(processedTxKey, { processed: true, type: "no_matching_payment", timestamp: new Date().toISOString() });
      await setRedisTTL(processedTxKey, 172800); // 48h guard
      return;
    }

    // Construct the Redis key that matched
    const redisKey = resolvedDestinationTag !== null
      ? getCryptoRedisKey(address, resolvedDestinationTag)
      : `crypto-${address}`;

    // Enrich items with company info from URL query params
    if (queryCompanyId && !items.company_id) items.company_id = queryCompanyId;
    if (queryUserId && !items.user_id) items.user_id = queryUserId;

    webhookLogs.info("[WebhookProcessor] Redis data found:", {
      currency: items.currency,
      expectedAmount: items.amount,
      payment_id: items.payment_id,
      company_id: items.company_id || queryCompanyId,
      hasTxId: !!items.txId,
      status: items.status || 'unknown',
      webhook_url: items.webhook_url || '(not set)',
      callback_url: items.callback_url || '(not set)',
      link_id: items.link_id || null,
    });

    // ── ASSET VALIDATION: Reject spam/scam tokens ───────────────────────────
    const webhookAsset = payload.asset || (payload as Record<string, any>).currency || '';
    const expectedCurrency = items.currency;
    if (webhookAsset && expectedCurrency) {
      const assetValidation = validateWebhookAsset(webhookAsset, expectedCurrency);
      
      if (assetValidation.isGasFunding) {
        webhookLogs.info(
          `[WebhookProcessor] ⛽ Gas funding TX detected: asset="${webhookAsset}" for ${expectedCurrency} address — skipping payment processing`,
          { address, txId: payload.txId, amount: payload.amount }
        );
        // Mark as processed so reconciliation doesn't re-queue this TX on every restart
        await setRedisItem(processedTxKey, { processed: true, type: "gas_funding", timestamp: new Date().toISOString() });
        await setRedisTTL(processedTxKey, 172800); // 48h guard
        return;
      }

      if (!assetValidation.valid) {
        webhookLogs.warn(
          `[WebhookProcessor] ⛔ ASSET MISMATCH — rejecting webhook: ${assetValidation.reason}`,
          {
            address,
            txId: payload.txId,
            webhookAsset,
            expectedCurrency,
            amount: payload.amount,
            payment_id: items.payment_id,
          }
        );
        // Journal the rejection for audit trail (non-blocking)
        try {
          const { journalStateTransition } = require("./paymentReliability");
          await journalStateTransition({
            paymentId: items.payment_id || `addr-${address}`,
            txId: payload.txId,
            address,
            // FIX (2026-07-17): `currency` column is VARCHAR(20). webhookAsset is a
            // 42-char contract hex (e.g. 0xdac17f958d2ee523a2206206994597c13d831ec7),
            // which overflows and previously threw `value too long for type
            // character varying(20)`. Use the merchant-facing symbol (max 20 chars)
            // and keep the raw contract in metadata for auditability.
            currency: (expectedCurrency || 'unknown').slice(0, 20),
            event: 'spam_token_rejected',
            fromState: items.status || 'unknown',
            toState: items.status || 'unknown',
            amount: Number(payload.amount),
            companyId: Number(items?.company_id || queryCompanyId) || null,
            metadata: {
              reason: assetValidation.reason,
              expectedCurrency,
              webhookAsset,
            },
          });
        } catch (_journalErr) { /* non-blocking */ }
        // Mark as processed so reconciliation doesn't re-queue this TX on every restart
        await setRedisItem(processedTxKey, { processed: true, type: "asset_mismatch_rejected", timestamp: new Date().toISOString() });
        await setRedisTTL(processedTxKey, 172800); // 48h guard
        return;
      }

      webhookLogs.info(`[WebhookProcessor] ✅ Asset validated: "${webhookAsset}" → "${expectedCurrency}"`);
    }

    // ── PAYMENT-LEVEL GUARD: Prevent parallel settlement of same payment ────
    // Two different txIds can arrive for the same payment_id within seconds
    // (e.g., a real USDT transfer + a native TRX dust/gas change). Even though
    // Fix 1 (asset validation) blocks most of these, this guard provides
    // defense-in-depth against any race condition on the same payment.
    const paymentId_guard = items.payment_id || items.ref;
    if (paymentId_guard) {
      const paymentSettlementKey = `payment-settlement-lock-${paymentId_guard}`;
      const existingSettlement = await getRedisItem(paymentSettlementKey);
      if (existingSettlement) {
        // Block if settlement already completed for this payment
        if (existingSettlement.status === "completed") {
          webhookLogs.info(
            `[WebhookProcessor] ⚠️ PAYMENT GUARD: Payment ${paymentId_guard} already settled by TX ${existingSettlement.txId}. Skipping TX ${payload.txId}.`
          );
          return;
        }
        // Block if another TX is actively being settled (< 2 min)
        if (existingSettlement.status === "in_progress") {
          const startedAt = new Date(existingSettlement.started_at as string).getTime();
          const elapsed = Date.now() - startedAt;
          if (elapsed < 120000) {
            webhookLogs.info(
              `[WebhookProcessor] ⚠️ PAYMENT GUARD: Payment ${paymentId_guard} already being settled by TX ${existingSettlement.txId} (${Math.round(elapsed / 1000)}s ago). Skipping TX ${payload.txId} to prevent race condition.`
            );
            return;
          }
          // If > 2 minutes, consider stale and allow re-processing
          webhookLogs.warn(
            `[WebhookProcessor] Payment settlement lock for ${paymentId_guard} is stale (${Math.round(elapsed / 1000)}s), proceeding with TX ${payload.txId}`
          );
        }
      }
    }

    // ── RELIABILITY: Journal payment detection to PostgreSQL ──
    // FIX (2026-07-17): DEFER this journal until AFTER amount + terminal-state guards
    // pass. Previously we journaled `payment_detected` here unconditionally, so
    // 0-value dust attacks (spam Transfer(from=temp, value=0)) or duplicate webhooks
    // for an already-settled payment would REGRESS its journal state from
    // `successful` back to `processing`, making a fully-settled payment look
    // "stuck" to the merchant. The journal write is now performed once the
    // webhook has passed the amount validation and status idempotency checks
    // (see below, right before the settlement flow starts).

    // ── 5. Amount validation ──────────────────────────────────────────────────
    const incomingAmount = Number(payload.amount);
    if (!Number.isFinite(incomingAmount) || incomingAmount <= 0) {
      webhookLogs.info("[WebhookProcessor] Invalid amount, ignoring");
      return;
    }

    // ── 6. Status checks (using state machine for terminal detection) ─────────
    const isFirstTransaction = !items.txId;
    const isCompletionPayment = String(items.incomplete) === "true" && items.txId !== payload.txId;
    const currentParsedState = parseState(items.status);
    const isAlreadySuccessful = currentParsedState === PaymentState.PAYOUT_COMPLETE;

    if (isAlreadySuccessful) {
      webhookLogs.info("[WebhookProcessor] Payment already successful, ignoring for tx:", payload.txId);
      return;
    }

    // ── RELIABILITY (deferred from earlier): Journal payment_detected ──
    // Now that amount is > 0 AND the payment is not already terminal, it is safe
    // to record `payment_detected` in the durable journal. Doing this earlier
    // caused dust/duplicate webhooks to regress the state of settled payments.
    try {
      const { journalStateTransition } = require("./paymentReliability");
      await journalStateTransition({
        paymentId: items.payment_id || items.ref || `addr-${address}`,
        txId: payload.txId,
        address,
        currency: items?.currency || payload.asset || 'unknown',
        event: 'payment_detected',
        fromState: items.status || 'unknown',
        toState: 'processing',
        amount: incomingAmount,
        companyId: Number(items?.company_id || queryCompanyId) || null,
        metadata: { source: data.source, expectedAmount: items.amount },
      });
    } catch (_journalErr) { /* non-blocking */ }

    // ── 6b. Failed payment recovery ──────────────────────────────────────────
    // When a previous attempt set txId but failed settlement (e.g., UTXO fee mismatch,
    // balance NaN, gas_pending, or crash during processing), allow re-processing instead
    // of treating as duplicate. The txId exists in Redis but the payment never completed —
    // BullMQ retries and reconciliation must be able to retry.
    const isRecoverableState = currentParsedState === PaymentState.FAILED
      || currentParsedState === PaymentState.DETECTED
      || currentParsedState === PaymentState.PROCESSING
      || String(items.status) === 'gas_pending'
      || String(items.status) === 'permanently_failed';
    const isFailedPayment = isRecoverableState
      && !!items.txId
      && items.txId === payload.txId;

    if (isFailedPayment) {
      const retryCount = parseInt(items.retryCount || "0") || 0;
      const MAX_RECOVERY_RETRIES = 3;

      // ── Permanent failure detection ─────────────────────────────────────────
      // Some errors are permanently unrecoverable (balance=0, funds already moved).
      // Don't waste API calls retrying these.
      // IMPORTANT: Gas-related errors (eth.tx.preparation) are NOT permanent — gas TX may still be confirming.
      const lastError = items.lastError || "";
      const isGasRaceCondition = GAS_RACE_RETRYABLE_PATTERNS.some((p) => lastError.toLowerCase().includes(p.toLowerCase()));
      const isBalanceZero = !isGasRaceCondition && /balance \[0\]|token balance \[0\]/i.test(lastError);
      const isPermanentlyFailed = retryCount >= MAX_RECOVERY_RETRIES || isBalanceZero;

      if (isPermanentlyFailed) {
        webhookLogs.info(`[WebhookProcessor] PERMANENTLY FAILED: Payment ${items.payment_id || items.ref} — retryCount=${retryCount}, balanceZero=${isBalanceZero}, error: ${lastError.slice(0, 150)}`);
        // Mark as permanently_failed to stop all future retry attempts
        await setRedisItem(redisKey, {
          ...items,
          status: "permanently_failed",
          permanentlyFailedAt: new Date().toISOString(),
          permanentFailReason: isBalanceZero ? "temp_address_balance_zero" : "max_retries_exceeded",
        });
        return; // Do NOT retry — this payment is dead
      }

      webhookLogs.info(`[WebhookProcessor] FAILED PAYMENT RECOVERY: Retrying settlement for payment ${items.payment_id || items.ref} (attempt ${retryCount + 1}/${MAX_RECOVERY_RETRIES}), previous error: ${lastError || "unknown"}`);

      // Reset status to allow re-processing through the normal flow
      await setRedisItem(redisKey, {
        ...items,
        status: "pending",
        txId: undefined,  // Clear txId so isFirstTransaction = true
        lastError: undefined,
        failedAt: undefined,
        retryCount: String(retryCount + 1),
        lastRetryAt: new Date().toISOString(),
      });
      // Re-read the updated items
      items = await getRedisItem(redisKey) || items;
    }

    // ── 7. Crash recovery for stale "processing" payments ─────────────────────
    // Re-derive state flags after potential failed-payment recovery (items may have been reset)
    const effectiveIsFirstTransaction = !items.txId;
    const effectiveIsCompletionPayment = String(items.incomplete) === "true" && items.txId !== payload.txId;
    const effectiveParsedState = parseState(items.status);

    const isStaleProcessing = (effectiveParsedState === PaymentState.PROCESSING
        || effectiveParsedState === PaymentState.DETECTED)
      && !!items.txId
      && items.lastAttempt
      && (Date.now() - new Date(items.lastAttempt as string).getTime()) > 60000;

    if (isStaleProcessing && incomingAmount > 0) {
      webhookLogs.info("[WebhookProcessor] CRASH RECOVERY: Payment stuck in 'processing' state");
      await handleCrashRecovery(address, redisKey, items, payload, incomingAmount);
      return;
    }

    // ── 8. Main processing path ───────────────────────────────────────────────
    if ((effectiveIsFirstTransaction || effectiveIsCompletionPayment) && incomingAmount > 0) {
      await handleNewTransaction(
        address, redisKey, items, payload,
        incomingAmount, effectiveIsCompletionPayment, effectiveIsFirstTransaction,
        queryCompanyId
      );
    } else {
      webhookLogs.info("[WebhookProcessor] Duplicate transaction or txId already exists, ignoring");
    }

  } finally {
    // Always release the lock
    await releaseLock(`tatum-webhook-${payload.txId}`);
  }
}

// ── Crash Recovery Handler ────────────────────────────────────────────────────
async function handleCrashRecovery(
  address: string,
  redisKey: string,
  items: Record<string, any>,
  payload: WebhookJobData["payload"],
  incomingAmount: number
): Promise<void> {
  webhookLogs.info(`[WebhookProcessor] Recovery: payment_id=${items.payment_id}, stale since ${items.lastAttempt}`);

  const paymentId = items.payment_id || items.ref || "unknown";

  try {
    const recoveryResult = await paymentController.cryptoVerification(address, true, redisKey) as { duplicate?: boolean; status?: number; message?: string };
    if (recoveryResult && recoveryResult.status && recoveryResult.status >= 400) {
      throw new Error(`Recovery cryptoVerification returned error ${recoveryResult.status}: ${recoveryResult.message || "Settlement failed"}`);
    }
    // ── DUPLICATE GUARD: Stop crash recovery from replaying completed payments ──
    if (recoveryResult && recoveryResult.duplicate) {
      webhookLogs.warn(`[WebhookProcessor] ⛔ Recovery: cryptoVerification returned duplicate=true. Payment already settled, skipping.`);
      await setRedisItem(`processed-tx-${payload.txId}`, {
        address, payment_id: items.payment_id || items.ref,
        amount: items.receivedAmount || incomingAmount,
        processed_at: new Date().toISOString(), duplicate_blocked: true,
      });
      await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
      return; // EXIT — no recovery webhooks
    }
    webhookLogs.info("[WebhookProcessor] Recovery: cryptoVerification completed successfully");

    // Soft-enforce: processing → successful (PROCESSING → PAYOUT_COMPLETE)
    softValidate(items.status, "successful", paymentId, "crash-recovery-success");
    publishCheckoutStatus(address, "confirmed", { txId: payload.txId, recovered: true });

    await setRedisItem(redisKey, {
      ...items,
      status: "successful",
      txId: payload.txId,
      receivedAmount: items.receivedAmount || incomingAmount,
      completedAt: new Date().toISOString(),
      recoveredAt: new Date().toISOString(),
    });
    await setRedisTTL(redisKey, 1800);

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: items.receivedAmount || incomingAmount,
      processed_at: new Date().toISOString(), recovered: true,
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);

  } catch (recoveryError: unknown) {
    const err = recoveryError as { message?: string };
    webhookLogs.error("[WebhookProcessor] Recovery cryptoVerification failed:", err.message);
    webhookLogs.info("[WebhookProcessor] Attempting direct webhook delivery as recovery fallback...");

    try {
      let customerData = items?.ref ? await getRedisItem(items.ref) : null;
      if (!customerData || Object.keys(customerData).length === 0) customerData = items;

      if (customerData && customerData !== items) {
        if (!customerData.webhook_url && items?.webhook_url) customerData.webhook_url = items.webhook_url;
        if (!customerData.callback_url && items?.callback_url) customerData.callback_url = items.callback_url;
        if (!customerData.webhook_secret && items?.webhook_secret) customerData.webhook_secret = items.webhook_secret;
        if (!customerData.company_id && items?.company_id) customerData.company_id = items.company_id;
        if (!customerData.link_id && items?.link_id) customerData.link_id = items.link_id;
      }

      if (customerData) {
        const linkId = customerData?.link_id || items?.link_id || null;
        const paymentType = linkId ? "payment_link" : "direct_api";

        await deliverMerchantWebhook(customerData, {
          event: "payment.confirmed",
          payment_type: paymentType,
          payment_id: items?.payment_id || items?.unique_tx_id,
          transaction_reference: items.txId,
          status: "successful",
          payment_status: "confirmed",
          amount: parseFloat(items.receivedAmount as string) || incomingAmount,
          currency: items?.currency || payload.asset,
          base_amount: customerData?.base_amount || items?.base_amount_usd || null,
          base_currency: customerData?.base_currency || "USD",
          customer_name: customerData?.customer_name || null,
          customer_email: customerData?.email || null,
          description: customerData?.description || null,
          link_id: linkId,
          fee_payer: customerData?.fee_payer || items?.fee_payer || "company",
          recovered: true,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      }
    } catch (webhookErr) {
      webhookLogs.error("[WebhookProcessor] Recovery direct webhook error:", webhookErr);
    }

    // Soft-enforce: processing → recovered (PROCESSING → PAYOUT_COMPLETE via legacy map)
    softValidate(items.status, "recovered", paymentId, "crash-recovery-fallback");

    await setRedisItem(redisKey, {
      ...items,
      status: "recovered",
      recoveredAt: new Date().toISOString(),
      recoveryNote: "Settlement completed on-chain, direct webhook sent as fallback",
    });
    await setRedisTTL(redisKey, 1800);

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: items.receivedAmount || incomingAmount,
      processed_at: new Date().toISOString(), recovered: true,
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
  }
}

// ── New Transaction Handler ───────────────────────────────────────────────────
async function handleNewTransaction(
  address: string,
  redisKey: string,
  items: Record<string, any>,
  payload: WebhookJobData["payload"],
  incomingAmount: number,
  isCompletionPayment: boolean,
  isFirstTransaction: boolean,
  queryCompanyId: number | null
): Promise<void> {
  const paymentId = items.payment_id || items.ref || "unknown";

  if (isCompletionPayment) {
    webhookLogs.info(`[WebhookProcessor] COMPLETION payment: prev=${items.txId}, new=${payload.txId}`);
  } else {
    webhookLogs.info("[WebhookProcessor] First transaction detected, processing...");
  }

  // ── CRITICAL: DB-level duplicate check BEFORE any merchant webhooks ──────
  // This prevents reconciliation replays from sending ghost webhooks to merchants
  // for transactions that were already settled days ago. Redis-based dedup keys
  // expire (TTL 48h), but DB records are permanent.
  try {
    const { customerTransactionModel } = await import("../models");
    const existingCompletedTx = await customerTransactionModel.findOne({
      where: {
        transaction_reference: payload.txId,
        status: { [Op.in]: ["successful", "completed"] }
      }
    });

    if (existingCompletedTx) {
      webhookLogs.warn(`[WebhookProcessor] ⛔ DUPLICATE BLOCKED: txId ${payload.txId} already completed in DB (record #${existingCompletedTx.dataValues?.id}). Skipping ALL merchant webhooks.`);
      // Re-set the processed-tx key so future reconciliation runs also skip it
      await setRedisItem(`processed-tx-${payload.txId}`, {
        address, payment_id: items.payment_id || items.ref,
        amount: incomingAmount, processed_at: new Date().toISOString(),
        duplicate_blocked: true,
      });
      await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
      return; // EXIT — do NOT send any webhooks
    }
  } catch (dbCheckErr) {
    // Non-blocking: if DB check fails, continue with normal flow
    // (better to risk a duplicate than block a legitimate payment)
    webhookLogs.warn(`[WebhookProcessor] DB duplicate check failed (non-blocking): ${(dbCheckErr as Error).message}`);
  }

  // Get customer data
  let customerData = await getRedisItem(items?.ref);
  if (!customerData || Object.keys(customerData).length === 0) {
    try {
      const tempId = items?.temp_id;
      if (tempId) {
        const { Sequelize } = require("sequelize");
        const sequelize = require("../utils/dbInstance").default;
        const [tempAddr] = await sequelize.query(
          `SELECT owner_user_id, current_company_id FROM tbl_merchant_temp_address WHERE temp_address_id = :tempId`,
          { replacements: { tempId }, type: Sequelize.QueryTypes.SELECT }
        );
        if (tempAddr) {
          customerData = { adm_id: tempAddr.owner_user_id, company_id: tempAddr.current_company_id };
        }
      }
    } catch (dbErr) {
      webhookLogs.error("[WebhookProcessor] Error fetching customerData from DB:", dbErr);
    }
  }

  // Merge webhook info
  if (customerData) {
    if (!customerData.webhook_url && items?.webhook_url) customerData.webhook_url = items.webhook_url;
    if (!customerData.callback_url && items?.callback_url) customerData.callback_url = items.callback_url;
    if (!customerData.webhook_secret && items?.webhook_secret) customerData.webhook_secret = items.webhook_secret;
    if (!customerData.company_id && items?.company_id) customerData.company_id = items.company_id;
    if (!customerData.link_id && items?.link_id) customerData.link_id = items.link_id;
  }

  // Send pending notification
  if (customerData && customerData.adm_id) {
    try {
      await sendPendingPaymentNotification(address, payload.txId, incomingAmount, items?.currency || payload.asset, customerData);

      const linkIdPending = customerData?.link_id || null;
      const paymentTypePending = linkIdPending ? "payment_link" : "direct_api";
      // FIX (2026-04-12): Fire-and-forget — don't block settlement waiting for merchant server
      deliverMerchantWebhook(customerData, {
        event: "payment.pending",
        payment_type: paymentTypePending,
        address, txId: payload.txId,
        transaction_reference: payload.txId,
        amount: incomingAmount,
        currency: items?.currency || payload.asset,
        payment_id: items?.payment_id || items?.unique_tx_id,
        status: "pending",
        payment_status: "pending",
        base_amount: customerData?.base_amount || items?.base_amount_usd || null,
        base_currency: customerData?.base_currency || "USD",
        customer_name: customerData?.customer_name || null,
        customer_email: customerData?.email || null,
        description: customerData?.description || null,
        link_id: linkIdPending,
        fee_payer: customerData?.fee_payer || items?.fee_payer || "company",
        meta_data: customerData?.meta_data ? (typeof customerData.meta_data === 'string' ? JSON.parse(customerData.meta_data) : customerData.meta_data) : null,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      }).catch(pendingWebhookErr => {
        webhookLogs.error("[WebhookProcessor] payment.pending webhook failed (non-blocking):", pendingWebhookErr);
      });
    } catch (notifError) {
      webhookLogs.error("[WebhookProcessor] Error sending pending notification:", notifError);
    }
  }

  // ── Underpayment logic ──────────────────────────────────────────────────────
  let expectedAmount = parseFloat(items?.amount || "0");
  let totalReceivedAmount = incomingAmount;

  if (isCompletionPayment) {
    const previousAmount = parseFloat(items?.previousAmount || "0");
    totalReceivedAmount = previousAmount + incomingAmount;
    expectedAmount = parseFloat(items?.originalExpectedAmount || "0") || (expectedAmount + previousAmount);
  }

  // Dust threshold: if the shortfall is ≤ 0.1% of the expected amount OR ≤ 100 base units
  // (satoshis/litoshis/etc.), treat as fully paid. Tiny differences are caused by
  // Bitcoin network fee rounding at the sender's wallet (e.g., 17 sats = $0.002).
  const shortfallRaw = expectedAmount - totalReceivedAmount;
  const shortfallPercentage = expectedAmount > 0 ? (shortfallRaw / expectedAmount) * 100 : 0;
  const shortfallBaseUnits = Number(toBaseUnits(shortfallRaw));
  const DUST_THRESHOLD_PERCENT = 0.1;   // 0.1% of expected amount
  const DUST_THRESHOLD_UNITS = 100;     // 100 satoshis/litoshis (≈$0.07 at $68k BTC)
  const isDustShortfall = shortfallRaw > 0
    && (shortfallPercentage <= DUST_THRESHOLD_PERCENT || shortfallBaseUnits <= DUST_THRESHOLD_UNITS);

  if (isDustShortfall) {
    webhookLogs.info(`[WebhookProcessor] Dust shortfall accepted: ${shortfallBaseUnits} base units (${toFixedStr(shortfallPercentage, 4)}%) — treating as full payment`);
  }

  const isUnderpayment = totalReceivedAmount < expectedAmount && expectedAmount > 0 && !isDustShortfall;

  // Fetch merchant underpayment threshold
  let underpaymentThresholdUsd = 1;
  let underpaymentAmountUsd = 0;
  let merchantGracePeriodMinutes = 30;

  if (isUnderpayment) {
    const shortfallCrypto = expectedAmount - totalReceivedAmount;
    const baseAmountUsd = parseFloat(items?.base_amount || customerData?.base_amount || "0");
    if (baseAmountUsd > 0 && expectedAmount > 0) {
      underpaymentAmountUsd = (shortfallCrypto / expectedAmount) * baseAmountUsd;
    }

    if (customerData?.company_id) {
      try {
        const { companyModel } = await import("../models");
        const company = await companyModel.findOne({ where: { company_id: customerData.company_id } });
        if (company?.dataValues?.underpayment_threshold_usd !== undefined && company?.dataValues?.underpayment_threshold_usd !== null) {
          underpaymentThresholdUsd = parseFloat(company.dataValues.underpayment_threshold_usd);
        }
        if (company?.dataValues?.grace_period_minutes !== undefined && company?.dataValues?.grace_period_minutes !== null) {
          merchantGracePeriodMinutes = Math.min(parseInt(String(company.dataValues.grace_period_minutes)), 30);
        }
      } catch (_e) { /* use defaults */ }
    }
  }

  const linkIdForThreshold = customerData?.link_id || items?.link_id || null;
  const isMinorUnderpayment = isUnderpayment && !!linkIdForThreshold && underpaymentAmountUsd <= underpaymentThresholdUsd;

  // Handle underpayment for payment links (wait for remaining)
  if (isUnderpayment && !isMinorUnderpayment) {
    const linkIdUnderpaid = customerData?.link_id || items?.link_id || null;
    const isDirectApi = !linkIdUnderpaid;

    if (isDirectApi) {
      // Direct API: process immediately with received amount
      // Soft-enforce: pending → processing (PENDING → PROCESSING — skips DETECTED)
      softValidate(items.status, "processing", paymentId, "direct-api-underpayment");

      await setRedisItem(redisKey, {
        ...items, status: "processing", txId: payload.txId,
        receivedAmount: totalReceivedAmount, originalExpectedAmount: expectedAmount,
        lastAttempt: new Date().toISOString(),
      });

      if (customerData && customerData.company_id) {
        await deliverMerchantWebhook(customerData, {
          event: "payment.underpaid", payment_type: "direct_api",
          address, txId: payload.txId,
          transaction_reference: payload.txId,
          amount_received: totalReceivedAmount, amount_expected: expectedAmount,
          amount_remaining: expectedAmount - totalReceivedAmount,
          currency: items?.currency || payload.asset,
          payment_id: items?.payment_id || items?.unique_tx_id,
          status: "underpaid",
          payment_status: "underpaid",
          note: "Direct API: processing with actual received amount",
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
      // Fall through to cryptoVerification below
    } else {
      // Payment Link: wait for remaining payment
      const remainingAmount = expectedAmount - totalReceivedAmount;

      // Soft-enforce: pending → underpaid (PENDING → UNDERPAID — skips DETECTED)
      softValidate(items.status, "underpaid", paymentId, "payment-link-underpayment");
      publishCheckoutStatus(address, "underpaid", { txId: payload.txId });

      await setRedisItem(redisKey, {
        ...items, status: "underpaid", incomplete: "true",
        txId: payload.txId, receivedAmount: totalReceivedAmount,
        previousAmount: totalReceivedAmount, previousTxId: payload.txId,
        amount: remainingAmount, originalExpectedAmount: expectedAmount,
        partialPaymentTimestamp: items?.partialPaymentTimestamp || new Date().toISOString(),
        lastAttempt: new Date().toISOString(),
      });
      await setRedisTTL(redisKey, merchantGracePeriodMinutes * 60);

      if (customerData && customerData.company_id) {
        await deliverMerchantWebhook(customerData, {
          event: "payment.underpaid", payment_type: "payment_link",
          address, txId: payload.txId,
          transaction_reference: payload.txId,
          amount_received: totalReceivedAmount, amount_expected: expectedAmount,
          amount_remaining: remainingAmount,
          currency: items?.currency || payload.asset,
          payment_id: items?.payment_id || items?.unique_tx_id,
          status: "underpaid",
          payment_status: "underpaid",
          grace_period_minutes: merchantGracePeriodMinutes,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
      return; // Wait for remaining payment
    }
  }

  if (isMinorUnderpayment) {
    webhookLogs.info(`[WebhookProcessor] Minor underpayment ($${toFixedStr(underpaymentAmountUsd, 2)}) within threshold - accepting`);
  }

  // ── CryptoVerification with retries ─────────────────────────────────────────
  const isDirectApiUnderpayment = isUnderpayment && !isMinorUnderpayment && !(customerData?.link_id || items?.link_id);
  const finalReceivedAmount = (isCompletionPayment || isDirectApiUnderpayment) ? totalReceivedAmount : incomingAmount;

  // ── Send payment.confirmed webhook — crypto IS on-chain, BEFORE settlement ──
  // This is distinct from payment.settled (which means delivered to merchant wallet)
  // FIX (2026-04-12): Fire-and-forget — don't block settlement waiting for merchant server.
  // FIX (2026-04-12b): Delay 500ms so payment.pending always arrives before payment.confirmed.
  // Without this delay, concurrent fire-and-forget can deliver confirmed before pending.
  if (customerData && (customerData.webhook_url || customerData.callback_url)) {
    const receivedLinkId = customerData?.link_id || items?.link_id || null;
    const receivedPaymentType = receivedLinkId ? "payment_link" : "direct_api";
    setTimeout(() => {
      deliverMerchantWebhook(customerData, {
        event: "payment.confirmed",
        payment_type: receivedPaymentType,
        address,
        txId: payload.txId,
        transaction_reference: payload.txId,
        amount: finalReceivedAmount,
        currency: items?.currency || payload.asset,
        payment_id: items?.payment_id || items?.unique_tx_id,
        status: "confirmed",
        payment_status: "confirmed",
        base_amount: customerData?.base_amount || items?.base_amount_usd || null,
        base_currency: customerData?.base_currency || "USD",
        customer_name: customerData?.customer_name || null,
        customer_email: customerData?.email || null,
        description: customerData?.description || null,
        link_id: receivedLinkId,
        fee_payer: customerData?.fee_payer || items?.fee_payer || "company",
        meta_data: customerData?.meta_data ? (typeof customerData.meta_data === 'string' ? JSON.parse(customerData.meta_data) : customerData.meta_data) : null,
        created_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
        note: "Payment confirmed on-chain. Settlement to merchant wallet in progress.",
      }).then(() => {
        webhookLogs.info(`[WebhookProcessor] ✅ payment.confirmed webhook sent for payment ${paymentId} — crypto confirmed on-chain before settlement`);
      }).catch(confirmedWebhookErr => {
        webhookLogs.error("[WebhookProcessor] payment.confirmed webhook failed (non-blocking):", confirmedWebhookErr);
      });
    }, 500); // 500ms delay ensures payment.pending is sent first
  }

  try {
    // Soft-enforce: varies → processing (pre-cryptoVerification)
    softValidate(items.status, "processing", paymentId, "pre-crypto-verification");
    publishCheckoutStatus(address, "processing", { txId: payload.txId });

    // Set early processing guard to prevent duplicate webhooks from re-triggering settlement
    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: finalReceivedAmount, processing_started: new Date().toISOString(),
      status: "settlement_in_progress",
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 600); // 10 min guard — will be updated to permanent on completion

    // ── PAYMENT-LEVEL SETTLEMENT LOCK ─────────────────────────────────────────
    // Mark this payment as actively being settled so parallel webhooks for the
    // same payment_id are blocked by the guard above (Fix 2).
    const paymentSettlementKey = `payment-settlement-lock-${items.payment_id || items.ref}`;
    await setRedisItem(paymentSettlementKey, {
      status: "in_progress",
      txId: payload.txId,
      amount: finalReceivedAmount,
      started_at: new Date().toISOString(),
    });
    await setRedisTTL(paymentSettlementKey, 300); // 5 min — auto-expires if settlement hangs

    await setRedisItem(redisKey, {
      ...items, status: "processing",
      receivedAmount: finalReceivedAmount, txId: payload.txId,
      originalExpectedAmount: expectedAmount,
      incomplete: isCompletionPayment ? "false" : items.incomplete,
      retryCount: "0", lastAttempt: new Date().toISOString(),
    });

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const verifyResult = await paymentController.cryptoVerification(address, true, redisKey) as { duplicate?: boolean; status?: number; message?: string };
        if (verifyResult && verifyResult.status && verifyResult.status >= 400) {
          throw new Error(`cryptoVerification error ${verifyResult.status}: ${verifyResult.message || "Settlement failed"}`);
        }
        // ── DUPLICATE GUARD: If cryptoVerification detected a duplicate, stop here ──
        // Do NOT proceed to the success path (which sends payment.settled webhook).
        // The payment was already settled — no merchant notifications should be sent.
        if (verifyResult && verifyResult.duplicate) {
          webhookLogs.warn(`[WebhookProcessor] ⛔ cryptoVerification returned duplicate=true for tx ${payload.txId}. Skipping all post-verification webhooks.`);
          // Re-set processed-tx key to prevent future replays
          await setRedisItem(`processed-tx-${payload.txId}`, {
            address, payment_id: items.payment_id || items.ref,
            amount: finalReceivedAmount, processed_at: new Date().toISOString(),
            duplicate_blocked: true, source: "cryptoVerification-duplicate",
          });
          await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
          return; // EXIT — no payment.settled webhook
        }
        webhookLogs.info("[WebhookProcessor] cryptoVerification completed successfully");
        log(`[WebhookProcessor] ✅ cryptoVerification SUCCESS: addr=${address}, tx=${payload.txId}, amount=${finalReceivedAmount}`);
        lastError = null;
        break;
      } catch (retryError: unknown) {
        const err = retryError as { message?: string };
        lastError = new Error(err.message || "Unknown error");

        if (!isRetryable(lastError)) {
          webhookLogs.error(`[WebhookProcessor] Non-retryable error: ${err.message}`);
          break;
        }

        if (attempt < maxRetries) {
          // Gas-related errors need longer waits (gas TX may still be confirming on-chain)
          const isGasError = GAS_RACE_RETRYABLE_PATTERNS.some((p) => (err.message || "").toLowerCase().includes(p.toLowerCase()));
          const baseWait = isGasError ? 15000 : 2000; // 15s base for gas errors vs 2s for others
          const waitTime = baseWait * Math.pow(2, attempt - 1);
          webhookLogs.warn(`[WebhookProcessor] Retry ${attempt}/${maxRetries}: ${err.message}, waiting ${waitTime}ms${isGasError ? " (gas-related, extended wait)" : ""}`);
          log(`[WebhookProcessor] ⚠️ RETRY ${attempt}/${maxRetries}: tx=${payload.txId}, err=${err.message}, wait=${waitTime}ms${isGasError ? " (gas)" : ""}`, "warn");
          // Soft-enforce: processing → retrying (self-transition via legacy map)
          softValidate("processing", "retrying", paymentId, `crypto-verification-retry-${attempt}`);

          await setRedisItem(redisKey, {
            ...items, status: "retrying", receivedAmount: incomingAmount,
            txId: payload.txId, retryCount: String(attempt),
            lastAttempt: new Date().toISOString(), lastError: err.message,
          });
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    if (lastError) throw lastError;

    // Success: update Redis
    // Soft-enforce: processing → successful (PROCESSING → PAYOUT_COMPLETE)
    softValidate("processing", "successful", paymentId, "crypto-verification-success");
    publishCheckoutStatus(address, "confirmed", { txId: payload.txId });

    // ── RELIABILITY: Journal payment completion to PostgreSQL ──
    try {
      const { journalStateTransition } = require("./paymentReliability");
      await journalStateTransition({
        paymentId: items.payment_id || items.ref || paymentId,
        txId: payload.txId,
        address,
        currency: items?.currency || payload.asset || 'unknown',
        event: 'payment_completed',
        fromState: 'processing',
        toState: 'payout_complete',
        amount: Number(finalReceivedAmount),
        companyId: Number(items?.company_id) || null,
        metadata: { source: 'webhookProcessor', originalExpected: expectedAmount },
      });
    } catch (_journalErr) { /* non-blocking */ }

    await setRedisItem(redisKey, {
      ...items, status: "successful", txId: payload.txId,
      receivedAmount: finalReceivedAmount, originalExpectedAmount: expectedAmount,
      incomplete: "false", completedAt: new Date().toISOString(),
    });
    await setRedisTTL(redisKey, 1800);

    // Clear the payment-level settlement lock now that settlement is complete
    const completedSettlementKey = `payment-settlement-lock-${items.payment_id || items.ref}`;
    await setRedisItem(completedSettlementKey, {
      status: "completed",
      txId: payload.txId,
      amount: finalReceivedAmount,
      completed_at: new Date().toISOString(),
    });
    await setRedisTTL(completedSettlementKey, 300); // Keep for 5 min so late duplicates are still blocked

    if (items?.ref) {
      const custData = await getRedisItem(items.ref);
      if (custData && Object.keys(custData).length > 0) {
        // Soft-enforce: ref data — processing → successful
        // FIX BUG-6: custData.status may be literal string "undefined" or JS undefined
        // for reconciliation-sourced payments. Default to "processing".
        const rawRefStatus = custData.status;
        const refStatus = (!rawRefStatus || rawRefStatus === "undefined" || rawRefStatus === "null") ? "processing" : rawRefStatus;
        softValidate(refStatus, "successful", paymentId, "crypto-verification-success-ref");

        await setRedisItem(items.ref, {
          ...custData, status: "successful", txId: payload.txId,
          receivedAmount: finalReceivedAmount, completedAt: new Date().toISOString(),
        });
        await setRedisTTL(items.ref, 1800);
      }
    }

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: finalReceivedAmount, processed_at: new Date().toISOString(),
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);

    // ── Send payment.settled webhook to merchant (with BUG-1 FIX dedup) ──
    try {
      // BUG-1 FIX: Check if cryptoVerification already sent the settled webhook
      const confirmedWebhookKey = `confirmed-webhook-sent-${paymentId}`;
      const alreadySentConfirmed = await getRedisItem(confirmedWebhookKey);
      
      if (alreadySentConfirmed && alreadySentConfirmed.sent) {
        webhookLogs.info(`[WebhookProcessor] payment.settled webhook already sent by cryptoVerification for ${paymentId}, skipping duplicate`);
      } else {
        let confirmedCustomerData = await getRedisItem(items?.ref);
        if (!confirmedCustomerData || Object.keys(confirmedCustomerData).length === 0) {
          confirmedCustomerData = {};
        }
        // Merge webhook info from items
        if (!confirmedCustomerData.webhook_url && items?.webhook_url) confirmedCustomerData.webhook_url = items.webhook_url;
        if (!confirmedCustomerData.callback_url && items?.callback_url) confirmedCustomerData.callback_url = items.callback_url;
        if (!confirmedCustomerData.webhook_secret && items?.webhook_secret) confirmedCustomerData.webhook_secret = items.webhook_secret;
        if (!confirmedCustomerData.company_id && items?.company_id) confirmedCustomerData.company_id = items.company_id;
        if (!confirmedCustomerData.link_id && items?.link_id) confirmedCustomerData.link_id = items.link_id;

        if (confirmedCustomerData.webhook_url || confirmedCustomerData.callback_url) {
          const confirmedLinkId = confirmedCustomerData?.link_id || items?.link_id || null;
          const confirmedPaymentType = confirmedLinkId ? "payment_link" : "direct_api";

          // Set dedup flag before sending
          await setRedisItem(confirmedWebhookKey, { sent: true, sentAt: new Date().toISOString(), source: "webhookProcessor" });
          await setRedisTTL(confirmedWebhookKey, 86400);

          await deliverMerchantWebhook(confirmedCustomerData, {
            event: "payment.settled",
            payment_type: confirmedPaymentType,
            address,
            txId: payload.txId,
            transaction_reference: payload.txId,
            amount: finalReceivedAmount,
            currency: items?.currency || payload.asset,
            payment_id: items?.payment_id || items?.unique_tx_id,
            status: "settled",
            payment_status: "settled",
            base_amount: confirmedCustomerData?.base_amount || items?.base_amount_usd || null,
            base_currency: confirmedCustomerData?.base_currency || "USD",
            customer_name: confirmedCustomerData?.customer_name || null,
            customer_email: confirmedCustomerData?.email || null,
            description: confirmedCustomerData?.description || null,
            link_id: confirmedLinkId,
            fee_payer: confirmedCustomerData?.fee_payer || items?.fee_payer || "company",
            meta_data: confirmedCustomerData?.meta_data ? (typeof confirmedCustomerData.meta_data === 'string' ? JSON.parse(confirmedCustomerData.meta_data) : confirmedCustomerData.meta_data) : null,
            created_at: new Date().toISOString(),
            settled_at: new Date().toISOString(),
          });
          webhookLogs.info(`[WebhookProcessor] ✅ payment.settled webhook sent for payment ${paymentId}`);
        }
      }
    } catch (confirmedWebhookErr) {
      webhookLogs.error("[WebhookProcessor] Error sending payment.settled webhook:", confirmedWebhookErr);
    }

  } catch (verifyError: unknown) {
    const err = verifyError as { message?: string };

    // ── TEMPORARY GAS DEFERRAL — NOT a real failure ──────────────────────────
    // Settlement defers (throws "DEFERRED: ...") when the gas/fee wallet is critically
    // low. The payment WAS received on-chain; it will auto-retry via BullMQ and the
    // reconciliation sweep (which re-queues `gas_pending`/`failed` sessions for up to
    // 7 days) once the gas wallet is topped up. So: mark the session `gas_pending`,
    // persist it (setRedisItem uses SET which clears the TTL → durable for reconciliation),
    // and do NOT fire the alarming `payment.settlement_failed` webhook for a transient
    // condition (avoids false "not forwarded" alerts to the merchant).
    if (typeof err.message === "string" && err.message.startsWith("DEFERRED:")) {
      webhookLogs.warn(`[WebhookProcessor] ⏸️ Settlement DEFERRED (gas) — will auto-retry when gas is available: addr=${address}, tx=${payload.txId}, reason=${err.message}`);
      await setRedisItem(redisKey, {
        ...items, status: "gas_pending", receivedAmount: incomingAmount,
        txId: payload.txId, deferredAt: new Date().toISOString(), lastError: err.message,
      });
      throw verifyError; // let BullMQ / reconciliation retry once gas is topped up
    }

    webhookLogs.error("[WebhookProcessor] cryptoVerification failed after retries:", verifyError);
    log(`[WebhookProcessor] ❌ FAILED: addr=${address}, tx=${payload.txId}, err=${err.message}`, "error");

    // Soft-enforce: processing → failed (PROCESSING → FAILED)
    softValidate("processing", "failed", paymentId, "crypto-verification-failure");
    publishCheckoutStatus(address, "failed", { txId: payload.txId });

    await setRedisItem(redisKey, {
      ...items, status: "failed", receivedAmount: incomingAmount,
      txId: payload.txId, failedAt: new Date().toISOString(),
      lastError: err.message,
    });

    await setRedisItem(`failed-payment-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: incomingAmount, txId: payload.txId,
      error: err.message, failed_at: new Date().toISOString(),
    });

    // ── Send payment.failed webhook to merchant ───────────────────────────
    // Previously missing: merchant was never notified when settlement failed.
    try {
      let failedCustomerData = await getRedisItem(items?.ref);
      if (!failedCustomerData || Object.keys(failedCustomerData).length === 0) {
        failedCustomerData = {};
      }
      // Merge webhook info from items
      if (!failedCustomerData.webhook_url && items?.webhook_url) failedCustomerData.webhook_url = items.webhook_url;
      if (!failedCustomerData.callback_url && items?.callback_url) failedCustomerData.callback_url = items.callback_url;
      if (!failedCustomerData.webhook_secret && items?.webhook_secret) failedCustomerData.webhook_secret = items.webhook_secret;
      if (!failedCustomerData.company_id && items?.company_id) failedCustomerData.company_id = items.company_id;
      if (!failedCustomerData.link_id && items?.link_id) failedCustomerData.link_id = items.link_id;

      if (failedCustomerData.webhook_url || failedCustomerData.callback_url) {
        const failedLinkId = failedCustomerData?.link_id || items?.link_id || null;
        const failedPaymentType = failedLinkId ? "payment_link" : "direct_api";

        await deliverMerchantWebhook(failedCustomerData, {
          event: "payment.settlement_failed",
          payment_type: failedPaymentType,
          address,
          txId: payload.txId,
          transaction_reference: payload.txId,
          amount: incomingAmount,
          currency: items?.currency || payload.asset,
          payment_id: items?.payment_id || items?.unique_tx_id,
          status: "settlement_failed",
          payment_status: "settlement_failed",
          payment_received: true,
          error: err.message || "Settlement failed",
          base_amount: failedCustomerData?.base_amount || items?.base_amount_usd || null,
          base_currency: failedCustomerData?.base_currency || "USD",
          link_id: failedLinkId,
          fee_payer: failedCustomerData?.fee_payer || items?.fee_payer || "company",
          note: "Payment was received on-chain but settlement to merchant wallet failed. Recovery in progress.",
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });
        webhookLogs.info(`[WebhookProcessor] ✅ payment.settlement_failed webhook sent for payment ${paymentId}`);
      }
    } catch (webhookErr) {
      webhookLogs.error("[WebhookProcessor] Error sending payment.failed webhook:", webhookErr);
    }

    throw verifyError; // Let BullMQ retry the entire job
  }
}


// Export the validation function for testing and reuse
export { validateWebhookAsset, TATUM_ASSET_TO_CURRENCY, CONTRACT_ADDRESS_TO_CURRENCY, GAS_TOKEN_FOR_CURRENCY };
