import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import supportChatMessageModel from "../models/supportChatModel";
import supportSessionModel from "../models/supportSessionModel";
import { sendEmail } from "../services/emailService";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";
import { subscribeSupportEscalations } from "../services/supportEventBus";
import OpenAI from "openai";
import { raw as envRaw } from "../utils/config";

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

// Pull an email address out of free-text a visitor typed into the chat.
const EMAIL_EXTRACT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Email of the logged-in merchant behind a session (from message user_id), if any. */
const accountEmailForSession = async (
  sessionId: string
): Promise<{ email: string; name: string | null; user_id: number } | null> => {
  const [uidRow] = await sequelize.query<{ user_id: number | null }>(
    `SELECT MAX(user_id) AS user_id FROM tbl_support_chat_message WHERE session_id = :sid AND user_id IS NOT NULL`,
    { replacements: { sid: sessionId }, type: QueryTypes.SELECT }
  );
  const userId = uidRow?.user_id ?? null;
  if (!userId) return null;
  const [u] = await sequelize.query<{ email: string; name: string | null }>(
    `SELECT email, name FROM tbl_user WHERE user_id = :uid`,
    { replacements: { uid: userId }, type: QueryTypes.SELECT }
  );
  return u?.email ? { email: u.email, name: u.name || null, user_id: userId } : null;
};

/** First email address the visitor typed into the transcript, if any. */
const chatEmailForSession = async (sessionId: string): Promise<string | null> => {
  const rows = await sequelize.query<{ content: string }>(
    `SELECT content FROM tbl_support_chat_message WHERE session_id = :sid AND role = 'user' AND content ~ '@' ORDER BY "createdAt" ASC LIMIT 20`,
    { replacements: { sid: sessionId }, type: QueryTypes.SELECT }
  );
  for (const r of rows) {
    const m = (r.content || "").match(EMAIL_EXTRACT_RE);
    if (m) return m[0];
  }
  return null;
};

/**
 * Best contact email for a session so the admin can reply/email:
 * explicitly-provided > logged-in account > typed-in-chat.
 */
const resolveContact = async (
  sessionId: string,
  contactEmail: string | null
): Promise<{ email: string | null; name: string | null; user_id: number | null; source: string }> => {
  if (contactEmail) return { email: contactEmail, name: null, user_id: null, source: "provided" };
  const acct = await accountEmailForSession(sessionId);
  if (acct) return { email: acct.email, name: acct.name, user_id: acct.user_id, source: "account" };
  const chat = await chatEmailForSession(sessionId);
  if (chat) return { email: chat, name: null, user_id: null, source: "chat" };
  return { email: null, name: null, user_id: null, source: "none" };
};

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
        OR EXISTS (SELECT 1 FROM tbl_support_chat_message y WHERE y.session_id = m.session_id AND y.content ILIKE :q)
        OR EXISTS (SELECT 1 FROM tbl_support_chat_message z JOIN tbl_user u2 ON u2.user_id = z.user_id
                   WHERE z.session_id = m.session_id AND u2.email ILIKE :q))`;
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
              (SELECT substring(x.content from '[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}')
                 FROM tbl_support_chat_message x
                WHERE x.session_id = m.session_id AND x.role = 'user' AND x.content ~ '@'
                ORDER BY x."createdAt" ASC LIMIT 1) AS chat_email,
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

    // Resolve the best contact email for each row (account email for logged-in
    // merchants, or an email the visitor typed into chat) so the admin can reply.
    const rowsArr = rows as Array<Record<string, unknown>>;
    const uids = [
      ...new Set(
        rowsArr
          .filter((r) => !r.contact_email && r.user_id)
          .map((r) => Number(r.user_id))
      ),
    ];
    const userMap: Record<number, { email: string; name: string | null }> = {};
    if (uids.length) {
      const users = await sequelize.query<{ user_id: number; email: string; name: string | null }>(
        `SELECT user_id, email, name FROM tbl_user WHERE user_id IN (:uids)`,
        { replacements: { uids }, type: QueryTypes.SELECT }
      );
      users.forEach((u) => {
        userMap[u.user_id] = { email: u.email, name: u.name };
      });
    }
    rowsArr.forEach((r) => {
      const acct = r.user_id ? userMap[Number(r.user_id)] : null;
      r.resolved_email = r.contact_email || acct?.email || r.chat_email || null;
      r.user_name = acct?.name || null;
      r.email_source = r.contact_email
        ? "provided"
        : acct?.email
          ? "account"
          : r.chat_email
            ? "chat"
            : "none";
    });

    return successResponseHelper(res, 200, "", {
      sessions: rowsArr,
      has_more: rowsArr.length === limit,
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

    const contact = await resolveContact(sessionId, session.contact_email);

    return successResponseHelper(res, 200, "", {
      session: {
        session_id: sessionId,
        mode: session.mode,
        status: session.status,
        contact_email: session.contact_email,
        resolved_email: contact.email,
        user_id: contact.user_id,
        user_name: contact.name,
        email_source: contact.source,
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
    const contact = await resolveContact(sessionId, session.contact_email);
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || contact.email || "";
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

/**
 * GET /api/admin/support/stream — SSE. Pushes a live `escalation` event to the
 * admin browser the moment a visitor clicks "Talk to a human". Client uses
 * fetch() streaming so the admin Bearer token rides in the Authorization header
 * (see Components/Page/Admin/SupportInbox/useAdminSupportStream.ts).
 */
const stream = (req: express.Request, res: express.Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeSupportEscalations((event) => {
    try {
      res.write(`event: escalation\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* client gone — cleaned up on 'close' */
    }
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`:hb ${Date.now()}\n\n`);
    } catch {
      /* ignore */
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};

/* ── AI "make it professional" refine (2026-10) ─────────────────────────────
 * Reuses the SAME OpenAI integration that powers the AI support chat
 * (OPENAI_API_KEY, model SUPPORT_CHAT_MODEL / gpt-5.4). An admin's draft reply
 * is rewritten into a clear, professional support tone WITHOUT inventing facts,
 * then returned for the admin to review/edit before sending (chat OR email).
 * Stateless: no DB writes, nothing sent — purely a text transform.
 */
const REFINE_MODEL = envRaw("SUPPORT_CHAT_MODEL") || "gpt-5.4";
const MAX_REFINE_CHARS = 4000;

let refineOpenAI: OpenAI | null = null;
const getRefineOpenAI = (): OpenAI | null => {
  if (!envRaw("OPENAI_API_KEY")) return null;
  if (!refineOpenAI) {
    refineOpenAI = new OpenAI({ apiKey: envRaw("OPENAI_API_KEY"), timeout: 30000, maxRetries: 1 });
  }
  return refineOpenAI;
};

const refineSystemPrompt = (channel: "chat" | "email"): string => `You are an expert editor who rewrites a Dynopay SUPPORT AGENT's draft reply so it always reads clearly, warmly and professionally. Dynopay is a non-custodial cryptocurrency payment gateway for merchants; the reader is a merchant or their customer.

Rewrite the agent's draft:
- Professional, friendly and respectful tone; plain, concise, easy-to-read language; fix all grammar, spelling and punctuation.
- PRESERVE the meaning and EVERY concrete fact exactly as written — amounts, dates, times, links/URLs, email addresses, wallet/transaction/order/ticket IDs, step-by-step instructions and names. Do NOT add, remove or alter any fact.
- Do NOT invent information, promises, policies, apologies for things not mentioned, or details that are not in the draft. If the draft is vague, keep it vague — never fabricate specifics.
- Keep the SAME language as the draft.
- Do not wrap the output in quotes and do not add any preamble, notes or a subject line.
${channel === "email"
    ? `- This is an EMAIL: you may use short paragraphs and a brief courteous sign-off such as "Best regards,\nDynopay Support" — but ONLY if the draft does not already include a closing.`
    : `- This is a LIVE CHAT message: keep it brief and conversational, suitable for a chat bubble. Do NOT add an email-style greeting or signature.`}

Output ONLY the rewritten message text.`;

/** POST /api/admin/support/refine { message, channel? } → { refined } */
const refine = async (req: express.Request, res: express.Response) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return errorResponseHelper(res, 400, "Message is required.");
    if (message.length > MAX_REFINE_CHARS) return errorResponseHelper(res, 400, `Message too long (max ${MAX_REFINE_CHARS}).`);
    const channel: "chat" | "email" = req.body?.channel === "email" ? "email" : "chat";

    const openai = getRefineOpenAI();
    if (!openai) {
      apiLogger.error("[supportInbox] refine: OPENAI_API_KEY is not configured");
      return errorResponseHelper(res, 503, "AI refine is unavailable right now.");
    }

    const completion = await openai.chat.completions.create({
      model: REFINE_MODEL,
      messages: [
        { role: "system", content: refineSystemPrompt(channel) },
        { role: "user", content: message },
      ],
      max_completion_tokens: 1400,
      reasoning_effort: "low",
    });

    const refined = completion.choices?.[0]?.message?.content?.trim();
    if (!refined) {
      apiLogger.error(`[supportInbox] refine: empty completion (finish=${completion.choices?.[0]?.finish_reason})`);
      return errorResponseHelper(res, 502, "Could not refine the message. Please try again.");
    }

    apiLogger.info(`[supportInbox] refine ok channel=${channel} in=${message.length} out=${refined.length} tokens=${completion.usage?.total_tokens ?? "?"}`);
    return successResponseHelper(res, 200, "", { refined, original: message, channel });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    apiLogger.error(`[supportInbox] refine failed: ${err?.message}`);
    if (err?.status === 401) return errorResponseHelper(res, 503, "AI refine is unavailable right now.");
    if (err?.status === 429) return errorResponseHelper(res, 503, "AI is busy right now. Please try again in a moment.");
    return errorResponseHelper(res, 500, "Could not refine the message.");
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
  stream,
  refine,
};
