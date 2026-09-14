import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { successResponseHelper } from "../../helper";
import { getChainMeta, explorerTxUrl } from "../../services/refund/refundChains";

/**
 * Public, verifiable landing proof endpoints (no auth).
 *
 *  GET /api/status/recent-settlements — anonymized "live" feed for the landing.
 *    Exposes ONLY coin symbol + network + timestamp. NEVER a merchant/buyer
 *    identity, address, amount or tx hash. Signals real, current activity.
 *
 *  GET /api/status/onchain-proof — a few REAL settlements from Dynopay's OWN
 *    store (owner decision 2026-06: never a customer transaction), each with a
 *    public block-explorer link so anyone can confirm the money moved on-chain.
 *
 * base_currency on tbl_user_transaction holds the checkout coin code
 * (e.g. "USDT-TRC20", "ETH"); we map it to a display symbol + network label.
 */

/** Dynopay's own store (user_id 1 / company_id 1 — the account that owns tx 937). Overridable via env. */
const OWN_STORE_USER_ID = Number(process.env.LANDING_PROOF_STORE_USER_ID || 1);

const COIN_META: Record<string, { symbol: string; network: string }> = {
  BTC: { symbol: "BTC", network: "Bitcoin" },
  ETH: { symbol: "ETH", network: "Ethereum" },
  LTC: { symbol: "LTC", network: "Litecoin" },
  DOGE: { symbol: "DOGE", network: "Dogecoin" },
  BCH: { symbol: "BCH", network: "Bitcoin Cash" },
  TRX: { symbol: "TRX", network: "Tron" },
  SOL: { symbol: "SOL", network: "Solana" },
  XRP: { symbol: "XRP", network: "XRP Ledger" },
  POLYGON: { symbol: "POL", network: "Polygon" },
  "USDT-TRC20": { symbol: "USDT", network: "Tron" },
  "USDT-ERC20": { symbol: "USDT", network: "Ethereum" },
  "USDT-POLYGON": { symbol: "USDT", network: "Polygon" },
  "USDC-ERC20": { symbol: "USDC", network: "Ethereum" },
  RLUSD: { symbol: "RLUSD", network: "XRP Ledger" },
  "RLUSD-ERC20": { symbol: "RLUSD", network: "Ethereum" },
};

const metaFor = (base: string | null): { symbol: string; network: string } => {
  const key = String(base || "").trim().toUpperCase();
  return COIN_META[key] || { symbol: key || "CRYPTO", network: "" };
};

type FeedCache = { at: number; body: Record<string, unknown> } | null;
let feedCache: FeedCache = null;
let proofCache: FeedCache = null;
const FEED_MS = 45_000;
const PROOF_MS = 10 * 60_000;
/** Feed density: everything from the last few hours (up to RECENT_MAX) so peak traffic reads as busy;
 *  quiet hours backfill with older settlements down to the requested floor. */
const RECENT_WINDOW_HOURS = Number(process.env.LANDING_FEED_WINDOW_HOURS || 6);
const RECENT_MAX = 24;

/** GET /api/status/recent-settlements — anonymized live feed (coin + network + time only). */
export const getRecentSettlements = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(12, Math.max(3, Number(req.query.limit) || 8));
    if (feedCache && Date.now() - feedCache.at < FEED_MS) {
      res.set("Cache-Control", "public, max-age=30");
      return successResponseHelper(res, 200, "Recent settlements", feedCache.body);
    }
    type Row = { base_currency: string | null; createdAt: string };
    const recent = await sequelize.query<Row>(
      `SELECT base_currency, "createdAt"
         FROM tbl_user_transaction
        WHERE status = 'successful' AND "createdAt" > NOW() - make_interval(hours => :hours)
        ORDER BY "createdAt" DESC
        LIMIT :max`,
      { replacements: { hours: RECENT_WINDOW_HOURS, max: RECENT_MAX }, type: QueryTypes.SELECT }
    );
    const backfill =
      recent.length >= limit
        ? []
        : await sequelize.query<Row>(
            `SELECT base_currency, "createdAt"
               FROM tbl_user_transaction
              WHERE status = 'successful'
                AND "createdAt" <= NOW() - make_interval(hours => :hours)
                AND "createdAt" > NOW() - INTERVAL '180 days'
              ORDER BY "createdAt" DESC
              LIMIT :limit`,
            { replacements: { hours: RECENT_WINDOW_HOURS, limit: limit - recent.length }, type: QueryTypes.SELECT }
          );
    const settlements = [...recent, ...backfill].map((r) => {
      const meta = metaFor(r.base_currency);
      return { symbol: meta.symbol, network: meta.network, at: new Date(r.createdAt).toISOString() };
    });
    const body = { settlements, recent_count: recent.length, window_hours: RECENT_WINDOW_HOURS, checked_at: new Date().toISOString() };
    feedCache = { at: Date.now(), body };
    res.set("Cache-Control", "public, max-age=30");
    successResponseHelper(res, 200, "Recent settlements", body);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/** GET /api/status/onchain-proof — a few REAL, verifiable settlements from Dynopay's own store. */
export const getOnchainProof = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(6, Math.max(2, Number(req.query.limit) || 4));
    if (proofCache && Date.now() - proofCache.at < PROOF_MS) {
      res.set("Cache-Control", "public, max-age=300");
      return successResponseHelper(res, 200, "On-chain proof", proofCache.body);
    }
    // Most recent settlement per chain (distinct base_currency) from the own store, with a real hash.
    const rows = await sequelize.query<{ base_currency: string | null; incoming_tx_hash: string; createdAt: string }>(
      `SELECT DISTINCT ON (base_currency) base_currency, incoming_tx_hash, "createdAt"
         FROM tbl_user_transaction
        WHERE status = 'successful'
          AND user_id = :uid
          AND incoming_tx_hash IS NOT NULL AND incoming_tx_hash <> ''
        ORDER BY base_currency, "createdAt" DESC`,
      { replacements: { uid: OWN_STORE_USER_ID }, type: QueryTypes.SELECT }
    );
    const proofs = rows
      .map((r) => {
        const meta = metaFor(r.base_currency);
        const chain = getChainMeta(r.base_currency);
        const explorerUrl = chain ? explorerTxUrl(chain, r.incoming_tx_hash) : null;
        if (!explorerUrl) return null;
        return {
          symbol: meta.symbol,
          network: meta.network,
          txHash: r.incoming_tx_hash,
          explorerUrl,
          at: new Date(r.createdAt).toISOString(),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
    const body = { proofs, checked_at: new Date().toISOString() };
    proofCache = { at: Date.now(), body };
    res.set("Cache-Control", "public, max-age=300");
    successResponseHelper(res, 200, "On-chain proof", body);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default { getRecentSettlements, getOnchainProof };
