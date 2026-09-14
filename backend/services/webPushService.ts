/**
 * Web Push Service
 *
 * Handles browser push notification delivery via the Web Push API.
 * Manages VAPID keys and push subscription lifecycle.
 */
import { raw as envRaw } from "../utils/config";
import webpush from "web-push";
import pushSubscriptionModel from "../models/pushSubscriptionModel";
import { apiLogger } from "../utils/loggers";

// Configure VAPID
const VAPID_PUBLIC_KEY = envRaw("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = envRaw("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = envRaw("VAPID_SUBJECT") || "mailto:support@dynopay.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  apiLogger.info("[WebPush] VAPID configured successfully");
} else {
  apiLogger.warn("[WebPush] VAPID keys not configured — web push disabled");
}

/**
 * Save or update a push subscription for a user
 */
export const saveSubscription = async (
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<boolean> => {
  try {
    const existing = await pushSubscriptionModel.findOne({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      // Update existing subscription (might be a different user or re-subscribe)
      await pushSubscriptionModel.update(
        {
          user_id: userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          is_active: true,
        },
        { where: { endpoint: subscription.endpoint } }
      );
    } else {
      await pushSubscriptionModel.create({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
        is_active: true,
      });
    }

    apiLogger.info(`[WebPush] Subscription saved for user ${userId}`);
    return true;
  } catch (err) {
    apiLogger.error(`[WebPush] Failed to save subscription for user ${userId}:`, (err as Error).message);
    return false;
  }
};

/**
 * Remove a push subscription
 */
export const removeSubscription = async (endpoint: string): Promise<boolean> => {
  try {
    const deleted = await pushSubscriptionModel.destroy({
      where: { endpoint },
    });
    return deleted > 0;
  } catch (err) {
    apiLogger.error(`[WebPush] Failed to remove subscription:`, (err as Error).message);
    return false;
  }
};

/**
 * Send a web push notification to all subscriptions for a user
 */
export const sendWebPush = async (
  userId: number,
  payload: { title: string; body: string; icon?: string; badge?: string; data?: Record<string, unknown>; tag?: string }
): Promise<{ sent: number; failed: number }> => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  try {
    const subscriptions = await pushSubscriptionModel.findAll({
      where: { user_id: userId, is_active: true },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/dynopay-icon-192.png",
      badge: payload.badge || "/dynopay-badge-72.png",
      data: payload.data || {},
      tag: payload.tag || "dynopay-notification",
    });

    const pushPromises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.dataValues.endpoint,
        keys: {
          p256dh: sub.dataValues.p256dh,
          auth: sub.dataValues.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        sent++;
      } catch (err: any) {
        // 410 Gone or 404 means subscription is no longer valid
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pushSubscriptionModel.update(
            { is_active: false },
            { where: { id: sub.dataValues.id } }
          );
          apiLogger.info(`[WebPush] Subscription ${sub.dataValues.id} expired, marked inactive`);
        } else {
          apiLogger.error(`[WebPush] Failed to send to subscription ${sub.dataValues.id}:`, err.message);
        }
        failed++;
      }
    });

    await Promise.allSettled(pushPromises);
  } catch (err) {
    apiLogger.error(`[WebPush] Error sending push to user ${userId}:`, (err as Error).message);
  }

  return { sent, failed };
};

/**
 * Get VAPID public key (for frontend subscription)
 */
export const getVapidPublicKey = (): string => {
  return VAPID_PUBLIC_KEY;
};

export default {
  saveSubscription,
  removeSubscription,
  sendWebPush,
  getVapidPublicKey,
};
