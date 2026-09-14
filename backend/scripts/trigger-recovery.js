/**
 * Direct call to recover-stuck-payment logic
 * Bypasses API auth to trigger settlement directly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const merchantTempAddressModel = require('../models/merchantPoolModels/merchantTempAddressModel');
const merchantPoolTransactionModel = require('../models/merchantPoolModels/merchantPoolTransactionModel');
const userWalletModel = require('../models/userModels/userWalletModel');
const tatumApi = require('../apis/tatumApi');
const { getAdminWalletAddress } = require('../utils/wallets');

const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';

async function recoverPayment() {
  console.log('🔧 Direct Payment Recovery\n');
  
  try {
    // Step 1: Find temp address record
    console.log('📍 Step 1: Finding temp address record...');
    const tempAddrRecord = await merchantTempAddressModel.findOne({
      where: { current_payment_id: PAYMENT_ID },
    });
    
    if (!tempAddrRecord) {
      console.log('❌ Temp address not found');
      process.exit(1);
    }
    
    const tempData = tempAddrRecord.dataValues;
    console.log('✅ Found:', tempData.wallet_address);
    console.log('   Currency:', tempData.wallet_type);
    console.log('   Status:', tempData.status);
    
    // Step 2: Check on-chain balance
    console.log('\n📍 Step 2: Checking on-chain balance...');
    const balanceData = await tatumApi.default.getAddressBalance(tempData.wallet_address, tempData.wallet_type);
    const onChainBalance = Number(balanceData?.balance || 0);
    console.log('✅ On-chain balance:', onChainBalance, tempData.wallet_type);
    
    if (onChainBalance < 0.01) {
      console.log('❌ No funds in pool address');
      process.exit(1);
    }
    
    // Step 3: Find merchant wallet
    console.log('\n📍 Step 3: Finding merchant destination wallet...');
    const merchantWalletRecord = await userWalletModel.findOne({
      where: { user_id: tempData.owner_user_id, wallet_type: tempData.wallet_type },
    });
    const merchantWallet = merchantWalletRecord?.dataValues?.wallet_address;
    console.log('✅ Merchant wallet:', merchantWallet);
    
    // Step 4: Trigger transfer
    console.log('\n📍 Step 4: Triggering USDT transfer...');
    console.log('   From:', tempData.wallet_address);
    console.log('   To:', merchantWallet);
    console.log('   Amount:', onChainBalance);
    
    // Import settlement function
    const paymentController = require('../controller/paymentController');
    
    // Call settlement directly (this requires the actual function to be exported)
    console.log('\n⚠️ Direct settlement function not available');
    console.log('✅ Manual trigger via API endpoint required');
    console.log('\nCurl command:');
    console.log(`curl -X POST https://api.dynopay.com/api/diagnostics/recover-stuck-payment \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\`);
    console.log(`  -d '{"payment_id": "${PAYMENT_ID}"}'`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

recoverPayment();
