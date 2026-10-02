/**
 * SafeDeal → Telegram push notices (Bot API sendMessage, HTML parse mode).
 * Recipients are customers who linked Telegram (tbl_customer.telegram_id) via the login widget
 * with request_access=write, so the bot is allowed to message them. Never throws.
 */
import axios from "axios";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { raw as envRaw } from "../../utils/config";
import { explorerTxUrl } from "../receiptLinkService";
import { ESCROW_PAYOUT_OPTIONS } from "../escrow/escrowCosts";
import { payoutKeyToCryptoCode, type WithdrawalRow } from "./safedealWithdrawals";
import { escapeBasic as esc } from "../../utils/escapeHtml";

const botToken = (): string => (envRaw("SAFEDEAL_TELEGRAM_BOT_TOKEN") || "").trim();
export const botUsername = (): string | null => (envRaw("SAFEDEAL_TELEGRAM_BOT_USERNAME") || "").trim() || null;
export const telegramConfigured = (): boolean => Boolean(botToken());

const usd = (n: unknown): string => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortAddr = (a: string): string => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export interface TelegramSendResult {
  ok: boolean;
  /** Bot can't reach this chat (user never pressed Start / blocked the bot / chat not found). */
  unreachable?: boolean;
  error?: string;
}

export const sendTelegramMessage = async (
  chatId: string | number,
  html: string,
  buttons?: Array<{ text: string; url: string }>
): Promise<TelegramSendResult> => {
  const token = botToken();
  if (!token) return { ok: false, error: "not_configured" };
  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(buttons?.length ? { reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))] } } : {}),
      },
      { timeout: 10_000 }
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    const description = String((e as { response?: { data?: { description?: string } } }).response?.data?.description || (e as Error).message);
    const unreachable = status === 403 || /chat not found|bot was blocked|user is deactivated|can't initiate/i.test(description);
    apiLogger.warn(`[SafeDealTelegram] sendMessage to ${chatId} failed (${status ?? "network"}): ${description}`);
    return { ok: false, unreachable, error: description };
  }
};

export const telegramIdFor = async (customerId: number): Promise<string | null> => {
  const rows = await sequelize.query<{ telegram_id: string | null }>(
    `SELECT telegram_id FROM tbl_customer WHERE customer_id = :cid LIMIT 1`,
    { replacements: { cid: customerId }, type: QueryTypes.SELECT }
  );
  return rows[0]?.telegram_id || null;
};

/** "🔔 Alerts are on" — used right after linking and by the "Send test" button. */
export const sendTelegramTest = async (customerId: number): Promise<TelegramSendResult> => {
  const chat = await telegramIdFor(customerId);
  if (!chat) return { ok: false, error: "not_linked" };
  return sendTelegramMessage(chat, `🔔 <b>SafeDeal alerts are on.</b>\nYou'll get a message here each time a cashout or deal payout is confirmed on-chain, with the transaction link.`);
};

/** Cashout / deal payout confirmed on-chain → one Telegram notice with amount, network and explorer link. Idempotent via telegram_notified_at. */
export const notifyCashoutConfirmed = async (w: WithdrawalRow & { telegram_notified_at?: string | Date | null }): Promise<boolean> => {
  if (!telegramConfigured() || !w.chain_tx_hash || w.telegram_notified_at) return false;
  try {
    const chat = await telegramIdFor(w.customer_id);
    if (!chat) return false;
    const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === w.payout_key);
    const network = opt?.label || w.payout_key;
    const isPayout = w.source === "settlement";
    const title = isPayout ? `Deal payout confirmed${w.escrow_id ? ` · deal #${w.escrow_id}` : ""}` : `Cashout confirmed · #${w.withdrawal_id}`;
    const url = explorerTxUrl(payoutKeyToCryptoCode(w.payout_key), w.chain_tx_hash);
    const html = [
      `✅ <b>${esc(title)}</b>`,
      `<b>${esc(usd(w.net_usd))}</b> ${esc(opt?.coin || "USDT")} on ${esc(network)}`,
      `to <code>${esc(shortAddr(w.address))}</code>`,
      isPayout ? `Network fee covered by the deal.` : `Cashout fee ${esc(usd(w.fee_usd))} · you sent ${esc(usd(w.amount_usd))}`,
      `tx <code>${esc(w.chain_tx_hash.slice(0, 10))}…${esc(w.chain_tx_hash.slice(-6))}</code>`,
    ].join("\n");
    const r = await sendTelegramMessage(chat, html, [{ text: "View on explorer ↗", url }]);
    if (r.ok) {
      await sequelize.query(`UPDATE tbl_customer_withdrawal SET telegram_notified_at = NOW() WHERE withdrawal_id = :id`, { replacements: { id: w.withdrawal_id } });
      apiLogger.info(`[SafeDealTelegram] ✅ notified customer ${w.customer_id} about ${isPayout ? "payout" : "cashout"} #${w.withdrawal_id}`);
    }
    return r.ok;
  } catch (e) {
    apiLogger.warn(`[SafeDealTelegram] notify #${w.withdrawal_id} failed: ${(e as Error).message}`);
    return false;
  }
};

/** Catch-up: confirmed rows whose Telegram notice never left (bot unreachable at the time, linked later, restart). */
export const notifyPendingCashouts = async (limit = 20): Promise<number> => {
  if (!telegramConfigured()) return 0;
  const rows = await sequelize.query<WithdrawalRow>(
    `SELECT w.*
       FROM tbl_customer_withdrawal w
       JOIN tbl_customer c ON c.customer_id = w.customer_id AND c.telegram_id IS NOT NULL
      WHERE w.chain_tx_hash IS NOT NULL
        AND w.telegram_notified_at IS NULL
        AND w.simulated = false
        AND COALESCE(w.chain_confirmed_at, w.sent_at, w.created_at) > NOW() - INTERVAL '7 days'
      ORDER BY w.withdrawal_id ASC
      LIMIT :limit`,
    { replacements: { limit }, type: QueryTypes.SELECT }
  );
  let sent = 0;
  for (const w of rows) if (await notifyCashoutConfirmed(w)) sent++;
  return sent;
};

/** Resolve a deal party's linked Telegram chat id by company + email (null if not linked). */
export const telegramIdForEmail = async (companyId: number, email: string): Promise<string | null> => {
  if (!companyId || !email) return null;
  const rows = await sequelize.query<{ telegram_id: string | null }>(
    `SELECT telegram_id FROM tbl_customer
      WHERE company_id = :cid AND lower(email) = lower(:email) AND telegram_id IS NOT NULL
      LIMIT 1`,
    { replacements: { cid: companyId, email: String(email).trim() }, type: QueryTypes.SELECT }
  );
  return rows[0]?.telegram_id || null;
};

/** Every SafeDeal lifecycle + stall-reminder stage that can push a Telegram notice. */
export type DealStage =
  | "invited" | "accepted" | "declined" | "cancelled"
  | "funded_seller" | "funded_buyer" | "delivered" | "released" | "refunded"
  | "changes_requested" | "dispute_opened" | "dispute_proposal"
  | "dispute_resolved" | "dispute_escalated"
  | "remind_invite" | "remind_unfunded" | "remind_inspection" | "remind_overdue";

const dealTitle = (deal: { title?: string | null; escrow_id?: number }): string =>
  esc(String(deal?.title || `Deal #${deal?.escrow_id ?? ""}`).trim().slice(0, 80));

const STAGE_COPY: Record<DealStage, (d: any) => { emoji: string; title: string; line: string }> = {
  invited:           (d) => ({ emoji: "📨", title: "You're invited to a SafeDeal escrow", line: `${dealTitle(d)} · ${usd(d.amount)}. Review the terms and accept to get started.` }),
  accepted:          (d) => ({ emoji: "🤝", title: "Your SafeDeal invite was accepted", line: `${dealTitle(d)} · ${usd(d.amount)} is moving forward.` }),
  declined:          (d) => ({ emoji: "🚫", title: "Your SafeDeal invite was declined", line: `${dealTitle(d)} won't go ahead.` }),
  cancelled:         (d) => ({ emoji: "✖️", title: "A SafeDeal deal was cancelled", line: `${dealTitle(d)} · ${usd(d.amount)} was cancelled.` }),
  funded_seller:     (d) => ({ emoji: "🔒", title: "Payment secured in escrow — ship now", line: `The buyer funded ${dealTitle(d)} · ${usd(d.amount)}. Ship it, then mark it delivered to get paid.` }),
  funded_buyer:      (d) => ({ emoji: "🔒", title: "Your payment is secured in escrow", line: `${dealTitle(d)} · ${usd(d.amount)} is held safely until you confirm delivery.` }),
  delivered:         (d) => ({ emoji: "📦", title: "Marked delivered — inspect & release", line: `The seller marked ${dealTitle(d)} delivered. Check it, then release the funds.` }),
  released:          (d) => ({ emoji: "✅", title: "Funds released — payout on the way", line: `${dealTitle(d)} · ${usd(d.amount)} was released. Your payout is being sent.` }),
  refunded:          (d) => ({ emoji: "↩️", title: "You've been refunded", line: `${dealTitle(d)} · ${usd(d.amount)} is on its way back to you.` }),
  changes_requested: (d) => ({ emoji: "✏️", title: "Buyer requested changes", line: `The buyer asked for changes on ${dealTitle(d)}.` }),
  dispute_opened:    (d) => ({ emoji: "⚖️", title: "A dispute was opened", line: `A dispute was opened on ${dealTitle(d)} · ${usd(d.amount)}. Review and respond.` }),
  dispute_proposal:  (d) => ({ emoji: "⚖️", title: "A resolution was proposed", line: `A new resolution was proposed for ${dealTitle(d)}. Review and respond.` }),
  dispute_resolved:  (d) => ({ emoji: "✅", title: "Your dispute was resolved", line: `The dispute on ${dealTitle(d)} has been resolved.` }),
  dispute_escalated: (d) => ({ emoji: "🛡️", title: "Dispute escalated to the SafeDeal team", line: `${dealTitle(d)} was escalated — our team will review it.` }),
  remind_invite:     (d) => ({ emoji: "⏰", title: "Reminder: an invite is waiting", line: `${dealTitle(d)} · ${usd(d.amount)} is still waiting for your response.` }),
  remind_unfunded:   (d) => ({ emoji: "⏰", title: "Reminder: payment still needed", line: `${dealTitle(d)} · ${usd(d.amount)} is accepted but not yet funded.` }),
  remind_inspection: (d) => ({ emoji: "⏰", title: "Reminder: inspection ending soon", line: `Your window to inspect ${dealTitle(d)} ends within 24h — it auto-releases after that.` }),
  remind_overdue:    (d) => ({ emoji: "⏰", title: "Reminder: delivery is overdue", line: `${dealTitle(d)} is past its delivery due date.` }),
};

/** Pure message builder (exported for tests). Returns the HTML body for a stage. */
export const buildDealStageMessage = (deal: any, stage: DealStage): string => {
  const c = STAGE_COPY[stage](deal);
  return `${c.emoji} <b>${esc(c.title)}</b>\n${c.line}`;
};

/**
 * Push a SafeDeal lifecycle/reminder notice to one party's linked Telegram.
 * No-ops (never throws) when the bot is unconfigured, the deal isn't SafeDeal,
 * or the recipient hasn't linked Telegram. Fire-and-forget: `void` it at call sites.
 */
export const notifyDealStage = async (
  deal: any,
  stage: DealStage,
  recipientEmail: string | null | undefined,
  dealUrl?: string | null
): Promise<boolean> => {
  try {
    if (!telegramConfigured() || !deal || deal.source !== "safedeal" || !recipientEmail) return false;
    const chat = await telegramIdForEmail(Number(deal.company_id), String(recipientEmail));
    if (!chat) return false;
    const html = buildDealStageMessage(deal, stage);
    const r = await sendTelegramMessage(chat, html, dealUrl ? [{ text: "View deal ↗", url: dealUrl }] : undefined);
    if (r.ok) apiLogger.info(`[SafeDealTelegram] ✅ ${stage} → deal ${deal.escrow_id} (${recipientEmail})`);
    return r.ok;
  } catch (e) {
    apiLogger.warn(`[SafeDealTelegram] notifyDealStage(${stage}) deal ${deal?.escrow_id} failed: ${(e as Error).message}`);
    return false;
  }
};

/** Attach a verified Telegram identity to an existing (email) customer. */
export const linkTelegram = async (customerId: number, telegramId: string): Promise<{ ok: true } | { ok: false; reason: "taken" }> => {
  const owner = await sequelize.query<{ customer_id: number; company_id: number }>(
    `SELECT c2.customer_id, c2.company_id FROM tbl_customer c1
       JOIN tbl_customer c2 ON c2.company_id = c1.company_id AND c2.telegram_id = :tg AND c2.customer_id <> c1.customer_id
      WHERE c1.customer_id = :cid LIMIT 1`,
    { replacements: { tg: telegramId, cid: customerId }, type: QueryTypes.SELECT }
  );
  if (owner.length) return { ok: false, reason: "taken" };
  await sequelize.query(`UPDATE tbl_customer SET telegram_id = :tg, "updatedAt" = NOW() WHERE customer_id = :cid`, { replacements: { tg: telegramId, cid: customerId } });
  return { ok: true };
};

export const unlinkTelegram = async (customerId: number): Promise<void> => {
  await sequelize.query(`UPDATE tbl_customer SET telegram_id = NULL, "updatedAt" = NOW() WHERE customer_id = :cid`, { replacements: { cid: customerId } });
};
