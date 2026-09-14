/**
 * Payment test hook — GUARDED, single-purpose, OFF by default.
 *
 * Simulates the "payment confirmed → customer receipt email" step WITHOUT any
 * real crypto, background job, or payment session. It exists so the confirm
 * receipt email + browser-notification path can be verified end-to-end against
 * ONE throwaway inbox while the pod stays in SAFE MODE.
 *
 * Safety gates (all must pass):
 *   1. Disabled unless PAYMENT_TEST_HOOK_SECRET is set in the environment.
 *      When unset the route responds 404 — it is invisible in normal operation
 *      and in production (where the secret is never set).
 *   2. Requires header `x-test-secret` to exactly match PAYMENT_TEST_HOOK_SECRET.
 *   3. Actual delivery is still governed by mailTransporter — with
 *      DISABLE_OUTBOUND_EMAIL=true the email only goes out if the recipient is
 *      in EMAIL_TEST_ALLOWLIST. So even if the secret leaked, mail can only ever
 *      reach an explicitly allow-listed address.
 *
 * It writes NOTHING to the database and touches no payment state.
 */
import express from "express";
import { raw as envRaw } from "../utils/config";
import { successResponseHelper, errorResponseHelper } from "../helper";
import { sendCustomerPaymentConfirmationEmail } from "../services/email/paymentEmails";
import { apiLogger } from "../utils/loggers";

const paymentTestHookRouter = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

paymentTestHookRouter.post("/confirm-email", async (req: express.Request, res: express.Response) => {
  const secret = envRaw("PAYMENT_TEST_HOOK_SECRET");
  // Gate 1: disabled entirely unless the secret env var is configured.
  if (!secret) {
    return errorResponseHelper(res, 404, "Not found");
  }
  // Gate 2: require the matching secret header.
  const provided = req.headers["x-test-secret"];
  if (!provided || String(provided) !== String(secret)) {
    return errorResponseHelper(res, 403, "Forbidden");
  }

  const {
    email,
    merchant,
    amount,
    currency,
    description,
    cryptoAmount,
    cryptoCurrency,
    lang,
  } = (req.body || {}) as Record<string, unknown>;

  const to = String(email || "").trim();
  if (!to || !EMAIL_RE.test(to)) {
    return errorResponseHelper(res, 400, "A valid 'email' is required.");
  }

  const now = new Date();
  const txId = `TEST-${now.getTime()}`;

  // Will this actually leave the pod? (mirrors mailTransporter's own logic so
  // the response can tell the caller whether Brevo was really hit.)
  const disable = envRaw("DISABLE_OUTBOUND_EMAIL") === "true";
  const allow = String(envRaw("EMAIL_TEST_ALLOWLIST") || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const willSend = !disable || allow.includes(to.toLowerCase());

  try {
    await sendCustomerPaymentConfirmationEmail(
      to,
      null,
      String(merchant || "The Dev Store"),
      String(amount ?? "20"),
      String(currency || "USD"),
      txId,
      String(description || "Simulated payment confirmation (test hook)"),
      now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      String(cryptoAmount ?? "0.40707496"),
      String(cryptoCurrency || "LTC"),
      txId,
      String(lang || "en")
    );

    apiLogger.info(`[test-hook] confirm-email -> to=${to} willSend=${willSend} tx=${txId}`);
    return successResponseHelper(
      res,
      200,
      willSend
        ? "Confirmation receipt email dispatched (recipient allow-listed)."
        : "Handler ran, but delivery was suppressed (recipient not in EMAIL_TEST_ALLOWLIST).",
      { transactionId: txId, dispatched: willSend, recipient: to }
    );
  } catch (e: unknown) {
    const err = e as { message?: string };
    apiLogger.error("[test-hook] confirm-email failed:", err?.message);
    return errorResponseHelper(res, 500, err?.message || "Failed to send confirmation email.");
  }
});

export default paymentTestHookRouter;
