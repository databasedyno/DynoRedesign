/**
 * Direct execution of payment recovery logic
 * This bypasses HTTP/auth by calling the recovery function directly
 */

// Load environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import required modules - using compiled JS from dist
const { Sequelize, Op } = require('sequelize');

const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';

async function executeRecovery() {
  console.log('🔧 Direct Payment Recovery Execution');
  console.log('=====================================\n');
  
  try {
    // Initialize database connection using compiled code
    const dbConfig = require('../dist/config/db').default;
    await dbConfig.initialize();
    console.log('✅ Database connected\n');
    
    // Import compiled controller modules
    const merchantTempAddressModel = require('../dist/models/merchantPoolModels/merchantTempAddressModel').default;
    const merchantPoolTransactionModel = require('../dist/models/merchantPoolModels/merchantPoolTransactionModel').default;
    const userWalletModel = require('../dist/models/userModels/userWalletModel').default;
    const tatumApi = require('../dist/apis/tatumApi').default;
    const { getAdminWalletAddress } = require('../dist/utils/wallets');
    
    // Step 1: Find temp address
    console.log('📍 Step 1: Finding temp address record...');
    const tempAddrRecord = await merchantTempAddressModel.findOne({
      where: { current_payment_id: PAYMENT_ID },
    });
    
    if (!tempAddrRecord) {
      console.log('❌ Payment not found');
      process.exit(1);
    }
    
    const tempData = tempAddrRecord.dataValues;
    console.log('✅ Found temp address');
    console.log('   Address:', tempData.wallet_address);
    console.log('   Currency:', tempData.wallet_type);
    console.log('   Status:', tempData.status);
    console.log('   Owner ID:', tempData.owner_user_id);
    
    // Step 2: Check balance
    console.log('\n📍 Step 2: Checking on-chain balance...');
    const balanceResult = await tatumApi.getAddressBalance(
      tempData.wallet_address,
      tempData.wallet_type
    );
    const balance = Number(balanceResult?.balance || 0);
    console.log('✅ Balance:', balance, tempData.wallet_type);
    
    if (balance < 0.01) {
      console.log('❌ Insufficient balance');
      process.exit(1);
    }
    
    // Step 3: Find merchant wallet
    console.log('\n📍 Step 3: Finding merchant wallet...');
    const merchantWalletRecord = await userWalletModel.findOne({
      where: { 
        user_id: tempData.owner_user_id,
        wallet_type: tempData.wallet_type 
      },
    });
    
    const merchantWallet = merchantWalletRecord?.dataValues?.wallet_address;
    console.log('✅ Merchant wallet:', merchantWallet);
    
    if (!merchantWallet) {
      console.log('❌ Merchant wallet not found');
      process.exit(1);
    }
    
    // Step 4: Execute transfer
    console.log('\n📍 Step 4: Executing USDT transfer...');
    console.log('   From:', tempData.wallet_address);
    console.log('   To:', merchantWallet);
    console.log('   Amount:', balance);
    
    // Get private key for signing
    const privateKey = tempData.private_key;
    if (!privateKey) {
      console.log('❌ Private key not found');
      process.exit(1);
    }
    
    // Execute the transfer using Tatum
    console.log('\n🚀 Initiating blockchain transfer...');
    
    const transferResult = await tatumApi.transferFromCustodialAddress({
      chain: 'TRON',
      custodialAddress: tempData.wallet_address,
      tokenAddress: tempData.wallet_type.includes('TRC20') ? 
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : null, // USDT-TRC20 contract
      contractType: tempData.wallet_type.includes('TRC20') ? 0 : null,
      recipient: merchantWallet,
      amount: balance.toString(),
      fromPrivateKey: privateKey,
    });
    
    console.log('✅ Transfer submitted!');
    console.log('   TX Hash:', transferResult.txId);
    
    // Update status
    await tempAddrRecord.update({ status: 'payout_complete' });
    console.log('✅ Status updated to payout_complete');
    
    console.log('\n🎉 PAYMENT RECOVERY SUCCESSFUL!');
    console.log('   Payment ID:', PAYMENT_ID);
    console.log('   Amount:', balance, 'USDT');
    console.log('   TX:', transferResult.txId);
    
    await dbConfig.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

executeRecovery();
