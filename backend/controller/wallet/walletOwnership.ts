/**
 * Merchant payout-address ownership verification (Settings → Payout addresses →
 * "Verify with wallet"). Owner-only (router guard) — a teammate can never stamp
 * a payout address as verified.
 *
 *   POST /api/wallet/ownership/nonce   { wallet_id }            → { nonce, message, address, code, family, expires_at }
 *   POST /api/wallet/ownership/verify  { wallet_id, nonce, signature, wallet_name? } → { wallet_id, ownership_verified_at }
 */
import express from "express";
import jwt from "jsonwebtoken";
import successResponseHelper from "../../helper/successResponseHelper";
import errorResponseHelper from "../../helper/errorResponseHelper";
import { userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import { chainFamilyFor, consumeOwnershipNonce, issueOwnershipNonce, sameAddress, verifyOwnershipSignature } from "../../services/wallet/walletOwnership";
import { invalidateWalletCache } from "./walletShared";

interface TokenUser { user_id: number }
interface WalletRow { wallet_id: number; user_id: number; company_id: number | null; wallet_type: string; wallet_address: string; ownership_verified_at: Date | null }

async function loadWallet(req: express.Request, res: express.Response): Promise<WalletRow | null> {
  const wid = parseInt(String(req.body?.wallet_id ?? ""), 10);
  if (Number.isNaN(wid)) {
    errorResponseHelper(res, 400, "wallet_id is required.");
    return null;
  }
  const row = await userWalletModel.findOne({ where: { wallet_id: wid, currency_type: "CRYPTO" }, raw: true }) as unknown as WalletRow | null;
  if (!row || !row.wallet_address) {
    errorResponseHelper(res, 404, "Payout address not found.");
    return null;
  }
  return row;
}

const domainOf = (req: express.Request) => String(req.headers["x-forwarded-host"] || req.headers.host || "dynopay.com").split(",")[0].trim();

export const issueWalletOwnershipNonce = async (req: express.Request, res: express.Response) => {
  try {
    const user = jwt.decode(res.locals.token) as TokenUser;
    const w = await loadWallet(req, res);
    if (!w) return;
    if (!chainFamilyFor(w.wallet_type)) return errorResponseHelper(res, 400, "Wallet verification isn't available for this network yet.");
    const n = await issueOwnershipNonce(`user:${user.user_id}:w${w.wallet_id}`, {
      product: "Dynopay",
      address: w.wallet_address,
      code: w.wallet_type,
      purpose: "Confirm this address as a verified Dynopay payout address",
      domain: domainOf(req),
    });
    return successResponseHelper(res, 200, "Sign this message in your wallet.", { nonce: n.nonce, message: n.message, address: n.address, code: n.code, family: n.family, expires_at: n.expires_at });
  } catch (e: any) {
    walletLogger.error("[walletOwnership] nonce failed:", e);
    return errorResponseHelper(res, 500, "Could not start verification.");
  }
};

export const verifyWalletOwnership = async (req: express.Request, res: express.Response) => {
  try {
    const user = jwt.decode(res.locals.token) as TokenUser;
    const w = await loadWallet(req, res);
    if (!w) return;
    const { nonce, signature, wallet_name } = req.body || {};
    const rec = await consumeOwnershipNonce(`user:${user.user_id}:w${w.wallet_id}`, String(nonce || ""));
    if (!rec) return errorResponseHelper(res, 400, "This verification request expired — start again.");
    if (!sameAddress(rec.family, rec.address, w.wallet_address)) return errorResponseHelper(res, 409, "The saved address changed since verification started — start again.");
    const ok = await verifyOwnershipSignature(rec.family, rec.message, String(signature || ""), w.wallet_address);
    if (!ok) return errorResponseHelper(res, 400, "Signature doesn't match this payout address. Make sure the connected wallet is the one that owns it.");
    const now = new Date();
    const via = String(wallet_name || "").trim().slice(0, 60) || "wallet";
    await userWalletModel.update({ ownership_verified_at: now, ownership_verified_via: via }, { where: { wallet_id: w.wallet_id } });
    await invalidateWalletCache(w.user_id);
    walletLogger.info(`[walletOwnership] wallet ${w.wallet_id} (${w.wallet_type}) verified via ${via} by user ${user.user_id}`);
    return successResponseHelper(res, 200, "Payout address verified.", { wallet_id: w.wallet_id, ownership_verified_at: now.toISOString(), ownership_verified_via: via });
  } catch (e: any) {
    walletLogger.error("[walletOwnership] verify failed:", e);
    return errorResponseHelper(res, 500, "Verification failed. Please try again.");
  }
};
