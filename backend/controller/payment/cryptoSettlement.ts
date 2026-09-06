/**
 * Crypto settlement & on-chain verification chain — FACADE
 *
 * R2 refactor (2026-08): extracted verbatim into per-function modules under
 * controller/payment/settlement/ (strangler pattern — zero behavior change).
 * Named-export surface is identical to pre-refactor, so paymentController.ts
 * keeps working unchanged.
 *
 * Modules:
 *   settleTransaction — settleCryptoTransaction (atomic settlement + fees + payout)
 *   verifyPayment     — verifyCryptoPayment (buyer-facing verification endpoint)
 *   receipt           — downloadReceipt (PDF receipt for settled payments)
 *   chainVerification — cryptoVerification (on-chain detection across all chains)
 *
 * NOTE: settleTransaction.ts and chainVerification.ts each contain ONE giant
 * function (1.0K / 1.6K lines) — intra-function decomposition is deliberately
 * deferred until the money path has contract tests (R8), per the strangler rule
 * "never big-bang". They are grandfathered in the 500-line budget check.
 */

export { settleCryptoTransaction } from "./settlement/settleTransaction";
export { verifyCryptoPayment } from "./settlement/verifyPayment";
export { downloadReceipt, createReceiptLink } from "./settlement/receipt";
export { getPublicReceipt, getPublicReceiptPdf } from "./settlement/publicReceipt";
export { checkoutStatusStream, tokenFromQuery } from "./settlement/checkoutStream";
export { cryptoVerification } from "./settlement/chainVerification";
