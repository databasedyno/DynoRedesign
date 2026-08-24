/**
 * Refund service — Crypto Refund Flow (Phase A capture is elsewhere; this owns
 * Phase B "create refund invoice" and the Phase-C forwarding entrypoint).
 *
 * SAFETY:
 *  - Gated by ENABLE_CRYPTO_REFUNDS (controller-level).
 *  - REFUND_DRY_RUN=true (preview/sandbox) → no real address allocation, no
 *    forwarding; a deterministic placeholder deposit address is used so the UX
 *    is fully clickable without moving funds or touching the merchant pool.
 *  - forwardRefund() (Phase C) HARD-REFUSES unless background jobs are enabled
 *    AND not dry-run — so it can never run in the safe-mode preview.
 */
import { Op } from "sequelize";
import { config } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import refundModel from "../../models/userModels/refundModel";
import { paymentLinkModel, productOrderModel, customerTransactionModel } from "../../models";
import { reserveAddress } from "../merchantPool/merchantPoolReservation";
import { getBlockchainNetworkFee } from "../blockchainFeeService";
import {
  getChainMeta,
  validateRefundAmount,
  validateChainAddress,
  computeDepositPlan,
  STATIC_GAS_BUFFER_NATIVE,
  round8,
  canTransition,
  isRefundableOrderStatus,
  RefundStatus,
  ChainMeta,
} from "./refundChains";

export const isRefundsEnabled = (): boolean => config.bool("ENABLE_CRYPTO_REFUNDS");
export const isRefundDryRun = (): boolean => config.bool("REFUND_DRY_RUN");

export interface OriginalPayment {
  chain: string; // canonical CHAIN_META key
  meta: ChainMeta;
  originalCryptoAmount: number;
  customerRefundAddress: string;
  customerEmail: string | null;
  companyId: number | null;
  originalTxRef: string | null;
}

/**
 * Resolve + validate the original payment for a refund source, enforcing
 * merchant ownership and refundable state. Throws a user-safe Error on failure.
 */
export const resolveOriginalPayment = async (
  sourceType: string,
  sourceRef: string,
  actorUserId: number
): Promise<OriginalPayment> => {
  if (sourceType === "product_order") {
    const order: any = await productOrderModel.findOne({
      where: { public_ref: sourceRef },
    });
    if (!order) throw new Error("Order not found.");
    const ov = order.dataValues;
    if (Number(ov.merchant_user_id) !== Number(actorUserId)) {
      throw new Error("You are not the merchant of this order.");
    }
    if (!isRefundableOrderStatus(ov.payment_status)) {
      throw new Error(
        `Cannot refund an order in status '${ov.payment_status}'. Only paid orders can be refunded.`
      );
    }
    const meta = getChainMeta(ov.crypto_currency) || getChainMeta(ov.crypto_network);
    if (!meta) {
      throw new Error(
        `Unsupported or unknown chain for this order (${ov.crypto_currency || ov.crypto_network}).`
      );
    }
    const refundAddr = String(ov.refund_address || "").trim();
    return {
      chain: meta.walletType,
      meta,
      originalCryptoAmount: round8(Number(ov.crypto_amount) || 0),
      customerRefundAddress: refundAddr,
      customerEmail: ov.buyer_email || null,
      companyId: ov.company_id != null ? Number(ov.company_id) : null,
      originalTxRef: ov.public_ref || null,
    };
  }

  if (sourceType === "payment_link") {
    const link: any = await paymentLinkModel.findOne({
      where: { link_id: Number(sourceRef) },
    });
    if (!link) throw new Error("Payment link not found.");
    const lv = link.dataValues;
    if (Number(lv.user_id) !== Number(actorUserId)) {
      throw new Error("You are not the owner of this payment link.");
    }
    const refundAddr = String(lv.refund_address || "").trim();
    // Resolve the settled crypto transaction for this link. Payment-link crypto
    // payments are recorded in tbl_customer_transaction (unique_tx_id = the link's
    // transaction_id UUID), carrying paid_currency (chain/asset) + paid_amount.
    let tx: any = null;
    if (lv.transaction_id) {
      tx = await customerTransactionModel.findOne({
        where: { unique_tx_id: String(lv.transaction_id) },
      });
    }
    if (!tx) {
      throw new Error(
        "No settled crypto transaction found for this payment link — cannot determine the refund asset/amount."
      );
    }
    const tvx = tx.dataValues;
    if (String(tvx.payment_mode) !== "CRYPTO") {
      throw new Error("Only crypto payments can be refunded on-chain.");
    }
    if (String(tvx.status) !== "successful" && String(tvx.status) !== "completed") {
      throw new Error(
        `Cannot refund a payment in status '${tvx.status}'. Only settled payments can be refunded.`
      );
    }
    const meta = getChainMeta(tvx.paid_currency);
    if (!meta) {
      throw new Error(
        `Unsupported or unknown chain for this payment (${tvx.paid_currency}).`
      );
    }
    return {
      chain: meta.walletType,
      meta,
      originalCryptoAmount: round8(Number(tvx.paid_amount) || 0),
      customerRefundAddress: refundAddr,
      customerEmail: lv.email || null,
      companyId: lv.company_id != null ? Number(lv.company_id) : null,
      originalTxRef: String(lv.transaction_id || ""),
    };
  }

  throw new Error(`Unsupported refund source_type '${sourceType}'.`);
};

/**
 * Estimate the network-fee buffer (native units + USD) the merchant covers.
 * Live estimate via getBlockchainNetworkFee; static fallback on error / dry-run.
 */
export const estimateGasBuffer = async (
  meta: ChainMeta,
  dryRun: boolean
): Promise<{ native: number; usd: number; symbol: string }> => {
  const staticNative = STATIC_GAS_BUFFER_NATIVE[meta.gasSymbol] ?? 0;
  if (dryRun) {
    return { native: staticNative, usd: 0, symbol: meta.gasSymbol };
  }
  try {
    const fee = await getBlockchainNetworkFee(meta.walletType, "fast");
    const native = round8(Number((fee as any).feeInNative) || staticNative);
    const usd = round8(Number((fee as any).feeInUSD) || 0);
    // Add a 30% safety margin so forwarding never underpays gas.
    return { native: round8(native * 1.3), usd: round8(usd * 1.3), symbol: meta.gasSymbol };
  } catch (e) {
    apiLogger.warn(
      `[refund] gas estimate failed for ${meta.walletType}, using static fallback: ${
        (e as Error).message
      }`
    );
    return { native: staticNative, usd: 0, symbol: meta.gasSymbol };
  }
};

export interface CreateRefundInput {
  sourceType: string;
  sourceRef: string;
  requestedAmount: number | string;
  reason?: string | null;
  actorUserId: number;
  /** Merchant-provided customer refund address (used when none is on file). */
  refundAddress?: string | null;
}

/**
 * Persist a merchant-provided refund address back onto the source record so it
 * is on file for the record / any follow-up.
 */
const persistSourceRefundAddress = async (
  sourceType: string,
  sourceRef: string,
  addr: string
): Promise<void> => {
  if (sourceType === "product_order") {
    const o: any = await productOrderModel.findOne({ where: { public_ref: sourceRef } });
    if (o) await o.update({ refund_address: addr });
  } else if (sourceType === "payment_link") {
    const l: any = await paymentLinkModel.findOne({ where: { link_id: Number(sourceRef) } });
    if (l) await l.update({ refund_address: addr });
  }
};

/**
 * Create an on-chain refund invoice (Phase B). Enforces single-refund-per-source,
 * amount cap, and allocates a same-chain DynoPay deposit address (real or dry-run).
 */
export const createRefund = async (input: CreateRefundInput) => {
  const { sourceType, sourceRef, requestedAmount, reason, actorUserId } = input;
  const dryRun = isRefundDryRun();

  const original = await resolveOriginalPayment(sourceType, sourceRef, actorUserId);

  // Single-refund policy: block if an active/terminal-success refund exists.
  const existing = await refundModel.findOne({
    where: {
      source_type: sourceType,
      source_ref: String(sourceRef),
      status: { [Op.notIn]: ["failed", "cancelled", "expired"] },
    },
  });
  if (existing) {
    throw new Error(
      "A refund already exists for this payment. Only a single refund per payment is allowed."
    );
  }

  const amountCheck = validateRefundAmount(requestedAmount, original.originalCryptoAmount);
  if (!amountCheck.ok) throw new Error(amountCheck.error || "Invalid refund amount.");
  const refundAmount = amountCheck.amount;

  // Resolve + validate the customer refund address. Merchant-provided (this call)
  // wins, else the address captured at checkout. The chain is locked to the
  // original payment, so it must be well-formed for that chain.
  const providedAddr = String(input.refundAddress || "").trim();
  const effectiveAddr = providedAddr || original.customerRefundAddress;
  const addrCheck = validateChainAddress(original.meta, effectiveAddr);
  if (!addrCheck.ok) throw new Error(addrCheck.error || "Invalid customer refund address.");
  if (providedAddr && providedAddr !== original.customerRefundAddress) {
    await persistSourceRefundAddress(sourceType, sourceRef, providedAddr);
  }

  const gas = await estimateGasBuffer(original.meta, dryRun);
  const plan = computeDepositPlan(original.meta, refundAmount, gas.native);

  const refundId = (globalThis.crypto?.randomUUID?.() as string) || require("crypto").randomUUID();

  // Allocate the DynoPay deposit address on the SAME chain.
  let depositAddress: string;
  let tempAddressId: number | null = null;
  if (dryRun) {
    // Deterministic, clearly-marked placeholder — no pool allocation, no funds.
    depositAddress = `DRYRUN-${original.chain}-${refundId.slice(0, 8)}`;
  } else {
    const alloc: any = await reserveAddress(
      original.meta.walletType,
      refundId,
      actorUserId,
      original.companyId,
      plan.depositAmount
    );
    depositAddress =
      alloc?.dataValues?.wallet_address || alloc?.wallet_address || "";
    tempAddressId =
      alloc?.dataValues?.temp_address_id ?? alloc?.temp_address_id ?? null;
    if (!depositAddress) {
      throw new Error("Failed to allocate a DynoPay deposit address for the refund.");
    }
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const refund = await refundModel.create({
    refund_id: refundId,
    source_type: sourceType,
    source_ref: String(sourceRef),
    original_transaction_ref: original.originalTxRef,
    merchant_user_id: actorUserId,
    company_id: original.companyId,
    customer_email: original.customerEmail,
    chain: original.meta.walletType,
    asset: original.meta.asset,
    original_crypto_amount: original.originalCryptoAmount,
    refund_amount: refundAmount,
    gas_buffer_native: gas.native,
    gas_buffer_symbol: gas.symbol,
    gas_buffer_usd: gas.usd,
    merchant_deposit_total: plan.depositAmount,
    deposit_asset: plan.depositAsset,
    dyno_deposit_address: depositAddress,
    dyno_temp_address_id: tempAddressId,
    customer_refund_address: effectiveAddr,
    status: "awaiting_deposit",
    is_dry_run: dryRun,
    reason: reason ? String(reason).slice(0, 500) : null,
    created_by: actorUserId,
    expires_at: expiresAt,
  });

  apiLogger.info(
    `[refund] created ${refundId} (${sourceType}:${sourceRef}) ${refundAmount} ${original.meta.asset} on ${original.meta.walletType}${
      dryRun ? " [DRY-RUN]" : ""
    }`
  );
  return refund.dataValues;
};

export const getRefund = async (refundId: string, actorUserId: number) => {
  const refund: any = await refundModel.findByPk(refundId);
  if (!refund) throw new Error("Refund not found.");
  if (Number(refund.dataValues.merchant_user_id) !== Number(actorUserId)) {
    throw new Error("You do not have access to this refund.");
  }
  return refund.dataValues;
};

export const listRefunds = async (
  actorUserId: number,
  filters: { sourceType?: string; sourceRef?: string } = {}
) => {
  const where: Record<string, unknown> = { merchant_user_id: actorUserId };
  if (filters.sourceType) where.source_type = filters.sourceType;
  if (filters.sourceRef) where.source_ref = String(filters.sourceRef);
  const rows = await refundModel.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: 200,
  });
  return rows.map((r: any) => r.dataValues);
};

/**
 * Persist a validated refund state transition. Throws on an illegal transition
 * (guards the state machine); a no-op when from === to.
 */
export const transitionRefund = async (
  refund: any,
  to: RefundStatus,
  patch: Record<string, unknown> = {}
) => {
  const from = refund.dataValues.status as RefundStatus;
  if (from === to) return refund.dataValues;
  if (!canTransition(from, to)) {
    throw new Error(`Illegal refund transition ${from} → ${to}.`);
  }
  await refund.update({ status: to, ...patch });
  return refund.dataValues;
};

/**
 * SAFE dry-run simulator — advances a DRY-RUN refund one step toward completion
 * (awaiting_deposit → deposit_detected → forwarding → completed) with synthetic
 * tx ids, so the status timeline can be validated end-to-end in the preview
 * WITHOUT moving funds. HARD-REFUSES on any real (non-dry-run) refund.
 */
export const simulateAdvanceRefund = async (refundId: string, actorUserId: number) => {
  const refund: any = await refundModel.findByPk(refundId);
  if (!refund) throw new Error("Refund not found.");
  if (Number(refund.dataValues.merchant_user_id) !== Number(actorUserId)) {
    throw new Error("You do not have access to this refund.");
  }
  if (!refund.dataValues.is_dry_run) {
    throw new Error("Simulation is only allowed on dry-run (sandbox) refunds.");
  }
  const short = String(refundId).slice(0, 8);
  const cur = refund.dataValues.status as RefundStatus;
  const step: Partial<Record<RefundStatus, { to: RefundStatus; patch: Record<string, unknown> }>> = {
    awaiting_deposit: { to: "deposit_detected", patch: { merchant_deposit_txid: `SIM-DEP-${short}` } },
    deposit_detected: { to: "forwarding", patch: {} },
    forwarding: { to: "completed", patch: { forward_txid: `SIM-FWD-${short}` } },
  };
  const next = step[cur];
  if (!next) {
    throw new Error(`Refund is '${cur}' — nothing left to simulate.`);
  }
  return transitionRefund(refund, next.to, next.patch);
};

export const cancelRefund = async (refundId: string, actorUserId: number) => {
  const refund: any = await refundModel.findByPk(refundId);
  if (!refund) throw new Error("Refund not found.");
  if (Number(refund.dataValues.merchant_user_id) !== Number(actorUserId)) {
    throw new Error("You do not have access to this refund.");
  }
  const current = refund.dataValues.status as RefundStatus;
  if (!canTransition(current, "cancelled")) {
    throw new Error(`A refund in status '${current}' can no longer be cancelled.`);
  }
  await refund.update({ status: "cancelled" });
  return refund.dataValues;
};

/**
 * Phase C — forward a confirmed merchant deposit to the customer.
 * HARD-GATED: refuses to run unless background jobs are enabled AND not dry-run,
 * so it can NEVER execute in the safe-mode preview. Implemented as the entrypoint
 * the production worker will call once a deposit is detected on-chain.
 */
export const forwardRefund = async (refundId: string): Promise<void> => {
  if (isRefundDryRun() || !config.bool("ENABLE_BACKGROUND_JOBS")) {
    throw new Error(
      "[refund] forwardRefund is disabled here (dry-run / background jobs off). " +
        "Enable ENABLE_CRYPTO_REFUNDS + ENABLE_BACKGROUND_JOBS on the production worker."
    );
  }
  // NOTE (Phase C — production only): on a confirmed merchant deposit, reuse the
  // existing sweep/forward rails (fee-wallet gas funding for token chains) to send
  // `refund_amount` of `asset` from `dyno_deposit_address` to
  // `customer_refund_address`, then transition forwarding → completed, persist
  // `forward_txid`, write ledger entries (refund_liability), email the customer
  // (sendOrderRefundedEmail) and fire the refund webhook.
  throw new Error("[refund] Phase C forwarding not yet wired — pending production validation.");
};
