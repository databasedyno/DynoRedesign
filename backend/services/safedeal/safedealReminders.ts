/**
 * SafeDeal once-only reminder scan + hourly maintenance bundle.
 * Each reminder is stamped in tbl_escrow_deal.reminders (JSONB) so it fires once:
 *   invite_3d      — invite unanswered for 3 days            → counterparty
 *   unfunded_2d    — accepted but unfunded for 2 days        → buyer
 *   inspection_24h — inspection period ends within 24 hours  → buyer
 *   due_passed     — delivery due date passed, not delivered → seller + buyer
 */
import { Op } from "sequelize";
import escrowDealModel from "../../models/escrowDealModel";
import { escrowEngine } from "../../controller/escrowController";
import { computeFeeBreakdown } from "../../controller/escrow/escrowShared";
import { apiLogger } from "../../utils/loggers";
import {
  sendEscrowInviteReminderEmail,
  sendEscrowUnfundedReminderEmail,
  sendEscrowInspectionEndingEmail,
  sendEscrowDeliveryOverdueEmail,
} from "../email/escrowEmails";
import { notifyDealStage } from "./safedealTelegram";

const DAY = 86400000;
type ReminderKey = "invite_3d" | "unfunded_2d" | "inspection_24h" | "due_passed";

const notSent = (deal: any, key: ReminderKey) => !(deal.reminders && deal.reminders[key]);
async function stamp(deal: any, key: ReminderKey): Promise<void> {
  deal.reminders = { ...(deal.reminders || {}), [key]: new Date().toISOString() };
  deal.changed("reminders", true);
  await deal.save();
}

export interface ReminderRun {
  invite_3d: number[];
  unfunded_2d: number[];
  inspection_24h: number[];
  due_passed: number[];
}

export async function runSafeDealReminders(now = new Date()): Promise<ReminderRun> {
  const out: ReminderRun = { invite_3d: [], unfunded_2d: [], inspection_24h: [], due_passed: [] };
  const base = { source: "safedeal" } as const;

  const invited: any[] = await escrowDealModel.findAll({ where: { ...base, status: "invited", invited_at: { [Op.lte]: new Date(now.getTime() - 3 * DAY) } } as any, limit: 200 });
  for (const deal of invited) {
    if (!notSent(deal, "invite_3d")) continue;
    try {
      void sendEscrowInviteReminderEmail(deal.counterparty_email, deal, deal.creator_email || "the other party", escrowEngine.inviteLinkFor(deal));
      void notifyDealStage(deal, "remind_invite", deal.counterparty_email, escrowEngine.inviteLinkFor(deal));
      await stamp(deal, "invite_3d");
      out.invite_3d.push(deal.escrow_id);
    } catch (e) {
      apiLogger.error(`[safedeal.reminders] invite_3d deal ${deal.escrow_id}: ${(e as Error).message}`);
    }
  }

  const unfunded: any[] = await escrowDealModel.findAll({ where: { ...base, status: "awaiting_payment", accepted_at: { [Op.lte]: new Date(now.getTime() - 2 * DAY) } } as any, limit: 200 });
  for (const deal of unfunded) {
    if (!notSent(deal, "unfunded_2d")) continue;
    try {
      const { buyerEmail } = await escrowEngine.partyEmails(deal);
      const b = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer });
      if (buyerEmail) void sendEscrowUnfundedReminderEmail(buyerEmail, deal, b.buyerPays, escrowEngine.dealUrl(deal));
      if (buyerEmail) void notifyDealStage(deal, "remind_unfunded", buyerEmail, escrowEngine.dealUrl(deal));
      await stamp(deal, "unfunded_2d");
      out.unfunded_2d.push(deal.escrow_id);
    } catch (e) {
      apiLogger.error(`[safedeal.reminders] unfunded_2d deal ${deal.escrow_id}: ${(e as Error).message}`);
    }
  }

  const ending: any[] = await escrowDealModel.findAll({
    where: { ...base, status: "delivered", auto_release_at: { [Op.gt]: now, [Op.lte]: new Date(now.getTime() + DAY) } } as any,
    limit: 200,
  });
  for (const deal of ending) {
    if (!notSent(deal, "inspection_24h")) continue;
    try {
      const { buyerEmail } = await escrowEngine.partyEmails(deal);
      if (buyerEmail) void sendEscrowInspectionEndingEmail(buyerEmail, deal, new Date(deal.auto_release_at), escrowEngine.dealUrl(deal));
      if (buyerEmail) void notifyDealStage(deal, "remind_inspection", buyerEmail, escrowEngine.dealUrl(deal));
      await stamp(deal, "inspection_24h");
      out.inspection_24h.push(deal.escrow_id);
    } catch (e) {
      apiLogger.error(`[safedeal.reminders] inspection_24h deal ${deal.escrow_id}: ${(e as Error).message}`);
    }
  }

  const overdue: any[] = await escrowDealModel.findAll({ where: { ...base, status: "funded", delivery_due_at: { [Op.ne]: null, [Op.lte]: now } } as any, limit: 200 });
  for (const deal of overdue) {
    if (!notSent(deal, "due_passed")) continue;
    try {
      const { buyerEmail, sellerEmail } = await escrowEngine.partyEmails(deal);
      const url = escrowEngine.dealUrl(deal);
      if (sellerEmail) void sendEscrowDeliveryOverdueEmail(sellerEmail, deal, "seller", new Date(deal.delivery_due_at), url);
      if (buyerEmail) void sendEscrowDeliveryOverdueEmail(buyerEmail, deal, "buyer", new Date(deal.delivery_due_at), url);
      if (sellerEmail) void notifyDealStage(deal, "remind_overdue", sellerEmail, url);
      if (buyerEmail) void notifyDealStage(deal, "remind_overdue", buyerEmail, url);
      await stamp(deal, "due_passed");
      out.due_passed.push(deal.escrow_id);
    } catch (e) {
      apiLogger.error(`[safedeal.reminders] due_passed deal ${deal.escrow_id}: ${(e as Error).message}`);
    }
  }
  return out;
}

/** Hourly bundle: timers first (auto-release, auto-escalate), then reminders, then parked payouts whose address became usable. */
export async function runSafeDealMaintenance(): Promise<{ auto_release: number[]; escalated: number[]; reminders: ReminderRun; parked_released: number }> {
  const auto_release = await escrowEngine.runAutoRelease();
  const escalated = await escrowEngine.runDisputeEscalations();
  const reminders = await runSafeDealReminders();
  const { releaseParkedPayouts } = await import("./safedealWithdrawals");
  const parked_released = await releaseParkedPayouts();
  return { auto_release, escalated, reminders, parked_released };
}
