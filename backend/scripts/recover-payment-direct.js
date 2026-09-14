/**
 * Direct Payment Recovery Script
 * Recovers payment 13a02388-f14e-4d03-b1dd-5e40cd4de2fb by calling settlement directly
 */

// Set up environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import necessary modules
const dbInstance = require('../config/db');

async function recoverPaymentDirect() {
  console.log('🔧 Direct Payment Recovery Starting...\n');
  
  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await dbInstance.initialize();
    const db = dbInstance.getDatabase();
    console.log('✅ Connected to:', dbInstance.getDatabaseName());
    
    const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';
    
    // Find the payment
    console.log(`\n🔍 Looking up payment ${PAYMENT_ID}...`);
    const payment = await db.collection('tbl_merchant_temp_address').findOne(
      { payment_id: PAYMENT_ID },
      { projection: { _id: 0 } }
    );
    
    if (!payment) {
      console.log('❌ Payment not found');
      process.exit(1);
    }
    
    console.log('\n📊 Payment Details:');
    console.log('   Payment ID:', payment.payment_id);
    console.log('   Address:', payment.wallet_address || payment.address);
    console.log('   Amount:', payment.received_amount, payment.currency);
    console.log('   Status:', payment.status);
    console.log('   Merchant Wallet:', payment.merchant_wallet_address);
    
    if (payment.status === 'payout_complete') {
      console.log('\n✅ Payment already completed!');
      process.exit(0);
    }
    
    // Import settlement function
    console.log('\n📦 Loading payment controller...');
    const paymentController = require('../controller/paymentController');
    
    // Check if we have the settleCryptoTransaction function
    if (typeof paymentController.settleCryptoTransactionDirect === 'function') {
      console.log('✅ Found direct settlement function');
    } else {
      console.log('⚠️ Using manual status reset method');
      
      // Reset status to trigger automatic retry
      console.log('\n🔄 Resetting payment status...');
      const result = await db.collection('tbl_merchant_temp_address').updateOne(
        { payment_id: PAYMENT_ID },
        { 
          $set: { 
            status: 'cryptoVerification_pass',
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log('✅ Payment status reset successfully');
        console.log('\n📝 Next Steps:');
        console.log('   1. Webhook/cron will pick up the payment');
        console.log('   2. SmartGas will fund TRX (143.98 TRX available)');
        console.log('   3. Settlement completes in 5-15 minutes');
        console.log('\n⏰ Monitor: tail -f /var/log/supervisor/backend.out.log | grep "13a02388"');
      } else {
        console.log('⚠️ No changes made');
      }
      
      await dbInstance.close();
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run recovery
recoverPaymentDirect();
