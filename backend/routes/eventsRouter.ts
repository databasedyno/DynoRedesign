/**
 * SSE Events Router
 * 
 * Provides Server-Sent Events endpoint for real-time updates.
 * GET /api/events/stream?channels=payments,prices,notifications
 * GET /api/events/stats
 * POST /api/events/broadcast (admin)
 * POST /api/events/push (admin — push notification to specific user)
 * GET /api/events/push-stats
 */
import express from "express";
import crypto from "crypto";
import authMiddleware from "../middleware/authMiddleware";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware";
import { registerClient, getSSEStats } from "../services/sseService";
import { broadcastAnnouncement, pushNotification, pushAdminEvent, getPushStats } from "../services/pushNotificationService";
import { IUserType } from "../utils/types";
import { successResponseHelper, errorResponseHelper } from "../helper";

const eventsRouter = express.Router();

/**
 * GET /api/events/stream
 * SSE endpoint — requires authentication
 * Query params: channels (comma-separated)
 */
eventsRouter.get("/stream", authMiddleware, (req: express.Request, res: express.Response) => {
  const userData = res.locals.user as IUserType;
  const channelsParam = (req.query.channels as string) || "payments,notifications";
  const channels = channelsParam.split(",").map((c) => c.trim()).filter(Boolean);
  const clientId = crypto.randomUUID();

  registerClient(clientId, userData.user_id, res, channels);

  // Keep connection open — response will be closed by SSE service on disconnect
  req.on("close", () => {
    // Client disconnected — handled by SSE service
  });
});

/**
 * GET /api/events/stats
 * Get SSE connection stats (public)
 */
eventsRouter.get("/stats", (_req: express.Request, res: express.Response) => {
  const stats = getSSEStats();
  successResponseHelper(res, 200, "SSE stats", stats);
});

/**
 * GET /api/events/push-stats
 * Get push notification service stats (public)
 */
eventsRouter.get("/push-stats", (_req: express.Request, res: express.Response) => {
  const stats = getPushStats();
  successResponseHelper(res, 200, "Push notification stats", stats);
});

/**
 * POST /api/events/broadcast
 * Broadcast a system-wide announcement to all connected SSE clients (admin only)
 */
eventsRouter.post("/broadcast", adminAuthMiddleware, (req: express.Request, res: express.Response) => {
  const { title, message, type, data } = req.body;

  if (!title || !message) {
    return errorResponseHelper(res, 400, "title and message are required");
  }

  const sent = broadcastAnnouncement({ title, message, type, data });

  successResponseHelper(res, 200, "Broadcast sent", {
    clients_reached: sent,
    announcement: { title, message, type: type || "system" },
  });
});

/**
 * POST /api/events/push
 * Push a notification to a specific user (admin only)
 */
eventsRouter.post("/push", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const { user_id, type, title, message, data, company_id } = req.body;

  if (!user_id || !title || !message) {
    return errorResponseHelper(res, 400, "user_id, title, and message are required");
  }

  try {
    const result = await pushNotification({
      userId: user_id,
      type: type || "system",
      title,
      message,
      data,
      companyId: company_id,
    });

    successResponseHelper(res, 200, "Notification pushed", result);
  } catch (err) {
    errorResponseHelper(res, 500, `Push failed: ${(err as Error).message}`);
  }
});

/**
 * POST /api/events/admin-event
 * Send an event to admin monitoring channel (admin only)
 */
eventsRouter.post("/admin-event", adminAuthMiddleware, (req: express.Request, res: express.Response) => {
  const { event, data } = req.body;

  if (!event) {
    return errorResponseHelper(res, 400, "event name is required");
  }

  const sent = pushAdminEvent(event, data || {});

  successResponseHelper(res, 200, "Admin event sent", {
    event,
    clients_reached: sent,
  });
});

export default eventsRouter;
