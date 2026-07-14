/**
 * orderExpiryService — Sweep abandoned cart orders and return their stock.
 *
 * PROBLEM: Product Catalog Phase 1 decrements stock atomically at CHECKOUT
 * (see spec §7.5 in memory/PRODUCT_CATALOG_SPEC.md), BEFORE the buyer pays.
 * If the buyer never pays, that stock stays reserved forever. A merchant
 * with `base_stock=1` who gets 5 abandoned carts effectively goes out of
 * stock permanently.
 *
 * SOLUTION: Every 5 minutes the leader instance runs `sweepExpiredCartOrders`:
 *   1. Find `tbl_product_order` rows with `payment_status='pending'` whose
 *      linked `tbl_payment_link.expires_at` is more than 5 minutes in the past.
 *   2. In a single transaction per order:
 *        a. Mark order.payment_status='expired'
 *        b. Re-increment stock for every line item (variant OR base_stock)
 *   3. Fire `sendOrderExpiredEmail` (best-effort — email failures don't roll
 *      back the stock restore).
 *
 * REMINDER: In the same sweep, find paid digital orders whose signed
 * download URLs expire in < 6 hours and fire the reminder email (once per
 * order, idempotent via `delivered_payload.reminder_sent_at` flag).
 *
 * Idempotent: safe to re-run (only touches `payment_status='pending'` rows).
 * Multi-instance safe: guarded by Redis lock `cron:expireCartOrders`.
 */
import { Op } from "sequelize";
import {
  productOrderModel,
  productOrderItemModel,
  paymentLinkModel,
  userModel,
} from "../models";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";
import {
  sendOrderExpiredEmail,
  sendDigitalDownloadReminderEmail,
} from "./emailService";

// A 5-minute grace period past `expires_at` before we mark a cart expired —
// gives Tatum/webhook stragglers a chance to land a late confirmation.
const EXPIRE_GRACE_MS = 5 * 60 * 1000;

// Signed download tokens are 24h TTL (see orderFulfillmentService.ts).
// Send the reminder when < 6h remains.
const DOWNLOAD_REMINDER_LEAD_MS = 6 * 60 * 60 * 1000;

/**
 * Sweep expired cart orders. Returns the number of orders that transitioned
 * to `expired`. Best-effort emails are fired in the background.
 */
export async function sweepExpiredCartOrders(): Promise<{
  expired: number;
  reminders: number;
  errors: number;
}> {
  const stats = { expired: 0, reminders: 0, errors: 0 };

  // ── 1. Expire abandoned pending orders ──────────────────────────────
  try {
    const cutoff = new Date(Date.now() - EXPIRE_GRACE_MS);

    // Use raw JOIN because Sequelize's default association scaffold isn't
    // wired up between productOrderModel and paymentLinkModel for this
    // project. Fetch order rows whose payment_link_id points at an expired
    // link, capped at 200 per pass so we don't blow past the leader
    // Redis-lock timeout under load.
    const [rows] = await sequelize.query(
      `SELECT o.order_id, o.public_ref
       FROM tbl_product_order o
       JOIN tbl_payment_link p ON p.link_id = o.payment_link_id
       WHERE o.payment_status = 'pending'
         AND p.expires_at IS NOT NULL
         AND p.expires_at < :cutoff
       ORDER BY o."createdAt" ASC
       LIMIT 200`,
      { replacements: { cutoff } }
    );

    const candidates = (rows as any[]) || [];
    if (candidates.length === 0) {
      apiLogger.info("[orderExpiry] no candidates to expire");
    } else {
      apiLogger.info(`[orderExpiry] found ${candidates.length} candidates`);
    }

    for (const row of candidates) {
      const orderId = Number(row.order_id);
      try {
        await expireOneOrder(orderId);
        stats.expired++;
      } catch (e: any) {
        stats.errors++;
        apiLogger.error(
          `[orderExpiry] expire order ${orderId} failed: ${e?.message || e}`
        );
      }
    }
  } catch (e: any) {
    apiLogger.error(`[orderExpiry] sweep query failed: ${e?.message || e}`);
    stats.errors++;
  }

  // ── 2. Send "download expires soon" reminders ───────────────────────
  try {
    const nudgeAgo = new Date(Date.now() - DOWNLOAD_REMINDER_LEAD_MS);
    // Paid orders whose paid_at is within (24h - 6h) = 18h ago, i.e. their
    // signed URLs have < 6h left. We track `reminder_sent_at` per-item to
    // avoid re-sending.
    const items = await productOrderItemModel.findAll({
      where: {
        // Any digital item is a candidate; we filter delivered_payload in JS
        fulfillment_status: "fulfilled",
      },
      limit: 500,
    });

    // Group items by order_id
    const byOrder = new Map<number, any[]>();
    for (const raw of items) {
      const iv: any = (raw as any).dataValues;
      const dp = iv.delivered_payload;
      if (!dp || !Array.isArray(dp.asset_deliveries) || dp.asset_deliveries.length === 0) continue;
      // Skip already-reminded orders
      if (dp.reminder_sent_at) continue;
      // Find soonest expires_at across this item's deliveries
      const soonest = dp.asset_deliveries
        .map((d: any) => (d?.expires_at ? new Date(d.expires_at).getTime() : Infinity))
        .reduce((a: number, b: number) => Math.min(a, b), Infinity);
      if (!Number.isFinite(soonest)) continue;
      const timeLeftMs = soonest - Date.now();
      if (timeLeftMs > DOWNLOAD_REMINDER_LEAD_MS) continue; // more than 6h — skip
      if (timeLeftMs <= 0) continue; // already expired — reminder is moot
      const oid = Number(iv.order_id);
      if (!byOrder.has(oid)) byOrder.set(oid, []);
      byOrder.get(oid)!.push(iv);
    }

    for (const [orderId, orderItems] of Array.from(byOrder.entries())) {
      try {
        const order: any = await productOrderModel.findByPk(orderId);
        if (!order) continue;
        const orderPublicUrl = `${((process.env.SERVER_URL || "") as string).replace(/\/+$/, "")}/order/${order.dataValues.public_ref}`;
        await sendDigitalDownloadReminderEmail(
          order.dataValues.buyer_email,
          order.dataValues.buyer_name || "",
          order.dataValues,
          orderItems,
          orderPublicUrl
        );
        // Mark reminder_sent_at on every item to prevent re-firing next tick
        for (const iv of orderItems) {
          const dp = iv.delivered_payload || {};
          await productOrderItemModel.update(
            {
              delivered_payload: { ...dp, reminder_sent_at: new Date().toISOString() },
            },
            { where: { order_item_id: iv.order_item_id } }
          );
        }
        stats.reminders++;
      } catch (e: any) {
        stats.errors++;
        apiLogger.error(
          `[orderExpiry] reminder for order ${orderId} failed: ${e?.message || e}`
        );
      }
    }
  } catch (e: any) {
    apiLogger.error(`[orderExpiry] reminder pass failed: ${e?.message || e}`);
    stats.errors++;
  }

  if (stats.expired > 0 || stats.reminders > 0) {
    apiLogger.info(
      `[orderExpiry] done: expired=${stats.expired}, reminders=${stats.reminders}, errors=${stats.errors}`
    );
  }
  return stats;
}

/**
 * Expire a single order in one atomic tx: flip status + restore stock.
 * Emails are fired after the tx commits (best-effort).
 */
async function expireOneOrder(orderId: number): Promise<void> {
  const t = await sequelize.transaction();
  let orderRow: any = null;
  let itemRows: any[] = [];
  try {
    orderRow = await productOrderModel.findByPk(orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!orderRow || orderRow.dataValues.payment_status !== "pending") {
      // Another worker already handled it, or the buyer just paid.
      await t.rollback();
      return;
    }

    itemRows = await productOrderItemModel.findAll({
      where: { order_id: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Restore stock per line item (only touch rows where stock is tracked).
    for (const raw of itemRows) {
      const iv: any = (raw as any).dataValues;
      const qty = Number(iv.quantity) || 0;
      if (qty <= 0) continue;
      if (iv.variant_id) {
        await sequelize.query(
          `UPDATE tbl_product_variant
           SET stock_count = COALESCE(stock_count, 0) + :qty, "updatedAt" = NOW()
           WHERE variant_id = :vid AND stock_count IS NOT NULL`,
          { replacements: { qty, vid: iv.variant_id }, transaction: t } as any
        );
      } else if (iv.product_id) {
        await sequelize.query(
          `UPDATE tbl_product
           SET base_stock = COALESCE(base_stock, 0) + :qty, "updatedAt" = NOW()
           WHERE product_id = :pid AND base_stock IS NOT NULL`,
          { replacements: { qty, pid: iv.product_id }, transaction: t } as any
        );
      }
    }

    await orderRow.update({ payment_status: "expired" }, { transaction: t });
    await t.commit();
    apiLogger.info(
      `[orderExpiry] expired order ${orderId} (${itemRows.length} items, stock restored)`
    );
  } catch (e) {
    try {
      await t.rollback();
    } catch {}
    throw e;
  }

  // Best-effort expired-email — outside the tx so DB commit succeeds even if
  // Brevo is momentarily down.
  try {
    const merchant: any = await userModel.findByPk(orderRow.dataValues.merchant_user_id);
    const merchantHandle = merchant?.dataValues?.handle || "";
    const shopUrl = merchantHandle
      ? `${((process.env.SERVER_URL || "") as string).replace(/\/+$/, "")}/${merchantHandle}/shop`
      : ((process.env.SERVER_URL || "") as string).replace(/\/+$/, "");
    await sendOrderExpiredEmail(
      orderRow.dataValues.buyer_email,
      orderRow.dataValues.buyer_name || "",
      orderRow.dataValues,
      itemRows.map((r: any) => r.dataValues),
      shopUrl
    );
  } catch (e: any) {
    apiLogger.warn(
      `[orderExpiry] expired-email for order ${orderId} failed: ${e?.message || e}`
    );
  }
}

// Type-only export to silence "no unused import" if Op is not used in future.
export type { };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keepOp = Op;
