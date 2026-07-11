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

// Donation campaigns: public endpoint for a donor to start a contribution
// (spawns a child payment session; checkout continues with the returned ref)
paymentRouter.post("/startDonation", paymentRateLimiter, paymentController.startDonation);

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

export default paymentRouter;
