/**
 * Storefront-per-company scope helpers (feature-flagged).
 *
 * When STOREFRONT_PER_COMPANY is OFF (default) every helper resolves to the
 * legacy ACCOUNT/USER-scoped behavior, so the app is byte-for-byte unchanged.
 *
 * When ON (after migration 010 runs on the DB) the public storefront handle,
 * the creator/storefront page settings and the product catalog belong to a
 * COMPANY instead of the whole account — i.e. each company gets its OWN handle,
 * public page and catalog.
 *
 * IMPORTANT: this flag must ONLY be flipped to true AFTER the migration
 * (backend/migrations/010_storefront_per_company.sql) has been applied, because
 * the ON path reads/writes columns that migration adds to tbl_company /
 * tbl_product / tbl_product_order.
 */
import { raw as envRaw } from "../utils/config";
import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { companyModel, userModel } from "../models";
import { publicBrandName } from "../helper/brandName";

export const STOREFRONT_PER_COMPANY =
  String(envRaw("STOREFRONT_PER_COMPANY") ?? "false").toLowerCase() === "true";

/** Creator/storefront columns that live on tbl_company under the flag (mirror tbl_user). */
export const STOREFRONT_COLUMNS = [
  "handle", "bio", "creator_page_enabled", "cover_image", "social_links",
  "support_widget_enabled", "support_widget_style", "support_widget_label",
  "support_widget_preset_amounts", "support_widget_currency", "support_widget_min_amount",
  "support_widget_allow_message", "support_widget_thanks_message", "support_widget_show_supporters",
  "support_widget_show_wall", "support_widget_monthly_goal",
  "theme_accent_color", "theme_cover_style", "theme_cover_gradient",
  "public_analytics_enabled",
  "store_enabled", "creator_page_show_products",
];

/** Read a requested company_id from body/query/header (raw, unvalidated). */
export function getRequestedCompanyId(req: express.Request): number | null {
  const raw =
    (req.body && (req.body as Record<string, unknown>).company_id) ??
    (req.query && (req.query as Record<string, unknown>).company_id) ??
    req.headers["x-company-id"];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Owned company_ids for a user (ascending; [0] is the "primary" company). */
export async function ownedCompanyIds(userId: number): Promise<number[]> {
  const rows = (await companyModel.findAll({
    where: { user_id: userId },
    attributes: ["company_id"],
    order: [["company_id", "ASC"]],
  })) as Array<{ dataValues: { company_id: number } }>;
  return rows.map((r) => Number(r.dataValues.company_id));
}

export async function isCompanyOwnedByUser(userId: number, companyId: number): Promise<boolean> {
  if (!Number.isFinite(companyId)) return false;
  const c = await companyModel.findOne({
    where: { company_id: companyId, user_id: userId },
    attributes: ["company_id"],
  });
  return !!c;
}

/**
 * Resolve the company_id an authenticated merchant is acting within.
 * Order: explicit (validated) request value → last_company_id → primary.
 * Returns null only if the user owns no company.
 */
export async function resolveActiveCompanyId(req: express.Request, userId: number): Promise<number | null> {
  const owned = await ownedCompanyIds(userId);
  if (owned.length === 0) return null;
  const requested = getRequestedCompanyId(req);
  if (requested != null && owned.includes(requested)) return requested;
  const user = (await userModel.findByPk(userId, { attributes: ["last_company_id"] })) as
    | { dataValues: { last_company_id: number | null } }
    | null;
  const last = Number(user?.dataValues?.last_company_id);
  if (Number.isFinite(last) && owned.includes(last)) return last;
  return owned[0];
}

export interface LegacyStorefrontHolder {
  activeCompanyId: number | null;
  primaryCompanyId: number | null;
  isPrimary: boolean;
}

/**
 * Flag-OFF only: the account storefront (tbl_user.handle) is presented as
 * belonging to the PRIMARY company (lowest company_id — the same company
 * migration 010 backfills it to). Acting inside any OTHER company must not
 * show or edit the account storefront, so a freshly created company never
 * inherits the first company's URL, stats or catalog.
 */
export async function resolveLegacyStorefrontHolder(
  req: express.Request,
  userId: number
): Promise<LegacyStorefrontHolder> {
  const owned = await ownedCompanyIds(userId);
  if (owned.length === 0) return { activeCompanyId: null, primaryCompanyId: null, isPrimary: true };
  const primary = owned[0];
  if (owned.length === 1) return { activeCompanyId: primary, primaryCompanyId: primary, isPrimary: true };
  const requested = getRequestedCompanyId(req);
  let active: number | null = requested != null && owned.includes(requested) ? requested : null;
  if (active == null) {
    const user = (await userModel.findByPk(userId, { attributes: ["last_company_id"] })) as
      | { dataValues: { last_company_id: number | null } }
      | null;
    const last = Number(user?.dataValues?.last_company_id);
    active = Number.isFinite(last) && owned.includes(last) ? last : primary;
  }
  return { activeCompanyId: active, primaryCompanyId: primary, isPrimary: active === primary };
}

export interface StorefrontOwner {
  user_id: number;
  company_id: number | null;
  name: string | null;
  photo: string | null;
  bio: string | null;
  handle: string | null;
  creator_page_enabled: boolean;
  cover_image: string | null;
  social_links: Record<string, string> | null;
  support_widget_enabled: boolean | null;
  support_widget_style: string | null;
  support_widget_label: string | null;
  support_widget_preset_amounts: unknown;
  support_widget_currency: string | null;
  support_widget_min_amount: number | string | null;
  support_widget_allow_message: boolean | null;
  support_widget_thanks_message: string | null;
  support_widget_show_supporters: boolean | null;
  support_widget_show_wall: boolean | null;
  support_widget_monthly_goal: number | string | null;
  theme_accent_color: string | null;
  theme_cover_style: string | null;
  theme_cover_gradient: string | null;
  public_analytics_enabled: boolean | null;
  store_enabled: boolean | null;
  creator_page_show_products: boolean | null;
}

/**
 * Public resolution of a storefront by its vanity handle.
 *  - Flag ON  → tbl_company (joined to tbl_user for the owner-name fallback; the
 *                avatar is the BRAND logo only — the account photo never leaks
 *                onto another brand's storefront).
 *  - Flag OFF → tbl_user (legacy).
 * `requireEnabled` filters to creator_page_enabled=true (the creator PAGE); the
 * shop passes requireEnabled=false (a shop can exist without the page live).
 */
export async function resolveStorefrontByHandle(
  handle: string,
  requireEnabled = false
): Promise<StorefrontOwner | null> {
  const clean = String(handle || "").trim().toLowerCase();
  if (!clean) return null;

  // Fast-path: a real vanity handle only ever contains [a-z0-9_-] and is short
  // (creation enforces /^[a-z0-9][a-z0-9_-]{2,29}$/). Bot/vuln scanners probe
  // paths like "sftp-config.json", ".env", "wp-login.php" — reject these BEFORE
  // touching the DB so the guaranteed-404 never costs a remote round-trip. This
  // check is a strict superset of the creation rule, so no valid handle is lost.
  if (clean.length > 40 || /[^a-z0-9_-]/.test(clean)) return null;

  if (STOREFRONT_PER_COMPANY) {
    const rows = (await sequelize.query(
      `SELECT c.company_id, c.user_id,
              c.company_name, u.name AS owner_name, c.email AS company_email, u.email AS owner_email,
              NULLIF(c.photo, '') AS photo,
              c.bio, c.handle, c.creator_page_enabled, c.cover_image, c.social_links,
              c.support_widget_enabled, c.support_widget_style, c.support_widget_label,
              c.support_widget_preset_amounts, c.support_widget_currency, c.support_widget_min_amount,
              c.support_widget_allow_message, c.support_widget_thanks_message, c.support_widget_show_supporters,
              c.support_widget_show_wall, c.support_widget_monthly_goal,
              c.theme_accent_color, c.theme_cover_style, c.theme_cover_gradient,
              c.public_analytics_enabled,
              c.store_enabled, c.creator_page_show_products
       FROM tbl_company c
       JOIN tbl_user u ON u.user_id = c.user_id
       WHERE LOWER(c.handle) = :handle ${requireEnabled ? "AND c.creator_page_enabled = true" : ""}
       LIMIT 1`,
      { replacements: { handle: clean }, type: QueryTypes.SELECT }
    )) as Array<StorefrontOwner & { company_name: string | null; owner_name: string | null; company_email: string | null; owner_email: string | null }>;
    if (!rows.length) return null;
    const { company_name, owner_name, company_email, owner_email, ...rest } = rows[0];
    // A1: never publish a generated placeholder ("handle_529785728b") as the brand name.
    const emails = [company_email, owner_email];
    return { ...rest, name: publicBrandName([company_name, owner_name], emails) ?? rest.handle };
  }

  const rows = (await sequelize.query(
    `SELECT user_id, name, email AS owner_email, photo, bio, handle, creator_page_enabled, cover_image, social_links,
            support_widget_enabled, support_widget_style, support_widget_label,
            support_widget_preset_amounts, support_widget_currency, support_widget_min_amount,
            support_widget_allow_message, support_widget_thanks_message, support_widget_show_supporters,
            support_widget_show_wall, support_widget_monthly_goal,
            theme_accent_color, theme_cover_style, theme_cover_gradient, public_analytics_enabled,
            store_enabled, creator_page_show_products
     FROM tbl_user
     WHERE LOWER(handle) = :handle ${requireEnabled ? "AND creator_page_enabled = true" : ""}
     LIMIT 1`,
    { replacements: { handle: clean }, type: QueryTypes.SELECT }
  )) as Array<Omit<StorefrontOwner, "company_id"> & { owner_email: string | null }>;
  if (!rows.length) return null;
  const { owner_email, ...legacy } = rows[0];
  return { ...legacy, name: publicBrandName([legacy.name], [owner_email]) ?? legacy.handle, company_id: null };
}

/** Is a handle already taken? Flag ON → across tbl_company; OFF → across tbl_user. */
export async function isHandleTaken(
  handle: string,
  exclude: { userId?: number; companyId?: number } = {}
): Promise<boolean> {
  const clean = String(handle || "").trim().toLowerCase();
  if (!clean) return false;
  if (STOREFRONT_PER_COMPANY) {
    const row = (await companyModel.findOne({
      where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), clean),
      attributes: ["company_id"],
    })) as { dataValues: { company_id: number } } | null;
    return !!(row && Number(row.dataValues.company_id) !== Number(exclude.companyId));
  }
  const row = (await userModel.findOne({
    where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), clean),
    attributes: ["user_id"],
  })) as { dataValues: { user_id: number } } | null;
  return !!(row && Number(row.dataValues.user_id) !== Number(exclude.userId));
}
