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
 *
 * Session 57: Tax collection at cart checkout — resolves effective
 * apply_tax from merchant defaults + per-product override, computes tax
 * against the buyer's jurisdiction (physical goods → shipping country;
 * digital/service → customer IP), supports EU B2B reverse-charge when a
 * valid VAT ID is supplied, and persists all tax fields on the order row
 * for accounting.
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
  companyModel,
  userWalletModel,
} from "../../models";
import productModel from "../../models/userModels/productModel";
import sequelize from "../../utils/dbInstance";
import { setRedisItem } from "../../utils/redisInstance";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";
import { calculateTax } from "../payment/taxService";
import { getClientIP, getCountryFromIP, getCountryFromTimezone } from "../../utils/geolocation";
import { STOREFRONT_PER_COMPANY, resolveStorefrontByHandle } from "../storefrontScope";
import { resolveTaxSettings } from "../../services/companyTaxService";

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
      // Tax metadata carried through so startCheckout can compute per-item
      // taxable base (exempt items don't contribute to the taxable subtotal).
      tax_category: product.tax_category || "digital",
      apply_tax_override: product.apply_tax_override == null ? null : Boolean(product.apply_tax_override),
      product_snapshot: {
        title: product.title,
        slug: product.slug,
        cover_image_url: product.cover_image_url,
        product_type: product.product_type,
        digital_delivery_type: product.digital_delivery_type,
        tax_category: product.tax_category || "digital",
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

    // ---------- Merchant company + payout wallets (mirrors startTip) ----------
    // The /pay checkout session REQUIRES a company_id + the merchant's
    // configured wallet currencies to resolve deposit addresses. Fail fast
    // BEFORE any stock is decremented.
    //
    // Storefront-per-company: settle to the company that OWNS this storefront
    // handle (falling back to the product's company_id), not always the
    // account's primary company. Flag OFF keeps the legacy primary-company path.
    let merchantCompany: any = null;
    if (STOREFRONT_PER_COMPANY) {
      let companyId: number | null = null;
      if (body.merchant_handle) {
        const owner = await resolveStorefrontByHandle(String(body.merchant_handle));
        if (owner && owner.company_id != null) companyId = Number(owner.company_id);
      }
      if (companyId == null) {
        const firstPid = Number(itemsIn[0]?.product_id);
        if (Number.isFinite(firstPid)) {
          const anyProduct: any = await productModel.findOne({ where: { product_id: firstPid } });
          if (anyProduct?.dataValues?.company_id != null) {
            companyId = Number(anyProduct.dataValues.company_id);
          }
        }
      }
      if (companyId != null) {
        merchantCompany = await companyModel.findOne({
          where: { company_id: companyId, user_id: merchantUserId },
        });
      }
      // Legacy safety net: fall back to the primary company.
      if (!merchantCompany) {
        merchantCompany = await companyModel.findOne({
          where: { user_id: merchantUserId },
          order: [["company_id", "ASC"]],
        });
      }
    } else {
      merchantCompany = await companyModel.findOne({
        where: { user_id: merchantUserId },
        order: [["company_id", "ASC"]],
      });
    }
    if (!merchantCompany) {
      return errorResponseHelper(
        res,
        400,
        "This merchant isn't set up to receive payments yet."
      );
    }
    const merchantCompanyId = Number(merchantCompany.dataValues.company_id);
    const CART_CRYPTO_TYPES = [
      "BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20",
      "USDC-ERC20", "SOL", "XRP", "RLUSD", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON",
    ];
    const configuredWallets = await userWalletModel.findAll({
      where: {
        user_id: merchantUserId,
        company_id: merchantCompanyId,
        wallet_type: { [Op.in]: CART_CRYPTO_TYPES },
        wallet_address: { [Op.not]: null },
      } as any,
      attributes: ["wallet_type"],
    });
    if (!configuredWallets.length) {
      return errorResponseHelper(
        res,
        400,
        "This merchant hasn't configured a payout wallet yet."
      );
    }
    const allConfiguredCurrencies = [
      ...new Set(
        configuredWallets.map(
          (w) => (w.dataValues as { wallet_type: string }).wallet_type
        )
      ),
    ];

    // ---------- Atomic order + stock decrement + payment link ----------
    // ── Resolve merchant tax settings (per-company since 2026-08-23) ──
    const mv = merchant.dataValues;
    const taxDefaults = await resolveTaxSettings(merchantUserId, merchantCompanyId);
    const merchantCountry: string | null = taxDefaults.merchant_country_code;
    const merchantDefaultApplyTax: boolean = taxDefaults.default_apply_tax;
    const merchantDefaultTaxInclusive: boolean = taxDefaults.default_tax_inclusive;

    // Determine effective apply_tax:
    //   - If ANY item has apply_tax_override === true → tax on
    //   - Else if EVERY non-exempt item has apply_tax_override === false → tax off
    //   - Else → merchant default
    const items = validated.normalized;
    const anyOverrideOn = items.some((it) => it.apply_tax_override === true);
    const nonExempt = items.filter((it) => it.tax_category !== "exempt");
    const allOverrideOff =
      nonExempt.length > 0 && nonExempt.every((it) => it.apply_tax_override === false);
    let effectiveApplyTax = merchantDefaultApplyTax;
    if (anyOverrideOn) effectiveApplyTax = true;
    else if (allOverrideOff) effectiveApplyTax = false;

    // Taxable subtotal = sum of line totals where category != 'exempt'
    // AND where per-item override doesn't explicitly disable tax.
    const taxableSubtotalCents = items
      .filter(
        (it) =>
          it.tax_category !== "exempt" &&
          it.apply_tax_override !== false
      )
      .reduce((s, it) => s + Number(it.line_total_cents), 0);

    // ── Resolve tax jurisdiction ─────────────────────────────────────
    // Physical goods: use shipping-address country. Digital/service/mixed:
    // use IP-detected country. Cart-wide: pick the FIRST physical item's
    // shipping country if any item is physical, else fall back to IP/timezone.
    const clientIP = getClientIP(req);
    const timezone: string | null = body.timezone ? String(body.timezone) : null;
    const isPrivateIP =
      clientIP === "127.0.0.1" ||
      clientIP === "localhost" ||
      clientIP.startsWith("192.168.") ||
      clientIP.startsWith("10.") ||
      clientIP.startsWith("172.") ||
      clientIP === "::1";

    let taxCountryCode: string | null = null;
    let taxCountrySource: string = "unknown";
    if (validated.hasPhysical && body.shipping_address?.country_code) {
      taxCountryCode = String(body.shipping_address.country_code).toUpperCase();
      taxCountrySource = "shipping_address";
    } else if (timezone && isPrivateIP) {
      const g = getCountryFromTimezone(timezone);
      if (g?.country_code) {
        taxCountryCode = g.country_code.toUpperCase();
        taxCountrySource = "timezone";
      }
    } else {
      const g = await getCountryFromIP(clientIP, req.headers);
      if (g?.country_code) {
        taxCountryCode = g.country_code.toUpperCase();
        taxCountrySource = "ip";
      } else if (timezone) {
        const gt = getCountryFromTimezone(timezone);
        if (gt?.country_code) {
          taxCountryCode = gt.country_code.toUpperCase();
          taxCountrySource = "timezone";
        }
      }
    }

    // ── Compute tax if enabled ─────────────────────────────────────
    let taxCents = 0;
    let taxRateApplied: number | null = null;
    let taxLabelApplied: string | null = null;
    let reverseCharge = false;
    const customerVatId: string = body.customer_vat_id ? String(body.customer_vat_id).trim().slice(0, 32) : "";
    const taxInclusive: boolean = merchantDefaultTaxInclusive; // merchant-level; cart doesn't have a per-link toggle yet

    if (effectiveApplyTax && taxableSubtotalCents > 0 && taxCountryCode) {
      const taxCategoryForCalc: "digital" | "physical" | "service" | "exempt" = validated.hasPhysical
        ? "physical"
        : "digital";
      const calc = await calculateTax({
        countryCode: taxCountryCode,
        amount: taxableSubtotalCents / 100,
        currency: validated.currency,
        taxInclusive,
        taxCategory: taxCategoryForCalc,
        merchantCountry: merchantCountry || undefined,
        customerVatId: customerVatId || undefined,
      });
      if (calc) {
        taxCents = Math.round(calc.tax_amount * 100);
        taxRateApplied = calc.tax_rate;
        taxLabelApplied = calc.tax_acronym;
        reverseCharge = !!calc.reverse_charge;
        apiLogger.info(
          `[cartCheckout] Tax ${effectiveApplyTax ? "ON" : "OFF"}: country=${taxCountryCode}(${taxCountrySource}) rate=${taxRateApplied}% cents=${taxCents} reverse_charge=${reverseCharge} inclusive=${taxInclusive} category=${taxCategoryForCalc}`
        );
      }
    } else {
      apiLogger.info(
        `[cartCheckout] Tax skipped: apply=${effectiveApplyTax} taxableSubtotalCents=${taxableSubtotalCents} country=${taxCountryCode}`
      );
    }

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
      // If tax is inclusive, the "subtotal" in accounting terms is smaller
      // than the summed line totals. We keep subtotal_cents = sum of line
      // totals (what buyer sees + line-item consistency) and record the
      // tax_cents / total_cents accordingly.
      //   - Tax-exclusive: total = subtotal + tax
      //   - Tax-inclusive: total = subtotal (buyer sees the same figure;
      //                    tax_cents is embedded within, computed by calc)
      const totalCents = taxInclusive ? subtotalCents : subtotalCents + taxCents;

      const order: any = await productOrderModel.create(
        {
          public_ref: publicRef,
          merchant_user_id: merchantUserId,
          company_id: merchantCompanyId,
          buyer_email: buyerEmail,
          buyer_name: buyer.name ? String(buyer.name).slice(0, 160) : null,
          buyer_phone: buyer.phone ? String(buyer.phone).slice(0, 32) : null,
          shipping_address: body.shipping_address || null,
          subtotal_cents: subtotalCents,
          shipping_cents: 0,
          tax_cents: taxCents,
          tax_rate: taxRateApplied,
          tax_label: taxLabelApplied,
          tax_country_code: taxCountryCode,
          customer_vat_id: customerVatId || null,
          reverse_charge: reverseCharge,
          tax_inclusive: taxInclusive,
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
      const linkTransactionId = crypto.randomUUID();
      const linkExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min
      const orderDescription = `Order ${shortRef} — ${validated.normalized.length} item${validated.normalized.length > 1 ? "s" : ""}`;
      const buyerName = buyer.name ? String(buyer.name).slice(0, 160) : null;

      const link: any = await paymentLinkModel.create(
        {
          transaction_id: linkTransactionId,
          transaction_reference: paymentRef,
          user_id: merchantUserId,
          adm_id: merchantUserId,
          company_id: merchantCompanyId,
          base_amount: totalCents / 100,
          base_currency: currency,
          status: "pending",
          email: buyerEmail,
          payment_link: paymentLinkUrl,
          description: orderDescription,
          link_type: "cart",
          title: `Order ${shortRef}`,
          customer_name: buyerName,
          expires_at: linkExpiresAt,
          // Snapshot tax flags so downstream settlement code knows what was
          // collected (mainly for cryptoSettlement to persist tax_amount /
          // tax_rate on tbl_user_transaction).
          apply_tax: effectiveApplyTax && taxCents > 0,
          tax_inclusive: taxInclusive,
        },
        { transaction: t }
      );

      // 5. Bind order ↔ payment_link
      await order.update(
        { payment_link_id: link.dataValues.link_id },
        { transaction: t }
      );

      await t.commit();

      // 6. Create the /pay checkout session in Redis (mirrors createPaymentLink
      // / startTip). Without this, /pay?d=<ref> 404s ("Payment link not found
      // or expired") because getData() resolves sessions from Redis, not the DB.
      try {
        const redisPayload = {
          transaction_id: linkTransactionId,
          email: buyerEmail,
          allowedModes: "crypto",
          base_amount: totalCents / 100,
          base_currency: currency,
          user_id: merchantUserId,
          adm_id: merchantUserId,
          company_id: merchantCompanyId,
          payment_link: paymentLinkUrl,
          description: orderDescription,
          expires_at: linkExpiresAt,
          callback_url: null,
          redirect_url: null,
          webhook_url: null,
          fee_payer: "company",
          apply_tax: effectiveApplyTax && taxCents > 0,
          tax_inclusive: taxInclusive,
          accepted_currencies: null,
          customer_name: buyerName,
          link_type: "cart",
          order_public_ref: publicRef,
          pathType: "createLink",
          link_id: link.dataValues.link_id,
          available_currencies: allConfiguredCurrencies,
          all_configured_currencies: allConfiguredCurrencies,
          createdAt: new Date().toISOString(),
        };
        await setRedisItem("customer-" + paymentRef, redisPayload);
      } catch (redisErr) {
        apiLogger.error(
          "[cartController] failed to create /pay checkout session in Redis:",
          redisErr
        );
      }

      return successResponseHelper(res, 200, "Checkout started.", {
        order_public_ref: publicRef,
        payment_ref: paymentRef,
        checkout_url: paymentLinkUrl,
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        tax_rate: taxRateApplied,
        tax_label: taxLabelApplied,
        tax_country_code: taxCountryCode,
        tax_inclusive: taxInclusive,
        reverse_charge: reverseCharge,
        customer_vat_id: customerVatId || null,
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


/**
 * POST /api/cart/quote-tax
 * Body: {
 *   merchant_handle? | merchant_user_id?,
 *   items: [{ product_id, variant_id?, quantity }],
 *   shipping_address?: { country_code, ... },
 *   customer_vat_id?: string,
 *   timezone?: string
 * }
 * Returns a live tax quote WITHOUT creating an order or reserving stock.
 * Powers the checkout page's tax preview + VAT ID re-validate flow.
 */
export const quoteTax = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const body = req.body || {};
    const itemsIn = cleanCartItems(body.items);
    if (itemsIn.length === 0) return errorResponseHelper(res, 400, "Cart is empty.");

    let merchant: any = null;
    if (body.merchant_handle) {
      merchant = await userModel.findOne({
        where: { handle: String(body.merchant_handle) } as any,
      });
    } else if (body.merchant_user_id) {
      merchant = await userModel.findByPk(Number(body.merchant_user_id));
    } else {
      const anyProduct: any = await productModel.findOne({
        where: { product_id: Number(itemsIn[0].product_id) },
      });
      if (anyProduct) {
        merchant = await userModel.findByPk(Number(anyProduct.dataValues.merchant_user_id));
      }
    }
    if (!merchant) return errorResponseHelper(res, 400, "Merchant not found.");
    const merchantUserId = Number(merchant.dataValues.user_id);

    const validated = await validateCart(merchantUserId, itemsIn);
    if (validated.hasError) {
      return errorResponseHelper(res, 400, `Cart validation failed: ${validated.warnings.join("; ")}`);
    }

    const mv = merchant.dataValues;
    // Per-company tax: quote with the owning company's rules (the product's
    // company when storefronts are per-company; primary company otherwise).
    let quoteCompanyId: number | null = null;
    if (STOREFRONT_PER_COMPANY) {
      const p: any = await productModel.findOne({
        where: { product_id: Number(itemsIn[0].product_id) },
        attributes: ["company_id"],
      });
      if (p?.dataValues?.company_id != null) quoteCompanyId = Number(p.dataValues.company_id);
    }
    const taxDefaults = await resolveTaxSettings(merchantUserId, quoteCompanyId);
    const merchantCountry: string | null = taxDefaults.merchant_country_code;
    const merchantDefaultApplyTax: boolean = taxDefaults.default_apply_tax;
    const merchantDefaultTaxInclusive: boolean = taxDefaults.default_tax_inclusive;

    const items = validated.normalized;
    const anyOverrideOn = items.some((it: any) => it.apply_tax_override === true);
    const nonExempt = items.filter((it: any) => it.tax_category !== "exempt");
    const allOverrideOff =
      nonExempt.length > 0 && nonExempt.every((it: any) => it.apply_tax_override === false);
    let effectiveApplyTax = merchantDefaultApplyTax;
    if (anyOverrideOn) effectiveApplyTax = true;
    else if (allOverrideOff) effectiveApplyTax = false;

    const taxableSubtotalCents = items
      .filter((it: any) => it.tax_category !== "exempt" && it.apply_tax_override !== false)
      .reduce((s: number, it: any) => s + Number(it.line_total_cents), 0);

    // Resolve country
    const clientIP = getClientIP(req);
    const timezone: string | null = body.timezone ? String(body.timezone) : null;
    const isPrivateIP =
      clientIP === "127.0.0.1" ||
      clientIP === "localhost" ||
      clientIP.startsWith("192.168.") ||
      clientIP.startsWith("10.") ||
      clientIP.startsWith("172.") ||
      clientIP === "::1";
    let taxCountryCode: string | null = null;
    let taxCountrySource = "unknown";
    if (validated.hasPhysical && body.shipping_address?.country_code) {
      taxCountryCode = String(body.shipping_address.country_code).toUpperCase();
      taxCountrySource = "shipping_address";
    } else if (timezone && isPrivateIP) {
      const g = getCountryFromTimezone(timezone);
      if (g?.country_code) { taxCountryCode = g.country_code.toUpperCase(); taxCountrySource = "timezone"; }
    } else {
      const g = await getCountryFromIP(clientIP, req.headers);
      if (g?.country_code) { taxCountryCode = g.country_code.toUpperCase(); taxCountrySource = "ip"; }
      else if (timezone) {
        const gt = getCountryFromTimezone(timezone);
        if (gt?.country_code) { taxCountryCode = gt.country_code.toUpperCase(); taxCountrySource = "timezone"; }
      }
    }

    const customerVatId: string = body.customer_vat_id
      ? String(body.customer_vat_id).trim().slice(0, 32)
      : "";
    const taxInclusive: boolean = merchantDefaultTaxInclusive;

    const subtotalCents = validated.subtotal_cents;
    let quote: any = {
      apply_tax: effectiveApplyTax,
      tax_country_code: taxCountryCode,
      tax_country_source: taxCountrySource,
      tax_rate: 0,
      tax_label: null as string | null,
      tax_cents: 0,
      tax_inclusive: taxInclusive,
      reverse_charge: false,
      customer_vat_id: customerVatId || null,
      customer_vat_id_valid: false,
      exempt_reason: null as string | null,
      merchant_country_code: merchantCountry,
      subtotal_cents: subtotalCents,
      taxable_subtotal_cents: taxableSubtotalCents,
      total_cents: subtotalCents,
      currency: validated.currency,
    };

    if (effectiveApplyTax && taxableSubtotalCents > 0 && taxCountryCode) {
      const taxCategoryForCalc: "digital" | "physical" | "service" | "exempt" = validated.hasPhysical
        ? "physical"
        : "digital";
      const calc = await calculateTax({
        countryCode: taxCountryCode,
        amount: taxableSubtotalCents / 100,
        currency: validated.currency,
        taxInclusive,
        taxCategory: taxCategoryForCalc,
        merchantCountry: merchantCountry || undefined,
        customerVatId: customerVatId || undefined,
      });
      if (calc) {
        const taxCents = Math.round(calc.tax_amount * 100);
        quote = {
          ...quote,
          tax_rate: calc.tax_rate,
          tax_label: calc.tax_acronym,
          tax_cents: taxCents,
          reverse_charge: !!calc.reverse_charge,
          customer_vat_id_valid: !!calc.customer_vat_id_valid,
          exempt_reason: calc.exempt_reason || null,
          total_cents: taxInclusive ? subtotalCents : subtotalCents + taxCents,
        };
      }
    }

    return successResponseHelper(res, 200, "Tax quoted.", quote);
  } catch (e: any) {
    apiLogger.error("[cartController] quoteTax:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Tax quote failed");
  }
};
