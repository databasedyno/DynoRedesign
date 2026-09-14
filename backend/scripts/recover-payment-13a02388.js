/**
 * One-time script to recover stuck payment 13a02388-f14e-4d03-b1dd-5e40cd4de2fb
 * Run with: node backend/scripts/recover-payment-13a02388.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');
const merchantTempAddressModel = require('../models/merchantPoolModels/merchantTempAddressModel');

const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';

async function recoverPayment() {
  console.log('🔧 Payment Recovery Script Started\n');
  
  try {
    // Initialize database connection
    console.log('📡 Connecting to database...');
    const sequelize = merchantTempAddressModel.sequelize;
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Find the payment
    console.log(`🔍 Looking up payment ${PAYMENT_ID}...`);
    const payment = await merchantTempAddressModel.findOne({
      where: { payment_id: PAYMENT_ID }
    });
    
    if (!payment) {
      console.log('❌ Payment not found in database');
      process.exit(1);
    }
    
    console.log('\n📊 Payment Details:');
    console.log(`   Payment ID: ${payment.payment_id}`);
    console.log(`   Address: ${payment.wallet_address || payment.address}`);
    console.log(`   Amount: ${payment.received_amount} ${payment.currency}`);
    console.log(`   Current Status: ${payment.status}`);
    console.log(`   Merchant: ${payment.merchant_wallet_address}`);
    
    if (payment.status === 'payout_complete') {
      console.log('\n✅ Payment already completed!');
      process.exit(0);
    }
    
    // Reset status to trigger retry
    console.log('\n🔄 Resetting payment status to allow retry...');
    
    await payment.update({
      status: 'cryptoVerification_pass',
      updatedAt: new Date(),
    });
    
    console.log('✅ Payment status reset to: cryptoVerification_pass');
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Webhook/cron will pick up the payment');
    console.log('   2. SmartGas will fund TRX from fee wallet (143.98 TRX available)');
    console.log('   3. Settlement should complete within 5-15 minutes');
    
    console.log('\n⏰ Monitor progress:');
    console.log('   tail -f /var/log/supervisor/backend.out.log | grep "13a02388"');
    
    await sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the recovery
recoverPayment();
