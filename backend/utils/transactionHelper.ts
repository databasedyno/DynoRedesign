/**
 * Database Transaction Helper
 * Provides utilities for managing database transactions safely
 * Prevents data inconsistency in payment flows
 */

import sequelize from './dbInstance';
import { apiLogger } from "../utils/loggers";
import { Transaction } from 'sequelize';

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on error
 * 
 * @param callback - Function to execute within transaction
 * @returns Result of the callback function
 */
export async function withTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const transaction = await sequelize.transaction();
  
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Execute payment flow within a transaction
 * Includes additional logging and error handling specific to payments
 * 
 * @param paymentId - Payment identifier for logging
 * @param callback - Payment processing function
 * @returns Result of the callback
 */
export async function withPaymentTransaction<T>(
  paymentId: string,
  callback: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    apiLogger.info(`[Transaction] Starting payment transaction for: ${paymentId}`);
    
    const result = await withTransaction(callback);
    
    const duration = Date.now() - startTime;
    apiLogger.info(`[Transaction] Payment transaction committed successfully: ${paymentId} (${duration}ms)`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.error(
      `[Transaction] Payment transaction rolled back: ${paymentId} (${duration}ms)`,
      error
    );
    throw error;
  }
}

/**
 * Execute multiple operations atomically
 * All operations succeed or all fail together
 * 
 * @param operations - Array of functions to execute
 * @returns Array of results
 */
export async function withAtomicOperations<T>(
  operations: Array<(transaction: Transaction) => Promise<T>>
): Promise<T[]> {
  return withTransaction(async (transaction) => {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation(transaction);
      results.push(result);
    }
    
    return results;
  });
}

/**
 * Retry a transaction on deadlock or serialization errors
 * Useful for high-concurrency scenarios
 * 
 * @param callback - Transaction callback
 * @param maxRetries - Maximum retry attempts
 * @param retryDelay - Delay between retries (ms)
 * @returns Result of the callback
 */
export async function withRetryableTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error: unknown) {
      lastError = error as Error;
      
      // Check if error is retryable (deadlock or serialization failure)
      const errorMessage = lastError.message.toLowerCase();
      const isRetryable = errorMessage.includes('deadlock') ||
                          errorMessage.includes('serialization') ||
                          errorMessage.includes('could not serialize');
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1);
      apiLogger.warn(
        `[Transaction] Retryable error detected, attempt ${attempt}/${maxRetries}. ` +
        `Retrying in ${delay}ms...`,
        errorMessage
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if currently in a transaction
 * Useful for conditional transaction logic
 */
export function isInTransaction(options?: { transaction?: Transaction }): boolean {
  return !!options?.transaction;
}

/**
 * Get or create transaction
 * Returns existing transaction or creates new one if needed
 * 
 * @param options - Options that may contain existing transaction
 * @returns Transaction object
 */
export async function getOrCreateTransaction(
  options?: { transaction?: Transaction }
): Promise<{ transaction: Transaction; isNew: boolean }> {
  if (options?.transaction) {
    return {
      transaction: options.transaction,
      isNew: false
    };
  }
  
  const transaction = await sequelize.transaction();
  return {
    transaction,
    isNew: true
  };
}

/**
 * Commit transaction if it was created by getOrCreateTransaction
 * 
 * @param transaction - Transaction to commit
 * @param isNew - Whether transaction was created new
 */
export async function commitIfNew(
  transaction: Transaction,
  isNew: boolean
): Promise<void> {
  if (isNew) {
    await transaction.commit();
  }
}

/**
 * Rollback transaction if it was created by getOrCreateTransaction
 * 
 * @param transaction - Transaction to rollback
 * @param isNew - Whether transaction was created new
 */
export async function rollbackIfNew(
  transaction: Transaction,
  isNew: boolean
): Promise<void> {
  if (isNew) {
    await transaction.rollback();
  }
}

/**
 * Example usage in payment flow:
 * 
 * await withPaymentTransaction(paymentId, async (transaction) => {
 *   // Step 1: Update payment status
 *   await updatePaymentStatus(paymentId, 'confirmed', { transaction });
 *   
 *   // Step 2: Calculate admin fee
 *   const adminFee = await calculateAdminFee(amount, { transaction });
 *   
 *   // Step 3: Credit merchant
 *   await creditMerchantWallet(merchantId, netAmount, { transaction });
 *   
 *   // If any step fails, entire transaction is rolled back
 *   return { success: true };
 * });
 */

export default {
  withTransaction,
  withPaymentTransaction,
  withAtomicOperations,
  withRetryableTransaction,
  isInTransaction,
  getOrCreateTransaction,
  commitIfNew,
  rollbackIfNew
};
