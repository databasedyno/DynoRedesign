/**
 * SafeDeal wallet integration endpoints (Reown AppKit):
 *   POST /api/safedeal/wallet/addresses/:id/verify-nonce      → sign-message for a saved cashout address
 *   POST /api/safedeal/wallet/addresses/:id/verify            → stamp ownership_verified_at when the signature matches
 *   POST /api/safedeal/deals/:token/funding/wallet-tx         → buyer's "paid with wallet" tx hash hint (Redis, 48h)
 */
import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import successResponseHelper from "../../helper/successResponseHelper";
import errorResponseHelper from "../../helper/errorResponseHelper";
import { apiLogger } from "../../utils/loggers";
import { setRedisItemWithTTL } from "../../utils/redisInstance";
import { chainFamilyFor, consumeOwnershipNonce, issueOwnershipNonce, sameAddress, verifyOwnershipSignature } from "../../services/wallet/walletOwnership";

interface SdSession { customer_id: number; company_id: number; email: string }
interface AddrRow { address_id: number; customer_id: number; payout_key: string; coin: string; network: string; address: string; label: string | null; ownership_verified_at: Date | null }

const sess = (res: express.Response) => res.locals.sd as SdSession;
const domainOf = (req: express.Request) => String(req.headers["x-forwarded-host"] || req.headers.host || "safedeal.sh").split(",")[0].trim();

async function loadAddress(req: express.Request, res: express.Response): Promise<AddrRow | null> {
  const id = Number(req.params.id);
  const rows = await sequelize.query<AddrRow>(
    `SELECT address_id, customer_id, payout_key, coin, network, address, label, ownership_verified_at
       FROM tbl_customer_payout_address WHERE address_id = :id AND customer_id = :cid AND removed_at IS NULL LIMIT 1`,
    { replacements: { id, cid: sess(res).customer_id }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) {
    errorResponseHelper(res, 404, "Saved address not found.");
    return null;
  }
  return rows[0];
}

export const sdAddressVerifyNonce = async (req: express.Request, res: express.Response) => {
  try {
    const a = await loadAddress(req, res);
    if (!a) return;
    if (!chainFamilyFor(a.payout_key)) return errorResponseHelper(res, 400, "Wallet verification isn't available for this network.");
    const n = await issueOwnershipNonce(`sdcust:${a.customer_id}:a${a.address_id}`, {
      product: "SafeDeal",
      address: a.address,
      code: a.payout_key,
      purpose: "Confirm this address as a verified SafeDeal cashout address",
      domain: domainOf(req),
    });
    return successResponseHelper(res, 200, "Sign this message in your wallet.", { nonce: n.nonce, message: n.message, address: n.address, code: n.code, family: n.family, expires_at: n.expires_at });
  } catch (e) {
    apiLogger.error(`[safedeal.addressVerifyNonce] ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not start verification.");
  }
};

export const sdAddressVerify = async (req: express.Request, res: express.Response) => {
  try {
    const a = await loadAddress(req, res);
    if (!a) return;
    const rec = await consumeOwnershipNonce(`sdcust:${a.customer_id}:a${a.address_id}`, String(req.body?.nonce || ""));
    if (!rec) return errorResponseHelper(res, 400, "This verification request expired — start again.");
    if (!sameAddress(rec.family, rec.address, a.address)) return errorResponseHelper(res, 409, "Address changed — start again.");
    const ok = await verifyOwnershipSignature(rec.family, rec.message, String(req.body?.signature || ""), a.address);
    if (!ok) return errorResponseHelper(res, 400, "Signature doesn't match this address. Connect the wallet that owns it and try again.");
    const via = String(req.body?.wallet_name || "").trim().slice(0, 60) || "wallet";
    const rows = await sequelize.query<AddrRow>(
      `UPDATE tbl_customer_payout_address SET ownership_verified_at = NOW(), ownership_verified_via = :via
        WHERE address_id = :id AND customer_id = :cid RETURNING *`,
      { replacements: { id: a.address_id, cid: a.customer_id, via }, type: QueryTypes.SELECT }
    );
    return successResponseHelper(res, 200, "Address verified — it's yours.", rows[0]);
  } catch (e) {
    apiLogger.error(`[safedeal.addressVerify] ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Verification failed. Please try again.");
  }
};

/** Buyer paid from a connected wallet: remember the tx hash next to the funding address (support/diagnostics; the ledger stays the source of truth). */
export const sdFundingWalletTx = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.params.token || "");
    const { tx_hash, coin, address, wallet_name, from_address } = req.body || {};
    const hash = String(tx_hash || "").trim();
    if (!/^[A-Za-z0-9]{20,128}$/.test(hash) || !/^[a-f0-9]{16,96}$/i.test(token)) return errorResponseHelper(res, 400, "Invalid transaction reference.");
    const rec = { deal_token: token, tx_hash: hash, coin: String(coin || "").slice(0, 24), address: String(address || "").slice(0, 128), from_address: String(from_address || "").slice(0, 128), wallet_name: String(wallet_name || "").slice(0, 60), customer_id: sess(res).customer_id, at: new Date().toISOString() };
    await setRedisItemWithTTL(`sd:wallettx:${token}`, rec, 48 * 3600);
    apiLogger.info(`[safedeal.fundingWalletTx] deal ${token.slice(0, 8)}… ${rec.coin} tx ${hash.slice(0, 12)}… via ${rec.wallet_name || "wallet"}`);
    return successResponseHelper(res, 200, "Transaction noted — waiting for network confirmations.", { tx_hash: hash });
  } catch (e) {
    apiLogger.error(`[safedeal.fundingWalletTx] ${(e as Error).message}`);
    return errorResponseHelper(res, 500, "Could not record the transaction.");
  }
};
