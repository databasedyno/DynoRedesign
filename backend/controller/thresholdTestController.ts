/**
 * Test Script: Payment Threshold Flow Testing
 * Tests that payments below blockchain threshold are sent entirely to admin wallet
 */

import { raw as envRaw } from "../utils/config";
import { setRedisItem, deleteRedisItem } from '../utils/redisInstance';
import { apiLogger } from "../utils/loggers";
// sequelize and QueryTypes imports removed - not used
import { calculateTransactionFees } from '../services/feeService';
import { getBlockchainThreshold } from '../utils/feeConfigUtils';

// Test configuration
const TEST_CONFIG = {
  BTC_THRESHOLD: Number(envRaw("BTC_THRESHOLD")) || 7,
  ETH_THRESHOLD: Number(envRaw("ETH_THRESHOLD")) || 5,
  TRX_THRESHOLD: Number(envRaw("TRX_THRESHOLD")) || 5,
};

interface ThresholdTestResult {
  blockchain: string;
  testAmount: number;
  threshold: number;
  isAboveThreshold: boolean;
  adminReceives: number;
  merchantReceives: number;
  passed: boolean;
  message: string;
}

/**
 * Test threshold logic for a specific blockchain
 */
export const testBlockchainThreshold = async (
  blockchain: string,
  amountUSD: number
): Promise<ThresholdTestResult> => {
  const threshold = getBlockchainThreshold(blockchain);
  const isAboveThreshold = amountUSD >= threshold;
  
  try {
    const { totalDeduction, userReceives, minForwarding } = await calculateTransactionFees(
      blockchain,
      amountUSD
    );
    
    let adminReceives: number;
    let merchantReceives: number;
    
    if (amountUSD < minForwarding) {
      // Below threshold - all to admin
      adminReceives = amountUSD;
      merchantReceives = 0;
    } else {
      // Above threshold - split between admin and merchant
      adminReceives = totalDeduction;
      merchantReceives = userReceives;
    }
    
    const expectedAdminAll = !isAboveThreshold;
    const actualAdminAll = merchantReceives === 0;
    const passed = expectedAdminAll === actualAdminAll;
    
    return {
      blockchain,
      testAmount: amountUSD,
      threshold,
      isAboveThreshold,
      adminReceives,
      merchantReceives,
      passed,
      message: passed 
        ? `✅ ${blockchain}: $${amountUSD} correctly routed (threshold: $${threshold})`
        : `❌ ${blockchain}: Routing error - expected admin-all=${expectedAdminAll}, got=${actualAdminAll}`,
    };
  } catch (error) {
    return {
      blockchain,
      testAmount: amountUSD,
      threshold,
      isAboveThreshold,
      adminReceives: 0,
      merchantReceives: 0,
      passed: false,
      message: `❌ ${blockchain}: Error - ${error.message}`,
    };
  }
};

/**
 * Run all threshold tests
 */
export const runThresholdTests = async (): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: ThresholdTestResult[];
}> => {
  const testCases = [
    // BTC tests (threshold $7)
    { blockchain: 'BTC', amount: 3 },   // Below threshold
    { blockchain: 'BTC', amount: 7 },   // At threshold
    { blockchain: 'BTC', amount: 20 },  // Above threshold
    
    // ETH tests (threshold $5)
    { blockchain: 'ETH', amount: 2 },   // Below threshold
    { blockchain: 'ETH', amount: 5 },   // At threshold
    { blockchain: 'ETH', amount: 15 },  // Above threshold
    
    // TRX tests (threshold $5)
    { blockchain: 'TRX', amount: 3 },   // Below threshold
    { blockchain: 'TRX', amount: 10 },  // Above threshold
    
    // USDT-TRC20 tests (threshold $10)
    { blockchain: 'USDT-TRC20', amount: 5 },  // Below threshold
    { blockchain: 'USDT-TRC20', amount: 15 }, // Above threshold
  ];
  
  const results: ThresholdTestResult[] = [];
  
  for (const testCase of testCases) {
    const result = await testBlockchainThreshold(testCase.blockchain, testCase.amount);
    results.push(result);
    apiLogger.info(result.message);
  }
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    total: results.length,
    passed,
    failed,
    results,
  };
};

/**
 * Simulate a payment with Redis data setup
 */
export const simulatePaymentWithRedis = async (params: {
  address: string;
  amount: number;
  currency: string;
  userId: number;
  companyId: number;
  tempId: number;
}): Promise<void> => {
  const { address, amount, currency, userId, companyId, tempId } = params;
  
  // Set up Redis data like a real payment session would
  const redisPayload = {
    mode: 'crypto',
    amount: amount,
    status: 'pending',
    ref: `test-ref-${Date.now()}`,
    currency: currency,
    unique_tx_id: `test-tx-${Date.now()}`,
    walletType: 'customer',
    temp_id: tempId,
    adm_id: userId,
    company_id: companyId,
    fee_payer: 'company',
  };
  
  await setRedisItem(`crypto-${address}`, redisPayload);
  
  // Also set the customer ref
  await setRedisItem(redisPayload.ref, {
    adm_id: userId,
    customer_id: 1,
    company_id: companyId,
    base_currency: 'USD',
    base_amount: amount,
  });
  
  apiLogger.info(`✅ Redis data set for address: ${address}`);
  apiLogger.info(`   Amount: ${amount} ${currency}`);
};

/**
 * Clean up test Redis data
 */
export const cleanupTestRedis = async (address: string, ref: string): Promise<void> => {
  await deleteRedisItem(`crypto-${address}`);
  await deleteRedisItem(ref);
  apiLogger.info(`🧹 Cleaned up Redis data for: ${address}`);
};

export default {
  testBlockchainThreshold,
  runThresholdTests,
  simulatePaymentWithRedis,
  cleanupTestRedis,
  TEST_CONFIG,
};
