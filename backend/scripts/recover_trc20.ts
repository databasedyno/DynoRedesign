// Recovery script: Decrypt private key via KMS, fund gas, transfer 19 USDT-TRC20 to admin wallet
// Run: cd /app/backend && npx ts-node scripts/recover_trc20.ts

import 'dotenv/config';
import tatumApi from '../apis/tatumApi';
import { calculateDynamicTRC20Fee } from '../services/tronEnergyService';
import { fundGasIfNeeded } from '../services/merchantPool/merchantPoolSweep';
import sequelize from '../utils/dbInstance';

const TEMP_ADDRESS = 'TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf';
const ADMIN_WALLET = 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR'; // USDT_TRC20 admin
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const CURRENCY = 'USDT-TRC20';

async function main() {
  console.log('=== STUCK PAYMENT RECOVERY: 19 USDT-TRC20 → Admin Wallet ===\n');

  // Step 1: Connect DB
  await sequelize.authenticate();
  console.log('✅ Step 1: Database connected');

  // Step 2: Get encrypted private key from DB
  const [rows] = await sequelize.query(
    `SELECT private_key, status, admin_fee_balance FROM tbl_merchant_temp_address WHERE wallet_address = '${TEMP_ADDRESS}'`
  ) as any;

  if (!rows || rows.length === 0) {
    console.error('❌ Address not found in DB');
    process.exit(1);
  }

  const encryptedKey = rows[0].private_key;
  console.log(`✅ Step 2: Found encrypted key (${encryptedKey.length} chars), status: ${rows[0].status}`);

  // Step 3: Decrypt private key via Google Cloud KMS
  let privateKey: string;
  try {
    const decrypted = await tatumApi.decryptSymmetric(encryptedKey, process.env.TEMP_KEY_ID);
    const walletData = JSON.parse(decrypted);
    privateKey = walletData.privateKey || walletData.secret || walletData;
    console.log(`✅ Step 3: Private key decrypted (${typeof privateKey === 'string' ? privateKey.length : '?'} chars)`);
  } catch (err) {
    console.error('❌ Step 3: KMS decryption failed:', err);
    process.exit(1);
  }

  // Step 4: Check on-chain balances
  let usdtBalance = 0;
  let trxBalance = 0;
  try {
    const usdtResult = await tatumApi.getAddressBalance(TEMP_ADDRESS, CURRENCY);
    usdtBalance = Number(usdtResult?.balance ?? 0);
    
    const trxResult = await tatumApi.getAddressBalance(TEMP_ADDRESS, 'TRX');
    trxBalance = Number(trxResult?.balance ?? 0);
    
    console.log(`✅ Step 4: Balances — ${usdtBalance} USDT, ${trxBalance} TRX`);
  } catch (err) {
    console.error('❌ Step 4: Balance check failed:', err);
    process.exit(1);
  }

  if (usdtBalance <= 0) {
    console.log('⚠️  No USDT balance — funds may have already been transferred');
    process.exit(0);
  }

  // Step 5: Calculate required energy and fund gas if needed
  try {
    const dynamicFee = await calculateDynamicTRC20Fee(TEMP_ADDRESS);
    console.log(`✅ Step 5: Energy estimation — need ${dynamicFee.fast} TRX, have ${trxBalance} TRX`);
    console.log(`   Energy: ${dynamicFee.energyNeeded} needed, ${dynamicFee.energyAvailable} available, price: ${dynamicFee.energyPrice} SUN/unit`);

    if (trxBalance < dynamicFee.fast) {
      console.log('   ⚡ Need more TRX for gas. Funding...');
      
      const fundResult = await fundGasIfNeeded(
        { dataValues: { wallet_address: TEMP_ADDRESS }, update: async () => {} } as any,
        CURRENCY,
        usdtBalance,
        ADMIN_WALLET
      );
      
      console.log(`   Gas funding result: funded=${fundResult.funded}, amount=${fundResult.amount}, txId=${fundResult.txId}`);
      
      if (fundResult.funded) {
        console.log('   ⏳ Waiting 8s for gas TX to confirm...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Re-check TRX balance
        const trxResult2 = await tatumApi.getAddressBalance(TEMP_ADDRESS, 'TRX');
        trxBalance = Number(trxResult2?.balance ?? 0);
        console.log(`   New TRX balance: ${trxBalance}`);
      }
    } else {
      console.log('   ✅ Sufficient TRX for gas');
    }
  } catch (err) {
    console.error('❌ Step 5: Energy/gas error:', err);
    // Continue anyway — might have enough gas
  }

  // Step 6: Transfer USDT to admin wallet
  console.log(`\n🔄 Step 6: Transferring ${usdtBalance} USDT from ${TEMP_ADDRESS} → ${ADMIN_WALLET}`);
  
  try {
    const feeObj = { fast: 30 }; // Use generous fee limit for TRC20

    const result = await tatumApi.assetToOtherAddress({
      currency: CURRENCY,
      fromAddress: TEMP_ADDRESS,
      toAddress: ADMIN_WALLET,
      privateKey: privateKey,
      amount: usdtBalance,
      fee: feeObj,
      _contractAddress: USDT_CONTRACT,
    });

    console.log(`\n✅ TRANSFER SUCCESSFUL!`);
    console.log(`   TX ID: ${result?.txId || result?.id || JSON.stringify(result)}`);
    console.log(`   Amount: ${usdtBalance} USDT-TRC20`);
    console.log(`   From: ${TEMP_ADDRESS}`);
    console.log(`   To:   ${ADMIN_WALLET}`);

    // Step 7: Update DB status
    await sequelize.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', admin_fee_balance = 0, received_amount = NULL, expected_amount = NULL, current_payment_id = NULL WHERE wallet_address = '${TEMP_ADDRESS}'`
    );
    console.log(`\n✅ Step 7: DB status updated to AVAILABLE`);

  } catch (err) {
    console.error(`\n❌ TRANSFER FAILED:`, err);
    console.log('\nTroubleshooting:');
    console.log('  - Check if TRX balance is sufficient for energy');
    console.log('  - Current TRON energy price may require more TRX');
    console.log('  - Try increasing fee limit');
  }

  await sequelize.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
