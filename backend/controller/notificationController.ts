import express from "express";
import { apiLogger } from "../utils/loggers";
import { handleControllerError, handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import jwt from "jsonwebtoken";
// Op import removed - not used
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { IUserType } from "../utils/types";
import { notificationModel, notificationPreferencesModel, companyModel } from "../models";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
// sequelize import removed - not used
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";

// Cache TTL for notifications (15 seconds - shorter because notifications change often)
// NOTIFICATION_CACHE_TTL removed - not used

// Notification types
export const NOTIFICATION_TYPES = {
  TRANSACTION_CONFIRMED: "transaction_confirmed",
  PAYMENT_RECEIVED: "payment_received",
  PAYMENT_PENDING: "payment_pending",           // Unconfirmed payment detected
  PAYMENT_CONFIRMING: "payment_confirming",     // Payment confirmation in progress
  PAYMENT_PARTIAL: "payment_partial",           // Partial payment received
  PAYMENT_PARTIAL_EXPIRED: "payment_partial_expired", // Partial payment expired
  PAYMENT_OVERPAID: "payment_overpaid",         // Customer paid more than due (excess credited to the merchant)
  WEEKLY_SUMMARY: "weekly_summary",
  SECURITY_ALERT: "security_alert",
  KYC_REQUIRED: "kyc_required",
  KYC_APPROVED: "kyc_approved",
  KYC_REJECTED: "kyc_rejected",
  WALLET_VERIFIED: "wallet_verified",
  WALLET_ADDED: "wallet_added",
  API_KEY_CREATED: "api_key_created",
  COMPANY_CREATED: "company_created",
  TEAM_MEMBER_JOINED: "team_member_joined",
  CONVERSION_FAILED: "conversion_failed",     // Auto-conversion gave up — funds held in the exchange deposit wallet (E2)
};

/**
 * Get user's notification preferences
 * GET /api/notifications/preferences
 */
const getPreferences = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    let companyData: Record<string, unknown> | null = null;
    if (company_id) {
      companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    // Company-scoped routing extras (0018): the address + prefs that govern
    // COMPANY emails (payments/orders/payouts/config/digests). Only meaningful
    // when a company is in scope. account-scoped prefs stay in the per-user row.
    const companyExtras = companyData
      ? {
          company_notification_email: (companyData.notification_email as string | null) ?? null,
          company_notification_prefs: (companyData.notification_prefs as Record<string, unknown>) ?? {},
        }
      : {};

    // Find existing preferences or return defaults
    let preferences = await notificationPreferencesModel.findOne({
      where: {
        user_id: userId,
        ...(company_id && { company_id }),
      },
    });

    if (!preferences) {
      // Return default preferences (not saved yet)
      return successResponseHelper(res, 200, "Default notification preferences", {
        user_id: userId,
        company_id: company_id || null,
        transaction_updates: true,
        payment_received: true,
        payment_pending: true,
        weekly_summary: true,
        payout_digest_weekly: false,
        security_alerts: false,
        email_notifications: true,
        sms_notifications: false,
        browser_notifications: false,
        ...companyExtras,
        is_default: true,
      });
    }

    return successResponseHelper(res, 200, "Notification preferences retrieved", {
      ...preferences.dataValues,
      ...companyExtras,
      is_default: false,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Update user's notification preferences
 * PUT /api/notifications/preferences
 */
const updatePreferences = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const userId = userData.user_id;
    const {
      company_id,
      transaction_updates,
      payment_received,
      weekly_summary,
      payout_digest_weekly,
      security_alerts,
      email_notifications,
      sms_notifications,
      browser_notifications,
      company_notification_email,
      company_notification_prefs,
    } = req.body;

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id, userId);
      if (!companyData) return;
    }

    // Find or create preferences
    let preferences = await notificationPreferencesModel.findOne({
      where: {
        user_id: userId,
        ...(company_id && { company_id }),
      },
    });

    const updateData = {
      ...(transaction_updates !== undefined && { transaction_updates }),
      ...(payment_received !== undefined && { payment_received }),
      ...(weekly_summary !== undefined && { weekly_summary }),
      ...(payout_digest_weekly !== undefined && { payout_digest_weekly }),
      ...(security_alerts !== undefined && { security_alerts }),
      ...(email_notifications !== undefined && { email_notifications }),
      ...(sms_notifications !== undefined && { sms_notifications }),
      ...(browser_notifications !== undefined && { browser_notifications }),
    };

    if (preferences) {
      // Update existing preferences
      await notificationPreferencesModel.update(updateData, {
        where: {
          preference_id: preferences.dataValues.preference_id,
        },
      });

      // Fetch updated record
      preferences = await notificationPreferencesModel.findOne({
        where: { preference_id: preferences.dataValues.preference_id },
      });
    } else {
      // Create new preferences
      preferences = await notificationPreferencesModel.create({
        user_id: userId,
        company_id: company_id || null,
        transaction_updates: transaction_updates ?? true,
        payment_received: payment_received ?? false,
        weekly_summary: weekly_summary ?? true,
        payout_digest_weekly: payout_digest_weekly ?? false,
        security_alerts: security_alerts ?? false,
        email_notifications: email_notifications ?? true,
        sms_notifications: sms_notifications ?? false,
        browser_notifications: browser_notifications ?? false,
      });
    }

    // Company-scoped routing settings (0018): the notification recipient address
    // + routing prefs live on tbl_company (NOT the per-user prefs row). Owner-
    // gated via the validateCompanyOwnership check above. Additive + sanitized.
    if (company_id && (company_notification_email !== undefined || company_notification_prefs !== undefined)) {
      const companyUpdate: Record<string, unknown> = {};
      if (company_notification_email !== undefined) {
        const val = (company_notification_email === null || company_notification_email === "")
          ? null : String(company_notification_email).trim();
        if (val !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          return errorResponseHelper(res, 400, "Invalid company notification email");
        }
        companyUpdate.notification_email = val;
      }
      if (company_notification_prefs && typeof company_notification_prefs === "object") {
        const raw = company_notification_prefs as Record<string, unknown>;
        const clean: Record<string, unknown> = {};
        if (typeof raw.team_fanout === "boolean") clean.team_fanout = raw.team_fanout;
        if (raw.categories && typeof raw.categories === "object") {
          const cats: Record<string, boolean> = {};
          for (const k of ["payments", "payouts", "orders", "config", "digests"]) {
            const v = (raw.categories as Record<string, unknown>)[k];
            if (typeof v === "boolean") cats[k] = v;
          }
          clean.categories = cats;
        }
        companyUpdate.notification_prefs = clean;
      }
      if (Object.keys(companyUpdate).length > 0) {
        await companyModel.update(companyUpdate, { where: { company_id } });
      }
    }

    return successResponseHelper(res, 200, "Notification preferences updated", preferences?.dataValues);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get list of notifications
 * GET /api/notifications
 */
const getNotifications = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { company_id, type, is_read, page = 1, limit = 20 } = req.query;
    const userId = userData.user_id;
    const offset = (Number(page) - 1) * Number(limit);

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    // Build where clause
    const where: Record<string, unknown> = { user_id: userId };
    if (company_id) where.company_id = company_id;
    if (type) where.type = type;
    if (is_read !== undefined) where.is_read = is_read === 'true';

    // Get notifications with pagination
    const { count, rows: notifications } = await notificationModel.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return successResponseHelper(res, 200, "Notifications retrieved", {
      notifications: notifications.map(n => n.dataValues),
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(count / Number(limit)),
      },
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get unread notifications count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    const where: Record<string, unknown> = { user_id: userId, is_read: false };
    if (company_id) where.company_id = company_id;

    const count = await notificationModel.count({ where });

    return successResponseHelper(res, 200, "Unread count retrieved", {
      unread_count: count,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Mark a single notification as read
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { id } = req.params;
    const userId = userData.user_id;

    const [updatedCount] = await notificationModel.update(
      { is_read: true },
      {
        where: {
          notification_id: id,
          user_id: userId,
        },
      }
    );

    if (updatedCount === 0) {
      return errorResponseHelper(res, 404, "Notification not found");
    }

    return successResponseHelper(res, 200, "Notification marked as read", {
      notification_id: id,
      is_read: true,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { company_id } = req.body;
    const userId = userData.user_id;

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id, userId);
      if (!companyData) return;
    }

    const where: Record<string, unknown> = { user_id: userId, is_read: false };
    if (company_id) where.company_id = company_id;

    const [updatedCount] = await notificationModel.update(
      { is_read: true },
      { where }
    );

    return successResponseHelper(res, 200, "All notifications marked as read", {
      updated_count: updatedCount,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { id } = req.params;
    const userId = userData.user_id;

    const deletedCount = await notificationModel.destroy({
      where: {
        notification_id: id,
        user_id: userId,
      },
    });

    if (deletedCount === 0) {
      return errorResponseHelper(res, 404, "Notification not found");
    }

    return successResponseHelper(res, 200, "Notification deleted", {
      notification_id: id,
      deleted: true,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Helper function to create a notification
 * Used internally by other controllers
 */
export const createNotification = async (
  userId: number,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  companyId?: number
) => {
  try {
    // Check user preferences before creating notification
    const preferences = await notificationPreferencesModel.findOne({
      where: {
        user_id: userId,
        ...(companyId && { company_id: companyId }),
      },
    });

    // Check if user wants this type of notification
    if (preferences) {
      const prefs = preferences.dataValues;
      
      // Map notification types to preference fields
      const typeToPreference: Record<string, string> = {
        [NOTIFICATION_TYPES.TRANSACTION_CONFIRMED]: 'transaction_updates',
        [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: 'payment_received',
        [NOTIFICATION_TYPES.WEEKLY_SUMMARY]: 'weekly_summary',
        [NOTIFICATION_TYPES.SECURITY_ALERT]: 'security_alerts',
      };

      const preferenceField = typeToPreference[type];
      if (preferenceField && prefs[preferenceField] === false) {
        // User has disabled this type of notification
        return null;
      }
    }

    const notification = await notificationModel.create({
      user_id: userId,
      company_id: companyId || null,
      type,
      title,
      message,
      data: data || null,
      is_read: false,
    });

    return notification.dataValues;
  } catch (e) {
    apiLogger.error("Create notification error:", e);
    return null;
  }
};

/**
 * Get notification types
 * GET /api/notifications/types
 */
const getNotificationTypes = async (req: express.Request, res: express.Response) => {
  try {
    return successResponseHelper(res, 200, "Notification types retrieved", {
      types: Object.entries(NOTIFICATION_TYPES).map(([key, value]) => ({
        key,
        value,
      })),
    });
  } catch (e) {
    const message = getErrorMessage(e);
    return errorResponseHelper(res, 500, message);
  }
};

export default {
  getPreferences,
  updatePreferences,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationTypes,
  createNotification,
  NOTIFICATION_TYPES,
};
