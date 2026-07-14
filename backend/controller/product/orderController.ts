/**
 * orderController — public read-only order status + digital download.
 *
 * Routes:
 *   GET /api/order/:publicRef              — order + line items + fulfillment
 *   GET /api/order/:publicRef/download/:assetId?t=<token>
 *                                          — gated digital file download
 *   POST /api/order/:publicRef/resend-download
 *                                          — regenerate signed URLs + email
 *                                            (rate-limited 5/day)
 */
import express from "express";
import fs from "fs";
import path from "path";
import {
  productOrderModel,
  productOrderItemModel,
  productAssetModel,
  userModel,
} from "../../models";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";
import {
  verifyDownloadToken,
  handleCartPaymentSettled,
} from "../../services/orderFulfillmentService";
import { UPLOAD_ROOT } from "../../middleware/uploadProductAsset";
import crypto from "crypto";
import { sendOrderReceiptEmail } from "../../services/emailService";

export const getOrderByPublicRef = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const ref = String(req.params.publicRef || "").trim().slice(0, 48);
    if (!ref) return errorResponseHelper(res, 400, "Order reference required");

    const order: any = await productOrderModel.findOne({
      where: { public_ref: ref },
    });
    if (!order) return errorResponseHelper(res, 404, "Order not found.");

    const items = await productOrderItemModel.findAll({
      where: { order_id: order.dataValues.order_id },
      order: [["order_item_id", "ASC"]],
    });

    // Never leak download links unless payment is paid
    const isPaid = order.dataValues.payment_status === "paid";
    const projected = items.map((i: any) => {
      const iv = i.dataValues;
      return {
        ...iv,
        delivered_payload: isPaid ? iv.delivered_payload : null,
      };
    });

    // Merchant meta (for the receipt heading)
    const merchant: any = await userModel.findByPk(order.dataValues.merchant_user_id);

    return successResponseHelper(res, 200, "Order fetched.", {
      order: order.dataValues,
      items: projected,
      merchant: merchant
        ? {
            handle: merchant.dataValues.handle,
            name:
              merchant.dataValues.name ||
              merchant.dataValues.username ||
              merchant.dataValues.handle,
          }
        : null,
    });
  } catch (e: any) {
    apiLogger.error("[orderController] getOrderByPublicRef:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Get order failed");
  }
};

export const downloadAsset = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const ref = String(req.params.publicRef || "").trim().slice(0, 48);
    const assetId = Number(req.params.assetId);
    const token = String((req.query.t as string) || "").trim();

    const order: any = await productOrderModel.findOne({
      where: { public_ref: ref },
    });
    if (!order) return res.status(404).send("Order not found.");
    if (order.dataValues.payment_status !== "paid") {
      return res.status(403).send("Order not paid.");
    }
    if (
      !verifyDownloadToken(Number(order.dataValues.order_id), assetId, token)
    ) {
      return res.status(403).send("Download link expired or invalid.");
    }

    const asset: any = await productAssetModel.findByPk(assetId);
    if (!asset || !asset.dataValues.is_active) {
      return res.status(404).send("File no longer available.");
    }

    // Ensure the asset actually belongs to a product on this order
    const itemRow: any = await productOrderItemModel.findOne({
      where: {
        order_id: order.dataValues.order_id,
        product_id: asset.dataValues.product_id,
      },
    });
    if (!itemRow) {
      return res.status(403).send("Asset not part of this order.");
    }

    if (asset.dataValues.storage_backend === "gcs") {
      return res.status(501).send("GCS delivery not yet configured.");
    }

    const filePath = path.join(UPLOAD_ROOT, asset.dataValues.storage_object);
    // Safety: ensure the resolved path stays inside UPLOAD_ROOT
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(403).send("Invalid storage path.");
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).send("File missing on server.");
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.dataValues.filename.replace(/"/g, "")}"`
    );
    res.setHeader(
      "Content-Type",
      asset.dataValues.mime_type || "application/octet-stream"
    );
    fs.createReadStream(resolved).pipe(res);
  } catch (e: any) {
    apiLogger.error("[orderController] downloadAsset:", e?.message || e);
    return res.status(500).send("Download failed.");
  }
};

/**
 * Regenerate signed URLs + resend receipt email. Rate-limit 5/day/order.
 * Uses a simple in-memory counter (per-instance, ok for MVP).
 */
const resendCounter = new Map<string, { count: number; resetAt: number }>();
const RESEND_LIMIT_PER_DAY = 5;

export const resendDownloadLinks = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const ref = String(req.params.publicRef || "").trim().slice(0, 48);
    if (!ref) return errorResponseHelper(res, 400, "Order reference required");

    const order: any = await productOrderModel.findOne({
      where: { public_ref: ref },
    });
    if (!order) return errorResponseHelper(res, 404, "Order not found.");
    if (order.dataValues.payment_status !== "paid") {
      return errorResponseHelper(res, 400, "Order is not paid.");
    }

    const now = Date.now();
    const entry = resendCounter.get(ref);
    if (entry && entry.resetAt > now) {
      entry.count += 1;
      if (entry.count > RESEND_LIMIT_PER_DAY) {
        return errorResponseHelper(
          res,
          429,
          "Too many resend attempts. Please try again tomorrow."
        );
      }
    } else {
      resendCounter.set(ref, { count: 1, resetAt: now + 24 * 3600_000 });
    }

    // Re-run the fan-out with idempotency — handleCartPaymentSettled early-returns
    // when status='paid', so we bypass by flipping to pending briefly? Simpler:
    // regenerate line-item delivered_payload directly by re-running a minimal
    // version of the fulfillment code. For MVP just re-issue tokens for existing
    // asset_deliveries. This keeps user's stock-decrement intact.
    const items = await productOrderItemModel.findAll({
      where: { order_id: order.dataValues.order_id },
    });
    const serverBaseUrl = (
      process.env.SERVER_URL ||
      process.env.FRONTEND_URL ||
      ""
    ).replace(/\/+$/, "");

    const DOWNLOAD_TOKEN_TTL_SECONDS = 24 * 60 * 60;
    const secret =
      process.env.PRODUCT_DOWNLOAD_SECRET ||
      process.env.ACCESS_TOKEN_SECRET ||
      "fallback-download-secret";

    for (const item of items) {
      const dp = (item as any).dataValues.delivered_payload;
      if (dp && Array.isArray(dp.asset_deliveries)) {
        const refreshed = dp.asset_deliveries.map((a: any) => {
          const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS;
          const sig = crypto
            .createHmac("sha256", secret)
            .update(`${order.dataValues.order_id}:${a.asset_id}:${exp}`)
            .digest("hex")
            .slice(0, 32);
          const token = `${exp}.${sig}`;
          return {
            ...a,
            download_token: token,
            expires_at: new Date(exp * 1000).toISOString(),
            download_url: `${serverBaseUrl}/api/order/${order.dataValues.public_ref}/download/${a.asset_id}?t=${token}`,
          };
        });
        await (item as any).update({
          delivered_payload: { ...dp, asset_deliveries: refreshed },
        });
      }
    }

    // Re-send buyer receipt email with refreshed links
    try {
      const refreshedItems = await productOrderItemModel.findAll({
        where: { order_id: order.dataValues.order_id },
      });
      const orderPublicUrl = `${serverBaseUrl}/order/${order.dataValues.public_ref}`;
      await sendOrderReceiptEmail(
        order.dataValues.buyer_email,
        order.dataValues.buyer_name || "",
        order.dataValues,
        refreshedItems.map((i: any) => i.dataValues),
        orderPublicUrl
      );
    } catch (emailErr: any) {
      apiLogger.warn(
        `[orderController] resend email failed: ${emailErr?.message || emailErr}`
      );
    }

    return successResponseHelper(res, 200, "Download links refreshed and re-emailed.");
  } catch (e: any) {
    apiLogger.error("[orderController] resendDownloadLinks:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Resend failed");
  }
};

/**
 * Test-only endpoint (dev/preview environments only) that manually simulates
 * a paid webhook for a given order. Guarded by NODE_ENV != 'production'.
 */
export const testMarkPaid = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return errorResponseHelper(res, 403, "Disabled in production.");
    }
    const ref = String(req.params.publicRef || "").trim().slice(0, 48);
    const order: any = await productOrderModel.findOne({
      where: { public_ref: ref },
    });
    if (!order) return errorResponseHelper(res, 404, "Order not found.");
    await handleCartPaymentSettled(Number(order.dataValues.order_id), {
      crypto_amount: req.body?.crypto_amount,
      crypto_currency: req.body?.crypto_currency || "USDT-TRC20",
      crypto_network: req.body?.crypto_network || "tron",
    });
    return successResponseHelper(res, 200, "Marked paid (test).");
  } catch (e: any) {
    apiLogger.error("[orderController] testMarkPaid:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Test mark failed");
  }
};
