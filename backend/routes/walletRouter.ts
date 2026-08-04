import express from "express";
import { walletController } from "../controller";

const walletRouter = express.Router();

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
walletRouter.post("/addWalletAddress", walletController.addWalletAddress);

// UPDATE - Edit wallet address (OTP is issued by /validateWalletAddress and
// verified inline in editWalletAddress; the old /address/send-otp step is unused).
walletRouter.put("/address/:id", walletController.editWalletAddress);
// ALIAS: Frontend compatibility - PUT /wallet/updateWallet/:id -> PUT /wallet/address/:id
walletRouter.put("/updateWallet/:id", walletController.editWalletAddress);

// DELETE - the merchant delete flow lives on /wallet/delete/* (see below).

// UPDATE - Update wallet in main payment system (2-step OTP flow)
walletRouter.post("/wallet/update/send-otp", walletController.sendUpdateWalletOTP);
walletRouter.post("/wallet/update", walletController.updateWalletWithOTP);

// DELETE WITH OTP - Delete wallet from main payment system (2-step OTP flow)
walletRouter.post("/wallet/delete/send-otp", walletController.sendDeletePaymentWalletOTP);
walletRouter.post("/wallet/delete/verify", walletController.deletePaymentWalletWithOTP);

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
