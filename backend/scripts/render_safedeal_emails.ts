/**
 * Render every SafeDeal-facing email to HTML (nothing is sent).
 * Run: cd /app/backend && EMAIL_DUMP_DIR=/tmp/safedeal_emails node_modules/.bin/ts-node --transpile-only scripts/render_safedeal_emails.ts
 */
import * as fs from "fs";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = process.env.EMAIL_DUMP_DIR || "/tmp/safedeal_emails";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(`${OUT}/${f}`);

const deal = { title: "Logo redesign for Acme", amount: 300, currency: "USD", deal_token: "abc123", source: "safedeal" };
const legacy = { ...deal, source: null };
const url = "https://safedeal.sh/deal/abc123";
const buyer = "jamie.chen@example.com";
const seller = "alex.rivera@example.com";
const wd = { withdrawal_id: 42, amount_usd: 1200, fee_usd: 1.2, net_usd: 1198.8, address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR", status: "sent", requires_approval: true, rejected_reason: null, source: "wallet", payout_key: "USDT-TRON" };
const TX = "2e52344932e82e40d942aa2f2e0d0c8f1b7d5c3a9e6f4b2a1c0d9e8f7a6b5c4d";
const EXPLORER = `https://tronscan.org/#/transaction/${TX}`;
const cashoutOpts = { approvalThresholdUsd: 1000 };

const main = async () => {
  const sd = await import("../services/email/safedealEmails");
  const es = await import("../services/email/escrowEmails");
  const steps: Array<[string, () => Promise<void>]> = [
    ["signin_code", () => sd.sendSafeDealCodeEmail(buyer, "482913", "signin")],
    ["stepup_code_generic", () => sd.sendSafeDealCodeEmail(buyer, "115522", "stepup")],
    ["stepup_code_cashout", () => sd.sendSafeDealCodeEmail(buyer, "115522", "stepup", "cashout")],
    ["stepup_code_address", () => sd.sendSafeDealCodeEmail(buyer, "115522", "stepup", "address_add")],
    ["address_added", () => sd.sendSafeDealAddressAlertEmail(seller, "added", "Main · USDT (Tron)", wd.address)],
    ["cashout_sent", () => sd.sendSafeDealWithdrawalEmail(seller, wd, "USDT (Tron)", cashoutOpts)],
    ["cashout_review", () => sd.sendSafeDealWithdrawalEmail(seller, { ...wd, status: "pending_approval" }, "USDT (Tron)", cashoutOpts)],
    ["cashout_confirmed_onchain", () => sd.sendSafeDealCashoutConfirmedEmail(seller, { ...wd, chain_tx_hash: TX }, "USDT (Tron)", { txHash: TX, explorerUrl: EXPLORER }, cashoutOpts)],
    ["cashout_rejected", () => sd.sendSafeDealWithdrawalRejectedEmail(seller, { ...wd, status: "rejected", rejected_reason: "Address flagged by compliance" }, "USDT (Tron)", cashoutOpts)],
    ["deal_payout_sent", () => sd.sendSafeDealWithdrawalEmail(seller, { ...wd, source: "settlement", escrow_id: 77, amount_usd: 285, net_usd: 284, fee_usd: 1 }, "USDT (Tron)", { ...cashoutOpts, dealTitle: deal.title })],
    ["deal_payout_confirmed_onchain", () => sd.sendSafeDealCashoutConfirmedEmail(seller, { ...wd, source: "settlement", escrow_id: 77, amount_usd: 285, net_usd: 284, fee_usd: 1, chain_tx_hash: TX }, "USDT (Tron)", { txHash: TX, explorerUrl: EXPLORER }, { ...cashoutOpts, dealTitle: deal.title })],
    ["topup_receipt", () => sd.sendSafeDealDepositReceiptEmail(buyer, { topup_id: 9, amount_usd: 300, pays_usd: 305.1, seen_tx: TX }, "USDT", "Tron (TRC-20)", Buffer.from("%PDF-1.4 test"), { txHash: TX, explorerUrl: EXPLORER })],
    ["funding_receipt_onchain", () => es.sendEscrowFundingReceiptEmail(buyer, buyer, deal, { paidUsd: 305.1, coin: "USDT-TRC20", txHash: TX, explorerUrl: EXPLORER, method: "checkout" }, url)],
    ["funding_receipt_balance", () => es.sendEscrowFundingReceiptEmail(buyer, buyer, deal, { paidUsd: 300, method: "balance" }, url)],
    ["invite", () => es.sendEscrowInviteEmail(buyer, buyer, deal, seller, "buyer", url)],
    ["accepted", () => es.sendEscrowAcceptedEmail(seller, seller, deal, buyer)],
    ["funded", () => es.sendEscrowFundedEmail(seller, seller, deal)],
    ["delivered", () => es.sendEscrowDeliveredEmail(buyer, buyer, deal, 3)],
    ["released", () => es.sendEscrowReleasedEmail(seller, seller, deal, "300.00 USD was credited to your SafeDeal wallet.")],
    ["cancel_requested", () => es.sendEscrowDisputeProposalEmail(seller, seller, deal, "buyer", "refund", null, "Project no longer needed", url, false, "cancellation")],
    ["dispute_counter", () => es.sendEscrowDisputeProposalEmail(buyer, buyer, deal, "seller", "split", 60, "Half the work is done", url, true)],
    ["escalated", () => es.sendEscrowDisputeEscalatedEmail(buyer, buyer, deal, "system")],
    ["agreed", () => es.sendEscrowDisputeAgreedEmail(buyer, buyer, deal, "Seller keeps 60%, buyer refunded 40%.")],
    ["legacy_invite_dynopay", () => es.sendEscrowInviteEmail(buyer, buyer, legacy, "The Dev Store", "buyer", "https://dynopay.com/escrow/invite/abc123")],
    ["admin_new_user_email", () => sd.sendSafeDealNewUserAdminEmail("admin@example.com", { email: "newbie@example.com", name: "Newbie", customerId: 9101, method: "email" })],
    ["admin_new_user_telegram", () => sd.sendSafeDealNewUserAdminEmail("admin@example.com", { email: "tg_123456789@telegram.safedeal", name: "Ada Lovelace", customerId: 9102, method: "telegram", telegramId: "123456789", telegramUsername: "ada_l" })],
    ["admin_new_user_telegram_no_username", () => sd.sendSafeDealNewUserAdminEmail("admin@example.com", { email: "tg_987@telegram.safedeal", name: "Telegram 987", customerId: 9103, method: "telegram", telegramId: "987", telegramUsername: null })],
  ];
  for (const [name, fn] of steps) {
    const before = new Set(fs.readdirSync(OUT));
    await fn();
    await new Promise((r) => setTimeout(r, 40));
    const created = fs.readdirSync(OUT).filter((f) => !before.has(f));
    for (const f of created) fs.renameSync(`${OUT}/${f}`, `${OUT}/${name}.html`);
    console.log(`${created.length ? "ok " : "!! "} ${name}`);
  }
  process.exit(0);
};
void main();
