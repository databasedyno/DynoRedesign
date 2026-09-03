/**
 * shopController — public read-only browsing.
 *
 * Routes are unauthenticated but rate-limited at the router level.
 * Returns only `status='live'` products; drafts + archived stay merchant-only.
 *
 * Handles two views:
 *  - /api/shop/:handle           → merchant landing + product grid
 *  - /api/shop/:handle/products/:slug → single product detail
 *
 * Storefront-per-company: the handle resolves to a COMPANY (via
 * resolveStorefrontByHandle) when STOREFRONT_PER_COMPANY is ON, and the product
 * grid is scoped to that company_id. When OFF it stays user/account-scoped.
 */
import express from "express";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { productVariantModel } from "../../models";
import productModel from "../../models/userModels/productModel";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";
import {
  STOREFRONT_PER_COMPANY,
  resolveStorefrontByHandle,
  StorefrontOwner,
} from "../storefrontScope";

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
    hide_quantity: !!p.hide_quantity,
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

/** Products belonging to this storefront owner (company when flag ON, else user). */
function ownerProductWhere(owner: StorefrontOwner): Record<string, unknown> {
  if (STOREFRONT_PER_COMPANY && owner.company_id != null) {
    return { company_id: owner.company_id };
  }
  return { merchant_user_id: owner.user_id };
}

export const getShopByHandle = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const handle = String(req.params.handle || "").trim().slice(0, 60);
    if (!handle) return errorResponseHelper(res, 400, "Handle required");

    const owner = await resolveStorefrontByHandle(handle);
    if (!owner) {
      return errorResponseHelper(res, 404, "Shop not found.");
    }
    // Master store switch OFF => hide the storefront entirely.
    if (owner.store_enabled === false) {
      return errorResponseHelper(res, 404, "Shop not found.");
    }

    const products = await productModel.findAll({
      where: {
        ...ownerProductWhere(owner),
        status: "live",
        deleted_at: null,
      } as any,
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
      const vs = variantsByProduct[String(proj.product_id)] || [];
      if (proj.has_variants && vs.length > 0) {
        const minPrice = Math.min(...vs.map((v: any) => Number(v.price_cents) || 0));
        proj.base_price_cents = minPrice;
      }
      return proj;
    });

    return successResponseHelper(res, 200, "Shop fetched.", {
      merchant: {
        handle: owner.handle,
        name: owner.name || owner.handle,
        avatar: owner.photo || null,
        bio: owner.bio || null,
        accent: owner.theme_accent_color || null,
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

    const owner = await resolveStorefrontByHandle(handle);
    if (!owner) return errorResponseHelper(res, 404, "Shop not found.");
    if (owner.store_enabled === false) return errorResponseHelper(res, 404, "Shop not found.");

    const product: any = await productModel.findOne({
      where: {
        ...ownerProductWhere(owner),
        slug,
        deleted_at: null,
      } as any,
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");

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
        handle: owner.handle,
        name: owner.name || owner.handle,
        avatar: owner.photo || null,
        accent: owner.theme_accent_color || null,
      },
      product: publicProductProjection(product.dataValues),
      variants: variants.map((v: any) => publicVariantProjection(v.dataValues)),
    });
  } catch (e: any) {
    apiLogger.error("[shopController] getShopProductBySlug:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Get product failed");
  }
};

/**
 * getSitemapEntries — public, READ-ONLY feed of every indexable storefront +
 * live product, consumed by pages/sitemap.xml.tsx to emit localized (?lang=)
 * URLs with hreflang. Visibility mirrors the public shop endpoints exactly:
 *   - shop shown unless store_enabled = false (NULL/true both visible)
 *   - product must be status='live' AND not soft-deleted
 * Handle + store flag live on tbl_company under STOREFRONT_PER_COMPANY, else
 * on tbl_user (legacy). Results are LOWER()ed + capped well under the 50k
 * sitemap URL ceiling. No auth, no writes.
 */
export const getSitemapEntries = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    const SHOP_LIMIT = 20000;
    const PRODUCT_LIMIT = 40000;

    let shops: Array<{ handle: string }>;
    let products: Array<{ handle: string; slug: string; updated_at: string | null }>;

    // Public creator pages (/{handle}) — visible only when the page is enabled
    // (same rule as resolveStorefrontByHandle(handle, true)).
    const creatorTable = STOREFRONT_PER_COMPANY ? "tbl_company" : "tbl_user";
    const creators = (await sequelize.query(
      `SELECT LOWER(handle) AS handle
         FROM ${creatorTable}
        WHERE handle IS NOT NULL AND handle <> ''
          AND creator_page_enabled = true
        GROUP BY LOWER(handle)
        ORDER BY LOWER(handle)
        LIMIT :lim`,
      { replacements: { lim: SHOP_LIMIT }, type: QueryTypes.SELECT }
    )) as Array<{ handle: string }>;

    if (STOREFRONT_PER_COMPANY) {
      shops = (await sequelize.query(
        `SELECT LOWER(handle) AS handle
           FROM tbl_company
          WHERE handle IS NOT NULL AND handle <> ''
            AND COALESCE(store_enabled, true) = true
          GROUP BY LOWER(handle)
          ORDER BY LOWER(handle)
          LIMIT :lim`,
        { replacements: { lim: SHOP_LIMIT }, type: QueryTypes.SELECT }
      )) as Array<{ handle: string }>;

      products = (await sequelize.query(
        `SELECT LOWER(c.handle) AS handle, p.slug AS slug, p."updatedAt" AS updated_at
           FROM tbl_product p
           JOIN tbl_company c ON c.company_id = p.company_id
          WHERE p.status = 'live' AND p.deleted_at IS NULL
            AND c.handle IS NOT NULL AND c.handle <> ''
            AND COALESCE(c.store_enabled, true) = true
          ORDER BY LOWER(c.handle), p.slug
          LIMIT :lim`,
        { replacements: { lim: PRODUCT_LIMIT }, type: QueryTypes.SELECT }
      )) as Array<{ handle: string; slug: string; updated_at: string | null }>;
    } else {
      shops = (await sequelize.query(
        `SELECT LOWER(handle) AS handle
           FROM tbl_user
          WHERE handle IS NOT NULL AND handle <> ''
            AND COALESCE(store_enabled, true) = true
          GROUP BY LOWER(handle)
          ORDER BY LOWER(handle)
          LIMIT :lim`,
        { replacements: { lim: SHOP_LIMIT }, type: QueryTypes.SELECT }
      )) as Array<{ handle: string }>;

      products = (await sequelize.query(
        `SELECT LOWER(u.handle) AS handle, p.slug AS slug, p."updatedAt" AS updated_at
           FROM tbl_product p
           JOIN tbl_user u ON u.user_id = p.merchant_user_id
          WHERE p.status = 'live' AND p.deleted_at IS NULL
            AND u.handle IS NOT NULL AND u.handle <> ''
            AND COALESCE(u.store_enabled, true) = true
          ORDER BY LOWER(u.handle), p.slug
          LIMIT :lim`,
        { replacements: { lim: PRODUCT_LIMIT }, type: QueryTypes.SELECT }
      )) as Array<{ handle: string; slug: string; updated_at: string | null }>;
    }

    // Sitemaps don't need to be real-time — cache 15 min at the edge.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return successResponseHelper(res, 200, "Sitemap entries", {
      creators: creators.map((c) => ({ handle: c.handle })),
      shops: shops.map((s) => ({ handle: s.handle })),
      products: products.map((p) => ({
        handle: p.handle,
        slug: p.slug,
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : null,
      })),
    });
  } catch (e: any) {
    apiLogger.error("[shopController] getSitemapEntries:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Sitemap entries failed");
  }
};
