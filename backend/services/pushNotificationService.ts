/**
 * Push Notification Service
 *
 * Bridges the notification system with real-time delivery channels:
 * - SSE (Server-Sent Events) for connected clients
 * - In-app notifications (DB-persisted via notificationController)
 * - Webhook delivery for external integrations
 *
 * This service is the single entry point for pushing notifications
 * to users across all channels.
 */
import { emitNotification, emitPaymentUpdate, broadcast, sendToChannel, getSSEStats } from "./sseService";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { sendWebPush } from "./webPushService";
import { apiLogger } from "../utils/loggers";

interface PushPayload {
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  companyId?: number;
}

interface PaymentPushPayload {
  userId: number;
  transactionId: string;
  status: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
  companyId?: number;
}

interface BroadcastPayload {
  title: string;
  message: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Send a notification to a user via all channels:
 * 1. Persist to DB (in-app notification)
 * 2. Push via SSE (real-time)
 */
export const pushNotification = async (payload: PushPayload): Promise<{
  persisted: boolean;
  sse_delivered: boolean;
  web_push_sent: number;
  notification_id?: number;
}> => {
  let persisted = false;
  let notificationId: number | undefined;

  // 1. Persist to DB
  try {
    const notification = await createNotification(
      payload.userId,
      payload.type,
      payload.title,
      payload.message,
      payload.data,
      payload.companyId
    );
    if (notification) {
      persisted = true;
      notificationId = notification.notification_id;
    }
  } catch (err) {
    apiLogger.error(`[PushNotification] Failed to persist notification for user ${payload.userId}:`, (err as Error).message);
  }

  // 2. Push via SSE to connected clients
  let sseDelivered = false;
  try {
    emitNotification(payload.userId, {
      id: notificationId || 0,
      type: payload.type,
      title: payload.title,
      message: payload.message,
    });
    sseDelivered = true;
  } catch (err) {
    apiLogger.error(`[PushNotification] SSE delivery failed for user ${payload.userId}:`, (err as Error).message);
  }

  // 3. Send Web Push notification (works even when tab is closed/background)
  let webPushSent = 0;
  try {
    const result = await sendWebPush(payload.userId, {
      title: payload.title,
      body: payload.message,
      data: {
        ...payload.data,
        notification_id: notificationId,
        type: payload.type,
        url: "/notifications",
      },
      tag: `dynopay-${payload.type}-${notificationId || Date.now()}`,
    });
    webPushSent = result.sent;
  } catch (err) {
    apiLogger.error(`[PushNotification] Web Push failed for user ${payload.userId}:`, (err as Error).message);
  }

  return { persisted, sse_delivered: sseDelivered, web_push_sent: webPushSent, notification_id: notificationId };
};

/**
 * Push a payment status update to a user in real-time via SSE
 * Also creates an in-app notification for the payment event
 */
export const pushPaymentUpdate = async (payload: PaymentPushPayload): Promise<void> => {
  // 1. SSE real-time update
  emitPaymentUpdate(payload.userId, {
    transaction_id: payload.transactionId,
    status: payload.status,
    payment_status: payload.paymentStatus,
    amount: payload.amount,
    currency: payload.currency,
  });

  // 2. Map payment status to notification type
  const statusToType: Record<string, string> = {
    pending: NOTIFICATION_TYPES.PAYMENT_PENDING,
    confirming: NOTIFICATION_TYPES.PAYMENT_CONFIRMING,
    done: NOTIFICATION_TYPES.TRANSACTION_CONFIRMED,
    confirmed: NOTIFICATION_TYPES.TRANSACTION_CONFIRMED,
    partial: NOTIFICATION_TYPES.PAYMENT_PARTIAL,
  };

  const notifType = statusToType[payload.status] || NOTIFICATION_TYPES.PAYMENT_PENDING;
  const amountStr = payload.amount && payload.currency
    ? ` ${payload.amount} ${payload.currency}`
    : "";

  await pushNotification({
    userId: payload.userId,
    type: notifType,
    title: `Payment ${payload.status}`,
    message: `Payment${amountStr} is ${payload.status}`,
    data: {
      transaction_id: payload.transactionId,
      amount: payload.amount,
      currency: payload.currency,
    },
    companyId: payload.companyId,
  });
};

/**
 * Broadcast a system-wide announcement to all connected SSE clients
 */
export const broadcastAnnouncement = (payload: BroadcastPayload): number => {
  return broadcast("announcement", {
    type: payload.type || "system",
    title: payload.title,
    message: payload.message,
    data: payload.data,
    timestamp: Date.now(),
  });
};

/**
 * Send a price update to all clients on the 'prices' channel
 */
export const pushPriceUpdate = (prices: Record<string, number>): number => {
  return sendToChannel("prices", "price_update", {
    prices,
    timestamp: Date.now(),
  });
};

/**
 * Send admin monitoring event to clients on the 'admin' channel
 */
export const pushAdminEvent = (event: string, data: unknown): number => {
  return sendToChannel("admin", event, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Get push notification service stats
 */
export const getPushStats = (): {
  sse: ReturnType<typeof getSSEStats>;
  channels_available: string[];
} => ({
  sse: getSSEStats(),
  channels_available: ["payments", "prices", "notifications", "admin", "dashboard"],
});

export default {
  pushNotification,
  pushPaymentUpdate,
  broadcastAnnouncement,
  pushPriceUpdate,
  pushAdminEvent,
  getPushStats,
};
