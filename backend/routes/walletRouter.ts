import express from "express";
import { walletController } from "../controller";
import { requireCompanyOwnerBy } from "../middleware/teamPermissionMiddleware";
import { auditMutations } from "../utils/activityLog";
import { userWalletModel } from "../models";
import { requireWalletSudo } from "../controller/wallet/walletSudo";

const walletRouter = express.Router();

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
// All CUD operations require OTP verification
// ============================================

// READ - Get wallet addresses (No OTP required)
walletRouter.get("/getWallet", walletController.getWallet);
walletRouter.get("/getWalletAddresses", walletController.getWalletAddresses);
// Reuse wallets across companies (new-company onboarding + Wallets page)
walletRouter.get("/reusable-wallets", walletController.getReusableWallets);
walletRouter.post("/copyWalletAddresses", walletController.copyWalletAddresses);

// CREATE - Add wallet address (2-step OTP flow)
// Step 1: Validate address and send OTP
walletRouter.post("/validateWalletAddress", walletController.validateWallet);
// Step 2: Verify OTP and complete creation
walletRouter.post("/verifyOtp", walletController.verifyOtp);
// ALIAS: Frontend compatibility - /wallet/verifyCode -> /wallet/verifyOtp
walletRouter.post("/verifyCode", walletController.verifyOtp);
// Alternative: Direct add (for merchants, no OTP)
walletRouter.post("/addWalletAddress", requireCompanyOwnerBy(resolveWalletCompany), auditWallet, walletController.addWalletAddress);

// UPDATE - Edit wallet address (OTP is issued by /validateWalletAddress and
// verified inline in editWalletAddress; the old /address/send-otp step is unused).
walletRouter.put("/address/:id", requireCompanyOwnerBy(resolveWalletCompany), auditWallet, walletController.editWalletAddress);
// ALIAS: Frontend compatibility - PUT /wallet/updateWallet/:id -> PUT /wallet/address/:id
walletRouter.put("/updateWallet/:id", requireCompanyOwnerBy(resolveWalletCompany), auditWallet, walletController.editWalletAddress);

// DELETE - the merchant delete flow lives on /wallet/delete/* (see below).

// UPDATE - Update wallet in main payment system (2-step OTP flow)
walletRouter.post("/wallet/update/send-otp", walletController.sendUpdateWalletOTP);
walletRouter.post("/wallet/update", requireCompanyOwnerBy(resolveWalletCompany), auditWallet, walletController.updateWalletWithOTP);

// DELETE WITH OTP - Delete wallet from main payment system (2-step OTP flow)
walletRouter.post("/wallet/delete/send-otp", walletController.sendDeletePaymentWalletOTP);
walletRouter.post("/wallet/delete/verify", requireCompanyOwnerBy(resolveWalletCompany), auditWallet, walletController.deletePaymentWalletWithOTP);

// ============================================
// FULL PACKAGE — 10-minute security session (sudo) + bulk wallet management.
// One OTP unlocks a 10-min window authorising many add/edit/delete ops.
// ADDITIVE: the single-action OTP routes above are unchanged.
// ============================================
walletRouter.get("/sudo/status", walletController.getWalletSudoStatus);
walletRouter.post("/sudo/request-otp", walletController.requestWalletSudoOtp);
walletRouter.post("/sudo/verify-otp", walletController.verifyWalletSudoOtp);
walletRouter.post("/sudo/revoke", walletController.revokeWalletSudo);
// Bulk mutate — owner-only + requires an active sudo session.
walletRouter.post(
  "/batch",
  requireCompanyOwnerBy(resolveWalletCompany),
  requireWalletSudo,
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
walletRouter.post("/withdrawAssets", walletController.withdrawAssets);
walletRouter.post("/exchangeCreate", walletController.exchangeCreate);
walletRouter.post("/confirmExchange", walletController.confirmExchange);
walletRouter.post("/getUserAnalytics", walletController.getUserAnalytics);
walletRouter.get("/getExchange", walletController.getExchange);
walletRouter.get("/configured-currencies", walletController.getConfiguredCurrencies);

export default walletRouter;
