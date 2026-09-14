// Mock models module for unit tests
// Prevents Sequelize DB connections from being initialized during tests

export const UTXO_CHAINS = ['BTC', 'LTC', 'DOGE', 'BCH'];
export const TOKEN_CHAINS = ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'RLUSD', 'USDT-POLYGON', 'RLUSD-ERC20'];

// Mock Sequelize models as empty objects
export const feesModel = { findOne: jest.fn() };
export const companyModel = { findOne: jest.fn(), findAll: jest.fn() };
export const paymentLinkModel = { findOne: jest.fn() };
export const customerTransactionModel = { findOne: jest.fn(), create: jest.fn() };
// Merchant-pool models (used by webhookProcessor.isOwnOutgoingTransaction via
// dynamic import("../models")). Default: no match found (resolve null) — tests
// override with mockResolvedValueOnce when they need a known settlement tx.
export const merchantPoolTransactionModel = { findOne: jest.fn().mockResolvedValue(null) };
export const merchantPoolSweepModel = { findOne: jest.fn().mockResolvedValue(null) };

export default {
  UTXO_CHAINS,
  TOKEN_CHAINS,
  feesModel,
  companyModel,
  paymentLinkModel,
  customerTransactionModel,
  merchantPoolTransactionModel,
  merchantPoolSweepModel,
};
