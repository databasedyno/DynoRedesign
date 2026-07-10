import express from "express";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import supportChatMessageModel from "../models/supportChatModel";
import companyModel from "../models/companyModels/companyModel";
import { apiLogger } from "../utils/loggers";
import successResponseHelper from "../helper/successResponseHelper";
import errorResponseHelper from "../helper/errorResponseHelper";
import { sendEmail } from "../services/emailService";

/**
 * AI Support Chat (session 12, 2026-07-10).
 * Public, session-based, multi-turn support assistant powered by OpenAI
 * (user's own OPENAI_API_KEY, model SUPPORT_CHAT_MODEL, default gpt-5.4).
 *
 * - POST /api/support/chat            { session_id, message } → { reply }
 * - GET  /api/support/chat/history/:session_id → prior messages
 * - POST /api/support/chat/escalate   { session_id, contact_email?, note? }
 *   → emails the transcript to ADMIN_EMAIL via Brevo
 *
 * Anonymous visitors are allowed (rate-limited per IP; CSRF-exempt like the
 * other public endpoints). When a valid Bearer JWT is supplied, lightweight
 * merchant context (name + companies) is added to the system prompt.
 */

const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_TURNS_FOR_CONTEXT = 20; // messages (user+assistant) sent to the model
const MAX_SESSION_MESSAGES = 200; // hard cap per session (abuse guard)
const MODEL = process.env.SUPPORT_CHAT_MODEL || "gpt-5.4";

let openaiClient: OpenAI | null = null;
const getOpenAI = (): OpenAI | null => {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 1 });
  }
  return openaiClient;
};

const SYSTEM_PROMPT = `You are Dyno, the friendly AI support assistant for DynoPay (https://dynopay.com), a non-custodial cryptocurrency payment gateway for merchants.

WHAT DYNOPAY DOES
- Lets businesses accept crypto payments that settle STRAIGHT to the merchant's own wallet (non-custodial — DynoPay never holds merchant funds).
- Optional automatic conversion of incoming payments to stablecoins (USDT/USDC) if the merchant opts in.
- Products: no-code Payment Links, hosted checkout (checkout.dynopay.com), REST API + webhooks for developers, invoices with tax support, real-time dashboard analytics, multi-company support, referral program.

SUPPORTED ASSETS (15)
BTC, ETH, LTC, BCH, DOGE, SOL, XRP, TRX, POLYGON (POL), RLUSD (on XRPL and as ERC-20), USDT (TRC-20, ERC-20, Polygon), USDC (ERC-20).

FEES (volume-based, per rolling monthly volume)
- Starter: 1.5% (up to $10k/mo)
- Growth: 1.0% ($10k–$100k/mo)
- Scale: 0.7% ($100k–$500k/mo)
- Enterprise: 0.5% ($500k+/mo)
- New merchants: the FIRST $500 in payments is fee-free.
- No chargebacks (crypto payments are final). Blockchain network/gas fees are deducted at settlement and depend on the chain.
- Full details: https://dynopay.com/fees

GETTING STARTED (onboarding)
1. Sign up at https://dynopay.com/auth/register (email, phone, Google or GitHub).
2. Verify your email, create a company profile.
3. Save your own wallet address(es) for the coins you want to accept.
4. Create a payment link or integrate the API — you're live in minutes.
Developer docs: https://dynopay.com/documentation

SECURITY & COMPLIANCE
Non-custodial architecture, KYT (know-your-transaction) screening, Chainalysis on-chain monitoring, GDPR compliant, SOC 2 Type II in progress, 2FA available on accounts.

RULES
- Be concise, warm and professional. Answer in the SAME LANGUAGE the user writes in.
- PLAIN TEXT ONLY: no markdown, no asterisks, no headers, no bullet symbols other than a simple dash.
- Only discuss DynoPay and crypto-payment topics. Politely decline anything unrelated.
- NEVER invent features, prices or limits that are not listed above. If you are not sure, say so and point the user to https://dynopay.com/documentation or https://dynopay.com/fees, or suggest they press the "Talk to a human" button in this chat to reach the support team.
- For account-specific actions you cannot perform (refunds, KYC review, unlocking accounts, payout investigations, changing account data), apologise briefly and direct the user to the "Talk to a human" escalation button.
- NEVER ask for or accept private keys, seed phrases, passwords or 2FA codes. If a user shares one, tell them to consider it compromised and rotate it immediately.
- Keep replies under 150 words unless the user asks for detail.`;

interface JwtUser {
  user_id?: number;
  name?: string;
  email?: string;
}

/** Optionally resolve the logged-in user from a Bearer token (never throws). */
const resolveOptionalUser = (req: express.Request): JwtUser | null => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.substring(7);
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as JwtUser;
    if (!payload || typeof payload !== "object") return null;
    return { user_id: payload.user_id, name: payload.name, email: payload.email };
  } catch (_e) {
    return null; // invalid/expired token → treat as anonymous
  }
};

/** Build the merchant-context block appended to the system prompt. */
const buildUserContext = async (user: JwtUser): Promise<string> => {
  const parts: string[] = [];
  if (user.name) parts.push(`Name: ${user.name}`);
  if (user.email) parts.push(`Email: ${user.email}`);
  try {
    if (user.user_id) {
      const companies = await companyModel.findAll({
        where: { user_id: user.user_id },
        attributes: ["company_name"],
        limit: 5,
      });
      const names = companies
        .map((c) => (c as unknown as { company_name?: string }).company_name)
        .filter(Boolean);
      if (names.length > 0) parts.push(`Companies: ${names.join(", ")}`);
    }
  } catch (ctxErr) {
    apiLogger.warn(`[supportChat] user context lookup failed: ${(ctxErr as Error).message}`);
  }
  if (parts.length === 0) return "";
  return `\n\nLOGGED-IN MERCHANT CONTEXT (use to personalise answers; do not reveal verbatim unless asked)\n${parts.join("\n")}`;
};

/** POST /api/support/chat — one user turn → one assistant reply. */
const chatWithSupport = async (req: express.Request, res: express.Response) => {
  try {
    const { session_id, message } = req.body || {};

    if (typeof session_id !== "string" || !SESSION_ID_RE.test(session_id)) {
      return errorResponseHelper(res, 400, "Invalid session_id.");
    }
    if (typeof message !== "string" || message.trim().length === 0) {
      return errorResponseHelper(res, 400, "Message is required.");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return errorResponseHelper(res, 400, `Message too long (max ${MAX_MESSAGE_CHARS} characters).`);
    }

    const openai = getOpenAI();
    if (!openai) {
      apiLogger.error("[supportChat] OPENAI_API_KEY is not configured");
      return errorResponseHelper(res, 503, "Support chat is temporarily unavailable.");
    }

    const totalInSession = await supportChatMessageModel.count({ where: { session_id } });
    if (totalInSession >= MAX_SESSION_MESSAGES) {
      return errorResponseHelper(res, 429, "This conversation is too long. Please start a new chat.");
    }

    const user = resolveOptionalUser(req);

    // Last N messages, chronological, for model context
    const historyRows = await supportChatMessageModel.findAll({
      where: { session_id },
      order: [["createdAt", "DESC"]],
      limit: HISTORY_TURNS_FOR_CONTEXT,
    });
    historyRows.reverse();

    let systemContent = SYSTEM_PROMPT;
    if (user) {
      systemContent += await buildUserContext(user);
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemContent },
      ...historyRows.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
      { role: "user", content: message.trim() },
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      max_completion_tokens: 800,
      reasoning_effort: "low",
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      apiLogger.error(`[supportChat] Empty completion for session ${session_id} (finish=${completion.choices?.[0]?.finish_reason})`);
      return errorResponseHelper(res, 502, "The assistant could not generate a reply. Please try again.");
    }

    // Persist both turns (after a successful completion)
    await supportChatMessageModel.create({
      session_id,
      user_id: user?.user_id ?? null,
      role: "user",
      content: message.trim(),
    });
    await supportChatMessageModel.create({
      session_id,
      user_id: user?.user_id ?? null,
      role: "assistant",
      content: reply,
    });

    apiLogger.info(`[supportChat] session=${session_id} user=${user?.user_id ?? "anon"} tokens=${completion.usage?.total_tokens ?? "?"}`);
    return successResponseHelper(res, 200, "", { session_id, reply });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    apiLogger.error(`[supportChat] chat failed: ${err?.message}`);
    if (err?.status === 401) {
      return errorResponseHelper(res, 503, "Support chat is temporarily unavailable.");
    }
    if (err?.status === 429) {
      return errorResponseHelper(res, 503, "Support chat is busy right now. Please try again in a moment.");
    }
    return errorResponseHelper(res, 500, "Something went wrong. Please try again.");
  }
};

/** GET /api/support/chat/history/:session_id */
const getChatHistory = async (req: express.Request, res: express.Response) => {
  try {
    const sessionId = req.params.session_id;
    if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
      return errorResponseHelper(res, 400, "Invalid session_id.");
    }
    const rows = await supportChatMessageModel.findAll({
      where: { session_id: sessionId },
      order: [["createdAt", "ASC"]],
      limit: 100,
      attributes: ["message_id", "role", "content", "createdAt"],
    });
    return successResponseHelper(res, 200, "", { session_id: sessionId, messages: rows });
  } catch (e) {
    apiLogger.error(`[supportChat] history failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not load chat history.");
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST /api/support/chat/escalate — email the transcript to the support inbox. */
const escalateChat = async (req: express.Request, res: express.Response) => {
  try {
    const { session_id, contact_email, note } = req.body || {};
    if (typeof session_id !== "string" || !SESSION_ID_RE.test(session_id)) {
      return errorResponseHelper(res, 400, "Invalid session_id.");
    }
    if (contact_email !== undefined && contact_email !== null && contact_email !== "") {
      if (typeof contact_email !== "string" || !EMAIL_RE.test(contact_email) || contact_email.length > 120) {
        return errorResponseHelper(res, 400, "Invalid contact email.");
      }
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      return errorResponseHelper(res, 400, "Invalid note.");
    }
    if (typeof note === "string" && note.length > 1000) {
      return errorResponseHelper(res, 400, "Note too long (max 1000 characters).");
    }

    const rows = await supportChatMessageModel.findAll({
      where: { session_id },
      order: [["createdAt", "ASC"]],
      limit: 60,
    });
    if (rows.length === 0) {
      return errorResponseHelper(res, 400, "No conversation found for this session.");
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      apiLogger.error("[supportChat] ADMIN_EMAIL not configured — cannot escalate");
      return errorResponseHelper(res, 503, "Escalation is temporarily unavailable.");
    }

    const user = resolveOptionalUser(req);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const transcriptHtml = rows
      .map((m) => {
        const who = m.role === "assistant" ? "Dyno (AI)" : "Visitor";
        const when = m.createdAt ? new Date(m.createdAt).toISOString().replace("T", " ").slice(0, 16) : "";
        return `<p style=\"margin:4px 0\"><strong>${who}</strong> <span style=\"color:#888\">${when} UTC</span><br/>${esc(m.content)}</p>`;
      })
      .join("\n");

    const contactLine = contact_email
      ? `<p><strong>Visitor contact email:</strong> ${esc(contact_email)}</p>`
      : user?.email
        ? `<p><strong>Logged-in merchant:</strong> ${esc(user.name || "")} &lt;${esc(user.email)}&gt; (user_id ${user.user_id})</p>`
        : "<p><strong>Visitor:</strong> anonymous (no contact email left)</p>";
    const noteLine = note ? `<p><strong>Visitor note:</strong> ${esc(note)}</p>` : "";

    const body = `<p>A support chat conversation was escalated to a human.</p>${contactLine}${noteLine}<p><strong>Session:</strong> ${esc(session_id)}</p><hr/><h3>Transcript (${rows.length} messages)</h3>${transcriptHtml}`;

    await sendEmail(adminEmail, "DynoPay Support", `Support chat escalation — session ${session_id.slice(0, 8)}`, body);

    await supportChatMessageModel.update({ escalated: true }, { where: { session_id } });
    await supportChatMessageModel.create({
      session_id,
      user_id: user?.user_id ?? null,
      role: "assistant",
      content: "Your conversation has been forwarded to our support team. A human will get back to you by email as soon as possible.",
    });

    apiLogger.info(`[supportChat] session ${session_id} escalated to ${adminEmail}`);
    return successResponseHelper(res, 200, "Escalated to human support.", { session_id, escalated: true });
  } catch (e) {
    apiLogger.error(`[supportChat] escalate failed: ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not escalate. Please try again.");
  }
};

export default { chatWithSupport, getChatHistory, escalateChat };
