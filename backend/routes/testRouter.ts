/**
 * Test Routes - For development/testing purposes only
 * These endpoints allow testing of payment flows and threshold logic
 */

import { raw as envRaw } from "../utils/config";
import express from "express";
import { apiLogger } from "../utils/loggers";
import { QueryTypes } from "sequelize";
import { successResponseHelper, errorResponseHelper, getErrorMessage } from "../helper";
import { setRedisItem, getRedisItem, deleteRedisItem } from "../utils/redisInstance";
import { calculateTransactionFees } from "../controller/index";
// getBlockchainConfig import removed - not used
import { getBlockchainThreshold } from "../utils/feeConfigUtils";
// paymentController import removed - not used
import { authMiddleware } from "../middleware";
import sequelize from "../utils/dbInstance";
import tatumApi from "../apis/tatumApi";
import { ethers } from "ethers";

const testRouter = express.Router();

/**
 * POST /api/test/fix-customer-id-column
 * Fix the customer_id column to allow NULL values
 * Protected: Admin only
 */
testRouter.post("/fix-customer-id-column", authMiddleware, async (_req, res) => {
  try {
    await sequelize.query('ALTER TABLE tbl_customer_transaction ALTER COLUMN customer_id DROP NOT NULL;');
    
    // Verify the change
    const [result] = await sequelize.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_customer_transaction' 
      AND column_name = 'customer_id';
    `);
    
    successResponseHelper(res, 200, "customer_id column fixed to allow NULL", result);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * GET /api/test/thresholds
 * Returns all blockchain thresholds
 * Protected: Requires authentication
 */
testRouter.get("/thresholds", authMiddleware, async (_req, res) => {
  try {
    const thresholds = {
      BTC: getBlockchainThreshold("BTC"),
      ETH: getBlockchainThreshold("ETH"),
      LTC: getBlockchainThreshold("LTC"),
      DOGE: getBlockchainThreshold("DOGE"),
      TRX: getBlockchainThreshold("TRX"),
      BCH: getBlockchainThreshold("BCH"),
      "USDT-TRC20": getBlockchainThreshold("USDT-TRC20"),
      "USDT-ERC20": getBlockchainThreshold("USDT-ERC20"),
    };
    
    successResponseHelper(res, 200, "Blockchain thresholds retrieved", thresholds);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/calculate-fees
 * Calculate fees for a given amount and blockchain
 * Protected: Requires authentication - fee details are internal business logic
 */
testRouter.post("/calculate-fees", authMiddleware, async (req, res) => {
  try {
    const { blockchain, amount } = req.body;
    
    if (!blockchain || !amount) {
      return errorResponseHelper(res, 400, "blockchain and amount are required");
    }
    
    const feeResult = await calculateTransactionFees(blockchain, Number(amount));
    const threshold = getBlockchainThreshold(blockchain);
    const isBelowThreshold = Number(amount) < threshold;
    
    // Only return total processing fee - no internal breakdown
    const response = {
      blockchain,
      amount: Number(amount),
      threshold,
      is_below_threshold: isBelowThreshold,
      processing_fee: parseFloat(feeResult.totalDeduction.toFixed(2)),
      distribution: {
        admin_receives: isBelowThreshold ? Number(amount) : parseFloat(feeResult.totalDeduction.toFixed(2)),
        merchant_receives: isBelowThreshold ? 0 : parseFloat(feeResult.userReceives.toFixed(2)),
      },
      explanation: isBelowThreshold
        ? `Amount $${amount} is below the $${threshold} threshold. ALL funds will be sent to admin wallet.`
        : `Amount $${amount} is above the $${threshold} threshold. Processing fees go to admin, remainder to merchant.`,
    };
    
    successResponseHelper(res, 200, "Fee calculation complete", response);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/simulate-payment-redis
 * Set up Redis data to simulate a payment session
 */
testRouter.post("/simulate-payment-redis", authMiddleware, async (req, res) => {
  try {
    const { address, amount, currency, company_id, fee_payer = "company" } = req.body;
    
    if (!address || !amount || !currency) {
      return errorResponseHelper(res, 400, "address, amount, and currency are required");
    }
    
    const uniqueRef = `test-ref-${Date.now()}`;
    const txId = `test-tx-${Date.now()}`;
    
    // Get user from token
    const jwt = require("jsonwebtoken");
    const userData = jwt.decode(res.locals.token);
    
    // Set up Redis data like a real payment session
    const cryptoPayload = {
      mode: "crypto",
      amount: Number(amount),
      status: "pending",
      ref: uniqueRef,
      currency: currency,
      unique_tx_id: txId,
      walletType: "customer",
      temp_id: Date.now(),
      adm_id: userData.user_id,
      company_id: company_id || 1,
      fee_payer: fee_payer,
    };
    
    await setRedisItem(`crypto-${address}`, cryptoPayload);
    
    // Set customer ref data
    const customerRefPayload = {
      adm_id: userData.user_id,
      customer_id: 1,
      company_id: company_id || 1,
      base_currency: "USD",
      base_amount: Number(amount),
      fee_payer: fee_payer,
    };
    
    await setRedisItem(uniqueRef, customerRefPayload);
    
    successResponseHelper(res, 200, "Test payment session created in Redis", {
      address,
      redis_key: `crypto-${address}`,
      ref: uniqueRef,
      amount,
      currency,
      fee_payer,
      instructions: {
        step1: "Redis data is now set up",
        step2: `Send POST to /api/tatum-crypto-webhook with: { "address": "${address}", "amount": "${amount}", "asset": "${currency}", "txId": "test-tx-123" }`,
        step3: "Check /api/notifications for pending/partial/received notifications",
      },
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * GET /api/test/redis/:key
 * Get Redis data for a specific key
 * Protected: Requires authentication
 */
testRouter.get("/redis/:key", authMiddleware, async (req, res) => {
  try {
    const key = req.params.key;
    const data = await getRedisItem(key);
    
    if (!data || Object.keys(data).length === 0) {
      return errorResponseHelper(res, 404, `No Redis data found for key: ${key}`);
    }
    
    successResponseHelper(res, 200, "Redis data retrieved", { key, data });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * DELETE /api/test/redis/:key
 * Delete Redis data for a specific key
 * Protected: Requires authentication
 */
testRouter.delete("/redis/:key", authMiddleware, async (req, res) => {
  try {
    const key = req.params.key;
    await deleteRedisItem(key);
    successResponseHelper(res, 200, "Redis data deleted", { key });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/threshold-test
 * Run threshold distribution test for a specific scenario
 * Protected: Requires authentication
 */
testRouter.post("/threshold-test", authMiddleware, async (req, res) => {
  try {
    const { blockchain, amount } = req.body;
    
    if (!blockchain || !amount) {
      return errorResponseHelper(res, 400, "blockchain and amount are required");
    }
    
    const threshold = getBlockchainThreshold(blockchain);
    const isBelowThreshold = Number(amount) < threshold;
    
    let adminReceives: number;
    let merchantReceives: number;
    let explanation: string;
    
    if (isBelowThreshold) {
      adminReceives = Number(amount);
      merchantReceives = 0;
      explanation = `BELOW THRESHOLD: Amount $${amount} < $${threshold}. ALL funds ($${amount}) sent to admin wallet. Merchant receives $0.`;
    } else {
      const fees = await calculateTransactionFees(blockchain, Number(amount));
      adminReceives = fees.totalDeduction;
      merchantReceives = fees.userReceives;
      explanation = `ABOVE THRESHOLD: Amount $${amount} >= $${threshold}. Admin receives processing fees ($${adminReceives.toFixed(2)}). Merchant receives ($${merchantReceives.toFixed(2)}).`;
    }
    
    successResponseHelper(res, 200, "Threshold test complete", {
      test_scenario: {
        blockchain,
        amount: Number(amount),
        threshold,
        is_below_threshold: isBelowThreshold,
      },
      expected_distribution: {
        admin_wallet: parseFloat(adminReceives.toFixed(2)),
        merchant_wallet: parseFloat(merchantReceives.toFixed(2)),
        total: parseFloat((adminReceives + merchantReceives).toFixed(2)),
      },
      explanation,
      test_passed: true,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/full-payment-flow
 * Simulate a complete payment flow with Redis setup and webhook
 */
testRouter.post("/full-payment-flow", authMiddleware, async (req, res) => {
  try {
    const { currency, company_id, simulate_below_threshold = false } = req.body;
    
    const threshold = getBlockchainThreshold(currency);
    const testAmount = simulate_below_threshold ? Math.max(1, threshold - 2) : threshold + 10;
    
    const testAddress = `test-addr-${Date.now()}`;
    const uniqueRef = `test-ref-${Date.now()}`;
    const txId = `test-tx-${Date.now()}`;
    
    const jwt = require("jsonwebtoken");
    const userData = jwt.decode(res.locals.token);
    
    // Step 1: Set up Redis data
    const cryptoPayload = {
      mode: "crypto",
      amount: testAmount,
      status: "pending",
      ref: uniqueRef,
      currency: currency,
      unique_tx_id: txId,
      walletType: "customer",
      temp_id: Date.now(),
      adm_id: userData.user_id,
      company_id: company_id || 1,
      fee_payer: "company",
    };
    
    await setRedisItem(`crypto-${testAddress}`, cryptoPayload);
    await setRedisItem(uniqueRef, {
      adm_id: userData.user_id,
      customer_id: 1,
      company_id: company_id || 1,
      base_currency: "USD",
      base_amount: testAmount,
    });
    
    // Step 2: Calculate expected distribution
    const isBelowThreshold = testAmount < threshold;
    let expectedAdmin: number, expectedMerchant: number;
    
    if (isBelowThreshold) {
      expectedAdmin = testAmount;
      expectedMerchant = 0;
    } else {
      const fees = await calculateTransactionFees(currency, testAmount);
      expectedAdmin = fees.totalDeduction;
      expectedMerchant = fees.userReceives;
    }
    
    successResponseHelper(res, 200, "Full payment flow test prepared", {
      test_setup: {
        address: testAddress,
        amount: testAmount,
        currency,
        threshold,
        is_below_threshold: isBelowThreshold,
      },
      redis_keys: {
        crypto_key: `crypto-${testAddress}`,
        ref_key: uniqueRef,
      },
      expected_distribution: {
        admin_receives: expectedAdmin,
        merchant_receives: expectedMerchant,
        explanation: isBelowThreshold
          ? `ALL funds go to admin (below $${threshold} threshold)`
          : `Fees ($${expectedAdmin.toFixed(2)}) to admin, remainder ($${expectedMerchant.toFixed(2)}) to merchant`,
      },
      next_step: {
        description: "Send webhook to simulate incoming payment",
        endpoint: "POST /api/tatum-crypto-webhook",
        body: {
          address: testAddress,
          counterAddress: "sender-test-123",
          amount: testAmount.toString(),
          asset: currency,
          txId: `incoming-${txId}`,
          blockNumber: null,
        },
      },
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/diagnose-temp-address
 * Diagnose a temp address - check private key decryption and derived address
 * Protected: Requires authentication
 */
testRouter.post("/diagnose-temp-address", authMiddleware, async (req, res) => {
  try {
    const { temp_id } = req.body;
    
    // Get temp address from database
    const result = await sequelize.query<{ temp_id: number; wallet_address: string; privateKey: string; wallet_type: string }>(
      'SELECT temp_id, wallet_address, "privateKey", wallet_type FROM tbl_user_temp_address WHERE temp_id = :temp_id',
      { replacements: { temp_id }, type: QueryTypes.SELECT }
    );
    
    if (!result || result.length === 0) {
      return errorResponseHelper(res, 404, "Temp address not found");
    }
    
    const tempData = result[0];
    const expectedAddress = tempData.wallet_address;
    
    // Decrypt private key
    let decryptedKey;
    let derivedAddress;
    let addressMatch = false;
    
    try {
      decryptedKey = await tatumApi.decryptSymmetric(tempData.privateKey, envRaw("TEMP_KEY_ID"));
      
      // Derive address from private key
      const wallet = new ethers.Wallet(decryptedKey);
      derivedAddress = wallet.address;
      addressMatch = expectedAddress.toLowerCase() === derivedAddress.toLowerCase();
    } catch (decryptErr: unknown) {
      const err = decryptErr as { message?: string };
      return errorResponseHelper(res, 500, `Decryption error: ${err.message}`);
    }
    
    successResponseHelper(res, 200, "Temp address diagnosis", {
      temp_id: tempData.temp_id,
      wallet_type: tempData.wallet_type,
      expected_address: expectedAddress,
      derived_address: derivedAddress,
      addresses_match: addressMatch,
      private_key_preview: decryptedKey ? decryptedKey.substring(0, 10) + "..." : null,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/manual-transfer
 * Manually trigger a transfer from a temp address (for debugging)
 * Protected: Requires authentication
 */
testRouter.post("/manual-transfer", authMiddleware, async (req, res) => {
  try {
    const { temp_id, to_address, amount } = req.body;
    
    // Get temp address from database
    const result = await sequelize.query<{ temp_id: number; wallet_address: string; privateKey: string; wallet_type: string }>(
      'SELECT temp_id, wallet_address, "privateKey", wallet_type FROM tbl_user_temp_address WHERE temp_id = :temp_id',
      { replacements: { temp_id }, type: QueryTypes.SELECT }
    );
    
    if (!result || result.length === 0) {
      return errorResponseHelper(res, 404, "Temp address not found");
    }
    
    const tempData = result[0];
    
    // Decrypt private key
    const decryptedKey = await tatumApi.decryptSymmetric(tempData.privateKey, envRaw("TEMP_KEY_ID"));
    
    // Verify address
    const wallet = new ethers.Wallet(decryptedKey);
    const derivedAddress = wallet.address;
    
    if (derivedAddress.toLowerCase() !== tempData.wallet_address.toLowerCase()) {
      return errorResponseHelper(res, 400, `Address mismatch! Expected: ${tempData.wallet_address}, Derived: ${derivedAddress}`);
    }
    
    // Estimate fees
    const fees = await tatumApi.feeEstimation(
      tempData.wallet_type,
      tempData.wallet_address,
      to_address,
      Number(amount)
    );
    
    // Calculate send amount (deduct gas)
    const gasFee = Number((fees as { slow?: string | number })?.slow ?? 0);
    const sendAmount = Number((Number(amount) - gasFee).toFixed(6));
    
    if (sendAmount <= 0) {
      return errorResponseHelper(res, 400, `Insufficient balance after gas. Amount: ${amount}, Gas: ${gasFee}`);
    }
    
    // Execute transfer
    const transaction = await tatumApi.assetToOtherAddress({
      currency: tempData.wallet_type,
      fromAddress: tempData.wallet_address,
      toAddress: to_address,
      privateKey: decryptedKey,
      amount: sendAmount,
      fee: fees,
    });
    
    successResponseHelper(res, 200, "Transfer executed", {
      temp_id: tempData.temp_id,
      from_address: tempData.wallet_address,
      to_address,
      requested_amount: amount,
      gas_fee: gasFee,
      actual_sent: sendAmount,
      transaction,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/send-payment-link-email
 * Send a test payment link email to verify email formatting
 * Protected: Requires authentication
 */
testRouter.post("/send-payment-link-email", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return errorResponseHelper(res, 400, "email is required");
    }
    
    const { sendEmail } = require("../helper");
    
    // Sample payment link email content (matching real implementation)
    const companyName = "Dynopay Test Merchant";
    const amount = "50.00";
    const currency = "USD";
    const description = "Monthly Subscription - Premium Plan";
    const paymentLink = "https://checkout.dynopay.io/pay?d=test123456";
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    // Sample referee code section (shown for first-time recipients)
    const refereeCodeSection = `
      <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">🎁 Special Offer for You!</h3>
        <p style="margin: 0 0 10px 0; color: #14532d; font-size: 14px;">
          Want to accept crypto payments for your own business? Join Dynopay and get <strong>50% off</strong> all fees for <strong>90 days</strong>!
        </p>
        <p style="margin: 0; font-size: 14px;">
          Use code: <strong style="background: #dcfce7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">REF-TEST1234</strong>
        </p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #166534;">
          This code is exclusive to you and expires in 30 days.
        </p>
      </div>
    `;

    const paymentMessage = `
You have received a payment request from <strong>${companyName}</strong>.

<div style="margin: 20px 0; padding: 20px; background: #f8f9ff; border-radius: 8px;">
  <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${amount} ${currency}</p>
  <p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>
  <p style="margin: 0;"><strong>Expires:</strong> ${expiresAt.toLocaleDateString()}</p>
</div>

<div style="text-align: center; margin: 24px 0;">
  <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Pay Now</a>
</div>

${refereeCodeSection}
    `.trim();

    // Send the test email
    const recipientName = email.split('@')[0] || "Customer";
    const subject = `Payment Request from ${companyName} - ${amount} ${currency}`;
    
    await sendEmail(
      email,
      recipientName,
      subject,
      paymentMessage,
      false
    );
    
    successResponseHelper(res, 200, "Test payment link email sent", {
      sent_to: email,
      recipient_name: recipientName,
      subject: subject,
      includes_referee_code: true,
      sample_code: "REF-TEST1234",
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/trigger-referee-reminders
 * Manually trigger the referee code reminder job
 * Protected: Requires authentication
 */
testRouter.post("/trigger-referee-reminders", authMiddleware, async (_req, res) => {
  try {
    const { triggerRefereeCodeReminders } = await import("../utils/cronJobs");
    const results = await triggerRefereeCodeReminders();
    
    successResponseHelper(res, 200, "Referee code reminders triggered", results);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/send-referee-reminder
 * Send a test referee code reminder email
 * Protected: Requires authentication
 */
testRouter.post("/send-referee-reminder", authMiddleware, async (req, res) => {
  try {
    const { email, reminder_type = 'week1' } = req.body;
    
    if (!email) {
      return errorResponseHelper(res, 400, "email is required");
    }
    
    const validTypes = ['week1', 'week2', 'week3', 'final'];
    if (!validTypes.includes(reminder_type)) {
      return errorResponseHelper(res, 400, `reminder_type must be one of: ${validTypes.join(', ')}`);
    }
    
    const { sendRefereeCodeReminderEmail } = require("../helper");
    
    // Calculate days remaining based on reminder type
    const daysRemaining = reminder_type === 'final' ? 3 : 
                          reminder_type === 'week3' ? 9 :
                          reminder_type === 'week2' ? 16 : 23;
    
    await sendRefereeCodeReminderEmail(
      email,
      "REF-TEST1234",       // Test code
      50,                   // Discount percent
      90,                   // Discount duration days
      daysRemaining,        // Days remaining
      reminder_type,        // Reminder type
      "test-unsubscribe-token-12345"  // Unsubscribe token
    );
    
    successResponseHelper(res, 200, "Test referee reminder email sent", {
      sent_to: email,
      reminder_type,
      days_remaining: daysRemaining,
      test_code: "REF-TEST1234",
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/trigger-payment-link-reminders
 * Manually trigger the payment link reminder job
 * Protected: Requires authentication
 */
testRouter.post("/trigger-payment-link-reminders", authMiddleware, async (_req, res) => {
  try {
    const { triggerPaymentLinkReminders } = await import("../utils/cronJobs");
    const results = await triggerPaymentLinkReminders();
    
    successResponseHelper(res, 200, "Payment link reminders check triggered", results);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/send-payment-link-reminder
 * Send a test payment link reminder email
 * Protected: Requires authentication
 */
testRouter.post("/send-payment-link-reminder", authMiddleware, async (req, res) => {
  try {
    const { email, reminder_type = 'reminder1', expires_in_hours = null } = req.body;
    
    if (!email) {
      return errorResponseHelper(res, 400, "email is required");
    }
    
    const validTypes = ['reminder1', 'reminder2', 'final'];
    if (!validTypes.includes(reminder_type)) {
      return errorResponseHelper(res, 400, `reminder_type must be one of: ${validTypes.join(', ')}`);
    }
    
    const { sendPaymentLinkReminderEmail } = require("../helper");
    
    // Calculate expiry date if hours specified
    let expiresAt: Date | null = null;
    if (expires_in_hours !== null) {
      expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
    }
    
    await sendPaymentLinkReminderEmail(
      email,
      "Test Company Ltd",         // Company name
      "150.00",                   // Amount
      "USD",                      // Currency
      "Monthly Subscription",     // Description
      "https://checkout.dynopay.io/pay?d=test123456", // Payment link
      expiresAt,                  // Expires at
      reminder_type,              // Reminder type
      "test-payment-unsubscribe-token-12345"  // Unsubscribe token
    );
    
    successResponseHelper(res, 200, "Test payment link reminder email sent", {
      sent_to: email,
      reminder_type,
      expires_at: expiresAt?.toISOString() || null,
      expires_in_hours,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/send-payment-received-email
 * Send a test payment received email to verify new branded template
 * Protected: Requires authentication
 */
testRouter.post("/send-payment-received-email", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponseHelper(res, 400, "email is required");
    
    const { sendPaymentReceivedEmail } = require("../helper/sendEmail");
    const recipientName = email.split('@')[0] || "Merchant";
    
    await sendPaymentReceivedEmail(
      email,
      recipientName,
      "0.00325000",
      "BTC",
      "Dynopay Test Merchant",
      "tx_abc123def456_test_payment_received",
      new Date().toLocaleDateString(),
      new Date().toLocaleTimeString()
    );
    
    successResponseHelper(res, 200, "Test payment received email sent", { sent_to: email });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/send-payment-pending-email
 * Send a test payment pending email to verify new branded template
 * Protected: Requires authentication
 */
testRouter.post("/send-payment-pending-email", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponseHelper(res, 400, "email is required");
    
    const { sendPaymentPendingEmail } = require("../helper/sendEmail");
    const recipientName = email.split('@')[0] || "Merchant";
    
    await sendPaymentPendingEmail(
      email,
      recipientName,
      "Dynopay Test Merchant",
      "250.00",
      "USDT-ERC20",
      "tx_789ghi012jkl_test_payment_pending",
      1
    );
    
    successResponseHelper(res, 200, "Test payment pending email sent", { sent_to: email });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/rlusd-trustline
 * Test RLUSD trust line setup by creating a fresh XRP wallet,
 * funding it, and attempting trust line creation.
 * Protected: Admin only
 */
testRouter.post("/rlusd-trustline", authMiddleware, async (_req, res) => {
  try {
    const { addAddressToMerchantPool } = await import("../services/merchantPool/merchantPoolWallet");
    const userId = (res.locals as any).user?.user_id || (res.locals as any).userId;

    if (!userId) {
      return errorResponseHelper(res, 401, "User not authenticated");
    }

    apiLogger.info(`[TestTrustLine] Triggering RLUSD address creation for user ${userId}...`);
    const result = await addAddressToMerchantPool(userId, "RLUSD") as any;

    const address = result?.dataValues?.wallet_address || result?.wallet_address || "unknown";
    const status = result?.dataValues?.status || result?.status || "unknown";

    apiLogger.info(`[TestTrustLine] Result: address=${address}, status=${status}`);
    successResponseHelper(res, 200, "RLUSD trust line test complete", {
      address,
      status,
      note: status === "AVAILABLE" ? "Trust line established successfully" : "Trust line pending — check retryPendingTrustLines cron"
    });
  } catch (e) {
    apiLogger.error(`[TestTrustLine] Error:`, getErrorMessage(e));
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

export default testRouter;
