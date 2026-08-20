import { normalizeHandle, validateHandle, isHandleOwnedByUser, handleReserveKey, HANDLE_RESERVE_TTL_SECONDS } from "./creatorHandle";
import { getCreatorAnalyticsData } from "../payment/paymentLinkController";
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
import sequelize from "../../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
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

    if (rawHandle !== undefined) {
      const handle = normalizeHandle(rawHandle);
      const err = validateHandle(handle);
      if (err) return errorResponseHelper(res, 400, err);
      if (await isHandleOwnedByUser(handle, userData.user_id)) {
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
      const cur = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["handle"] });
      if (!updates.handle && !cur?.dataValues?.handle) {
        return errorResponseHelper(res, 400, "Choose a handle before publishing your page");
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponseHelper(res, 400, "Nothing to update");
    }

    await userModel.update(updates, { where: { user_id: userData.user_id } });
    await deleteRedisItem(`profile:${userData.user_id}`);
    // Handle successfully assigned → release its reservation lock (if any).
    if (reservedKeyToRelease) {
      await redis.del(reservedKeyToRelease).catch(() => {});
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

/** GET /api/user/creator/stats — total + this-week visits, supporters count */
export const getCreatorStats = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ["handle"],
    });
    const handle = user?.dataValues?.handle ? String(user.dataValues.handle).toLowerCase() : null;

    if (!handle) {
      return successResponseHelper(res, 200, "Stats retrieved", {
        total_visits: 0,
        this_week_visits: 0,
        supporters_count: 0,
        top_referrers: [],
        daily_visits: [],
        has_handle: false,
      });
    }

    // Total visits (single counter key)
    let totalVisits = 0;
    try {
      const raw = await redis.get(`creator-visits:${handle}`);
      totalVisits = Number(raw || 0);
    } catch { /* redis best-effort */ }

    // This week: sum last 7 daily buckets
    let weekVisits = 0;
    // Daily visits for last 14 days (oldest first, for sparkline)
    const dailyVisits: Array<{ date: string; count: number }> = [];
    try {
      const now = Date.now();
      const daily7 = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now - i * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          return redis.get(`creator-visits:${handle}:day:${ymd}`);
        })
      );
      weekVisits = daily7.reduce((a: number, b) => a + Number(b || 0), 0);

      const daily14 = await Promise.all(
        Array.from({ length: 14 }, (_, i) => {
          // i=13 → 13 days ago, i=0 → today  (build oldest-first)
          const d = new Date(now - (13 - i) * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          return redis.get(`creator-visits:${handle}:day:${ymd}`).then((v) => ({ ymd, v }));
        })
      );
      daily14.forEach(({ ymd, v }) => dailyVisits.push({ date: ymd, count: Number(v || 0) }));
    } catch { /* best-effort */ }

    // Top referrers (Session 60) — Redis hash: field=domain, value=clicks
    const topReferrers: Array<{ domain: string; clicks: number }> = [];
    try {
      const refs = await redis.hGetAll(`creator-referrers:${handle}`);
      const entries = Object.entries(refs || {}).map(([domain, v]) => ({
        domain,
        clicks: Number(v || 0),
      }));
      entries.sort((a, b) => b.clicks - a.clicks);
      topReferrers.push(...entries.slice(0, 5));
    } catch { /* best-effort */ }

    // Supporters count: distinct customers on this user's completed donation contributions
    let supportersCount = 0;
    try {
      const rows = await sequelize.query(
        `SELECT COUNT(DISTINCT ut.customer_id) AS c
         FROM tbl_user_transaction ut
         JOIN tbl_payment_link pl ON pl.link_id = ut.link_id
         JOIN tbl_payment_link parent ON parent.link_id = pl.parent_link_id
         WHERE parent.user_id = :uid
           AND parent.link_type = 'donation'
           AND LOWER(ut.status) IN ('successful','completed','confirmed','processing','converted','payout_complete')`,
        { replacements: { uid: userData.user_id }, type: QueryTypes.SELECT }
      ) as Array<{ c: string | number }>;
      supportersCount = Number(rows?.[0]?.c || 0);
    } catch { /* best-effort */ }

    return successResponseHelper(res, 200, "Stats retrieved", {
      total_visits: totalVisits,
      this_week_visits: weekVisits,
      supporters_count: supportersCount,
      top_referrers: topReferrers,
      daily_visits: dailyVisits,
      has_handle: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/creator/analytics
 * Merchant's own view of Creator Page Analytics — 30-day tip chart, top 5
 * supporters, and LIFETIME totals for the settings page. Unlike the public
 * endpoint, this ignores `public_analytics_enabled` (the creator always sees
 * their own private analytics regardless of whether the public toggle is on).
 * Session 2026-08-05.
 */
export const getCreatorAnalytics = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ["handle", "support_widget_currency", "public_analytics_enabled"],
    });
    const handle = user?.dataValues?.handle || null;
    const currency = user?.dataValues?.support_widget_currency || "USD";
    const publicEnabled = user?.dataValues?.public_analytics_enabled !== false;

    if (!handle) {
      // No handle yet → nothing to analyze; return the empty shell so the
      // settings page can still render a "Reserve a handle first" empty state.
      return successResponseHelper(res, 200, "No handle yet", {
        enabled: false,
        public_analytics_enabled: publicEnabled,
        chart: [],
        top_supporters: [],
        totals: { amount_30d: 0, count_30d: 0, supporters_30d: 0, amount_lifetime: 0, supporters_lifetime: 0 },
        currency,
        window_days: 30,
        has_handle: false,
      });
    }

    const data = await getCreatorAnalyticsData(userData.user_id, currency, true);
    return successResponseHelper(res, 200, "Creator analytics retrieved", {
      enabled: true,
      public_analytics_enabled: publicEnabled,
      has_handle: true,
      ...data,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/display-currency (Doc-3 workstream E)
 * Returns the caller's RESOLVED display currency + supported picker options.
 * Resolution: tbl_user.display_currency → tbl_company.display_currency → USD.
 * `source` in the response tells the UI which layer won (`user`|`company`|`default`).
 */

