import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import supportChatController, { SUPPORT_UPLOAD_DIR } from "../controller/supportChatController";
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

// 10 attachment uploads / 5 minutes / IP
const supportUploadRateLimiter = createRateLimiter(
  (req) => `support-upload:${getIp(req)}`,
  async () => ({ windowMs: 5 * 60 * 1000, maxRequests: 10 })
);

// ---- attachment upload (images + PDF, max 5MB) ----------------------------
const ALLOWED_UPLOAD_MIMES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

try {
  fs.mkdirSync(SUPPORT_UPLOAD_DIR, { recursive: true });
} catch (_e) {
  // best-effort; multer will surface a clear error if the dir is unusable
}

const supportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, SUPPORT_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_UPLOAD_MIMES[file.mimetype] || ".bin";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES[file.mimetype]) return cb(null, true);
    cb(new Error("Only PNG, JPG, WEBP, GIF images or PDF files are allowed."));
  },
});

/** Wrap multer so its errors become clean 400 JSON instead of a 500 stack. */
const uploadSingle = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Cast needed: @types/multer bundles its own @types/express-serve-static-core
  // version which is structurally incompatible with the app's @types/express.
  const handler = supportUpload.single("file") as unknown as (
    rq: express.Request,
    rs: express.Response,
    cb: (err?: unknown) => void
  ) => void;
  handler(req, res, (err?: unknown) => {
    if (err) {
      const msg =
        (err as { code?: string }).code === "LIMIT_FILE_SIZE"
          ? "File too large (max 5MB)."
          : (err as Error).message || "Upload failed.";
      return res.status(400).json({ status: 400, message: msg });
    }
    next();
  });
};

const supportChatRouter = express.Router();

supportChatRouter.post("/chat", supportChatRateLimiter, supportChatController.chatWithSupport);
supportChatRouter.get("/chat/history/:session_id", supportChatController.getChatHistory);
supportChatRouter.post("/chat/escalate", supportEscalateRateLimiter, supportChatController.escalateChat);
supportChatRouter.post("/chat/upload", supportUploadRateLimiter, uploadSingle, supportChatController.uploadAttachment);

export default supportChatRouter;
