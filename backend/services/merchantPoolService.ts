/**
 * Merchant Pool Service
 * 
 * Re-exports all merchant pool functionality from specialized modules.
 * This file maintains backward compatibility - all existing imports continue to work.
 * 
 * Modules:
 * - merchantPoolConfig: Constants, config, types, utilities
 * - merchantPoolWallet: Wallet creation, address generation, pool init
 * - merchantPoolReservation: Address reservation, release, payment tracking
 * - merchantPoolSweep: Gas funding, sweep execution, scheduled sweeps
 * - merchantPoolTransaction: Transaction recording, pool status
 * - merchantPoolMonitoring: Subscriptions, missed payments, orphan detection
 */

// Config & constants
export {
  POOL_CONFIG,
  UTXO_CHAINS,
  NATIVE_CURRENCIES,
  TOKEN_CHAINS,
  FEE_WALLETS,
  ADMIN_WALLETS,
  TOKEN_CONTRACTS,
  getSweepConfig,
} from "./merchantPool/merchantPoolConfig";

// Wallet management
export {
  getOrCreateMerchantWallet,
  addAddressToMerchantPool,
  initializeMerchantPool,
  prewarmPoolAddresses,
  retryPendingTrustLines,
} from "./merchantPool/merchantPoolWallet";

// Reservation & address lifecycle
export {
  reserveAddress,
  getAvailableAddress,
  markPaymentReceived,
  handlePartialPayment,
  handleBelowThresholdPayment,
  releaseExpiredReservations,
  releaseAddress,
  cleanupStaleAddresses,
  processQueuedPayments,
  preWarmAddressPool,
  replenishPreReservedPool,
} from "./merchantPool/merchantPoolReservation";

// Sweep operations
export {
  fundGasIfNeeded,
  reclaimExcessGas,
  sweepPoolAddress,
  sweepByThreshold,
  sweepByTime,
  performScheduledSweeps,
} from "./merchantPool/merchantPoolSweep";

// Transaction recording & status
export {
  recordPoolTransaction,
  getPoolStatus,
  findByWalletAddress,
} from "./merchantPool/merchantPoolTransaction";

// Monitoring & recovery
export {
  ensurePoolSubscriptions,
  checkMissedPayments,
  detectOrphanPayments,
} from "./merchantPool/merchantPoolMonitoring";

// Default export for backward compatibility with `import merchantPoolService from ...`
import { POOL_CONFIG, UTXO_CHAINS, NATIVE_CURRENCIES, TOKEN_CHAINS, FEE_WALLETS, ADMIN_WALLETS, TOKEN_CONTRACTS, getSweepConfig } from "./merchantPool/merchantPoolConfig";
import { getOrCreateMerchantWallet, addAddressToMerchantPool, initializeMerchantPool, prewarmPoolAddresses, retryPendingTrustLines } from "./merchantPool/merchantPoolWallet";
import { reserveAddress, getAvailableAddress, markPaymentReceived, handlePartialPayment, handleBelowThresholdPayment, releaseExpiredReservations, releaseAddress, cleanupStaleAddresses, processQueuedPayments, preWarmAddressPool, replenishPreReservedPool } from "./merchantPool/merchantPoolReservation";
import { fundGasIfNeeded, reclaimExcessGas, sweepPoolAddress, sweepByThreshold, sweepByTime, performScheduledSweeps } from "./merchantPool/merchantPoolSweep";
import { recordPoolTransaction, getPoolStatus, findByWalletAddress } from "./merchantPool/merchantPoolTransaction";
import { ensurePoolSubscriptions, checkMissedPayments, detectOrphanPayments } from "./merchantPool/merchantPoolMonitoring";

export default {
  getOrCreateMerchantWallet,
  addAddressToMerchantPool,
  initializeMerchantPool,
  prewarmPoolAddresses,
  retryPendingTrustLines,
  reserveAddress,
  getAvailableAddress,
  markPaymentReceived,
  handlePartialPayment,
  handleBelowThresholdPayment,
  releaseExpiredReservations,
  releaseAddress,
  fundGasIfNeeded,
  reclaimExcessGas,
  cleanupStaleAddresses,
  sweepPoolAddress,
  sweepByThreshold,
  sweepByTime,
  performScheduledSweeps,
  getSweepConfig,
  recordPoolTransaction,
  getPoolStatus,
  findByWalletAddress,
  processQueuedPayments,
  ensurePoolSubscriptions,
  checkMissedPayments,
  detectOrphanPayments,
  POOL_CONFIG,
  UTXO_CHAINS,
  NATIVE_CURRENCIES,
  TOKEN_CHAINS,
  FEE_WALLETS,
  ADMIN_WALLETS,
  TOKEN_CONTRACTS,
};
