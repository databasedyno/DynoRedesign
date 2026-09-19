/**
 * SafeDeal live funding via Dynopay's hosted checkout.
 *  - createFundingLink(deal): one payment link (SafeDeal brand) per deal for the buyer's quote.
 *  - onPaymentLinkPaid(): called by chain verification after a link is confirmed paid → deal funded.
 * Simulated (safe-mode) funding never touches this file.
 */
import { raw as envRaw } from "../../utils/config";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../../utils/loggers";
import { paymentLinkModel, userWalletModel, companyModel } from "../../models";
import escrowDealModel from "../../models/escrowDealModel";
import { setRedisItem } from "../../utils/redisInstance";
import { generatePaymentRef } from "../../controller/payment/paymentLinkController";
import { computeFeeBreakdown } from "../../controller/escrow/escrowShared";

const CRYPTO_TYPES = ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "SOL", "XRP", "RLUSD", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"];

export async function createFundingLink(deal: any, buyerEmail: string): Promise<{ ref: string; url: string; transaction_id: string; amount: number }> {
  if (deal.funding_link_ref) {
    return {
      ref: deal.funding_link_ref,
      url: `${(envRaw("CHECKOUT_URL") || "").trim().replace(/\/$/, "")}/pay?d=${deal.funding_link_ref}`,
      transaction_id: deal.funding_link_transaction_id,
      amount: Number(deal.funded_amount_usd || 0),
    };
  }
  const company: any = await companyModel.findByPk(deal.company_id);
  if (!company) throw new Error("SafeDeal brand not found.");
  const ownerUserId = Number(company.dataValues.user_id);
  const wallets = await userWalletModel.findAll({
    where: { company_id: deal.company_id, wallet_type: { [Op.in]: CRYPTO_TYPES }, wallet_address: { [Op.not]: null } } as any,
    attributes: ["wallet_type"],
  });
  const configured = [...new Set(wallets.map((w: any) => w.dataValues.wallet_type as string))];
  if (!configured.length) throw new Error("The SafeDeal brand has no crypto wallets configured for checkout.");
  const accepted = deal.accepted_coins
    ? String(deal.accepted_coins).split(",").map((c: string) => c.trim().toUpperCase()).filter((c: string) => configured.includes(c))
    : configured;
  const available = accepted.length ? accepted : configured;

  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, acceptedCoins: deal.accepted_coins });
  const ref = await generatePaymentRef();
  const checkoutBase = (envRaw("CHECKOUT_URL") || envRaw("SERVER_URL") || "").trim().replace(/\/$/, "");
  const transaction_id = crypto.randomUUID();
  const payload = {
    transaction_id,
    email: buyerEmail,
    allowedModes: "crypto",
    base_amount: breakdown.buyerPays,
    base_currency: String(deal.currency || "USD").toUpperCase(),
    user_id: ownerUserId,
    adm_id: ownerUserId,
    company_id: Number(deal.company_id),
    payment_link: `${checkoutBase}/pay?d=${ref}`,
    description: `SafeDeal escrow #${deal.escrow_id} — ${deal.title}`,
    expires_at: new Date(Date.now() + 7 * 86400000),
    callback_url: null,
    redirect_url: `${(envRaw("SAFEDEAL_URL") || `${checkoutBase}/safedeal`).replace(/\/$/, "")}/deal/${deal.deal_token}?funded=1`,
    webhook_url: null,
    fee_payer: "company",
    apply_tax: false,
    tax_inclusive: false,
    accepted_currencies: available.join(","),
    customer_name: null,
    link_type: "escrow",
  };
  const link: any = await paymentLinkModel.create(payload as any);
  await setRedisItem("customer-" + ref, {
    ...payload,
    pathType: "createLink",
    link_id: link.dataValues.link_id,
    available_currencies: available,
    all_configured_currencies: configured,
    escrow_id: deal.escrow_id,
    createdAt: new Date().toISOString(),
  });
  deal.funding_link_ref = ref;
  deal.funding_link_transaction_id = transaction_id;
  await deal.save();
  apiLogger.info(`[SafeDeal] funding link ${ref} created for escrow ${deal.escrow_id} (${breakdown.buyerPays} ${deal.currency})`);
  return { ref, url: payload.payment_link, transaction_id, amount: breakdown.buyerPays };
}

/** Chain-verification fan-out: a payment link was confirmed paid. Funds the matching deal (if any). */
export async function onPaymentLinkPaid(linkTransactionId: string, info: { paidUsd?: number; coin?: string; txHash?: string }): Promise<void> {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { funding_link_transaction_id: String(linkTransactionId) } });
    if (!deal) return;
    const { escrowEngine } = await import("../../controller/escrowController");
    await escrowEngine.actFundFromCheckout(deal, Number(info.paidUsd || deal.amount), String(info.coin || "USDT-TRC20"), String(info.txHash || ""));
    apiLogger.info(`[SafeDeal] escrow ${deal.escrow_id} funded via hosted checkout (${linkTransactionId})`);
  } catch (err) {
    apiLogger.error(`[SafeDeal] onPaymentLinkPaid failed for ${linkTransactionId}: ${(err as Error).message}`);
  }
}
