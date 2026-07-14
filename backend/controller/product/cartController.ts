/**
 * cartController — buyer cart validation + checkout.
 *
 * Two endpoints:
 *   POST /api/cart      — revalidate a client-supplied cart (fresh prices,
 *                         stock, currency). No side effects.
 *   POST /api/checkout  — create a `tbl_product_order` + a synthetic
 *                         `tbl_payment_link` (link_type='cart'). Returns the
 *                         payment ref so the frontend can hop into
 *                         CleanCheckoutV2.
 *
 * Stock is decremented in the same transaction as the order row (spec §7.5).
 */
import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  productVariantModel,
  productOrderModel,
  productOrderItemModel,
  paymentLinkModel,
  userModel,
} from "../../models";
import productModel from "../../models/userModels/productModel";
import sequelize from "../../utils/dbInstance";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";

type CartItemIn = {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number | string;
};

function cleanCartItems(raw: unknown): CartItemIn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r: any) => r && typeof r === "object" && r.product_id != null && r.quantity != null
    )
    .slice(0, 40) // hard cap for MVP
    .map((r: any) => ({
      product_id: Number(r.product_id),
      variant_id: r.variant_id ? Number(r.variant_id) : null,
      quantity: Math.max(1, Math.min(999, Math.floor(Number(r.quantity) || 1))),
    }));
}

function pickShipping(v: any): any | null {
  if (!v || typeof v !== "object") return null;
  const s = (k: string, max = 160) =>
    v[k] ? String(v[k]).trim().slice(0, max) : "";
  if (!s("line1") || !s("city") || !s("country_code", 8)) return null;
  return {
    line1: s("line1", 200),
    line2: s("line2", 200),
    city: s("city", 120),
    region: s("region", 120),
    postal_code: s("postal_code", 24),
    country_code: s("country_code", 8).toUpperCase(),
    notes: s("notes", 500),
  };
}

/**
 * Validate a client-supplied cart against live DB state.
 * Returns { normalized, subtotal_cents, currency, warnings, hasPhysical }.
 */
async function validateCart(
  merchantUserId: number,
  itemsIn: CartItemIn[]
) {
  const productIds = Array.from(
    new Set(itemsIn.map((i) => Number(i.product_id)).filter((n) => Number.isFinite(n)))
  );
  if (productIds.length === 0) {
    return { normalized: [], subtotal_cents: 0, currency: "USD", warnings: ["Cart is empty"], hasPhysical: false, hasError: true as const };
  }

  const products = await productModel.findAll({
    where: {
      product_id: { [Op.in]: productIds },
      merchant_user_id: merchantUserId,
      status: "live",
      deleted_at: null,
    },
  });
  const productsById: Record<string, any> = {};
  for (const p of products) productsById[String((p as any).dataValues.product_id)] = (p as any).dataValues;

  const variantIds = Array.from(
    new Set(
      itemsIn
        .map((i) => (i.variant_id ? Number(i.variant_id) : null))
        .filter((n): n is number => n != null && Number.isFinite(n))
    )
  );
  const variants =
    variantIds.length > 0
      ? await productVariantModel.findAll({
          where: {
            variant_id: { [Op.in]: variantIds },
            is_active: true,
          },
        })
      : [];
  const variantsById: Record<string, any> = {};
  for (const v of variants) variantsById[String((v as any).dataValues.variant_id)] = (v as any).dataValues;

  let currency: string | null = null;
  const warnings: string[] = [];
  const normalized: any[] = [];
  let subtotalCents = 0;
  let hasPhysical = false;

  for (const it of itemsIn) {
    const product = productsById[String(it.product_id)];
    if (!product) {
      warnings.push(`Item ${it.product_id} is no longer available.`);
      continue;
    }
    if (currency && product.currency !== currency) {
      warnings.push(`Product '${product.title}' uses ${product.currency} but cart is in ${currency}. Skipped.`);
      continue;
    }
    currency = currency || product.currency;
    if (product.product_type === "physical") hasPhysical = true;

    let unitPrice = Number(product.base_price_cents) || 0;
    let variant: any = null;
    if (product.has_variants) {
      if (!it.variant_id) {
        warnings.push(`Select a variant for '${product.title}'.`);
        continue;
      }
      variant = variantsById[String(it.variant_id)];
      if (!variant || variant.product_id != product.product_id) {
        warnings.push(`Variant for '${product.title}' is no longer available.`);
        continue;
      }
      unitPrice = Number(variant.price_cents) || 0;
    }

    if (unitPrice <= 0) {
      warnings.push(`Item '${product.title}' has an invalid price. Skipped.`);
      continue;
    }

    // Stock check (non-null stock only)
    const stock = product.has_variants ? variant?.stock_count : product.base_stock;
    if (stock != null && Number(stock) < Number(it.quantity)) {
      warnings.push(`Only ${stock} left of '${product.title}'.`);
      // Clamp qty to available
      it.quantity = Math.max(0, Number(stock));
      if (it.quantity === 0) continue;
    }

    const lineTotal = unitPrice * Number(it.quantity);
    subtotalCents += lineTotal;
    normalized.push({
      product_id: Number(product.product_id),
      variant_id: variant ? Number(variant.variant_id) : null,
      quantity: Number(it.quantity),
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal,
      product_snapshot: {
        title: product.title,
        slug: product.slug,
        cover_image_url: product.cover_image_url,
        product_type: product.product_type,
        digital_delivery_type: product.digital_delivery_type,
      },
      variant_snapshot: variant
        ? {
            variant_id: Number(variant.variant_id),
            attributes: variant.attributes || {},
            image_url: variant.image_url,
            price_cents: Number(variant.price_cents),
          }
        : null,
    });
  }

  return {
    normalized,
    subtotal_cents: subtotalCents,
    currency: currency || "USD",
    warnings,
    hasPhysical,
    hasError: normalized.length === 0,
  };
}

/**
 * POST /api/cart
 * Body: { merchant_handle?, merchant_user_id?, items: [...] }
 * Returns: { normalized, subtotal_cents, currency, warnings, hasPhysical }
 */
export const validateCartApi = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const body = req.body || {};
    const itemsIn = cleanCartItems(body.items);
    if (itemsIn.length === 0) return errorResponseHelper(res, 400, "Cart is empty.");

    let merchantUserId: number | null = null;
    if (body.merchant_user_id) {
      merchantUserId = Number(body.merchant_user_id);
    } else if (body.merchant_handle) {
      const merchant: any = await userModel.findOne({
        where: { handle: String(body.merchant_handle) } as any,
      });
      if (merchant) merchantUserId = Number(merchant.dataValues.user_id);
    } else {
      // Try to infer from the first item's product
      const anyProduct: any = await productModel.findOne({
        where: { product_id: Number(itemsIn[0].product_id) },
      });
      if (anyProduct) merchantUserId = Number(anyProduct.dataValues.merchant_user_id);
    }
    if (!merchantUserId)
      return errorResponseHelper(res, 400, "Merchant handle or ID required.");

    const result = await validateCart(merchantUserId, itemsIn);
    return successResponseHelper(res, 200, "Cart validated.", result);
  } catch (e: any) {
    apiLogger.error("[cartController] validateCartApi:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Cart validate failed");
  }
};

/**
 * POST /api/checkout
 * Body: {
 *   merchant_handle: string,
 *   items: CartItemIn[],
 *   buyer: { email, name?, phone? },
 *   shipping_address?: { line1, city, ... },
 *   locale?: 'en'|'es'|...
 * }
 * Returns: { order_public_ref, payment_ref, checkout_url }
 */
export const startCheckout = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const body = req.body || {};
    const buyer = body.buyer || {};
    const buyerEmail = String(buyer.email || "").trim().toLowerCase();
    if (!buyerEmail || !buyerEmail.includes("@"))
      return errorResponseHelper(res, 400, "Valid buyer email is required.");

    // Resolve merchant
    let merchant: any = null;
    if (body.merchant_handle) {
      merchant = await userModel.findOne({
        where: { handle: String(body.merchant_handle) } as any,
      });
    } else if (body.merchant_user_id) {
      merchant = await userModel.findOne({
        where: { user_id: Number(body.merchant_user_id) } as any,
      });
    }
    if (!merchant)
      return errorResponseHelper(res, 400, "Merchant not found.");

    const merchantUserId = Number(merchant.dataValues.user_id);
    const itemsIn = cleanCartItems(body.items);
    if (itemsIn.length === 0)
      return errorResponseHelper(res, 400, "Cart is empty.");

    const validated = await validateCart(merchantUserId, itemsIn);
    if (validated.hasError) {
      return errorResponseHelper(
        res,
        400,
        `Cart validation failed: ${validated.warnings.join("; ")}`
      );
    }

    if (validated.hasPhysical) {
      const ship = pickShipping(body.shipping_address);
      if (!ship) {
        return errorResponseHelper(
          res,
          400,
          "Shipping address required (line1, city, country)."
        );
      }
      body.shipping_address = ship; // normalized back
    }

    // ---------- Atomic order + stock decrement + payment link ----------
    const t = await sequelize.transaction();
    try {
      // 1. Stock decrement per line-item (only when stock is tracked)
      for (const it of validated.normalized) {
        if (it.variant_id) {
          const [affected] = await sequelize.query(
            `UPDATE tbl_product_variant
             SET stock_count = stock_count - :qty, "updatedAt" = NOW()
             WHERE variant_id = :vid
               AND (stock_count IS NULL OR stock_count >= :qty)
             RETURNING variant_id`,
            {
              replacements: { qty: it.quantity, vid: it.variant_id },
              transaction: t,
            } as any
          );
          if (!(affected as any) || (affected as any).length === 0) {
            throw new Error(`OUT_OF_STOCK: variant ${it.variant_id}`);
          }
        } else {
          const [affected] = await sequelize.query(
            `UPDATE tbl_product
             SET base_stock = base_stock - :qty, "updatedAt" = NOW()
             WHERE product_id = :pid
               AND (base_stock IS NULL OR base_stock >= :qty)
             RETURNING product_id`,
            {
              replacements: { qty: it.quantity, pid: it.product_id },
              transaction: t,
            } as any
          );
          if (!(affected as any) || (affected as any).length === 0) {
            throw new Error(`OUT_OF_STOCK: product ${it.product_id}`);
          }
        }
      }

      // 2. Insert order row
      const publicRef = crypto.randomBytes(12).toString("hex"); // 24 hex
      const currency = validated.currency;
      const subtotalCents = validated.subtotal_cents;
      // MVP: no computed shipping/tax
      const totalCents = subtotalCents;

      const order: any = await productOrderModel.create(
        {
          public_ref: publicRef,
          merchant_user_id: merchantUserId,
          buyer_email: buyerEmail,
          buyer_name: buyer.name ? String(buyer.name).slice(0, 160) : null,
          buyer_phone: buyer.phone ? String(buyer.phone).slice(0, 32) : null,
          shipping_address: body.shipping_address || null,
          subtotal_cents: subtotalCents,
          shipping_cents: 0,
          tax_cents: 0,
          total_cents: totalCents,
          currency,
          payment_status: "pending",
          fulfillment_status: "unfulfilled",
          locale: body.locale ? String(body.locale).slice(0, 6) : null,
        },
        { transaction: t }
      );

      // 3. Insert line items
      for (const it of validated.normalized) {
        await productOrderItemModel.create(
          {
            order_id: order.dataValues.order_id,
            product_id: it.product_id,
            variant_id: it.variant_id,
            product_snapshot: it.product_snapshot,
            variant_snapshot: it.variant_snapshot,
            quantity: it.quantity,
            unit_price_cents: it.unit_price_cents,
            line_total_cents: it.line_total_cents,
          },
          { transaction: t }
        );
      }

      // 4. Create synthetic payment link
      const paymentRef = crypto.randomBytes(12).toString("hex");
      const serverUrl = (process.env.SERVER_URL || "").replace(/\/+$/, "");
      const paymentLinkUrl = `${serverUrl}/pay?d=${paymentRef}`;
      const shortRef = publicRef.slice(0, 8).toUpperCase();

      const link: any = await paymentLinkModel.create(
        {
          transaction_reference: paymentRef,
          user_id: merchantUserId,
          base_amount: totalCents / 100,
          base_currency: currency,
          status: "pending",
          email: buyerEmail,
          payment_link: paymentLinkUrl,
          description: `Order ${shortRef} — ${validated.normalized.length} item${validated.normalized.length > 1 ? "s" : ""}`,
          link_type: "cart",
          title: `Order ${shortRef}`,
          customer_name: buyer.name ? String(buyer.name).slice(0, 160) : null,
          expires_at: new Date(Date.now() + 60 * 60 * 1000), // 60 min
          // Reuse the merchant's default company + wallet via linkMiddleware chain
          // (in a background enrichment step). For MVP we leave company_id null;
          // the payment webhook + settlement code already tolerates that path.
        },
        { transaction: t }
      );

      // 5. Bind order ↔ payment_link
      await order.update(
        { payment_link_id: link.dataValues.link_id },
        { transaction: t }
      );

      await t.commit();

      return successResponseHelper(res, 200, "Checkout started.", {
        order_public_ref: publicRef,
        payment_ref: paymentRef,
        checkout_url: paymentLinkUrl,
        subtotal_cents: subtotalCents,
        total_cents: totalCents,
        currency,
      });
    } catch (txErr: any) {
      try {
        await t.rollback();
      } catch {}
      apiLogger.warn(
        `[cartController] checkout tx rolled back: ${txErr?.message || txErr}`
      );
      if (String(txErr?.message || "").startsWith("OUT_OF_STOCK")) {
        return errorResponseHelper(
          res,
          409,
          "One or more items in your cart just went out of stock. Please refresh and try again."
        );
      }
      throw txErr;
    }
  } catch (e: any) {
    apiLogger.error("[cartController] startCheckout:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Checkout failed");
  }
};
