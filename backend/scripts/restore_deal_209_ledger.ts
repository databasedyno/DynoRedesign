/**
 * Re-post the BUYER-side wallet ledger rows of the restored deal #209 that were lost in the
 * 2026-09-20 cascade deletion (the buyer's customer row was removed, taking its ledger with it;
 * only the seller's `escrow:209:settle:release` credit survived). Uses the real ledger service, so
 * amounts come from the deal's locked fee breakdown and every row is idempotent by reference.
 *   npx ts-node --transpile-only scripts/restore_deal_209_ledger.ts           (dry run)
 *   npx ts-node --transpile-only scripts/restore_deal_209_ledger.ts --apply
 */
import "dotenv/config";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import escrowDealModel from "../models/escrowDealModel";
import { dealFeeBreakdown, computeSettlementAmounts } from "../controller/escrow/escrowShared";
import { recordFundingReceived, settleToWallets } from "../services/safedeal/safedealEscrowLedger";
import { brandWalletTotals, getBalances } from "../services/safedeal/safedealWallet";

const ESCROW_ID = Number(process.env.ESCROW_ID || 209);
const APPLY = process.argv.includes("--apply");

(async () => {
  const deal: any = await escrowDealModel.findOne({ where: { escrow_id: ESCROW_ID } });
  if (!deal) throw new Error(`deal ${ESCROW_ID} not found`);
  const b = dealFeeBreakdown(deal);
  const amounts = computeSettlementAmounts(b, deal.outcome, deal.split_percent_seller);
  const funded = Number(deal.custody_amount_stable ?? deal.funded_amount_usd ?? b.buyerPays);
  const buyerCid = deal.creator_role === "buyer" ? deal.creator_customer_id : deal.counterparty_customer_id;
  const existing = await sequelize.query<{ transaction_reference: string; customer_id: number; paid_amount: string }>(
    `SELECT transaction_reference, customer_id, paid_amount FROM tbl_customer_transaction WHERE transaction_reference LIKE :p ORDER BY transaction_id`,
    { replacements: { p: `escrow:${ESCROW_ID}:%` }, type: QueryTypes.SELECT }
  );
  console.log(`deal #${ESCROW_ID} ${deal.status}/${deal.outcome} funded ${funded} · seller ${amounts.sellerAmount} · fee ${b.escrowFee} · exchange ${b.exchangeFeeUsd} · costs ${b.passThroughCosts}`);
  console.log("existing ledger refs:", existing.map((r) => `${r.transaction_reference} (cust ${r.customer_id}, ${r.paid_amount})`));
  console.log("buyer before:", await getBalances(buyerCid));
  if (!APPLY) { console.log("DRY RUN — would post funding + settlement rows for the buyer (missing refs only)."); await sequelize.close(); return; }

  await recordFundingReceived(deal, funded, deal.funding_method || "dynopay_api");
  await settleToWallets(deal, { sellerAmount: amounts.sellerAmount, buyerRefund: amounts.buyerRefund }, b);
  // The rows belong to the day the deal was funded/settled — date them accordingly and mark them restored.
  await sequelize.query(
    `UPDATE tbl_customer_transaction SET "createdAt" = :at, "updatedAt" = :at, meta = COALESCE(meta,'{}'::jsonb) || '{"restored": true}'::jsonb
      WHERE transaction_reference = :ref AND "createdAt" > NOW() - interval '10 minutes'`,
    { replacements: { at: new Date(deal.funded_at), ref: `escrow:${ESCROW_ID}:funding` }, type: QueryTypes.UPDATE }
  );
  await sequelize.query(
    `UPDATE tbl_customer_transaction SET "createdAt" = :at, "updatedAt" = :at, meta = COALESCE(meta,'{}'::jsonb) || '{"restored": true}'::jsonb
      WHERE transaction_reference LIKE :p AND "createdAt" > NOW() - interval '10 minutes'`,
    { replacements: { at: new Date(deal.completed_at || deal.outcome_authorized_at), p: `escrow:${ESCROW_ID}:settle:%` }, type: QueryTypes.UPDATE }
  );
  const after = await sequelize.query<{ transaction_reference: string; customer_id: number; transaction_type: string; paid_amount: string; createdAt: string }>(
    `SELECT transaction_reference, customer_id, transaction_type, paid_amount, "createdAt" FROM tbl_customer_transaction WHERE transaction_reference LIKE :p ORDER BY "createdAt", transaction_id`,
    { replacements: { p: `escrow:${ESCROW_ID}:%` }, type: QueryTypes.SELECT }
  );
  console.table(after);
  console.log("buyer after:", await getBalances(buyerCid));
  console.log("brand totals:", await brandWalletTotals(Number(deal.company_id)));
  await sequelize.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
