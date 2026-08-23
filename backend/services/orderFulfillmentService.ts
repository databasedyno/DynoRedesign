/**
 * orderFulfillmentService — post-payment fan-out for a completed cart order.
 *
 * Called by the payment webhook (cryptoCheckout → handleCartPaymentSettled)
 * once a `link_type='cart'` payment settles. Fulfillment differs by
 * product_type (spec §7.4):
 *   - digital-file        → mint short-lived download tokens for each asset
 *   - digital-license_key → pop one key from the pool (atomic)
 *   - digital-url         → copy the access URL verbatim
 *   - physical            → leave unfulfilled (merchant marks shipped)
 *   - service             → attach the calendar URL
 *
 * Idempotent — safe to re-invoke on the same order (webhook retries).
 */
import { hmacSha256Hex, timingSafeCompare } from "../utils/hmac";
import {
  productAssetModel,
  productOrderModel,
  productOrderItemModel,
} from "../models";
import productModel from "../models/userModels/productModel";
import { apiLogger } from "../utils/loggers";
import {
  sendOrderReceiptEmail,
  sendOrderReceiptMerchantEmail,
} from "./emailService";
import { userModel } from "../models";
import sequelize from "../utils/dbInstance";

const DOWNLOAD_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h per spec §7.4

export function mintDownloadToken(orderId: number, assetId: number): {
  token: string;
  expires_at: string;
} {
  const secret =
    process.env.PRODUCT_DOWNLOAD_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "fallback-download-secret";
  const expEpoch = Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS;
  const payload = `${orderId}:${assetId}:${expEpoch}`;
  const sig = hmacSha256Hex(payload, secret).slice(0, 32);
  const token = `${expEpoch}.${sig}`;
  return { token, expires_at: new Date(expEpoch * 1000).toISOString() };
}

/**
 * Verify a download token returned by mintDownloadToken.
 * Returns true iff signature valid AND not expired.
 */
export function verifyDownloadToken(
  orderId: number,
  assetId: number,
  token: string
): boolean {
  if (!token || typeof token !== "string") return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const secret =
    process.env.PRODUCT_DOWNLOAD_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "fallback-download-secret";
  const expected = hmacSha256Hex(`${orderId}:${assetId}:${exp}`, secret).slice(0, 32);
  // Constant-time compare (utf8 bytes of the truncated hex strings)
  return timingSafeCompare(sig, expected, "utf8");
}

/**
 * Populate line-item `delivered_payload` based on product_type + delivery type.
 * Returns true iff the item transitioned to `fulfilled`.
 */
async function fulfillLineItem(
  order: any,
  item: any,
  serverBaseUrl: string
): Promise<boolean> {
  const snapshot = item.dataValues.product_snapshot || {};
  const type = snapshot.product_type || "digital";

  if (type === "digital") {
    const deliveryType = snapshot.digital_delivery_type;

    if (deliveryType === "file") {
      // Load the current product's asset list — note: snapshot may include
      // asset_ids, but we tolerate them missing by re-reading the product.
      const productId = item.dataValues.product_id;
      const product = await productModel.findByPk(productId);
      const payload = (product as any)?.dataValues?.digital_delivery_payload || {};
      const assetIds: number[] = Array.isArray(payload.asset_ids)
        ? payload.asset_ids.map((n: any) => Number(n)).filter(Boolean)
        : [];
      if (assetIds.length === 0) {
        apiLogger.warn(
          `[fulfillment] order ${order.dataValues.order_id} item ${item.dataValues.order_item_id}: digital-file product has no assets configured`
        );
        return false;
      }
      const assets = await productAssetModel.findAll({
        where: { product_id: productId, is_active: true },
      });
      const deliveries = assets
        .filter((a: any) => assetIds.includes(Number(a.dataValues.asset_id)))
        .map((a: any) => {
          const t = mintDownloadToken(
            Number(order.dataValues.order_id),
            Number(a.dataValues.asset_id)
          );
          return {
            asset_id: Number(a.dataValues.asset_id),
            filename: a.dataValues.filename,
            size_bytes: a.dataValues.size_bytes,
            mime_type: a.dataValues.mime_type,
            download_token: t.token,
            expires_at: t.expires_at,
            download_url: `${serverBaseUrl}/api/order/${order.dataValues.public_ref}/download/${a.dataValues.asset_id}?t=${t.token}`,
          };
        });
      await item.update({
        delivered_payload: { asset_deliveries: deliveries },
        fulfillment_status: "fulfilled",
      });
      return true;
    }

    if (deliveryType === "license_key") {
      // Atomically pop one key from the pool
      const productId = item.dataValues.product_id;
      const t = await sequelize.transaction();
      try {
        const p: any = await productModel.findByPk(productId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        const payload = p?.dataValues?.digital_delivery_payload || {};
        const keys: string[] = Array.isArray(payload.keys) ? payload.keys : [];
        if (keys.length === 0) {
          await t.rollback();
          apiLogger.warn(
            `[fulfillment] order ${order.dataValues.order_id} item ${item.dataValues.order_item_id}: license_key pool empty`
          );
          return false;
        }
        const chosen = keys.shift() as string;
        await p.update(
          { digital_delivery_payload: { ...payload, keys } },
          { transaction: t }
        );
        await item.update(
          {
            delivered_payload: { license_key: chosen },
            fulfillment_status: "fulfilled",
          },
          { transaction: t }
        );
        await t.commit();
        return true;
      } catch (e) {
        await t.rollback();
        throw e;
      }
    }

    if (deliveryType === "url") {
      const productId = item.dataValues.product_id;
      const p: any = await productModel.findByPk(productId);
      const payload = p?.dataValues?.digital_delivery_payload || {};
      const url: string | null = payload.access_url || null;
      if (!url) {
        apiLogger.warn(
          `[fulfillment] order ${order.dataValues.order_id} item ${item.dataValues.order_item_id}: url delivery has no access_url`
        );
        return false;
      }
      await item.update({
        delivered_payload: { access_url: url },
        fulfillment_status: "fulfilled",
      });
      return true;
    }

    // Unknown digital delivery type — mark as "delivered" placeholder so the
    // buyer at least sees the receipt and can email support.
    await item.update({
      delivered_payload: { note: "Please contact merchant for delivery." },
      fulfillment_status: "fulfilled",
    });
    return true;
  }

  if (type === "service") {
    const productId = item.dataValues.product_id;
    const p: any = await productModel.findByPk(productId);
    const calUrl = p?.dataValues?.service_calendar_url || null;
    await item.update({
      delivered_payload: { calendar_url: calUrl },
      fulfillment_status: "fulfilled",
    });
    return !!calUrl;
  }

  // Physical — wait for merchant to mark shipped.
  return false;
}

/**
 * Handle a settled cart payment. Called from the crypto settlement webhook
 * when the paid link's `link_type='cart'`.
 *
 * `paymentInfo` is optional but if provided lets us persist the exact
 * crypto amount/currency/network on the order for the receipt page.
 */
export async function handleCartPaymentSettled(
  orderId: number,
  paymentInfo?: {
    crypto_amount?: number | string;
    crypto_currency?: string;
    crypto_network?: string;
  }
): Promise<void> {
  try {
    const order: any = await productOrderModel.findByPk(orderId);
    if (!order) {
      apiLogger.warn(`[fulfillment] order_id=${orderId} not found`);
      return;
    }
    if (order.dataValues.payment_status === "paid") {
      // Idempotency — fan-out already ran.
      apiLogger.info(`[fulfillment] order ${orderId} already paid, skipping`);
      return;
    }

    // Server URL for absolute download links
    const serverBaseUrl = (
      process.env.SERVER_URL ||
      process.env.FRONTEND_URL ||
      ""
    ).replace(/\/+$/, "");

    // Mark paid + persist crypto payment info
    await order.update({
      payment_status: "paid",
      paid_at: new Date(),
      ...(paymentInfo?.crypto_amount != null
        ? { crypto_amount: Number(paymentInfo.crypto_amount) }
        : {}),
      ...(paymentInfo?.crypto_currency
        ? { crypto_currency: String(paymentInfo.crypto_currency).toUpperCase() }
        : {}),
      ...(paymentInfo?.crypto_network
        ? { crypto_network: String(paymentInfo.crypto_network).toLowerCase() }
        : {}),
    });

    // ── Session 57: reconcile tax fields onto the settlement transaction ──
    // For cart orders, tax was computed at checkout-creation time based on
    // shipping address / IP + merchant defaults; cryptoSettlement's
    // `_cached_tax_info` path may not have fired (or picked a different
    // country from the buyer's IP). Copy the AUTHORITATIVE order-row tax
    // fields onto tbl_user_transaction so the merchant's dashboard shows
    // the exact tax collected.
    try {
      if (Number(order.dataValues.tax_cents) > 0 || order.dataValues.reverse_charge) {
        const linkId = order.dataValues.payment_link_id;
        if (linkId) {
          const { paymentLinkModel, userTransactionModel } = await import("../models");
          const link: any = await paymentLinkModel.findByPk(linkId);
          if (link && link.dataValues.transaction_reference) {
            const currencyMultiplier =
              String(order.dataValues.currency || "USD").toUpperCase() === "USD" ||
              String(order.dataValues.currency || "").length === 3
                ? 100
                : 100; // cents-based currency (all our fiat)
            const taxAmountBase =
              Number(order.dataValues.tax_cents) / currencyMultiplier;
            const updated = await userTransactionModel.update(
              {
                tax_amount: taxAmountBase,
                tax_rate: order.dataValues.tax_rate ?? null,
                tax_label: order.dataValues.tax_label || null,
                tax_country_code: order.dataValues.tax_country_code || null,
                customer_vat_id: order.dataValues.customer_vat_id || null,
                reverse_charge: !!order.dataValues.reverse_charge,
              },
              {
                where: {
                  transaction_reference: link.dataValues.transaction_reference,
                },
              }
            );
            apiLogger.info(
              `[fulfillment] tax reconciled for order ${orderId} → ${updated[0]} tx rows (tax=${taxAmountBase} ${order.dataValues.currency}, reverse_charge=${order.dataValues.reverse_charge})`
            );
          }
        }
      }
    } catch (reconErr: any) {
      // Non-fatal — fulfillment continues either way
      apiLogger.warn(
        `[fulfillment] tax reconciliation failed for order ${orderId}: ${reconErr?.message || reconErr}`
      );
    }

    // Fan out per-line-item fulfillment
    const items = await productOrderItemModel.findAll({
      where: { order_id: orderId },
    });
    let fulfilledCount = 0;
    for (const item of items) {
      try {
        const ok = await fulfillLineItem(order, item, serverBaseUrl);
        if (ok) fulfilledCount++;
        // Bump sold_count denorm on the product
        await productModel.increment(
          { sold_count: (item as any).dataValues.quantity || 1 },
          { where: { product_id: (item as any).dataValues.product_id } }
        );
      } catch (e: any) {
        apiLogger.error(
          `[fulfillment] line ${(item as any).dataValues.order_item_id} failed:`,
          e?.message || e
        );
      }
    }

    // Recompute order-level fulfillment status
    let orderFulfillStatus: "fulfilled" | "partial" | "unfulfilled";
    if (fulfilledCount === items.length) orderFulfillStatus = "fulfilled";
    else if (fulfilledCount === 0) orderFulfillStatus = "unfulfilled";
    else orderFulfillStatus = "partial";
    await order.update({ fulfillment_status: orderFulfillStatus });

    // Send emails (buyer + merchant)
    try {
      const merchant: any = await userModel.findByPk(
        order.dataValues.merchant_user_id
      );
      const refreshedItems = await productOrderItemModel.findAll({
        where: { order_id: orderId },
      });
      const orderPublicUrl = `${serverBaseUrl}/order/${order.dataValues.public_ref}`;
      // Per-Company Tax Receipts Label (2026-08-23n): surface the OWNING
      // company's VAT ID on the receipt (falls back to the account value for
      // legacy/unconfigured companies). tax_label is already stored on the
      // order (VAT / GST / IVA / TVA / Tax) from taxService::calculateTax.
      let merchantVatId: string | null = null;
      try {
        const { resolveTaxSettings } = await import("./companyTaxService");
        const tax = await resolveTaxSettings(
          Number(order.dataValues.merchant_user_id),
          (order.dataValues as any).company_id ?? null,
        );
        merchantVatId = tax.merchant_vat_id || null;
      } catch (taxErr: any) {
        apiLogger.warn(
          `[fulfillment] tax settings lookup for receipt failed: ${taxErr?.message || taxErr}`,
        );
      }
      await sendOrderReceiptEmail(
        order.dataValues.buyer_email,
        order.dataValues.buyer_name || "",
        order.dataValues,
        refreshedItems.map((i: any) => i.dataValues),
        orderPublicUrl,
        merchantVatId,
      );
      if (merchant?.dataValues?.email) {
        await sendOrderReceiptMerchantEmail(
          merchant.dataValues.email,
          merchant.dataValues.first_name || merchant.dataValues.username || "",
          order.dataValues,
          refreshedItems.map((i: any) => i.dataValues),
          orderPublicUrl,
          merchantVatId,
        );
      }
    } catch (emailErr: any) {
      apiLogger.error(
        `[fulfillment] email send failed for order ${orderId}:`,
        emailErr?.message || emailErr
      );
    }

    apiLogger.info(
      `[fulfillment] order ${orderId} fanned out: ${fulfilledCount}/${items.length} fulfilled, status=${orderFulfillStatus}`
    );
  } catch (e: any) {
    apiLogger.error(
      `[fulfillment] handleCartPaymentSettled(${orderId}) fatal:`,
      e?.message || e
    );
    throw e;
  }
}
