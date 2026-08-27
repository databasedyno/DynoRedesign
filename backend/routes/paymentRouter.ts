import express, { RequestHandler } from "express";
import { paymentController } from "../controller";
import { walletController } from "../controller";
import {
  authMiddleware,
  customerAuthMiddleware,
  linkMiddleware,
  uploadImage,
} from "../middleware";
import { paymentRateLimiter } from "../middleware/rateLimitMiddleware";

const paymentRouter = express.Router();

// Public encrypt-payload endpoint for checkout flow (no auth required)
// Moved from /wallet/encrypt-payload which was behind authMiddleware
paymentRouter.post("/encrypt-payload", walletController.encryptPayload);

paymentRouter.post("/getData", paymentRateLimiter, paymentController.getData);

// Read-only checkout metadata for SSR link previews (OG tags)
paymentRouter.get("/meta", paymentRateLimiter, paymentController.getPaymentMeta);

// Public creator vanity page profile (dynopay.com/{handle} → SSR fetch)
paymentRouter.get("/creator/:handle", paymentRateLimiter, paymentController.getCreatorProfile);

// Public creator page analytics (30-day tip chart + top supporters).
// Honours the creator's public_analytics_enabled toggle — returns enabled:false
// with empty data if hidden. Session 2026-08-05.
paymentRouter.get("/creator/:handle/analytics", paymentRateLimiter, paymentController.getCreatorPublicAnalytics);

// Donation campaigns: public endpoint for a donor to start a contribution
// (spawns a child payment session; checkout continues with the returned ref)
paymentRouter.post("/startDonation", paymentRateLimiter, paymentController.startDonation);

// Creator Support Widget: public endpoint for a supporter to start a tip / coffee
// (lazily creates the creator's hidden tip-jar parent, spawns a contribution child)
paymentRouter.post("/tip", paymentRateLimiter, paymentController.startTip);

// Campaign cover image upload (merchant dashboard, authenticated)
paymentRouter.post(
  "/uploadCampaignImage",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  paymentController.uploadCampaignImage
);

paymentRouter.post(
  "/addPayment",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.addPayment
);

// Refund address (Phase 1 — CleanCheckoutV2)
// Customer supplies a refund destination in case they send the wrong asset.
// Requires the customer session JWT that /pay/getData handed out.
paymentRouter.post(
  "/setRefundAddress",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.setRefundAddress
);

// Optional buyer receipt email (public checkout "Email me a receipt").
// Attaches a recipient to the checkout session so the post-payment receipt
// email fires for anonymous payers. Same customer-session auth + rate limit.
paymentRouter.post(
  "/setCustomerEmail",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.setCustomerEmail
);

paymentRouter.post(
  "/createCryptoPayment",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.createCryptoPayment
);

paymentRouter.post(
  "/authStep",
  customerAuthMiddleware,
  paymentController.authStep
);

paymentRouter.post(
  "/verifyPayment",
  customerAuthMiddleware,
  paymentController.verifyPayment
);

paymentRouter.post(
  "/verifyCryptoPayment",
  customerAuthMiddleware,
  paymentController.verifyCryptoPayment
);

// Buyer-facing PDF receipt for a CONFIRMED payment (checkout "paid" card).
// Same customer-session auth + rate limit as the rest of the checkout flow.
paymentRouter.post(
  "/receipt",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.downloadReceipt
);

paymentRouter.post(
  "/confirmPayment",
  customerAuthMiddleware,
  paymentController.confirmPayment
);
paymentRouter.post(
  "/getCurrencyRates",
  paymentRateLimiter,
  customerAuthMiddleware,
  paymentController.getCurrencyRates
);

// Public endpoint for blockchain network fees (used by checkout pages)
paymentRouter.get(
  "/network-fees",
  paymentController.getNetworkFees
);

// Public endpoint to calculate payment amount with fees
paymentRouter.post(
  "/calculate-payment",
  paymentController.calculatePaymentAmount
);

// Public endpoint for fee calculator - shows fee breakdown for checkout
// POST /api/pay/calculateFees
// Body: { amount: number, cryptocurrency: string }
// Returns: platform_fee, blockchain_fee, total_fees, net_to_merchant
paymentRouter.post(
  "/calculateFees",
  paymentController.calculateCheckoutFees
);

// Get configured currencies for checkout (customer auth required)
paymentRouter.get(
  "/configured-currencies",
  customerAuthMiddleware,
  paymentController.getConfiguredCurrenciesForCheckout
);

paymentRouter.get(
  "/getBalance",
  customerAuthMiddleware,
  paymentController.getBalance
);

paymentRouter.get(
  "/getPaymentLinks",
  authMiddleware,
  paymentController.getPaymentLinks
);

paymentRouter.get(
  "/links/:id",
  authMiddleware,
  paymentController.getPaymentLinkById
);

paymentRouter.put(
  "/links/:id",
  authMiddleware,
  paymentController.updatePaymentLink
);

paymentRouter.post(
  "/createPaymentLink",
  authMiddleware,
  linkMiddleware,
  paymentController.createPaymentLink
);

paymentRouter.delete(
  "/deletePaymentLink/:id",
  authMiddleware,
  paymentController.deletePaymentLink
);

// Get fee preview with user's referral discount
paymentRouter.get(
  "/fee-preview",
  authMiddleware,
  paymentController.getFeePreview
);

// Get configured currencies for a company (merchant dashboard)
// Used when creating/editing payment links to show available currencies
paymentRouter.get(
  "/company-currencies/:company_id",
  authMiddleware,
  paymentController.getCompanyConfiguredCurrencies
);

// ═══════════════════════════════════════════════════════════════════════════
// CROWDFUNDING V2 — Phase 3.2 (tiers + updates + donor wall + replies)
// ═══════════════════════════════════════════════════════════════════════════
import * as crowdfunding from "../controller/payment/crowdfundingController";

// Tiers — merchant CRUD (owner-only, authMiddleware) + public list (no auth)
paymentRouter.post("/campaign/:linkId/tiers", authMiddleware, crowdfunding.createTier);
paymentRouter.patch("/tier/:tierId", authMiddleware, crowdfunding.updateTier);
paymentRouter.delete("/tier/:tierId", authMiddleware, crowdfunding.deleteTier);
paymentRouter.get("/campaign/:refOrId/tiers", crowdfunding.listTiers);

// Updates feed — merchant CRUD + public list
paymentRouter.post("/campaign/:linkId/updates", authMiddleware, crowdfunding.createUpdate);
paymentRouter.patch("/update/:updateId", authMiddleware, crowdfunding.updateUpdate);
paymentRouter.delete("/update/:updateId", authMiddleware, crowdfunding.deleteUpdate);
paymentRouter.get("/campaign/:refOrId/updates", crowdfunding.listUpdates);

// Donor wall — public paginated feed of contributions
paymentRouter.get("/campaign/:refOrId/wall", crowdfunding.getDonorWall);

// Organizer reply on a specific contribution row
paymentRouter.patch("/contribution/:contribId/reply", authMiddleware, crowdfunding.setContributionReply);

export default paymentRouter;
