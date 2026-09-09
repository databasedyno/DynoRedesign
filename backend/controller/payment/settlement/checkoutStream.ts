/**
 * GET /api/pay/stream?address=<addr>[&destination_tag=<tag>]&token=<customer jwt>
 *
 * Buyer-facing Server-Sent Events stream for live checkout status.
 * EventSource cannot set headers, so the customer-session JWT travels as
 * `?token=` and is lifted into `Authorization` by `tokenFromQuery` before
 * customerAuthMiddleware runs (see paymentRouter).
 *
 * Events:
 *   ready  — { status, address }  current status snapshot (from Redis) on connect
 *   status — { status, address, at, ... } pushed by the webhook pipeline
 *   ping   — keepalive (from sseService)
 *
 * The client treats every event as a *hint* and re-calls verifyCryptoPayment.
 */
import express from "express";
import jwt from "jsonwebtoken";
import { getRedisItem } from "../../../utils/redisInstance";
import { getCryptoRedisKey } from "../../../services/merchantPool/merchantPoolConfig";
import { attachCheckoutStream, CheckoutStreamStatus } from "../../../services/checkoutStreamService";
import { cronLogger } from "../../../utils/loggers";

const ADDRESS_RE = /^[A-Za-z0-9:_-]{6,128}$/;

/** Map the Redis `crypto-<address>` status onto the public stream vocabulary. */
export const mapRedisStatus = (raw: unknown): CheckoutStreamStatus => {
  switch (String(raw || "").toLowerCase()) {
    case "successful":
    case "confirmed":
    case "completed":
    case "payout_complete":
      return "confirmed";
    case "processing":
    case "detected":
      return "processing";
    case "pending":
      return "pending";
    case "underpaid":
      return "underpaid";
    case "failed":
      return "failed";
    default:
      return "waiting";
  }
};

/**
 * Compute the public checkout-stream snapshot from a Redis `crypto-<address>`
 * record. Redis `status:"pending"` means "invoice created, awaiting the
 * on-chain deposit" until a real transaction is seen (txId attached). Mapping
 * that bare 'pending' to the public 'pending' made the checkout show
 * "Payment detected — confirming…" the instant the page connected, before any
 * funds were sent. Mirror verifyCryptoPayment: pending-without-txId is
 * 'waiting'. Exported for unit testing.
 */
export const snapshotFromRedis = (
  data: { status?: unknown; txId?: unknown } | null | undefined
): CheckoutStreamStatus => {
  const rawStatus = String(data?.status || "").toLowerCase();
  const hasTxId =
    data?.txId !== undefined && data?.txId !== null && String(data?.txId).trim() !== "";
  if (rawStatus === "pending" && !hasTxId) return "waiting";
  return mapRedisStatus(data?.status);
};

export const checkoutStatusStream = async (req: express.Request, res: express.Response) => {
  const address = String(req.query.address || "").trim();
  const tagRaw = req.query.destination_tag ? String(req.query.destination_tag) : "";
  const destinationTag = tagRaw && /^\d{1,12}$/.test(tagRaw) ? Number(tagRaw) : null;

  if (!address || !ADDRESS_RE.test(address)) {
    return res.status(400).json({ status: false, message: "A valid payment address is required." });
  }

  // Ownership: the customer session (from the JWT) must be paying to this address.
  // Sessions created before an address was chosen have no active_crypto_address —
  // in that case we still allow the stream (status hints carry no sensitive data).
  try {
    const session = jwt.decode(res.locals.token) as { ref?: string } | null;
    if (session?.ref) {
      const customerSession = await getRedisItem(`customer-${session.ref}`);
      const active = customerSession?.active_crypto_address?.address as string | undefined;
      if (active && active.toLowerCase() !== address.toLowerCase()) {
        cronLogger.info(`[checkoutStream] address mismatch for session ${session.ref}`);
        return res.status(403).json({ status: false, message: "This payment does not belong to your session." });
      }
    }
  } catch (err) {
    cronLogger.info("[checkoutStream] session lookup error:", err);
  }

  // Snapshot of the current state so the tab can sync immediately on (re)connect.
  let snapshot: CheckoutStreamStatus = "waiting";
  try {
    const key = destinationTag ? getCryptoRedisKey(address, destinationTag) : `crypto-${address}`;
    const data = await getRedisItem(key);
    snapshot = snapshotFromRedis(data);
  } catch {
    /* keep "waiting" */
  }

  // Disable proxy buffering / compression for this response (nginx / DO ingress).
  res.setHeader("X-Accel-Buffering", "no");
  attachCheckoutStream(res, address, destinationTag);
  try {
    res.write(`event: ready\ndata: ${JSON.stringify({ status: snapshot, address, at: new Date().toISOString() })}\n\n`);
  } catch {
    /* client already gone */
  }
};

/**
 * Lift `?token=` into the Authorization header so the shared customer auth
 * middleware can validate EventSource connections (which can't set headers).
 */
export const tokenFromQuery = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (!req.headers.authorization && typeof req.query.token === "string" && req.query.token.length > 0) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};
