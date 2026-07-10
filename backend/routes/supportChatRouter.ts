import express from "express";
import supportChatController from "../controller/supportChatController";
import { createRateLimiter } from "../middleware/rateLimitMiddleware";

/**
 * AI Support Chat routes (public, rate-limited per IP; POSTs are CSRF-exempt
 * like the other anonymous public endpoints — see csrfMiddleware EXEMPT_PATHS).
 */

const getIp = (req: express.Request): string =>
  req.ip || (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

// 20 chat messages / 5 minutes / IP (a human support conversation pace)
const supportChatRateLimiter = createRateLimiter(
  (req) => `support-chat:${getIp(req)}`,
  async () => ({ windowMs: 5 * 60 * 1000, maxRequests: 20 })
);

// 3 escalations / 15 minutes / IP (each one sends an email)
const supportEscalateRateLimiter = createRateLimiter(
  (req) => `support-escalate:${getIp(req)}`,
  async () => ({ windowMs: 15 * 60 * 1000, maxRequests: 3 })
);

const supportChatRouter = express.Router();

supportChatRouter.post("/chat", supportChatRateLimiter, supportChatController.chatWithSupport);
supportChatRouter.get("/chat/history/:session_id", supportChatController.getChatHistory);
supportChatRouter.post("/chat/escalate", supportEscalateRateLimiter, supportChatController.escalateChat);

export default supportChatRouter;
