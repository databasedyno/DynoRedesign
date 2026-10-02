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
