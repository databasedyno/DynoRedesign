import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import supportChatMessageModel from "../models/supportChatModel";
import supportSessionModel from "../models/supportSessionModel";
import { sendEmail } from "../services/emailService";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";

/**
 * Admin Support Inbox (2026-09-08).
 *
 * Backs the admin live-chat console: list support conversations, open a
 * transcript, reply as a human agent, take a session over from the AI
 * ("Emily") and hand it back, and send an outbound email reply to the visitor.
 * All routes are mounted under /api/admin/support and protected by
 * adminAuthMiddleware.
 */

const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_AGENT_MSG = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SessionRow = {
  mode: string;
  status: string;
  contact_email: string | null;
  admin_unread: number;
  escalated: boolean;
  update: (v: Record<string, unknown>) => Promise<unknown>;
};

/** Get the session row, creating a default (ai/open) one if it doesn't exist. */
const ensureSession = async (sessionId: string): Promise<SessionRow> => {
  const [row] = await supportSessionModel.findOrCreate({
    where: { session_id: sessionId },
    defaults: { session_id: sessionId, mode: "ai", status: "open" } as never,
  });
  return row as unknown as SessionRow;
};

const esc = (s: string) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** GET /api/admin/support/sessions?status=&q=&limit=&offset= */
const listSessions = async (req: express.Request, res: express.Response) => {
  try {
    const status = String(req.query.status || "all").toLowerCase();
    const qTerm = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);

    const repl: Record<string, unknown> = { limit, offset };
    let whereSql = "";
    if (qTerm) {
      repl.q = `%${qTerm}%`;
      whereSql = `WHERE (m.session_id ILIKE :q OR s.contact_email ILIKE :q
        OR EXISTS (SELECT 1 FROM tbl_support_chat_message y WHERE y.session_id = m.session_id AND y.content ILIKE :q))`;
    }

    const havingMap: Record<string, string> = {
      escalated: "HAVING (bool_or(m.escalated) OR COALESCE(s.escalated,false)) = true",
      human: "HAVING COALESCE(s.mode,'ai') = 'human'",
      open: "HAVING COALESCE(s.status,'open') = 'open'",
      closed: "HAVING COALESCE(s.status,'open') = 'closed'",
      unread: "HAVING COALESCE(s.admin_unread,0) > 0",
    };
    const havingSql = havingMap[status] || "";

    const rows = await sequelize.query(
      `SELECT m.session_id,
              COUNT(*)::int AS message_count,
              MAX(m."createdAt") AS last_message_at,
              (bool_or(m.escalated) OR COALESCE(s.escalated,false)) AS escalated,
              COALESCE(s.mode,'ai') AS mode,
              COALESCE(s.status,'open') AS status,
              COALESCE(s.admin_unread,0) AS admin_unread,
              s.contact_email,
              MAX(m.user_id) AS user_id,
              s.last_email_at,
              (SELECT content FROM tbl_support_chat_message x WHERE x.session_id = m.session_id ORDER BY x."createdAt" DESC LIMIT 1) AS preview,
              (SELECT role FROM tbl_support_chat_message x WHERE x.session_id = m.session_id ORDER BY x."createdAt" DESC LIMIT 1) AS last_role
         FROM tbl_support_chat_message m
         LEFT JOIN tbl_support_session s ON s.session_id = m.session_id
         ${whereSql}
         GROUP BY m.session_id, s.mode, s.status, s.admin_unread, s.contact_email, s.escalated, s.last_email_at
         ${havingSql}
         ORDER BY last_message_at DESC
         LIMIT :limit OFFSET :offset`,
      { replacements: repl, type: QueryTypes.SELECT }
    );

    return successResponseHelper(res, 200, "", {
      sessions: rows,
      has_more: (rows as unknown[]).length === limit,
    });
  } catch (e) {
    apiLogger.error(`[supportInbox] listSessions failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not load support sessions.");
  }
};

/** GET /api/admin/support/summary — badge counts for the inbox nav. */
const summary = async (_req: express.Request, res: express.Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE(s.status,'open')='open')::int AS open,
         COUNT(*) FILTER (WHERE COALESCE(s.mode,'ai')='human')::int AS human,
         COUNT(*) FILTER (WHERE COALESCE(s.escalated,false) OR COALESCE(esc.any_esc,false))::int AS escalated,
         COUNT(*) FILTER (WHERE COALESCE(s.admin_unread,0)>0)::int AS unread,
         COUNT(*)::int AS total
       FROM (SELECT DISTINCT session_id FROM tbl_support_chat_message) d
       LEFT JOIN tbl_support_session s ON s.session_id = d.session_id
       LEFT JOIN (SELECT session_id, bool_or(escalated) AS any_esc FROM tbl_support_chat_message GROUP BY session_id) esc
              ON esc.session_id = d.session_id`,
      { type: QueryTypes.SELECT }
    );
    return successResponseHelper(res, 200, "", (rows as unknown[])[0] || { open: 0, human: 0, escalated: 0, unread: 0, total: 0 });
  } catch (e) {
    apiLogger.error(`[supportInbox] summary failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not load summary.");
  }
};

/** GET /api/admin/support/sessions/:session_id — transcript + marks read. */
const getSession = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");

    const messages = await supportChatMessageModel.findAll({
      where: { session_id: sessionId },
      order: [["createdAt", "ASC"]],
      limit: 500,
      attributes: ["message_id", "role", "content", "attachment_url", "attachment_name", "attachment_type", "user_id", "escalated", "createdAt"],
    });
    if (messages.length === 0) return errorResponseHelper(res, 404, "Session not found.");

    const session = await ensureSession(sessionId);
    // Opening the conversation clears the unread badge.
    await session.update({ admin_unread: 0 });

    return successResponseHelper(res, 200, "", {
      session: {
        session_id: sessionId,
        mode: session.mode,
        status: session.status,
        contact_email: session.contact_email,
        escalated: session.escalated,
      },
      messages,
    });
  } catch (e) {
    apiLogger.error(`[supportInbox] getSession failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not load the conversation.");
  }
};

/** POST /api/admin/support/sessions/:session_id/reply { message } */
const reply = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return errorResponseHelper(res, 400, "Message is required.");
    if (message.length > MAX_AGENT_MSG) return errorResponseHelper(res, 400, `Message too long (max ${MAX_AGENT_MSG}).`);

    const exists = await supportChatMessageModel.count({ where: { session_id: sessionId } });
    if (exists === 0) return errorResponseHelper(res, 404, "Session not found.");

    const row = await supportChatMessageModel.create({
      session_id: sessionId,
      user_id: null,
      role: "agent",
      content: message,
    });

    // Replying implies the human has taken over; keep the AI paused.
    const session = await ensureSession(sessionId);
    await session.update({ mode: "human", admin_unread: 0, last_agent_at: new Date(), last_message_at: new Date() });

    return successResponseHelper(res, 200, "Reply sent.", {
      message: { message_id: row.message_id, role: "agent", content: message, createdAt: row.createdAt },
      mode: "human",
    });
  } catch (e) {
    apiLogger.error(`[supportInbox] reply failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not send the reply.");
  }
};

/** POST /api/admin/support/sessions/:session_id/takeover */
const takeover = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");
    const exists = await supportChatMessageModel.count({ where: { session_id: sessionId } });
    if (exists === 0) return errorResponseHelper(res, 404, "Session not found.");

    const session = await ensureSession(sessionId);
    if (session.mode !== "human") {
      await supportChatMessageModel.create({
        session_id: sessionId,
        user_id: null,
        role: "agent",
        content: "A support agent has joined the chat and will help you from here.",
      });
    }
    await session.update({ mode: "human", admin_unread: 0, last_agent_at: new Date(), last_message_at: new Date() });
    return successResponseHelper(res, 200, "You have taken over this chat.", { session_id: sessionId, mode: "human" });
  } catch (e) {
    apiLogger.error(`[supportInbox] takeover failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not take over the chat.");
  }
};

/** POST /api/admin/support/sessions/:session_id/handback — return to AI. */
const handback = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");
    const exists = await supportChatMessageModel.count({ where: { session_id: sessionId } });
    if (exists === 0) return errorResponseHelper(res, 404, "Session not found.");

    const session = await ensureSession(sessionId);
    if (session.mode !== "ai") {
      await supportChatMessageModel.create({
        session_id: sessionId,
        user_id: null,
        role: "agent",
        content: "You're back with our AI assistant, Emily. Ask away and she'll help right now.",
      });
    }
    await session.update({ mode: "ai", last_message_at: new Date() });
    return successResponseHelper(res, 200, "Returned to AI assistant.", { session_id: sessionId, mode: "ai" });
  } catch (e) {
    apiLogger.error(`[supportInbox] handback failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not hand back to AI.");
  }
};

/** POST /api/admin/support/sessions/:session_id/close  (and /reopen) */
const setStatus = (nextStatus: "open" | "closed") =>
  async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.params.session_id;
      if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");
      const session = await ensureSession(sessionId);
      await session.update({ status: nextStatus });
      return successResponseHelper(res, 200, `Conversation ${nextStatus}.`, { session_id: sessionId, status: nextStatus });
    } catch (e) {
      apiLogger.error(`[supportInbox] setStatus failed: ${(e as Error).message}`);
      return errorResponseHelper(res, 500, "Could not update the conversation.");
    }
  };

/** POST /api/admin/support/sessions/:session_id/email { subject, message, to? } */
const emailReply = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) return errorResponseHelper(res, 400, "Invalid session_id.");

    const subject = typeof req.body?.subject === "string" && req.body.subject.trim()
      ? req.body.subject.trim().slice(0, 160)
      : "Re: your Dynopay support request";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return errorResponseHelper(res, 400, "Message is required.");
    if (message.length > MAX_AGENT_MSG) return errorResponseHelper(res, 400, `Message too long (max ${MAX_AGENT_MSG}).`);

    const session = await ensureSession(sessionId);
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || session.contact_email || "";
    if (!to || !EMAIL_RE.test(to)) {
      return errorResponseHelper(res, 400, "No valid contact email on file for this visitor. Ask them for one in chat, or pass 'to'.");
    }

    const htmlBody = message
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 12px 0;line-height:1.6">${esc(para).replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const info = (await sendEmail(to, "there", subject, htmlBody)) as { suppressed?: boolean } | undefined;
    const suppressed = Boolean(info && info.suppressed);

    await session.update({ last_email_at: new Date() });

    // Record the outbound email in the transcript so it's not lost (visible to
    // the agent; the visitor sees it only if they reopen the chat).
    await supportChatMessageModel.create({
      session_id: sessionId,
      user_id: null,
      role: "agent",
      content: `[Email to ${to}] ${subject}\n\n${message}`,
    });

    apiLogger.info(`[supportInbox] email reply -> ${to} (session ${sessionId}) suppressed=${suppressed}`);
    return successResponseHelper(res, 200, suppressed ? "Email queued (suppressed in this environment)." : "Email sent.", {
      sent: !suppressed,
      to,
      disabled_in_preview: suppressed,
    });
  } catch (e) {
    apiLogger.error(`[supportInbox] emailReply failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not send the email.");
  }
};

export default {
  listSessions,
  summary,
  getSession,
  reply,
  takeover,
  handback,
  close: setStatus("closed"),
  reopen: setStatus("open"),
  emailReply,
};
