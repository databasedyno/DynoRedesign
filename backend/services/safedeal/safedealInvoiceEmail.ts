/**
 * Emails branded SafeDeal PDFs to customers on settlement:
 *   - a deposit receipt (DEP-<id>) when a wallet top-up is credited, and
 *   - a deal invoice (SD-<id>) to each party when a deal reaches its outcome.
 * Fire-and-forget; never throws into the settlement path. No-op for synthetic
 * (Telegram / internal) addresses, and suppressed → dumped in preview.
 */
import { raw as envRaw } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { generateDealSummaryPdf, generateTopupReceiptPdf, pdfToBuffer } from "./safedealPdf";
import { listAttachments } from "./safedealAttachments";
import { listDealPayouts } from "./safedealWithdrawals";
import { isRealCustomerEmail, FUNDING_COIN_META } from "./safedealCheckout";
import { explorerTxUrl } from "../receiptLinkService";
import { sendSafeDealDepositReceiptEmail, sendSafeDealDealInvoiceEmail } from "../email/safedealEmails";
import type { TopupRow } from "./safedealTopup";

const legalName = (): string => (envRaw("EMAIL_LEGAL_NAME") || "Dynopay").trim();

/** Email the customer their branded deposit receipt for a credited wallet top-up. */
export async function emailSafeDealDepositReceipt(row: TopupRow, customerEmail: string): Promise<void> {
  if (!isRealCustomerEmail(customerEmail)) return;
  try {
    const m = FUNDING_COIN_META[row.coin];
    const doc = generateTopupReceiptPdf({
      topup: {
        topup_id: row.topup_id,
        coin: row.coin,
        amount_usd: row.amount_usd,
        network_fee_usd: row.network_fee_usd,
        conversion_fee_usd: row.conversion_fee_usd,
        exchange_fee_usd: row.exchange_fee_usd,
        pays_usd: row.pays_usd,
        crypto_amount: row.crypto_amount,
        status: row.status,
        seen_tx: row.seen_tx,
        credited_at: row.credited_at,
        created_at: row.created_at,
      },
      coinLabel: m?.label || row.coin,
      network: m?.network || row.coin,
      customerEmail,
      legalName: legalName(),
    });
    const pdf = await pdfToBuffer(doc);
    // Include the funding transaction so the user can verify the deposit on the explorer.
    const seenTx = row.seen_tx && !/^(SIMULATED-|WALLET-CREDIT|BINANCE-)/i.test(String(row.seen_tx)) ? String(row.seen_tx) : null;
    await sendSafeDealDepositReceiptEmail(
      customerEmail,
      { topup_id: row.topup_id, amount_usd: row.amount_usd, pays_usd: row.pays_usd, seen_tx: seenTx },
      m?.label || row.coin,
      m?.network || row.coin,
      pdf,
      seenTx ? { txHash: seenTx, explorerUrl: explorerTxUrl(row.coin, seenTx) } : undefined
    );
  } catch (e) {
    apiLogger.warn(`[SafeDeal] deposit receipt email failed for topup ${row.topup_id}: ${(e as Error).message}`);
  }
}

/** Email both parties their branded deal invoice PDF once the deal settles. */
export async function emailSafeDealDealInvoices(deal: any, buyerEmail: string, sellerEmail: string): Promise<void> {
  try {
    const d = deal.dataValues || deal;
    const escrowId = Number(d.escrow_id);
    const [attachments, payouts] = await Promise.all([listAttachments(escrowId), listDealPayouts(escrowId)]);
    const sellerCid = d.creator_role === "seller" ? d.creator_customer_id : d.counterparty_customer_id;
    const buyerCid = d.creator_role === "buyer" ? d.creator_customer_id : d.counterparty_customer_id;
    const targets: { role: "buyer" | "seller"; email: string; cid: number | null }[] = [];
    if (isRealCustomerEmail(sellerEmail)) targets.push({ role: "seller", email: sellerEmail, cid: sellerCid ?? null });
    if (isRealCustomerEmail(buyerEmail)) targets.push({ role: "buyer", email: buyerEmail, cid: buyerCid ?? null });
    for (const t of targets) {
      const doc = generateDealSummaryPdf({
        deal: d,
        buyerEmail,
        sellerEmail,
        attachments,
        legalName: legalName(),
        viewer: { role: t.role, email: t.email },
        payouts: (payouts as any[]).filter((p) => t.cid == null || Number(p.customer_id) === Number(t.cid)) as any,
      });
      const pdf = await pdfToBuffer(doc);
      await sendSafeDealDealInvoiceEmail(t.email, { escrow_id: d.escrow_id, title: d.title, deal_token: d.deal_token, outcome: d.outcome }, pdf, t.role);
    }
  } catch (e) {
    apiLogger.warn(`[SafeDeal] deal invoice email failed for deal ${deal?.escrow_id}: ${(e as Error).message}`);
  }
}
