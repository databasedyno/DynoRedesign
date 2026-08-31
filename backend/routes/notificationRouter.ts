import express from "express";
import notificationController from "../controller/notificationController";
import { authMiddleware } from "../middleware";
import { triggerWeeklySummary, triggerWalletReminder } from "../utils/cronJobs";
import { successResponseHelper, errorResponseHelper, getErrorMessage } from "../helper";
import { saveSubscription, removeSubscription, getVapidPublicKey } from "../services/webPushService";
import jwt from "jsonwebtoken";

const notificationRouter = express.Router();

// Public endpoint - no auth needed for VAPID public key
notificationRouter.get("/push/vapid-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return errorResponseHelper(res, 503, "Web Push not configured");
  }
  return successResponseHelper(res, 200, "VAPID public key", { vapid_public_key: key });
});

// All other notification routes require authentication
notificationRouter.use(authMiddleware);

// Push subscription endpoints
notificationRouter.post("/push/subscribe", async (req, res) => {
  try {
    const userData = jwt.decode(res.locals.token) as any;
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return errorResponseHelper(res, 400, "Invalid push subscription data");
    }

    const saved = await saveSubscription(
      userData.user_id,
      subscription,
      req.headers["user-agent"]
    );

    if (saved) {
      return successResponseHelper(res, 200, "Push subscription saved", { subscribed: true });
    } else {
      return errorResponseHelper(res, 500, "Failed to save push subscription");
    }
  } catch (e) {
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

notificationRouter.post("/push/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return errorResponseHelper(res, 400, "Endpoint is required");
    }

    const removed = await removeSubscription(endpoint);
    return successResponseHelper(res, 200, "Push subscription removed", { removed });
  } catch (e) {
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

// Preferences endpoints
// GET /api/notifications/preferences - Get user's notification settings
notificationRouter.get("/preferences", notificationController.getPreferences);

// PUT /api/notifications/preferences - Update notification settings
notificationRouter.put("/preferences", notificationController.updatePreferences);

// Notification list endpoints
// GET /api/notifications - List all notifications (with pagination)
// Query params: company_id, type, is_read, page, limit
notificationRouter.get("/", notificationController.getNotifications);

// GET /api/notifications/unread-count - Get unread badge count
notificationRouter.get("/unread-count", notificationController.getUnreadCount);

// GET /api/notifications/types - Get all notification types
notificationRouter.get("/types", notificationController.getNotificationTypes);

// POST /api/notifications/trigger-weekly-summary - Manually trigger weekly summary (for testing)
notificationRouter.post("/trigger-weekly-summary", async (req, res) => {
  try {
    const results = await triggerWeeklySummary(req.body.user_id, { dryRun: req.body.dry_run === true || req.body.dryRun === true });
    return successResponseHelper(res, 200, "Weekly summary triggered", { results });
  } catch (e) {
    const message = getErrorMessage(e);
    return errorResponseHelper(res, 500, message);
  }
});

// POST /api/notifications/trigger-wallet-reminder - Manually trigger wallet reminder (for testing)
notificationRouter.post("/trigger-wallet-reminder", async (req, res) => {
  try {
    const results = await triggerWalletReminder(req.body.user_id);
    return successResponseHelper(res, 200, "Wallet reminder triggered", { results });
  } catch (e) {
    const message = getErrorMessage(e);
    return errorResponseHelper(res, 500, message);
  }
});

// POST /api/notifications/payout-digest/preview
// Sends the weekly payout digest email to the currently-logged-in user's email.
// Safe manual QA trigger — no cron required, no admin role needed.
notificationRouter.post("/payout-digest/preview", async (_req, res) => {
  try {
    const userData = jwt.decode(res.locals.token) as any;
    if (!userData?.user_id) {
      return errorResponseHelper(res, 401, "Invalid session");
    }
    const { sendPayoutDigestForUser } = await import(
      "../services/payoutDigestService"
    );
    const result = await sendPayoutDigestForUser(Number(userData.user_id));
    if (!result.sent) {
      return errorResponseHelper(
        res,
        500,
        result.skipped === "user-not-found"
          ? "User not found"
          : "Failed to send payout digest",
      );
    }
    return successResponseHelper(res, 200, "Payout digest sent", {
      sent: true,
      digest: result.digest,
    });
  } catch (e) {
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
notificationRouter.put("/read-all", notificationController.markAllAsRead);

// PUT /api/notifications/:id/read - Mark single notification as read
notificationRouter.put("/:id/read", notificationController.markAsRead);

// DELETE /api/notifications/:id - Delete a notification
notificationRouter.delete("/:id", notificationController.deleteNotification);

export default notificationRouter;
