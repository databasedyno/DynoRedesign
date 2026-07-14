/**
 * Product controllers — merchant CRUD + variants + assets.
 *
 * Ownership guard: every write path checks `res.locals.user.user_id` (populated
 * by authMiddleware) against `product.merchant_user_id`. Public paths are in
 * shopController.ts.
 */
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  productVariantModel,
  productAssetModel,
  productOrderModel,
} from "../../models";
import productModel from "../../models/userModels/productModel";
import {
  successResponseHelper,
  errorResponseHelper,
} from "../../helper";
import { apiLogger } from "../../utils/loggers";
import { UPLOAD_ROOT } from "../../middleware/uploadProductAsset";

// ---------- helpers ----------

const VALID_PRODUCT_TYPES = new Set(["digital", "physical", "service"]);
const VALID_STATUSES = new Set(["draft", "live", "archived"]);
const VALID_DIGITAL_TYPES = new Set(["file", "license_key", "url"]);

function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "item";
}

async function ensureUniqueSlug(
  merchantUserId: number,
  baseSlug: string,
  excludeProductId?: number
): Promise<string> {
  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const where: any = {
      merchant_user_id: merchantUserId,
      slug,
      deleted_at: null,
    };
    if (excludeProductId) {
      where.product_id = { [Op.ne]: excludeProductId };
    }
    const existing = await productModel.findOne({ where });
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
    if (attempt > 200) throw new Error("Could not generate unique slug");
  }
}

function ownerId(res: express.Response): number | null {
  const u = res.locals?.user as { user_id?: number } | undefined;
  return u?.user_id ? Number(u.user_id) : null;
}

function ensureOwner(res: express.Response, product: any): number | null {
  const uid = ownerId(res);
  if (!uid) {
    errorResponseHelper(res, 401, "Authentication required.");
    return null;
  }
  if (Number(product.dataValues.merchant_user_id) !== uid) {
    errorResponseHelper(res, 403, "You are not the owner of this product.");
    return null;
  }
  return uid;
}

function sanitizeIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function sanitizeGallery(v: any): Array<{ url: string; alt?: string }> {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r) => r && typeof r === "object" && typeof r.url === "string")
    .slice(0, 10)
    .map((r) => ({
      url: String(r.url).slice(0, 512),
      alt: r.alt ? String(r.alt).slice(0, 240) : undefined,
    }));
}

// ---------- List / Get / Create / Update / Delete ----------

/**
 * List distinct categories this merchant has used across their catalog.
 * Powers the merchant-side category filter dropdown (Doc-1 P2).
 * Returns { categories: string[] }, sorted alphabetically, plus a
 * `has_uncategorized` flag so the UI can offer an "Uncategorized" chip.
 */
export const listMyCategories = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");

    const seq = productModel.sequelize!;
    const rows: any[] = await seq.query(
      `SELECT DISTINCT category
       FROM tbl_product
       WHERE merchant_user_id = :uid AND deleted_at IS NULL
       ORDER BY category NULLS FIRST`,
      {
        replacements: { uid },
        type: (seq as any).QueryTypes?.SELECT || undefined,
      }
    ) as any;

    const list = Array.isArray(rows) ? rows : (rows as any)[0] || [];
    const categories = list
      .map((r: any) => (r?.category ? String(r.category).trim() : null))
      .filter((c: string | null) => Boolean(c)) as string[];
    const has_uncategorized = list.some((r: any) => !r?.category);

    return successResponseHelper(res, 200, "Categories fetched.", {
      categories,
      has_uncategorized,
    });
  } catch (e: any) {
    apiLogger.error("[productController] listMyCategories:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "List categories failed");
  }
};

export const listProducts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");

    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    // Category filter (Doc-1 P2). Free-form string on tbl_product.category;
    // an empty string filters "uncategorized only" (categpry IS NULL).
    const categoryRaw = req.query.category;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const where: any = { merchant_user_id: uid, deleted_at: null };
    if (type && VALID_PRODUCT_TYPES.has(type)) where.product_type = type;
    if (status && VALID_STATUSES.has(status)) where.status = status;
    if (q) where.title = { [Op.iLike]: `%${q}%` };
    if (typeof categoryRaw === "string") {
      const trimmed = categoryRaw.trim();
      if (trimmed === "" || trimmed === "__uncategorized__") {
        where.category = null;
      } else {
        where.category = trimmed.slice(0, 64);
      }
    }

    const { rows, count } = await productModel.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return successResponseHelper(res, 200, "Products fetched.", {
      items: rows.map((r: any) => r.dataValues),
      total: count,
      limit,
      offset,
    });
  } catch (e: any) {
    apiLogger.error("[productController] listProducts:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "List products failed");
  }
};

export const getProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId))
      return errorResponseHelper(res, 400, "Invalid product_id");

    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (Number(product.dataValues.merchant_user_id) !== uid) {
      return errorResponseHelper(res, 403, "You are not the owner of this product.");
    }

    const variants = await productVariantModel.findAll({
      where: { product_id: productId },
      order: [["sort_order", "ASC"], ["variant_id", "ASC"]],
    });
    const assets = await productAssetModel.findAll({
      where: { product_id: productId, is_active: true },
      order: [["createdAt", "ASC"]],
    });

    return successResponseHelper(res, 200, "Product fetched.", {
      product: product.dataValues,
      variants: variants.map((v: any) => v.dataValues),
      assets: assets.map((a: any) => ({
        // Never leak storage internals to the merchant
        asset_id: a.dataValues.asset_id,
        filename: a.dataValues.filename,
        mime_type: a.dataValues.mime_type,
        size_bytes: a.dataValues.size_bytes,
        is_active: a.dataValues.is_active,
        createdAt: a.dataValues.createdAt,
      })),
    });
  } catch (e: any) {
    apiLogger.error("[productController] getProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Get product failed");
  }
};

function pickProductPayload(body: any) {
  const out: any = {};
  if (typeof body.title === "string") out.title = body.title.trim().slice(0, 160);
  if (typeof body.subtitle === "string") out.subtitle = body.subtitle.trim().slice(0, 240);
  if (typeof body.description_md === "string") out.description_md = body.description_md.slice(0, 20000);
  if (typeof body.currency === "string") out.currency = body.currency.toUpperCase().slice(0, 3);
  if (typeof body.category === "string") out.category = body.category.trim().slice(0, 64);
  if (typeof body.cover_image_url === "string") out.cover_image_url = body.cover_image_url.slice(0, 1024);
  if (Array.isArray(body.gallery_images)) out.gallery_images = sanitizeGallery(body.gallery_images);
  if (body.base_price_cents !== undefined) {
    const n = Number(body.base_price_cents);
    out.base_price_cents = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (typeof body.product_type === "string" && VALID_PRODUCT_TYPES.has(body.product_type)) {
    out.product_type = body.product_type;
  }
  if (typeof body.has_variants === "boolean") out.has_variants = body.has_variants;
  if (body.base_stock !== undefined) out.base_stock = sanitizeIntOrNull(body.base_stock);
  if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) out.status = body.status;

  // Digital-only fields (Phase 1). Physical + service accepted but not
  // enforced in the buyer flow yet.
  if (typeof body.digital_delivery_type === "string" && VALID_DIGITAL_TYPES.has(body.digital_delivery_type)) {
    out.digital_delivery_type = body.digital_delivery_type;
  } else if (body.digital_delivery_type === null) {
    out.digital_delivery_type = null;
  }
  if (body.digital_delivery_payload && typeof body.digital_delivery_payload === "object") {
    out.digital_delivery_payload = body.digital_delivery_payload;
  }

  if (body.physical_shipping_flat_cents !== undefined) {
    out.physical_shipping_flat_cents = sanitizeIntOrNull(body.physical_shipping_flat_cents);
  }
  if (body.physical_weight_grams !== undefined) {
    out.physical_weight_grams = sanitizeIntOrNull(body.physical_weight_grams);
  }
  if (body.service_duration_minutes !== undefined) {
    out.service_duration_minutes = sanitizeIntOrNull(body.service_duration_minutes);
  }
  if (typeof body.service_calendar_url === "string") out.service_calendar_url = body.service_calendar_url.slice(0, 1024);

  return out;
}

export const createProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");

    const body = req.body || {};
    if (!body.title || String(body.title).trim().length < 2) {
      return errorResponseHelper(res, 400, "Product title is required.");
    }

    const payload = pickProductPayload(body);
    const baseSlug =
      typeof body.slug === "string" && body.slug.trim().length > 0
        ? slugify(body.slug)
        : slugify(body.title);
    payload.slug = await ensureUniqueSlug(uid, baseSlug);
    payload.merchant_user_id = uid;
    payload.status = payload.status || "draft";
    payload.product_type = payload.product_type || "digital";

    const created: any = await productModel.create(payload);

    return successResponseHelper(res, 201, "Product created.", {
      product: created.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] createProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Create product failed");
  }
};

export const updateProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId))
      return errorResponseHelper(res, 400, "Invalid product_id");

    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;

    const body = req.body || {};
    const payload = pickProductPayload(body);
    if (typeof body.slug === "string" && body.slug.trim().length > 0) {
      payload.slug = await ensureUniqueSlug(uid, slugify(body.slug), productId);
    }
    await product.update(payload);
    return successResponseHelper(res, 200, "Product updated.", {
      product: product.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] updateProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Update product failed");
  }
};

export const deleteProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;
    await product.update({ deleted_at: new Date(), status: "archived" });
    return successResponseHelper(res, 200, "Product archived (soft-deleted).");
  } catch (e: any) {
    apiLogger.error("[productController] deleteProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Delete product failed");
  }
};

export const publishProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;

    // Validation: title, price OR variants, and (digital → delivery configured)
    const d = product.dataValues;
    const problems: string[] = [];
    if (!d.title) problems.push("Missing title");
    if (!d.currency) problems.push("Missing currency");
    if (!d.has_variants && Number(d.base_price_cents) <= 0) {
      problems.push("Base price must be greater than 0");
    }
    if (d.has_variants) {
      const vc = await productVariantModel.count({
        where: { product_id: productId, is_active: true },
      });
      if (vc === 0) problems.push("At least one active variant is required when variants are enabled");
    }
    if (d.product_type === "digital") {
      if (!d.digital_delivery_type) problems.push("Choose a digital delivery method (file, license key, or URL)");
      if (d.digital_delivery_type === "file") {
        const payload = d.digital_delivery_payload || {};
        const assetIds = Array.isArray(payload.asset_ids) ? payload.asset_ids : [];
        if (assetIds.length === 0) {
          problems.push("Upload at least one file for digital delivery");
        }
      }
      if (d.digital_delivery_type === "license_key") {
        const payload = d.digital_delivery_payload || {};
        const keys = Array.isArray(payload.keys) ? payload.keys : [];
        if (keys.length === 0) problems.push("Add at least one license key to the pool");
      }
      if (d.digital_delivery_type === "url") {
        const payload = d.digital_delivery_payload || {};
        if (!payload.access_url) problems.push("Set the access URL to deliver on payment");
      }
    }

    if (problems.length > 0) {
      return errorResponseHelper(res, 400, `Cannot publish: ${problems.join("; ")}`);
    }

    await product.update({ status: "live" });
    return successResponseHelper(res, 200, "Product published.", {
      product: product.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] publishProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Publish failed");
  }
};

export const archiveProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;
    await product.update({ status: "archived" });
    return successResponseHelper(res, 200, "Product archived.", {
      product: product.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] archiveProduct:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Archive failed");
  }
};

// ---------- Variants ----------

function pickVariantPayload(body: any) {
  const out: any = {};
  if (body.sku !== undefined) out.sku = body.sku ? String(body.sku).slice(0, 80) : null;
  if (body.attributes && typeof body.attributes === "object") out.attributes = body.attributes;
  if (body.price_cents !== undefined) {
    const n = Number(body.price_cents);
    out.price_cents = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (body.stock_count !== undefined) out.stock_count = sanitizeIntOrNull(body.stock_count);
  if (body.image_url !== undefined) out.image_url = body.image_url ? String(body.image_url).slice(0, 1024) : null;
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    out.sort_order = Number.isFinite(n) ? Math.floor(n) : 0;
  }
  if (typeof body.is_active === "boolean") out.is_active = body.is_active;
  return out;
}

export const createVariant = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;

    const payload = pickVariantPayload(req.body || {});
    payload.product_id = productId;
    const v: any = await productVariantModel.create(payload);

    // Auto-flag product has_variants=true on first variant
    if (!product.dataValues.has_variants) {
      await product.update({ has_variants: true });
    }

    return successResponseHelper(res, 201, "Variant created.", {
      variant: v.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] createVariant:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Create variant failed");
  }
};

export const updateVariant = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;
    const v: any = await productVariantModel.findOne({
      where: { variant_id: variantId, product_id: productId },
    });
    if (!v) return errorResponseHelper(res, 404, "Variant not found.");
    await v.update(pickVariantPayload(req.body || {}));
    return successResponseHelper(res, 200, "Variant updated.", {
      variant: v.dataValues,
    });
  } catch (e: any) {
    apiLogger.error("[productController] updateVariant:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Update variant failed");
  }
};

export const deleteVariant = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;
    const v: any = await productVariantModel.findOne({
      where: { variant_id: variantId, product_id: productId },
    });
    if (!v) return errorResponseHelper(res, 404, "Variant not found.");
    await v.destroy();
    return successResponseHelper(res, 200, "Variant deleted.");
  } catch (e: any) {
    apiLogger.error("[productController] deleteVariant:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Delete variant failed");
  }
};

// ---------- Assets ----------

export const uploadAsset = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return errorResponseHelper(res, 400, "No file uploaded.");

    // Magic-byte sniff (spec §10). Extension check happens in multer's
    // fileFilter; this catches attacker-renamed executables that slipped
    // past. If the first bytes match a known-dangerous signature (PE, ELF,
    // Mach-O, class file, shell shebang, .lnk), we delete the file and 400.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { magicSniff } = require("../../utils/fileMagicCheck");
      const hit: string | null = await magicSniff(file.path);
      if (hit) {
        try { fs.unlinkSync(file.path); } catch { /* best-effort */ }
        return errorResponseHelper(
          res,
          400,
          `File contents match '${hit}' — this format is blocked for security. Please upload it inside a ZIP if it's genuinely part of your product.`
        );
      }
    } catch (sniffErr: any) {
      apiLogger.warn(`[uploadAsset] magic sniff failed: ${sniffErr?.message || sniffErr}`);
      // Fall-open: don't block uploads on a sniff error (log-only).
    }

    // Compute sha256 for integrity
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file.path);
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });
    const sha = hash.digest("hex");

    // Storage object = relative path under UPLOAD_ROOT (portable if UPLOAD_ROOT changes).
    const relPath = path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, "/");

    const asset: any = await productAssetModel.create({
      product_id: productId,
      merchant_user_id: uid,
      filename: file.originalname.slice(0, 255),
      mime_type: (file.mimetype || "application/octet-stream").slice(0, 100),
      size_bytes: file.size,
      storage_backend: "local",
      storage_object: relPath,
      sha256: sha,
      is_active: true,
    });

    // Auto-link to product.digital_delivery_payload.asset_ids for convenience.
    const payload = product.dataValues.digital_delivery_payload || {};
    const currentIds: number[] = Array.isArray(payload.asset_ids)
      ? payload.asset_ids.map((n: any) => Number(n)).filter(Boolean)
      : [];
    if (!currentIds.includes(Number(asset.dataValues.asset_id))) {
      currentIds.push(Number(asset.dataValues.asset_id));
    }
    const nextDeliveryType = product.dataValues.digital_delivery_type || "file";
    await product.update({
      digital_delivery_type: nextDeliveryType,
      digital_delivery_payload: { ...payload, asset_ids: currentIds },
    });

    return successResponseHelper(res, 201, "Asset uploaded.", {
      asset: {
        asset_id: asset.dataValues.asset_id,
        filename: asset.dataValues.filename,
        mime_type: asset.dataValues.mime_type,
        size_bytes: asset.dataValues.size_bytes,
        sha256: asset.dataValues.sha256,
      },
    });
  } catch (e: any) {
    apiLogger.error("[productController] uploadAsset:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Upload failed");
  }
};

export const deleteAsset = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);
    const assetId = Number(req.params.assetId);
    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;
    const asset: any = await productAssetModel.findOne({
      where: { asset_id: assetId, product_id: productId },
    });
    if (!asset) return errorResponseHelper(res, 404, "Asset not found.");

    await asset.update({ is_active: false });
    // Remove from product.digital_delivery_payload.asset_ids
    const payload = product.dataValues.digital_delivery_payload || {};
    const currentIds: number[] = Array.isArray(payload.asset_ids)
      ? payload.asset_ids.map((n: any) => Number(n)).filter(Boolean)
      : [];
    const nextIds = currentIds.filter((id) => id !== assetId);
    await product.update({
      digital_delivery_payload: { ...payload, asset_ids: nextIds },
    });

    return successResponseHelper(res, 200, "Asset removed.");
  } catch (e: any) {
    apiLogger.error("[productController] deleteAsset:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "Delete asset failed");
  }
};

// ---------- Orders per product (merchant view) ----------

export const listProductOrders = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const productId = Number(req.params.productId);

    const product: any = await productModel.findOne({
      where: { product_id: productId, deleted_at: null },
    });
    if (!product) return errorResponseHelper(res, 404, "Product not found.");
    if (!ensureOwner(res, product)) return;

    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    // Filter orders whose items include this product
    const raw = await productOrderModel.sequelize!.query(
      `SELECT DISTINCT o.*
       FROM tbl_product_order o
       JOIN tbl_product_order_item i ON i.order_id = o.order_id
       WHERE i.product_id = :productId
         AND o.merchant_user_id = :uid
         ${status ? "AND o.payment_status = :status" : ""}
       ORDER BY o."createdAt" DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { productId, uid, status, limit, offset },
        type: "SELECT" as any,
      }
    );
    return successResponseHelper(res, 200, "Orders fetched.", {
      items: raw,
      limit,
      offset,
    });
  } catch (e: any) {
    apiLogger.error("[productController] listProductOrders:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "List orders failed");
  }
};

// Merchant view of all orders (across all products)
export const listAllOrders = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const uid = ownerId(res);
    if (!uid) return errorResponseHelper(res, 401, "Authentication required.");
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where: any = { merchant_user_id: uid };
    if (status) where.payment_status = status;

    const { rows, count } = await productOrderModel.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    return successResponseHelper(res, 200, "Orders fetched.", {
      items: rows.map((r: any) => r.dataValues),
      total: count,
      limit,
      offset,
    });
  } catch (e: any) {
    apiLogger.error("[productController] listAllOrders:", e?.message || e);
    return errorResponseHelper(res, 500, e?.message || "List orders failed");
  }
};
