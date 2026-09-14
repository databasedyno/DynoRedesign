/**
 * Recovery script for stuck $98 USDT-TRC20 payment
 * 
 * Payment ID: 6e6e204c-e608-4fcc-9ab9-5031426d2594
 * Pool Address: TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe
 * Merchant Wallet: TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR
 * Amount: 98 USDT-TRC20 (merchant portion: 93.4916 after fees)
 * 
 * Root Cause: OUT_OF_ENERGY — SmartGas funded 9.96 TRX (65k energy estimate)
 * but TRON network needed 130k energy (13+ TRX). Three attempts all failed.
 * 
 * Fix: This script funds 20+ TRX (130k energy with buffer) before transfer.
 * 
 * Run: cd /app/backend && npx ts-node scripts/recover_payment_98_usdt.ts
 */

import 'dotenv/config';
import tatumApi from '../apis/tatumApi';
import sequelize from '../utils/dbInstance';
import { cronLogger } from '../utils/loggers';

const PAYMENT_ID = '6e6e204c-e608-4fcc-9ab9-5031426d2594';
const POOL_ADDRESS = 'TAoyePonm5YS5Liwjfcaw6wKHVqcPcaBqe';
const MERCHANT_WALLET = 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR'; // Company 3, User 4
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const CURRENCY = 'USDT-TRC20';
const MERCHANT_AMOUNT = 93.4916; // After fees + gas deduction (pre-calculated)
const ADMIN_FEE = 4.5084; // 98 - 93.4916

// Minimum TRX for gas — use NEW_RECIPIENT (130k energy) + generous buffer
const MIN_GAS_TRX = 20; // 130k energy at 100 SUN/unit = 13 TRX + ~54% buffer

async function main() {
  console.log('=== STUCK PAYMENT RECOVERY ===');
  console.log(`Payment: ${PAYMENT_ID}`);
  console.log(`Pool: ${POOL_ADDRESS}`);
  console.log(`Merchant: ${MERCHANT_WALLET}`);
  console.log(`Amount: ${MERCHANT_AMOUNT} USDT-TRC20 (merchant) + ${ADMIN_FEE} USDT-TRC20 (admin fees)`);
  console.log('');

  // Step 1: Connect DB
  await sequelize.authenticate();
  console.log('✅ Step 1: Database connected');

  // Step 2: Verify payment state
  const [paymentRows] = await sequelize.query(
    `SELECT id, status, currency, amount, received_amount, user_id, company_id FROM tbl_user_transaction WHERE id = '${PAYMENT_ID}'`
  ) as any;

  if (!paymentRows || paymentRows.length === 0) {
    console.error('❌ Payment not found in DB');
    process.exit(1);
  }

  const payment = paymentRows[0];
  console.log(`✅ Step 2: Payment found — status: ${payment.status}, amount: ${payment.amount}, received: ${payment.received_amount}`);

  if (payment.status === 'payout_complete' || payment.status === 'completed') {
    console.log('⚠️  Payment already completed — no recovery needed');
    process.exit(0);
  }

  // Step 3: Get encrypted private key
  const [addrRows] = await sequelize.query(
    `SELECT private_key, status, admin_fee_balance FROM tbl_merchant_temp_address WHERE wallet_address = '${POOL_ADDRESS}'`
  ) as any;

  if (!addrRows || addrRows.length === 0) {
    console.error('❌ Pool address not found in DB');
    process.exit(1);
  }

  const encryptedKey = addrRows[0].private_key;
  console.log(`✅ Step 3: Encrypted key found (${encryptedKey.length} chars), status: ${addrRows[0].status}`);

  // Step 4: Decrypt private key
  let privateKey: string;
  try {
    const decrypted = await tatumApi.decryptSymmetric(encryptedKey, process.env.TEMP_KEY_ID);
    const walletData = JSON.parse(decrypted);
    privateKey = walletData.privateKey || walletData.secret || walletData;
    console.log(`✅ Step 4: Private key decrypted`);
  } catch (err) {
    console.error('❌ Step 4: KMS decryption failed:', err);
    process.exit(1);
  }

  // Step 5: Check on-chain balances
  let usdtBalance = 0;
  let trxBalance = 0;
  try {
    const usdtResult = await tatumApi.getAddressBalance(POOL_ADDRESS, CURRENCY);
    usdtBalance = Number(usdtResult?.balance ?? 0);

    const trxResult = await tatumApi.getAddressBalance(POOL_ADDRESS, 'TRX');
    trxBalance = Number(trxResult?.balance ?? 0);

    console.log(`✅ Step 5: On-chain balances — ${usdtBalance} USDT, ${trxBalance} TRX`);
  } catch (err) {
    console.error('❌ Step 5: Balance check failed:', err);
    process.exit(1);
  }

  if (usdtBalance < MERCHANT_AMOUNT) {
    console.error(`❌ Insufficient USDT balance: ${usdtBalance} < ${MERCHANT_AMOUNT}. Funds may have already been transferred.`);
    process.exit(1);
  }

  // Step 6: Fund gas (always use NEW_RECIPIENT energy = 130k = ~13 TRX + buffer)
  if (trxBalance < MIN_GAS_TRX) {
    const gasDeficit = MIN_GAS_TRX - trxBalance;
    console.log(`\n🔧 Step 6: Funding ${gasDeficit.toFixed(2)} TRX gas (have ${trxBalance}, need ${MIN_GAS_TRX})...`);

    try {
      const FEE_WALLET = process.env.TRX_FEE_WALLET_ADDRESS;
      const FEE_WALLET_KEY = process.env.TRX_FEE_WALLET_PRIVATE_KEY;

      if (!FEE_WALLET || !FEE_WALLET_KEY) {
        console.error('❌ TRX Fee wallet not configured. Set TRX_FEE_WALLET_ADDRESS and TRX_FEE_WALLET_PRIVATE_KEY');
        process.exit(1);
      }

      const gasTx = await tatumApi.assetToOtherAddress({
        currency: 'TRX',
        fromAddress: FEE_WALLET,
        toAddress: POOL_ADDRESS,
        privateKey: FEE_WALLET_KEY,
        amount: gasDeficit,
        fee: { fast: 0 },
      });

      console.log(`   ✅ Gas funded: ${gasDeficit.toFixed(2)} TRX, TX: ${gasTx?.txId || gasTx?.id}`);
      console.log('   ⏳ Waiting 10s for gas TX confirmation...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Re-check
      const trxResult2 = await tatumApi.getAddressBalance(POOL_ADDRESS, 'TRX');
      trxBalance = Number(trxResult2?.balance ?? 0);
      console.log(`   New TRX balance: ${trxBalance}`);
    } catch (err) {
      console.error('❌ Gas funding failed:', err);
      process.exit(1);
    }
  } else {
    console.log(`✅ Step 6: Sufficient TRX for gas (${trxBalance} ≥ ${MIN_GAS_TRX})`);
  }

  // Step 7: Transfer merchant amount to merchant wallet
  console.log(`\n🔄 Step 7: Transferring ${MERCHANT_AMOUNT} USDT from ${POOL_ADDRESS} → ${MERCHANT_WALLET}`);

  try {
    const result = await tatumApi.assetToOtherAddress({
      currency: CURRENCY,
      fromAddress: POOL_ADDRESS,
      toAddress: MERCHANT_WALLET,
      privateKey: privateKey,
      amount: MERCHANT_AMOUNT,
      fee: { fast: 30 }, // Generous feeLimit to prevent OUT_OF_ENERGY
      _contractAddress: USDT_CONTRACT,
    });

    const txId = result?.txId || result?.id || JSON.stringify(result);
    console.log(`\n✅ MERCHANT TRANSFER SUCCESSFUL!`);
    console.log(`   TX ID: ${txId}`);
    console.log(`   Amount: ${MERCHANT_AMOUNT} USDT-TRC20`);
    console.log(`   From: ${POOL_ADDRESS}`);
    console.log(`   To:   ${MERCHANT_WALLET}`);

    // Wait for confirmation
    console.log('   ⏳ Waiting 12s for TX confirmation...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Verify on-chain
    try {
      const newBalance = await tatumApi.getAddressBalance(POOL_ADDRESS, CURRENCY);
      console.log(`   Pool USDT balance after transfer: ${newBalance?.balance}`);
    } catch (_) { /* Non-critical */ }

    // Step 8: Update payment status in DB
    console.log(`\n📝 Step 8: Updating payment status...`);

    await sequelize.query(
      `UPDATE tbl_user_transaction SET status = 'payout_complete', transaction_hash_output = '${txId}', updated_at = NOW() WHERE id = '${PAYMENT_ID}'`
    );

    // Update pool address — release it
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', current_payment_id = NULL, admin_fee_balance = ${ADMIN_FEE}, last_payout_at = NOW() WHERE wallet_address = '${POOL_ADDRESS}'`
    );

    // Clear settlement idempotency lock in Redis (so sweep cron can run)
    try {
      const { setRedisItemWithTTL } = require('../utils/redisInstance');
      await setRedisItemWithTTL(`settlement:lock:${PAYMENT_ID}`, { status: 'completed', txId: txId, recoveredAt: new Date().toISOString() }, 86400);
      console.log('   ✅ Settlement lock cleared');
    } catch (_) { /* Non-critical */ }

    console.log(`   ✅ Payment marked as payout_complete`);
    console.log(`   ✅ Pool address released to AVAILABLE`);

    // Step 9: Send payment.settled webhook to merchant
    console.log(`\n📤 Step 9: Sending payment.settled webhook...`);
    try {
      const webhookUrl = 'https://nomadlynew-production.up.railway.app/dynopay/crypto-wallet';
      const axios = require('axios');
      await axios.post(webhookUrl, {
        event: 'payment.settled',
        payment_type: 'direct_api',
        address: POOL_ADDRESS,
        txId: txId,
        transaction_reference: txId,
        amount: 98,
        currency: CURRENCY,
        payment_id: PAYMENT_ID,
        status: 'settled',
        payment_status: 'payout_complete',
        base_amount: 98,
        merchant_amount: MERCHANT_AMOUNT,
        admin_fee: ADMIN_FEE,
        recovery: true,
      }, { timeout: 10000 });
      console.log('   ✅ Webhook sent to merchant');
    } catch (webhookErr: any) {
      console.warn(`   ⚠️ Webhook failed: ${webhookErr?.message || webhookErr}. Merchant should verify in their dashboard.`);
    }

    console.log('\n✅✅✅ RECOVERY COMPLETE ✅✅✅');

  } catch (err) {
    console.error(`\n❌ MERCHANT TRANSFER FAILED:`, err);
    console.log('\nTroubleshooting:');
    console.log('  1. Check TRX balance — may need more for 130k energy');
    console.log('  2. Verify pool address still has USDT');
    console.log('  3. Try running again — TRON network may have been congested');
    console.log(`  4. Check on tronscan: https://tronscan.org/#/address/${POOL_ADDRESS}`);
  }

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
