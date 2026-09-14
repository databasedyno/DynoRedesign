/**
 * Idempotency-Key middleware (API Architecture Review §5.2, P0)
 *
 * Makes merchant POSTs safe to retry. A client that times out and retries a
 * `createPayment` / `cryptoPayment` / `embed/session` today creates a SECOND
 * payment (and reserves a second pool address). With this middleware, sending
 * the same `Idempotency-Key` header returns the ORIGINAL response instead.
 *
 * Contract (Stripe-compatible):
 *   - No `Idempotency-Key` header  → completely inert (zero behaviour change).
 *   - Same key + same request body → replays the first response
 *                                    (`Idempotent-Replay: true` header).
 *   - Same key + DIFFERENT body    → 409 `idempotency_key_reused`.
 *   - Key still processing          → 409 `idempotency_request_in_progress`.
 *
 * Storage: Redis. A `processing` lock is taken atomically (SET NX) so two
 * concurrent identical requests can't both create a payment; the final 2xx
 * response is then cached for 24h. Non-2xx responses release the lock so the
 * caller can retry. Any Redis hiccup fails OPEN (never blocks a payment).
 *
 * Mount AFTER the auth middleware so `res.locals.apiKeyData.company_id` is set
 * (keys are scoped per company, so two merchants can't collide on a key).
 */
import express from "express";
import crypto from "crypto";
import { redis } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";
import { sendError } from "../helper/apiResponse";

const IDEM_FINAL_TTL_SEC = 24 * 60 * 60; // cached response lifetime
const IDEM_LOCK_TTL_SEC = 120; // processing-lock lifetime (max handler time)
const MAX_KEY_LEN = 255;

interface StoredIdem {
  state: "processing" | "done";
  requestHash: string;
  statusCode?: number;
  body?: unknown;
  createdAt: number;
}

const hashRequest = (routeId: string, body: unknown): string =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify({ route: routeId, body: body ?? {} }))
    .digest("hex");

const idempotencyMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const rawKey = req.headers["idempotency-key"];
    // Opt-in: no header → do nothing at all.
    if (!rawKey || typeof rawKey !== "string") {
      next();
      return;
    }

    const idemKey = rawKey.trim();
    if (!idemKey || idemKey.length > MAX_KEY_LEN) {
      sendError(res, {
        status: 400,
        message: `Idempotency-Key must be a non-empty string of at most ${MAX_KEY_LEN} characters.`,
        code: "invalid_idempotency_key",
        param: "Idempotency-Key",
        extra: { code: "invalid_idempotency_key" },
      });
      return;
    }

    const companyId =
      (res.locals?.apiKeyData?.company_id as number | undefined) ?? "anon";
    const routeId = `${req.method}:${req.baseUrl || ""}${req.path || req.url}`;
    const requestHash = hashRequest(routeId, req.body);
    const redisKey = `idem:${companyId}:${idemKey}`;

    // Atomically take a processing lock. "OK" => we own it; null => it exists.
    const lockValue = JSON.stringify({
      state: "processing",
      requestHash,
      createdAt: Date.now(),
    } as StoredIdem);
    const acquired = await redis.set(redisKey, lockValue, {
      NX: true,
      EX: IDEM_LOCK_TTL_SEC,
    });

    if (acquired !== "OK") {
      // A record already exists — replay, or reject on mismatch.
      const existingRaw = await redis.get(redisKey);
      let existing: StoredIdem | null = null;
      try {
        existing = existingRaw ? (JSON.parse(existingRaw) as StoredIdem) : null;
      } catch {
        existing = null;
      }

      if (!existing) {
        // Rare race (lock expired between SET NX and GET) — just proceed.
        next();
        return;
      }
      if (existing.requestHash !== requestHash) {
        sendError(res, {
          status: 409,
          message:
            "This Idempotency-Key was already used with a different request. Use a new key for a new request.",
          code: "idempotency_key_reused",
          extra: { code: "idempotency_key_reused" },
        });
        return;
      }
      if (existing.state === "processing") {
        sendError(res, {
          status: 409,
          message:
            "A request with this Idempotency-Key is still being processed. Retry in a moment.",
          code: "idempotency_request_in_progress",
          extra: { code: "idempotency_request_in_progress" },
        });
        return;
      }
      // Completed earlier — replay the stored response verbatim.
      apiLogger.info(
        `[Idempotency] replay company=${companyId} key=${idemKey} route=${routeId}`
      );
      res.setHeader("Idempotent-Replay", "true");
      res.status(existing.statusCode || 200).json(existing.body);
      return;
    }

    // We own the lock — capture the eventual JSON response and persist it.
    const originalJson = res.json.bind(res);
    let captured = false;
    res.json = (body: unknown) => {
      if (!captured) {
        captured = true;
        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          const record: StoredIdem = {
            state: "done",
            requestHash,
            statusCode,
            body,
            createdAt: Date.now(),
          };
          redis
            .set(redisKey, JSON.stringify(record), { EX: IDEM_FINAL_TTL_SEC })
            .catch(() => undefined);
        } else {
          // Failed → drop the lock so the caller can safely retry.
          redis.del(redisKey).catch(() => undefined);
        }
      }
      return originalJson(body);
    };

    next();
  } catch (e) {
    // Idempotency infra must NEVER block a payment — fail open.
    apiLogger.error("[Idempotency] middleware error (failing open):", e);
    next();
  }
};

export default idempotencyMiddleware;
