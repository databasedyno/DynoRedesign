/**
 * Sandbox "Simulate payment" — test-mode only.
 *
 * Drives a SANDBOX (dpk_test_) payment through pending → confirmed → settled and
 * fires the same signed merchant webhooks (payment.pending / .confirmed /
 * .settled) as a real payment — WITHOUT any real crypto, KMS or on-chain
 * broadcast. This is the Stripe/Coinbase-style test-mode simulator.
 *
 * SAFETY — this must NEVER touch real money:
 *   Gate 1: the authenticated API key must be `environment='development'`.
 *   Gate 2: the TARGET transaction must itself be stamped environment='development'.
 *           A live payment (or a legacy row with a null environment) is refused,
 *           so a shared company_id can never let a test key settle a real payment.
 *   Gate 3: idempotent — a payment already in `settled` is a no-op.
 * It only writes the transaction status + emits webhooks; it calls no settlement,
 * custody or broadcast code path.
 */
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { deliverMerchantWebhook } from "../../services/outbox/merchantWebhookOutbox";
import { parseState, toExternalStatus } from "../../services/paymentStateMachine";

export interface SandboxSimResult {
  status: number;
  error?: string;
  data?: Record<string, unknown>;
}

interface ApiKeyData {
  company_id?: number;
  environment?: string | null;
}

const nowIso = (): string => new Date().toISOString();

export async function runSandboxSimulation(
  apiKeyData: ApiKeyData | undefined,
  paymentId: string
): Promise<SandboxSimResult> {
  const companyId = apiKeyData?.company_id;
  if (!companyId) return { status: 401, error: "Invalid or missing API key." };

  // Gate 1 — test key only.
  if (apiKeyData?.environment !== "development") {
    return {
      status: 403,
      error: "Payment simulation is only available with a test (dpk_test_) API key.",
    };
  }
  if (!paymentId || paymentId === "undefined" || paymentId === "null") {
    return { status: 400, error: "Please provide a valid payment_id." };
  }

  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT id, company_id, environment, status,
            base_amount, base_currency, crypto_amount, crypto_currency,
            transaction_reference, webhook_url, webhook_secret, callback_url
       FROM tbl_user_transaction
      WHERE id = $1 AND company_id = $2
      LIMIT 1`,
    { bind: [paymentId, companyId], type: QueryTypes.SELECT }
  );
  const row = rows[0];
  if (!row) return { status: 404, error: "Payment not found for this account." };

  // Gate 2 (CRITICAL) — sandbox transactions only. Refuses live payments and
  // legacy rows (null environment) so this can never settle real money.
  if (String(row.environment) !== "development") {
    return {
      status: 403,
      error:
        "Only sandbox (test-mode) payments can be simulated. This payment was not created with a test key.",
    };
  }

  // Gate 3 — idempotency: don't re-drive an already-settled payment.
  const parsed = parseState(String(row.status || ""));
  const currentExternal = parsed ? toExternalStatus(parsed) : String(row.status || "");
  if (currentExternal === "settled") {
    return {
      status: 200,
      data: {
        payment_id: paymentId,
        already_settled: true,
        payment_status: "settled",
        note: "Payment is already settled — nothing to simulate.",
      },
    };
  }

  const cryptoAmount = row.crypto_amount != null ? Number(row.crypto_amount) : 0;
  const currency = String(row.crypto_currency || row.base_currency || "");
  const baseAmount = row.base_amount != null ? Number(row.base_amount) : null;
  const baseCurrency = String(row.base_currency || "USD");
  const txRef = String(row.transaction_reference || paymentId);
  const synthTx = "SIMULATED-" + crypto.randomBytes(16).toString("hex");

  // Webhook routing: prefer the durable copy persisted on the transaction row;
  // resolveWebhookTargets also recovers it from tbl_user_transaction via `id`.
  const customerData: Record<string, unknown> = {
    id: paymentId,
    company_id: companyId,
    base_amount: baseAmount,
    base_currency: baseCurrency,
    webhook_url: row.webhook_url || null,
    webhook_secret: row.webhook_secret || null,
    callback_url: row.callback_url || null,
    fee_payer: "company",
  };

  const results: Array<Record<string, unknown>> = [];

  // 1) payment.pending — crypto "detected".
  const r1 = await deliverMerchantWebhook(customerData, {
    event: "payment.pending",
    payment_id: paymentId,
    transaction_reference: txRef,
    status: "pending",
    payment_status: "pending",
    amount: cryptoAmount,
    currency,
    base_amount: baseAmount,
    base_currency: baseCurrency,
    simulated: true,
    created_at: nowIso(),
  });
  results.push({ event: "payment.pending", mode: r1.mode, delivered: r1.success });

  await sequelize.query(
    `UPDATE tbl_user_transaction SET status = 'confirmed', "updatedAt" = NOW()
      WHERE id = $1 AND company_id = $2`,
    { bind: [paymentId, companyId], type: QueryTypes.UPDATE }
  );

  // 2) payment.confirmed — confirmed on-chain (before settlement).
  const r2 = await deliverMerchantWebhook(customerData, {
    event: "payment.confirmed",
    payment_id: paymentId,
    transaction_reference: synthTx,
    status: "completed",
    payment_status: "confirmed",
    amount: cryptoAmount,
    currency,
    base_amount: baseAmount,
    base_currency: baseCurrency,
    simulated: true,
    created_at: nowIso(),
    completed_at: nowIso(),
  });
  results.push({ event: "payment.confirmed", mode: r2.mode, delivered: r2.success });

  // status -> 'completed' (maps to external 'settled'); stamp synthetic hashes.
  await sequelize.query(
    `UPDATE tbl_user_transaction
        SET status = 'completed',
            received_amount = $3,
            incoming_tx_hash = COALESCE(incoming_tx_hash, $4),
            outgoing_tx_hash = COALESCE(outgoing_tx_hash, $4),
            "updatedAt" = NOW()
      WHERE id = $1 AND company_id = $2`,
    { bind: [paymentId, companyId, cryptoAmount, synthTx], type: QueryTypes.UPDATE }
  );

  // 3) payment.settled — terminal; funds "forwarded" (simulated, no broadcast).
  const r3 = await deliverMerchantWebhook(customerData, {
    event: "payment.settled",
    payment_type: "direct_api",
    address: null,
    txId: synthTx,
    transaction_reference: synthTx,
    amount: cryptoAmount,
    currency,
    payment_id: paymentId,
    status: "settled",
    payment_status: "settled",
    base_amount: baseAmount,
    base_currency: baseCurrency,
    fee_payer: "company",
    merchant_amount: cryptoAmount,
    admin_fee_amount: 0,
    settlement_tx_id: synthTx,
    simulated: true,
    created_at: nowIso(),
    settled_at: nowIso(),
  });
  results.push({ event: "payment.settled", mode: r3.mode, delivered: r3.success });

  const anyDelivered = r1.success || r2.success || r3.success;
  apiLogger.info(
    `[SandboxSim] Simulated payment ${paymentId} (company ${companyId}) → settled; ` +
      `webhooks pending/confirmed/settled dispatched (delivered=${anyDelivered}).`
  );

  return {
    status: 200,
    data: {
      payment_id: paymentId,
      simulated: true,
      final_status: "settled",
      settlement_tx_id: synthTx,
      events_fired: ["payment.pending", "payment.confirmed", "payment.settled"],
      webhook_results: results,
      note: anyDelivered
        ? "Sandbox payment advanced to settled and webhooks were dispatched (signed when a webhook secret is configured)."
        : "Sandbox payment advanced to settled. No webhook endpoint is configured for this test key, so no webhook was sent.",
    },
  };
}

export default { runSandboxSimulation };
