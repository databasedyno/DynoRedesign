/**
 * Wallet Controller — FACADE
 *
 * R2 refactor (2026-08): the former 4.6K-line god file was extracted verbatim into
 * domain modules under controller/wallet/ (strangler pattern — zero behavior change).
 * The default-export object shape is identical to pre-refactor, so controller/index.ts
 * and every router keep working unchanged.
 *
 * Modules:
 *   walletShared       — escapeHtml, buildTransactionFilters, invalidateWalletCache
 *   walletRead         — getWallet, getWalletTransactions
 *   feesEstimates      — estimateFees, configured currencies, network fees, calc amount, encryptPayload
 *   transactionsList   — getAllTransactions
 *   transactionsDetail — getTransactionDetails, exportTransactions
 *   funding            — addFunds, authStep, verifyPayment, confirmPayment
 *   cryptoVerify       — verifyCryptoPayment
 *   fundingMethods     — card/bank/USSD/mobile-money/QR/crypto funding + getCurrencyRates
 *   tempAddress        — sendConfirmationOTP, getTempAddressBatches
 *   withdrawals        — withdrawAssets
 *   addressBook        — getWalletAddresses, addWalletAddress
 *   exchange           — exchangeCreate, getExchange
 *   exchangeConfirm    — confirmExchange
 *   analytics          — getUserAnalytics
 *   walletOtp          — validateWallet, ensureLiveApiKey, verifyOtp (step-up gated at router)
 *   walletMutations    — deleteWalletAddress, updateWalletWithOTP
 *   walletDeleteFlow   — deletePaymentWalletWithOTP, editWalletAddress
 *   reusableWallets    — getReusableWallets, copyWalletAddresses
 */

export * from "./wallet/walletShared";
export * from "./wallet/walletRead";
export * from "./wallet/feesEstimates";
export * from "./wallet/transactionsList";
export * from "./wallet/transactionsDetail";
export * from "./wallet/funding";
export * from "./wallet/cryptoVerify";
export * from "./wallet/fundingMethods";
export * from "./wallet/tempAddress";
export * from "./wallet/withdrawals";
export * from "./wallet/addressBook";
export * from "./wallet/exchange";
export * from "./wallet/exchangeConfirm";
export * from "./wallet/analytics";
export * from "./wallet/walletOtp";
export * from "./wallet/walletMutations";
export * from "./wallet/walletDeleteFlow";
export * from "./wallet/reusableWallets";

import { getWallet, getWalletTransactions } from "./wallet/walletRead";
import { estimateFees, getConfiguredCurrencies, getNetworkFees, calculatePaymentAmount, encryptPayload } from "./wallet/feesEstimates";
import { getAllTransactions } from "./wallet/transactionsList";
import { getTransactionDetails, exportTransactions } from "./wallet/transactionsDetail";
import { requestTopup } from "./wallet/transactionsTopup";
import { addFunds, authStep, verifyPayment, confirmPayment } from "./wallet/funding";
import { verifyCryptoPayment } from "./wallet/cryptoVerify";
import { getCurrencyRates } from "./wallet/fundingMethods";
import { sendConfirmationOTP } from "./wallet/tempAddress";
import { withdrawAssets } from "./wallet/withdrawals";
import { getWalletAddresses, addWalletAddress } from "./wallet/addressBook";
import { exchangeCreate, getExchange } from "./wallet/exchange";
import { confirmExchange } from "./wallet/exchangeConfirm";
import { getUserAnalytics } from "./wallet/analytics";
import { validateWallet, verifyOtp } from "./wallet/walletOtp";
import { deleteWalletAddress, updateWalletWithOTP } from "./wallet/walletMutations";
import { deletePaymentWalletWithOTP, editWalletAddress } from "./wallet/walletDeleteFlow";
import { getReusableWallets, copyWalletAddresses } from "./wallet/reusableWallets";
import { batchWalletMutate } from "./wallet/walletBatch";

export default {
  getWallet,
  addFunds,
  authStep,
  verifyPayment,
  estimateFees,
  getCurrencyRates,
  verifyCryptoPayment,
  getWalletTransactions,
  confirmPayment,
  getAllTransactions,
  sendConfirmationOTP,
  withdrawAssets,
  getWalletAddresses,
  addWalletAddress,
  exchangeCreate,
  getExchange,
  confirmExchange,
  getUserAnalytics,
  validateWallet,
  verifyOtp,
  deleteWalletAddress,
  editWalletAddress,
  getTransactionDetails,
  exportTransactions,
  requestTopup,
  getConfiguredCurrencies,
  getNetworkFees,
  calculatePaymentAmount,
  // Single-wallet update / delete (step-up gated at the router)
  updateWalletWithOTP,
  deletePaymentWalletWithOTP,
  encryptPayload,
  // New: reuse wallets across companies
  getReusableWallets,
  copyWalletAddresses,
  // Bulk wallet management (WalletManagerModal)
  batchWalletMutate,
};
