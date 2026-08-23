import { normalizeHandle, validateHandle, isHandleOwnedByUser, handleReserveKey, HANDLE_RESERVE_TTL_SECONDS } from "./creatorHandle";
import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import emailService from "../../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel, loginActivityModel } from "../../models";
import { userWalletAddressModel } from "../../models/userModels";
import notificationModel from "../../models/notificationModel";
import notificationPreferencesModel from "../../models/notificationPreferencesModel";
import kycModel from "../../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../helper/passwordHelper";
import crypto from "crypto";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import axios from "axios";
import { userLogger } from "../../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";
import { STOREFRONT_PER_COMPANY, STOREFRONT_COLUMNS, isHandleTaken, resolveActiveCompanyId, resolveLegacyStorefrontHolder } from "../storefrontScope";

export const updateCreatorProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      handle: rawHandle, name: rawName, bio, creator_page_enabled, cover_image, social_links,
      support_widget_enabled, support_widget_style, support_widget_label,
      support_widget_preset_amounts, support_widget_currency, support_widget_min_amount,
      support_widget_allow_message, support_widget_thanks_message, support_widget_show_supporters,
      theme_accent_color, theme_cover_style, theme_cover_gradient,
      public_analytics_enabled,
    } = req.body as {
      handle?: string;
      name?: string | null;
      bio?: string;
      creator_page_enabled?: boolean;
      cover_image?: string | null;
      social_links?: Record<string, string> | null;
      support_widget_enabled?: boolean;
      support_widget_style?: string;
      support_widget_label?: string | null;
      support_widget_preset_amounts?: unknown;
      support_widget_currency?: string;
      support_widget_min_amount?: number | string;
      support_widget_allow_message?: boolean;
      support_widget_thanks_message?: string | null;
      support_widget_show_supporters?: boolean;
      theme_accent_color?: string | null;
      theme_cover_style?: string | null;
      theme_cover_gradient?: string | null;
      public_analytics_enabled?: boolean;
    };
    const updates: Record<string, unknown> = {};
    // Reservation key to release once the handle is successfully assigned.
    let reservedKeyToRelease: string | null = null;

    // Storefront-per-company: write to the ACTIVE company instead of tbl_user.
    const perCompany = STOREFRONT_PER_COMPANY;
    let activeCompanyId: number | null = null;
    if (perCompany) {
      activeCompanyId = await resolveActiveCompanyId(req, userData.user_id);
      if (!activeCompanyId) return errorResponseHelper(res, 400, "No company selected");
    } else {
      // Legacy (flag OFF): the shared account storefront belongs to the PRIMARY
      // company. Editing it while acting inside another company would silently
      // rename/repoint the first company's live URL — block with a clear message.
      const holder = await resolveLegacyStorefrontHolder(req, userData.user_id);
      if (!holder.isPrimary) {
        return errorResponseHelper(
          res, 400,
          "This company doesn't have its own storefront yet — switch to your primary company to edit the shared storefront"
        );
      }
    }

    if (rawHandle !== undefined) {
      const handle = normalizeHandle(rawHandle);
      const err = validateHandle(handle);
      if (err) return errorResponseHelper(res, 400, err);
      const taken = perCompany
        ? await isHandleTaken(handle, { companyId: activeCompanyId ?? undefined })
        : await isHandleOwnedByUser(handle, userData.user_id);
      if (taken) {
        return errorResponseHelper(res, 409, "This handle is already taken");
      }
      // Honour an active reservation held by a DIFFERENT visitor's token. The
      // client presents its own token (from the landing-page claim) as
      // `handle_reservation_token`; a matching/absent reservation is allowed.
      const reserveKey = handleReserveKey(handle);
      const token = typeof (req.body as { handle_reservation_token?: string })?.handle_reservation_token === "string"
        ? (req.body as { handle_reservation_token?: string }).handle_reservation_token as string
        : "";
      try {
        const holder = await redis.get(reserveKey);
        if (holder && holder !== token) {
          return errorResponseHelper(res, 409, "This handle is currently reserved by someone else");
        }
        if (holder) reservedKeyToRelease = reserveKey;
      } catch { /* Redis down → proceed with the DB-level check only */ }
      updates.handle = handle;
    }

    // Display name (spec Doc-3 §C). Distinct from handle — shown as the
    // header on the public /{handle} page and in receipt emails. Empty
    // string / null clears the override (creator falls back to handle).
    if (rawName !== undefined) {
      if (rawName === null || rawName === "") {
        updates.name = null;
      } else {
        const trimmed = String(rawName).trim().slice(0, 80);
        if (trimmed.length < 1) {
          updates.name = null;
        } else {
          updates.name = trimmed;
        }
      }
    }

    if (bio !== undefined) {
      updates.bio = String(bio || "").slice(0, 500);
    }
    if (creator_page_enabled !== undefined) {
      updates.creator_page_enabled = Boolean(creator_page_enabled);
    }
    if (public_analytics_enabled !== undefined) {
      updates.public_analytics_enabled = Boolean(public_analytics_enabled);
    }

    // Cover image: URL string (uploaded via /user/creator/upload-cover) or null to clear
    if (cover_image !== undefined) {
      if (cover_image === null || cover_image === "") {
        updates.cover_image = null;
      } else {
        const url = String(cover_image).trim();
        // Basic URL sanity: must be http(s) or a local /api/static path
        if (!/^https?:\/\//.test(url) && !url.startsWith("/api/static/")) {
          return errorResponseHelper(res, 400, "Invalid cover image URL");
        }
        updates.cover_image = url.slice(0, 500);
      }
    }

    // Social links: allowlist platforms + basic URL validation
    if (social_links !== undefined) {
      const ALLOWED = ["twitter", "instagram", "youtube", "tiktok", "website"] as const;
      const cleaned: Record<string, string> = {};
      const src = (social_links && typeof social_links === "object") ? social_links : {};
      for (const key of ALLOWED) {
        const raw = String((src as Record<string, unknown>)[key] || "").trim();
        if (!raw) continue;
        // Accept full URLs or bare handles (@name) — normalize handles to URLs client-side.
        // Here we only enforce max length and that it's not obviously malicious.
        if (raw.length > 200) {
          return errorResponseHelper(res, 400, `${key} link is too long (max 200 chars)`);
        }
        // Reject javascript:/data: URIs
        if (/^\s*(javascript:|data:|vbscript:)/i.test(raw)) {
          return errorResponseHelper(res, 400, `Invalid ${key} link`);
        }
        cleaned[key] = raw;
      }
      updates.social_links = cleaned;
    }

    // ── Support Widget (Tip / Buy-me-a-coffee) — creator-exclusive ──
    if (support_widget_enabled !== undefined) {
      updates.support_widget_enabled = Boolean(support_widget_enabled);
    }
    if (support_widget_style !== undefined) {
      const style = String(support_widget_style || "").trim().toLowerCase();
      if (!["coffee", "tip", "support"].includes(style)) {
        return errorResponseHelper(res, 400, "Invalid widget style. Choose coffee, tip, or support.");
      }
      updates.support_widget_style = style;
    }
    if (support_widget_label !== undefined) {
      updates.support_widget_label = support_widget_label ? String(support_widget_label).trim().slice(0, 80) : null;
    }
    if (support_widget_preset_amounts !== undefined) {
      let arr: unknown = support_widget_preset_amounts;
      if (typeof arr === "string") {
        arr = arr.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(arr)) {
        return errorResponseHelper(res, 400, "Preset amounts must be a list of numbers.");
      }
      const nums = (arr as unknown[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.round(n * 100) / 100);
      if (nums.length > 5) {
        return errorResponseHelper(res, 400, "You can set at most 5 preset amounts.");
      }
      // De-dupe while preserving order
      updates.support_widget_preset_amounts = [...new Set(nums)];
    }
    if (support_widget_currency !== undefined) {
      const cur = String(support_widget_currency || "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return errorResponseHelper(res, 400, "Invalid currency code.");
      }
      updates.support_widget_currency = cur;
    }
    if (support_widget_min_amount !== undefined) {
      const min = Number(support_widget_min_amount);
      if (!Number.isFinite(min) || min <= 0 || min > 1000000) {
        return errorResponseHelper(res, 400, "Minimum amount must be a positive number.");
      }
      updates.support_widget_min_amount = Math.round(min * 100) / 100;
    }
    if (support_widget_allow_message !== undefined) {
      updates.support_widget_allow_message = Boolean(support_widget_allow_message);
    }
    if (support_widget_thanks_message !== undefined) {
      updates.support_widget_thanks_message = support_widget_thanks_message
        ? String(support_widget_thanks_message).trim().slice(0, 280)
        : null;
    }
    if (support_widget_show_supporters !== undefined) {
      updates.support_widget_show_supporters = Boolean(support_widget_show_supporters);
    }

    // ── Custom Creator Theme (Session 60) ──
    // Accent color: 3, 4, 6, or 8-char hex (#RGB / #RGBA / #RRGGBB / #RRGGBBAA), null clears
    if (theme_accent_color !== undefined) {
      if (theme_accent_color === null || theme_accent_color === "") {
        updates.theme_accent_color = null;
      } else {
        const c = String(theme_accent_color).trim();
        if (!/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c)) {
          return errorResponseHelper(res, 400, "Invalid accent color (must be a hex like #CCFF00)");
        }
        updates.theme_accent_color = c.toUpperCase();
      }
    }
    // Cover style: allowlisted enum
    if (theme_cover_style !== undefined) {
      if (theme_cover_style === null || theme_cover_style === "") {
        updates.theme_cover_style = null;
      } else {
        const s = String(theme_cover_style).trim().toLowerCase();
        if (!["solid", "gradient", "image", "pattern"].includes(s)) {
          return errorResponseHelper(res, 400, "Invalid cover style. Choose solid, gradient, image, or pattern.");
        }
        updates.theme_cover_style = s;
      }
    }
    // Gradient: preset key OR custom "hex1,hex2" pair (max 60 chars)
    if (theme_cover_gradient !== undefined) {
      if (theme_cover_gradient === null || theme_cover_gradient === "") {
        updates.theme_cover_gradient = null;
      } else {
        const g = String(theme_cover_gradient).trim().toLowerCase();
        const PRESETS = ["sunset", "ocean", "forest", "twilight", "midnight", "candy"];
        const isPreset = PRESETS.includes(g);
        const isCustom = /^#[0-9a-f]{6},#[0-9a-f]{6}$/i.test(g);
        if (!isPreset && !isCustom) {
          return errorResponseHelper(res, 400, "Invalid gradient. Choose a preset or provide '#RRGGBB,#RRGGBB'.");
        }
        updates.theme_cover_gradient = g.slice(0, 60);
      }
    }

    // Can't enable the page without a handle
    if (updates.creator_page_enabled === true) {
      let curHandle: string | null = null;
      if (perCompany) {
        const c = await companyModel.findOne({ where: { company_id: activeCompanyId, user_id: userData.user_id }, attributes: ["handle"] });
        curHandle = (c?.dataValues as { handle?: string } | undefined)?.handle || null;
      } else {
        const cur = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["handle"] });
        curHandle = cur?.dataValues?.handle || null;
      }
      if (!updates.handle && !curHandle) {
        return errorResponseHelper(res, 400, "Choose a handle before publishing your page");
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponseHelper(res, 400, "Nothing to update");
    }

    if (perCompany) {
      // Companies have no `name` column — the creator display name maps to company_name.
      const companyUpdates: Record<string, unknown> = { ...updates };
      if ("name" in companyUpdates) {
        companyUpdates.company_name = companyUpdates.name;
        delete companyUpdates.name;
      }
      await companyModel.update(companyUpdates, { where: { company_id: activeCompanyId, user_id: userData.user_id } });
    } else {
      await userModel.update(updates, { where: { user_id: userData.user_id } });
    }
    await deleteRedisItem(`profile:${userData.user_id}`);
    // Handle successfully assigned → release its reservation lock (if any).
    if (reservedKeyToRelease) {
      await redis.del(reservedKeyToRelease).catch(() => {});
    }

    if (perCompany) {
      const c = await companyModel.findOne({
        where: { company_id: activeCompanyId, user_id: userData.user_id },
        attributes: [...STOREFRONT_COLUMNS, "company_name", "company_id"],
      });
      const d = (c?.dataValues || {}) as Record<string, unknown>;
      const u = await userModel.findByPk(userData.user_id, { attributes: ["name"] });
      return successResponseHelper(res, 200, "Creator page updated", {
        ...d,
        name: (d.company_name as string) || u?.dataValues?.name || null,
        company_id: activeCompanyId,
      });
    }

    const fresh = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: [
        "handle", "name", "bio", "creator_page_enabled", "cover_image", "social_links",
        "support_widget_enabled", "support_widget_style", "support_widget_label",
        "support_widget_preset_amounts", "support_widget_currency", "support_widget_min_amount",
        "support_widget_allow_message", "support_widget_thanks_message", "support_widget_show_supporters",
        "theme_accent_color", "theme_cover_style", "theme_cover_gradient",
        "public_analytics_enabled",
      ],
    });
    return successResponseHelper(res, 200, "Creator page updated", fresh?.dataValues || updates);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/creator/profile
 * Returns the ACTIVE-scope storefront settings so the /creator + /storefront
 * settings UI reads from the right place regardless of the flag:
 *   - Flag ON  → the selected company's storefront columns (name = company_name).
 *   - Flag OFF → tbl_user (legacy).
 */
export const getCreatorProfileSettings = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    if (STOREFRONT_PER_COMPANY) {
      const companyId = await resolveActiveCompanyId(req, userData.user_id);
      if (!companyId) {
        return successResponseHelper(res, 200, "Creator profile", { company_id: null });
      }
      const company = await companyModel.findOne({
        where: { company_id: companyId, user_id: userData.user_id },
        attributes: [...STOREFRONT_COLUMNS, "company_name", "company_id"],
      });
      if (!company) return errorResponseHelper(res, 403, "You don't have access to this company");
      const d = company.dataValues as Record<string, unknown>;
      const u = await userModel.findByPk(userData.user_id, { attributes: ["name"] });
      return successResponseHelper(res, 200, "Creator profile", {
        ...d,
        name: (d.company_name as string) || u?.dataValues?.name || null,
        company_id: companyId,
      });
    }
    // Legacy (flag OFF): only the PRIMARY company presents the shared account
    // storefront. Any other selected company gets an explicit "pending" shell so
    // a new company never shows the first company's URL/settings as its own.
    const holder = await resolveLegacyStorefrontHolder(req, userData.user_id);
    if (!holder.isPrimary) {
      const u = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["handle"] });
      const shell: Record<string, unknown> = {};
      for (const col of STOREFRONT_COLUMNS) shell[col] = null;
      shell.creator_page_enabled = false;
      return successResponseHelper(res, 200, "Creator profile", {
        ...shell,
        name: null,
        company_id: holder.activeCompanyId,
        storefront_pending: true,
        account_handle: u?.dataValues?.handle || null,
        primary_company_id: holder.primaryCompanyId,
      });
    }
    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: [...STOREFRONT_COLUMNS, "name"],
    });
    return successResponseHelper(res, 200, "Creator profile", { ...(user?.dataValues || {}), company_id: null });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** POST /api/user/creator/upload-cover — multipart/form-data with field "image" */
export const uploadCoverImage = async (req: express.Request, res: express.Response) => {
  try {
    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return errorResponseHelper(res, 400, "No image uploaded.");
    }
    const serverUrl = (process.env.SERVER_URL || "").trim().replace(/\/$/, "");
    const url = await finalizeUploadedImage(file, serverUrl);
    userLogger.info(`[uploadCoverImage] uploaded: ${file.filename} (${file.mimetype}, ${file.size}b)`);
    return successResponseHelper(res, 200, "Cover image uploaded", {
      url,
      name: file.originalname?.slice(0, 255) || file.filename,
      type: file.mimetype,
      size: file.size,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};
