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
import { STOREFRONT_PER_COMPANY, isHandleTaken, resolveActiveCompanyId } from "../storefrontScope";

export const RESERVED_HANDLES = new Set([
  "auth", "admin", "dashboard", "pay", "payment", "payments", "fees", "blog", "docs",
  "documentation", "help-support", "help", "support", "system-status", "status",
  "privacy-policy", "privacy", "terms-conditions", "terms", "aml-policy", "legal",
  "settings", "profile", "reset-password", "api", "public", "static", "assets",
  "accept-crypto-payments-in", "for", "create-pay-link", "about", "contact", "login",
  "register", "signup", "signin", "logout", "home", "index", "app", "www", "pricing",
  "qa", "sitemap", "robots", "favicon", "og", "images", "checkout", "invoice", "invoices",
  "wallet", "wallets", "company", "companies", "user", "users", "me", "new", "edit",
  "creator", "creators", "explore", "discover",
]);
export const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export const normalizeHandle = (h: string) => String(h || "").trim().toLowerCase();

export const validateHandle = (h: string): string | null => {
  if (!h) return "Handle is required";
  if (h.length < 3 || h.length > 30) return "Handle must be 3–30 characters";
  if (!HANDLE_RE.test(h)) return "Use lowercase letters, numbers, hyphens or underscores (must start with a letter or number)";
  if (RESERVED_HANDLES.has(h)) return "This handle is reserved";
  return null;
};

/** GET /api/user/creator/check-handle?handle=xxx */
// ─── Handle reservation (Redis-backed, TTL auto-expiry) ───────────────────────
// A visitor can reserve a creator handle from the landing page BEFORE signing up.
// We store an atomic Redis lock `reserve:handle:<handle>` -> <token> with a TTL,
// so the name is hard-held while they finish onboarding (closes the race where
// someone else could grab it mid-signup). The reservation is consumed & released
// when the handle is finalised in updateCreatorProfile. TTL auto-expiry means an
// abandoned signup frees the handle automatically — no cleanup job needed.
export const HANDLE_RESERVE_TTL_SECONDS = 2 * 60 * 60; // 2 hours (renewed on register + /creator) — wider window shrinks the abandon-signup race
export const handleReserveKey = (h: string) => `reserve:handle:${h}`;

/** Is this handle already owned by a user other than `excludeUserId`? */
export const isHandleOwnedByUser = async (handle: string, excludeUserId?: number) => {
  const existing = await userModel.findOne({
    where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), handle),
    attributes: ["user_id"],
  });
  return Boolean(existing && existing.dataValues.user_id !== excludeUserId);
};

export const checkHandle = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const handle = normalizeHandle(req.query.handle as string);
    const err = validateHandle(handle);
    if (err) return successResponseHelper(res, 200, "checked", { available: false, reason: err });

    if (await isHandleOwnedByUser(handle, userData.user_id)) {
      return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is already taken" });
    }

    // Storefront-per-company: uniqueness is across companies; exclude the
    // caller's ACTIVE company so re-checking their own handle stays "available".
    if (STOREFRONT_PER_COMPANY) {
      const activeCompanyId = (await resolveActiveCompanyId(req, userData.user_id)) ?? undefined;
      if (await isHandleTaken(handle, { companyId: activeCompanyId })) {
        return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is already taken" });
      }
    }

    // Respect an active reservation unless it is held by this client's own token
    // (passed as ?token=, e.g. a handle they reserved from the landing page).
    const token = typeof req.query.token === "string" ? req.query.token : "";
    let reserved = false;
    try {
      const holder = await redis.get(handleReserveKey(handle));
      reserved = Boolean(holder && holder !== token);
    } catch { /* Redis down → don't block availability */ }
    if (reserved) {
      return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is currently reserved" });
    }
    return successResponseHelper(res, 200, "checked", { available: true, reason: null });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/creator/check-handle-public?handle=xxx&token=yyy   (PUBLIC, rate-limited)
 * Read-only availability check for the landing-page hero (visitor is not
 * logged in). Mirrors `checkHandle` but without the authenticated-user
 * exclusion. Never writes — safe on the live DB. An optional `token` lets a
 * visitor who already reserved this handle (from a prior hero interaction)
 * still see it as available.
 */
export const checkHandlePublic = async (req: express.Request, res: express.Response) => {
  try {
    const handle = normalizeHandle(req.query.handle as string);
    const err = validateHandle(handle);
    if (err) return successResponseHelper(res, 200, "checked", { available: false, reason: err });

    if (await isHandleOwnedByUser(handle)) {
      return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is already taken" });
    }
    if (STOREFRONT_PER_COMPANY && (await isHandleTaken(handle))) {
      return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is already taken" });
    }

    const token = typeof req.query.token === "string" ? req.query.token : "";
    let reserved = false;
    try {
      const holder = await redis.get(handleReserveKey(handle));
      reserved = Boolean(holder && holder !== token);
    } catch { /* Redis down → don't block availability */ }
    if (reserved) {
      return successResponseHelper(res, 200, "checked", { available: false, reason: "This handle is currently reserved" });
    }
    return successResponseHelper(res, 200, "checked", { available: true, reason: null });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/creator/reserve-handle   { handle, token? }   (PUBLIC, rate-limited)
 * Atomically reserves a handle for a short window and returns a reservation
 * token the client keeps (localStorage) and later presents when finalising the
 * claim. Re-posting with the same token renews the TTL.
 */
export const reserveHandle = async (req: express.Request, res: express.Response) => {
  try {
    const handle = normalizeHandle(req.body?.handle as string);
    const err = validateHandle(handle);
    if (err) return successResponseHelper(res, 200, "checked", { reserved: false, available: false, reason: err });

    if (await isHandleOwnedByUser(handle)) {
      return successResponseHelper(res, 200, "checked", { reserved: false, available: false, reason: "This handle is already taken" });
    }
    if (STOREFRONT_PER_COMPANY && (await isHandleTaken(handle))) {
      return successResponseHelper(res, 200, "checked", { reserved: false, available: false, reason: "This handle is already taken" });
    }

    const key = handleReserveKey(handle);
    const providedToken = typeof req.body?.token === "string" && req.body.token ? String(req.body.token) : "";

    let holder: string | null = null;
    try {
      holder = await redis.get(key);
    } catch {
      // Redis unavailable — degrade gracefully to a soft (un-reserved) response
      // so the signup journey is never blocked by a cache outage.
      return successResponseHelper(res, 200, "reserved", { reserved: false, available: true, token: providedToken || crypto.randomUUID(), handle, expiresIn: 0 });
    }

    // Renew our own reservation.
    if (holder && providedToken && holder === providedToken) {
      await redis.expire(key, HANDLE_RESERVE_TTL_SECONDS);
      return successResponseHelper(res, 200, "reserved", { reserved: true, available: true, token: providedToken, handle, expiresIn: HANDLE_RESERVE_TTL_SECONDS });
    }
    // Held by someone else.
    if (holder && holder !== providedToken) {
      return successResponseHelper(res, 200, "checked", { reserved: false, available: false, reason: "This handle is currently reserved by someone else" });
    }

    // Free → acquire atomically (NX = only if absent).
    const token = providedToken || crypto.randomUUID();
    const result = await redis.set(key, token, { NX: true, EX: HANDLE_RESERVE_TTL_SECONDS });
    if (result === "OK") {
      return successResponseHelper(res, 200, "reserved", { reserved: true, available: true, token, handle, expiresIn: HANDLE_RESERVE_TTL_SECONDS });
    }
    // Lost the race between GET and SET NX — re-read the holder.
    const finalHolder = await redis.get(key);
    if (finalHolder && finalHolder === token) {
      await redis.expire(key, HANDLE_RESERVE_TTL_SECONDS);
      return successResponseHelper(res, 200, "reserved", { reserved: true, available: true, token, handle, expiresIn: HANDLE_RESERVE_TTL_SECONDS });
    }
    return successResponseHelper(res, 200, "checked", { reserved: false, available: false, reason: "This handle was just reserved by someone else" });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** PUT /api/user/creator/profile  { handle, bio, creator_page_enabled, cover_image, social_links, support_widget_* } */

