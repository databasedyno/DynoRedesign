import express from "express";
import { walletController } from "../controller";
import { requireCompanyOwnerBy } from "../middleware/teamPermissionMiddleware";
import { requireStepUp } from "../middleware/requireStepUp";
import { auditMutations } from "../utils/activityLog";
import { userWalletModel } from "../models";
import { checkAddressSanity, getWalletSecurityStatus } from "../controller/wallet/walletSecurity";

const walletRouter = express.Router();

// Every payout-wallet mutation requires an active step-up session for the
// `wallet` scope (unified /api/stepup engine; 10-min, scope-isolated).
const stepUp = requireStepUp("wallet");

// OWNER-ONLY guard resolver for payout-wallet mutations. Prefer an explicit
// company_id in the body; otherwise resolve it from the target wallet_id
// (params.id on the PUT routes, body.wallet_id on the OTP routes). Changing the
// settlement/payout wallet is an OWNER_ONLY_ACTION — a teammate can never alter
// the owner's payout destination. Unresolved -> no-op (controller still scopes by user).
const resolveWalletCompany = async (req: express.Request): Promise<number | null> => {
  const bodyCompany = parseInt(String(req.body?.company_id ?? ""), 10);
  if (!Number.isNaN(bodyCompany)) return bodyCompany;
  const wid = parseInt(String(req.params?.id ?? req.body?.wallet_id ?? ""), 10);
  if (Number.isNaN(wid)) return null;
  const w = await userWalletModel.findOne({ where: { wallet_id: wid } });
  return w
    ? Number((w as unknown as { dataValues: { company_id: number | null } }).dataValues.company_id)
    : null;
};

// Audit payout-wallet mutations to the Team Activity Log (same company resolver).
const auditWallet = auditMutations("wallet", { resolveCompany: resolveWalletCompany });

// ============================================
// WALLET ADDRESS CRUD OPERATIONS (Merchant-facing)
// All CUD operations require an active `wallet` step-up session (stepUp).
// ============================================

// READ - Get wallet addresses (no step-up required)
walletRouter.get("/getWallet", walletController.getWallet);
walletRouter.get("/getWalletAddresses", walletController.getWalletAddresses);
// Reuse wallets across companies (new-company onboarding + Wallets page)
walletRouter.get("/reusable-wallets", walletController.getReusableWallets);
walletRouter.post("/copyWalletAddresses", walletController.copyWalletAddresses);

// Pre-save address sanity check (network-mismatch + never-received warning).
walletRouter.post("/address-sanity", checkAddressSanity);
// Read-only: wallet-change freeze state (plan 3.4 Wallet security page).
walletRouter.get("/security/status", getWalletSecurityStatus);

// CREATE - Add wallet address (2-step: validate on-chain, then save)
walletRouter.post("/validateWalletAddress", stepUp, walletController.validateWallet);
walletRouter.post("/verifyOtp", stepUp, walletController.verifyOtp);
// ALIAS: Frontend compatibility - /wallet/verifyCode -> /wallet/verifyOtp
walletRouter.post("/verifyCode", stepUp, walletController.verifyOtp);
// Alternative: Direct add (for merchants)
walletRouter.post("/addWalletAddress", requireCompanyOwnerBy(resolveWalletCompany), stepUp, auditWallet, walletController.addWalletAddress);

// UPDATE - Edit wallet address / name
walletRouter.put("/address/:id", requireCompanyOwnerBy(resolveWalletCompany), stepUp, auditWallet, walletController.editWalletAddress);
// ALIAS: Frontend compatibility - PUT /wallet/updateWallet/:id -> PUT /wallet/address/:id
walletRouter.put("/updateWallet/:id", requireCompanyOwnerBy(resolveWalletCompany), stepUp, auditWallet, walletController.editWalletAddress);

// UPDATE - Update wallet in main payment system (address / name / tag)
walletRouter.post("/wallet/update", requireCompanyOwnerBy(resolveWalletCompany), stepUp, auditWallet, walletController.updateWalletWithOTP);

// DELETE - Delete wallet from main payment system
walletRouter.post("/wallet/delete/verify", requireCompanyOwnerBy(resolveWalletCompany), stepUp, auditWallet, walletController.deletePaymentWalletWithOTP);

// Bulk mutate (WalletManagerModal) — owner-only + active step-up session.
walletRouter.post(
  "/batch",
  requireCompanyOwnerBy(resolveWalletCompany),
  stepUp,
  auditWallet,
  walletController.batchWalletMutate,
);

// ============================================
// TRANSACTION & OTHER WALLET OPERATIONS
// ============================================
walletRouter.post("/getWalletTransactions/:id", walletController.getWalletTransactions);
walletRouter.post("/getAllTransactions", walletController.getAllTransactions);
walletRouter.get("/transaction/:id", walletController.getTransactionDetails);
walletRouter.post("/transactions/export", walletController.exportTransactions);
walletRouter.post("/transactions/:id/request-topup", walletController.requestTopup);

walletRouter.post("/addFunds", walletController.addFunds);
walletRouter.post("/encrypt-payload", walletController.encryptPayload);
walletRouter.post("/authStep", walletController.authStep);
walletRouter.post("/verifyPayment", walletController.verifyPayment);
walletRouter.post("/confirmPayment", walletController.confirmPayment);
walletRouter.post("/verifyCryptoPayment", walletController.verifyCryptoPayment);
walletRouter.post("/getCurrencyRates", walletController.getCurrencyRates);
walletRouter.post("/estimateFees", walletController.estimateFees);
walletRouter.get("/network-fees", walletController.getNetworkFees);
walletRouter.post("/calculate-payment", walletController.calculatePaymentAmount);
walletRouter.post("/sendConfirmationOTP", walletController.sendConfirmationOTP);
walletRouter.post("/withdrawAssets", requireStepUp("payout"), walletController.withdrawAssets);
walletRouter.post("/exchangeCreate", walletController.exchangeCreate);
walletRouter.post("/confirmExchange", walletController.confirmExchange);
walletRouter.post("/getUserAnalytics", walletController.getUserAnalytics);
walletRouter.get("/getExchange", walletController.getExchange);
walletRouter.get("/configured-currencies", walletController.getConfiguredCurrencies);

export default walletRouter;
