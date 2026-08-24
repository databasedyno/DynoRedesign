/**
 * Refund controller — Crypto Refund Flow (Phase A capture + Phase B invoice).
 * All routes are gated by ENABLE_CRYPTO_REFUNDS (see refundRouter).
 */
import type { Request, Response } from "express";
import { successResponseHelper, errorResponseHelper } from "../../helper";
import { apiLogger } from "../../utils/loggers";
import { productOrderModel, paymentLinkModel } from "../../models";
import {
  createRefund,
  getRefund,
  listRefunds,
  cancelRefund,
  resolveOriginalPayment,
  estimateGasBuffer,
  isRefundDryRun,
} from "../../services/refund/refundService";
import { computeDepositPlan, validateChainAddress } from "../../services/refund/refundChains";

const uid = (res: Response): number => Number((res.locals as any)?.user?.user_id);

/**
 * GET /api/refunds/preview?source_type=&source_ref=
 * Resolve the original payment so the merchant UI can show the asset, chain,
 * cap (original amount), estimated gas the merchant covers, and the deposit total.
 */
export const previewRefund = async (req: Request, res: Response) => {
  try {
    const actor = uid(res);
    if (!actor) return errorResponseHelper(res, 401, "Authentication required.");
    const sourceType = String(req.query.source_type || "");
    const sourceRef = String(req.query.source_ref || "");
    if (!sourceType || !sourceRef) {
      return errorResponseHelper(res, 400, "source_type and source_ref are required.");
    }

    const original = await resolveOriginalPayment(sourceType, sourceRef, actor);
    const dryRun = isRefundDryRun();
    const gas = await estimateGasBuffer(original.meta, dryRun);
    const plan = computeDepositPlan(original.meta, original.originalCryptoAmount, gas.native);
    const onFileAddr = original.customerRefundAddress;
    const addrValid = onFileAddr ? validateChainAddress(original.meta, onFileAddr).ok : false;

    return successResponseHelper(res, 200, "OK", {
      source_type: sourceType,
      source_ref: sourceRef,
      chain: original.meta.walletType,
      asset: original.meta.asset,
      asset_kind: original.meta.kind,
      original_crypto_amount: original.originalCryptoAmount,
      max_refundable: original.originalCryptoAmount,
      customer_refund_address: onFileAddr || "",
      needs_address: !addrValid,
      address_invalid: !!onFileAddr && !addrValid,
      gas_buffer_native: gas.native,
      gas_buffer_symbol: gas.symbol,
      gas_buffer_usd: gas.usd,
      gas_coverage: plan.gasCoverage,
      deposit_asset: plan.depositAsset,
      // deposit total if the FULL amount is refunded (UI recomputes for partials)
      full_refund_deposit_total: plan.depositAmount,
      dry_run: dryRun,
    });
  } catch (e: any) {
    apiLogger.warn(`[refund] preview failed: ${e?.message || e}`);
    return errorResponseHelper(res, 400, e?.message || "Unable to preview refund.");
  }
};

/** POST /api/refunds  { source_type, source_ref, amount, reason? } */
export const postRefund = async (req: Request, res: Response) => {
  try {
    const actor = uid(res);
    if (!actor) return errorResponseHelper(res, 401, "Authentication required.");
    const { source_type, source_ref, amount, reason, refund_address } = req.body || {};
    if (!source_type || !source_ref) {
      return errorResponseHelper(res, 400, "source_type and source_ref are required.");
    }
    if (amount == null || amount === "") {
      return errorResponseHelper(res, 400, "Refund amount is required.");
    }
    const refund = await createRefund({
      sourceType: String(source_type),
      sourceRef: String(source_ref),
      requestedAmount: amount,
      reason: reason ?? null,
      refundAddress: refund_address ?? null,
      actorUserId: actor,
    });
    return successResponseHelper(res, 201, "Refund created.", refund);
  } catch (e: any) {
    apiLogger.warn(`[refund] create failed: ${e?.message || e}`);
    return errorResponseHelper(res, 400, e?.message || "Unable to create refund.");
  }
};

/** GET /api/refunds/:refundId */
export const getRefundById = async (req: Request, res: Response) => {
  try {
    const actor = uid(res);
    if (!actor) return errorResponseHelper(res, 401, "Authentication required.");
    const refund = await getRefund(String(req.params.refundId), actor);
    return successResponseHelper(res, 200, "OK", refund);
  } catch (e: any) {
    const code = /not found/i.test(e?.message) ? 404 : 403;
    return errorResponseHelper(res, code, e?.message || "Refund not found.");
  }
};

/** GET /api/refunds?source_type=&source_ref= */
export const getRefunds = async (req: Request, res: Response) => {
  try {
    const actor = uid(res);
    if (!actor) return errorResponseHelper(res, 401, "Authentication required.");
    const rows = await listRefunds(actor, {
      sourceType: req.query.source_type ? String(req.query.source_type) : undefined,
      sourceRef: req.query.source_ref ? String(req.query.source_ref) : undefined,
    });
    return successResponseHelper(res, 200, "OK", rows);
  } catch (e: any) {
    return errorResponseHelper(res, 400, e?.message || "Unable to list refunds.");
  }
};

/** POST /api/refunds/:refundId/cancel */
export const postCancelRefund = async (req: Request, res: Response) => {
  try {
    const actor = uid(res);
    if (!actor) return errorResponseHelper(res, 401, "Authentication required.");
    const refund = await cancelRefund(String(req.params.refundId), actor);
    return successResponseHelper(res, 200, "Refund cancelled.", refund);
  } catch (e: any) {
    const code = /not found/i.test(e?.message) ? 404 : 400;
    return errorResponseHelper(res, code, e?.message || "Unable to cancel refund.");
  }
};

/**
 * POST /api/refunds/capture-address  (PUBLIC — called from checkout)
 * Body: { source_type: 'product_order'|'payment_link', source_ref, address }
 * Stores the customer's refund destination. Keyed by unguessable public ref /
 * link id (same trust model as the existing payment-link setRefundAddress).
 * Only settable while the payment is not yet refunded.
 */
export const captureRefundAddress = async (req: Request, res: Response) => {
  try {
    const { source_type, source_ref, address } = req.body || {};
    const addr = String(address || "").trim();
    if (!source_type || !source_ref || !addr) {
      return errorResponseHelper(res, 400, "source_type, source_ref and address are required.");
    }
    if (addr.length < 12 || addr.length > 255) {
      return errorResponseHelper(res, 400, "Refund address looks invalid.");
    }

    if (String(source_type) === "product_order") {
      const order: any = await productOrderModel.findOne({
        where: { public_ref: String(source_ref) },
      });
      if (!order) return errorResponseHelper(res, 404, "Order not found.");
      if (String(order.dataValues.payment_status) === "refunded") {
        return errorResponseHelper(res, 400, "Order already refunded.");
      }
      await order.update({ refund_address: addr });
      return successResponseHelper(res, 200, "Refund address saved.", { saved: true });
    }

    if (String(source_type) === "payment_link") {
      const link: any = await paymentLinkModel.findOne({
        where: { link_id: Number(source_ref) },
      });
      if (!link) return errorResponseHelper(res, 404, "Payment link not found.");
      await link.update({ refund_address: addr });
      return successResponseHelper(res, 200, "Refund address saved.", { saved: true });
    }

    return errorResponseHelper(res, 400, "Unsupported source_type.");
  } catch (e: any) {
    apiLogger.warn(`[refund] capture-address failed: ${e?.message || e}`);
    return errorResponseHelper(res, 500, "Unable to save refund address.");
  }
};
