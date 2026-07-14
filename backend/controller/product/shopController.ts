/**
 * shopController — public read-only browsing.
 *
 * Routes are unauthenticated but rate-limited at the router level.
 * Returns only `status='live'` products; drafts + archived stay merchant-only.
 *
 * Handles two views:
 *  - /api/shop/:handle           → merchant landing + product grid
 *  - /api/shop/:handle/products/:slug → single product detail
 */
import express from "express";
import { Op } from "sequelize";
import {
  productVariantModel,
  userModel,
} from "../../models";
import productModel from "../../models/userModels/productModel";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";

/** Strip fields that shouldn't be exposed to unauthenticated buyers. */
function publicProductProjection(p: any) {
  return {
    product_id: p.product_id,
    product_type: p.product_type,
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle,
    description_md: p.description_md,
    base_price_cents: p.base_price_cents,
    currency: p.currency,
    cover_image_url: p.cover_image_url,
    gallery_images: p.gallery_images || [],
    category: p.category,
    has_variants: !!p.has_variants,
    base_stock: p.base_stock,
    sold_count: p.sold_count || 0,
    service_duration_minutes: p.service_duration_minutes,
    // Note: NEVER leak digital_delivery_payload to public.
  };
}

function publicVariantProjection(v: any) {
  return {
    variant_id: v.variant_id,
    attributes: v.attributes || {},
    price_cents: v.price_cents,
    stock_count: v.stock_count,
    image_url: v.image_url,
    sort_order: v.sort_order,
    is_active: v.is_active,
  };
}

async function findMerchantByHandle(handle: string) {
  const clean = String(handle || "").trim().slice(0, 60);
  if (!clean) return null;
  // The creator vanity handle lives on tbl_user.handle (case-insensitive).
  const merchant = await userModel.findOne({
    where: {
      [Op.or]: [
        { handle: clean } as any,
        { handle: clean.toLowerCase() } as any,
      ],
    } as any,
  });
  return merchant;
}

export const getShopByHandle = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const handle = String(req.params.handle || "").trim().slice(0, 60);
    if (!handle) return errorResponseHelper(res, 400, "Handle required");

    const merchant: any = await findMerchantByHandle(handle);
    if (!merchant) {
      return errorResponseHelper(res, 404, "Shop not found.");
    }

    const products = await productModel.findAll({
      where: {
        merchant_user_id: merchant.dataValues.user_id,
        status: "live",
        deleted_at: null,
      },
      order: [["createdAt", "DESC"]],
      limit: 100,
    });

    // Fetch variants for products that need min-of-variants price shown
    const productIds = products.map((p: any) => Number(p.dataValues.product_id));
    const variants =
      productIds.length > 0
        ? await productVariantModel.findAll({
            where: { product_id: { [Op.in]: productIds }, is_active: true },
          })
        : [];
    const variantsByProduct: Record<string, any[]> = {};
    for (const v of variants) {
      const pid = String((v as any).dataValues.product_id);
      if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
      variantsByProduct[pid].push((v as any).dataValues);
    }

    const items = products.map((p: any) => {
      const proj = publicProductProjection(p.dataValues);
      // If has_variants, override base_price_cents with min-of-variants price
      const vs = variantsByProduct[String(proj.product_id)] || [];
      if (proj.has_variants && vs.length > 0) {
        const minPrice = Math.min(...vs.map((v: any) => Number(v.price_cents) || 0));
        proj.base_price_cents = minPrice;
      }
      return proj;
    });

    return successResponseHelper(res, 200, "Shop fetched.", {
      merchant: {
        handle: merchant.dataValues.handle,
        name:
          merchant.dataValues.name ||
          merchant.dataValues.username ||
          merchant.dataValues.handle,
        avatar: merchant.dataValues.photo || null,
        bio: merchant.dataValues.bio || null,
      },
      products: items,
    });
  } catch (e: any) {
    apiLogger.error("[shopController] getShopByHandle:", e?.stack || e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Get shop failed");
  }
};

export const getShopProductBySlug = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const handle = String(req.params.handle || "").trim().slice(0, 60);
    const slug = String(req.params.slug || "").trim().slice(0, 180);
    if (!handle || !slug)
      return errorResponseHelper(res, 400, "Handle and slug required");

    const merchant: any = await findMerchantByHandle(handle);
    if (!merchant) return errorResponseHelper(res, 404, "Shop not found.");

    const product: any = await productModel.findOne({
      where: {
        merchant_user_id: merchant.dataValues.user_id,
        slug,
        deleted_at: null,
      },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");

    // Allow preview when the caller is the owner (?preview=1)
    const isPreview = req.query.preview === "1";
    if (product.dataValues.status !== "live" && !isPreview) {
      return errorResponseHelper(res, 404, "Product not available.");
    }

    const variants = await productVariantModel.findAll({
      where: { product_id: product.dataValues.product_id, is_active: true },
      order: [["sort_order", "ASC"], ["variant_id", "ASC"]],
    });

    return successResponseHelper(res, 200, "Product fetched.", {
      merchant: {
        handle: merchant.dataValues.handle,
        name:
          merchant.dataValues.name ||
          merchant.dataValues.username ||
          merchant.dataValues.handle,
        avatar: merchant.dataValues.photo || null,
      },
      product: publicProductProjection(product.dataValues),
      variants: variants.map((v: any) => publicVariantProjection(v.dataValues)),
    });
  } catch (e: any) {
    apiLogger.error("[shopController] getShopProductBySlug:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Get product failed");
  }
};
