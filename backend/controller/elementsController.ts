/**
 * Elements Inline Widget controller — Phase 3 (b) Elements
 *
 * Endpoints (mounted at /api/embed/public/elements, pk + Origin auth):
 *   POST   /elements/intent          — create a payment intent
 *   POST   /elements/select-currency — pick a currency, reserve address
 *   GET    /elements/status          — poll intent status
 *
 * These endpoints let a merchant render a NATIVE crypto pay UI in their own
 * DOM (via embed.js `elements.create('crypto')`) — no iframe, no redirect.
 * Auth is the publishable key + Origin allow-list (see
 * middleware/publishableKeyMiddleware.ts).
 *
 * Design notes:
 *   - Intent state lives in Redis (`elements-intent:<pi_id>` — setRedisItem
 *     auto-appends `:json`).
 *   - select-currency is IDEMPOTENT — a second call with the SAME currency
 *     returns the already-reserved address. Switching currency after payment
 *     is DETECTED is rejected.
 *   - Trust: browser status is UI-only. Merchant fulfillment must rely on the
 *     server-to-server webhook signed with X-DynoPay-Signature (same contract
 *     as the hosted checkout).
 */

import type express from "express";
import crypto from "crypto";
import { apiModel, userTransactionModel } from "../models";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";
import {
  getAvailableCurrencies,
  findOrRecreateCustomer,
} from "../routes/merchantApiRouter";
import { findOrCreateEmailCustomer } from "../middleware/legacy/customerResolver";
import { isValidBuyerEmail } from "../utils/transactionSource";
import * as merchantPoolService from "../services/merchantPoolService";
import { generateQRCodeWithLogo } from "../utils/qrCodeWithLogo";
import currencyConvert from "../helper/currencyConvert";
import type { PublishableKeyRow } from "../middleware/publishableKeyMiddleware";

const ELEMENTS_INTENT_TTL_SEC = 24 * 60 * 60; // 24h — matches hosted checkout expiry norms

/** Currencies backed by the merchant address pool (same as cryptoCheckout.ts). */
const MERCHANT_POOL_CRYPTO_TYPES = [
  "BTC", "ETH", "LTC", "DOGE", "TRX", "BCH",
  "USDT-TRC20", "USDT-ERC20", "USDC-ERC20",
  "SOL", "XRP", "RLUSD", "RLUSD-ERC20",
  "POLYGON", "USDT-POLYGON",
];

const genIntentId = (): string => "pi_" + crypto.randomBytes(20).toString("hex");
const genClientSecret = (): string => "elm_" + crypto.randomBytes(28).toString("hex");
const intentRedisKey = (intentId: string): string => `elements-intent:${intentId}`;

type ElementsStatus =
  | "requires_currency"
  | "awaiting_payment"
  | "processing"
  | "succeeded"
  | "expired"
  | "failed";

interface ElementsIntent {
  intent_id: string;
  client_secret: string;
  company_id: number;
  adm_id: number;
  pk_id: number;
  base_currency: string;
  base_amount: number;
  amount: number;
  available_currencies: string[];
  all_configured_currencies: string[];
  webhook_url: string | null;
  webhook_secret: string | null;
  redirect_uri: string | null;
  meta_data: string | null;
  status: ElementsStatus;
  selected_currency: string | null;
  payment_id: string | null;
  address: string | null;
  crypto_amount: number | null;
  destination_tag: number | null;
  qr_code: string | null;
  temp_id: number | null;
  expires_at: string;
  created_at: string;
  origin: string;
  customer_id: number | null;
}

/* ------------------------------------------------------------------ */
/* POST /api/embed/public/elements/intent                              */
/* ------------------------------------------------------------------ */
export const createElementsIntent = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const pk = res.locals.publishableKey as PublishableKeyRow;
    const origin = res.locals.pkOrigin as string;

    const {
      amount,
      currency,
      redirect_uri,
      meta_data,
      customer_email,
      customer_name,
    } = (req.body || {}) as {
      amount?: number;
      currency?: string;
      redirect_uri?: string;
      meta_data?: Record<string, unknown>;
      customer_email?: string;
      customer_name?: string;
    };

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 5) {
      res.status(400).json({ success: false, message: "amount must be a number ≥ 5" });
      return;
    }
    if (amount > pk.max_amount) {
      res.status(400).json({
        success: false,
        message: `amount ${amount} exceeds this publishable key's max_amount (${pk.max_amount}). Use the SECRET key server-side for larger amounts.`,
      });
      return;
    }

    // Locate the active secret key for webhook / base_currency inheritance.
    const activeSecret = await apiModel.findOne({
      where: { company_id: pk.company_id, status: "active", environment: pk.environment },
    });
    if (!activeSecret) {
      res.status(400).json({
        success: false,
        message: `Company has no active ${pk.environment} secret key — cannot create intent.`,
      });
      return;
    }
    const secretData = activeSecret.dataValues as {
      company_id: number;
      user_id: number;
      base_currency?: string;
      webhook_url?: string | null;
      webhook_secret?: string | null;
    };

    // Configured wallets
    const allConfigured = await getAvailableCurrencies(secretData.user_id, pk.company_id);
    if (allConfigured.length === 0) {
      res.status(400).json({
        success: false,
        message: "No crypto wallets configured for this company.",
      });
      return;
    }

    // Effective set = intersect(configured, MERCHANT_POOL_CRYPTO_TYPES, pk.allowed_currencies, request.currency)
    let allowedByPk: string[] | null = null;
    if (pk.allowed_currencies) {
      try {
        allowedByPk = JSON.parse(pk.allowed_currencies) as string[];
      } catch {
        allowedByPk = null;
      }
    }
    let effective = allConfigured.filter((c) => MERCHANT_POOL_CRYPTO_TYPES.includes(c));
    if (Array.isArray(allowedByPk) && allowedByPk.length > 0) {
      effective = effective.filter((c) => allowedByPk!.includes(c));
    }
    if (currency && typeof currency === "string") {
      const cUp = currency.toUpperCase().trim();
      if (!effective.includes(cUp)) {
        res.status(400).json({
          success: false,
          message: `Currency ${cUp} is not allowed for this key. Allowed: ${effective.join(", ") || "(none)"}`,
        });
        return;
      }
      effective = [cUp];
    }
    if (effective.length === 0) {
      res.status(400).json({
        success: false,
        message: "No supported currencies available for this publishable key.",
      });
      return;
    }

    // Buyer customer: if the merchant passed a real `customer_email`, attach a
    // REAL customer (dedup by company+email) so the buyer gets a receipt and the
    // merchant sees the real address. Otherwise mint a synthetic placeholder
    // (unchanged behaviour). Invalid emails fall through to the placeholder —
    // a typo must never block a payment.
    const providedEmail =
      typeof customer_email === "string" ? customer_email.trim().toLowerCase() : "";
    const providedName =
      typeof customer_name === "string" ? customer_name.trim().slice(0, 120) : null;

    let customerData: { customer_id: number } | null = null;
    if (isValidBuyerEmail(providedEmail)) {
      customerData = await findOrCreateEmailCustomer(
        pk.company_id,
        providedEmail,
        providedName,
        secretData.base_currency || "USD"
      );
    }
    if (!customerData) {
      const email = `elements-buyer-${pk.pub_key_id}-${Date.now()}@dynopay.internal`;
      customerData = await findOrRecreateCustomer(
        crypto.randomUUID(),
        email,
        pk.company_id,
        secretData.base_currency || "USD"
      );
    }

    const intent_id = genIntentId();
    const client_secret = genClientSecret();
    const now = new Date();
    const expires = new Date(now.getTime() + ELEMENTS_INTENT_TTL_SEC * 1000);

    const intent: ElementsIntent = {
      intent_id,
      client_secret,
      company_id: pk.company_id,
      adm_id: secretData.user_id,
      pk_id: pk.pub_key_id,
      base_currency: secretData.base_currency || "USD",
      base_amount: amount,
      amount,
      available_currencies: effective,
      all_configured_currencies: allConfigured,
      webhook_url: secretData.webhook_url || null,
      webhook_secret: secretData.webhook_secret || null,
      redirect_uri: redirect_uri || null,
      meta_data: meta_data ? JSON.stringify(meta_data) : null,
      status: "requires_currency",
      selected_currency: null,
      payment_id: null,
      address: null,
      crypto_amount: null,
      destination_tag: null,
      qr_code: null,
      temp_id: null,
      expires_at: expires.toISOString(),
      created_at: now.toISOString(),
      origin,
      customer_id: customerData.customer_id,
    };

    await setRedisItemWithTTL(intentRedisKey(intent_id), intent, ELEMENTS_INTENT_TTL_SEC);

    apiLogger.info(
      `[Elements] Intent created intent_id=${intent_id} company=${pk.company_id} pk=${pk.pub_key_id} amount=${amount} currencies=${effective.length}`
    );

    res.status(200).json({
      success: true,
      message: "Intent created",
      data: {
        intent_id,
        client_secret,
        status: "requires_currency",
        available_currencies: effective,
        amount,
        base_currency: intent.base_currency,
        expires_at: intent.expires_at,
      },
    });
  } catch (err) {
    apiLogger.error(`[Elements] intent error: ${(err as Error).message}`);
    res.status(500).json({ success: false, message: "Failed to create intent" });
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/embed/public/elements/select-currency                    */
/* ------------------------------------------------------------------ */
export const selectElementsCurrency = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const pk = res.locals.publishableKey as PublishableKeyRow;
    const { intent_id, currency } = (req.body || {}) as {
      intent_id?: string;
      currency?: string;
    };

    if (!intent_id || typeof intent_id !== "string" || !intent_id.startsWith("pi_")) {
      res.status(400).json({
        success: false,
        message: "intent_id is required and must start with 'pi_'",
      });
      return;
    }
    if (!currency || typeof currency !== "string") {
      res.status(400).json({ success: false, message: "currency is required" });
      return;
    }
    const cUp = currency.toUpperCase().trim();

    const intent = (await getRedisItem(intentRedisKey(intent_id))) as ElementsIntent | null;
    if (!intent) {
      res.status(404).json({ success: false, message: "Intent not found or expired" });
      return;
    }
    // Cross-company isolation — do NOT reveal existence
    if (intent.company_id !== pk.company_id) {
      res.status(404).json({ success: false, message: "Intent not found or expired" });
      return;
    }

    // Expiry
    if (new Date(intent.expires_at).getTime() <= Date.now()) {
      intent.status = "expired";
      await setRedisItemWithTTL(intentRedisKey(intent_id), intent, ELEMENTS_INTENT_TTL_SEC);
      res.status(410).json({
        success: false,
        message: "Intent expired",
        data: { intent_id, status: "expired" },
      });
      return;
    }

    if (!intent.available_currencies.includes(cUp)) {
      res.status(400).json({
        success: false,
        message: `Currency ${cUp} is not in available_currencies for this intent. Available: ${intent.available_currencies.join(", ")}`,
      });
      return;
    }

    // Idempotency — same currency selected again → return cached details
    if (intent.status === "awaiting_payment" && intent.selected_currency === cUp && intent.address) {
      res.status(200).json({
        success: true,
        message: "Currency already selected (idempotent)",
        data: {
          intent_id,
          status: "awaiting_payment",
          currency: cUp,
          address: intent.address,
          qr_code: intent.qr_code,
          amount: intent.crypto_amount,
          amount_fiat: intent.amount,
          base_currency: intent.base_currency,
          payment_id: intent.payment_id,
          destination_tag: intent.destination_tag || undefined,
          expires_at: intent.expires_at,
        },
      });
      return;
    }

    // Do not allow currency switch after payment progression
    if (intent.status === "processing" || intent.status === "succeeded") {
      res.status(400).json({
        success: false,
        message: `Intent already in status '${intent.status}' — cannot change currency`,
      });
      return;
    }

    // Reserve a merchant pool address for this currency
    const paymentId = crypto.randomUUID();
    const reserved = (await merchantPoolService.reserveAddress(
      cUp,
      paymentId,
      intent.adm_id,
      intent.company_id,
      intent.amount
    )) as {
      dataValues: {
        wallet_address: string;
        temp_address_id: number;
        destination_tag?: number;
        cached_qr_code?: string;
      };
    };

    const address = reserved.dataValues.wallet_address;
    const temp_id = reserved.dataValues.temp_address_id;
    const destination_tag = reserved.dataValues.destination_tag || null;
    const cachedQR = reserved.dataValues.cached_qr_code;

    // Fiat → crypto amount conversion
    let cryptoAmount = 0;
    try {
      const rateList = await currencyConvert({
        currency: [cUp],
        sourceCurrency: intent.base_currency,
        amount: intent.amount,
        fixedDecimal: false,
      });
      if (rateList && rateList[0] && Number.isFinite(Number((rateList[0] as { amount?: unknown }).amount))) {
        cryptoAmount = Number((rateList[0] as { amount: number }).amount);
      }
    } catch (e) {
      apiLogger.warn(`[Elements] fiat→crypto conversion failed: ${(e as Error).message}`);
    }

    // QR code — reuse cached if present
    let qr_code: string | undefined = cachedQR;
    if (!qr_code) {
      const qrPayload = destination_tag ? `${address}?dt=${destination_tag}` : address;
      try {
        qr_code = await generateQRCodeWithLogo(qrPayload, cUp, 400);
      } catch (e) {
        apiLogger.warn(`[Elements] QR generation failed: ${(e as Error).message}`);
      }
    }

    // Create a pending transaction row so the webhook processor can find it
    userTransactionModel
      .create({
        id: paymentId,
        user_id: intent.adm_id,
        payment_mode: "CRYPTO",
        base_amount: intent.amount,
        base_currency: cUp,
        transaction_type: "CREDIT",
        status: "pending",
        customer_id: intent.customer_id,
        company_id: intent.company_id,
        crypto_currency: cUp,
        crypto_amount: cryptoAmount,
      })
      .catch((err: unknown) => {
        apiLogger.warn(`[Elements] Deferred transaction create failed: ${(err as Error).message}`);
      });

    // Persist intent state
    intent.status = "awaiting_payment";
    intent.selected_currency = cUp;
    intent.payment_id = paymentId;
    intent.address = address;
    intent.crypto_amount = cryptoAmount;
    intent.destination_tag = destination_tag;
    intent.qr_code = qr_code || null;
    intent.temp_id = temp_id;
    await setRedisItemWithTTL(intentRedisKey(intent_id), intent, ELEMENTS_INTENT_TTL_SEC);

    apiLogger.info(
      `[Elements] Currency selected intent_id=${intent_id} currency=${cUp} address=${address} payment_id=${paymentId}`
    );

    res.status(200).json({
      success: true,
      message: "Currency selected, address reserved",
      data: {
        intent_id,
        status: "awaiting_payment",
        currency: cUp,
        address,
        qr_code,
        amount: cryptoAmount,
        amount_fiat: intent.amount,
        base_currency: intent.base_currency,
        payment_id: paymentId,
        destination_tag: destination_tag || undefined,
        expires_at: intent.expires_at,
      },
    });
  } catch (err) {
    apiLogger.error(
      `[Elements] select-currency error: ${(err as Error).message}`,
      err
    );
    res.status(500).json({ success: false, message: "Failed to select currency" });
  }
};

/* ------------------------------------------------------------------ */
/* GET /api/embed/public/elements/status?intent_id=pi_...              */
/* ------------------------------------------------------------------ */
export const getElementsStatus = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const pk = res.locals.publishableKey as PublishableKeyRow;
    const intent_id = (
      (req.query && req.query.intent_id) ||
      (req.body && (req.body as { intent_id?: string }).intent_id) ||
      ""
    ).toString();

    if (!intent_id || !intent_id.startsWith("pi_")) {
      res.status(400).json({
        success: false,
        message: "intent_id is required (starts with 'pi_')",
      });
      return;
    }

    const intent = (await getRedisItem(intentRedisKey(intent_id))) as ElementsIntent | null;
    if (!intent) {
      res.status(404).json({ success: false, message: "Intent not found or expired" });
      return;
    }
    if (intent.company_id !== pk.company_id) {
      res.status(404).json({ success: false, message: "Intent not found or expired" });
      return;
    }

    // Refresh live status from DB when a payment record exists
    let liveStatus: ElementsStatus = intent.status;
    let txHash: string | undefined;
    if (intent.payment_id) {
      const txRow = await userTransactionModel.findOne({ where: { id: intent.payment_id } });
      if (txRow) {
        const dv = txRow.dataValues as {
          status?: string;
          transaction_id?: string;
        };
        const dbStatus = String(dv.status || "").toLowerCase();
        txHash = dv.transaction_id || undefined;
        if (dbStatus === "completed" || dbStatus === "successful" || dbStatus === "confirmed") {
          liveStatus = "succeeded";
        } else if (dbStatus === "underpaid" || dbStatus === "partial" || dbStatus === "processing") {
          liveStatus = "processing";
        } else if (dbStatus === "failed" || dbStatus === "expired" || dbStatus === "cancelled") {
          liveStatus = "failed";
        }
      }
    }

    // Expiry override only if no payment has been detected yet
    if (
      liveStatus !== "succeeded" &&
      liveStatus !== "processing" &&
      new Date(intent.expires_at).getTime() <= Date.now()
    ) {
      liveStatus = "expired";
    }

    // Persist status upgrade
    if (liveStatus !== intent.status) {
      intent.status = liveStatus;
      await setRedisItemWithTTL(intentRedisKey(intent_id), intent, ELEMENTS_INTENT_TTL_SEC);
    }

    res.status(200).json({
      success: true,
      data: {
        intent_id,
        status: liveStatus,
        currency: intent.selected_currency,
        address: intent.address,
        amount: intent.crypto_amount,
        amount_fiat: intent.amount,
        base_currency: intent.base_currency,
        payment_id: intent.payment_id,
        tx_hash: txHash,
        destination_tag: intent.destination_tag || undefined,
        expires_at: intent.expires_at,
      },
    });
  } catch (err) {
    apiLogger.error(`[Elements] status error: ${(err as Error).message}`);
    res.status(500).json({ success: false, message: "Failed to get status" });
  }
};

// Exposed for direct in-process tests
export const __internal = { intentRedisKey, MERCHANT_POOL_CRYPTO_TYPES };
